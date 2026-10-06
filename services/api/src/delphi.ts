import { z } from 'zod';
import { DelphiDatapointSchema, selectDelphiRate, type DelphiRate } from './service-price.js';

const RowsSchema = z.object({ rows: z.array(z.unknown()) });
const PairSchema = z.object({
  name: z.string(),
  active: z.union([z.literal(0), z.literal(1), z.boolean()]),
  quoted_precision: z.number().int().min(0).max(18),
});

export interface DelphiPair {
  name: string;
  quotedPrecision: number;
}

async function tableRows(
  rpcUrl: string,
  scope: string,
  table: string,
  fetchImpl: typeof fetch,
): Promise<unknown[]> {
  const response = await fetchImpl(`${rpcUrl}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: 'delphioracle',
      scope,
      table,
      json: true,
      limit: 50,
    }),
  });
  if (!response.ok) throw new Error('ORACLE_UNAVAILABLE');
  const parsed = RowsSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('ORACLE_RESPONSE');
  return parsed.data.rows;
}

export async function readDelphiPair(
  rpcUrl: string,
  pairName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DelphiPair> {
  const rows = z
    .array(PairSchema)
    .parse(await tableRows(rpcUrl, 'delphioracle', 'pairs', fetchImpl));
  const pair = rows.find((row) => row.name === pairName);
  if (!pair || pair.active === 0 || pair.active === false) throw new Error('ORACLE_PAIR');
  return { name: pair.name, quotedPrecision: pair.quoted_precision };
}

export async function readDelphiRate(
  rpcUrl: string,
  pairName: string,
  now: Date,
  maxAgeSeconds: number,
  fetchImpl: typeof fetch = fetch,
): Promise<DelphiRate> {
  const rows = z
    .array(DelphiDatapointSchema)
    .parse(await tableRows(rpcUrl, pairName, 'datapoints', fetchImpl));
  return selectDelphiRate(rows, now, maxAgeSeconds);
}
