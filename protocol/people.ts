import { z } from 'zod';
import {
  ChainIdSchema,
  CidSchema,
  DaoRefSchema,
  IdSchema,
  NativeAccountSchema,
  Uint64Schema,
} from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';

const link = z.union([
  z.literal(''),
  z
    .url()
    .max(300)
    .refine((value) => new URL(value).protocol === 'https:'),
]);
const image = z.union([z.literal(''), CidSchema]);
export const PublicProfileSchema = z.strictObject({
  name: NativeAccountSchema.refine((value) => value.length <= 12 && !value.includes('..')),
  fullName: z.string().max(80).optional(),
  location: z.string().max(80).optional(),
  email: z.string().max(254).optional(),
  telegram: z.string().max(32).optional(),
  introduction: z.string().max(2000).optional(),
  motto: z.string().max(140).optional(),
  facebook: link.optional(),
  instagram: link.optional(),
  youtube: link.optional(),
  linkedin: link.optional(),
  website: link.optional(),
  avatar: image.optional(),
  background: image.optional(),
});
export const PublicPersonSchema = z.strictObject({
  id: Uint64Schema,
  dao: DaoRefSchema,
  memberId: IdSchema,
  accountName: NativeAccountSchema,
  profile: PublicProfileSchema,
});
export const PublicMemberSchema = RuntimeTableSchemas.members
  .pick({ id: true, native_account: true, active: true })
  .extend({
    dao: DaoRefSchema,
    profile: PublicProfileSchema.nullable(),
    identityKey: ChainIdSchema.nullable().default(null),
    lastActive: z.int().min(1).max(0xffffffff).nullable().default(null),
  });
const memberCursor = z.strictObject({ daoId: IdSchema, after: Uint64Schema });
export const PeopleRoutes = {
  members: {
    method: 'GET',
    path: '/v1/people/members',
    helpTopic: 'accounts',
    query: memberCursor
      .partial()
      .extend({ onlyDao: IdSchema.optional(), memberId: IdSchema.optional() })
      .refine(
        (value) =>
          (value.after === undefined || !!value.daoId) &&
          (!value.memberId || (!!value.daoId && value.after === undefined)) &&
          (!value.onlyDao || !value.daoId || value.onlyDao === value.daoId),
      ),
    response: z.strictObject({
      members: z.array(PublicMemberSchema).max(50),
      next: memberCursor.nullable(),
    }),
  },
  list: {
    method: 'GET',
    path: '/v1/people',
    helpTopic: 'accounts',
    query: z
      .strictObject({
        after: Uint64Schema.optional(),
        daoId: IdSchema.optional(),
        memberId: IdSchema.optional(),
      })
      .refine(
        (value) => !value.memberId || (!!value.daoId && value.after === undefined),
        'A member lookup requires its DAO and cannot include a page cursor.',
      ),
    response: z.strictObject({
      profiles: z.array(PublicPersonSchema).max(50),
      next: Uint64Schema.nullable(),
      skipped: z.int().nonnegative().default(0),
    }),
  },
} as const;
export type PublicPerson = z.infer<typeof PublicPersonSchema>;
export type PublicMember = z.infer<typeof PublicMemberSchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type PublicUser = {
  key: string;
  nativeAccount: string;
  profile: PublicProfile | null;
  memberships: PublicMember[];
  lastActive: number | null;
};

export function unifyPublicMembers(members: readonly PublicMember[]): PublicUser[] {
  const namespace = (member: PublicMember) => `${member.dao.chainId}:${member.dao.contract}`;
  const membershipKey = (member: PublicMember) =>
    `${namespace(member)}:${member.dao.daoId}:${member.id}`;
  const records = new Map<string, PublicMember>();
  for (const member of members) {
    const key = membershipKey(member),
      previous = records.get(key);
    records.set(key, {
      ...member,
      lastActive: Math.max(previous?.lastActive ?? 0, member.lastActive ?? 0) || null,
    });
  }
  const unique = [...records.values()].sort((a, b) => {
    const deployment = namespace(a).localeCompare(namespace(b));
    if (deployment) return deployment;
    const left = (BigInt(a.dao.daoId) << 64n) + BigInt(a.id),
      right = (BigInt(b.dao.daoId) << 64n) + BigInt(b.id);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const owners = new Map<string, Set<string>>();
  for (const member of unique) {
    if (!member.native_account || !member.identityKey) continue;
    const key = `${namespace(member)}:${member.identityKey}`,
      accounts = owners.get(key) ?? new Set<string>();
    accounts.add(member.native_account);
    owners.set(key, accounts);
  }
  const users = new Map<string, PublicUser>();
  for (const member of unique) {
    const identity = member.identityKey ? `${namespace(member)}:${member.identityKey}` : null;
    const accounts = identity ? owners.get(identity) : undefined;
    const native = member.native_account || (accounts?.size === 1 ? [...accounts][0] : '') || '';
    const key = native
      ? `native:${namespace(member)}:${native}`
      : identity
        ? `key:${identity}`
        : `member:${membershipKey(member)}`;
    const user = users.get(key) ?? {
      key,
      nativeAccount: native,
      profile: null,
      memberships: [],
      lastActive: null,
    };
    user.memberships.push(member);
    user.profile ??= member.profile;
    if (member.lastActive !== null)
      user.lastActive = Math.max(user.lastActive ?? 0, member.lastActive);
    users.set(key, user);
  }
  return [...users.values()];
}
