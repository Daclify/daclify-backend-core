import type { Pool } from 'pg';
import { z } from 'zod';
import {
  GatewayFundingSchema,
  GatewayOriginSchema,
  GatewayAllowanceStatusSchema,
  MAX_HOSTED_CONTENT_BYTES,
} from '../../../../protocol/storage.js';
import { Uint64Schema } from '../../../../protocol/base.js';
import { ProviderScopeSchema } from './ledger.js';
import { ApiError } from '../errors.js';
const RowSchema = z.object({
  id: z.uuid(),
  provider_scope: ProviderScopeSchema,
  gateway: GatewayOriginSchema,
  starts_at: z.date(),
  ends_at: z.date(),
  byte_limit: Uint64Schema,
  request_limit: Uint64Schema,
  reserved_bytes: Uint64Schema,
  requests: Uint64Schema,
  funding_reference: z.string(),
  current_time: z.date(),
});
type Row = z.infer<typeof RowSchema>;
function funding(row: Row) {
  return GatewayFundingSchema.parse({
    id: row.id,
    providerScope: row.provider_scope,
    gateway: row.gateway,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    byteLimit: row.byte_limit,
    requestLimit: row.request_limit,
    fundingReference: row.funding_reference,
  });
}
export async function registerGatewayAllowance(
  pool: Pool,
  input: z.input<typeof GatewayFundingSchema>,
): Promise<void> {
  const value = GatewayFundingSchema.parse(input),
    client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      JSON.stringify([value.providerScope, value.gateway]),
    ]);
    const saved = await client.query(
      'SELECT *,clock_timestamp() AS current_time FROM gateway_allowances WHERE id=$1',
      [value.id],
    );
    if (saved.rows[0]) {
      if (JSON.stringify(funding(RowSchema.parse(saved.rows[0]))) !== JSON.stringify(value))
        throw new ApiError('CONTENT_GATEWAY_ALLOWANCE_CHANGED', 409);
    } else {
      const overlap = await client.query(
        'SELECT id FROM gateway_allowances WHERE provider_scope=$1 AND gateway=$2 AND starts_at < $4 AND ends_at > $3 LIMIT 1',
        [value.providerScope, value.gateway, value.startsAt, value.endsAt],
      );
      if (overlap.rows.length) throw new ApiError('CONTENT_GATEWAY_ALLOWANCE_OVERLAP', 409);
      await client.query(
        'INSERT INTO gateway_allowances(id,provider_scope,gateway,starts_at,ends_at,byte_limit,request_limit,funding_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          value.id,
          value.providerScope,
          value.gateway,
          value.startsAt,
          value.endsAt,
          value.byteLimit,
          value.requestLimit,
          value.fundingReference,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (cause) {
    await client.query('ROLLBACK');
    throw cause;
  } finally {
    client.release();
  }
}
export class GatewayAllowance {
  constructor(
    private readonly pool: Pool,
    private readonly providerScope: string,
    private readonly gateway: string,
    private readonly id: string | null,
  ) {
    ProviderScopeSchema.parse(providerScope);
    GatewayOriginSchema.parse(gateway);
    if (id !== null) z.uuid().parse(id);
  }
  async #row(): Promise<Row | null> {
    if (!this.id) return null;
    const result = await this.pool.query(
      'SELECT *,clock_timestamp() AS current_time FROM gateway_allowances WHERE id=$1 AND provider_scope=$2 AND gateway=$3',
      [this.id, this.providerScope, this.gateway],
    );
    return result.rows[0] ? RowSchema.parse(result.rows[0]) : null;
  }
  async reserve(expectedBytes: number): Promise<void> {
    if (
      !Number.isSafeInteger(expectedBytes) ||
      expectedBytes < 1 ||
      expectedBytes > MAX_HOSTED_CONTENT_BYTES
    )
      throw new ApiError('CONTENT_SIZE');
    if (!this.id) throw new ApiError('CONTENT_GATEWAY_ALLOWANCE_REQUIRED', 503);
    const result = await this.pool.query(
      `UPDATE gateway_allowances SET reserved_bytes=reserved_bytes+$4,requests=requests+1
      WHERE id=$1 AND provider_scope=$2 AND gateway=$3 AND starts_at<=clock_timestamp() AND ends_at>clock_timestamp()
      AND reserved_bytes<=byte_limit-$4 AND requests<request_limit RETURNING id`,
      [this.id, this.providerScope, this.gateway, expectedBytes],
    );
    if (result.rows.length) return;
    const row = await this.#row();
    if (!row) throw new ApiError('CONTENT_GATEWAY_ALLOWANCE_REQUIRED', 503);
    if (row.current_time < row.starts_at || row.current_time >= row.ends_at)
      throw new ApiError('CONTENT_GATEWAY_ALLOWANCE_EXPIRED', 503);
    throw new ApiError('CONTENT_GATEWAY_ALLOWANCE_EXHAUSTED', 503);
  }
  async status(): Promise<z.infer<typeof GatewayAllowanceStatusSchema>> {
    const row = await this.#row();
    return GatewayAllowanceStatusSchema.parse(
      row
        ? {
            state:
              row.current_time < row.starts_at
                ? 'scheduled'
                : row.current_time >= row.ends_at
                  ? 'expired'
                  : BigInt(row.reserved_bytes) >= BigInt(row.byte_limit) ||
                      BigInt(row.requests) >= BigInt(row.request_limit)
                    ? 'exhausted'
                    : 'available',
            startsAt: row.starts_at.toISOString(),
            endsAt: row.ends_at.toISOString(),
            byteLimit: row.byte_limit,
            reservedBytes: row.reserved_bytes,
            requestLimit: row.request_limit,
            requests: row.requests,
            fundingQualification: 'operator-attested',
          }
        : {
            state: 'unconfigured',
            startsAt: null,
            endsAt: null,
            byteLimit: '0',
            reservedBytes: '0',
            requestLimit: '0',
            requests: '0',
            fundingQualification: 'unconfigured',
          },
    );
  }
}
