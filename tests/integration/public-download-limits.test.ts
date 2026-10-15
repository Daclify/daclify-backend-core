import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { ContentService } from '../../services/api/src/content/service.js';
import type { ContentProvider } from '../../services/api/src/content/provider.js';
import {
  GatewayAllowance,
  registerGatewayAllowance,
} from '../../services/api/src/content/gateway-allowance.js';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import { authChain } from '../helpers/auth-chain.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { DaoContentSchema } from '../../protocol/content.js';
import { ApiRoutes } from '../../protocol/routes.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());

it('bounds public provider reads across documents and branding without making ciphertext private', async () => {
  const bytes = Buffer.from('owned stored ciphertext fixture'),
    id = randomUUID(),
    scope = 'owned-security-download-fixture-' + id,
    gateway = 'https://gateway.example';
  await registerGatewayAllowance(pool, {
    id,
    providerScope: scope,
    gateway,
    startsAt: new Date(Date.now() - 1000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    byteLimit: '100000',
    requestLimit: '1000',
    fundingReference: 'owned-fixture',
  });
  const allowance = new GatewayAllowance(pool, scope, gateway, id);
  const chain: ChainGateway = {
    ...authChain,
    content: async () =>
      DaoContentSchema.parse({
        dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
        members: [],
        epochs: [],
        keyGrants: [],
        documents: [
          {
            id: '1',
            document_id: '1',
            version: 1,
            author: '1',
            cid: 'fixture-cid',
            metadata: '{}',
            commitment: createHash('sha256').update(bytes).digest('hex'),
            bytes: bytes.length,
            envelope_version: 1,
            key_epoch: '1',
          },
        ],
      }),
  };
  chain.contentDocument = async (_daoId: string, documentId: string, version: number) => {
    const content = await chain.content('1');
    return {
      dao: content.dao,
      document:
        content.documents.find(
          (row) => row.document_id === documentId && row.version === version,
        ) ?? null,
    };
  };
  const provider: ContentProvider = {
    async upload() {
      throw new Error('No fixture uploads');
    },
    async find() {
      return [];
    },
    async remove() {
      throw new Error('No fixture removals');
    },
    async retrieve() {
      await allowance.reserve(bytes.length);
      return bytes;
    },
  };
  const server = await createServer(pool, chain, 'http://localhost:5178', {
    content: new ContentService(pool, chain, provider, 0n, 'pinata', scope),
  });
  const path = ApiRoutes.documentBytes.path
    .replace(':id', '1')
    .replace(':documentId', '1')
    .replace(':version', '1');
  const get = (remoteAddress = '203.0.113.8', headers = {}) =>
    server.inject({ url: path, remoteAddress, headers });
  let clock: ReturnType<typeof vi.spyOn> | undefined;
  try {
    for (let index = 0; index < 100; index++) {
      const response = await get();
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ content: bytes.toString('base64') });
    }
    const denied = await get('203.0.113.8', { 'x-forwarded-for': '203.0.113.99' });
    expect(denied.statusCode).toBe(429);
    expect(denied.json()).toMatchObject({ code: 'RATE_LIMIT' });
    expect((await allowance.status()).requests).toBe('100');
    const branding = ApiRoutes.branding.path.replace(':id', '1').replace(':slot', 'logo');
    expect((await server.inject({ url: branding, remoteAddress: '203.0.113.8' })).statusCode).toBe(
      429,
    );
    expect((await get('203.0.113.9')).statusCode).toBe(200);
    clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60001);
    expect((await get()).statusCode).toBe(200);
    expect((await allowance.status()).requests).toBe('102');
  } finally {
    clock?.mockRestore();
    await server.close();
  }
});
