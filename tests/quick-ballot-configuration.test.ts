import { expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
const config = {
  rpcUrl: 'http://127.0.0.1:18888',
  chainId: '11'.repeat(32),
  runtime: 'daclifycore1',
  hub: null,
  environment: 'testnet' as const,
  relayActor: 'gateway',
  relayKey: PrivateKey.generate('K1'),
};
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
