import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { parseEnvFile } from '../services/api/src/env-file.js';
import { parseModuleDeployments } from '../services/api/src/deployment-config.js';

it('documents complete API settings separately from deployment credentials', () => {
  const optional = [
    'BOOTSTRAP_OWNER',
    'BOOTSTRAP_PRIVATE_KEY',
    'PINATA_JWT',
    'CONTENT_GATEWAY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_ID',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_TLS_MODE',
    'SMTP_FROM',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
    'TELEGRAM_OIDC_CLIENT_ID',
    'TELEGRAM_OIDC_CLIENT_SECRET',
    'TELEGRAM_OIDC_REDIRECT_URI',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_BOT_USERNAME',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_PUBLIC_JWK',
    'OPENROUTER_API_KEY',
    'OPENROUTER_MODEL',
    'OPENROUTER_DECISIONS_MODEL',
  ];
  for (const file of [
    '.env.example',
    '.env.develop.example',
    '.env.testnet.example',
    '.env.production.example',
  ]) {
    const text = readFileSync(file, 'utf8');
    const values = parseEnvFile(text);
    expect(values).not.toHaveProperty('DEPLOYER_PRIVATE_KEY');
    expect(values).not.toHaveProperty('DACLIFY_ENV_FILE');
    expect(parseModuleDeployments(values.MODULE_DEPLOYMENTS ?? '')).not.toHaveLength(0);
    for (const key of optional)
      expect(text, `${file}: ${key}`).toMatch(new RegExp(`^# ${key}=`, 'm'));
  }
  for (const profile of ['develop', 'testnet', 'production']) {
    const values = parseEnvFile(readFileSync(`.env.deploy.${profile}.example`, 'utf8'));
    expect(Object.keys(values)).toEqual(['DEPLOYER_PRIVATE_KEY']);
  }
});

it('refuses to start an API process containing a deployer credential without printing it', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'daclify-env-'));
  try {
    const file = path.join(directory, 'api.env');
    const credential = 'synthetic-deployer-credential';
    writeFileSync(file, `DEPLOYER_PRIVATE_KEY=${credential}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env, DACLIFY_ENV_FILE: file };
    delete env.DEPLOYER_PRIVATE_KEY;
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'services/api/src/load-local-env.ts'],
      {
        env,
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('DEPLOYER_KEY_IN_API_ENVIRONMENT');
    expect(result.stderr).not.toContain(credential);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
