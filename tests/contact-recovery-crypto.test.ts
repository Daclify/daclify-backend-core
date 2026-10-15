import { beforeAll, describe, expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { combine } from 'shamir-secret-sharing';
import { createRecoveryRecipient } from '../sdk/recovery.js';
import {
  createContactDocumentPacket,
  openContactDocumentShare,
  recoverContactDocumentPacket,
  contactPacketCommitment,
  sealContactDocumentShare,
  openContactShareDelivery,
} from '../sdk/contact-recovery.js';
import {
  ContactDocumentPacketSchema,
  ContactIdentitySchema,
  ContactRecoveryTargetSchema,
  type ContactDocumentPacket,
  type ContactEpochSecret,
} from '../protocol/contact-recovery.js';

const target = {
  dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
  memberId: '1',
} as const;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
let recipients: Awaited<ReturnType<typeof createRecoveryRecipient>>[];
let contacts: { signingKey: string; encryptionKey: (typeof recipients)[number]['publicKey'] }[];
let epochs: ContactEpochSecret[];
let packet: ContactDocumentPacket;

beforeAll(async () => {
  recipients = await Promise.all([1, 2, 3].map(() => createRecoveryRecipient()));
  contacts = recipients.map((recipient) => ({
    signingKey: PrivateKey.generate('K1').toPublic().toString(),
    encryptionKey: recipient.publicKey,
  }));
  const key = crypto.getRandomValues(new Uint8Array(32));
  const commitment = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', key)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
  epochs = [{ epoch: '1', key: encode(key), commitment }];
  packet = await createContactDocumentPacket(
    { target, revision: '1', packetId: '1' },
    epochs,
    contacts,
  );
});

describe('DAO-scoped contact document recovery', () => {
  it('rejects alternate encodings of the same public encryption key', () => {
    const contact = contacts[0];
    if (!contact) throw new Error('CONTACT_FIXTURE');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const coordinate = contact.encryptionKey.x;
    const last = alphabet.indexOf(coordinate.slice(-1));
    const alias = {
      ...contact,
      encryptionKey: { ...contact.encryptionKey, x: coordinate.slice(0, -1) + alphabet[last + 1] },
    };
    expect(Buffer.from(alias.encryptionKey.x, 'base64url')).toEqual(
      Buffer.from(coordinate, 'base64url'),
    );
    expect(ContactIdentitySchema.safeParse(alias).success).toBe(false);
  });
  it('matches an independent linear-polynomial GF(256) reconstruction vector', async () => {
    const a = new Uint8Array(33).fill(0x43),
      b = new Uint8Array(33).fill(0x40);
    a[32] = 1;
    b[32] = 2;
    expect(await combine([a, b])).toEqual(new Uint8Array(32).fill(0x42));
  });
  it('restores the same covered keys with any two of three contacts', async () => {
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (a === undefined || b === undefined) throw new Error('PAIR_FIXTURE');
      const first = recipients[a],
        second = recipients[b];
      if (!first || !second) throw new Error('CONTACT_FIXTURE');
      const shares = await Promise.all([
        openContactDocumentShare(packet, a, first.privateKey),
        openContactDocumentShare(packet, b, second.privateKey),
      ]);
      expect(await recoverContactDocumentPacket(packet, shares)).toEqual(epochs);
    }
  });
  it('rejects one share and duplicate shares', async () => {
    const recipient = recipients[0];
    if (!recipient) throw new Error('CONTACT_FIXTURE');
    const share = await openContactDocumentShare(packet, 0, recipient.privateKey);
    await expect(recoverContactDocumentPacket(packet, [share])).rejects.toThrow();
    await expect(recoverContactDocumentPacket(packet, [share, share])).rejects.toThrow();
  });
  it('rejects duplicate identities, false commitments and secret-shaped extra input', async () => {
    await expect(
      createContactDocumentPacket({ target, revision: '1', packetId: '1' }, epochs, [
        contacts[0],
        contacts[0],
        contacts[2],
      ]),
    ).rejects.toThrow();
    await expect(
      createContactDocumentPacket(
        { target, revision: '1', packetId: '1' },
        epochs.map((e) => ({ ...e, commitment: '00'.repeat(32) })),
        contacts,
      ),
    ).rejects.toThrow();
    expect(ContactRecoveryTargetSchema.safeParse({ ...target, signingKey: 'secret' }).success).toBe(
      false,
    );
    expect(
      ContactDocumentPacketSchema.safeParse({ ...packet, encryptionPrivateKey: 'secret' }).success,
    ).toBe(false);
    const serialized = JSON.stringify(packet);
    for (const recipient of recipients) expect(serialized).not.toContain(recipient.privateKey.d);
    for (const epoch of epochs) expect(serialized).not.toContain(epoch.key);
    expect(new TextEncoder().encode(serialized).length).toBeLessThanOrEqual(16384);
  });
  it('binds shares and ciphertext to the exact DAO and policy revision', async () => {
    const first = recipients[0],
      second = recipients[1];
    if (!first || !second) throw new Error('CONTACT_FIXTURE');
    const shares = await Promise.all([
      openContactDocumentShare(packet, 0, first.privateKey),
      openContactDocumentShare(packet, 1, second.privateKey),
    ]);
    const changed = structuredClone(packet);
    changed.context.target.dao.daoId = '2';
    await expect(recoverContactDocumentPacket(changed, shares)).rejects.toThrow();
    await expect(openContactDocumentShare(changed, 0, first.privateKey)).rejects.toThrow();
    const changedRevision = structuredClone(packet);
    changedRevision.context.revision = '2';
    await expect(recoverContactDocumentPacket(changedRevision, shares)).rejects.toThrow();
    await expect(openContactDocumentShare(packet, 0, second.privateKey)).rejects.toThrow();
    const corrupt = structuredClone(packet);
    corrupt.envelope.ciphertext =
      (corrupt.envelope.ciphertext[0] === 'A' ? 'B' : 'A') + corrupt.envelope.ciphertext.slice(1);
    await expect(recoverContactDocumentPacket(corrupt, shares)).rejects.toThrow();
  });
  it('delivers a share only to the selected replacement device and request', async () => {
    const sender = recipients[0];
    if (!sender) throw new Error('CONTACT_FIXTURE');
    const receiver = await createRecoveryRecipient();
    const share = await openContactDocumentShare(packet, 0, sender.privateKey);
    const context = {
      target,
      requestId: '1',
      packetCommitment: await contactPacketCommitment(packet),
      recipient: receiver.publicKey,
    };
    const delivery = await sealContactDocumentShare(share, context);
    expect(await openContactShareDelivery(delivery, context, receiver.privateKey)).toEqual(share);
    await expect(
      openContactShareDelivery(delivery, { ...context, requestId: '2' }, receiver.privateKey),
    ).rejects.toThrow();
    await expect(openContactShareDelivery(delivery, context, sender.privateKey)).rejects.toThrow();
    expect(JSON.stringify(delivery)).not.toContain(share.share);
  });
});
