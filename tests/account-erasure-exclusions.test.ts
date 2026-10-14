import { it, expect } from 'vitest';
import { mkdtemp, rm, chmod } from 'node:fs/promises';
import { AccountErasureExclusions } from '../services/api/src/account-exit/exclusions.js';
it('retains finite minimal erasure exclusions across process restart and refuses unsafe directories', async () => {
  const directory = await mkdtemp('/tmp/daclify-account-exclusions-');
  try {
    const first = new AccountErasureExclusions(directory),
      record = {
        version: 1 as const,
        operationId: crypto.randomUUID(),
        accountIds: [crypto.randomUUID()],
        statusHash: 'ab'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
    await first.write(record);
    expect(await new AccountErasureExclusions(directory).read(record.operationId)).toEqual(record);
    expect(await first.write({ ...record, statusHash: 'cd'.repeat(32) })).toEqual(record);
    await chmod(directory, 0o755);
    await expect(first.read(record.operationId)).rejects.toThrow('ACCOUNT_EXCLUSION_DIRECTORY');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
