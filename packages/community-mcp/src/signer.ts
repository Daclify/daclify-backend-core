import { PrivateKey } from '@wharfkit/antelope';
import type { PreparedInstruction } from '@daclify/core-protocol';
import { CommunityAgentClient, type CommunitySigner } from '@daclify/core-protocol/community-agent';
import { instructionDigest, type instruction as Instruction } from '@daclify/core-protocol/sdk';

export class ProtectedCommunitySigner implements CommunitySigner {
  private readonly key: PrivateKey;
  constructor(
    private readonly client: Pick<CommunityAgentClient, 'validatePrepared'>,
    delegateKey: string,
  ) {
    this.key = PrivateKey.from(delegateKey);
  }
  async signLoginMessage(): Promise<string> {
    throw new Error('MCP_ROOT_CEREMONY_REQUIRED');
  }
  async signInstruction(_request: Instruction): Promise<string> {
    throw new Error('MCP_PREPARED_REQUIRED');
  }
  async signPrepared(prepared: PreparedInstruction): Promise<string> {
    const request = await this.client.validatePrepared(prepared);
    if (prepared.signingPublicKey !== this.key.toPublic().toString())
      throw new Error('MCP_SIGNER_KEYS');
    return this.key.signDigest(instructionDigest(request)).toString();
  }
}
