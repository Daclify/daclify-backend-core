import { expect, it } from 'vitest';
import { PrivateKey, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import {
  encodeQuickAnchor,
  decodeQuickAnchor,
  quickAccountIdentity,
  quickAccountRequest,
  validateQuickPreparation,
  quickAccountAction,
  quickAccountDigest,
  QuickAuthCodeHash,
} from '../sdk/quick-accounts.js';
import { QuickAccountIntentSchema, QuickAccountRoutes } from '../protocol/quick-accounts.js';

const key = PrivateKey.generate('K1'),
  expires = () => Math.floor(Date.now() / 1000) + 120;
it('publishes usable JSON schemas for every account approval endpoint', () => {
  for (const route of Object.values(QuickAccountRoutes)) expect(() => z.toJSONSchema(route.response, { io: 'output' })).not.toThrow();
});
function context() {
  const anchor = { kind: 'key', publicKey: key.toPublic().toString() };
  return {
    chainId: '11'.repeat(32),
    runtime: 'daclifycore1',
    authority: 'quickauth',
    authorityCodeHash: QuickAuthCodeHash,
    source: 'quickvote',
    sourceCodeHash: '22'.repeat(32),
    gateway: { actor: 'gateway', permission: 'relay' },
    anchor,
    identity: quickAccountIdentity('11'.repeat(32), 'daclifycore1', anchor),
    frozen: true,
    record: null,
  };
}
it('keeps the public anchor codec canonical, including cleared defaults', () => {
  for (const anchor of [
    { kind: 'key', publicKey: key.toPublic().toString() },
    { kind: 'native', account: 'alice', permission: 'active' },
    { kind: 'evm', chainId: 41, address: '0x' + 'ab'.repeat(20) },
  ])
    expect(decodeQuickAnchor(encodeQuickAnchor(anchor))).toEqual(anchor);
  expect(decodeQuickAnchor({ kind: 3, credential: '' })).toBeNull();
  expect(() => decodeQuickAnchor({ kind: 3, credential: '00' })).toThrow();
});

it('builds and validates the exact registration before authorizing a gateway-only root proof', () => {
  const state = context(),
    intent = QuickAccountIntentSchema.parse({ operation: 'register' });
  const packet = quickAccountRequest(state, intent, expires());
  if (packet.action !== 'qregister') throw Error('FIXTURE_REGISTER');
  const prepared = {
    id: '00000000-0000-4000-8000-000000000001',
    context: state,
    expiresAt: new Date(packet.request.expires * 1000).toISOString(),
    ...packet,
  };
  expect(validateQuickPreparation(prepared, state, intent)).toEqual(prepared);
  const proof = Serializer.encode({
    object: key.signDigest(quickAccountDigest('qregister', packet.request)),
  }).hexString;
  const action = quickAccountAction(prepared, { proof, incoming: '' });
  expect(action.account.toString()).toBe('quickauth');
  expect(action.authorization.map((value) => value.toString())).toEqual(['gateway@relay']);
  expect(() =>
    validateQuickPreparation(
      { ...prepared, request: { ...packet.request, authority: 'otherauth' } },
      state,
      intent,
    ),
  ).toThrow('QUICK_PREPARATION');
  expect(() =>
    validateQuickPreparation(
      { ...prepared, expiresAt: new Date(Date.now() + 900000).toISOString() },
      state,
      intent,
    ),
  ).toThrow('QUICK_PREPARATION');
});

it('binds source bytes, account epoch and nonce and requires the actual default native permission', () => {
  const base = context(),
    state = {
      ...base,
      record: {
        id: '7',
        identity: base.identity,
        approval: encodeQuickAnchor({ kind: 'native', account: 'alice', permission: 'active' }),
        epoch: '3',
        nonce: '8',
        active: true,
        deactivated_at: 0,
      },
    };
  const intent = QuickAccountIntentSchema.parse({
    operation: 'submit',
    action: 'remove',
    data: 'ab'.repeat(64),
    useDefault: true,
  });
  const packet = quickAccountRequest(state, intent, expires());
  if (packet.action !== 'qsubmit') throw Error('FIXTURE_SUBMIT');
  const prepared = {
    id: '00000000-0000-4000-8000-000000000001',
    context: state,
    expiresAt: new Date(packet.request.control.expires * 1000).toISOString(),
    ...packet,
  };
  expect(validateQuickPreparation(prepared, state, intent)).toEqual(prepared);
  expect(
    quickAccountAction(prepared, { proof: '', incoming: '' })
      .authorization.map((value) => value.toString())
      .sort(),
  ).toEqual(['alice@active', 'gateway@relay']);
  for (const request of [
    { ...packet.request, data: 'cd'.repeat(64) },
    { ...packet.request, code_hash: '33'.repeat(32) },
    { ...packet.request, control: { ...packet.request.control, nonce: '9' } },
  ])
    expect(() => validateQuickPreparation({ ...prepared, request }, state, intent)).toThrow(
      'QUICK_PREPARATION',
    );
  expect(QuickAccountIntentSchema.safeParse({ ...intent, action: 'transfer' }).success).toBe(false);
});
