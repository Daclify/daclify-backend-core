import { split, combine } from 'shamir-secret-sharing';
import { ABI, Checksum256, Serializer } from '@wharfkit/antelope';
import { runtimeAbi, type contact_proof, type contact_request } from './generated/runtime.js';
import { RuntimeActionSchemas } from './generated/schemas.js';
import { z } from 'zod';
import {
  ContactPacketContextSchema,
  ContactDocumentPacketSchema,
  ContactDocumentShareSchema,
  ContactEpochSecretsSchema,
  RecoveryContactsSchema,
  ContactShareDeliveryContextSchema,
  ContactShareDeliverySchema,
  type ContactDocumentPacket,
  type ContactDocumentShare,
  type ContactEpochSecret,
  type ContactShareDeliveryContext,
  type ContactShareDelivery,
} from '../protocol/contact-recovery.js';
import { EncryptionPrivateKeySchema, type EncryptionPrivateKey } from '../protocol/crypto.js';
import {
  sealRecoveryData,
  openRecoveryData,
  sealRecoveryBytes,
  openRecoveryBytes,
} from './recovery.js';

const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const decode = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const text = new TextEncoder();
export function contactRecoveryDigest(proof: contact_proof): Checksum256 {
  return Checksum256.hash(
    Serializer.encode({
      abi: ABI.from(runtimeAbi),
      type: 'contact_proof',
      object: RuntimeActionSchemas.acceptcont.shape.proof.parse(proof),
    }),
  );
}
export function contactRequestCommitment(request: contact_request): Checksum256 {
  return Checksum256.hash(
    Serializer.encode({
      abi: ABI.from(runtimeAbi),
      type: 'contact_request',
      object: RuntimeActionSchemas.startrecover.shape.request.parse(request),
    }),
  );
}
export function contactGrantLookup(memberId: string, requestId: string, epoch: string): string {
  const values = [memberId, requestId, epoch].map(
    (object) => Serializer.encode({ type: 'uint64', object }).array,
  );
  return Checksum256.hash(Uint8Array.from(values.flatMap((value) => Array.from(value)))).toString();
}
export type {
  contact_proof as ContactRecoveryProof,
  contact_request as ContactRecoveryRequest,
} from './generated/runtime.js';
const hash = async (value: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(value).buffer)),
    (v) => v.toString(16).padStart(2, '0'),
  ).join('');
const contextDomain = async (context: ContactDocumentPacket['context']) =>
  'daclify.contact.documents.v1:' +
  (await hash(text.encode(JSON.stringify(ContactPacketContextSchema.parse(context)))));

async function verifiedEpochs(input: unknown): Promise<ContactEpochSecret[]> {
  const epochs = ContactEpochSecretsSchema.parse(input);
  for (const epoch of epochs) {
    const key = decode(epoch.key);
    try {
      if ((await hash(key)) !== epoch.commitment) throw new Error('EPOCH_KEY_MISMATCH');
    } finally {
      key.fill(0);
    }
  }
  return epochs;
}
export async function contactPacketCommitment(input: ContactDocumentPacket): Promise<string> {
  return hash(text.encode(JSON.stringify(ContactDocumentPacketSchema.parse(input))));
}
export async function createContactDocumentPacket(
  input: Pick<ContactDocumentPacket['context'], 'target' | 'revision' | 'packetId'>,
  values: unknown,
  identities: unknown,
): Promise<ContactDocumentPacket> {
  const epochs = await verifiedEpochs(values),
    contacts = RecoveryContactsSchema.parse(identities);
  const context = ContactPacketContextSchema.parse({
    ...input,
    contacts,
    epochs: epochs.map(({ epoch, commitment }) => ({ epoch, commitment })),
  });
  const domain = await contextDomain(context),
    key = crypto.getRandomValues(new Uint8Array(32));
  const plaintext = text.encode(JSON.stringify(epochs));
  let shares: Uint8Array[] = [];
  try {
    shares = await split(key, 3, 2);
    const encrypted = [];
    for (const [index, contact] of contacts.entries()) {
      const share = shares[index];
      if (!share) throw new Error('CONTACT_SHARE_INVALID');
      encrypted.push(
        await sealRecoveryBytes(share, contact.encryptionKey, domain + ':share:' + index),
      );
    }
    return ContactDocumentPacketSchema.parse({
      version: 1,
      context,
      envelope: await sealRecoveryData(plaintext, key, domain),
      shares: encrypted,
    });
  } finally {
    key.fill(0);
    plaintext.fill(0);
    for (const share of shares) share.fill(0);
  }
}
export async function openContactDocumentShare(
  input: ContactDocumentPacket,
  index: number,
  privateKey: EncryptionPrivateKey,
): Promise<ContactDocumentShare> {
  const packet = ContactDocumentPacketSchema.parse(input),
    recipient = EncryptionPrivateKeySchema.parse(privateKey);
  const selected = z.int().min(0).max(2).parse(index),
    contact = packet.context.contacts[selected],
    grant = packet.shares[selected];
  if (
    !contact ||
    !grant ||
    contact.encryptionKey.x !== recipient.x ||
    contact.encryptionKey.y !== recipient.y
  )
    throw new Error('CONTACT_IDENTITY_MISMATCH');
  const share = await openRecoveryBytes(
    grant,
    recipient,
    (await contextDomain(packet.context)) + ':share:' + selected,
  );
  try {
    return ContactDocumentShareSchema.parse({
      packetCommitment: await contactPacketCommitment(packet),
      index: selected,
      share: encode(share),
    });
  } finally {
    share.fill(0);
  }
}
export async function recoverContactDocumentPacket(
  input: ContactDocumentPacket,
  values: unknown,
): Promise<ContactEpochSecret[]> {
  const packet = ContactDocumentPacketSchema.parse(input);
  const shares = z.array(ContactDocumentShareSchema).min(2).max(3).parse(values),
    commitment = await contactPacketCommitment(packet);
  if (
    new Set(shares.map((s) => s.index)).size !== shares.length ||
    shares.some((s) => s.packetCommitment !== commitment)
  )
    throw new Error('CONTACT_SHARE_MISMATCH');
  const decoded = shares.map((s) => decode(s.share));
  let key: Uint8Array | undefined, plaintext: Uint8Array | undefined;
  try {
    key = await combine(decoded);
    plaintext = await openRecoveryData(packet.envelope, key, await contextDomain(packet.context));
    const epochs = await verifiedEpochs(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)),
    );
    if (
      JSON.stringify(epochs.map(({ epoch, commitment: c }) => ({ epoch, commitment: c }))) !==
      JSON.stringify(packet.context.epochs)
    )
      throw new Error('CONTACT_EPOCH_MISMATCH');
    return epochs;
  } finally {
    key?.fill(0);
    plaintext?.fill(0);
    for (const value of decoded) value.fill(0);
  }
}
const deliveryDomain = (input: ContactShareDeliveryContext) =>
  'daclify.contact.share.v1:' + JSON.stringify(ContactShareDeliveryContextSchema.parse(input));
export async function sealContactDocumentShare(
  input: ContactDocumentShare,
  value: ContactShareDeliveryContext,
): Promise<ContactShareDelivery> {
  const share = ContactDocumentShareSchema.parse(input),
    context = ContactShareDeliveryContextSchema.parse(value);
  if (share.packetCommitment !== context.packetCommitment)
    throw new Error('CONTACT_SHARE_MISMATCH');
  const bytes = text.encode(JSON.stringify(share));
  try {
    return ContactShareDeliverySchema.parse({
      version: 1,
      context,
      payload: await sealRecoveryBytes(bytes, context.recipient, deliveryDomain(context)),
    });
  } finally {
    bytes.fill(0);
  }
}
export async function openContactShareDelivery(
  input: ContactShareDelivery,
  value: ContactShareDeliveryContext,
  privateKey: EncryptionPrivateKey,
): Promise<ContactDocumentShare> {
  const delivery = ContactShareDeliverySchema.parse(input),
    context = ContactShareDeliveryContextSchema.parse(value);
  if (JSON.stringify(delivery.context) !== JSON.stringify(context))
    throw new Error('CONTACT_SHARE_MISMATCH');
  const bytes = await openRecoveryBytes(delivery.payload, privateKey, deliveryDomain(context));
  try {
    const share = ContactDocumentShareSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
    if (share.packetCommitment !== context.packetCommitment)
      throw new Error('CONTACT_SHARE_MISMATCH');
    return share;
  } finally {
    bytes.fill(0);
  }
}
