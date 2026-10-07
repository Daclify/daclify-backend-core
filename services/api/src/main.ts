import { CreationService } from './creation.js';
import './load-local-env.js';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { importJWK } from 'jose';
import { z } from 'zod';
import type { ProviderConfiguration } from './auth/linking.js';
import { readMailDelivery } from './auth/mail.js';
import { readTelegramOidc } from './auth/telegram-oidc.js';
import { NativeChainGateway } from './native-chain.js';
import { migrate } from './store.js';
import { createServer } from './server.js';
import { PinataStorage } from './content/pinata.js';
import { ContentService } from './content/service.js';
import { startContentWorker } from './content/jobs.js';
import { Uint64Schema } from '../../../protocol/base.js';
import { parseModuleDeployments } from './deployment-config.js';
import { readStripeConfig } from './billing/config.js';
import { StripeBilling } from './billing/service.js';
import { readDocsAgent } from './docs/config.js';
const configuration = z
  .object({
    DATABASE_URL: z.url(),
    FRONTEND_ORIGIN: z.url(),
    CHAIN_RPC_URL: z.url(),
    CHAIN_ID: z.string().regex(/^[0-9a-f]{64}$/),
    RUNTIME_ACCOUNT: z.string(),
    RELAY_ACCOUNT: z.string(),
    RELAY_PRIVATE_KEY: z.string(),
    HUB_ACCOUNT: z.string().optional(),
    BOOTSTRAP_OWNER: z.string().optional(),
    BOOTSTRAP_PRIVATE_KEY: z.string().optional(),
    NETWORK_ENVIRONMENT: z.enum(['local', 'testnet', 'mainnet']),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3008),
    PINATA_JWT: z.string().min(1).optional(),
    CONTENT_GATEWAY: z.url().optional(),
    CONTENT_FREE_STORAGE_BYTES: Uint64Schema.default('0'),
    GOOGLE_CLIENT_ID: z.string().min(1).max(256).optional(),
    GOOGLE_PUBLIC_JWK: z.string().min(1).max(8192).optional(),
    TELEGRAM_BOT_TOKEN: z
      .string()
      .regex(/^\d+:[A-Za-z0-9_-]+$/)
      .optional(),
    TELEGRAM_BOT_USERNAME: z
      .string()
      .regex(/^[A-Za-z0-9_]{5,32}$/)
      .optional(),
    MODULE_DEPLOYMENTS: z.string().min(2).optional(),
  })
  .safeParse(process.env);
if (!configuration.success) throw new Error('API_CONFIGURATION_INVALID');
const env = configuration.data;
if (!!env.BOOTSTRAP_OWNER !== !!env.BOOTSTRAP_PRIVATE_KEY)
  throw new Error('Bootstrap owner and key must be configured together');
if (!!env.PINATA_JWT !== !!env.CONTENT_GATEWAY) throw new Error('PINATA_CONFIGURATION_INVALID');
if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_PUBLIC_JWK)
  throw new Error('GOOGLE_CONFIGURATION_INVALID');
function privateKey(value: string): PrivateKey {
  try {
    return PrivateKey.from(value);
  } catch {
    throw new Error('SIGNING_KEY_CONFIGURATION_INVALID');
  }
}
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
await migrate(pool);
const chain = new NativeChainGateway(
  {
    rpcUrl: env.CHAIN_RPC_URL,
    chainId: env.CHAIN_ID,
    runtime: env.RUNTIME_ACCOUNT,
    hub: env.HUB_ACCOUNT ?? null,
    environment: env.NETWORK_ENVIRONMENT,
    relayActor: env.RELAY_ACCOUNT,
    relayKey: privateKey(env.RELAY_PRIVATE_KEY),
    ...(env.BOOTSTRAP_OWNER && env.BOOTSTRAP_PRIVATE_KEY
      ? { bootstrap: { owner: env.BOOTSTRAP_OWNER, key: privateKey(env.BOOTSTRAP_PRIVATE_KEY) } }
      : {}),
    ...(env.MODULE_DEPLOYMENTS ? { modules: parseModuleDeployments(env.MODULE_DEPLOYMENTS) } : {}),
  },
  pool,
);
const content =
  env.PINATA_JWT && env.CONTENT_GATEWAY
    ? new ContentService(
        pool,
        chain,
        new PinataStorage(env.PINATA_JWT, env.CONTENT_GATEWAY),
        BigInt(env.CONTENT_FREE_STORAGE_BYTES),
      )
    : undefined;
const providers: ProviderConfiguration = {};
const telegramOidc = readTelegramOidc(process.env);
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_PUBLIC_JWK) {
  try {
    const parsed: unknown = JSON.parse(env.GOOGLE_PUBLIC_JWK);
    const jwk = z
      .object({ kty: z.literal('RSA') })
      .passthrough()
      .parse(parsed);
    providers.google = { clientId: env.GOOGLE_CLIENT_ID, key: await importJWK(jwk, 'RS256') };
  } catch {
    throw new Error('GOOGLE_CONFIGURATION_INVALID');
  }
}
if (env.TELEGRAM_BOT_USERNAME && !env.TELEGRAM_BOT_TOKEN)
  throw new Error('TELEGRAM_CONFIGURATION_INVALID');
if (env.TELEGRAM_BOT_TOKEN || telegramOidc) {
  providers.telegram = {
    ...(env.TELEGRAM_BOT_TOKEN ? { botToken: env.TELEGRAM_BOT_TOKEN } : {}),
    ...(telegramOidc ? { oidc: telegramOidc } : {}),
    ...(env.TELEGRAM_BOT_USERNAME ? { botUsername: env.TELEGRAM_BOT_USERNAME } : {}),
  };
}
const stripeConfig = readStripeConfig(process.env);
const docs = readDocsAgent(process.env);
const creation = new CreationService(pool, chain);
const deliverEmail = readMailDelivery(process.env);
const app = await createServer(pool, chain, env.FRONTEND_ORIGIN, {
  creation,
  ...(content ? { content } : {}),
  ...(providers.google || providers.telegram ? { providers } : {}),
  ...(stripeConfig
    ? { billing: new StripeBilling(pool, stripeConfig, env.FRONTEND_ORIGIN, chain, creation) }
    : {}),
  signIn: { environment: env.NETWORK_ENVIRONMENT, ...(deliverEmail ? { deliverEmail } : {}) },
  ...(docs ? { docs } : {}),
});
await app.listen({ host: '127.0.0.1', port: env.API_PORT });
const worker = content ? startContentWorker(pool, content) : undefined;
async function shutdown() {
  await app.close();
  await worker?.stop();
  await pool.end();
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
console.log(
  `Daclify API listening on 127.0.0.1:${env.API_PORT}; ${env.NETWORK_ENVIRONMENT} configuration.`,
);
