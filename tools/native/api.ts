import { CreationService } from '../../services/api/src/creation.js';
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
  .object({ url: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/), chainId: z.string() })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const apiPort = z.coerce
  .number()
  .int()
  .min(1024)
  .max(65535)
  .parse(process.env.DACLIFY_TEST_API_PORT ?? 3008);
const uiPort = z.coerce
  .number()
  .int()
  .min(1024)
  .max(65535)
  .parse(process.env.DACLIFY_TEST_UI_PORT ?? 5178);
const origin = 'http://127.0.0.1:' + uiPort;
const database =
  process.env.DACLIFY_TEST_DATABASE_URL ??
  'postgres://daclify:daclify-test-only@127.0.0.1:15432/daclify';
if (
  process.env.DACLIFY_TEST_DATABASE_URL &&
  (!['localhost', '127.0.0.1'].includes(new URL(database).hostname) ||
    !new URL(database).pathname.endsWith('_test'))
)
  throw new Error('Isolated test database required');
const pool = new Pool({
  connectionString: database,
});
await migrate(pool);
const chain = new NativeChainGateway(
  {
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
      { id: 'grants-rounds', account: 'grants' },
      { id: 'endorsement-admission', account: 'endorse' },
    ],
  },
  pool,
);
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
const creation = new CreationService(pool, chain);
const app = await createServer(pool, chain, origin, {
  content,
  creation,
  ...(telegram ? { providers: { telegram } } : {}),
  signIn: { environment: 'local' },
  origins: [origin, 'http://localhost:' + uiPort],
  ...(docs ? { docs } : {}),
  ...(stripeConfig
    ? { billing: new StripeBilling(pool, stripeConfig, origin, chain, creation) }
    : {}),
});
await app.listen({ host: '127.0.0.1', port: apiPort });
const worker = startContentWorker(pool, content);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    void app
      .close()
      .then(() => worker.stop())
      .then(() => pool.end());
  });
console.log('Local API fixture ready at http://127.0.0.1:' + apiPort);
