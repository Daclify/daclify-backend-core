import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  McpToolInputSchemas,
  McpReadInputSchema,
  McpPrepareInputSchema,
  SignedMcpInstructionSchema,
  PreparedInstructionSchema,
  McpPreparationSchema,
  McpReadResultSchema,
  SubmissionResultSchema,
} from '@daclify/core-protocol';
import type { CommunityAccess, CommunitySigner } from '@daclify/core-protocol/community-agent';
import { ProtectedCommunitySigner } from './signer.js';

const inputs = {
  ...McpToolInputSchemas,
  submit_signed: SignedMcpInstructionSchema,
};
export class CommunityTools {
  constructor(
    private readonly access: CommunityAccess,
    private readonly signer?: ProtectedCommunitySigner,
  ) {}
  names(): string[] {
    return [
      'list_daos',
      'get_membership',
      'list_activity',
      'prepare_proposal',
      'prepare_activity',
      'prepare_vote',
      'prepare_review',
      'submit_signed',
      ...(this.signer ? ['submit_prepared'] : []),
    ];
  }
  async call(name: string, input: unknown): Promise<unknown> {
    if (name === 'submit_prepared') {
      if (!this.signer) throw new Error('MCP_LOCAL_SIGNER_REQUIRED');
      const prepared = PreparedInstructionSchema.parse(input);
      const signature = await this.signer.signPrepared(prepared);
      return SubmissionResultSchema.parse(await this.access.submitSigned({ prepared, signature }));
    }
    if (name === 'submit_signed')
      return SubmissionResultSchema.parse(
        await this.access.submitSigned(SignedMcpInstructionSchema.parse(input)),
      );
    const read = McpReadInputSchema.safeParse({ tool: name, input });
    if (read.success) return McpReadResultSchema.parse(await this.access.read(read.data));
    const prepare = McpPrepareInputSchema.parse({ tool: name, input });
    return McpPreparationSchema.parse(await this.access.prepare(prepare));
  }
  register(server: McpServer, options?: { oauth: boolean }): void {
    for (const [name, inputSchema] of Object.entries(inputs))
      this.registerTool(server, name, inputSchema, options?.oauth ?? false);
    if (this.signer) this.registerTool(server, 'submit_prepared', PreparedInstructionSchema);
  }
  private registerTool(
    server: McpServer,
    name: string,
    inputSchema: z.ZodType,
    oauth = false,
  ): void {
    const scope = name.startsWith('prepare_')
      ? 'daclify:prepare'
      : name.startsWith('submit_')
        ? 'daclify:submit'
        : 'daclify:read';
    server.registerTool(
      name,
      {
        title: name.replaceAll('_', ' '),
        description: `Daclify ${name.replaceAll('_', ' ')} within the approved community scope.`,
        inputSchema,
        annotations: {
          readOnlyHint: scope === 'daclify:read',
          destructiveHint: scope === 'daclify:submit',
          openWorldHint: false,
        },
        ...(oauth ? { _meta: { securitySchemes: [{ type: 'oauth2', scopes: [scope] }] } } : {}),
      },
      async (input) => {
        try {
          return {
            content: [{ type: 'text', text: JSON.stringify(await this.call(name, input)) }],
          };
        } catch {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Daclify refused this request. Refresh membership, scope, nonce and consent before retrying.',
              },
            ],
          };
        }
      },
    );
  }
}
export function createCommunityTools(
  access: CommunityAccess,
  signer?: CommunitySigner,
): CommunityTools {
  if (signer && !(signer instanceof ProtectedCommunitySigner))
    throw new Error('MCP_UNQUALIFIED_SIGNER');
  return new CommunityTools(access, signer);
}
