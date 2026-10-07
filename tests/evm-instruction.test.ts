import { describe, expect, it } from 'vitest';
import { hashTypedData, type TypedData } from 'viem';
import {
  bindingTypedData,
  governanceTypedData,
  evmTypedDigest,
  makeInstruction,
  encodeAction,
} from '../sdk/index.js';
const native = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '12',
  interfaceVersion: 1 as const,
};
const binding = {
  chainId: 41 as const,
  address: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
  epoch: '1',
};
const request = makeInstruction(
  native,
  '7',
  '0',
  2000000000,
  'daclifycore',
  'unlinkevm',
  encodeAction('unlinkevm', { runtime: 'daclifycore', dao_id: '12', member_id: '7' }),
);
describe('frozen EIP-712 signing domains', () => {
  it('matches the independent viem encoder for both consent and governance', () => {
    for (const data of [
      bindingTypedData(native, '7', binding, '0', 2000000000),
      governanceTypedData(request, binding),
    ]) {
      expect(`0x${Buffer.from(evmTypedDigest(data)).toString('hex')}`).toBe(
        hashTypedData<TypedData, string>(data),
      );
    }
  });
  it('binds every domain and instruction field independently', () => {
    const data = governanceTypedData(request, binding),
      expected = hashTypedData<TypedData, string>(data);
    for (const [name, value] of Object.entries(data.message)) {
      const changed =
        typeof value === 'number'
          ? value + 1
          : value.startsWith('0x')
            ? '0x' + 'cd'.repeat((value.length - 2) / 2)
            : String(BigInt(value) + 1n);
      expect(
        hashTypedData<TypedData, string>({
          ...data,
          message: { ...data.message, [name]: changed },
        }),
      ).not.toBe(expected);
    }
    for (const changed of [
      { ...data.domain, name: 'other' },
      { ...data.domain, version: '2' },
      { ...data.domain, chainId: 40 },
      { ...data.domain, salt: `0x${'cd'.repeat(32)}` as const },
    ])
      expect(hashTypedData<TypedData, string>({ ...data, domain: changed })).not.toBe(expected);
    expect(
      hashTypedData<TypedData, string>(bindingTypedData(native, '7', binding, '0', 2000000000)),
    ).not.toBe(expected);
  });
});
