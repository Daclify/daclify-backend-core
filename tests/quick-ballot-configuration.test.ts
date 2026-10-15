import { expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { parseModuleDeployments } from '../services/api/src/deployment-config.js';
const config = {
  rpcUrl: 'http://127.0.0.1:18888',
  chainId: '11'.repeat(32),
  runtime: 'daclifycore1',
  hub: null,
  environment: 'testnet' as const,
  relayActor: 'gateway',
  relayKey: PrivateKey.generate('K1'),
};
it('configures Quick ballots alongside all six existing deployed modules', () => {
  const modules = [
    { id: 'decide', account: 'daclifydecid' },
    { id: 'works', account: 'daclifyworks' },
    { id: 'payroll', account: 'daclifypayr1' },
    { id: 'grants-rounds', account: 'daclifygrant' },
    { id: 'endorsement-admission', account: 'daclifyendor' },
    { id: 'activity', account: 'daclifyactiv' },
    { id: 'quick-ballots', account: 'daclifyquick' },
  ];
  expect(parseModuleDeployments(JSON.stringify(modules))).toEqual(modules);
  expect(() => parseModuleDeployments(JSON.stringify([...modules, modules[0]]))).toThrow(
    'MODULE_DEPLOYMENTS_INVALID',
  );
});
it('keeps Quick ballots unavailable until both qualified source and account authority are configured', () => {
  expect(new NativeChainGateway(config).quickBallots).toBeUndefined();
  expect(() => new NativeChainGateway({ ...config, quickAuthority: 'quickauth' })).toThrow(
    'QUICK_CONFIGURATION_INVALID',
  );
  expect(
    new NativeChainGateway({
      ...config,
      quickAuthority: 'quickauth',
      modules: [{ id: 'quick-ballots', account: 'quickvote' }],
    }).quickBallots,
  ).toBeDefined();
});
it('refuses to expose the experimental feature on mainnet', () => {
  expect(
    () =>
      new NativeChainGateway({
        ...config,
        environment: 'mainnet',
        quickAuthority: 'quickauth',
        modules: [{ id: 'quick-ballots', account: 'quickvote' }],
      }),
  ).toThrow('QUICK_TESTNET_ONLY');
});
