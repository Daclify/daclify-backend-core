import type { Pool, PoolClient } from 'pg';

export async function ownsAccount(
  db: Pool | PoolClient,
  actor: string,
  historicalOwner: string | null,
): Promise<boolean> {
  if (historicalOwner === null) return false;
  return (
    (
      await db.query<{ owned: boolean }>('SELECT account_owns($1,$2) AS owned', [
        actor,
        historicalOwner,
      ])
    ).rows[0]?.owned === true
  );
}
