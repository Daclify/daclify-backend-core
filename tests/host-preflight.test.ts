import { expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrivateKey } from '@wharfkit/antelope';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../sdk/generated/releases.js';
import {
  validateHostEnvironment,
  validateQualification,
  validateReleaseSource,
  validateReleasePins,
  validateEnvironmentFilePermissions,
} from '../tools/host/preflight.js';

it('rejects exposed source env files and cannot bypass permissions with a fake credential directory', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'daclify-env-permissions-'));
  const filename = path.join(directory, 'api.env');
  try {
    writeFileSync(filename, 'NETWORK_ENVIRONMENT=testnet\n', { mode: 0o600 });
    expect(() => validateEnvironmentFilePermissions(filename, directory)).not.toThrow();
    for (const mode of [0o640, 0o440, 0o644]) {
      chmodSync(filename, mode);
      expect(() => validateEnvironmentFilePermissions(filename, directory)).toThrow(
        'ENV_FILE_PERMISSIONS',
      );
    }
    chmodSync(filename, 0o400);
    expect(() => validateEnvironmentFilePermissions(filename, directory)).not.toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('binds mainnet releases to main and testnet releases to dev', () => {
  const source = {
    environment: 'mainnet',
    branch: 'main',
    coreCommit: 'a'.repeat(40),
    modulesCommit: 'b'.repeat(40),
  };
  expect(validateReleaseSource('mainnet', source).branch).toBe('main');
  expect(
    validateReleaseSource('testnet', { ...source, environment: 'testnet', branch: 'dev' }).branch,
  ).toBe('dev');
  expect(() => validateReleaseSource('testnet', source)).toThrow(
    'RELEASE_BRANCH_ENVIRONMENT_MISMATCH',
  );
  expect(() => validateReleaseSource('mainnet', { ...source, branch: 'dev' })).toThrow(
    'RELEASE_BRANCH_ENVIRONMENT_MISMATCH',
  );
  expect(() => validateReleaseSource('testnet', { ...source, environment: 'testnet' })).toThrow(
    'RELEASE_BRANCH_ENVIRONMENT_MISMATCH',
  );
});

function environment() {
  return {
    DATABASE_URL: 'postgres://daclify_mainnet_app:fixture@127.0.0.1:5432/daclify_mainnet',
    FRONTEND_ORIGIN: 'https://app.daclify.com',
    API_PUBLIC_ORIGIN: 'https://api.daclify.com',
    CHAIN_RPC_URL: 'https://telos.caleos.io',
    CHAIN_ID: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
    RUNTIME_ACCOUNT: 'core.we',
    HUB_ACCOUNT: 'hub.we',
    RELAY_ACCOUNT: 'relay.we',
    RELAY_PRIVATE_KEY: PrivateKey.generate('K1').toString(),
    API_RELEASE_MANIFEST: '/fixture/manifest.json',
    API_HUB_CODE_HASH: 'ab'.repeat(32),
    NETWORK_ENVIRONMENT: 'mainnet',
    API_PORT: '3018',
    MODULE_DEPLOYMENTS: '[]',
  };
}

it('rejects swapped ports, networks, database roles and unapproved frontend origins', () => {
  expect(validateHostEnvironment('mainnet', environment())).toEqual([]);
  for (const changed of [
    { API_PORT: '3028' },
    { NETWORK_ENVIRONMENT: 'testnet' },
    { DATABASE_URL: 'postgres://daclify_testnet_app:fixture@127.0.0.1:5432/daclify_testnet' },
    { FRONTEND_ORIGIN: 'https://testnet.app.daclify.com' },
    { API_PUBLIC_ORIGIN: 'https://testnet.api.daclify.com' },
    { FRONTEND_ADDITIONAL_ORIGINS: '["https://unapproved.example"]' },
    { CHAIN_ID: '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f' },
    { DEPLOYER_PRIVATE_KEY: 'fixture' },
    { RELAY_PRIVATE_KEY: 'replace-with-real-key' },
  ])
    expect(() => validateHostEnvironment('mainnet', { ...environment(), ...changed })).toThrow();
});

it('rejects Stripe test credentials on mainnet and refuses an unqualified mainnet release', () => {
  expect(() =>
    validateHostEnvironment('mainnet', {
      ...environment(),
      STRIPE_SECRET_KEY: 'sk_test_fixture000000000000',
      STRIPE_WEBHOOK_SECRET: 'whsec_fixture000000',
      STRIPE_PRICE_ID: 'price_fixture',
    }),
  ).toThrow('MAINNET_STRIPE_TEST_KEY');
  const manifest = {
    qualified: false,
    publication: 'refused',
    artifacts: { runtimeCodeHash: RuntimeCodeHash, runtimeRawAbiSha256: RuntimeRawAbiHash },
    moduleCodeHashes: {},
    checks: { held: ['review'] },
  };
  expect(() => validateQualification('mainnet', manifest)).toThrow('MAINNET_RELEASE_UNQUALIFIED');
  expect(validateQualification('testnet', manifest).qualified).toBe(false);
  expect(() =>
    validateQualification('mainnet', { ...manifest, qualified: true, publication: 'released' }),
  ).toThrow();
});

it('refuses stale release manifests even when they match an older on-chain deployment', () => {
  const manifest = validateQualification('testnet', {
    qualified: false,
    publication: 'refused',
    artifacts: { runtimeCodeHash: RuntimeCodeHash, runtimeRawAbiSha256: RuntimeRawAbiHash },
    moduleCodeHashes: ModuleCodeHashes,
    checks: { held: [] },
  });
  const modules = [{ id: 'decide' as const, account: 'daclifydecid' }];
  expect(() => validateReleasePins(manifest, modules)).not.toThrow();
  expect(() =>
    validateReleasePins(
      {
        ...manifest,
        artifacts: {
          ...manifest.artifacts,
          runtimeCodeHash: 'ab'.repeat(32),
        },
      },
      modules,
    ),
  ).toThrow('RELEASE_RUNTIME_PIN_MISMATCH');
  expect(() =>
    validateReleasePins(
      {
        ...manifest,
        artifacts: {
          ...manifest.artifacts,
          runtimeRawAbiSha256: 'ab'.repeat(32),
        },
      },
      modules,
    ),
  ).toThrow('RELEASE_RUNTIME_PIN_MISMATCH');
  expect(() =>
    validateReleasePins(
      {
        ...manifest,
        moduleCodeHashes: {
          ...manifest.moduleCodeHashes,
          decide: 'ab'.repeat(32),
        },
      },
      modules,
    ),
  ).toThrow('RELEASE_MODULE_PIN_MISMATCH:decide');
});

it('requires Pinata storage settings together and supports Connect without legacy billing', () => {
  expect(() =>
    validateHostEnvironment('mainnet', {
      ...environment(),
      PINATA_JWT: 'fixture',
      CONTENT_GATEWAY: 'https://gateway.example.org',
    }),
  ).toThrow('PINATA_CONFIGURATION');
  expect(() =>
    validateHostEnvironment('mainnet', {
      ...environment(),
      CONTENT_GATEWAY_KEY: 'fixture',
    }),
  ).toThrow('PINATA_CONFIGURATION');
  const pinata = {
    ...environment(),
    PINATA_JWT: 'fixture',
    PINATA_STORAGE_SCOPE: 'fixture-mainnet-pinata-account',
    CONTENT_GATEWAY: 'https://gateway.example.org',
  };
  expect(() => validateHostEnvironment('mainnet', pinata)).toThrow('CONTENT_GATEWAY_KEY_REQUIRED');
  expect(
    validateHostEnvironment('mainnet', {
      ...pinata,
      CONTENT_GATEWAY_KEY: 'fixture-gateway-key',
    }),
  ).toEqual([]);
  const { PINATA_STORAGE_SCOPE: scope, ...legacy } = pinata;
  expect(
    validateHostEnvironment('mainnet', {
      ...legacy,
      PINATA_ACCOUNT_ID: scope,
      CONTENT_GATEWAY_KEY: 'fixture-gateway-key',
    }),
  ).toEqual([]);
  expect(() =>
    validateHostEnvironment('mainnet', {
      ...pinata,
      PINATA_ACCOUNT_ID: 'different-owner',
      CONTENT_GATEWAY_KEY: 'fixture-gateway-key',
    }),
  ).toThrow('PINATA_STORAGE_SCOPE_CONFLICT');
  expect(() =>
    validateHostEnvironment('mainnet', {
      ...pinata,
      CONTENT_GATEWAY_KEY: 'fixture-gateway-key',
      CONTENT_GATEWAY: 'https://gateway.example.org/ipfs/',
    }),
  ).toThrow('CONTENT_GATEWAY');
  expect(
    validateHostEnvironment('mainnet', {
      ...environment(),
      STRIPE_SECRET_KEY: 'sk_live_fixture000000000000',
      STRIPE_CONNECT_CLIENT_ID: 'ca_fixture',
      STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_fixture000000000000',
    }),
  ).toEqual([]);
});
