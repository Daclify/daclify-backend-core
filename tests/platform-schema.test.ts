import { describe, it, expect } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { CreationRequestSchema } from '../protocol/platform.js';
import { randomUUID } from 'node:crypto';
describe('public platform boundaries', () => {
  it('refuses credential-bearing RPC URLs rather than disclosing them in public network status', () => {
    for (const rpcUrl of [
      'https://user:secret@api.example',
      'https://api.example?token=secret',
      'https://api.example#secret',
    ])
      expect(
        () =>
          new NativeChainGateway({
            rpcUrl,
            chainId: 'ab'.repeat(32),
            runtime: 'daclifycore',
            hub: null,
            environment: 'local',
            relayActor: 'relay',
            relayKey: PrivateKey.generate('K1'),
          }),
      ).toThrow('RPC_PUBLIC_ENDPOINT_REQUIRED');
  });
  it('refuses browser-supplied fee, receipt and resource prices', () => {
    const request = {
      requestId: randomUUID(),
      deployment: 'shared',
      method: 'tlos',
      request: {
        metadata: { schemaVersion: 1, title: 'Fixture', description: '' },
        privacy: 'public',
        token: { chainId: 'ab'.repeat(32), contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
      },
    };
    expect(CreationRequestSchema.safeParse(request).success).toBe(true);
    for (const extra of [
      { usdCents: 1 },
      { paid: true },
      { resourcesUsdCents: 0 },
      { transactionId: 'cd'.repeat(32) },
    ])
      expect(CreationRequestSchema.safeParse({ ...request, ...extra }).success).toBe(false);
  });
});
