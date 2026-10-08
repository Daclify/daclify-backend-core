import { expect, it } from 'vitest';
import { selectRetainedObjects } from '../protocol/storage-retention.js';
const objects = [
  { id: '00000000-0000-4000-8000-000000000001', bytes: '60', createdAt: '2026-01-01T00:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000002', bytes: '60', createdAt: '2026-02-01T00:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000003', bytes: '40', createdAt: '2026-03-01T00:00:00Z' },
];
it('retains whole unique objects, uses explicit priorities first and fills capacity deterministically', () => {
  expect(selectRetainedObjects(objects, '100', [])).toEqual([objects[2]?.id, objects[1]?.id]);
  expect(selectRetainedObjects(objects, '100', [objects[0]?.id])).toEqual([
    objects[0]?.id,
    objects[2]?.id,
  ]);
  expect(() => selectRetainedObjects(objects, '50', [objects[0]?.id])).toThrow(
    'STORAGE_KEEP_CAPACITY',
  );
  expect(() =>
    selectRetainedObjects(objects, '100', ['00000000-0000-4000-8000-000000000004']),
  ).toThrow('STORAGE_KEEP_UNKNOWN');
  expect(() => selectRetainedObjects([...objects, objects[0]], '100', [])).toThrow();
});
