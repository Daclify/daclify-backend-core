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
const app = await createServer(pool, chain, 'http://127.0.0.1:5178', { content });
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
