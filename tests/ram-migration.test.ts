import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { z } from 'zod';
import { Name } from '@wharfkit/antelope';
import { loadContract, row, send } from './helpers/vert.js';
let probe: ReturnType<typeof loadContract>;
beforeEach(async () => {
  const chain = new Blockchain();
  probe = loadContract(chain, 'migprobe', '.artifacts/contracts/migprobe');
  await send(probe, 'seed', [0, 1, 'zero'], 'migprobe@active');
  await send(probe, 'seed', [7, 1, 'middle'], 'migprobe@active');
  await send(probe, 'seed', [99, 2, 'last'], 'migprobe@active');
  await send(probe, 'begin', [], 'migprobe@active');
});
function bytes(dao: bigint) {
  return z.object({ bytes: z.number() }).parse(row(probe, 'totals', probe.toBigInt(), dao)).bytes;
}
async function wrappers() {
  probe = loadContract(new Blockchain(), 'migprobe', '.artifacts/contracts/migprobe');
  await send(probe, 'wseed', [], 'migprobe@active');
  await send(probe, 'wbegin', [], 'migprobe@active');
}
it('counts key zero, resumes bounded scans, and does not credit a completed family twice', async () => {
  await send(probe, 'backfill', [1], 'migprobe@active');
  expect(
    row(probe, 'ramcursors', probe.toBigInt(), BigInt(Name.from('samples').value.toString())),
  ).toBeDefined();
  const first = bytes(1n);
  await send(probe, 'backfill', [1], 'migprobe@active');
  expect(bytes(1n)).toBeGreaterThan(first);
  await send(probe, 'backfill', [1], 'migprobe@active');
  const last = bytes(2n),
    metadata = bytes(0n),
    all = bytes(1n);
  await send(probe, 'backfill', [1], 'migprobe@active');
  expect([bytes(0n), bytes(1n), bytes(2n)]).toEqual([metadata, all, last]);
  await expect(send(probe, 'backfill', [0], 'migprobe@active')).rejects.toThrow(
    'RAM_MIGRATION_BATCH',
  );
});
it('counts a protected mutation before the scan once, preserves its final row and clears its overlay', async () => {
  await send(probe, 'edit', [7, 'changed'], 'migprobe@active');
  const beforeScan = bytes(1n);
  expect(beforeScan).toBeGreaterThan(0);
  await send(probe, 'backfill', [25], 'migprobe@active');
  expect(row(probe, 'samples', probe.toBigInt(), 7n)).toMatchObject({ payload: 'changed' });
  expect(bytes(1n) - beforeScan).toBe(112 + 8 + 8 + 1 + 4);
  expect(probe.tables.ramoverlays?.(probe.toBigInt()).getTableRows()).toEqual([]);
});
it('accounts a protected deletion before the scan without retaining a dead overlay or resurrecting a row', async () => {
  await send(probe, 'remove', [99], 'migprobe@active');
  expect(bytes(2n)).toBe(0);
  await send(probe, 'backfill', [25], 'migprobe@active');
  expect(row(probe, 'samples', probe.toBigInt(), 99n)).toBeUndefined();
  expect(probe.tables.ramoverlays?.(probe.toBigInt()).getTableRows()).toEqual([]);
});
it('freezes ordinary insert/growth/pruning and rolls every failed overlay mutation back', async () => {
  await wrappers();
  for (const [kind, error] of [
    [0, 'RAM_MIGRATION_GROWTH'],
    [1, 'RAM_MIGRATION_GROWTH'],
    [2, 'RAM_MIGRATION_PRUNING'],
  ] as const)
    await expect(send(probe, 'wordinary', [kind], 'migprobe@active')).rejects.toThrow(error);
  expect(probe.tables.ramcursors?.(probe.toBigInt()).getTableRows() ?? []).toEqual([]);
  expect(row(probe, 'profiles', probe.toBigInt(), 1n)).toMatchObject({ payload: 'ordinary' });
});
it('tracks protected insertions and repeated updates exactly once across the wrapper backfill', async () => {
  await wrappers();
  await send(probe, 'wedit', [7, 'changed'], 'migprobe@active');
  await send(probe, 'wnew', [8], 'migprobe@active');
  await send(probe, 'wbackfill', [1], 'migprobe@active');
  const before = bytes(1n);
  await send(probe, 'wedit', [7, 'changed'], 'migprobe@active');
  await send(probe, 'wbackfill', [25], 'migprobe@active');
  expect(bytes(1n)).toBe(before);
  expect(probe.tables.ramoverlays?.(1n).getTableRows() ?? []).toEqual([]);
  expect(row(probe, 'actors', 1n, 8n)).toMatchObject({ payload: 'new-protected' });
});
it('captures a legacy singleton before shrink and prevents a duplicate old-state credit', async () => {
  await wrappers();
  await send(probe, 'wconfig', ['x'], 'migprobe@active');
  const before = bytes(0n);
  await send(probe, 'wcfgfill', [], 'migprobe@active');
  expect(bytes(0n)).toBeLessThan(before);
  const complete = bytes(0n);
  await send(probe, 'wcfgfill', [], 'migprobe@active');
  expect(bytes(0n)).toBe(complete);
  await expect(
    send(probe, 'wconfig', ['growing configuration'], 'migprobe@active'),
  ).rejects.toThrow('RAM_MIGRATION_GROWTH');
});
