import { describe, it, expect, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { TreasurySchema, SettlementRequestSchema } from '../protocol/treasury.js';
const reference = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1,
};
const request = SettlementRequestSchema.parse({ dao: reference, source: 'works', sourceId: '9' });
function fixture(status: number) {
  const gateway = new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:18888',
    chainId: reference.chainId,
    runtime: reference.contract,
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
  const read = vi.spyOn(gateway, 'treasury').mockResolvedValue(
    TreasurySchema.parse({
      dao: reference,
      obligations: [
        {
          id: '1',
          source: 'works',
          source_id: '9',
          recipient: '2',
          quantity: '1.0000 TLOS',
          due: 0,
          status,
        },
      ],
      evidence: [],
    }),
  );
  return { gateway, read };
}
describe('ordinary obligation settlement gateway behavior', () => {
  it('returns an existing settled status without submitting another transaction', async () => {
    const { gateway, read } = fixture(2);
    expect(await gateway.settle(request)).toEqual({ state: 'already-settled' });
    expect(read).toHaveBeenCalledOnce();
  });
  it('leaves reserved and cancelled obligations unchanged', async () => {
    for (const status of [0, 3])
      await expect(fixture(status).gateway.settle(request)).rejects.toThrow(
        'OBLIGATION_NOT_PAYABLE',
      );
  });
  it('reports an unknown source record without submitting a payment', async () => {
    await expect(fixture(1).gateway.settle({ ...request, sourceId: '10' })).rejects.toThrow(
      'OBLIGATION_UNKNOWN',
    );
  });
  it('requires the configured deployment reference before reading its treasury', async () => {
    const { gateway, read } = fixture(1);
    await expect(
      gateway.settle({ ...request, dao: { ...request.dao, contract: 'daclifytwo' } }),
    ).rejects.toThrow('DAO_REFERENCE');
    expect(read).not.toHaveBeenCalled();
  });
});
