import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { generateKeyPair, SignJWT } from 'jose';
import { SignupService } from '../../services/api/src/auth/signup.js';
import { migrate } from '../../services/api/src/store.js';
import {
  createChallenge,
  authenticate,
  cleanupSignupAttempts,
} from '../../services/api/src/auth.js';
import { RecoveryBackupSchema } from '../../protocol/recovery.js';
import { SignupRoutes, signupDeliveryDomain } from '../../protocol/signup.js';
import {
  createRecoveryRecipient,
  createRecoveryPayload,
  sealRecoveryDelivery,
  openRecoveryPayload,
} from '../../sdk/recovery.js';
import { unwrapRecoveryKey } from '../../services/api/src/auth/recovery-storage.js';
import { createServer } from '../../services/api/src/server.js';
import { authChain } from '../helpers/auth-chain.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error('Owned loopback signup test database required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const master = randomBytes(32),
  copies = new Map<string, string>();
const keys = {
  async wrap(_name: string, value: Uint8Array) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', master, iv);
    return (
      'vault:v1:' +
      Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]).toString(
        'base64',
      )
    );
  },
  async unwrap(_name: string, value: string) {
    const bytes = Buffer.from(value.slice(9), 'base64'),
      cipher = createDecipheriv('aes-256-gcm', master, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(-16));
    return Uint8Array.from(Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]));
  },
};
let failStorage = false;
const config = {
  assistedQualified: true,
  qualifiedWallets: [],
  passkeysQualified: false,
  keys,
  store: {
    async write(record: ReturnType<typeof RecoveryBackupSchema.parse>) {
      if (failStorage) throw new Error('fixture outage');
      const bytes = JSON.stringify(record);
      copies.set(record.context.id, bytes);
      return {
        storeId: 'isolated-fixture',
        reference: record.context.id,
        commitment: createHash('sha256').update(bytes).digest('hex'),
        verifiedAt: new Date().toISOString(),
      };
    },
    async read(receipt: { reference: string }) {
      const bytes = copies.get(receipt.reference);
      if (!bytes) throw new Error('missing copy');
      return RecoveryBackupSchema.parse(JSON.parse(bytes));
    },
  },
};
const service = new SignupService(pool, origin, origin, config);
const delivered = new Map<string, string>();
let app: Awaited<ReturnType<typeof createServer>>;
beforeAll(async () => {
  await migrate(pool);
  app = await createServer(pool, authChain, origin, {
    recovery: config,
    signIn: {
      environment: 'local',
      deliverEmail: async (to, code) => {
        delivered.set(to, code);
      },
    },
    providers: {
      telegram: { botToken: '12345:owned-test-fixture', botUsername: 'owned_test_bot' },
    },
  });
});
afterAll(async () => {
  await app?.close();
  await pool.end();
});
async function pending(credential = `email:${crypto.randomUUID()}@example.test`) {
  const browser = randomBytes(32);
  const verified = await service.verify(credential, browser, origin);
  if (verified.status !== 'pending') throw new Error('Expected unpaired credential');
  const signing = PrivateKey.generate('K1'),
    encryption = await createRecoveryRecipient();
  const prepared = await service.prepare(
    {
      id: verified.id,
      signingKey: signing.toPublic().toString(),
      encryptionKey: encryption.publicKey,
      assistedConsent: true,
    },
    browser,
    origin,
  );
  const signature = signing.signMessage(new TextEncoder().encode(prepared.message)).toString();
  const secrets = { signingKey: signing.toString(), encryptionPrivateKey: encryption.privateKey };
  return { credential, browser, verified, signing, encryption, prepared, signature, secrets };
}
async function finishInput(user: Awaited<ReturnType<typeof pending>>) {
  const authorized = await service.authorize(
    { id: user.verified.id, signature: user.signature },
    user.browser,
    origin,
  );
  const payload = await createRecoveryPayload(user.secrets, user.prepared.context);
  try {
    const keyGrant = await sealRecoveryDelivery(
      payload.key,
      authorized.recipient,
      signupDeliveryDomain(user.verified.id, user.prepared.context),
    );
    return { id: user.verified.id, envelope: payload.envelope, keyGrant };
  } finally {
    payload.key.fill(0);
  }
}
async function finish(user: Awaited<ReturnType<typeof pending>>) {
  return service.finish(await finishInput(user), user.browser, origin);
}
describe('verified quick signup', () => {
  it('opens a previously paired independent account without enrolling assisted recovery', async () => {
    const email = `${crypto.randomUUID()}@example.test`,
      signing = PrivateKey.generate('K1'),
      encryption = await createRecoveryRecipient();
    const challenge = await createChallenge(
      pool,
      { signingKey: signing.toPublic().toString(), encryptionKey: encryption.publicKey },
      origin,
    );
    const original = await authenticate(
      pool,
      challenge.id,
      signing.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryption.publicKey,
      { origin, audience: origin },
    );
    await pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)', [
      'email:' + email,
      original.account.id,
    ]);
    const start = await app.inject({
      method: 'POST',
      url: SignupRoutes.signupEmailStart.path,
      headers: { origin },
      payload: { email },
    });
    expect(start.statusCode).toBe(200);
    const cookie = start.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const login = await app.inject({
      method: 'POST',
      url: SignupRoutes.signupEmailVerify.path,
      headers: { origin, cookie },
      payload: { email, code: delivered.get(email) },
    });
    expect(login.statusCode).toBe(200);
    const response = SignupRoutes.signupEmailVerify.response.parse(login.json());
    expect(response.status).toBe('existing');
    if (response.status !== 'existing') throw new Error('Expected paired identity');
    expect(response.account).toEqual(original.account);
    expect(
      (
        await pool.query('SELECT 1 FROM vault_recovery_methods WHERE account_id=$1', [
          original.account.id,
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await pool.query(
          'SELECT 1 FROM vault_recovery_state WHERE account_id=$1 AND assisted_ever',
          [original.account.id],
        )
      ).rowCount,
    ).toBe(0);
  });
  it('verifies an email signup code once and binds the pending ticket to its browser', async () => {
    const email = `${crypto.randomUUID()}@example.test`;
    const start = await app.inject({
      method: 'POST',
      url: SignupRoutes.signupEmailStart.path,
      headers: { origin },
      payload: { email },
    });
    expect(start.statusCode).toBe(200);
    const cookie = start.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
      code = delivered.get(email);
    const wrongPurpose = await app.inject({
      method: 'POST',
      url: '/v1/sign-in/email/login',
      headers: { origin, cookie },
      payload: { email, code },
    });
    expect(wrongPurpose.statusCode).toBe(401);
    const verified = await app.inject({
      method: 'POST',
      url: SignupRoutes.signupEmailVerify.path,
      headers: { origin, cookie },
      payload: { email, code },
    });
    expect(verified.statusCode).toBe(200);
    const ticket = SignupRoutes.signupEmailVerify.response.parse(verified.json());
    expect(ticket.status).toBe('pending');
    const replay = await app.inject({
      method: 'POST',
      url: SignupRoutes.signupEmailVerify.path,
      headers: { origin, cookie },
      payload: { email, code },
    });
    expect(replay.statusCode).toBe(401);
    if (ticket.status === 'pending') {
      const missingBrowser = await app.inject({
        method: 'GET',
        url: `/v1/sign-up/pending/${ticket.id}`,
        headers: { origin },
      });
      expect(missingBrowser.statusCode).toBe(401);
    }
  });
  it('verifies signed Telegram data and refuses forgery and replay', async () => {
    const fields = new URLSearchParams({
      id: String(100000 + Math.floor(Math.random() * 1000000)),
      auth_date: String(Math.floor(Date.now() / 1000)),
    });
    const check = Array.from(fields.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    fields.set(
      'hash',
      createHmac('sha256', createHash('sha256').update('12345:owned-test-fixture').digest())
        .update(check)
        .digest('hex'),
    );
    const forged = new URLSearchParams(fields);
    forged.set('id', '1');
    const bad = await app.inject({
      method: 'POST',
      url: SignupRoutes.signupTelegramVerify.path,
      headers: { origin },
      payload: { proof: forged.toString() },
    });
    expect(bad.statusCode).toBe(401);
    const verified = await app.inject({
      method: 'POST',
      url: SignupRoutes.signupTelegramVerify.path,
      headers: { origin },
      payload: { proof: fields.toString() },
    });
    expect(verified.statusCode).toBe(200);
    expect(SignupRoutes.signupTelegramVerify.response.parse(verified.json()).status).toBe(
      'pending',
    );
    const replay = await app.inject({
      method: 'POST',
      url: SignupRoutes.signupTelegramVerify.path,
      headers: { origin },
      payload: { proof: fields.toString() },
    });
    expect(replay.statusCode).toBe(401);
  });
  it('resumes a lost completion response without creating a second identity', async () => {
    const user = await pending(),
      input = await finishInput(user);
    const first = await service.finish(input, user.browser, origin);
    const second = await service.finish(input, user.browser, origin);
    expect(second.account).toEqual(first.account);
    await pool.query('DELETE FROM credentials WHERE provider_key=$1', [user.credential]);
    await expect(service.finish(input, user.browser, origin)).rejects.toMatchObject({
      code: 'PROVIDER_UNKNOWN',
    });
  });
  it('activates one account and stores decryptable original signing and document keys', async () => {
    const user = await pending(),
      opened = await finish(user);
    expect(opened.account.id).toBe(user.prepared.context.accountId);
    expect(opened.account.signingKey).toBe(user.signing.toPublic().toString());
    const rows = await pool.query<{ record: unknown }>(
      'SELECT record FROM vault_recovery_methods WHERE account_id=$1',
      [opened.account.id],
    );
    const backup = RecoveryBackupSchema.parse(rows.rows[0]?.record);
    if (backup.keyWrap.kind !== 'service') throw new Error('Expected assisted wrap');
    const domain =
      'backup:' +
      createHash('sha256')
        .update('daclify.vault-recovery.v1:' + JSON.stringify(backup.context))
        .digest('hex');
    const key = await unwrapRecoveryKey(keys, backup.keyWrap.ciphertext, domain);
    try {
      expect(await openRecoveryPayload(backup, key)).toEqual(user.secrets);
    } finally {
      key.fill(0);
    }
    expect(
      (
        await pool.query('SELECT 1 FROM quick_signup_pending_accounts WHERE account_id=$1', [
          opened.account.id,
        ])
      ).rowCount,
    ).toBe(0);
    const existing = await service.verify(user.credential, randomBytes(32), origin);
    expect(existing.status).toBe('existing');
    if (existing.status === 'existing') expect(existing.account.id).toBe(opened.account.id);
  });
  it('refuses another browser and a changed origin before returning a recipient', async () => {
    const user = await pending();
    await expect(
      service.authorize(
        { id: user.verified.id, signature: user.signature },
        randomBytes(32),
        origin,
      ),
    ).rejects.toMatchObject({ code: 'SIGNUP_ATTEMPT_INVALID' });
    await expect(
      service.authorize(
        { id: user.verified.id, signature: user.signature },
        user.browser,
        'http://localhost:5179',
      ),
    ).rejects.toMatchObject({ code: 'SIGNUP_ATTEMPT_INVALID' });
  });
  it('rejects a signature from another key', async () => {
    const user = await pending();
    await expect(
      service.authorize(
        {
          id: user.verified.id,
          signature: PrivateKey.generate('K1')
            .signMessage(new TextEncoder().encode(user.prepared.message))
            .toString(),
        },
        user.browser,
        origin,
      ),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });
  it('keeps staged accounts unavailable to key login and preserves consent after storage failure', async () => {
    const user = await pending();
    await service.authorize(
      { id: user.verified.id, signature: user.signature },
      user.browser,
      origin,
    );
    const challenge = await createChallenge(
      pool,
      { signingKey: user.signing.toPublic().toString(), encryptionKey: user.encryption.publicKey },
      origin,
    );
    await expect(
      authenticate(
        pool,
        challenge.id,
        user.signing.signMessage(new TextEncoder().encode(challenge.message)).toString(),
        user.encryption.publicKey,
        { origin, audience: origin },
      ),
    ).rejects.toMatchObject({ code: 'SIGNUP_INCOMPLETE' });
    failStorage = true;
    try {
      await expect(finish(user)).rejects.toMatchObject({ code: 'RECOVERY_BACKUP_UNAVAILABLE' });
    } finally {
      failStorage = false;
    }
    expect(
      (
        await pool.query<{ assisted_ever: boolean }>(
          'SELECT assisted_ever FROM vault_recovery_state WHERE account_id=$1',
          [user.prepared.context.accountId],
        )
      ).rows[0]?.assisted_ever,
    ).toBe(true);
    expect(
      (await pool.query('SELECT 1 FROM credentials WHERE provider_key=$1', [user.credential]))
        .rowCount,
    ).toBe(0);
    expect((await finish(user)).account.id).toBe(user.prepared.context.accountId);
  });
  it('does not create duplicate credential ownership across concurrent attempts', async () => {
    const credential = `telegram:${crypto.randomUUID()}`,
      first = await pending(credential),
      second = await pending(credential);
    const results = await Promise.allSettled([finish(first), finish(second)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await pool.query('SELECT account_id FROM credentials WHERE provider_key=$1', [credential]))
        .rowCount,
    ).toBe(1);
  });
  it('refuses expired recovery qualification while preserving ordinary paired login', async () => {
    const user = await pending(),
      opened = await finish(user);
    const unavailable = new SignupService(pool, origin, origin, {
      ...config,
      expiresAt: Date.now() - 1,
    });
    await expect(
      unavailable.verify(`email:${crypto.randomUUID()}@example.test`, randomBytes(32), origin),
    ).rejects.toMatchObject({ code: 'RECOVERY_ASSISTED_UNAVAILABLE' });
    const existing = await unavailable.verify(user.credential, randomBytes(32), origin);
    if (existing.status !== 'existing') throw new Error('Expected existing login');
    expect(existing.account.id).toBe(opened.account.id);
  });
  it('rejects an encrypted payload containing a substituted private encryption key', async () => {
    const user = await pending(),
      authorized = await service.authorize(
        { id: user.verified.id, signature: user.signature },
        user.browser,
        origin,
      );
    const other = await createRecoveryRecipient(),
      payload = await createRecoveryPayload(
        { ...user.secrets, encryptionPrivateKey: other.privateKey },
        user.prepared.context,
      ).catch((error) => error);
    // The SDK rejects substituted originals before they can be encrypted or sent.
    expect(payload).toBeInstanceOf(Error);
    const valid = await finishInput(user);
    const tampered = {
      ...valid,
      envelope: { ...valid.envelope, ciphertext: Buffer.from(randomBytes(64)).toString('base64') },
    };
    await expect(service.finish(tampered, user.browser, origin)).rejects.toMatchObject({
      code: 'RECOVERY_KEY_MISMATCH',
    });
    expect(authorized.id).toBe(user.verified.id);
    expect(
      (await pool.query('SELECT 1 FROM credentials WHERE provider_key=$1', [user.credential]))
        .rowCount,
    ).toBe(0);
  });
  it('expires wrapped ceremony material while retaining pending-account and authority history', async () => {
    const user = await pending();
    await service.authorize(
      { id: user.verified.id, signature: user.signature },
      user.browser,
      origin,
    );
    await pool.query(
      "UPDATE quick_signup_attempts SET expires_at=now()-interval '1 second' WHERE id=$1",
      [user.verified.id],
    );
    await expect(service.pending(user.verified.id, user.browser, origin)).rejects.toMatchObject({
      code: 'SIGNUP_ATTEMPT_INVALID',
    });
    expect(await cleanupSignupAttempts(pool)).toBeGreaterThan(0);
    expect(
      (await pool.query('SELECT 1 FROM quick_signup_attempts WHERE id=$1', [user.verified.id]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await pool.query('SELECT 1 FROM quick_signup_pending_accounts WHERE account_id=$1', [
          user.prepared.context.accountId,
        ])
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await pool.query<{ assisted_ever: boolean }>(
          'SELECT assisted_ever FROM vault_recovery_state WHERE account_id=$1',
          [user.prepared.context.accountId],
        )
      ).rows[0]?.assisted_ever,
    ).toBe(true);
  });
  it('resumes OIDC signup after real JWT verification without staging keys before the redirect', async () => {
    const oidcKeys = await generateKeyPair('RS256'),
      subject = String(1000000 + Math.floor(Math.random() * 100000000));
    let nonce = '';
    const oidc = await createServer(pool, authChain, origin, {
      recovery: config,
      signIn: { environment: 'local' },
      providers: {
        telegram: {
          oidc: {
            clientId: '12345',
            clientSecret: 'owned-fixture',
            redirectUri: 'http://localhost:3028/v1/sign-in/telegram/oidc/callback',
            key: oidcKeys.publicKey,
            fetch: async () =>
              new Response(
                JSON.stringify({
                  id_token: await new SignJWT({ nonce })
                    .setProtectedHeader({ alg: 'RS256' })
                    .setIssuer('https://oauth.telegram.org')
                    .setAudience('12345')
                    .setSubject(subject)
                    .setIssuedAt()
                    .setExpirationTime('5m')
                    .sign(oidcKeys.privateKey),
                }),
                { status: 200 },
              ),
          },
        },
      },
    });
    try {
      const start = await oidc.inject({
        method: 'POST',
        url: SignupRoutes.signupTelegramStart.path,
        headers: { origin },
        payload: { returnTo: '/create' },
      });
      expect(start.statusCode).toBe(200);
      const authorization = new URL(
          SignupRoutes.signupTelegramStart.response.parse(start.json()).authorizationUrl,
        ),
        state = authorization.searchParams.get('state');
      nonce = authorization.searchParams.get('nonce') ?? '';
      const cookie = start.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      expect(start.cookies.some((c) => c.name === 'daclify_signup_attempt')).toBe(true);
      const callback = await oidc.inject({
        method: 'GET',
        url: `/v1/sign-in/telegram/oidc/callback?state=${state}&code=owned-fixture`,
        headers: { cookie },
      });
      expect(callback.statusCode).toBe(302);
      const location = new URL(callback.headers.location ?? '');
      expect(location.origin).toBe(origin);
      expect(location.searchParams.get('returnTo')).toBe('/create');
      const ticket = await oidc.inject({
        method: 'GET',
        url: `/v1/sign-up/pending/${location.searchParams.get('signup')}`,
        headers: { origin, cookie },
      });
      expect(ticket.statusCode).toBe(200);
      const value = SignupRoutes.signupPending.response.parse(ticket.json());
      expect(value.provider).toBe('telegram');
      expect(
        (
          await pool.query<{ staged_account_id: string | null }>(
            'SELECT staged_account_id FROM quick_signup_attempts WHERE id=$1',
            [value.id],
          )
        ).rows[0]?.staged_account_id,
      ).toBeNull();
      const replay = await oidc.inject({
        method: 'GET',
        url: `/v1/sign-in/telegram/oidc/callback?state=${state}&code=owned-fixture`,
        headers: { cookie },
      });
      expect(replay.statusCode).toBe(401);
    } finally {
      await oidc.close();
    }
  });
});
