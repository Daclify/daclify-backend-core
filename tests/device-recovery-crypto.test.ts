import { expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import {
  createRecoveryRecipient,
  sealDeviceRecovery,
  openDeviceRecovery,
  recoveryDeviceFingerprint,
} from '../sdk/recovery.js';
import { DeviceRecoveryRequestSchema } from '../protocol/recovery.js';
it('moves both original keys only to the exact recipient of an unexpired approval request', async () => {
  const signing = PrivateKey.generate('K1'),
    encryption = await createRecoveryRecipient(),
    recipient = await createRecoveryRecipient(),
    other = await createRecoveryRecipient();
  const keys = { signingKey: signing.toString(), encryptionPrivateKey: encryption.privateKey };
  const request = DeviceRecoveryRequestSchema.parse({
    version: 1,
    id: crypto.randomUUID(),
    accountId: crypto.randomUUID(),
    origin: 'https://app.example.test',
    recipient: recipient.publicKey,
    fingerprint: await recoveryDeviceFingerprint(recipient.publicKey),
    signingPublicKey: signing.toPublic().toString(),
    encryptionPublicKey: encryption.publicKey,
    expires: new Date(Date.now() + 300000).toISOString(),
  });
  const payload = await sealDeviceRecovery(keys, request);
  expect(JSON.stringify(payload)).not.toContain(keys.signingKey);
  expect(await openDeviceRecovery(payload, recipient.privateKey, request)).toEqual(keys);
  await expect(openDeviceRecovery(payload, other.privateKey, request)).rejects.toThrow();
  await expect(
    openDeviceRecovery(payload, recipient.privateKey, { ...request, id: crypto.randomUUID() }),
  ).rejects.toThrow();
  const expired = { ...request, expires: new Date(Date.now() - 1000).toISOString() };
  await expect(sealDeviceRecovery(keys, expired)).rejects.toThrow('RECOVERY_DEVICE_EXPIRED');
  await expect(openDeviceRecovery(payload, recipient.privateKey, expired)).rejects.toThrow(
    'RECOVERY_DEVICE_EXPIRED',
  );
});
