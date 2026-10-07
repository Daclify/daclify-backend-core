import { createHash, randomUUID } from 'node:crypto';
import { APIClient, Signature, PublicKey } from '@wharfkit/antelope';
import type { Pool, PoolClient } from 'pg';
import {
  AccountControlMessageSchema,
  AccountControlRequestSchema,
  AccountControlChallengeSchema,
  AccountControlProofSchema,
} from '../../../../protocol/sign-in.js';
import type { Account, Network } from '../../../../protocol/api.js';
import { NativeIdentitySchema } from '../../../../protocol/native-wallet.js';
import { verifyNativeProof } from './native-proof.js';
import { recoverEvmAddress } from './evm-proof.js';
import { ApiError } from '../errors.js';

export async function beginAccountControl(
  pool: Pool,
  account: Account,
  token: string,
  origin: string,
  input: unknown,
  audience: string = origin,
): Promise<{ id: string; message: string; expires: string }> {
  const request = AccountControlRequestSchema.parse(input);
  const recent = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM account_control_intents WHERE account_id=$1 AND created_at>now()-interval '10 minutes'",
    [account.id],
  );
  if (Number(recent.rows[0]?.count ?? '0') >= 40) throw new ApiError('RATE_LIMIT', 429);
  const id = randomUUID();
  const expires = new Date(Date.now() + 300_000).toISOString();
  const message = JSON.stringify(
    AccountControlMessageSchema.parse({
      ...request,
      domain: 'daclify.account-control.v2',
      origin,
      audience,
      accountId: account.id,
      signingKey: account.signingKey,
      challengeId: id,
      expires,
    }),
  );
  await pool.query(
    'INSERT INTO account_control_intents(id,account_id,session_hash,path,body_hash,message,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      id,
      account.id,
      createHash('sha256').update(token).digest(),
      request.path,
      request.bodyHash,
      message,
      expires,
    ],
  );
  return { id, message, expires };
}

export async function consumeAccountControl(
  pool: Pool,
  account: Account,
  token: string,
  path: string,
  body: Uint8Array,
  id: string,
  input: unknown,
  network: () => Promise<Network>,
  origin: string,
  audience: string = origin,
): Promise<void> {
  const checked = AccountControlProofSchema.safeParse(input);
  if (!AccountControlChallengeSchema.shape.id.safeParse(id).success || !checked.success)
    throw new ApiError('ACCOUNT_CONTROL_REQUIRED', 403);
  const result = await pool.query<{ message: string; expires_at: Date }>(
    `UPDATE account_control_intents SET consumed_at=now()
     WHERE id=$1 AND account_id=$2 AND session_hash=$3 AND path=$4 AND body_hash=$5
       AND consumed_at IS NULL AND expires_at>now() RETURNING message,expires_at`,
    [
      id,
      account.id,
      createHash('sha256').update(token).digest(),
      path,
      createHash('sha256').update(body).digest('hex'),
    ],
  );
  const row = result.rows[0];
  let valid = false;
  if (row) {
    try {
      const context = AccountControlMessageSchema.parse(JSON.parse(row.message));
      if (
        context.origin !== origin ||
        context.audience !== audience ||
        context.signingKey !== account.signingKey
      )
        throw new Error('Changed proof context');
      const proof = checked.data;
      if (proof.kind === 'root')
        valid =
          account.signingKey !== null &&
          Signature.from(proof.signature).verifyMessage(
            new TextEncoder().encode(row.message),
            PublicKey.from(account.signingKey),
          );
      else if (proof.kind === 'native') {
        const linked = (
          await pool.query<{ permission: string }>(
            'SELECT permission FROM native_links WHERE account_id=$1 AND chain_id=$2 AND native_account=$3',
            [account.id, proof.chainId, proof.account],
          )
        ).rows[0];
        const info = await network();
        if (!linked || info.chainId !== proof.chainId) throw new Error('Unpaired authority');
        const identity = NativeIdentitySchema.parse({
          chainId: proof.chainId,
          account: proof.account,
          permission: linked.permission,
        });
        await verifyNativeProof(
          proof.proof,
          identity,
          info.runtime,
          row.message,
          row.expires_at,
          new APIClient({ url: info.rpcUrl }),
        );
        valid = true;
      } else {
        const linked = await pool.query(
          'SELECT 1 FROM evm_links WHERE account_id=$1 AND chain_id=$2 AND address=$3 AND control_verified_at IS NOT NULL',
          [account.id, proof.chainId, proof.address.toLowerCase()],
        );
        valid =
          linked.rowCount === 1 &&
          recoverEvmAddress(row.message, proof.signature) === proof.address.toLowerCase();
      }
    } catch {
      /* Invalid proof remains consumed; do not expose cryptographic internals. */
    }
  }
  if (!valid) throw new ApiError('ACCOUNT_CONTROL_REQUIRED', 403);
}

export async function revokeCredentialSessions(
  pool: Pool | PoolClient,
  accountId: string,
  credential: string,
): Promise<void> {
  await pool.query(
    'UPDATE sessions SET revoked_at=now() WHERE account_id=$1 AND credential_key=$2 AND revoked_at IS NULL',
    [accountId, credential],
  );
}
