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

it('allows an explicitly labelled single-host testnet report and rejects it on mainnet or another chain', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { VERSION } = await import('../protocol/base.js');
  const directory = await mkdtemp(join(tmpdir(), 'daclify-testnet-recovery-'));
  try {
    const origin = 'https://testnet.app.daclify.com';
    const evidence = JSON.stringify({
      status: 'passed',
      kind: 'testnet-local-restore',
      origin,
      coreVersion: VERSION,
      independentHost: false,
      sourceUnavailable: true,
      originalKeyRecovered: true,
      leastPrivilegeDenials: 4,
      auditPlaintextExcluded: true,
      tlsVerified: true,
    });
    await writeFile(join(directory, 'local-restore.json'), evidence, { mode: 0o600 });
    await writeFile(join(directory, 'token'), 'test-only-restricted-token', { mode: 0o600 });
    const report = {
      mode: 'testnet-single-host',
      version: 1,
      coreVersion: VERSION,
      origin,
      keyServiceOrigin: 'https://127.0.0.1:18200',
      storeScope: 'testnet.recovery:v1',
      issuedAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      host: 'one-testnet-host',
      independentHost: false,
      reviewedBy: 'test-fixture',
      checks: [
        {
          kind: 'testnet-local-restore',
          file: 'local-restore.json',
          sha256: createHash('sha256').update(evidence).digest('hex'),
        },
      ],
    };
    const env = {
      RECOVERY_ENABLED: '1',
      RECOVERY_MODE: 'testnet-single-host',
      NETWORK_ENVIRONMENT: 'testnet',
      CHAIN_ID: '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
      RECOVERY_OPENBAO_ADDRESS: report.keyServiceOrigin,
      RECOVERY_OPENBAO_TOKEN_FILE: join(directory, 'token'),
      RECOVERY_QUALIFICATION_FILE: join(directory, 'qualification.json'),
      FRONTEND_ORIGIN: origin,
      PINATA_JWT: 'test-only-provider-token',
      CONTENT_GATEWAY: 'https://gateway.example.test',
      PINATA_STORAGE_SCOPE: report.storeScope,
    };
    await writeFile(env.RECOVERY_QUALIFICATION_FILE, JSON.stringify(report), { mode: 0o600 });
    const config = await read(env);
    expect(config).toMatchObject({
      developmentOnly: true,
      assistedQualified: true,
      qualifiedWallets: [],
      passkeysQualified: false,
    });
    for (const altered of [
      { ...env, NETWORK_ENVIRONMENT: 'mainnet' },
      { ...env, NETWORK_ENVIRONMENT: undefined },
      { ...env, CHAIN_ID: '0'.repeat(64) },
      { ...env, RECOVERY_MODE: 'independent' },
      { ...env, RECOVERY_OPENBAO_ADDRESS: 'https://keys.example.test' },
    ])
      await expect(read(altered)).rejects.toThrow('RECOVERY_CONFIGURATION_INVALID');
    for (const altered of [
      { ...report, independentHost: true },
      { ...report, expiresAt: new Date(Date.now() + 8 * 86400000).toISOString() },
      { ...report, checks: [{ ...report.checks[0], sha256: '0'.repeat(64) }] },
    ]) {
      await writeFile(env.RECOVERY_QUALIFICATION_FILE, JSON.stringify(altered), { mode: 0o600 });
      await expect(read(env)).rejects.toThrow('RECOVERY_CONFIGURATION_INVALID');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
