import { afterEach, expect, it, vi } from 'vitest';
import { Client, Pool } from 'pg';
import { withTransaction } from '../services/api/src/auth/account-session.js';
import { ApiError } from '../services/api/src/errors.js';

afterEach(() => vi.restoreAllMocks());
function fixture(failed: string[] = []) {
  const pool = new Pool(),
    client = Object.assign(new Client(), { release: vi.fn() });
  const statements: string[] = [];
  vi.spyOn(pool, 'connect').mockImplementation(async () => client);
  vi.spyOn(client, 'query').mockImplementation(async (query) => {
    if (typeof query !== 'string') throw new Error('EXPECTED_TRANSACTION_STATEMENT');
    statements.push(query);
    if (failed.includes(query)) throw new Error(query + '_FAILED');
    return { command: query, rowCount: 0, oid: 0, rows: [], fields: [] };
  });
  return { pool, client, statements };
}
it('preserves the operation error when transaction rollback also fails', async () => {
  const { pool, client } = fixture(['ROLLBACK']);
  const original = new ApiError('AUTH_INVALID', 401);
  await expect(
    withTransaction(pool, async () => {
      throw original;
    }),
  ).rejects.toBe(original);
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
it('commits a successful operation and releases its usable connection', async () => {
  const { pool, client, statements } = fixture();
  expect(await withTransaction(pool, async () => 'complete')).toBe('complete');
  expect(statements).toEqual(['BEGIN', 'COMMIT']);
  expect(client.release).toHaveBeenCalledTimes(1);
  expect(client.release).not.toHaveBeenCalledWith(true);
});
it('rolls back an operation failure while retaining its original error', async () => {
  const { pool, client, statements } = fixture();
  const original = new Error('OPERATION_FAILED');
  await expect(
    withTransaction(pool, async () => {
      throw original;
    }),
  ).rejects.toBe(original);
  expect(statements).toEqual(['BEGIN', 'ROLLBACK']);
  expect(client.release).toHaveBeenCalledTimes(1);
  expect(client.release).not.toHaveBeenCalledWith(true);
});
it('retains a failed commit rather than its failed cleanup error', async () => {
  const { pool, client } = fixture(['COMMIT', 'ROLLBACK']);
  await expect(withTransaction(pool, async () => 'complete')).rejects.toThrow('COMMIT_FAILED');
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
it('preserves the last-control-credential mapping even when rollback fails', async () => {
  const { pool, client } = fixture(['ROLLBACK']);
  await expect(
    withTransaction(pool, async () => {
      throw { code: '23514', constraint: 'wallet_account_control_required' };
    }),
  ).rejects.toMatchObject({ code: 'LAST_CONTROL_CREDENTIAL', statusCode: 409 });
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
