import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { MiniAppConnectionSchema, VERSION } from '@daclify/core-protocol';
import { VERSION as modulesVersion } from '@daclify/modules';
const bundle = MiniAppConnectionSchema.parse(JSON.parse(await readFile(process.argv[2], 'utf8')));
if (bundle.coreVersion !== VERSION || bundle.modulesVersion !== modulesVersion)
  throw new Error('MINI_APP_RELEASE_VERSION');
if (
  bundle.starterUrl !==
  bundle.binding.issuer + '/v1/mini-apps/releases/' + bundle.releaseId + '/files/starter.tgz'
)
  throw new Error('MINI_APP_RELEASE_ORIGIN');
const b = bundle.binding;
await mkdir('data', { recursive: true });
const lines = {
  DACLIFY_ISSUER: b.issuer,
  DACLIFY_FRONTEND_ORIGIN: bundle.frontendOrigin,
  DACLIFY_CLIENT_ID: b.clientId,
  DACLIFY_CHAIN_ID: b.chainId,
  DACLIFY_RUNTIME: b.runtime,
  DACLIFY_DAO_ID: b.daoId,
  DACLIFY_APP_ID: b.appId,
  DACLIFY_ACTIVITY_ACCOUNT: bundle.activityAccount,
  MINI_APP_ORIGIN: new URL(bundle.callbackUrl).origin,
  MINI_APP_DATABASE_ENGINE: 'sqlite',
  MINI_APP_DB: './data/app.sqlite',
  MINI_APP_PERSISTENT_VOLUME: '0',
  MINI_APP_CLEANUP_EXCLUSIONS_DIRECTORY: '/private/app-exclusions',
  MINI_APP_MAX_BACKUP_AGE_SECONDS: '86400',
  MINI_APP_TLS_CERT: '/private/local/certificate.pem',
  MINI_APP_TLS_KEY: '/private/local/private-key.pem',
};
await writeFile(
  '.env.example',
  Object.entries(lines)
    .map(([key, value]) => key + '=' + JSON.stringify(value))
    .join('\n') + '\n',
  { mode: 0o600, flag: 'wx' },
);
process.stdout.write(
  'Created public connection settings in .env.example. Configure durable storage and TLS locally.\n',
);
