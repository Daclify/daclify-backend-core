import type { ChainGateway } from '../../services/api/src/chain.js';
import { NetworkSchema } from '../../protocol/api.js';
const chainId = 'ab'.repeat(32);
export const authChain: ChainGateway = {
  network: async () =>
    NetworkSchema.parse({
      chainId,
      rpcUrl: 'http://localhost:18888',
      runtime: 'daclifycore',
      hub: null,
      environment: 'local',
      interfaceVersion: 1,
      coreVersion: '0.12.0-alpha.1',
      capabilities: [],
    }),
  memberships: async () => [],
  listDaos: async () => [],
  memberProfile: async () => ({ accountName: null, profile: null }),
  governance: async () => {
    throw new Error('unused');
  },
  execute: async () => {
    throw new Error('unused');
  },
  finalize: async () => ({ state: 'already-finalized' }),
  treasury: async () => {
    throw new Error('unused');
  },
  settle: async () => ({ state: 'already-settled' }),
  dao: async () => {
    throw new Error('unused');
  },
  content: async () => {
    throw new Error('unused');
  },
  moduleState: async () => {
    throw new Error('unused');
  },
  createDao: async () => {
    throw new Error('unused');
  },
  relay: async () => {
    throw new Error('unused');
  },
};
