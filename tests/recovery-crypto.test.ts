import { beforeAll, describe, expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import {
  createRecoveryBackup,
  openRecoveryBackup,
  sealRecoveryDelivery,
  openRecoveryDelivery,
  recoveryMaterialFromSignature,
} from '../sdk/recovery.js';
import {
  EncryptionPrivateKeySchema,
  EncryptionPublicKeySchema,
  VaultSecretsSchema,
  type VaultSecrets,
} from '../protocol/crypto.js';
import {
  RecoveryBackupSchema,
  RecoveryContextSchema,
  RecoveryKeyGrantSchema,
  type RecoveryContext,
} from '../protocol/recovery.js';

let secrets: VaultSecrets;
let context: RecoveryContext;
const material = crypto.getRandomValues(new Uint8Array(32));
beforeAll(async () => {
  const signing = PrivateKey.generate('K1');
  const encryption = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const privateJwk = await crypto.subtle.exportKey('jwk', encryption.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', encryption.publicKey);
  const encryptionPrivateKey = EncryptionPrivateKeySchema.parse({
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
    d: privateJwk.d,
  });
  const encryptionPublicKey = EncryptionPublicKeySchema.parse({
    kty: publicJwk.kty,
    crv: publicJwk.crv,
    x: publicJwk.x,
    y: publicJwk.y,
  });
  secrets = { signingKey: signing.toString(), encryptionPrivateKey };
  context = RecoveryContextSchema.parse({
    version: 1,
    id: crypto.randomUUID(),
    accountId: crypto.randomUUID(),
    origin: 'https://app.example.test',
    credentialKey: 'evm:41:0x' + '12'.repeat(20),
    mode: 'wallet-protected',
    signingPublicKey: signing.toPublic().toString(),
    encryptionPublicKey,
    salt: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  });
});

describe('original vault key recovery', () => {
  it('preserves both original secrets while exposing only ciphertext in a backup', async () => {
    const record = RecoveryBackupSchema.parse(
      await createRecoveryBackup(secrets, context, material),
    );
    expect(VaultSecretsSchema.parse(await openRecoveryBackup(record, material))).toEqual(secrets);
    expect(JSON.stringify(record)).not.toContain(secrets.signingKey);
    expect(JSON.stringify(record)).not.toContain(secrets.encryptionPrivateKey.d);
  });
  it('uses fresh nonces and a fresh backup key for successive encryption', async () => {
    const first = RecoveryBackupSchema.parse(
      await createRecoveryBackup(secrets, context, material),
    );
    const second = RecoveryBackupSchema.parse(
      await createRecoveryBackup(secrets, context, material),
    );
    expect(first.envelope.iv).not.toBe(second.envelope.iv);
    expect(first.envelope.ciphertext).not.toBe(second.envelope.ciphertext);
    expect(first.keyWrap).not.toEqual(second.keyWrap);
  });
  it('rejects a different credential secret, substituted account and tampered ciphertext', async () => {
    const record = RecoveryBackupSchema.parse(
      await createRecoveryBackup(secrets, context, material),
    );
    await expect(
      openRecoveryBackup(record, crypto.getRandomValues(new Uint8Array(32))),
    ).rejects.toThrow();
    await expect(
      openRecoveryBackup(
        { ...record, context: { ...context, accountId: crypto.randomUUID() } },
        material,
      ),
    ).rejects.toThrow();
    await expect(
      openRecoveryBackup(
        {
          ...record,
          envelope: {
            ...record.envelope,
            ciphertext:
              (record.envelope.ciphertext[0] === 'A' ? 'B' : 'A') +
              record.envelope.ciphertext.slice(1),
          },
        },
        material,
      ),
    ).rejects.toThrow();
  });
  it('rejects private keys that do not match the declared signing or encryption identity', async () => {
    await expect(
      createRecoveryBackup(
        { ...secrets, signingKey: PrivateKey.generate('K1').toString() },
        context,
        material,
      ),
    ).rejects.toThrow();
    const other = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const jwk = await crypto.subtle.exportKey('jwk', other.privateKey);
    if (!jwk.d) throw new Error('Private-key fixture missing');
    await expect(
      createRecoveryBackup(
        { ...secrets, encryptionPrivateKey: { ...secrets.encryptionPrivateKey, d: jwk.d } },
        context,
        material,
      ),
    ).rejects.toThrow();
  });
  it('delivers a backup key only to the intended receiving device and domain', async () => {
    const first = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const second = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const pub = await crypto.subtle.exportKey('jwk', first.publicKey);
    const priv = await crypto.subtle.exportKey('jwk', first.privateKey);
    const wrong = await crypto.subtle.exportKey('jwk', second.privateKey);
    const recipient = EncryptionPublicKeySchema.parse({
      kty: pub.kty,
      crv: pub.crv,
      x: pub.x,
      y: pub.y,
    });
    const privateKey = EncryptionPrivateKeySchema.parse({
      kty: priv.kty,
      crv: priv.crv,
      x: priv.x,
      y: priv.y,
      d: priv.d,
    });
    const wrongKey = EncryptionPrivateKeySchema.parse({
      kty: wrong.kty,
      crv: wrong.crv,
      x: wrong.x,
      y: wrong.y,
      d: wrong.d,
    });
    const grant = RecoveryKeyGrantSchema.parse(
      await sealRecoveryDelivery(material, recipient, 'device-request:fixture-1'),
    );
    expect(await openRecoveryDelivery(grant, privateKey, 'device-request:fixture-1')).toEqual(
      material,
    );
    await expect(
      openRecoveryDelivery(grant, wrongKey, 'device-request:fixture-1'),
    ).rejects.toThrow();
    await expect(
      openRecoveryDelivery(grant, privateKey, 'device-request:fixture-2'),
    ).rejects.toThrow();
  });
  it('normalizes equivalent EVM recovery parity and rejects invalid signature encodings', () => {
    const prefix = '0x' + '11'.repeat(32) + '22'.repeat(32);
    expect(recoveryMaterialFromSignature(prefix + '00')).toEqual(
      recoveryMaterialFromSignature(prefix + '1b'),
    );
    expect(() => recoveryMaterialFromSignature(prefix + '7f')).toThrow();
    expect(() => recoveryMaterialFromSignature('SIG_K1_' + 'A'.repeat(90))).toThrow();
  });
});
