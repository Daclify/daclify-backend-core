import {
  McpPairingRoutes,
  PreparedInstructionSchema,
  type PreparedInstruction,
  type McpReadInput,
  type McpPrepareInput,
  type SignedMcpInstruction,
} from '@daclify/core-protocol';
import type { CommunityAccess } from '@daclify/core-protocol/community-agent';
import { readAppResponse } from '@daclify/core-protocol/connected-apps';
import type { LocalCredentialsSchema } from './credentials.js';
import type { z } from 'zod';
export async function mcpRequest(api: string, path: string, body?: unknown, token?: string):Promise<unknown> {
  const response = await fetch(new URL(path, api), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(response.status === 403 ? 'MCP_APPROVAL_PENDING' : 'MCP_API_REJECTED');
  return JSON.parse(new TextDecoder().decode(await readAppResponse(response, 32768)));
}
export class LocalCommunityClient implements CommunityAccess {
  constructor(
    private readonly credentials: z.infer<typeof LocalCredentialsSchema>,
    private readonly confirm?: (prepared: PreparedInstruction) => Promise<void>,
  ) {}
  private async request(path: string, body?: unknown) {
    return mcpRequest(this.credentials.api, path, body, this.credentials.grantToken);
  }
  async status() {
    const result = McpPairingRoutes.mcpLocalStatus.response.parse(
      await this.request(McpPairingRoutes.mcpLocalStatus.path),
    );
    if (result.id !== this.credentials.grantId) throw Error('MCP_CONTEXT_CHANGED');
    return result;
  }
  async read(input: McpReadInput) {
    return McpPairingRoutes.mcpLocalRead.response.parse(
      await this.request(McpPairingRoutes.mcpLocalRead.path, input),
    );
  }
  async prepare(input: McpPrepareInput) {
    return McpPairingRoutes.mcpLocalPrepare.response.parse(
      await this.request(McpPairingRoutes.mcpLocalPrepare.path, input),
    );
  }
  async validatePrepared(input: PreparedInstruction) {
    const prepared = PreparedInstructionSchema.parse(input),
      grant = await this.status();
    if (grant.mode === 'confirm') {
      if (!this.confirm) throw Error('MCP_TRUSTED_CONFIRMATION_REQUIRED');
      await this.confirm(prepared);
    }
    return McpPairingRoutes.mcpLocalValidate.response.parse(
      await this.request(McpPairingRoutes.mcpLocalValidate.path, prepared),
    );
  }
  async submitSigned(input: SignedMcpInstruction) {
    return McpPairingRoutes.mcpLocalSubmit.response.parse(
      await this.request(McpPairingRoutes.mcpLocalSubmit.path, input),
    );
  }
  async revoke() {
    return McpPairingRoutes.mcpLocalRevoke.response.parse(
      await this.request(McpPairingRoutes.mcpLocalRevoke.path, {}),
    );
  }
}
