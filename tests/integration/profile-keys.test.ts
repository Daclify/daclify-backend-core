import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { vi } from 'vitest';
import { Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrivateKey } from '@wharfkit/antelope';
import { createChallenge, authenticate } from '../../services/api/src/auth.js';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import { ProfileKeys } from '../../services/api/src/profiles/keys.js';
import { FileProfileExclusions } from '../../services/api/src/profiles/exclusions.js';
import { processProfileJob } from '../../services/api/src/profiles/jobs.js';
import { authChain } from '../helpers/auth-chain.js';
import { controlledInject } from '../helpers/account-control.js';
import { UserMembershipSchema, type Account } from '../../protocol/api.js';
import { AccountControlChallengeSchema } from '../../protocol/sign-in.js';
import { type EncryptedProfile, type ProfileContext } from '../../protocol/profiles.js';
import { createRecoveryRecipient } from '../../sdk/recovery.js';
import {
  encryptProfile,
  decryptProfile,
  sealProfileKey,
  openProfileKey,
  profileCiphertextCommitment,
} from '../../sdk/profiles.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Owned local profile test database required');
const database = 'daclify_profiles_' + randomBytes(6).toString('hex') + '_test';
const target = new URL(url);
target.pathname = '/' + database;
const ownerPool = new Pool({ connectionString: url });
const pool = new Pool({ connectionString: target.toString() });
const origin = 'http://localhost:5173';
const signing = [PrivateKey.generate('K1'), PrivateKey.generate('K1'), PrivateKey.generate('K1')];
let recipients: Awaited<ReturnType<typeof createRecoveryRecipient>>[];
let accounts: Account[];
let logins: { token: string; csrfToken: string }[];
let current: EncryptedProfile | null = null;
let keyChanged = false;
let directory: string;
let service: ProfileKeys;
let exclusions: FileProfileExclusions;
let app: Awaited<ReturnType<typeof createServer>>;
const context = (): ProfileContext => ({
  version: 2,
  chainId: 'ab'.repeat(32),
  runtime: 'daclifycore',
  daoId: '1',
  memberId: '1',
  profileRevision: randomUUID(),
});
const account = (index: number) => {
  const value = accounts[index];
  if (!value) throw new Error('FIXTURE_ACCOUNT');
  return value;
};
const recipient = (index: number) => {
  const value = recipients[index];
  if (!value) throw new Error('FIXTURE_RECIPIENT');
  return value;
};
const headers = (index = 0) => {
  const login = logins[index];
  if (!login) throw new Error('FIXTURE_SESSION');
  return { origin, cookie: 'daclify_session=' + login.token, 'x-csrf-token': login.csrfToken };
};
const chain = {
  ...authChain,
  network: async () => ({
    ...(await authChain.network()),
    capabilities: ['encrypted-profiles-v2'],
  }),
  memberships: async (actor: Account) => [
    UserMembershipSchema.parse({
      dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
      memberId: actor.id === account(0).id ? '1' : '2',
      active: true,
      admin: false,
      reviewer: false,
      nonce: '0',
      credits: '0',
      stake: '0',
      claim: '0',
      nativeAccount: '',
      custody: 'user-controlled',
    }),
  ],
  memberProfile: async () => ({
    accountName: current ? 'alice' : null,
    profile: current ? JSON.stringify(current) : null,
  }),
  profileKeyMember: async (_daoId: string, memberId: string) => ({
    memberId,
    active: true,
    encryptionKey: recipient(memberId === '1' && !keyChanged ? 0 : 1).publicKey,
  }),
  profileKeyRecipients: async () => ({
    recipients: [
      { memberId: '1', encryptionKey: recipient(keyChanged ? 1 : 0).publicKey },
      { memberId: '2', encryptionKey: recipient(1).publicKey },
    ],
    next: null,
  }),
};
beforeAll(async () => {
  await ownerPool.query(`CREATE DATABASE ${database}`);
  await migrate(pool);
  directory = await mkdtemp(join(tmpdir(), 'daclify-profile-exclusions-'));
  exclusions = new FileProfileExclusions(directory);
  recipients = await Promise.all(Array.from({ length: 3 }, () => createRecoveryRecipient()));
  accounts = [];
  logins = [];
  for (let index = 0; index < 3; index++) {
    const root = signing[index];
    if (!root) throw new Error('FIXTURE_ROOT');
    const key = recipient(index).publicKey;
    const challenge = await createChallenge(
      pool,
      { signingKey: root.toPublic().toString(), encryptionKey: key },
      origin,
    );
    const login = await authenticate(
      pool,
      challenge.id,
      root.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      key,
      { origin, audience: origin },
    );
    accounts.push(login.account);
    logins.push(login);
  }
  const configuration = { backupRetentionSeconds: 86400, exclusions };
  service = new ProfileKeys(pool, chain, configuration);
  app = await createServer(pool, chain, origin, { profileKeys: configuration });
});
beforeEach(async () => {
  current = null;
  keyChanged = false;
  await pool.query('DELETE FROM profile_key_revisions');
  await pool.query("DELETE FROM jobs WHERE module_id='core-profiles'");
});
afterAll(async () => {
  await exclusions?.close();
  await app?.close();
  await pool.end();
  await ownerPool.query(`DROP DATABASE ${database} WITH (FORCE)`);
  await ownerPool.end();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function prepare(includeRecipient = true) {
  const ctx = context(),
    key = Uint8Array.from(randomBytes(32));
  const cipher = await encryptProfile(
    new TextEncoder().encode('synthetic sensitive profile'),
    key,
    ctx,
  );
  const commitment = await profileCiphertextCommitment(cipher);
  const grants = await Promise.all(
    (includeRecipient ? [0, 1] : [0]).map((index) =>
      sealProfileKey(key, recipient(index).publicKey, ctx, commitment),
    ),
  );
  return { context: ctx, key, cipher, commitment, grants };
}
it('requires fresh body-bound account control and rejects another member as owner', async () => {
  const prepared = await prepare();
  const body = { context: prepared.context, grants: prepared.grants };
  const unsigned = await app.inject({
    method: 'POST',
    url: '/v1/profiles/keys/share',
    headers: headers(),
    payload: body,
  });
  expect(unsigned.statusCode).toBe(403);
  expect(unsigned.json().code).toBe('ACCOUNT_CONTROL_REQUIRED');
  const root = signing[1];
  if (!root) throw new Error('FIXTURE_ROOT');
  const foreign = await controlledInject(app, root, {
    method: 'POST',
    url: '/v1/profiles/keys/share',
    headers: headers(1),
    payload: body,
  });
  expect(foreign.statusCode).toBe(403);
  expect(foreign.json().code).toBe('PROFILE_OWNER');
  expect(
    (await pool.query<{ count: string }>('SELECT count(*) FROM profile_key_revisions')).rows[0]
      ?.count,
  ).toBe('0');
});
it('refuses body substitution and once-consumed signed consent replay', async () => {
  const prepared = await prepare();
  const payload = JSON.stringify({ context: prepared.context, grants: prepared.grants });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/account/control',
    headers: headers(),
    payload: {
      path: '/v1/profiles/keys/share',
      bodyHash: createHash('sha256').update(payload).digest('hex'),
    },
  });
  const challenge = AccountControlChallengeSchema.parse(response.json());
  const root = signing[0];
  if (!root) throw new Error('FIXTURE_ROOT');
  const signed = {
    ...headers(),
    'content-type': 'application/json',
    'x-account-intent-id': challenge.id,
    'x-account-signature': root.signMessage(new TextEncoder().encode(challenge.message)).toString(),
  };
  const wrong = await app.inject({
    method: 'POST',
    url: '/v1/profiles/keys/share',
    headers: signed,
    payload: payload.replace(prepared.context.profileRevision, randomUUID()),
  });
  expect(wrong.statusCode).toBe(403);
  const accepted = await app.inject({
    method: 'POST',
    url: '/v1/profiles/keys/share',
    headers: signed,
    payload,
  });
  expect(accepted.statusCode, accepted.body).toBe(200);
  const replay = await app.inject({
    method: 'POST',
    url: '/v1/profiles/keys/share',
    headers: signed,
    payload,
  });
  expect(replay.statusCode).toBe(403);
  expect(
    (await pool.query<{ count: string }>('SELECT count(*) FROM profile_key_revisions')).rows[0]
      ?.count,
  ).toBe('1');
});
it('stages before publication and activates only the exact native commitment for explicit recipients', async () => {
  const prepared = await prepare();
  await service.put(account(0).id, prepared.grants);
  await expect(service.get(account(0).id, prepared.context)).rejects.toMatchObject({
    code: 'PROFILE_KEY_UNAVAILABLE',
  });
  current = { ...prepared.cipher, context: { ...prepared.context, profileRevision: randomUUID() } };
  await service.reconcile(prepared.context);
  expect(
    (await pool.query<{ state: string }>('SELECT state FROM profile_key_revisions')).rows[0]?.state,
  ).toBe('staged');
  current = prepared.cipher;
  const grant = await service.get(account(1).id, prepared.context);
  expect(
    await openProfileKey(grant, recipient(1).privateKey, prepared.context, prepared.commitment),
  ).toEqual(prepared.key);
  await expect(service.get(account(2).id, prepared.context)).rejects.toMatchObject({
    code: 'PROFILE_AUDIENCE',
  });
  expect(
    (await pool.query<{ state: string }>('SELECT state FROM profile_key_revisions')).rows[0]?.state,
  ).toBe('active');
});
it('rejects unregistered recipients, a missing owner envelope and a changed native owner key', async () => {
  const prepared = await prepare();
  const unknown = await sealProfileKey(
    prepared.key,
    recipient(2).publicKey,
    prepared.context,
    prepared.commitment,
  );
  await expect(service.put(account(0).id, [...prepared.grants, unknown])).rejects.toMatchObject({
    code: 'PROFILE_AUDIENCE',
  });
  const second = prepared.grants[1];
  if (!second) throw new Error('FIXTURE_GRANT');
  await expect(service.put(account(0).id, [second])).rejects.toMatchObject({
    code: 'PROFILE_OWNER_ENVELOPE',
  });
  keyChanged = true;
  await expect(service.put(account(0).id, prepared.grants)).rejects.toMatchObject({
    code: 'PROFILE_KEY_CHANGED',
  });
});
it('does not suppress a native owner-key refusal through staged recovery', async () => {
  const prepared = await prepare();
  await service.put(account(0).id, prepared.grants);
  current = prepared.cipher;
  keyChanged = true;
  await expect(service.get(account(1).id, prepared.context)).rejects.toMatchObject({
    code: 'PROFILE_KEY_CHANGED',
  });
});
it('preserves the previous readable version through orphaned publication and rotates future access', async () => {
  const old = await prepare();
  await service.put(account(0).id, old.grants);
  current = old.cipher;
  await service.reconcile(old.context);
  const next = await prepare(false);
  await service.put(account(0).id, next.grants);
  expect(await service.get(account(1).id, old.context)).toEqual(old.grants[1]);
  await pool.query(
    "UPDATE profile_key_revisions SET expires_at=now()-interval '1 second' WHERE profile_revision=$1",
    [next.context.profileRevision],
  );
  await service.reconcile(next.context);
  expect(await service.get(account(1).id, old.context)).toEqual(old.grants[1]);
  const final = await prepare(false);
  await service.put(account(0).id, final.grants);
  current = final.cipher;
  await service.reconcile(final.context);
  await expect(service.get(account(1).id, final.context)).rejects.toMatchObject({
    code: 'PROFILE_AUDIENCE',
  });
  await expect(service.get(account(0).id, old.context)).rejects.toMatchObject({
    code: 'PROFILE_KEY_UNAVAILABLE',
  });
  await expect(decryptProfile(final.cipher, old.key, final.context)).rejects.toThrow(
    'PROFILE_DECRYPTION',
  );
});
it('excludes deleted grants after restoring old SQL rows while honestly reporting backup expiry', async () => {
  const prepared = await prepare();
  await service.put(account(0).id, prepared.grants);
  current = prepared.cipher;
  await service.reconcile(prepared.context);
  const backup = (await pool.query<Record<string, unknown>>('SELECT * FROM profile_key_revisions'))
    .rows[0];
  const status = await service.remove(account(0).id, prepared.context);
  expect(status.state).toBe('backup-expiry-pending');
  expect(status.backupExpiresAt).toBeTruthy();
  expect(
    (await pool.query<{ count: string }>('SELECT count(*) FROM profile_key_revisions')).rows[0]
      ?.count,
  ).toBe('0');
  if (!backup) throw new Error('FIXTURE_BACKUP');
  await pool.query(
    'INSERT INTO profile_key_revisions SELECT * FROM jsonb_populate_record(NULL::profile_key_revisions,$1::jsonb)',
    [JSON.stringify(backup)],
  );
  const restored = new ProfileKeys(pool, chain, {
    backupRetentionSeconds: 86400,
    exclusions: new FileProfileExclusions(directory),
  });
  await expect(restored.get(account(0).id, prepared.context)).rejects.toMatchObject({
    code: 'PROFILE_KEY_UNAVAILABLE',
  });
  await expect(restored.put(account(0).id, prepared.grants)).rejects.toMatchObject({
    code: 'PROFILE_KEY_REMOVED',
  });
  expect((await service.remove(account(0).id, prepared.context)).state).toBe(
    'backup-expiry-pending',
  );
});
it('applies exclusions before serving an actual PostgreSQL snapshot restore', async () => {
  const pgDump = process.env.MINI_APP_PG_DUMP;
  if (!pgDump) throw new Error('Owned PostgreSQL dump tool required');
  const snapshot = await mkdtemp(join(tmpdir(), 'daclify-profile-snapshot-'));
  try {
    const prepared = await prepare();
    await service.put(account(0).id, prepared.grants);
    current = prepared.cipher;
    await service.reconcile(prepared.context);
    const file = join(snapshot, 'before-deletion.dump');
    execFileSync(
      pgDump,
      [
        '--dbname',
        target.toString(),
        '--format=custom',
        '--data-only',
        '--table=public.profile_key_revisions',
        '--file',
        file,
      ],
      { stdio: 'pipe' },
    );
    await service.remove(account(0).id, prepared.context);
    execFileSync(
      join(dirname(pgDump), 'pg_restore'),
      ['--dbname', target.toString(), '--data-only', '--no-owner', '--exit-on-error', file],
      { stdio: 'pipe' },
    );
    expect(
      (await pool.query<{ count: string }>('SELECT count(*) FROM profile_key_revisions')).rows[0]
        ?.count,
    ).toBe('1');
    await expect(service.get(account(0).id, prepared.context)).rejects.toMatchObject({
      code: 'PROFILE_KEY_UNAVAILABLE',
    });
    const applied = execFileSync(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'tools/content/profile-keys-restore.ts'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_URL: target.toString(),
          PROFILE_KEYS_ENABLED: '1',
          PROFILE_KEYS_MAX_BACKUP_AGE_SECONDS: '86400',
          PROFILE_KEYS_EXCLUSIONS_DIRECTORY: directory,
        },
      },
    );
    const report: unknown = JSON.parse(applied);
    expect(report).toEqual({ excludedRowsRemoved: 1, journalPreserved: true });
    expect(
      (await pool.query<{ count: string }>('SELECT count(*) FROM profile_key_revisions')).rows[0]
        ?.count,
    ).toBe('0');
  } finally {
    await rm(snapshot, { recursive: true, force: true });
  }
});
it('keeps the previous envelopes through SQL-write and native-confirmation faults', async () => {
  const old = await prepare();
  await service.put(account(0).id, old.grants);
  current = old.cipher;
  await service.reconcile(old.context);
  await pool.query(
    "CREATE FUNCTION reject_profile_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned profile write fault'; END $$",
  );
  await pool.query(
    'CREATE TRIGGER profile_fixture_write BEFORE INSERT ON profile_key_revisions FOR EACH ROW EXECUTE FUNCTION reject_profile_fixture()',
  );
  const next = await prepare(false);
  try {
    await expect(service.put(account(0).id, next.grants)).rejects.toThrow(
      'owned profile write fault',
    );
  } finally {
    await pool.query('DROP TRIGGER profile_fixture_write ON profile_key_revisions');
    await pool.query('DROP FUNCTION reject_profile_fixture()');
  }
  expect(await service.get(account(1).id, old.context)).toEqual(old.grants[1]);
  await service.put(account(0).id, next.grants);
  const unavailable = new ProfileKeys(
    pool,
    {
      ...chain,
      memberProfile: async () => {
        throw new Error('owned native confirmation fault');
      },
    },
    { backupRetentionSeconds: 86400, exclusions },
  );
  await expect(unavailable.reconcile(next.context)).rejects.toThrow(
    'owned native confirmation fault',
  );
  expect(await unavailable.get(account(1).id, old.context)).toEqual(old.grants[1]);
  expect(
    (
      await pool.query<{ state: string }>(
        'SELECT state FROM profile_key_revisions WHERE profile_revision=$1',
        [next.context.profileRevision],
      )
    ).rows[0]?.state,
  ).toBe('staged');
});
it('reads the exact published staged cipher while SQL activation retries without granting the old audience', async () => {
  const old = await prepare();
  await service.put(account(0).id, old.grants);
  current = old.cipher;
  await service.reconcile(old.context);
  const next = await prepare(false);
  await service.put(account(0).id, next.grants);
  current = next.cipher;
  await pool.query(
    "CREATE FUNCTION reject_activation_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='active' THEN RAISE EXCEPTION 'owned activation fault'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    'CREATE TRIGGER profile_activation_fixture BEFORE UPDATE ON profile_key_revisions FOR EACH ROW EXECUTE FUNCTION reject_activation_fixture()',
  );
  try {
    const grant = await service.get(account(0).id, next.context);
    const key = await openProfileKey(grant, recipient(0).privateKey, next.context, next.commitment);
    expect(new TextDecoder().decode(await decryptProfile(next.cipher, key, next.context))).toBe(
      'synthetic sensitive profile',
    );
    await expect(service.get(account(1).id, next.context)).rejects.toMatchObject({
      code: 'PROFILE_AUDIENCE',
    });
    expect(
      (
        await pool.query<{ state: string }>(
          'SELECT state FROM profile_key_revisions WHERE profile_revision=$1',
          [next.context.profileRevision],
        )
      ).rows[0]?.state,
    ).toBe('staged');
  } finally {
    await pool.query('DROP TRIGGER profile_activation_fixture ON profile_key_revisions');
    await pool.query('DROP FUNCTION reject_activation_fixture()');
  }
  await service.reconcile(next.context);
  expect(
    (
      await pool.query<{ state: string }>(
        'SELECT state FROM profile_key_revisions WHERE profile_revision=$1',
        [next.context.profileRevision],
      )
    ).rows[0]?.state,
  ).toBe('active');
});
it('reports unavailable deletion when the independent exclusion store fails and preserves readable keys', async () => {
  const prepared = await prepare();
  await service.put(account(0).id, prepared.grants);
  current = prepared.cipher;
  await service.reconcile(prepared.context);
  const fault = vi
    .spyOn(exclusions, 'write')
    .mockRejectedValueOnce(new Error('owned exclusion write fault'));
  try {
    expect((await service.remove(account(0).id, prepared.context)).state).toBe('unavailable');
  } finally {
    fault.mockRestore();
  }
  expect(await service.get(account(1).id, prepared.context)).toEqual(prepared.grants[1]);
});
it('never widens a retired account alias into another recipient encryption key', async () => {
  const prepared = await prepare();
  await service.put(account(0).id, prepared.grants);
  current = prepared.cipher;
  await service.reconcile(prepared.context);
  await pool.query(
    'UPDATE accounts SET signing_key=NULL,encryption_key=NULL,merged_into=$1 WHERE id=$2',
    [account(2).id, account(1).id],
  );
  await expect(service.get(account(2).id, prepared.context)).rejects.toMatchObject({
    code: 'PROFILE_AUDIENCE',
  });
});
it('reports completed expiry and purges restored rows before removing expired exclusion metadata', async () => {
  const prepared = await prepare(false);
  await service.put(account(0).id, prepared.grants);
  current = prepared.cipher;
  await service.reconcile(prepared.context);
  const backup = (await pool.query<Record<string, unknown>>('SELECT * FROM profile_key_revisions'))
    .rows[0];
  await exclusions.write({
    version: 1,
    context: prepared.context,
    ownerAccountId: account(0).id,
    ciphertextCommitment: prepared.commitment,
    deletedAt: new Date(Date.now() - 172800000).toISOString(),
    backupExpiresAt: new Date(Date.now() - 86400000).toISOString(),
  });
  expect((await service.remove(account(0).id, prepared.context)).state).toBe('removed');
  if (!backup) throw new Error('FIXTURE_BACKUP');
  await pool.query(
    'INSERT INTO profile_key_revisions SELECT * FROM jsonb_populate_record(NULL::profile_key_revisions,$1::jsonb)',
    [JSON.stringify(backup)],
  );
  await service.cleanup();
  expect(
    (await pool.query<{ count: string }>('SELECT count(*) FROM profile_key_revisions')).rows[0]
      ?.count,
  ).toBe('0');
  expect(await exclusions.read(prepared.context)).toBeNull();
});
it('leases confirmation jobs once and activates without changing profile signing or DAO grants', async () => {
  const prepared = await prepare(false);
  await service.put(account(0).id, prepared.grants);
  current = prepared.cipher;
  const before = (
    await pool.query<{ signing_key: string; encryption_key: unknown }>(
      'SELECT signing_key,encryption_key FROM accounts WHERE id=$1',
      [account(0).id],
    )
  ).rows[0];
  expect(await processProfileJob(pool, service, randomUUID())).toBe('completed');
  expect(await processProfileJob(pool, service, randomUUID())).toBe('idle');
  expect((await service.status(prepared.context)).state).toBe('active');
  const after = (
    await pool.query<{ signing_key: string; encryption_key: unknown }>(
      'SELECT signing_key,encryption_key FROM accounts WHERE id=$1',
      [account(0).id],
    )
  ).rows[0];
  expect(after).toEqual(before);
});
it('refuses writes when finite retention and an independent restore exclusion store are absent', async () => {
  const prepared = await prepare();
  const disabled = new ProfileKeys(pool, chain);
  await expect(disabled.put(account(0).id, prepared.grants)).rejects.toMatchObject({
    code: 'PROFILE_KEYS_UNAVAILABLE',
  });
  expect((await disabled.remove(account(0).id, prepared.context)).state).toBe('unavailable');
});
