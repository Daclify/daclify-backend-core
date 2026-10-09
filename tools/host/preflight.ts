import { readFileSync, realpathSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { z } from 'zod';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../../sdk/generated/releases.js';
import { parseEnvFile } from '../../services/api/src/env-file.js';
import {
  parseFrontendOrigins,
  parseModuleDeployments,
} from '../../services/api/src/deployment-config.js';
import { collectDeployment } from '../../services/api/src/deployment-check.js';
import { readStripeConfig } from '../../services/api/src/billing/config.js';
import { mailConfiguration } from '../../services/api/src/auth/mail.js';
import { readTelegramOidc } from '../../services/api/src/auth/telegram-oidc.js';
import { readDocsAgent } from '../../services/api/src/docs/config.js';
import { ProviderScopeSchema } from '../../services/api/src/content/ledger.js';
import { PinataStorage } from '../../services/api/src/content/pinata.js';
import { readConnectConfig } from '../../services/api/src/payments/config.js';
import { readHostingConfig } from '../../services/api/src/billing/hosting-config.js';
import { readStorageConfig } from '../../services/api/src/billing/storage-config.js';
import { readRamCardConfig } from '../../services/api/src/resources/card-config.js';
import { readArchiveBackupConfig } from '../../services/api/src/archive/backup.js';

export const HostEnvironment = z.enum(['mainnet', 'testnet']);
type HostEnvironment = z.infer<typeof HostEnvironment>;
const ReleaseSource = z.object({
  environment: HostEnvironment,
  branch: z.enum(['main', 'dev']),
  coreCommit: z.string().regex(/^[0-9a-f]{40}$/),
  modulesCommit: z.string().regex(/^[0-9a-f]{40}$/),
});

export function validateReleaseSource(environment: HostEnvironment, value: unknown) {
  const source = ReleaseSource.parse(value);
  if (
    source.environment !== environment ||
    source.branch !== (environment === 'mainnet' ? 'main' : 'dev')
  )
    throw new Error('RELEASE_BRANCH_ENVIRONMENT_MISMATCH');
  return source;
}
const chainIds = {
  mainnet: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
  testnet: '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
};
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const Manifest = z.object({
  qualified: z.boolean(),
  publication: z.string(),
  artifacts: z.object({ runtimeCodeHash: hash, runtimeRawAbiSha256: hash }),
  moduleCodeHashes: z.record(z.string(), hash),
  checks: z.object({ held: z.array(z.string()) }),
});

export function validateHostEnvironment(environment: HostEnvironment, env: Record<string, string>) {
  for (const field of [
    'DATABASE_URL',
    'FRONTEND_ORIGIN',
    'API_PUBLIC_ORIGIN',
    'CHAIN_RPC_URL',
    'CHAIN_ID',
    'RUNTIME_ACCOUNT',
    'HUB_ACCOUNT',
    'RELAY_ACCOUNT',
    'RELAY_PRIVATE_KEY',
    'API_RELEASE_MANIFEST',
    'API_HUB_CODE_HASH',
  ]) {
    if (!env[field] || /replace|\.example/i.test(env[field])) throw new Error(`MISSING:${field}`);
  }
  if (env.DEPLOYER_PRIVATE_KEY) throw new Error('DEPLOYER_KEY_IN_API_ENVIRONMENT');
  if (env.NETWORK_ENVIRONMENT !== environment) throw new Error('NETWORK_ENVIRONMENT');
  if (env.API_PORT !== (environment === 'mainnet' ? '3018' : '3028')) throw new Error('API_PORT');
  const url = new URL(env.DATABASE_URL ?? '');
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5432' ||
    url.username !== `daclify_${environment}_app` ||
    url.pathname !== `/daclify_${environment}` ||
    !url.password
  )
    throw new Error('DATABASE_ISOLATION');
  const origins = parseFrontendOrigins(env.FRONTEND_ORIGIN ?? '', env.FRONTEND_ADDITIONAL_ORIGINS);
  const frontend =
    environment === 'mainnet' ? 'https://app.daclify.com' : 'https://testnet.app.daclify.com';
  if (origins.length !== 1 || origins[0] !== frontend)
    throw new Error('FRONTEND_ORIGINS_NOT_APPROVED');
  if (
    env.API_PUBLIC_ORIGIN !==
    `https://${environment === 'mainnet' ? 'api' : 'testnet.api'}.daclify.com`
  )
    throw new Error('API_PUBLIC_ORIGIN');
  if (
    env.CHAIN_ID !== chainIds[environment] ||
    new URL(env.CHAIN_RPC_URL ?? '').protocol !== 'https:'
  )
    throw new Error('CHAIN_CONFIGURATION');
  for (const field of ['RUNTIME_ACCOUNT', 'HUB_ACCOUNT', 'RELAY_ACCOUNT'])
    if (!/^[a-z1-5.]{1,12}$/.test(env[field] ?? '')) throw new Error(`ACCOUNT:${field}`);
  for (const field of ['RELAY_PRIVATE_KEY', 'BOOTSTRAP_PRIVATE_KEY']) {
    if (env[field]) {
      try {
        PrivateKey.from(env[field]);
      } catch {
        throw new Error(`SIGNING_KEY:${field}`);
      }
    }
  }
  if (!!env.BOOTSTRAP_OWNER !== !!env.BOOTSTRAP_PRIVATE_KEY)
    throw new Error('BOOTSTRAP_CONFIGURATION');
  if (
    !!env.PINATA_JWT !== !!env.CONTENT_GATEWAY ||
    !!env.PINATA_JWT !== !!env.PINATA_ACCOUNT_ID ||
    ((env.CONTENT_GATEWAY_KEY || env.CONTENT_GATEWAY_BUDGET_ID) && !env.PINATA_JWT)
  )
    throw new Error('PINATA_CONFIGURATION');
  if (env.PINATA_ACCOUNT_ID) ProviderScopeSchema.parse(env.PINATA_ACCOUNT_ID);
  if (env.CONTENT_GATEWAY_BUDGET_ID) z.uuid().parse(env.CONTENT_GATEWAY_BUDGET_ID);
  if (env.PINATA_JWT) {
    if (!env.CONTENT_GATEWAY_KEY) throw new Error('CONTENT_GATEWAY_KEY_REQUIRED');
    new PinataStorage(env.PINATA_JWT, env.CONTENT_GATEWAY ?? '', env.CONTENT_GATEWAY_KEY);
  }
  if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_PUBLIC_JWK) throw new Error('GOOGLE_CONFIGURATION');
  if (env.STRIPE_PRICE_ID || env.STRIPE_WEBHOOK_SECRET) readStripeConfig(env, environment);
  readConnectConfig(env, environment, frontend);
  readHostingConfig(env, environment, frontend);
  const storage = readStorageConfig(
    env,
    environment,
    frontend,
    env.PINATA_ACCOUNT_ID ?? 'unconfigured',
  );
  if (storage && !env.PINATA_JWT) throw new Error('STORAGE_CONFIGURATION_INVALID');
  readRamCardConfig(env, environment, frontend);
  if (readArchiveBackupConfig(env) && !env.PINATA_JWT)
    throw new Error('ARCHIVE_BACKUP_CONTENT_REQUIRED');
  if (
    environment === 'mainnet' &&
    env.STRIPE_SECRET_KEY &&
    !/^(rk|sk)_live_/.test(env.STRIPE_SECRET_KEY)
  )
    throw new Error('MAINNET_STRIPE_TEST_KEY');
  mailConfiguration(env);
  const oidc = readTelegramOidc(env);
  if (
    oidc &&
    env.TELEGRAM_OIDC_REDIRECT_URI !==
      `https://${environment === 'mainnet' ? 'api' : 'testnet.api'}.daclify.com/v1/sign-in/telegram/oidc/callback`
  )
    throw new Error('TELEGRAM_CALLBACK');
  readDocsAgent(env);
  hash.parse(env.API_HUB_CODE_HASH);
  return parseModuleDeployments(env.MODULE_DEPLOYMENTS ?? '[]');
}

export function validateQualification(environment: HostEnvironment, value: unknown) {
  const manifest = Manifest.parse(value);
  if (
    environment === 'mainnet' &&
    (!manifest.qualified || manifest.publication === 'refused' || manifest.checks.held.length)
  )
    throw new Error('MAINNET_RELEASE_UNQUALIFIED');
  return manifest;
}

export function validateReleasePins(
  manifest: ReturnType<typeof validateQualification>,
  modules: ReturnType<typeof parseModuleDeployments>,
) {
  if (
    manifest.artifacts.runtimeCodeHash !== RuntimeCodeHash ||
    manifest.artifacts.runtimeRawAbiSha256 !== RuntimeRawAbiHash
  )
    throw new Error('RELEASE_RUNTIME_PIN_MISMATCH');
  for (const module of modules)
    if (manifest.moduleCodeHashes[module.id] !== ModuleCodeHashes[module.id])
      throw new Error(`RELEASE_MODULE_PIN_MISMATCH:${module.id}`);
}

export function validateEnvironmentFilePermissions(
  filename: string,
  credentialsDirectory = process.env.CREDENTIALS_DIRECTORY,
) {
  const directory = credentialsDirectory ? realpathSync(credentialsDirectory) : undefined;
  const credential =
    directory?.startsWith('/run/credentials/') &&
    realpathSync(filename) === path.join(directory, 'api.env');
  // systemd uses a read-only ACL for this service, reflected in the group mask.
  const forbidden = credential ? 0o337 : 0o077;
  const metadata = statSync(filename);
  if (!metadata.isFile() || metadata.mode & forbidden) throw new Error('ENV_FILE_PERMISSIONS');
}

async function preflight() {
  const environment = HostEnvironment.parse(process.argv[2]);
  const coreDirectory = realpathSync(process.cwd());
  const releaseDirectory = path.dirname(coreDirectory);
  if (!releaseDirectory.startsWith(`/data/daclify-api/${environment}/releases/`))
    throw new Error('RELEASE_ENVIRONMENT_MISMATCH');
  const source = validateReleaseSource(
    environment,
    JSON.parse(readFileSync(path.join(releaseDirectory, 'source.json'), 'utf8')),
  );
  for (const revision of [
    { directory: coreDirectory, commit: source.coreCommit },
    {
      directory: path.join(releaseDirectory, 'daclify-backend-modules'),
      commit: source.modulesCommit,
    },
  ]) {
    const actual = execFileSync(
      '/usr/bin/git',
      ['-c', `safe.directory=${revision.directory}`, '-C', revision.directory, 'rev-parse', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    if (actual !== revision.commit) throw new Error('RELEASE_SOURCE_CHANGED');
  }
  const envPath = process.env.DACLIFY_ENV_FILE ?? `/data/daclify-env/${environment}.env`;
  validateEnvironmentFilePermissions(envPath);
  const env = parseEnvFile(readFileSync(envPath, 'utf8'));
  const modules = validateHostEnvironment(environment, env);
  const manifestPath = realpathSync(path.resolve(coreDirectory, env.API_RELEASE_MANIFEST ?? ''));
  if (!manifestPath.startsWith(`${coreDirectory}/`))
    throw new Error('RELEASE_MANIFEST_OUTSIDE_RELEASE');
  const manifest = validateQualification(
    environment,
    JSON.parse(readFileSync(manifestPath, 'utf8')),
  );
  validateReleasePins(manifest, modules);
  const accounts = [
    { account: env.RUNTIME_ACCOUNT ?? '', expectedHash: manifest.artifacts.runtimeCodeHash },
    { account: env.HUB_ACCOUNT ?? '', expectedHash: env.API_HUB_CODE_HASH ?? '' },
    ...modules.map((module) => {
      const expectedHash = manifest.moduleCodeHashes[module.id];
      if (!expectedHash) throw new Error(`MODULE_PIN:${module.id}`);
      return { account: module.account, expectedHash };
    }),
  ];
  const report = await collectDeployment(env.CHAIN_RPC_URL ?? '', fetch, accounts, env.CHAIN_ID);
  if (!report.ok) throw new Error(`CHAIN_CHECK:${report.failures.join(',')}`);
  const abiResponse = await fetch(`${env.CHAIN_RPC_URL}/v1/chain/get_raw_abi`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: env.RUNTIME_ACCOUNT }),
    signal: AbortSignal.timeout(20000),
  });
  if (
    !abiResponse.ok ||
    z.object({ abi_hash: hash }).parse(await abiResponse.json()).abi_hash !== RuntimeRawAbiHash
  )
    throw new Error('CHAIN_RUNTIME_ABI_MISMATCH');
  const relay = z.object({
    permissions: z.array(
      z.object({
        perm_name: z.string(),
        required_auth: z.object({
          threshold: z.number(),
          keys: z.array(z.object({ key: z.string(), weight: z.number() })),
        }),
      }),
    ),
  });
  const response = await fetch(`${env.CHAIN_RPC_URL}/v1/chain/get_account`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: env.RELAY_ACCOUNT }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('RELAY_ACCOUNT_UNAVAILABLE');
  const permission = relay
    .parse(await response.json())
    .permissions.find((row) => row.perm_name === 'active');
  const publicKey = PrivateKey.from(env.RELAY_PRIVATE_KEY ?? '')
    .toPublic()
    .toString();
  if (
    !permission ||
    !permission.required_auth.keys.some(
      (key) => key.key === publicKey && key.weight >= permission.required_auth.threshold,
    )
  )
    throw new Error('RELAY_KEY_AUTHORITY');
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const result = await pool.query<{
      database: string;
      role: string;
      superuser: boolean;
      cross_access: boolean;
    }>(
      `SELECT current_database() AS database, current_user AS role, rolsuper AS superuser,
       has_database_privilege(current_user,$1,'CONNECT') AS cross_access FROM pg_roles WHERE rolname=current_user`,
      [`daclify_${environment === 'mainnet' ? 'testnet' : 'mainnet'}`],
    );
    const row = result.rows[0];
    if (
      !row ||
      row.database !== `daclify_${environment}` ||
      row.role !== `daclify_${environment}_app` ||
      row.superuser ||
      row.cross_access
    )
      throw new Error('DATABASE_ISOLATION');
  } finally {
    await pool.end();
  }
  console.log(
    `${environment}: configuration, chain hashes, relay authority and database checks passed.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  preflight().catch((error: unknown) => {
    // Validation and provider errors can contain secrets. Print only deliberate codes.
    const message =
      error instanceof Error && /^[A-Z][A-Z0-9_:,.-]*$/.test(error.message)
        ? error.message
        : 'PREFLIGHT_FAILED';
    console.error(message);
    process.exitCode = 1;
  });
}
