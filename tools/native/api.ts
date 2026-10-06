import { loadEnvFile } from '../../services/api/src/env-file.js';
import { fixtureKey } from './keys.js';
// Disposable local fixture only. No key is printed or placed in process arguments.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { Pool } from 'pg';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { migrate } from '../../services/api/src/store.js';
import { createServer } from '../../services/api/src/server.js';
import { ContentService } from '../../services/api/src/content/service.js';
import { LocalContentFixture } from './content-fixture.js';
import { startContentWorker } from '../../services/api/src/content/jobs.js';
import { readDocsAgent } from '../../services/api/src/docs/config.js';
import { readStripeConfig } from '../../services/api/src/billing/config.js';
import { StripeBilling } from '../../services/api/src/billing/service.js';
loadEnvFile('.env');
function localTelegram(): { botToken: string; botUsername?: string } | undefined {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (token === undefined && username === undefined) return undefined;
  const parsed = z
    .object({
      token: z.string().regex(/^\d+:[A-Za-z0-9_-]+$/),
      username: z
        .string()
        .regex(/^[A-Za-z0-9_]{5,32}$/)
        .optional(),
    })
    .safeParse({ token, ...(username === undefined ? {} : { username }) });
  if (!parsed.success) throw new Error('TELEGRAM_CONFIGURATION_INVALID');
  return {
    botToken: parsed.data.token,
    ...(parsed.data.username ? { botUsername: parsed.data.username } : {}),
  };
}
const telegram = localTelegram();
const network = z
  .object({ url: z.literal('http://127.0.0.1:18888'), chainId: z.string() })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const pool = new Pool({
  connectionString: 'postgres://daclify:daclify-test-only@127.0.0.1:15432/daclify',
});
await migrate(pool);
const chain = new NativeChainGateway({
  rpcUrl: network.url,
  chainId: network.chainId,
  runtime: 'daclifycore',
  hub: 'daclifyhub',
  environment: 'local',
  relayActor: 'relay',
  relayKey: fixtureKey('relay'),
  bootstrap: { owner: 'alice', key: fixtureKey('alice') },
  modules: [
    { id: 'decide', account: 'decide' },
    { id: 'works', account: 'works' },
    { id: 'payroll', account: 'payroll' },
  ],
});
const content = new ContentService(
  pool,
  chain,
  new LocalContentFixture('.artifacts/native/content'),
  50n * 1024n * 1024n,
  'local-fixture',
);
const docs = readDocsAgent(process.env);
let stripeConfig: ReturnType<typeof readStripeConfig>;
try {
  stripeConfig = readStripeConfig(process.env);
} catch {
  stripeConfig = undefined;
  console.log('Card payments are not configured.');
}
const app = await createServer(pool, chain, 'http://127.0.0.1:5178', {
  content,
  ...(telegram ? { providers: { telegram } } : {}),
  signIn: { environment: 'local' },
  origins: ['http://127.0.0.1:5178', 'http://localhost:5178'],
  ...(docs ? { docs } : {}),
  ...(stripeConfig
    ? { billing: new StripeBilling(pool, stripeConfig, 'http://127.0.0.1:5178', chain) }
    : {}),
});
await app.listen({ host: '127.0.0.1', port: 3008 });
const worker = startContentWorker(pool, content);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    void app
      .close()
      .then(() => worker.stop())
      .then(() => pool.end());
  });
console.log('Local API fixture ready at http://127.0.0.1:3008');
