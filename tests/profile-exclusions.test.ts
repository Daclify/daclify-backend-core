import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm, chmod, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileProfileExclusions } from '../services/api/src/profiles/exclusions.js';
import { readProfileKeysConfiguration } from '../services/api/src/profiles/config.js';
const directories: string[] = [];
async function directory() {
  const value = await mkdtemp(join(tmpdir(), 'daclify-exclusion-test-'));
  directories.push(value);
  return value;
}
afterEach(async () => {
  for (const value of directories.splice(0)) await rm(value, { recursive: true, force: true });
});
function record() {
  return {
    version: 1 as const,
    context: {
      version: 2 as const,
      chainId: 'ab'.repeat(32),
      runtime: 'daclifycore',
      daoId: '1',
      memberId: '1',
      profileRevision: randomUUID(),
    },
    ownerAccountId: randomUUID(),
    ciphertextCommitment: 'cd'.repeat(32),
    deletedAt: new Date().toISOString(),
    backupExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
}
it('persists immutable exclusions across a new service instance and concurrent retries', async () => {
  const path = await directory(),
    first = new FileProfileExclusions(path),
    value = record();
  const results = await Promise.all([first.write(value), first.write(value)]);
  expect(results).toEqual([value, value]);
  const restored = new FileProfileExclusions(path);
  expect(await restored.read(value.context)).toEqual(value);
  expect(
    await restored.write({
      ...value,
      backupExpiresAt: new Date(Date.now() + 172800000).toISOString(),
    }),
  ).toEqual(value);
  expect((await readdir(path)).some((name) => name.startsWith('.pending-'))).toBe(false);
});
it('scans with bounded memory and advances past live records before safe metadata removal', async () => {
  const store = new FileProfileExclusions(await directory());
  const values = Array.from({ length: 31 }, record);
  for (const value of values) await store.write(value);
  const first = await store.scan(25),
    second = await store.scan(25);
  expect(first.records).toHaveLength(25);
  expect(first.done).toBe(false);
  expect(second.records).toHaveLength(6);
  expect(second.done).toBe(true);
  expect(
    new Set([...first.records, ...second.records].map((value) => value.context.profileRevision))
      .size,
  ).toBe(31);
  const last = values.at(-1);
  if (!last) throw new Error('FIXTURE_RECORD');
  await store.forget(last.context);
  expect(await store.read(last.context)).toBeNull();
  await store.close();
});
it('refuses shared directories and symlinked journal paths', async () => {
  const path = await directory(),
    store = new FileProfileExclusions(path),
    value = record();
  await chmod(path, 0o755);
  await expect(store.read(value.context)).rejects.toThrow('PROFILE_EXCLUSION_DIRECTORY');
  await chmod(path, 0o700);
  const alias = join(await directory(), 'journal');
  await symlink(path, alias);
  await expect(new FileProfileExclusions(alias).read(value.context)).rejects.toThrow(
    'PROFILE_EXCLUSION_DIRECTORY',
  );
});
it('requires finite explicit retention and refuses ephemeral mainnet configuration', async () => {
  expect(await readProfileKeysConfiguration({})).toBeUndefined();
  await expect(readProfileKeysConfiguration({ PROFILE_KEYS_ENABLED: '1' })).rejects.toThrow(
    'PROFILE_KEYS_CONFIGURATION_INVALID',
  );
  const path = await directory();
  const config = {
    PROFILE_KEYS_ENABLED: '1',
    PROFILE_KEYS_MAX_BACKUP_AGE_SECONDS: '86400',
    PROFILE_KEYS_EXCLUSIONS_DIRECTORY: path,
  };
  expect((await readProfileKeysConfiguration(config))?.backupRetentionSeconds).toBe(86400);
  await expect(
    readProfileKeysConfiguration({ ...config, PROFILE_KEYS_MAX_BACKUP_AGE_SECONDS: '0' }),
  ).rejects.toThrow('PROFILE_KEYS_CONFIGURATION_INVALID');
  await expect(
    readProfileKeysConfiguration({ ...config, NETWORK_ENVIRONMENT: 'mainnet' }),
  ).rejects.toThrow('PROFILE_KEYS_CONFIGURATION_INVALID');
});

it.each(['/tmp/profiles', '/var/tmp/profiles', '/dev/shm/profiles'])(
  'rejects the known temporary journal location %s before mainnet startup',
  async (path) => {
    await expect(
      readProfileKeysConfiguration({
        PROFILE_KEYS_ENABLED: '1',
        PROFILE_KEYS_MAX_BACKUP_AGE_SECONDS: '86400',
        PROFILE_KEYS_EXCLUSIONS_DIRECTORY: path,
        NETWORK_ENVIRONMENT: 'mainnet',
      }),
    ).rejects.toThrow('PROFILE_KEYS_CONFIGURATION_INVALID');
  },
);
