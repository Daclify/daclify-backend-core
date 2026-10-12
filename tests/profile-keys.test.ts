import { beforeAll, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRecoveryRecipient, openRecoveryDelivery } from '../sdk/recovery.js';
import {
  sealProfileKey,
  openProfileKey,
  profileCiphertextCommitment,
  encryptProfile,
  decryptProfile,
} from '../sdk/profiles.js';
import {
  ProfileContextSchema,
  ProfileKeyGrantSchema,
  ProfileShareSchema,
} from '../protocol/profiles.js';
import { epochGrantDomain } from '../protocol/content.js';
let owner: Awaited<ReturnType<typeof createRecoveryRecipient>>;
let recipient: Awaited<ReturnType<typeof createRecoveryRecipient>>;
const context = ProfileContextSchema.parse({
  version: 2,
  chainId: 'ab'.repeat(32),
  runtime: 'daclifycore',
  daoId: '18446744073709551615',
  memberId: '18446744073709551615',
  profileRevision: randomUUID(),
});
const secret = Uint8Array.from(randomBytes(32));
beforeAll(async () => {
  owner = await createRecoveryRecipient();
  recipient = await createRecoveryRecipient();
});
async function profile() {
  const cipher = await encryptProfile(
    new TextEncoder().encode('synthetic private profile'),
    secret,
    context,
  );
  return { cipher, commitment: await profileCiphertextCommitment(cipher) };
}
it('seals an independent profile key to exactly its selected recipient and committed cipher', async () => {
  const { cipher, commitment } = await profile();
  const grant = await sealProfileKey(secret, owner.publicKey, context, commitment);
  const opened = await openProfileKey(grant, owner.privateKey, context, commitment);
  expect(opened).toEqual(secret);
  expect(new TextDecoder().decode(await decryptProfile(cipher, opened, context))).toBe(
    'synthetic private profile',
  );
  await expect(openProfileKey(grant, recipient.privateKey, context, commitment)).rejects.toThrow(
    'PROFILE_KEY_CONTEXT',
  );
  expect(JSON.stringify(grant)).not.toContain(Buffer.from(secret).toString('base64'));
});
it('rejects DAO/member/revision, ciphertext and declared audience substitutions', async () => {
  const { commitment } = await profile();
  const grant = await sealProfileKey(secret, owner.publicKey, context, commitment);
  for (const other of [
    { ...context, chainId: 'cd'.repeat(32) },
    { ...context, runtime: 'otherdao' },
    { ...context, daoId: '1' },
    { ...context, memberId: '1' },
    { ...context, profileRevision: randomUUID() },
  ])
    await expect(openProfileKey(grant, owner.privateKey, other, commitment)).rejects.toThrow(
      'PROFILE_KEY_CONTEXT',
    );
  await expect(openProfileKey(grant, owner.privateKey, context, '00'.repeat(32))).rejects.toThrow(
    'PROFILE_KEY_CONTEXT',
  );
  await expect(
    openProfileKey(
      { ...grant, recipientEncryptionKey: recipient.publicKey },
      recipient.privateKey,
      context,
      commitment,
    ),
  ).rejects.toThrow('PROFILE_KEY_DECRYPTION');
});
it('uses a separate profile domain even though the wrapped-key shape matches DAO grants', async () => {
  const { commitment } = await profile();
  const grant = await sealProfileKey(secret, owner.publicKey, context, commitment);
  const dao = {
    chainId: context.chainId,
    contract: context.runtime,
    daoId: context.daoId,
    interfaceVersion: 1 as const,
  };
  await expect(
    openRecoveryDelivery(
      grant.grant,
      owner.privateKey,
      epochGrantDomain(dao, '1', context.memberId),
    ),
  ).rejects.toThrow();
});
it('bounds canonical salt, IV, wrapped-key bytes and the complete recipient list', async () => {
  const { commitment } = await profile();
  const grant = await sealProfileKey(secret, owner.publicKey, context, commitment);
  expect(ProfileKeyGrantSchema.parse(grant)).toEqual(grant);
  for (const wrong of [
    { ...grant, grant: { ...grant.grant, salt: Buffer.alloc(31).toString('base64') } },
    {
      ...grant,
      grant: {
        ...grant.grant,
        envelope: { ...grant.grant.envelope, iv: Buffer.alloc(11).toString('base64') },
      },
    },
    {
      ...grant,
      grant: {
        ...grant.grant,
        envelope: { ...grant.grant.envelope, ciphertext: Buffer.alloc(49).toString('base64') },
      },
    },
  ])
    expect(ProfileKeyGrantSchema.safeParse(wrong).success).toBe(false);
  expect(
    ProfileShareSchema.safeParse({ context, grants: Array.from({ length: 65 }, () => grant) })
      .success,
  ).toBe(false);
  expect(ProfileShareSchema.safeParse({ context, grants: [grant, grant] }).success).toBe(false);
});
it('commits every authenticated cipher field and produces independent ephemeral wraps', async () => {
  const { cipher, commitment } = await profile();
  expect(
    await profileCiphertextCommitment({
      ...cipher,
      context: { ...context, profileRevision: randomUUID() },
    }),
  ).not.toBe(commitment);
  const first = await sealProfileKey(secret, owner.publicKey, context, commitment);
  const second = await sealProfileKey(secret, owner.publicKey, context, commitment);
  expect(first.grant.ephemeralKey).not.toEqual(second.grant.ephemeralKey);
  expect(first.grant.salt).not.toBe(second.grant.salt);
});
