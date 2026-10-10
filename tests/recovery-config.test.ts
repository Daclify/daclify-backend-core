import { expect, it } from 'vitest';
import { readRecoveryConfiguration as read } from '../services/api/src/auth/recovery-config.js';
it('leaves all hosted recovery unavailable until explicitly configured', async () => {
  expect(await read({})).toBeUndefined();
});
it('rejects enablement from a flag or an unqualified local key-service URL', async () => {
  await expect(read({ RECOVERY_ENABLED: '1' })).rejects.toThrow('RECOVERY_CONFIGURATION_INVALID');
  await expect(
    read({
      RECOVERY_ENABLED: '1',
      RECOVERY_OPENBAO_ADDRESS: 'http://localhost:8200',
      RECOVERY_OPENBAO_TOKEN_FILE: '/tmp/token',
      RECOVERY_QUALIFICATION_FILE: '/tmp/qualified.json',
    }),
  ).rejects.toThrow('RECOVERY_CONFIGURATION_INVALID');
});

it('accepts only intact, current evidence for the exact site, version, storage scope and independent hosts', async () => {
  const { mkdtemp, writeFile, rm, chmod } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { VERSION } = await import('../protocol/base.js');
  const directory = await mkdtemp(join(tmpdir(), 'daclify-recovery-evidence-'));
  try {
    const origin = 'https://app.example.test',
      keyServiceOrigin = 'https://keys.example.test',
      scope = 'testnet.recovery:v1';
    const env = {
      RECOVERY_ENABLED: '1',
      RECOVERY_OPENBAO_ADDRESS: keyServiceOrigin,
      RECOVERY_OPENBAO_TOKEN_FILE: join(directory, 'token'),
      RECOVERY_QUALIFICATION_FILE: join(directory, 'qualification.json'),
      FRONTEND_ORIGIN: origin,
      PINATA_JWT: 'test-only-provider-token',
      CONTENT_GATEWAY: 'https://gateway.example.test',
      PINATA_STORAGE_SCOPE: scope,
    };
    await writeFile(env.RECOVERY_OPENBAO_TOKEN_FILE, 'test-only-renewable-token', { mode: 0o600 });
    async function evidence(kind: string) {
      const file = kind + '.json',
        bytes = JSON.stringify({ status: 'passed', kind, origin, coreVersion: VERSION });
      await writeFile(join(directory, file), bytes, { mode: 0o600 });
      return { kind, file, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    const report = {
      version: 1,
      coreVersion: VERSION,
      origin,
      keyServiceOrigin,
      storeScope: scope,
      issuedAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      assisted: true,
      sourceHost: 'source-host',
      restoreHost: 'independent-replacement',
      reviewedBy: 'test-fixture',
      checks: await Promise.all(
        ['database-restore', 'key-service-restore', 'offsite-blob'].map(evidence),
      ),
      clients: [
        { ...(await evidence('evm')), browser: 'fixture-browser', wallet: 'fixture-wallet' },
      ],
    };
    async function save(value: unknown) {
      await writeFile(env.RECOVERY_QUALIFICATION_FILE, JSON.stringify(value), { mode: 0o600 });
    }
    await save(report);
    const configured = await read(env);
    expect(configured?.qualifiedWallets).toEqual(['evm']);
    expect(configured?.assistedQualified).toBe(true);
    expect(configured?.passkeysQualified).toBe(false);
    for (const altered of [
      { ...report, expiresAt: new Date(Date.now() - 1000).toISOString() },
      { ...report, sourceHost: report.restoreHost },
      { ...report, origin: 'https://other.example.test' },
      { ...report, coreVersion: '0.0.0' },
      { ...report, checks: report.checks.map((check) => ({ ...check, sha256: '0'.repeat(64) })) },
    ]) {
      await save(altered);
      await expect(read(env)).rejects.toThrow('RECOVERY_CONFIGURATION_INVALID');
    }
    await save(report);
    await chmod(env.RECOVERY_OPENBAO_TOKEN_FILE, 0o644);
    await expect(read(env)).rejects.toThrow('RECOVERY_CONFIGURATION_INVALID');
    await chmod(env.RECOVERY_OPENBAO_TOKEN_FILE, 0o600);
    await chmod(join(directory, 'evm.json'), 0o666);
    await expect(read(env)).rejects.toThrow('RECOVERY_CONFIGURATION_INVALID');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
