import { PrivateKey, Signature } from '@wharfkit/antelope';
import { canonicalEvmSignature } from './evm.js';
import {
  EncryptionPrivateKeySchema,
  EncryptionPublicKeySchema,
  VaultSecretsSchema,
  type EncryptionPrivateKey,
  type EncryptionPublicKey,
  type VaultSecrets,
} from '../protocol/crypto.js';
import {
  RecoveryBackupSchema,
  RecoveryCipherSchema,
  RecoveryContextSchema,
  RecoveryKeyGrantSchema,
  RecoveryKeyCipherSchema,
  recoveryVaultDomain,
  type RecoveryBackup,
  type RecoveryCipher,
  type RecoveryContext,
  type RecoveryKeyGrant,
  RecoveryIdentitySchema,
  DeviceRecoveryRequestSchema,
  DeviceRecoveryPayloadSchema,
  deviceRecoveryDomain,
  type DeviceRecoveryRequest,
  type DeviceRecoveryPayload,
} from '../protocol/recovery.js';

const text = new TextEncoder();
const buffer = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;
const base64 = (value: Uint8Array): string => btoa(String.fromCharCode(...value));
const decode = (value: string): Uint8Array => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const decodeUrl = (value: string): Uint8Array =>
  decode(value.replaceAll('-', '+').replaceAll('_', '/'));

async function encrypt(
  data: Uint8Array,
  secret: Uint8Array,
  domain: string,
): Promise<RecoveryCipher> {
  if (secret.length !== 32 || data.length > 12272 || !domain) throw new Error('RECOVERY_INVALID');
  const key = await crypto.subtle.importKey('raw', buffer(secret), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(iv), additionalData: text.encode(domain) },
    key,
    buffer(data),
  );
  return RecoveryCipherSchema.parse({
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(encrypted)),
  });
}
async function decrypt(
  value: RecoveryCipher,
  secret: Uint8Array,
  domain: string,
): Promise<Uint8Array> {
  const envelope = RecoveryCipherSchema.parse(value);
  if (secret.length !== 32 || !domain) throw new Error('RECOVERY_INVALID');
  const key = await crypto.subtle.importKey('raw', buffer(secret), 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buffer(decode(envelope.iv)), additionalData: text.encode(domain) },
      key,
      buffer(decode(envelope.ciphertext)),
    ),
  );
}
async function hkdf(material: Uint8Array, salt: Uint8Array, domain: string): Promise<Uint8Array> {
  if (material.length < 32 || material.length > 256 || salt.length !== 32 || !domain)
    throw new Error('RECOVERY_INVALID');
  const key = await crypto.subtle.importKey('raw', buffer(material), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: buffer(salt), info: text.encode(domain) },
      key,
      256,
    ),
  );
}

export async function verifyRecoveryIdentity(
  input: unknown,
  identity: Pick<RecoveryContext, 'signingPublicKey' | 'encryptionPublicKey'>,
): Promise<VaultSecrets> {
  const secrets = VaultSecretsSchema.parse(input),
    context = RecoveryIdentitySchema.parse({
      signingPublicKey: identity.signingPublicKey,
      encryptionPublicKey: identity.encryptionPublicKey,
    });
  const privateKey = secrets.encryptionPrivateKey;
  if (
    PrivateKey.from(secrets.signingKey).toPublic().toString() !== context.signingPublicKey ||
    privateKey.x !== context.encryptionPublicKey.x ||
    privateKey.y !== context.encryptionPublicKey.y
  )
    throw new Error('RECOVERY_KEY_MISMATCH');
  // ECDH in both directions verifies that the private scalar matches the declared encryption key.
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits',
  ]);
  const own = await crypto.subtle.importKey(
    'jwk',
    privateKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const expected = await crypto.subtle.importKey(
    'jwk',
    context.encryptionPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const [first, second] = await Promise.all([
    crypto.subtle.deriveBits({ name: 'ECDH', public: pair.publicKey }, own, 256),
    crypto.subtle.deriveBits({ name: 'ECDH', public: expected }, pair.privateKey, 256),
  ]);
  let difference = 0;
  const a = new Uint8Array(first),
    b = new Uint8Array(second);
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  a.fill(0);
  b.fill(0);
  if (difference) throw new Error('RECOVERY_KEY_MISMATCH');
  return secrets;
}

export async function createRecoveryPayload(
  input: VaultSecrets,
  identity: RecoveryContext,
): Promise<{ envelope: RecoveryCipher; key: Uint8Array }> {
  const context = RecoveryContextSchema.parse(identity);
  const secrets = await verifyRecoveryIdentity(input, context);
  const key = crypto.getRandomValues(new Uint8Array(32));
  try {
    return {
      envelope: await encrypt(
        text.encode(JSON.stringify(secrets)),
        key,
        recoveryVaultDomain(context),
      ),
      key,
    };
  } catch (error) {
    key.fill(0);
    throw error;
  }
}
export async function openRecoveryPayload(
  record: RecoveryBackup,
  key: Uint8Array,
): Promise<VaultSecrets> {
  const backup = RecoveryBackupSchema.parse(record);
  const plaintext = await decrypt(backup.envelope, key, recoveryVaultDomain(backup.context));
  try {
    return await verifyRecoveryIdentity(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)),
      backup.context,
    );
  } finally {
    plaintext.fill(0);
  }
}
export async function createRecoveryBackup(
  input: VaultSecrets,
  identity: RecoveryContext,
  material: Uint8Array,
): Promise<RecoveryBackup> {
  const context = RecoveryContextSchema.parse(identity);
  if (context.mode === 'daclify-assisted') throw new Error('RECOVERY_WRAPPER_REQUIRED');
  const { envelope, key } = await createRecoveryPayload(input, context);
  let wrapping: Uint8Array | undefined;
  try {
    wrapping = await hkdf(material, decode(context.salt), recoveryVaultDomain(context) + ':wrap');
    const keyEnvelope = RecoveryKeyCipherSchema.parse(
      await encrypt(key, wrapping, recoveryVaultDomain(context) + ':key'),
    );
    return RecoveryBackupSchema.parse({
      context,
      envelope,
      keyWrap: { kind: 'client', envelope: keyEnvelope },
    });
  } finally {
    key.fill(0);
    wrapping?.fill(0);
  }
}
export async function openRecoveryBackup(
  record: RecoveryBackup,
  material: Uint8Array,
): Promise<VaultSecrets> {
  const backup = RecoveryBackupSchema.parse(record);
  if (backup.keyWrap.kind !== 'client') throw new Error('RECOVERY_WRAPPER_REQUIRED');
  const wrapping = await hkdf(
    material,
    decode(backup.context.salt),
    recoveryVaultDomain(backup.context) + ':wrap',
  );
  let key: Uint8Array | undefined;
  try {
    key = await decrypt(
      backup.keyWrap.envelope,
      wrapping,
      recoveryVaultDomain(backup.context) + ':key',
    );
    return await openRecoveryPayload(backup, key);
  } finally {
    wrapping.fill(0);
    key?.fill(0);
  }
}

export async function createRecoveryRecipient(): Promise<{
  publicKey: EncryptionPublicKey;
  privateKey: EncryptionPrivateKey;
}> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey),
    priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return {
    publicKey: EncryptionPublicKeySchema.parse({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }),
    privateKey: EncryptionPrivateKeySchema.parse({
      kty: priv.kty,
      crv: priv.crv,
      x: priv.x,
      y: priv.y,
      d: priv.d,
    }),
  };
}
async function deliveryKey(
  privateKey: EncryptionPrivateKey,
  publicKey: EncryptionPublicKey,
  salt: Uint8Array,
  domain: string,
): Promise<Uint8Array> {
  const own = await crypto.subtle.importKey(
    'jwk',
    EncryptionPrivateKeySchema.parse(privateKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const peer = await crypto.subtle.importKey(
    'jwk',
    EncryptionPublicKeySchema.parse(publicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, own, 256),
  );
  try {
    return await hkdf(shared, salt, 'daclify.recovery.delivery.v1:' + domain);
  } finally {
    shared.fill(0);
  }
}
export async function sealRecoveryDelivery(
  key: Uint8Array,
  recipient: EncryptionPublicKey,
  domain: string,
): Promise<RecoveryKeyGrant> {
  if (key.length !== 32) throw new Error('RECOVERY_INVALID');
  const ephemeral = await createRecoveryRecipient(),
    salt = crypto.getRandomValues(new Uint8Array(32));
  const wrapping = await deliveryKey(ephemeral.privateKey, recipient, salt, domain);
  try {
    return RecoveryKeyGrantSchema.parse({
      version: 1,
      ephemeralKey: ephemeral.publicKey,
      salt: base64(salt),
      envelope: await encrypt(key, wrapping, 'daclify.recovery.delivery.v1:' + domain),
    });
  } finally {
    wrapping.fill(0);
  }
}
export async function openRecoveryDelivery(
  input: RecoveryKeyGrant,
  recipient: EncryptionPrivateKey,
  domain: string,
): Promise<Uint8Array> {
  const grant = RecoveryKeyGrantSchema.parse(input);
  const wrapping = await deliveryKey(recipient, grant.ephemeralKey, decode(grant.salt), domain);
  try {
    const key = await decrypt(grant.envelope, wrapping, 'daclify.recovery.delivery.v1:' + domain);
    if (key.length !== 32) {
      key.fill(0);
      throw new Error('RECOVERY_INVALID');
    }
    return key;
  } finally {
    wrapping.fill(0);
  }
}
export function recoveryMaterialFromSignature(value: string): Uint8Array {
  if (/^0x[0-9a-fA-F]{130}$/.test(value))
    return Uint8Array.from(canonicalEvmSignature(value).slice(2).match(/../g) ?? [], (v) =>
      parseInt(v, 16),
    );
  if (/^SIG_[KR]1_[1-9A-HJ-NP-Za-km-z]{80,120}$/.test(value))
    return text.encode(Signature.from(value).toString());
  throw new Error('RECOVERY_SIGNATURE_INVALID');
}
export function recoveryPrfInput(): ArrayBuffer {
  return buffer(text.encode('daclify.passkey.vault-unlock.v1'));
}
export function recoveryBytes(value: string): Uint8Array {
  return decodeUrl(value);
}
export async function recoveryDeviceFingerprint(input: unknown): Promise<string> {
  const key = EncryptionPublicKeySchema.parse(input),
    digest = await crypto.subtle.digest('SHA-256', text.encode(JSON.stringify(key)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function sealDeviceRecovery(
  input: VaultSecrets,
  value: DeviceRecoveryRequest,
): Promise<DeviceRecoveryPayload> {
  const request = DeviceRecoveryRequestSchema.parse(value),
    domain = deviceRecoveryDomain(request);
  if (Date.parse(request.expires) <= Date.now()) throw new Error('RECOVERY_DEVICE_EXPIRED');
  if (request.fingerprint !== (await recoveryDeviceFingerprint(request.recipient)))
    throw new Error('RECOVERY_DEVICE_MISMATCH');
  const secrets = await verifyRecoveryIdentity(input, request),
    ephemeral = await createRecoveryRecipient(),
    salt = crypto.getRandomValues(new Uint8Array(32));
  const key = await deliveryKey(ephemeral.privateKey, request.recipient, salt, domain),
    plaintext = text.encode(JSON.stringify(secrets));
  try {
    return DeviceRecoveryPayloadSchema.parse({
      version: 1,
      ephemeralKey: ephemeral.publicKey,
      salt: base64(salt),
      envelope: await encrypt(plaintext, key, domain),
    });
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}
export async function openDeviceRecovery(
  input: DeviceRecoveryPayload,
  privateKey: EncryptionPrivateKey,
  value: DeviceRecoveryRequest,
): Promise<VaultSecrets> {
  const payload = DeviceRecoveryPayloadSchema.parse(input),
    request = DeviceRecoveryRequestSchema.parse(value),
    domain = deviceRecoveryDomain(request);
  if (Date.parse(request.expires) <= Date.now()) throw new Error('RECOVERY_DEVICE_EXPIRED');
  const recipient = EncryptionPrivateKeySchema.parse(privateKey);
  if (
    recipient.x !== request.recipient.x ||
    recipient.y !== request.recipient.y ||
    request.fingerprint !== (await recoveryDeviceFingerprint(request.recipient))
  )
    throw new Error('RECOVERY_DEVICE_MISMATCH');
  const key = await deliveryKey(recipient, payload.ephemeralKey, decode(payload.salt), domain);
  let bytes: Uint8Array | undefined;
  try {
    bytes = await decrypt(payload.envelope, key, domain);
    return await verifyRecoveryIdentity(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
      request,
    );
  } finally {
    key.fill(0);
    bytes?.fill(0);
  }
}
