import { expect, it } from 'vitest';
import { PublicMemberSchema, unifyPublicMembers } from '../protocol/people.js';

function member(dao = '1', id = '1', native = '', key: string | null = 'ab'.repeat(32)) {
  return PublicMemberSchema.parse({
    dao: { chainId: 'cd'.repeat(32), contract: 'daclifycore', daoId: dao, interfaceVersion: 1 },
    id,
    native_account: native,
    identityKey: key,
    active: true,
    profile: null,
    lastActive: null,
  });
}
it('unifies native accounts across rotated keys and retains every DAO membership', () => {
  const users = unifyPublicMembers([
    member('3', '7', 'alice'),
    member('1', '2', 'alice', 'ef'.repeat(32)),
  ]);
  expect(users).toHaveLength(1);
  expect(users[0]?.memberships.map((m) => m.dao.daoId)).toEqual(['1', '3']);
});
it('unifies a shared signing identity and attaches an unpaired membership to its one native account', () => {
  expect(unifyPublicMembers([member('1'), member('2')])).toHaveLength(1);
  const users = unifyPublicMembers([member('1', '1', 'alice'), member('2')]);
  expect(users).toHaveLength(1);
  expect(users[0]?.nativeAccount).toBe('alice');
});
it('does not combine distinct native accounts or guess which owns an ambiguous unpaired key', () => {
  const users = unifyPublicMembers([
    member('1', '1', 'alice'),
    member('2', '1', 'bob'),
    member('3'),
  ]);
  expect(users).toHaveLength(3);
  expect(users.every((u) => u.memberships.length === 1)).toBe(true);
});
it('keeps unrelated keys, legacy unknown identities and foreign deployments separate', () => {
  const foreign = member('5');
  foreign.dao.chainId = 'ef'.repeat(32);
  const otherRuntime = member('5');
  otherRuntime.dao.contract = 'othercore';
  expect(
    unifyPublicMembers([
      member('1'),
      member('2', '1', '', 'ef'.repeat(32)),
      member('3', '1', '', null),
      member('4', '1', '', null),
      foreign,
      otherRuntime,
    ]),
  ).toHaveLength(6);
});
it('chooses a published profile deterministically using uint64 DAO IDs and the maximum activity', () => {
  const first = member('9'),
    later = member('18446744073709551615', '1', '', 'ab'.repeat(32));
  first.profile = { name: 'alice', fullName: 'Alice', email: 'alice@example.org' };
  later.profile = { name: 'other', fullName: 'Other published profile' };
  first.lastActive = 100;
  later.lastActive = 200;
  const users = unifyPublicMembers([later, first, first]);
  expect(users).toHaveLength(1);
  expect(users[0]?.profile).toEqual(first.profile);
  expect(users[0]?.memberships).toHaveLength(2);
  expect(users[0]?.lastActive).toBe(200);
  expect(unifyPublicMembers([first, later])).toEqual(users);
});
it('finds a later published profile without merging contacts from another profile', () => {
  const first = member('1'),
    later = member('2');
  later.profile = { name: 'alice', avatar: '', location: 'Canary Islands' };
  expect(unifyPublicMembers([first, later])[0]?.profile).toEqual(later.profile);
});
it('preserves inactive membership facts and keeps missing activity unknown', () => {
  const first = member('1'),
    later = member('2');
  first.active = false;
  const user = unifyPublicMembers([first, later])[0];
  expect(user?.memberships.map((m) => m.active)).toEqual([false, true]);
  expect(user?.lastActive).toBeNull();
});
it('does not infer identity from identical published names, emails or avatars', () => {
  const first = member('1', '1', '', 'ab'.repeat(32)),
    second = member('2', '1', '', 'ef'.repeat(32));
  first.profile = second.profile = { name: 'alice', email: 'same@example.org' };
  expect(unifyPublicMembers([first, second])).toHaveLength(2);
});
it('decodes older member responses conservatively and rejects fabricated identity/time', () => {
  expect(
    PublicMemberSchema.parse({ ...member(), identityKey: undefined, lastActive: undefined }),
  ).toMatchObject({ identityKey: null, lastActive: null });
  expect(PublicMemberSchema.safeParse({ ...member(), identityKey: 'private-id' }).success).toBe(
    false,
  );
  expect(PublicMemberSchema.safeParse({ ...member(), lastActive: -1 }).success).toBe(false);
  expect(PublicMemberSchema.safeParse({ ...member(), lastActive: 2 ** 32 }).success).toBe(false);
});
it('retains the latest observed action when exact lookup and directory pages overlap out of order', () => {
  const newer = member(),
    older = member();
  newer.lastActive = 200;
  older.lastActive = 100;
  const user = unifyPublicMembers([newer, older])[0];
  expect(user?.memberships).toHaveLength(1);
  expect(user?.lastActive).toBe(200);
});
