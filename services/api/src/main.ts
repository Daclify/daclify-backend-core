import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { NativeChainGateway } from './native-chain.js';
import { migrate } from './store.js';
import { createServer } from './server.js';
import { PinataStorage } from './content/pinata.js';
import { ContentService } from './content/service.js';
import { startContentWorker } from './content/jobs.js';
import { Uint64Schema } from '../../../protocol/base.js';
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
    NETWORK_ENVIRONMENT: z.enum(['local', 'testnet', 'mainnet']).default('local'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3008),
    PINATA_JWT: z.string().min(1).optional(),
    CONTENT_GATEWAY: z.url().optional(),
    CONTENT_FREE_STORAGE_BYTES: Uint64Schema.default('0'),
  })
  .safeParse(process.env);
if (!configuration.success) throw new Error('API_CONFIGURATION_INVALID');
const env = configuration.data;
if (!!env.BOOTSTRAP_OWNER !== !!env.BOOTSTRAP_PRIVATE_KEY)
  throw new Error('Bootstrap owner and key must be configured together');
if (!!env.PINATA_JWT !== !!env.CONTENT_GATEWAY) throw new Error('PINATA_CONFIGURATION_INVALID');
function privateKey(value: string): PrivateKey {
  try {
    return PrivateKey.from(value);
  } catch {
    throw new Error('SIGNING_KEY_CONFIGURATION_INVALID');
  }
}
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
await migrate(pool);
const chain = new NativeChainGateway({
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
});
const content =
  env.PINATA_JWT && env.CONTENT_GATEWAY
    ? new ContentService(
        pool,
        chain,
        new PinataStorage(env.PINATA_JWT, env.CONTENT_GATEWAY),
        BigInt(env.CONTENT_FREE_STORAGE_BYTES),
      )
    : undefined;
const app = await createServer(pool, chain, env.FRONTEND_ORIGIN, content ? { content } : {});
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
