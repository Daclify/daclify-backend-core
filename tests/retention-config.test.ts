import { expect, it } from 'vitest';
import { readRetentionEnabled } from '../services/api/src/content/retention-config.js';
it('defaults to no deletion and refuses malformed or incompletely configured cleanup', () => {
  expect(readRetentionEnabled({}, false, false)).toBe(false);
  expect(readRetentionEnabled({ DACLIFY_STORAGE_CLEANUP_ENABLED: 'false' }, true, true)).toBe(
    false,
  );
  expect(readRetentionEnabled({ DACLIFY_STORAGE_CLEANUP_ENABLED: 'true' }, true, true)).toBe(true);
  for (const [provider, payment] of [
    [false, false],
    [true, false],
    [false, true],
  ] as const)
    expect(() =>
      readRetentionEnabled({ DACLIFY_STORAGE_CLEANUP_ENABLED: 'true' }, provider, payment),
    ).toThrow('STORAGE_RETENTION_CONFIGURATION_INVALID');
  for (const value of ['1', 'yes', 'TRUE', ''])
    expect(() =>
      readRetentionEnabled({ DACLIFY_STORAGE_CLEANUP_ENABLED: value }, true, true),
    ).toThrow('STORAGE_RETENTION_CONFIGURATION_INVALID');
});
