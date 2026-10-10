// Testnet-only HTTP acceptance; generated fixture secrets stay in a private ignored file.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { PrivateKey } from '@wharfkit/antelope';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { ApiRoutes } from '../../protocol/routes.js';
import { ChallengeSchema, SessionSchema, NetworkSchema } from '../../protocol/api.js';
import {
  RecoveryKitSchema,
  VaultEnvelopeSchema,
  type VaultSecrets,
} from '../../protocol/crypto.js';
import { AccountControlChallengeSchema } from '../../protocol/sign-in.js';
import { EvmSignInChallengeSchema } from '../../protocol/evm-wallet.js';
import { RecoveryRoutes, RecoveryMethodsSchema } from '../../protocol/recovery.js';
import { VERSION } from '../../protocol/base.js';
import {
  createRecoveryRecipient,
  sealDeviceRecovery,
  openDeviceRecovery,
  sealRecoveryDelivery,
  openRecoveryDelivery,
} from '../../sdk/recovery.js';
const api = 'https://testnet.api.daclify.com',
  origin = 'https://testnet.app.daclify.com';
const path =
  '.superpowers/sdd/2026-10-10-passwordless-devices-and-vault-recovery/public-device-fixture.json';
class Client {
  readonly cookies = new Map<string, string>();
  csrf = '';
  async request(route: string, input?: unknown, extra: Record<string, string> = {}) {
    const response = await fetch(api + route, {
      method: input === undefined ? 'GET' : 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: {
        origin,
        'content-type': 'application/json',
        cookie: [...this.cookies].map(([key, value]) => key + '=' + value).join('; '),
        ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}),
        ...extra,
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(';')[0] ?? '',
        index = first.indexOf('=');
      if (index < 1) throw new Error('PUBLIC_PROBE_COOKIE_INVALID');
      const name = first.slice(0, index),
        value = first.slice(index + 1);
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return { status: response.status, body: await response.json() };
  }
}
async function controlled(client: Client, key: PrivateKey, route: string, input: unknown) {
  const body = JSON.stringify(input),
    started = await client.request('/v1/account/control', {
      path: route,
      bodyHash: createHash('sha256').update(body).digest('hex'),
    });
  assert.equal(started.status, 200);
  const challenge = AccountControlChallengeSchema.parse(started.body);
  return client.request(route, input, {
    'x-account-intent-id': challenge.id,
    'x-account-signature': key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
  });
}
async function protect(secrets: VaultSecrets, password: string) {
  const salt = randomBytes(16),
    iv = randomBytes(12),
    text = new TextEncoder();
  const root = await crypto.subtle.importKey('raw', text.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 },
    root,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: text.encode('daclify.vault.v1') },
    key,
    text.encode(JSON.stringify(secrets)),
  );
  return VaultEnvelopeSchema.parse({
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: 600000,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: Buffer.from(encrypted).toString('base64'),
  });
}
const source = new Client(),
  receiving = new Client();
let fixtureWritten = false;
try {
  const network = await source.request('/v1/network');
  assert.equal(network.status, 200);
  assert.equal(NetworkSchema.parse(network.body).environment, 'testnet');
  assert.equal(NetworkSchema.parse(network.body).coreVersion, VERSION);
  const signing = PrivateKey.generate('K1'),
    encryption = await createRecoveryRecipient(),
    secrets = { signingKey: signing.toString(), encryptionPrivateKey: encryption.privateKey };
  const identity = {
    signingKey: signing.toPublic().toString(),
    encryptionKey: encryption.publicKey,
  };
  const started = await source.request(ApiRoutes.challenge.path, identity);
  assert.equal(started.status, 200);
  const challenge = ChallengeSchema.parse(started.body);
  const logged = await source.request(ApiRoutes.login.path, {
    challengeId: challenge.id,
    signature: signing.signMessage(new TextEncoder().encode(challenge.message)).toString(),
    encryptionKey: encryption.publicKey,
  });
  assert.equal(logged.status, 200);
  const original = SessionSchema.parse(logged.body);
  source.csrf = original.csrfToken;
  const wallet = privateKeyToAccount(generatePrivateKey());
  const pair = await source.request('/v1/account/evm/sign-in/challenge', {
    purpose: 'pair',
    chainId: 41,
    address: wallet.address,
  });
  assert.equal(pair.status, 200);
  const pairing = EvmSignInChallengeSchema.parse(pair.body);
  const linked = await controlled(source, signing, '/v1/account/evm/sign-in/link', {
    id: pairing.id,
    signature: await wallet.signMessage({ message: pairing.message }),
  });
  assert.equal(linked.status, 200);
  const loginChallenge = await receiving.request('/v1/account/evm/sign-in/challenge', {
    purpose: 'login',
    chainId: 41,
    address: wallet.address,
  });
  assert.equal(loginChallenge.status, 200);
  const evm = EvmSignInChallengeSchema.parse(loginChallenge.body);
  const authenticated = await receiving.request('/v1/sign-in/evm', {
    id: evm.id,
    signature: await wallet.signMessage({ message: evm.message }),
  });
  assert.equal(authenticated.status, 200);
  const session = SessionSchema.parse(authenticated.body);
  receiving.csrf = session.csrfToken;
  assert.deepEqual(session.account, original.account);
  const settings = await receiving.request(RecoveryRoutes.recoveryMethods.path);
  assert.equal(settings.status, 200);
  const methods = RecoveryMethodsSchema.parse(settings.body);
  assert.equal(methods.configured, false);
  assert.ok(methods.methods.every((method) => method.mode === null));
  const recipient = await createRecoveryRecipient(),
    begin = await receiving.request(RecoveryRoutes.deviceRecoveryBegin.path, {
      recipient: recipient.publicKey,
    });
  assert.equal(begin.status, 200);
  const incoming = RecoveryRoutes.deviceRecoveryBegin.response.parse(begin.body);
  const payload = await sealDeviceRecovery(secrets, incoming.request),
    approval = { id: incoming.request.id, fingerprint: incoming.request.fingerprint, payload };
  assert.equal(
    (await source.request(RecoveryRoutes.deviceRecoveryApprove.path, approval)).status,
    403,
  );
  assert.equal(
    (await controlled(source, signing, RecoveryRoutes.deviceRecoveryApprove.path, approval)).status,
    200,
  );
  const request = { id: incoming.request.id, pollToken: incoming.pollToken };
  const received = await receiving.request(RecoveryRoutes.deviceRecoveryPoll.path, request);
  assert.equal(received.status, 200);
  const delivered = RecoveryRoutes.deviceRecoveryPoll.response.parse(received.body);
  assert.ok(delivered.payload);
  const restored = await openDeviceRecovery(
    delivered.payload,
    recipient.privateKey,
    delivered.request,
  );
  assert.ok(isDeepStrictEqual(restored, secrets), 'Original keys did not match');
  const epoch = randomBytes(32),
    oldGrant = await sealRecoveryDelivery(
      epoch,
      encryption.publicKey,
      'daclify.public-device-probe.v1',
    );
  const oldKey = await openRecoveryDelivery(
    oldGrant,
    restored.encryptionPrivateKey,
    'daclify.public-device-probe.v1',
  );
  assert.ok(
    isDeepStrictEqual(oldKey, Uint8Array.from(epoch)),
    'Surviving private grant did not open',
  );
  oldKey.fill(0);
  epoch.fill(0);
  assert.equal(
    (await receiving.request(RecoveryRoutes.deviceRecoveryPoll.path, request)).status,
    401,
  );
  const password = 'Disposable public device ' + crypto.randomUUID();
  const kit = RecoveryKitSchema.parse({
    version: 1,
    signingPublicKey: identity.signingKey,
    encryptionPublicKey: identity.encryptionKey,
    localEnvelope: await protect(secrets, password),
    recoveryEnvelope: await protect(secrets, randomBytes(32).toString('base64url')),
  });
  await writeFile(
    path,
    JSON.stringify({
      version: 1,
      api,
      origin,
      account: session.account,
      password,
      kit,
      receivingCookies: [...receiving.cookies].map(([name, value]) => ({ name, value })),
      csrf: session.csrfToken,
    }),
    { mode: 0o600, flag: 'wx' },
  );
  fixtureWritten = true;
  console.log(
    'Public testnet HTTP: real paired EVM proof preserved identity; original keys and surviving P-256 grant recovered once; old-session approval and replay denied; hosted recovery remains disabled.',
  );
} catch {
  process.exitCode = 1;
  console.error(
    'PUBLIC_DEVICE_PROBE_FAILED: inspect the testnet service, without logging the private fixture.',
  );
} finally {
  if (source.csrf) await source.request(ApiRoutes.logout.path, {}).catch(() => {});
  if (!fixtureWritten && receiving.csrf)
    await receiving.request(ApiRoutes.logout.path, {}).catch(() => {});
}
