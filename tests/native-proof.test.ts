import { createHash } from 'node:crypto';
import { Action, Authority, PrivateKey, Serializer, Transaction } from '@wharfkit/antelope';
import { expect, it } from 'vitest';
import { encodeAction } from '../sdk/index.js';
import { checkNativeProof } from '../services/api/src/auth/native-proof.js';
const identity = { chainId: 'ab'.repeat(32), account: 'alice', permission: 'active' as const };
const runtime = 'daclifycore',
  message = '{"domain":"fixture","nonce":"unique-operation"}',
  now = Math.floor(Date.now() / 1000) * 1000,
  expires = new Date(now + 300000);
const first = PrivateKey.generate('K1'),
  second = PrivateKey.generate('K1');
const action = Action.from({
  account: runtime,
  name: 'authproof',
  authorization: [{ actor: 'alice', permission: 'active' }],
  data: encodeAction('authproof', {
    account: 'alice',
    intent: createHash('sha256').update(message).digest('hex'),
  }),
});
const transaction = Transaction.from({
  expiration: new Date(now + 120000),
  ref_block_num: 1,
  ref_block_prefix: 2,
  actions: [action],
});
const proof = {
  packedTransaction: Serializer.encode({ object: transaction }).hexString,
  signatures: [first.signDigest(transaction.signingDigest(identity.chainId)).toString()],
};
const authority = Authority.from({ threshold: 1, keys: [{ key: first.toPublic(), weight: 1 }] });
it('checks exact challenge and current native permission, including key thresholds', () => {
  expect(() =>
    checkNativeProof(proof, identity, runtime, message, expires, authority, now),
  ).not.toThrow();
  const threshold = Authority.from({
    threshold: 2,
    keys: [
      { key: first.toPublic(), weight: 1 },
      { key: second.toPublic(), weight: 1 },
    ],
  });
  expect(() =>
    checkNativeProof(proof, identity, runtime, message, expires, threshold, now),
  ).toThrow();
  const both = {
    ...proof,
    signatures: [
      ...proof.signatures,
      second.signDigest(transaction.signingDigest(identity.chainId)).toString(),
    ],
  };
  expect(() =>
    checkNativeProof(both, identity, runtime, message, expires, threshold, now),
  ).not.toThrow();
  expect(() =>
    checkNativeProof(
      { ...both, signatures: [...proof.signatures, ...proof.signatures] },
      identity,
      runtime,
      message,
      expires,
      threshold,
      now,
    ),
  ).toThrow();
});
it('rejects altered domains, expiry, revoked keys and unsupported delegated authorities', () => {
  for (const changed of [
    { ...identity, chainId: 'cd'.repeat(32) },
    { ...identity, account: 'bob' },
  ])
    expect(() =>
      checkNativeProof(proof, changed, runtime, message, expires, authority, now),
    ).toThrow();
  expect(() =>
    checkNativeProof(proof, identity, 'other', message, expires, authority, now),
  ).toThrow();
  expect(() =>
    checkNativeProof(proof, identity, runtime, message + '!', expires, authority, now),
  ).toThrow();
  expect(() =>
    checkNativeProof(proof, identity, runtime, message, new Date(now + 1000), authority, now),
  ).toThrow();
  expect(() =>
    checkNativeProof(proof, identity, runtime, message, expires, authority, now + 150000),
  ).toThrow();
  expect(() =>
    checkNativeProof(
      proof,
      identity,
      runtime,
      message,
      expires,
      Authority.from({ threshold: 1, keys: [{ key: second.toPublic(), weight: 1 }] }),
      now,
    ),
  ).toThrow();
  expect(() =>
    checkNativeProof(
      proof,
      identity,
      runtime,
      message,
      expires,
      Authority.from({
        threshold: 1,
        accounts: [{ permission: { actor: 'bob', permission: 'active' }, weight: 1 }],
      }),
      now,
    ),
  ).toThrow('NATIVE_AUTHORITY_UNSUPPORTED');
  const extra = Transaction.from({ ...transaction, actions: [action, action] });
  expect(() =>
    checkNativeProof(
      {
        packedTransaction: Serializer.encode({ object: extra }).hexString,
        signatures: [first.signDigest(extra.signingDigest(identity.chainId)).toString()],
      },
      identity,
      runtime,
      message,
      expires,
      authority,
      now,
    ),
  ).toThrow();
});
