import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPinataStorageScope } from '../services/api/src/content/config.js';

it('uses the explicitly configured storage scope', () => {
  expect(readPinataStorageScope({ PINATA_STORAGE_SCOPE: 'daclify-testnet' })).toBe(
    'daclify-testnet',
  );
});

it('preserves the legacy scope and accepts a matching migration alias', () => {
  expect(readPinataStorageScope({ PINATA_ACCOUNT_ID: 'existing-pinata-owner' })).toBe(
    'existing-pinata-owner',
  );
  expect(
    readPinataStorageScope({
      PINATA_STORAGE_SCOPE: 'existing-pinata-owner',
      PINATA_ACCOUNT_ID: 'existing-pinata-owner',
    }),
  ).toBe('existing-pinata-owner');
});

it('leaves unconfigured storage unconfigured', () => {
  expect(readPinataStorageScope({})).toBeUndefined();
});

it('refuses conflicting scope names without disclosing either value', () => {
  expect(() =>
    readPinataStorageScope({
      PINATA_STORAGE_SCOPE: 'different-owner',
      PINATA_ACCOUNT_ID: 'existing-owner',
    }),
  ).toThrow(/^PINATA_STORAGE_SCOPE_CONFLICT$/);
});

it('rejects invalid or empty scopes through either configuration name', () => {
  for (const key of ['PINATA_STORAGE_SCOPE', 'PINATA_ACCOUNT_ID'])
    for (const value of ['', 'owner with spaces', '../owner', 'owner\nsecret', 'x'.repeat(129)])
      expect(() => readPinataStorageScope({ [key]: value })).toThrow(
        /^PINATA_STORAGE_SCOPE_INVALID$/,
      );
});

it('rejects conflicting API and upload-claim configuration before connecting to services', () => {
  const directory = mkdtempSync(join(tmpdir(), 'daclify-pinata-scope-'));
  try {
    const file = join(directory, 'api.env');
    writeFileSync(file, '');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DACLIFY_ENV_FILE: file,
      PINATA_STORAGE_SCOPE: 'different-owner',
      PINATA_ACCOUNT_ID: 'existing-owner',
    };
    delete env.DEPLOYER_PRIVATE_KEY;
    for (const entry of ['services/api/src/main.ts', 'tools/content/reconcile.ts']) {
      const result = spawnSync(process.execPath, ['--import', 'tsx', entry], {
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(result.status).not.toBeNull();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('PINATA_STORAGE_SCOPE_CONFLICT');
      expect(result.stdout + result.stderr).not.toContain('different-owner');
      expect(result.stdout + result.stderr).not.toContain('existing-owner');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
