import { expect, it } from 'vitest';
import { ABI, Serializer } from '@wharfkit/antelope';
import { reviewAppendOnlyAbi, reviewHistoricalRow } from '../tools/deploy/append-only-abi.js';
const abi = (fields: { name: string; type: string }[]) =>
  ABI.from({
    version: 'eosio::abi/1.2',
    structs: [{ name: 'row', base: '', fields }],
    tables: [{ name: 'records', type: 'row', index_type: 'i64', key_names: [], key_types: [] }],
  });
const fields = [{ name: 'id', type: 'uint64' }],
  before = abi(fields),
  after = abi([...fields, { name: 'content', type: 'string?$' }]);
it('preserves exact historical bytes when a nullable extension gains its absent tag on current encoding', () => {
  reviewAppendOnlyAbi(before, after);
  const row = Serializer.encode({ abi: before, type: 'row', object: { id: '7' } }).hexString;
  const decoded = Serializer.decode({ abi: after, type: 'row', data: row });
  expect(Serializer.encode({ abi: after, type: 'row', object: decoded }).hexString).not.toBe(row);
  expect(() => reviewHistoricalRow(before, after, 'records', row)).not.toThrow();
  expect(() => reviewHistoricalRow(before, after, 'records', row + '01')).toThrow();
});
it('accepts an omitted nullable extension already declared by the deployed ABI', () => {
  const row = Serializer.encode({ abi: before, type: 'row', object: { id: '7' } }).hexString;
  const extended = abi([
    ...fields,
    { name: 'content', type: 'string?$' },
    { name: 'revision', type: 'uint32$' },
  ]);
  expect(() => reviewHistoricalRow(after, after, 'records', row)).not.toThrow();
  expect(() => reviewHistoricalRow(after, extended, 'records', row)).not.toThrow();
  expect(() => reviewHistoricalRow(after, extended, 'records', row + '01')).toThrow();
});
it('rejects field reinterpretation, required fields, reordered fields and removed tables', () => {
  expect(() => reviewAppendOnlyAbi(before, abi([{ name: 'id', type: 'int64' }]))).toThrow(
    'ABI_FIELD_CHANGED',
  );
  expect(() =>
    reviewAppendOnlyAbi(before, abi([...fields, { name: 'content', type: 'string' }])),
  ).toThrow('ABI_NON_EXTENSION_ADDED');
  expect(() =>
    reviewAppendOnlyAbi(before, abi([{ name: 'content', type: 'string$' }, ...fields])),
  ).toThrow('ABI_FIELD_CHANGED');
  expect(() =>
    reviewHistoricalRow(before, ABI.from({ version: 'eosio::abi/1.2' }), 'records', ''),
  ).toThrow('ABI_TABLE_CHANGED');
  const row = Serializer.encode({ abi: before, type: 'row', object: { id: '7' } }).hexString;
  expect(() =>
    reviewHistoricalRow(before, abi([{ name: 'id', type: 'int64' }]), 'records', row),
  ).toThrow('ABI_FIELD_CHANGED');
});
