import { describe, expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import {
  RecoveryBackupSchema,
  RecoveryEnrollSchema,
  RecoveryClaimSchema,
  recoverySigningMessage,
} from '../protocol/recovery.js';

const context = {
  version: 1,
  id: '20000000-0000-4000-8000-000000000001',
  accountId: '20000000-0000-4000-8000-000000000002',
  origin: 'https://app.example.test',
  credentialKey: 'evm:41:0x' + '12'.repeat(20),
  mode: 'wallet-protected',
  signingPublicKey: PrivateKey.generate('K1').toPublic().toString(),
  encryptionPublicKey: { kty: 'EC', crv: 'P-256', x: 'a'.repeat(43), y: 'b'.repeat(43) },
  salt: Buffer.alloc(32, 1).toString('base64'),
};
const envelope = {
  version: 1,
  algorithm: 'AES-256-GCM',
  iv: Buffer.alloc(12, 2).toString('base64'),
  ciphertext: Buffer.alloc(48, 3).toString('base64'),
};

describe('encrypted vault recovery protocol', () => {
  it('accepts a bounded encrypted backup without any original private key fields', () => {
    const record = { context, envelope, keyWrap: { kind: 'client', envelope } };
    expect(RecoveryBackupSchema.parse(record)).toEqual(record);
    expect(RecoveryBackupSchema.safeParse({ ...record, signingKey: 'private' }).success).toBe(
      false,
    );
    expect(
      RecoveryEnrollSchema.safeParse({ context, envelope, clientKeyWrap: envelope }).success,
    ).toBe(true);
  });

  it('rejects malformed ciphertext, noncanonical encodings and unsafe application origins', () => {
    for (const patch of [
      { iv: 'AAAA' },
      { ciphertext: '!!!' },
      { ciphertext: Buffer.alloc(20_000).toString('base64') },
    ])
      expect(
        RecoveryBackupSchema.safeParse({
          context,
          envelope: { ...envelope, ...patch },
          keyWrap: { kind: 'client', envelope },
        }).success,
      ).toBe(false);
    expect(
      RecoveryBackupSchema.safeParse({
        context: { ...context, origin: 'http://remote.example' },
        envelope,
        keyWrap: { kind: 'client', envelope },
      }).success,
    ).toBe(false);
  });

  it('does not accept a client wrap as assisted enrollment or assume assisted consent', () => {
    expect(
      RecoveryEnrollSchema.safeParse({
        context: { ...context, mode: 'daclify-assisted' },
        envelope,
        clientKeyWrap: envelope,
      }).success,
    ).toBe(false);
    expect(
      RecoveryBackupSchema.safeParse({
        context: { ...context, mode: 'daclify-assisted' },
        envelope,
        keyWrap: { kind: 'client', envelope },
      }).success,
    ).toBe(false);
  });

  it('requires a fresh opaque grant and a public receiving key for claims', () => {
    expect(
      RecoveryClaimSchema.safeParse({
        grant: 'a'.repeat(43),
        recipient: context.encryptionPublicKey,
      }).success,
    ).toBe(true);
    expect(RecoveryClaimSchema.safeParse({ recipient: context.encryptionPublicKey }).success).toBe(
      false,
    );
    expect(
      RecoveryClaimSchema.safeParse({
        grant: 'a'.repeat(43),
        recipient: { ...context.encryptionPublicKey, d: 'c'.repeat(43) },
      }).success,
    ).toBe(false);
  });

  it('binds the private signing request to the backup, account, site and paired credential', () => {
    const message = recoverySigningMessage(context);
    expect(message).toContain('Keep this signature private');
    for (const patch of [
      { accountId: '20000000-0000-4000-8000-000000000003' },
      { origin: 'https://other.example.test' },
      { id: '20000000-0000-4000-8000-000000000004' },
      { credentialKey: 'evm:41:0x' + '34'.repeat(20) },
    ])
      expect(recoverySigningMessage({ ...context, ...patch })).not.toBe(message);
    expect(recoverySigningMessage({ ...context })).toBe(message);
  });
});
