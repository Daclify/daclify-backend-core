import { describe, it, expect } from 'vitest';
import { ExitIntentSchema, ExitReportSchema } from '../protocol/account-exit.js';
import { ErasureInventory } from '../services/api/src/account-exit/inventory.js';
describe('account exit trust boundaries', () => {
  it('rejects implicit closure, duplicate memberships and unsafe identifiers', () => {
    const member = {
      chainId: 'ab'.repeat(32),
      runtime: 'daclifycore',
      daoId: '18446744073709551615',
      memberId: '1',
      choice: 'leave',
    };
    expect(
      ExitIntentSchema.parse({ version: 1, mode: 'delete-account', memberships: [member] })
        .memberships[0]?.daoId,
    ).toBe(member.daoId);
    expect(() =>
      ExitIntentSchema.parse({ version: 1, mode: 'delete-account', memberships: [member, member] }),
    ).toThrow();
    expect(() =>
      ExitIntentSchema.parse({
        version: 1,
        mode: 'delete-account',
        memberships: [{ ...member, choice: 'automatic' }],
      }),
    ).toThrow();
    expect(() =>
      ExitIntentSchema.parse({
        version: 1,
        mode: 'delete-account',
        memberships: [{ ...member, daoId: 18446744073709551615 }],
      }),
    ).toThrow();
  });
  it('never accepts an unavailable component as proof of erasure', () => {
    expect(() =>
      ExitReportSchema.parse({
        version: 1,
        id: crypto.randomUUID(),
        mode: 'delete-account',
        state: 'complete',
        components: [{ id: 'hosted', state: 'unavailable', reason: 'HOST_UNAVAILABLE' }],
        expiresAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
  it('assigns every registered account-owned class a bounded policy and purpose', () => {
    expect(ErasureInventory.length).toBeGreaterThanOrEqual(43);
    for (const item of ErasureInventory) {
      expect(item.purpose.length).toBeGreaterThan(10);
      expect(item.expiry.length).toBeGreaterThan(5);
      expect(['erase', 'retain', 'minimize']).toContain(item.disposition);
    }
    expect(new Set(ErasureInventory.map((x) => x.table + '.' + x.column)).size).toBe(
      ErasureInventory.length,
    );
  });
});
it('binds exit signatures to the operation and prepared step without accepting arbitrary actions', async () => {
  const { exitInstructionDigest } = await import('../sdk/account-exit.js');
  const { makeInstruction, encodeAction } = await import('../sdk/index.js');
  const ref = {
    chainId: 'ab'.repeat(32),
    contract: 'daclifycore',
    daoId: '1',
    interfaceVersion: 1 as const,
  };
  const request = makeInstruction(
    ref,
    '1',
    '0',
    12345,
    'daclifycore',
    'leave',
    encodeAction('leave', { runtime: 'daclifycore', dao_id: '1', member_id: '1' }),
  );
  const a = exitInstructionDigest('ac'.repeat(32), 'bd'.repeat(32), request).hexString;
  expect(exitInstructionDigest('ad'.repeat(32), 'bd'.repeat(32), request).hexString).not.toBe(a);
  expect(exitInstructionDigest('ac'.repeat(32), 'be'.repeat(32), request).hexString).not.toBe(a);
  expect(() =>
    exitInstructionDigest('ac'.repeat(32), 'bd'.repeat(32), { ...request, action: 'setcredits' }),
  ).toThrow('EXIT_ACTION');
});
it('binds EVM exit authorization to the operation and step as well as its native instruction', async () => {
  const { exitGovernanceTypedData, evmTypedDigest } = await import('../sdk/evm.js');
  const { makeInstruction, encodeAction } = await import('../sdk/index.js');
  const ref = {
      chainId: 'ab'.repeat(32),
      contract: 'daclifycore',
      daoId: '1',
      interfaceVersion: 1 as const,
    },
    request = makeInstruction(
      ref,
      '1',
      '0',
      12345,
      'daclifycore',
      'leave',
      encodeAction('leave', { runtime: 'daclifycore', dao_id: '1', member_id: '1' }),
    ),
    binding = {
      chainId: 41 as const,
      address: '0x1111111111111111111111111111111111111111',
      epoch: '1',
    };
  const first = evmTypedDigest(
    exitGovernanceTypedData('ac'.repeat(32), 'bd'.repeat(32), request, binding),
  );
  expect(
    evmTypedDigest(exitGovernanceTypedData('ad'.repeat(32), 'bd'.repeat(32), request, binding)),
  ).not.toEqual(first);
  expect(
    evmTypedDigest(exitGovernanceTypedData('ac'.repeat(32), 'be'.repeat(32), request, binding)),
  ).not.toEqual(first);
});

it('accepts scoped EVM and native exit transports without granting the report capability signing authority', async () => {
  const { SignedExitInstructionSchema } = await import('../protocol/account-exit.js');
  const { makeInstruction, encodeAction } = await import('../sdk/index.js');
  const ref = {
    chainId: 'ab'.repeat(32),
    contract: 'daclifycore',
    daoId: '1',
    interfaceVersion: 1 as const,
  };
  const common = {
    operation: 'ac'.repeat(32),
    step_digest: 'bd'.repeat(32),
    request: makeInstruction(
      ref,
      '1',
      '0',
      12345,
      'daclifycore',
      'leave',
      encodeAction('leave', { runtime: 'daclifycore', dao_id: '1', member_id: '1' }),
    ),
  };
  expect(
    SignedExitInstructionSchema.parse({
      ...common,
      evm_chain_id: '41',
      address: '11'.repeat(20),
      binding_epoch: '1',
      proof: 'ab'.repeat(65),
    }).request.dao_id,
  ).toBe('1');
  expect(
    SignedExitInstructionSchema.parse({
      ...common,
      account: 'alice',
      permission: 'active',
      packedTransaction: 'ab',
      signatures: ['SIG_K1_test'],
    }).request.dao_id,
  ).toBe('1');
  expect(() =>
    SignedExitInstructionSchema.parse({ ...common, statusCapability: 'a'.repeat(43) }),
  ).toThrow();
});
