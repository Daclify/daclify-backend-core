import { readFileSync } from 'node:fs';
import { ABI, Serializer } from '@wharfkit/antelope';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runtimeAbi } from '../sdk/generated/runtime.js';
const fixtures = z
  .array(z.object({ type: z.string(), data: z.record(z.string(), z.unknown()), hex: z.string() }))
  .parse(JSON.parse(readFileSync('tests/fixtures/v0.1-rows.json', 'utf8')));
describe('published baseline DAO/member binary layout', () => {
  it.each(fixtures)('preserves $type encoding while adding policy tables', (fixture) => {
    expect(
      Serializer.encode({ abi: ABI.from(runtimeAbi), type: fixture.type, object: fixture.data })
        .hexString,
    ).toBe(fixture.hex);
  });
});
