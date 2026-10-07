import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile, execFileSync } from 'node:child_process';
import { CreationService } from '../../services/api/src/creation.js';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { encodeDecide, encodeWorks, ModuleCodeHashes } from '@daclify/modules/sdk';
import { z } from 'zod';
import {
  AccountSchema,
  ApiRoutes,
  ChallengeSchema,
  SessionSchema,
  defaultDaoSetup,
  CreateDaoSchema,
} from '../../protocol/index.js';
import {
  encodeAction,
  instructionDigest,
  makeInstruction,
  governanceSettings,
  type RuntimeActions,
} from '../../sdk/index.js';
import type { instruction } from '../../sdk/index.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
const network = z
  .object({
    url: z.enum([
      'http://127.0.0.1:19888',
      'http://127.0.0.1:19988',
      'http://127.0.0.1:20088',
      'http://127.0.0.1:20288',
    ]),
    chainId: z.string(),
    container: z.enum([
      'daclify-dao-presets-native',
      'daclify-platform-native',
      'daclify-access-native',
      'daclify-research-native',
      'daclify-research-paid-native',
    ]),
  })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://daclify:daclify-test-only@127.0.0.1:16432/daclify_presets_test',
});
const origin = 'http://127.0.0.1:5278';
const gateway = new NativeChainGateway({
  rpcUrl: network.url,
  chainId: network.chainId,
  runtime: 'daclifycore',
  hub: null,
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
const creation = new CreationService(pool, gateway);
const app = await createServer(pool, gateway, origin, { creation });
const encryption = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const encryptionKey = { kty: 'EC', crv: 'P-256', x: encryption.x, y: encryption.y };
async function login(key: PrivateKey) {
  const challenge = ChallengeSchema.parse(
    (
      await app.inject({
        method: 'POST',
        url: ApiRoutes.challenge.path,
        headers: { origin },
        payload: { signingKey: key.toPublic().toString() },
      })
    ).json(),
  );
  const response = await app.inject({
    method: 'POST',
    url: ApiRoutes.login.path,
    headers: { origin },
    payload: {
      challengeId: challenge.id,
      signature: key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey,
    },
  });
  const session = SessionSchema.parse(response.json());
  return {
    account: session.account,
    headers: {
      origin,
      cookie: response.cookies.map((cookie) => cookie.name + '=' + cookie.value).join('; '),
      'x-csrf-token': session.csrfToken,
    },
  };
}
function native(action: string, data: unknown[], actor = 'alice') {
  unlockFixtureWallet(network.container);
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--wallet-url',
        'http://127.0.0.1:8900',
        'push',
        'action',
        'daclifycore',
        action,
        JSON.stringify(data),
        '-p',
        actor + '@active',
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('NATIVE_ACTION_REJECTED');
  }
}
async function instructionFor(
  daoId: string,
  memberId: string,
  target: string,
  action: string,
  data: Uint8Array,
): Promise<instruction> {
  const person = (await gateway.table('members', daoId, memberId, 1))[0];
  if (!person || person.id !== memberId) throw new Error('Fixture member');
  return makeInstruction(
    { chainId: network.chainId, contract: 'daclifycore', daoId, interfaceVersion: 1 },
    memberId,
    person.nonce,
    Math.floor(Date.now() / 1000) + 300,
    target,
    action,
    data,
  );
}
async function paidCreate(
  user: Awaited<ReturnType<typeof login>>,
  input: z.infer<typeof CreateDaoSchema>,
) {
  const free = await app.inject({
    method: 'POST',
    url: ApiRoutes.createDao.path,
    headers: user.headers,
    payload: input,
  });
  expect(free.statusCode).toBe(409);
  const id = randomUUID();
  const response = await app.inject({
    method: 'POST',
    url: ApiRoutes.creationOrder.path,
    headers: user.headers,
    payload: { requestId: id, deployment: 'shared', method: 'tlos', request: input },
  });
  expect(response.statusCode, response.body).toBe(200);
  const order = ApiRoutes.creationOrder.response.parse(response.json());
  expect(order.usdCents).toBe(2000);
  expect(order.tlosAmount).toBe('24.0000 TLOS');
  const unpaid = await app.inject({
    method: 'POST',
    url: ApiRoutes.creationFulfill.path.replace(':id', id),
    headers: user.headers,
    payload: {},
  });
  expect(unpaid.statusCode).toBe(409);
  execFileSync(
    'docker',
    [
      'exec',
      network.container,
      'cleos',
      '--wallet-url',
      'http://127.0.0.1:8900',
      'push',
      'action',
      'eosio.token',
      'transfer',
      JSON.stringify(['alice', 'daclifycore', order.tlosAmount, order.memo]),
      '-p',
      'alice@active',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const created = await app.inject({
    method: 'POST',
    url: ApiRoutes.creationFulfill.path.replace(':id', id),
    headers: user.headers,
    payload: {},
  });
  expect(created.statusCode, created.body).toBe(200);
  const receipt = ApiRoutes.creationFulfill.response.parse(created.json());
  expect(receipt.state).toBe('created');
  if (!receipt.dao) throw new Error('Missing DAO receipt');
  const retry = await app.inject({
    method: 'POST',
    url: ApiRoutes.creationFulfill.path.replace(':id', id),
    headers: user.headers,
    payload: {},
  });
  expect(ApiRoutes.creationFulfill.response.parse(retry.json()).dao).toEqual(receipt.dao);
  return gateway.dao(receipt.dao.daoId);
}
beforeAll(async () => {
  await migrate(pool);
  native('setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''], 'daclifycore');
  native('setcreate', [2000, 5000, 2000, 'relay'], 'daclifycore');
  const chainInfo = await fetch(network.url + '/v1/chain/get_info', {
    method: 'POST',
    body: '{}',
  }).then((r) => r.json());
  const head = z.object({ head_block_time: z.string() }).parse(chainInfo).head_block_time;
  native('setcrrate', [10000, 4, Math.floor(new Date(head + 'Z').getTime() / 1000)], 'daclifycore');
  for (const module of ['decide', 'works', 'payroll'] as const)
    native(
      'listmod',
      [module, 'alice', 0, 1, '0.0000 TLOS', ModuleCodeHashes[module], 'First-party fixture'],
      'daclifycore',
    );
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
describe('isolated native preset / API authority', () => {
  it('creates a fully configured NGO through the authenticated API and preserves its snapshot', async () => {
    const signing = PrivateKey.generate('K1');
    const user = await login(signing);
    const input = CreateDaoSchema.parse({
      metadata: { schemaVersion: 1, title: 'Native grant fixture', description: '' },
      privacy: 'public',
      token: { chainId: network.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
      setup: defaultDaoSetup('ngo-grants'),
    });
    const dao = await paidCreate(user, input);
    expect(dao.setup).toEqual(input.setup);
    const state = await gateway.governance(dao.reference.daoId);
    expect(state.policy?.config.approval).toBe(6667);
    expect(
      (await gateway.moduleState(dao.reference.daoId)).modules
        .filter((module) => module.enabled)
        .map((module) => module.deployment.id),
    ).toEqual(['decide', 'works']);
    expect(
      (await gateway.memberships(user.account)).some(
        (member) => member.dao.daoId === dao.reference.daoId && member.admin,
      ),
    ).toBe(true);
    if (!input.setup) throw new Error('Fixture setup');
    const request = await instructionFor(
      dao.reference.daoId,
      '1',
      'daclifycore',
      'setdaogov',
      encodeAction('setdaogov', {
        runtime: 'daclifycore',
        dao_id: dao.reference.daoId,
        member_id: '1',
        settings: governanceSettings(
          { ...input.setup, governance: { ...input.setup.governance, duration: 60 } },
          'decide',
        ),
      }),
    );
    await gateway.relay(
      user.account,
      request,
      signing.signDigest(instructionDigest(request)).toString(),
    );
    expect((await gateway.governance(dao.reference.daoId)).policy?.config.duration).toBe(60);
    expect((await gateway.dao(dao.reference.daoId)).setup).toEqual(input.setup);
    native('setgov', [dao.reference.daoId], 'daclifycore');
    const fees = await instructionFor(
      dao.reference.daoId,
      '1',
      'daclifycore',
      'govfees',
      encodeAction('govfees', {
        runtime: 'daclifycore',
        dao_id: dao.reference.daoId,
        member_id: '1',
        third_party_bps: 500,
        first_party_bps: 10000,
        bump_bps: 1000,
        quote_premium_bps: 2500,
      }),
    );
    await gateway.relay(user.account, fees, signing.signDigest(instructionDigest(fees)).toString());
    expect((await gateway.table('mktcfg', 'daclifycore'))[0]?.bump_bps).toBe(1000);
    async function platformAction<K extends keyof RuntimeActions>(
      action: K,
      data: RuntimeActions[K],
    ) {
      const instruction = await instructionFor(
        dao.reference.daoId,
        '1',
        'daclifycore',
        action,
        encodeAction(action, data),
      );
      await gateway.relay(
        user.account,
        instruction,
        signing.signDigest(instructionDigest(instruction)).toString(),
      );
    }
    const actor = { runtime: 'daclifycore', dao_id: dao.reference.daoId, member_id: '1' };
    await platformAction('govcreate', {
      ...actor,
      shared_usd: 2000,
      independent_usd: 5000,
      premium_bps: 2000,
      settler: 'relay',
    });
    expect((await gateway.table('createcfg', 'daclifycore'))[0]?.independent_usd).toBe(5000);
    await platformAction('govlist', {
      ...actor,
      account: 'works',
      price: '0.0000 TLOS',
      code_hash: ModuleCodeHashes.works,
      title: 'Works governance fixture',
    });
    await platformAction('govmodcopy', {
      ...actor,
      account: 'works',
      summary: 'Native platform description.',
      detail: 'Trusted module metadata only.',
    });
    expect(
      (await gateway.table('modcopy', 'daclifycore')).find((r) => r.account === 'works')?.summary,
    ).toBe('Native platform description.');
    await platformAction('govunlist', { ...actor, account: 'works' });
    expect(
      (await gateway.table('catalogue', 'daclifycore')).some((r) => r.account === 'works'),
    ).toBe(false);
    expect(
      (await gateway.moduleState(dao.reference.daoId)).modules.find(
        (m) => m.deployment.id === 'works',
      )?.enabled,
    ).toBe(true);
    await platformAction('govlist', {
      ...actor,
      account: 'works',
      price: '0.0000 TLOS',
      code_hash: ModuleCodeHashes.works,
      title: 'Works',
    });
    const status = ApiRoutes.status.response.parse(
      (await app.inject(ApiRoutes.status.path)).json(),
    );
    expect(status.chain?.platformDao).toEqual(dao.reference);
    expect(status.chain?.contracts.every((c) => c.expectedHash === null || c.verified)).toBe(true);
  });
  it('runs guarded agent funding and scoped API signatures under actual native permissions', async () => {
    const sponsor = await login(PrivateKey.generate('K1'));
    const root = PrivateKey.generate('K1'),
      scoped = PrivateKey.generate('K1'),
      contributor = PrivateKey.generate('K1');
    const agent = await login(root),
      session = await login(scoped);
    const setup = defaultDaoSetup('community');
    setup.participantMode = 'agents-guarded';
    setup.governance = {
      ...setup.governance,
      duration: 60,
      guardian: 'alice',
      maxCommitment: '10000',
      dailyCommitment: '20000',
    };
    const input = CreateDaoSchema.parse({
      metadata: { schemaVersion: 1, title: 'Native guarded agents', description: '' },
      privacy: 'public',
      token: { chainId: network.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
      setup,
      foundingAgent: {
        signingKey: root.toPublic().toString(),
        encryptionKey,
        operator: 'Synthetic fixture operator',
      },
    });
    const dao = await paidCreate(sponsor, input);
    const id = dao.reference.daoId;
    expect(
      (await gateway.memberships(sponsor.account)).some((member) => member.dao.daoId === id),
    ).toBe(false);
    const actor = { runtime: 'daclifycore', dao_id: id, member_id: '1' };
    const crossDao = await instructionFor(
      id,
      '1',
      'daclifycore',
      'govcreate',
      encodeAction('govcreate', {
        ...actor,
        shared_usd: 1,
        independent_usd: 1,
        premium_bps: 0,
        settler: 'relay',
      }),
    );
    await expect(
      gateway.relay(
        agent.account,
        crossDao,
        root.signDigest(instructionDigest(crossDao)).toString(),
      ),
    ).rejects.toMatchObject({ code: 'CHAIN_ACTION_REJECTED' });
    expect((await gateway.table('createcfg', 'daclifycore'))[0]?.shared_usd).toBe(2000);

    const credential = await instructionFor(
      id,
      '1',
      'daclifycore',
      'addsession',
      encodeAction('addsession', {
        ...actor,
        session_id: '1',
        signing_key: scoped.toPublic().toString(),
        expires: Math.floor(Date.now() / 1000) + 600,
        permissions: [{ target: 'daclifycore', action: 'putjson', code_hash: '00'.repeat(32) }],
      }),
    );
    await gateway.relay(
      agent.account,
      credential,
      root.signDigest(instructionDigest(credential)).toString(),
    );
    const publish = await instructionFor(
      id,
      '1',
      'daclifycore',
      'putjson',
      encodeAction('putjson', {
        ...actor,
        document_id: '1',
        version: 1,
        value: '{"deliverable":"synthetic"}',
        envelope_version: 0,
        key_epoch: '0',
      }),
    );
    const submitted = await app.inject({
      method: 'POST',
      url: ApiRoutes.relay.path,
      headers: session.headers,
      payload: {
        request: publish,
        session_id: '1',
        sig: scoped.signDigest(instructionDigest(publish)).toString(),
      },
    });
    expect(submitted.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: ApiRoutes.relay.path,
          headers: session.headers,
          payload: {
            request: publish,
            session_id: '1',
            sig: scoped.signDigest(instructionDigest(publish)).toString(),
          },
        })
      ).statusCode,
    ).toBe(409);
    const directory = await mkdtemp(join(tmpdir(), 'daclify-agent-example-'));
    try {
      const file = join(directory, 'public.json');
      await writeFile(file, '{"deliverable":"SDK example"}');
      const address = await app.listen({ host: '127.0.0.1', port: 0 });
      const result = await promisify(execFile)(
        process.execPath,
        ['node_modules/tsx/dist/cli.mjs', 'examples/agent-publish.ts'],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            DACLIFY_AGENT_API: address,
            DACLIFY_AGENT_ORIGIN: origin,
            DACLIFY_AGENT_DAO: id,
            DACLIFY_AGENT_MEMBER: '1',
            DACLIFY_AGENT_SESSION: '1',
            DACLIFY_AGENT_SIGNING_KEY: scoped.toString(),
            DACLIFY_AGENT_DOCUMENT: '3',
            DACLIFY_AGENT_DOCUMENT_VERSION: '1',
            DACLIFY_AGENT_PUBLIC_JSON_FILE: file,
          },
        },
      );
      const receipt = z
        .object({ transactionId: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(JSON.parse(result.stdout));
      expect(receipt.transactionId).toHaveLength(64);
      expect(
        (await gateway.table('documents', id)).some((document) => document.document_id === '3'),
      ).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    async function act(target: string, action: string, data: Uint8Array) {
      const request = await instructionFor(id, '1', target, action, data);
      return gateway.relay(
        agent.account,
        request,
        root.signDigest(instructionDigest(request)).toString(),
      );
    }
    await act(
      'daclifycore',
      'addmember',
      encodeAction('addmember', {
        ...actor,
        signing_key: contributor.toPublic().toString(),
        encryption_key: JSON.stringify(encryptionKey),
        custody: 0,
        kind: 1,
        operator_label: 'Same synthetic operator; not an independence proof',
      }),
    );
    execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--wallet-url',
        'http://127.0.0.1:8900',
        'push',
        'action',
        'eosio.token',
        'transfer',
        JSON.stringify(['alice', 'daclifycore', '2.0000 TLOS', 'dao:' + id]),
        '-p',
        'alice@active',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    await act(
      'works',
      'propose',
      encodeWorks('propose', {
        ...actor,
        project_id: id,
        contributor: '2',
        document_id: '1',
        document_version: 1,
        payments: ['0.5000 TLOS'],
        dues: [0],
      }),
    );
    const forbidden = await instructionFor(
      id,
      '1',
      'works',
      'accept',
      encodeWorks('accept', { ...actor, project_id: id }),
    );
    await expect(
      gateway.relay(
        agent.account,
        forbidden,
        root.signDigest(instructionDigest(forbidden)).toString(),
      ),
    ).rejects.toThrow('CHAIN_ACTION_REJECTED');
    await act(
      'decide',
      'openwork',
      encodeDecide('openwork', {
        ...actor,
        ballot_id: id,
        works: 'works',
        project_id: id,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    await act('decide', 'vote', encodeDecide('vote', { ...actor, ballot_id: id, choice: 1 }));
    const ballot = (await gateway.moduleState(id)).ballots[0];
    if (!ballot) throw new Error('Fixture ballot');
    while (Date.now() / 1000 <= ballot.closes + 1)
      await new Promise((done) => setTimeout(done, 1000));
    await gateway.finalize({ dao: dao.reference, ballotId: id });
    expect((await gateway.execute({ dao: dao.reference, ballotId: id })).state).toBe('executed');
    expect((await gateway.execute({ dao: dao.reference, ballotId: id })).state).toBe(
      'already-executed',
    );
    expect((await gateway.dao(id)).reserved).toBe('5000');
    native('guardrevoke', [id, 1]);
    const blocked = await instructionFor(
      id,
      '1',
      'daclifycore',
      'putjson',
      encodeAction('putjson', {
        ...actor,
        document_id: '2',
        version: 1,
        value: '{}',
        envelope_version: 0,
        key_epoch: '0',
      }),
    );
    await expect(
      gateway.relay(
        session.account,
        blocked,
        scoped.signDigest(instructionDigest(blocked)).toString(),
        '1',
      ),
    ).rejects.toThrow('CHAIN_ACTION_REJECTED');
    const recovered = PrivateKey.generate('K1');
    native('guardrecover', [id, 1, recovered.toPublic().toString()]);
    await expect(
      gateway.relay(
        session.account,
        blocked,
        scoped.signDigest(instructionDigest(blocked)).toString(),
        '1',
      ),
    ).rejects.toThrow('CHAIN_ACTION_REJECTED');
    native('guardpause', [id, Math.floor(Date.now() / 1000) + 60, 'ab'.repeat(32)]);
    expect((await gateway.governance(id)).guardian?.paused_until).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
    expect(AccountSchema.parse(agent.account).signingKey).toBe(root.toPublic().toString());
  }, 150000);
});
