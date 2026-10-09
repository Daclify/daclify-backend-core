import { expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { createServer } from '../services/api/src/server.js';

it('trusts forwarding only from the loopback proxy and preserves browser Origin', async () => {
  const pool = new Pool({ connectionString: 'postgres://unused@127.0.0.1:1/unused' });
  const chain = new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:1',
    chainId: 'ab'.repeat(32),
    runtime: 'fixture',
    hub: null,
    environment: 'local',
    relayActor: 'fixture',
    relayKey: PrivateKey.generate('K1'),
  });
  const app = await createServer(pool, chain, 'https://app.daclify.com');
  app.get('/fixture/proxy', async (request) => ({
    ip: request.ip,
    protocol: request.protocol,
    origin: request.headers.origin,
  }));
  try {
    const headers = {
      origin: 'https://app.daclify.com',
      'x-forwarded-for': '203.0.113.10',
      'x-forwarded-proto': 'https',
    };
    const trusted = await app.inject({
      url: '/fixture/proxy',
      remoteAddress: '127.0.0.1',
      headers,
    });
    expect(trusted.json()).toEqual({
      ip: '203.0.113.10',
      protocol: 'https',
      origin: 'https://app.daclify.com',
    });
    const untrusted = await app.inject({
      url: '/fixture/proxy',
      remoteAddress: '198.51.100.20',
      headers,
    });
    expect(untrusted.json()).toEqual({
      ip: '198.51.100.20',
      protocol: 'http',
      origin: 'https://app.daclify.com',
    });
    expect(trusted.headers['access-control-allow-origin']).toBe('https://app.daclify.com');
  } finally {
    await app.close();
    await pool.end();
  }
});
