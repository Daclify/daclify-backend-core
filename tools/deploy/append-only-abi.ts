import assert from 'node:assert/strict';
import { ABI, Serializer, type ABISerializable } from '@wharfkit/antelope';

// Historical rows can omit nullable binary extensions; re-encoding them with the new ABI adds tags.
export function reviewAppendOnlyAbi(previous: ABI, candidate: ABI) {
  assert.deepEqual(
    candidate.variants.slice(0, previous.variants.length),
    previous.variants,
    'ABI_VARIANTS_CHANGED',
  );
  for (const type of previous.types)
    assert.ok(
      candidate.types.some(
        (next) => next.new_type_name === type.new_type_name && next.type === type.type,
      ),
      'ABI_ALIAS_CHANGED',
    );
  for (const before of previous.structs) {
    const next = candidate.structs.find((type) => type.name === before.name);
    assert.ok(next && next.base === before.base, 'ABI_STRUCT_CHANGED');
    assert.deepEqual(
      next.fields.slice(0, before.fields.length),
      before.fields,
      'ABI_FIELD_CHANGED',
    );
    assert.ok(
      next.fields.slice(before.fields.length).every((field) => field.type.endsWith('$')),
      'ABI_NON_EXTENSION_ADDED',
    );
  }
}
export function reviewHistoricalRow(previous: ABI, candidate: ABI, table: string, row: string) {
  const before = previous.tables.find((item) => String(item.name) === table)?.type;
  const after = candidate.tables.find((item) => String(item.name) === table)?.type;
  assert.ok(before && after === before, 'ABI_TABLE_CHANGED');
  const value: ABISerializable = Serializer.decode({ abi: candidate, type: after, data: row });
  assert.ok(
    Serializer.encode({ abi: previous, type: before, object: value }).hexString === row,
    'HISTORICAL_ROW_CHANGED',
  );
}
