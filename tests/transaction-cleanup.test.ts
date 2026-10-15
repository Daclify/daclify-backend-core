import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { Client, Pool } from 'pg';
import { authenticate } from '../services/api/src/auth.js';
import { migrate } from '../services/api/src/store.js';
import { PostgresServicePayments } from '../services/api/src/billing/settle.js';
import { registerGatewayAllowance } from '../services/api/src/content/gateway-allowance.js';
import { ArchiveExports } from '../services/api/src/archive/exports.js';
import { HostedAssets } from '../services/api/src/content/assets.js';
import type { ChainGateway } from '../services/api/src/chain.js';
import type { ContentProvider } from '../services/api/src/content/provider.js';
import { EncryptionPublicKeySchema } from '../protocol/crypto.js';

afterEach(() => vi.restoreAllMocks());
function fixture(options: { rollbackFails?: boolean; unlockFails?: boolean; fail?: string } = {}) {
  const pool = new Pool(),
    client = Object.assign(new Client(), { release: vi.fn() });
  const original = new Error('OPERATION_FAILED'),
    statements: string[] = [];
  vi.spyOn(pool, 'connect').mockImplementation(async () => client);
  vi.spyOn(pool, 'query').mockImplementation(async () => ({
    command: 'SELECT',
    rowCount: 0,
    oid: 0,
    rows: [],
    fields: [],
  }));
  vi.spyOn(client, 'query').mockImplementation(async (query) => {
    if (typeof query !== 'string') throw new Error('EXPECTED_SQL');
    statements.push(query);
    if (query === 'ROLLBACK' && options.rollbackFails) throw new Error('ROLLBACK_FAILED');
    if (query.includes('pg_advisory_unlock') && options.unlockFails)
      throw new Error('UNLOCK_FAILED');
    if (options.fail && query.includes(options.fail)) throw original;
    return {
      command: query,
      rowCount: 0,
      oid: 0,
      rows: query.includes('pg_try_advisory_lock') ? [{ locked: true }] : [],
      fields: [],
    };
  });
  return { pool, client, original, statements };
}
it('keeps invalid authentication visible when its rollback also fails', async () => {
  const { pool, client } = fixture({ rollbackFails: true });
  const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const encryption = EncryptionPublicKeySchema.parse(jwk);
  await expect(
    authenticate(pool, randomUUID(), 'unused-without-challenge', encryption),
  ).rejects.toMatchObject({ code: 'AUTH_INVALID', statusCode: 401 });
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
it('keeps the migration failure instead of the rollback failure', async () => {
  const { pool, client, original } = fixture({
    rollbackFails: true,
    fail: 'pg_advisory_xact_lock',
  });
  await expect(migrate(pool)).rejects.toBe(original);
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
it('keeps a payment commit failure instead of the rollback failure', async () => {
  const { pool, client, original } = fixture({ rollbackFails: true, fail: 'COMMIT' });
  await expect(
    new PostgresServicePayments(pool).settle(
      { kind: 'ignore', reason: 'EVENT_TYPE' },
      'unused',
      Buffer.alloc(32),
    ),
  ).rejects.toBe(original);
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
it('keeps a gateway reservation failure instead of the rollback failure', async () => {
  const { pool, client, original } = fixture({
    rollbackFails: true,
    fail: 'pg_advisory_xact_lock',
  });
  await expect(
    registerGatewayAllowance(pool, {
      id: randomUUID(),
      providerScope: 'cleanup-fixture',
      gateway: 'https://fixture.mypinata.cloud',
      startsAt: '2026-10-11T00:00:00.000Z',
      endsAt: '2026-10-12T00:00:00.000Z',
      byteLimit: '100',
      requestLimit: '3',
      fundingReference: 'owned-fixture',
    }),
  ).rejects.toBe(original);
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
it('keeps a usable migration connection after successful rollback', async () => {
  const { pool, client, original } = fixture({ fail: 'pg_advisory_xact_lock' });
  await expect(migrate(pool)).rejects.toBe(original);
  expect(client.release).toHaveBeenCalledTimes(1);
  expect(client.release).not.toHaveBeenCalledWith(true);
});
const unavailable = async (): Promise<never> => {
  throw new Error('OUTSIDE_CLEANUP_FIXTURE');
};
const chain: ChainGateway = {
  governance: unavailable,
  execute: unavailable,
  finalize: unavailable,
  treasury: unavailable,
  settle: unavailable,
  dao: unavailable,
  contentDocument: unavailable,
  content: unavailable,
  moduleState: unavailable,
  network: unavailable,
  listDaos: unavailable,
  memberships: unavailable,
  memberProfile: unavailable,
  createDao: unavailable,
  relay: unavailable,
};
const provider: ContentProvider = {
  upload: unavailable,
  find: unavailable,
  retrieve: unavailable,
  remove: unavailable,
};
it.each([false, true])(
  'releases a locked archive connection and keeps its error when rollback fails: %s',
  async (rollbackFails) => {
    const { pool, client, statements } = fixture({ rollbackFails, unlockFails: true });
    const assets = new HostedAssets(pool, chain, provider, 0n, 'cleanup-fixture');
    const archives = new ArchiveExports(pool, chain, assets, provider, 0n, 'cleanup-fixture');
    await expect(archives.reconcile(randomUUID())).rejects.toMatchObject({
      code: 'ARCHIVE_NOT_FOUND',
    });
    expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(statements.filter((sql) => sql.includes('pg_advisory_unlock'))).toHaveLength(
      rollbackFails ? 0 : 1,
    );
  },
);
