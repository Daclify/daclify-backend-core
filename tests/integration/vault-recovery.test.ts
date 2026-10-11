import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { ApiRoutes } from '../../protocol/routes.js';
import { ChallengeSchema, NetworkSchema, SessionSchema } from '../../protocol/api.js';
import {
  RecoveryBackupSchema,
  RecoveryMethodsSchema,
  type RecoveryBackup,
} from '../../protocol/recovery.js';
import { EvmSignInChallengeSchema } from '../../protocol/evm-wallet.js';
import { VaultSecretsSchema } from '../../protocol/crypto.js';
import {
  createRecoveryBackup,
  createRecoveryRecipient,
  openRecoveryBackup,
  createRecoveryPayload,
  sealRecoveryDelivery,
  openRecoveryDelivery,
  openRecoveryPayload,
} from '../../sdk/recovery.js';
import {
  RecoveryAssistedOptionsSchema,
  RecoveryClaimResponseSchema,
  recoveryVaultDomain,
} from '../../protocol/recovery.js';
import { UserMembershipSchema, DaoSummarySchema } from '../../protocol/api.js';
import {
  DeviceRecoveryRequestSchema,
  DeviceRecoveryPayloadSchema,
} from '../../protocol/recovery.js';
import {
  sealDeviceRecovery,
  openDeviceRecovery,
  recoveryDeviceFingerprint,
} from '../../sdk/recovery.js';
import { controlledInject } from '../helpers/account-control.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error('Owned local recovery test database required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const chainId = 'ab'.repeat(32);
const chain: ChainGateway = {
  network: async () =>
    NetworkSchema.parse({
      chainId,
      rpcUrl: 'http://localhost:18888',
      runtime: 'daclifycore',
      hub: null,
      environment: 'local',
      interfaceVersion: 1,
      coreVersion: '0.12.0-alpha.1',
      capabilities: [],
    }),
  memberships: async () => [],
  listDaos: async () => [],
  memberProfile: async () => ({ accountName: null, profile: null }),
  governance: async () => {
    throw new Error('unused');
  },
  execute: async () => {
    throw new Error('unused');
  },
  finalize: async () => ({ state: 'already-finalized' }),
  treasury: async () => {
    throw new Error('unused');
  },
  settle: async () => ({ state: 'already-settled' }),
  dao: async () => {
    throw new Error('unused');
  },
  content: async () => {
    throw new Error('unused');
  },
  moduleState: async () => {
    throw new Error('unused');
  },
  createDao: async () => {
    throw new Error('unused');
  },
  relay: async () => {
    throw new Error('unused');
  },
};
const copies = new Map<string, string>();
const store = {
  async write(record: RecoveryBackup) {
    const bytes = JSON.stringify(RecoveryBackupSchema.parse(record));
    copies.set(record.context.id, bytes);
    return {
      storeId: 'isolated-test-copy',
      reference: record.context.id,
      commitment: createHash('sha256').update(bytes).digest('hex'),
      verifiedAt: new Date().toISOString(),
    };
  },
  async read(receipt: { reference: string; commitment: string }) {
    const bytes = copies.get(receipt.reference);
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== receipt.commitment)
      throw new Error('RECOVERY_BACKUP_UNAVAILABLE');
    return RecoveryBackupSchema.parse(JSON.parse(bytes));
  },
};
const providerKey = randomBytes(32);
const keys = {
  async wrap(_name: string, bytes: Uint8Array) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', providerKey, iv);
    return (
      'vault:v1:' +
      Buffer.concat([iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]).toString(
        'base64',
      )
    );
  },
  async unwrap(_name: string, value: string) {
    const bytes = Buffer.from(value.slice(9), 'base64'),
      cipher = createDecipheriv('aes-256-gcm', providerKey, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(-16));
    return Uint8Array.from(Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]));
  },
};
const recovery = {
  store,
  keys,
  qualifiedWallets: ['evm'] as const,
  passkeysQualified: false,
  assistedQualified: false,
};
const delivered = new Map<string, string>();
let app: Awaited<ReturnType<typeof createServer>>;
beforeAll(async () => {
  await migrate(pool);
  app = await createServer(pool, chain, origin, {
    recovery,
    origins: ['http://localhost:5179'],
    signIn: {
      environment: 'testnet',
      deliverEmail: async (to, code) => {
        delivered.set(to, code);
      },
    },
  });
});
afterAll(async () => {
  await app?.close();
  await pool.end();
});
const cookies = (response: { cookies: { name: string; value: string }[] }) =>
  response.cookies.map((c) => c.name + '=' + c.value).join('; ');
const headers = (owner: { cookie: string; session: { csrfToken: string } }) => ({
  origin,
  cookie: owner.cookie,
  'x-csrf-token': owner.session.csrfToken,
});

let simulatedClient = 0;
async function owner() {
  const remoteAddress = `192.0.2.${++simulatedClient}`;
  const key = PrivateKey.generate('K1'),
    encryption = await createRecoveryRecipient();
  const started = await app.inject({
    remoteAddress,
    method: 'POST',
    url: ApiRoutes.challenge.path,
    headers: { origin },
    payload: { signingKey: key.toPublic().toString(), encryptionKey: encryption.publicKey },
  });
  expect(started.statusCode).toBe(200);
  const challenge = ChallengeSchema.parse(started.json());
  const logged = await app.inject({
    method: 'POST',
    url: ApiRoutes.login.path,
    headers: { origin },
    payload: {
      challengeId: challenge.id,
      signature: key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey: encryption.publicKey,
    },
  });
  expect(logged.statusCode).toBe(200);
  const session = SessionSchema.parse(logged.json());
  const wallet = privateKeyToAccount(generatePrivateKey());
  const credentialKey = `evm:41:${wallet.address.toLowerCase()}`;
  await pool.query(
    'INSERT INTO evm_links(account_id,chain_id,address,control_verified_at) VALUES($1,41,$2,now())',
    [session.account.id, wallet.address.toLowerCase()],
  );
  const secrets = VaultSecretsSchema.parse({
    signingKey: key.toString(),
    encryptionPrivateKey: encryption.privateKey,
  });
  return {
    key,
    session,
    cookie: cookies(logged),
    wallet,
    credentialKey,
    secrets,
    material: crypto.getRandomValues(new Uint8Array(32)),
  };
}
async function enroll(user: Awaited<ReturnType<typeof owner>>) {
  const backup = await createRecoveryBackup(
    user.secrets,
    {
      version: 1,
      id: crypto.randomUUID(),
      accountId: user.session.account.id,
      origin,
      credentialKey: user.credentialKey,
      mode: 'wallet-protected',
      signingPublicKey: user.session.account.signingKey ?? '',
      encryptionPublicKey: user.session.account.encryptionKey ?? user.secrets.encryptionPrivateKey,
      salt: randomBytes(32).toString('base64'),
    },
    user.material,
  );
  if (backup.keyWrap.kind !== 'client') throw new Error('Private recovery fixture expected');
  const payload = {
    context: backup.context,
    envelope: backup.envelope,
    clientKeyWrap: backup.keyWrap.envelope,
  };
  const result = await controlledInject(app, user.key, {
    method: 'POST',
    url: '/v1/account/recovery/enable',
    headers: headers(user),
    payload,
  });
  return { backup, payload, result };
}
async function walletLogin(user: Awaited<ReturnType<typeof owner>>) {
  const start = await app.inject({
    method: 'POST',
    url: '/v1/account/evm/sign-in/challenge',
    headers: { origin },
    payload: { purpose: 'login', chainId: 41, address: user.wallet.address },
  });
  const challenge = EvmSignInChallengeSchema.parse(start.json());
  const result = await app.inject({
    method: 'POST',
    url: '/v1/sign-in/evm',
    headers: { origin, cookie: cookies(start) },
    payload: {
      id: challenge.id,
      signature: await user.wallet.signMessage({ message: challenge.message }),
    },
  });
  expect(result.statusCode).toBe(200);
  return {
    result,
    cookie: cookies(result),
    session: SessionSchema.parse(result.json()),
    grant: String(result.headers['x-daclify-recovery-grant'] ?? ''),
  };
}
async function claim(login: Awaited<ReturnType<typeof walletLogin>>, site = origin) {
  const recipient = await createRecoveryRecipient();
  return app.inject({
    method: 'POST',
    url: '/v1/account/recovery/claim',
    headers: { origin: site, cookie: login.cookie, 'x-csrf-token': login.session.csrfToken },
    payload: { grant: login.grant, recipient: recipient.publicKey },
  });
}

describe('full access through explicitly selected paired methods', () => {
  it('does not let an old session authorize assisted recovery for the vault', async () => {
    recovery.assistedQualified = true;
    try {
      const user = await owner();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/account/recovery/assisted/options',
        headers: headers(user),
        payload: {
          context: {
            version: 1 as const,
            id: crypto.randomUUID(),
            accountId: user.session.account.id,
            origin,
            credentialKey: user.credentialKey,
            mode: 'daclify-assisted' as const,
            signingPublicKey: user.key.toPublic().toString(),
            encryptionPublicKey:
              user.session.account.encryptionKey ?? user.secrets.encryptionPrivateKey,
            salt: randomBytes(32).toString('base64'),
          },
          assistedConsent: true,
        },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'ACCOUNT_CONTROL_REQUIRED' });
      expect(
        (
          await app.inject({ method: 'GET', url: '/v1/account/recovery', headers: headers(user) })
        ).json().assistedEver,
      ).toBe(false);
    } finally {
      recovery.assistedQualified = false;
    }
  });
  it('starts existing paired methods as login-only without changing the account', async () => {
    const user = await owner();
    const result = await app.inject({
      method: 'GET',
      url: '/v1/account/recovery',
      headers: headers(user),
    });
    expect(result.statusCode).toBe(200);
    expect(RecoveryMethodsSchema.parse(result.json()).methods).toContainEqual(
      expect.objectContaining({ credentialKey: user.credentialKey, mode: null }),
    );
    const login = await walletLogin(user);
    expect(login.session.account.id).toBe(user.session.account.id);
    expect(login.grant).toBe('');
  });
  it('requires fresh current-key consent to enable a method', async () => {
    const user = await owner();
    const { payload } = await enroll(user);
    const denied = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/enable',
      headers: headers(user),
      payload,
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toMatchObject({ code: 'ACCOUNT_CONTROL_REQUIRED' });
  });
  it('issues a one-time grant only after fresh paired login and restores both original keys', async () => {
    const user = await owner(),
      enabled = await enroll(user);
    expect(enabled.result.statusCode).toBe(200);
    const login = await walletLogin(user),
      recipient = await createRecoveryRecipient();
    expect(login.grant).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const payload = { grant: login.grant, recipient: recipient.publicKey };
    const claimed = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/claim',
      headers: { origin, cookie: login.cookie, 'x-csrf-token': login.session.csrfToken },
      payload,
    });
    expect(claimed.statusCode).toBe(200);
    const backup = RecoveryBackupSchema.parse(claimed.json().backup);
    expect(await openRecoveryBackup(backup, user.material)).toEqual(user.secrets);
    expect(JSON.stringify(claimed.json())).not.toContain(user.secrets.signingKey);
    expect(claimed.json().keyGrant).toBeNull();
    const again = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/claim',
      headers: { origin, cookie: login.cookie, 'x-csrf-token': login.session.csrfToken },
      payload,
    });
    expect(again.statusCode).toBe(401);
  });
  it('does not mint a recovery grant when refreshing an old session', async () => {
    const user = await owner();
    await enroll(user);
    const result = await app.inject({
      method: 'POST',
      url: '/v1/sign-in/session',
      headers: headers(user),
      payload: {},
    });
    expect(result.statusCode).toBe(200);
    expect(result.headers['x-daclify-recovery-grant']).toBeUndefined();
  });
  it('rechecks enabled state and credential ownership before releasing a retained grant', async () => {
    const user = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    const login = await walletLogin(user),
      recipient = await createRecoveryRecipient();
    await pool.query('DELETE FROM evm_links WHERE account_id=$1', [user.session.account.id]);
    const result = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/claim',
      headers: { origin, cookie: login.cookie, 'x-csrf-token': login.session.csrfToken },
      payload: { grant: login.grant, recipient: recipient.publicKey },
    });
    expect(result.statusCode).toBe(401);
  });
  it('does not allow another account to claim or replace an owner backup', async () => {
    const user = await owner(),
      other = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    const login = await walletLogin(user),
      recipient = await createRecoveryRecipient();
    const result = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/claim',
      headers: headers(other),
      payload: { grant: login.grant, recipient: recipient.publicKey },
    });
    expect(result.statusCode).toBe(401);
  });
  it('expires grants instead of allowing retained capabilities to unlock later', async () => {
    const user = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    const login = await walletLogin(user);
    await pool.query(
      "UPDATE vault_recovery_grants SET expires_at=now()-interval '1 second' WHERE account_id=$1",
      [user.session.account.id],
    );
    expect((await claim(login)).statusCode).toBe(401);
  });
  it('allows exactly one of two simultaneous claims', async () => {
    const user = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    const login = await walletLogin(user);
    const responses = await Promise.all([claim(login), claim(login)]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 401]);
  });
  it('rejects another allowed site and an older session even for the same account', async () => {
    const user = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    const first = await walletLogin(user),
      second = await walletLogin(user);
    expect((await claim(first, 'http://localhost:5179')).statusCode).toBe(401);
    expect(
      (await claim({ ...first, cookie: second.cookie, session: second.session })).statusCode,
    ).toBe(401);
    expect((await claim(first)).statusCode).toBe(200);
  });
  it('invalidates grants on disable and requires acknowledgment of losing the last full-access method', async () => {
    const user = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    const login = await walletLogin(user);
    const payload = { credentialKey: user.credentialKey };
    const denied = await controlledInject(app, user.key, {
      method: 'POST',
      url: '/v1/account/recovery/disable',
      headers: headers(user),
      payload,
    });
    expect(denied.statusCode).toBe(409);
    const disabled = await controlledInject(app, user.key, {
      method: 'POST',
      url: '/v1/account/recovery/disable',
      headers: headers(user),
      payload: { ...payload, keepKitFallback: true },
    });
    expect(disabled.statusCode).toBe(200);
    expect((await claim(login)).statusCode).toBe(401);
    expect((await walletLogin(user)).grant).toBe('');
  });
  it('does not resurrect full access when an unlinked wallet is paired again', async () => {
    const user = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    await pool.query('DELETE FROM evm_links WHERE account_id=$1', [user.session.account.id]);
    await pool.query(
      'INSERT INTO evm_links(account_id,chain_id,address,control_verified_at) VALUES($1,41,$2,now())',
      [user.session.account.id, user.wallet.address.toLowerCase()],
    );
    expect((await walletLogin(user)).grant).toBe('');
  });
  it('fails closed for missing or changed independent copies without consuming a retryable grant', async () => {
    const user = await owner(),
      enabled = await enroll(user);
    expect(enabled.result.statusCode).toBe(200);
    const login = await walletLogin(user),
      bytes = copies.get(enabled.backup.context.id);
    copies.set(enabled.backup.context.id, '{}');
    expect((await claim(login)).statusCode).toBe(503);
    if (!bytes) throw new Error('Recovery fixture missing');
    copies.set(enabled.backup.context.id, bytes);
    expect((await claim(login)).statusCode).toBe(200);
  });
  it('rejects changed identity, credential and site before saving a method', async () => {
    const user = await owner(),
      enabled = await enroll(user);
    expect(enabled.result.statusCode).toBe(200);
    for (const context of [
      { ...enabled.payload.context, accountId: crypto.randomUUID() },
      { ...enabled.payload.context, credentialKey: 'evm:41:0x' + '11'.repeat(20) },
      { ...enabled.payload.context, origin: 'https://foreign.example.test' },
    ]) {
      const response = await controlledInject(app, user.key, {
        method: 'POST',
        url: '/v1/account/recovery/enable',
        headers: headers(user),
        payload: { ...enabled.payload, context },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    }
  });
  it('preserves identity and enrolled backup through repeated migrations', async () => {
    const user = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    await migrate(pool);
    await migrate(pool);
    const login = await walletLogin(user);
    expect(login.session.account).toEqual(user.session.account);
    expect((await claim(login)).statusCode).toBe(200);
  });
  it('restores original keys through an explicitly enabled email after fresh real OTP verification', async () => {
    recovery.assistedQualified = true;
    try {
      const user = await owner(),
        email = `${crypto.randomUUID()}@example.test`;
      await pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)', [
        'email:' + email,
        user.session.account.id,
      ]);
      const context = {
        version: 1 as const,
        id: crypto.randomUUID(),
        accountId: user.session.account.id,
        origin,
        credentialKey: 'email:' + email,
        mode: 'daclify-assisted' as const,
        signingPublicKey: user.key.toPublic().toString(),
        encryptionPublicKey:
          user.session.account.encryptionKey ?? user.secrets.encryptionPrivateKey,
        salt: randomBytes(32).toString('base64'),
      };
      const options = await controlledInject(app, user.key, {
        method: 'POST',
        url: '/v1/account/recovery/assisted/options',
        headers: headers(user),
        payload: { context, assistedConsent: true },
      });
      expect(options.statusCode).toBe(200);
      const handoff = RecoveryAssistedOptionsSchema.parse(options.json());
      const { envelope, key } = await createRecoveryPayload(user.secrets, context);
      const keyGrant = await sealRecoveryDelivery(
        key,
        handoff.recipient,
        `enroll:${handoff.id}:${recoveryVaultDomain(context)}`,
      );
      const payload = {
        context,
        envelope,
        assistedHandoff: { id: handoff.id, keyGrant },
        assistedConsent: true,
      };
      expect(JSON.stringify(payload)).not.toContain(Buffer.from(key).toString('base64'));
      key.fill(0);
      const enabled = await controlledInject(app, user.key, {
        method: 'POST',
        url: '/v1/account/recovery/enable',
        headers: headers(user),
        payload,
      });
      expect(enabled.statusCode).toBe(200);
      expect(RecoveryMethodsSchema.parse(enabled.json()).assistedEver).toBe(true);
      const start = await app.inject({
        method: 'POST',
        url: '/v1/sign-in/email/login/start',
        headers: { origin },
        payload: { email },
      });
      const result = await app.inject({
        method: 'POST',
        url: '/v1/sign-in/email/login',
        headers: { origin, cookie: cookies(start) },
        payload: { email, code: delivered.get(email) },
      });
      expect(result.statusCode).toBe(200);
      const session = SessionSchema.parse(result.json()),
        recipient = await createRecoveryRecipient();
      expect(session.account).toEqual(user.session.account);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/account/recovery/claim',
        headers: { origin, cookie: cookies(result), 'x-csrf-token': session.csrfToken },
        payload: {
          grant: result.headers['x-daclify-recovery-grant'],
          recipient: recipient.publicKey,
        },
      });
      expect(response.statusCode).toBe(200);
      const claimed = RecoveryClaimResponseSchema.parse(response.json());
      if (!claimed.keyGrant) throw new Error('Missing encrypted key delivery');
      const restored = await openRecoveryDelivery(
        claimed.keyGrant,
        recipient.privateKey,
        'claim:' + recoveryVaultDomain(context),
      );
      try {
        expect(await openRecoveryPayload(claimed.backup, restored)).toEqual(user.secrets);
      } finally {
        restored.fill(0);
      }
      expect(JSON.stringify(response.json())).not.toContain(user.secrets.encryptionPrivateKey.d);
    } finally {
      recovery.assistedQualified = false;
    }
  });
  it('retains the assisted authority disclosure when independent storage fails after authorization', async () => {
    recovery.assistedQualified = true;
    let write: ReturnType<typeof vi.spyOn> | undefined;
    try {
      const user = await owner(),
        context = {
          version: 1 as const,
          id: crypto.randomUUID(),
          accountId: user.session.account.id,
          origin,
          credentialKey: user.credentialKey,
          mode: 'daclify-assisted' as const,
          signingPublicKey: user.key.toPublic().toString(),
          encryptionPublicKey:
            user.session.account.encryptionKey ?? user.secrets.encryptionPrivateKey,
          salt: randomBytes(32).toString('base64'),
        };
      const authorized = await controlledInject(app, user.key, {
        method: 'POST',
        url: '/v1/account/recovery/assisted/options',
        headers: headers(user),
        payload: { context, assistedConsent: true },
      });
      expect(authorized.statusCode).toBe(200);
      const handoff = RecoveryAssistedOptionsSchema.parse(authorized.json()),
        encrypted = await createRecoveryPayload(user.secrets, context);
      const keyGrant = await sealRecoveryDelivery(
        encrypted.key,
        handoff.recipient,
        `enroll:${handoff.id}:${recoveryVaultDomain(context)}`,
      );
      encrypted.key.fill(0);
      write = vi.spyOn(store, 'write').mockRejectedValue(new Error('Independent host unavailable'));
      const response = await controlledInject(app, user.key, {
        method: 'POST',
        url: '/v1/account/recovery/enable',
        headers: headers(user),
        payload: {
          context,
          envelope: encrypted.envelope,
          assistedHandoff: { id: handoff.id, keyGrant },
          assistedConsent: true,
        },
      });
      expect(response.statusCode).toBe(503);
      const methods = RecoveryMethodsSchema.parse(
        (
          await app.inject({ method: 'GET', url: '/v1/account/recovery', headers: headers(user) })
        ).json(),
      );
      expect(methods.assistedEver).toBe(true);
      expect(methods.methods.every((method) => method.mode === null)).toBe(true);
    } finally {
      write?.mockRestore();
      recovery.assistedQualified = false;
    }
  });
  it('does not grant full access from a quarantined restored pairing', async () => {
    const user = await owner();
    expect((await enroll(user)).result.statusCode).toBe(200);
    await pool.query('UPDATE vault_recovery_methods SET quarantined=true WHERE account_id=$1', [
      user.session.account.id,
    ]);
    expect((await walletLogin(user)).grant).toBe('');
    expect(
      RecoveryMethodsSchema.parse(
        (
          await app.inject({ method: 'GET', url: '/v1/account/recovery', headers: headers(user) })
        ).json(),
      ).methods.every((method) => method.mode === null),
    ).toBe(true);
    expect((await enroll(user)).result.statusCode).toBe(200);
    expect((await walletLogin(user)).grant).not.toBe('');
  });
  it('requires fallback acknowledgment when only quarantined backups would remain', async () => {
    const user = await owner(),
      wallet = privateKeyToAccount(generatePrivateKey());
    await pool.query(
      'INSERT INTO evm_links(account_id,chain_id,address,control_verified_at) VALUES($1,40,$2,now())',
      [user.session.account.id, wallet.address.toLowerCase()],
    );
    const other = {
      ...user,
      wallet,
      credentialKey: `evm:40:${wallet.address.toLowerCase()}`,
      material: randomBytes(32),
    };
    expect((await enroll(user)).result.statusCode).toBe(200);
    expect((await enroll(other)).result.statusCode).toBe(200);
    await pool.query(
      'UPDATE vault_recovery_methods SET quarantined=true WHERE account_id=$1 AND credential_key=$2',
      [user.session.account.id, other.credentialKey],
    );
    const denied = await controlledInject(app, user.key, {
      method: 'POST',
      url: '/v1/account/recovery/disable',
      headers: headers(user),
      payload: { credentialKey: user.credentialKey },
    });
    expect(denied.statusCode).toBe(409);
    expect(denied.json()).toMatchObject({ code: 'RECOVERY_FALLBACK_REQUIRED' });
  });
  it('rejects assisted recovery for a historical strict-private DAO even after membership becomes inactive', async () => {
    recovery.assistedQualified = true;
    const user = await owner(),
      dao = { chainId, contract: 'daclifycore', daoId: '1', interfaceVersion: 1 };
    const membership = UserMembershipSchema.parse({
      dao,
      memberId: '1',
      nonce: '0',
      active: false,
      admin: false,
      reviewer: false,
      credits: '0',
      claim: '0',
      stake: '0',
      nativeAccount: '',
      custody: 'user-controlled',
    });
    const members = vi.spyOn(chain, 'memberships').mockResolvedValue([membership]);
    const summary = vi.spyOn(chain, 'dao').mockResolvedValue(
      DaoSummarySchema.parse({
        reference: dao,
        title: 'Strict',
        description: '',
        privacy: 'encrypted-user-controlled',
        owner: 'alice',
        token: { chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
        members: 1,
        available: '0',
        reserved: '0',
        claims: '0',
        keyEpoch: '1',
      }),
    );
    try {
      const response = await controlledInject(app, user.key, {
        method: 'POST',
        url: '/v1/account/recovery/assisted/options',
        headers: headers(user),
        payload: {
          context: {
            version: 1 as const,
            id: crypto.randomUUID(),
            accountId: user.session.account.id,
            origin,
            credentialKey: user.credentialKey,
            mode: 'daclify-assisted' as const,
            signingPublicKey: user.key.toPublic().toString(),
            encryptionPublicKey:
              user.session.account.encryptionKey ?? user.secrets.encryptionPrivateKey,
            salt: randomBytes(32).toString('base64'),
          },
          assistedConsent: true,
        },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'CUSTODY_POLICY' });
    } finally {
      members.mockRestore();
      summary.mockRestore();
      recovery.assistedQualified = false;
    }
  });
  it('blocks assisted access to historical strict documents even when current-key membership discovery returns none', async () => {
    recovery.assistedQualified = true;
    const user = await owner(),
      dao = {
        chainId,
        contract: 'daclifycore',
        daoId: (BigInt('0x' + randomBytes(8).toString('hex')) || 1n).toString(),
        interfaceVersion: 1,
      };
    await pool.query(
      'INSERT INTO memberships(account_id,chain_id,contract,dao_id,member_id) VALUES($1,$2,$3,$4,$5)',
      [user.session.account.id, chainId, dao.contract, dao.daoId, '1'],
    );
    const members = vi.spyOn(chain, 'memberships').mockResolvedValue([]),
      summary = vi.spyOn(chain, 'dao').mockResolvedValue(
        DaoSummarySchema.parse({
          reference: dao,
          title: 'Historical strict',
          description: '',
          privacy: 'encrypted-user-controlled',
          owner: 'alice',
          token: { chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
          members: 1,
          available: '0',
          reserved: '0',
          claims: '0',
          keyEpoch: '1',
        }),
      );
    try {
      const context = {
        version: 1 as const,
        id: crypto.randomUUID(),
        accountId: user.session.account.id,
        origin,
        credentialKey: user.credentialKey,
        mode: 'daclify-assisted' as const,
        signingPublicKey: user.key.toPublic().toString(),
        encryptionPublicKey:
          user.session.account.encryptionKey ?? user.secrets.encryptionPrivateKey,
        salt: randomBytes(32).toString('base64'),
      };
      const response = await controlledInject(app, user.key, {
        method: 'POST',
        url: '/v1/account/recovery/assisted/options',
        headers: headers(user),
        payload: { context, assistedConsent: true },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'CUSTODY_POLICY' });
    } finally {
      members.mockRestore();
      summary.mockRestore();
      recovery.assistedQualified = false;
    }
  });
  it('rejects cancelled, expired, cross-account and revoked receiving-device requests', async () => {
    const user = await owner(),
      other = await owner(),
      login = await walletLogin(user),
      receiver = await createRecoveryRecipient(),
      receiving = { origin, cookie: login.cookie, 'x-csrf-token': login.session.csrfToken };
    async function begin() {
      const result = await app.inject({
        method: 'POST',
        url: '/v1/account/recovery/device',
        headers: receiving,
        payload: { recipient: receiver.publicKey },
      });
      expect(result.statusCode).toBe(200);
      return {
        request: DeviceRecoveryRequestSchema.parse(result.json().request),
        pollToken: String(result.json().pollToken),
      };
    }
    async function poll(request: Awaited<ReturnType<typeof begin>>, incoming = receiving) {
      return app.inject({
        method: 'POST',
        url: '/v1/account/recovery/device/poll',
        headers: incoming,
        payload: { id: request.request.id, pollToken: request.pollToken },
      });
    }
    const cancelled = await begin();
    expect((await poll(cancelled, headers(other))).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/account/recovery/device/cancel',
          headers: receiving,
          payload: { id: cancelled.request.id, pollToken: cancelled.pollToken },
        })
      ).statusCode,
    ).toBe(200);
    expect((await poll(cancelled)).statusCode).toBe(401);
    const expired = await begin();
    await pool.query(
      "UPDATE vault_recovery_devices SET expires_at=now()-interval '1 second' WHERE id=$1",
      [expired.request.id],
    );
    expect((await poll(expired)).statusCode).toBe(401);
    const revoked = await begin();
    await pool.query('DELETE FROM evm_links WHERE account_id=$1', [user.session.account.id]);
    expect((await poll(revoked)).statusCode).toBeGreaterThanOrEqual(400);
    const payload = await sealDeviceRecovery(user.secrets, revoked.request);
    expect(
      (
        await controlledInject(app, user.key, {
          method: 'POST',
          url: '/v1/account/recovery/device/approve',
          headers: headers(user),
          payload: { id: revoked.request.id, fingerprint: revoked.request.fingerprint, payload },
        })
      ).statusCode,
    ).toBe(401);
  });
  it('delivers encrypted existing-device approval once and rejects fingerprint substitution or approval using only an old session', async () => {
    const user = await owner(),
      login = await walletLogin(user),
      receiver = await createRecoveryRecipient();
    const receiverHeaders = {
      origin,
      cookie: login.cookie,
      'x-csrf-token': login.session.csrfToken,
    };
    const started = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/device',
      headers: receiverHeaders,
      payload: { recipient: receiver.publicKey },
    });
    expect(started.statusCode).toBe(200);
    const request = DeviceRecoveryRequestSchema.parse(started.json().request),
      pollToken = String(started.json().pollToken);
    expect(request.fingerprint).toBe(await recoveryDeviceFingerprint(receiver.publicKey));
    const payload = await sealDeviceRecovery(user.secrets, request),
      approval = { id: request.id, fingerprint: request.fingerprint, payload };
    const denied = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/device/approve',
      headers: headers(user),
      payload: approval,
    });
    expect(denied.statusCode).toBe(403);
    const changed = await controlledInject(app, user.key, {
      method: 'POST',
      url: '/v1/account/recovery/device/approve',
      headers: headers(user),
      payload: { ...approval, fingerprint: '00'.repeat(32) },
    });
    expect(changed.statusCode).toBe(409);
    const approved = await controlledInject(app, user.key, {
      method: 'POST',
      url: '/v1/account/recovery/device/approve',
      headers: headers(user),
      payload: approval,
    });
    expect(approved.statusCode).toBe(200);
    const claimed = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/device/poll',
      headers: receiverHeaders,
      payload: { id: request.id, pollToken },
    });
    expect(claimed.statusCode).toBe(200);
    expect(
      await openDeviceRecovery(
        DeviceRecoveryPayloadSchema.parse(claimed.json().payload),
        receiver.privateKey,
        request,
      ),
    ).toEqual(user.secrets);
    const again = await app.inject({
      method: 'POST',
      url: '/v1/account/recovery/device/poll',
      headers: receiverHeaders,
      payload: { id: request.id, pollToken },
    });
    expect(again.statusCode).toBe(401);
  });
});
