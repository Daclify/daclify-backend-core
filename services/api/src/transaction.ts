import type { PoolClient } from 'pg';

// Return whether failed cleanup requires discarding the connection.
export async function rollbackTransaction(client: PoolClient): Promise<boolean> {
  try {
    await client.query('ROLLBACK');
    return false;
  } catch {
    return true;
  }
}
