import { createServer } from 'node:http';
import { once } from 'node:events';
import { PrivateKey } from '@wharfkit/antelope';
import { expect, it, vi } from 'vitest';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { createRpcClient } from '../services/api/src/rpc.js';
import { contractError } from '../services/api/src/errors.js';

it('keeps a transport failure distinct from an explicit contract rejection', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('private node detail');
    }),
  );
  try {
    const error: unknown = await createRpcClient('https://rpc.example')
      .call({
        path: '/v1/chain/push_transaction',
        params: {},
      })
      .catch((cause: unknown) => cause);
    expect(contractError(error)).toMatchObject({ code: 'CHAIN_UNAVAILABLE', statusCode: 503 });
  } finally {
    vi.unstubAllGlobals();
  }
});

it('aborts a native SDK request when the RPC accepts the connection but never responds', async () => {
  const server = createServer(() => undefined);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture listener missing');
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  const deadline = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout(25));
  try {
    const chain = new NativeChainGateway({
      rpcUrl: 'http://127.0.0.1:' + address.port,
      chainId: 'ab'.repeat(32),
      runtime: 'daclifycore',
      relayActor: 'relay',
      relayKey: PrivateKey.generate('K1'),
      hub: null,
      environment: 'local',
    });
    const result = await Promise.race([
      chain.network().catch((error: unknown) => error),
      new Promise<string>((resolve) => setTimeout(() => resolve('UNBOUNDED_RPC'), 1000)),
    ]);
    expect(result).toMatchObject({ code: 'CHAIN_UNAVAILABLE', statusCode: 503 });
    expect(deadline).toHaveBeenCalledWith(10000);
  } finally {
    deadline.mockRestore();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
