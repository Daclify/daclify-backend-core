import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../services/api/src/store.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error('Owned local test DB required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
describe('Connect persistence boundaries', () => {
  it('enforces immutable snapshot arithmetic and full DAO identity', async () => {
    const id = randomUUID();
    const dao = { chainId: 'ab'.repeat(32), contract: 'daoone', daoId: '1', interfaceVersion: 1 };
    const key = JSON.stringify([dao.chainId, dao.contract, dao.daoId, dao.interfaceVersion]);
    await pool.query('INSERT INTO dao_merchants(dao_key,dao,creation_request) VALUES($1,$2,$3)', [
      key,
      dao,
      id,
    ]);
    try {
      await expect(
        pool.query(
          "INSERT INTO dao_payment_products(id,dao_key,module_id,title,amount_minor) VALUES($1,$2,'works','Invalid',-1)",
          [id, key],
        ),
      ).rejects.toThrow();
      await expect(
        pool.query(
          "INSERT INTO dao_merchants(dao_key,dao,creation_request) VALUES('forged',$1,$2)",
          [dao, randomUUID()],
        ),
      ).rejects.toThrow();
    } finally {
      await pool.query('DELETE FROM dao_merchants WHERE dao_key=$1', [key]);
    }
  });
});
