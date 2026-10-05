import { describe, it, expect, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { Catalog, ModuleStateSchema, ModuleApiRoutes } from '@daclify/modules';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
const request = ModuleApiRoutes.finalize.input.parse({
  dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
  ballotId: '9',
});
function fixture() {
  const manifest = Catalog.find((row) => row.id === 'decide');
  if (!manifest) throw new Error('Decide fixture unavailable');
  const gateway = new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:18888',
    chainId: request.dao.chainId,
    runtime: request.dao.contract,
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
  const state = ModuleStateSchema.parse({
    dao: request.dao,
    modules: [
      {
        deployment: {
          id: 'decide',
          account: 'decide',
          version: manifest.version,
          codeHash: ModuleCodeHashes.decide,
        },
        manifest,
        enabled: false,
        compatible: true,
        codeVerified: true,
        actions: [],
        grants: [],
      },
    ],
    ballots: [
      {
        id: '9',
        dao_id: '1',
        creator: '1',
        kind: 0,
        choices: 2,
        closes: 0,
        quorum: 1,
        approval: 5001,
        denominator: '1',
        max_member: '1',
        cast: '1',
        tallies: ['0', '1'],
        status: 1,
        winner: 1,
        metadata: '{}',
      },
    ],
    votes: [],
    projects: [],
    milestones: [],
    schedules: [],
    entries: [],
  });
  const read = vi.spyOn(gateway, 'moduleState').mockImplementation(async () => state);
  return { gateway, state, read };
}
describe('reviewed Decide finalization gateway', () => {
  it('returns the existing result after disabling new member actions', async () => {
    expect(await fixture().gateway.finalize(request)).toEqual({ state: 'already-finalized' });
  });
  it('requires a compatible, verified deployment before forwarding its action', async () => {
    for (const field of ['codeVerified', 'compatible'] as const) {
      const { gateway, state } = fixture();
      const module = state.modules[0];
      if (!module) throw new Error('Module fixture unavailable');
      module[field] = false;
      await expect(gateway.finalize(request)).rejects.toThrow('MODULE_UNVERIFIED');
    }
  });
  it('rejects an unknown ballot and a different deployment reference', async () => {
    const { gateway, read } = fixture();
    await expect(gateway.finalize({ ...request, ballotId: '10' })).rejects.toThrow(
      'BALLOT_UNKNOWN',
    );
    read.mockClear();
    await expect(
      gateway.finalize({ ...request, dao: { ...request.dao, contract: 'daclifytwo' } }),
    ).rejects.toThrow('DAO_REFERENCE');
    expect(read).not.toHaveBeenCalled();
  });
});
