import { APIClient, Checksum256, PublicKey, Serializer, UInt64 } from '@wharfkit/antelope';
import { z } from 'zod';
import { RuntimeTableSchemas } from '../../../sdk/index.js';
import { ApiError } from './errors.js';

// Native retired-key evidence survives service database loss and points straight to the latest root.
export async function readContactIdentity(api: APIClient, runtime: string, signingKey: string) {
  const hash = Checksum256.hash(
    Serializer.encode({ type: 'public_key', object: PublicKey.from(signingKey) }).array,
  );
  async function read<T>(table: string, schema: z.ZodType<T>, bound: Checksum256 | UInt64) {
    const page = z.object({ rows: z.array(schema).max(1), more: z.boolean() }).safeParse(
      await api.v1.chain.get_table_rows({
        code: runtime,
        scope: runtime,
        table,
        json: true,
        limit: 1,
        index_position: bound instanceof Checksum256 ? 'secondary' : 'primary',
        key_type: bound instanceof Checksum256 ? 'sha256' : 'i64',
        lower_bound: bound,
        upper_bound: bound,
      }),
    );
    if (!page.success || page.data.more) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return page.data.rows[0] ?? null;
  }
  const retired = await read('recretired', RuntimeTableSchemas.recretired, hash);
  if (retired && retired.signing_key !== signingKey)
    throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  const root = await read(
    'recroots',
    RuntimeTableSchemas.recroots,
    retired ? UInt64.from(retired.identity_id) : hash,
  );
  if (retired ? !root || root.id !== retired.identity_id : root && root.signing_key !== signingKey)
    throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  return root;
}
