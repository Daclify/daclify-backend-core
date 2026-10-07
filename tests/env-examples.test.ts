import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { parseEnvFile } from '../services/api/src/env-file.js';
import {
  parseFrontendOrigins,
  parseModuleDeployments,
} from '../services/api/src/deployment-config.js';

it('accepts exact browser origins and rejects wildcard, malformed and remote HTTP configuration', () => {
  expect(
    parseFrontendOrigins('https://testnet.app.example', '["https://dev.app.example:5198"]'),
  ).toEqual(['https://testnet.app.example', 'https://dev.app.example:5198']);
  expect(parseFrontendOrigins('http://testnet.localhost:5198')).toEqual([
    'http://testnet.localhost:5198',
  ]);
  expect(parseFrontendOrigins('https://app.example', '["https://app.example"]')).toEqual([
    'https://app.example',
  ]);
  const expanded = parseFrontendOrigins(
    'https://app.example',
    JSON.stringify(Array.from({ length: 8 }, (_, index) => `https://frontend${index}.example`)),
  );
  expect(parseFrontendOrigins('https://app.example', JSON.stringify(expanded))).toEqual(expanded);
  for (const value of [
    '*',
    '["*"]',
    '["https://*.example"]',
    '["http://remote.example"]',
    '["https://app.example/path"]',
    '["https://user:secret@app.example"]',
    'null',
    '{}',
  ]) {
    expect(() => parseFrontendOrigins('https://app.example', value)).toThrow(
      'FRONTEND_ORIGINS_INVALID',
    );
  }
  expect(() => parseFrontendOrigins('https://app.example/path')).toThrow(
    'FRONTEND_ORIGINS_INVALID',
  );
});

it('documents complete API settings separately from deployment credentials', () => {
  const optional = [
    'FRONTEND_ADDITIONAL_ORIGINS',
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
