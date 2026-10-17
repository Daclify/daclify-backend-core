import assert from 'node:assert/strict';
import { z } from 'zod';
export function contractRamGrowth(
  codeBytes: number,
  priorCodeBytes: number,
  abiBytes: number,
  priorAbiBytes: number,
) {
  const growth =
    Math.max(0, codeBytes - priorCodeBytes) * 10 + Math.max(0, abiBytes - priorAbiBytes);
  assert.ok(Number.isSafeInteger(growth) && growth >= 0, 'RAM_GROWTH_BOUND');
  return growth;
}
export function upgradePosition(forward: readonly boolean[], reverse: readonly boolean[]) {
  assert.equal(forward.length, reverse.length, 'JOURNAL_STAGE_COUNT');
  const missing = forward.indexOf(false),
    completed = missing < 0 ? forward.length : missing;
  assert.ok(
    forward.slice(completed).every((value) => !value),
    'JOURNAL_FORWARD_GAP',
  );
  let remaining = completed;
  while (remaining > 0 && reverse[remaining - 1]) remaining--;
  assert.ok(
    reverse.slice(0, remaining).every((value) => !value) &&
      reverse.slice(completed).every((value) => !value),
    'JOURNAL_REVERSE_GAP',
  );
  return { completed, remaining };
}
export function assertNoAssetTransfer(result: unknown) {
  const stack = z
    .object({ processed: z.object({ action_traces: z.array(z.unknown()).max(10000) }) })
    .parse(JSON.parse(JSON.stringify(result))).processed.action_traces;
  let count = 0;
  while (stack.length) {
    assert.ok(++count <= 10000, 'TRACE_BOUND');
    const trace = z
      .object({
        act: z.object({ name: z.string() }),
        inline_traces: z.array(z.unknown()).max(10000).optional(),
      })
      .parse(stack.pop());
    assert.notEqual(trace.act.name, 'transfer', 'ASSET_MOVEMENT_FORBIDDEN');
    stack.push(...(trace.inline_traces ?? []));
  }
}
