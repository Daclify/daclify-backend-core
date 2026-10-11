import { expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { createServer } from '../services/api/src/server.js';
import {
  parseTrustedProxyIps,
  parseSharedProxyIps,
} from '../services/api/src/deployment-config.js';

it('uses a configured private proxy and stops at the nearest untrusted forwarded client', async () => {
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
  const app = await createServer(pool, chain, 'https://app.daclify.com', {
    trustedProxyIps: ['192.168.5.1'],
  });
  app.get('/fixture/proxy', async (request) => ({ ip: request.ip }));
  try {
    const headers = { 'x-forwarded-for': '203.0.113.250, 203.0.113.10' };
    expect(
      (await app.inject({ url: '/fixture/proxy', remoteAddress: '192.168.5.1', headers })).json(),
    ).toEqual({ ip: '203.0.113.10' });
    expect(
      (await app.inject({ url: '/fixture/proxy', remoteAddress: '192.168.5.2', headers })).json(),
    ).toEqual({ ip: '192.168.5.2' });
    const clients = await Promise.all(
      ['203.0.113.11', '203.0.113.12'].map((ip) =>
        app.inject({
          url: '/fixture/proxy',
          remoteAddress: '192.168.5.1',
          headers: { 'x-forwarded-for': ip },
        }),
      ),
    );
    expect(clients.map((response) => response.json())).toEqual([
      { ip: '203.0.113.11' },
      { ip: '203.0.113.12' },
    ]);
  } finally {
    await app.close();
    await pool.end();
  }
});
it('rejects broad or malformed proxy trust configuration', () => {
  for (const value of ['true', '["*"]', '["192.168.0.0/16"]', '["localhost"]'])
    expect(() => parseTrustedProxyIps(value)).toThrow('TRUSTED_PROXY_IPS_INVALID');
});

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

it('requires shared proxy addresses to be exact and separate from trusted forwarders', () => {
  expect(parseSharedProxyIps()).toEqual([]);
  expect(parseSharedProxyIps('["192.168.5.1","192.168.5.1"]')).toEqual(['192.168.5.1']);
  for (const value of ['true', '["*"]', '["192.168.0.0/16"]', '["localhost"]', '["127.0.0.1"]'])
    expect(() => parseSharedProxyIps(value)).toThrow('SHARED_PROXY_IPS_INVALID');
  expect(() => parseSharedProxyIps('["192.168.5.1"]', ['192.168.5.1'])).toThrow(
    'SHARED_PROXY_IPS_INVALID',
  );
});
