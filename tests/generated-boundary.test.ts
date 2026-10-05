import { describe, expect, it } from 'vitest';
import { RuntimeActionSchemas, RuntimeTableSchemas } from '../sdk/index.js';
import { PrivateKey } from '@wharfkit/antelope';
describe('compiled ABI runtime boundaries', () => {
  it('normalizes actual native legacy keys and integer bool transport', () => {
    const key = PrivateKey.generate('K1').toPublic();
    const member = {
      id: 1,
      native_account: '',
      signing_key: key.toLegacyString(),
      encryption_key: 'key',
      custody: 0,
      nonce: 0,
      credits: 0,
      active: 1,
      admin: 1,
      reviewer: 0,
      stake: 0,
      claim: 0,
      join_epoch: 1,
    };
    expect(RuntimeTableSchemas.members.parse(member)).toMatchObject({
      signing_key: key.toString(),
      active: true,
      admin: true,
      reviewer: false,
    });
  });
  it('rejects invalid native boolean transport', () => {
    expect(
      RuntimeTableSchemas.govlocks.safeParse({
        id: 1,
        source: 'works',
        source_id: 1,
        expires: 500,
        active: 2,
      }).success,
    ).toBe(false);
  });
  it('keeps integer booleans out of instruction input', () => {
    expect(
      RuntimeActionSchemas.setactive.safeParse({
        runtime: 'daclifycore',
        dao_id: '1',
        member_id: '1',
        target: '2',
        active: 1,
      }).success,
    ).toBe(false);
  });
  it('rejects an imprecise JSON uint64 instead of rounding it', () => {
    expect(
      RuntimeActionSchemas.grantcredit.safeParse({
        dao_id: '1',
        member_id: '2',
        quantity: 9007199254740992,
      }).success,
    ).toBe(false);
  });
  it('rejects an unknown authority field', () => {
    expect(
      RuntimeActionSchemas.grantcredit.safeParse({
        dao_id: '1',
        member_id: '2',
        quantity: '10',
        owner: 'attacker',
      }).success,
    ).toBe(false);
  });
  it('accepts exact decimal uint64 input', () => {
    expect(
      RuntimeActionSchemas.grantcredit.parse({
        dao_id: '1',
        member_id: '2',
        quantity: '18446744073709551615',
      }).quantity,
    ).toBe('18446744073709551615');
  });
  it('rejects malformed signed bytes', () => {
    expect(
      RuntimeActionSchemas.submit.safeParse({
        request: {
          version: 1,
          chain_id: 'ab'.repeat(32),
          deployment: 'daclifycore',
          dao_id: '1',
          member_id: '1',
          nonce: '0',
          expires: 1,
          target: 'daclifycore',
          action: 'setmeta',
          data: '0',
        },
        sig: PrivateKey.generate('K1').signMessage(new TextEncoder().encode('test')).toString(),
      }).success,
    ).toBe(false);
  });
  it('normalizes safe JSON integer transport without weakening input validation', () => {
    const member = {
      id: 1,
      native_account: '',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
      encryption_key: 'key',
      custody: 0,
      nonce: 0,
      credits: 0,
      active: true,
      admin: false,
      reviewer: false,
      stake: 0,
      claim: 0,
      join_epoch: 1,
    };
    expect(RuntimeTableSchemas.members.parse(member).id).toBe('1');
  });
});
