import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { Pool } from 'pg';
import {
  AccountSchema,
  privateCreationCommitment,
  CreateDaoSchema,
  UserMembershipSchema,
  DaoSummarySchema,
} from '../../protocol/api.js';
import { ChainPlatformSchema } from '../../protocol/platform.js';
import { GovernanceStateSchema, defaultDaoSetup } from '../../protocol/dao.js';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import { DaoClaimLinks } from '../../services/api/src/dao-claims.js';
import { CreationService } from '../../services/api/src/creation.js';
import { migrate } from '../../services/api/src/store.js';
import { assertErasureInventory } from '../../services/api/src/account-exit/inventory.js';
import { PrivateFounderSetupSchema } from '../../protocol/private-records.js';
let recoveredIdentity: Awaited<
  ReturnType<
    import('../../services/api/src/native-chain.js').NativeChainGateway['accountRecoveryIdentity']
  >
> = null;
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw Error('Isolated test database required');
const pool = new Pool({ connectionString: url });
const identity = () =>
  AccountSchema.parse({
    id: randomUUID(),
    signingKey: PrivateKey.generate('K1').toPublic().toString(),
    encryptionKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    }),
    custody: 'user-controlled',
  });
const issuer = identity(),
  first = identity(),
  second = identity();
const network = {
  chainId: 'ab'.repeat(32),
  rpcUrl: 'http://localhost:19988',
  runtime: 'daclifycore',
  hub: null,
  environment: 'local',
  interfaceVersion: 1,
  coreVersion: '0.15.0-alpha.19',
  capabilities: ['shared-dao-create'],
};
const dao = {
  chainId: network.chainId,
  contract: network.runtime,
  daoId: '1',
  interfaceVersion: 1 as const,
};
const codeHash = 'cd'.repeat(32);
const platform = ChainPlatformSchema.parse({
  network,
  chainId: network.chainId,
  chainMatches: true,
  headBlock: 1,
  irreversibleBlock: 1,
  headTime: '2026-10-13T00:00:00',
  contracts: [
    {
      account: 'daclifydecid',
      moduleId: 'decide',
      codeHash,
      expectedHash: codeHash,
      verified: true,
      ramBytes: null,
      ramUsed: null,
      permissions: [],
    },
  ],
  catalogue: [
    {
      account: 'daclifydecid',
      code_hash: codeHash,
      complies: 1,
      publisher: 'alice',
      price: '0.0000 TLOS',
      party: 1,
      title: 'Decide',
    },
  ],
  fees: null,
  market: null,
  creation: {
    shared_usd: 0,
    independent_usd: 5000,
    premium_bps: 2000,
    settler: 'relay',
    median: '10000',
    precision: 4,
    observed_at: 0,
  },
  hosting: { free_members: 10, settler: 'relay' },
  runtimeSettings: null,
  rateFresh: true,
  platformDao: dao,
  sharedAvailable: true,
  independentAvailable: false,
});
const member = (id: string, signingKey: string | null) =>
  RuntimeTableSchemas.members.parse({
    id,
    native_account: '',
    signing_key: signingKey,
    encryption_key: '{}',
    custody: 0,
    nonce: '0',
    credits: '0',
    active: true,
    admin: true,
    reviewer: false,
    stake: '0',
    claim: '0',
    join_epoch: '1',
  });
const governance = () =>
  GovernanceStateSchema.parse({
    dao,
    policy: null,
    actors: [],
    sessions: [],
    guardian: null,
    budget: null,
    executivePolicy: {
      dao_id: '1',
      inactivity_seconds: 0,
      quorum_bps: 10000,
      revision: '1',
      last_election_start: 0,
    },
    executives: [
      {
        member_id: '1',
        last_active: Math.floor(Date.parse(platform.headTime) / 1000),
        office_epoch: '1',
        election_id: '0',
      },
    ],
    executiveMembers: [member('1', issuer.signingKey)],
  });
let authorized = true,
  failResponse = false,
  creations = 0;
const orders = new Map<string, ReturnType<typeof RuntimeTableSchemas.createords.parse>>();
const createdKeys = new Map<string, string | null>();
const chain = {
  accountRecoveryIdentity: async (_key: string) => recoveredIdentity,
  platform: async () => {
    platform.headTime = new Date().toISOString();
    return platform;
  },
  governance: async (id: string) =>
    id === '1'
      ? governance()
      : GovernanceStateSchema.parse({
          ...governance(),
          dao: { ...dao, daoId: id },
          executiveMembers: [
            member(
              '1',
              createdKeys.get(id) ??
                [...orders.values()].find((o) => o.dao_id === id)?.creator ??
                first.signingKey,
            ),
          ],
        }),
  memberships: async (account: typeof issuer) =>
    authorized && account.id === issuer.id
      ? [
          UserMembershipSchema.parse({
            dao,
            memberId: '1',
            nonce: '0',
            active: true,
            admin: true,
            reviewer: false,
            credits: '0',
            claim: '0',
            stake: '0',
            nativeAccount: '',
            custody: 'user-controlled',
          }),
        ]
      : [],
  validateCreation: vi.fn(async () => {}),
  creationOrder: async (ref: string) => orders.get(ref) ?? null,
  orderCreation: async (ref: string, creator: string, method: 'free' | 'card' | 'tlos') => {
    if (!orders.has(ref))
      orders.set(
        ref,
        RuntimeTableSchemas.createords.parse({
          id: String(orders.size + 1),
          reference: ref,
          creator,
          deployment: 0,
          method: method === 'free' ? 2 : method === 'card' ? 1 : 0,
          usd_cents: method === 'free' ? 0 : 2000,
          tlos_due: '0.0000 TLOS',
          created_at: Math.floor(Date.now() / 1000),
          expires: Math.floor(Date.now() / 1000) + 3600,
          paid: method === 'free',
          used: false,
          dao_id: '0',
          card_reference: '00'.repeat(32),
        }),
      );
    const order = orders.get(ref);
    if (!order) throw Error('Owned receipt missing');
    return order;
  },
  attestCreation: async () => {},
  createDao: vi.fn(
    async (
      _account: typeof first,
      _input: ReturnType<typeof CreateDaoSchema.parse>,
      paid?: { reference: string; daoId: string; founderExecutive?: boolean },
    ) => {
      if (!paid?.founderExecutive) throw Error('Missing founder authority');
      const order = orders.get(paid.reference);
      if (!order || order.used) throw Error('Duplicate native creation');
      createdKeys.set(paid.daoId, _account.signingKey);
      order.used = true;
      order.dao_id = paid.daoId;
      creations++;
      if (failResponse) {
        failResponse = false;
        throw Error('Lost response after commit');
      }
      return undefined;
    },
  ),
};
const creation = new CreationService(pool, {
  ...chain,
  createDao: async (...args) => {
    await chain.createDao(...args);
    return DaoSummarySchema.parse({
      reference: dao,
      title: '',
      description: '',
      privacy: 'public' as const,
      owner: '',
      token: request.token,
      members: 1,
      available: '0',
      reserved: '0',
      claims: '0',
      keyEpoch: '0',
      lifecycle: 'active',
    });
  },
});
const links = new DaoClaimLinks(pool, chain, creation);
const request = CreateDaoSchema.parse({
  metadata: { schemaVersion: 1, title: 'Invited DAO', description: '' },
  privacy: 'public',
  token: { chainId: network.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
  setup: defaultDaoSetup('custom'),
});
const issue = () => links.issue(issuer, { request });
beforeAll(async () => {
  await migrate(pool);
  for (const a of [issuer, first, second])
    await pool.query(
      'INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,$3,$4)',
      [a.id, a.signingKey, a.custody, a.encryptionKey],
    );
});
beforeEach(() => {
  recoveredIdentity = null;
  platform.network.capabilities = ['shared-dao-create'];
  authorized = true;
  platform.sharedAvailable = true;
  if (platform.creation) platform.creation.shared_usd = 0;
  chain.validateCreation.mockReset();
  chain.validateCreation.mockResolvedValue();
});
it.each([
  { restored: false, committed: false },
  { restored: true, committed: false },
  { restored: true, committed: true },
])(
  'resumes a paid claimant receipt after recovery, including a restored ownership snapshot ($restored, committed=$committed)',
  async ({ restored, committed }) => {
    if (platform.creation) platform.creation.shared_usd = 2000;
    const link = await issue(),
      before = creations,
      originalKey = first.signingKey;
    const order = await links.claim(first, { token: link.token, method: 'card' });
    const receipt = orders.get(order.memo.slice('create:'.length));
    if (!receipt || !originalKey) throw Error('Claim fixture');
    receipt.paid = true;
    if (committed) {
      failResponse = true;
      await expect(links.claim(first, { token: link.token, method: 'card' })).rejects.toThrow(
        'Lost response',
      );
    }
    first.signingKey = PrivateKey.generate('K1').toPublic().toString();
    recoveredIdentity = {
      network,
      identity: { id: '1', dao_id: '1', origin_key: originalKey, signing_key: first.signingKey },
    };
    await pool.query('UPDATE accounts SET signing_key=$2 WHERE id=$1', [
      first.id,
      first.signingKey,
    ]);
    try {
      if (restored) {
        await pool.query('DELETE FROM creation_orders WHERE id=$1', [link.claim.id]);
        await pool.query(
          'UPDATE dao_claim_links SET claimant_account_id=NULL,method=NULL,completed_at=NULL WHERE id=$1',
          [link.claim.id],
        );
      }
      await expect(
        links.claim(second, { token: link.token, method: 'card' }),
      ).rejects.toMatchObject({ code: 'DAO_CLAIM_RESERVED' });
      const resumed = await links.claim(first, { token: link.token, method: 'card' });
      expect(resumed).toMatchObject({ state: 'created', founderExecutive: true });
      expect((await links.claim(first, { token: link.token, method: 'card' })).dao).toEqual(
        resumed.dao,
      );
      expect(creations - before).toBe(1);
      expect(receipt.creator).toBe(originalKey);
      expect(chain.createDao.mock.lastCall?.[0].signingKey).toBe(
        committed ? originalKey : first.signingKey,
      );
    } finally {
      first.signingKey = originalKey;
      recoveredIdentity = null;
      await pool.query('UPDATE accounts SET signing_key=$2 WHERE id=$1', [first.id, originalKey]);
    }
  },
);
it('reserves sealed private setup for the sole claimant without persisting private prose or accepting a later key replacement', async () => {
  const setup = defaultDaoSetup('custom');
  const envelope = {
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: btoa('i'.repeat(12)),
    ciphertext: btoa('c'.repeat(32)),
  };
  const privateRequest = CreateDaoSchema.parse({
    ...request,
    privacy: 'encrypted-user-controlled',
    metadata: {
      schemaVersion: 4,
      title: 'Private DAO',
      description: '',
      purpose: 'custom',
      setup,
      privateIdentity: null,
    },
    privateSetup: {
      schemaVersion: 1,
      stage: 'invitation',
      daoId: '791',
      documentId: '41',
      contextCommitment: 'aa'.repeat(32),
      envelope,
    },
  });
  if (!privateRequest.privateSetup) throw Error('private setup missing');
  privateRequest.privateSetup.contextCommitment = privateCreationCommitment(
    { ...dao, daoId: privateRequest.privateSetup.daoId },
    privateRequest,
  );
  await expect(links.issue(issuer, { request: privateRequest })).rejects.toMatchObject({
    code: 'PRIVATE_IDENTITY_UNSUPPORTED',
  });
  platform.network.capabilities.push('private-dao-identity-v1', 'private-claim-content-v1');
  const invitation = await links.issue(issuer, { request: privateRequest });
  const founder = PrivateFounderSetupSchema.parse({
    ...privateRequest.privateSetup,
    stage: 'founder',
    epochCommitment: 'ac'.repeat(32),
    selfGrant: {
      version: 1,
      ephemeralKey: first.encryptionKey,
      salt: btoa('s'.repeat(32)),
      envelope,
    },
  });
  await expect(
    links.claim(first, { token: invitation.token, method: 'free' }),
  ).rejects.toMatchObject({ code: 'PRIVATE_FOUNDER_REQUIRED' });
  expect((await links.preview(invitation.token)).state).toBe('ready');
  await expect(
    links.claim(first, {
      token: invitation.token,
      method: 'free',
      privateSetup: { ...founder, daoId: '792' },
    }),
  ).rejects.toMatchObject({ code: 'PRIVATE_FOUNDER_REQUIRED' });
  const result = await links.claim(first, {
    token: invitation.token,
    method: 'free',
    privateSetup: founder,
  });
  expect(result.dao?.daoId).toBe('791');
  expect(result.setup.privateSetup).toEqual(founder);
  const persisted = (
    await pool.query('SELECT request FROM creation_orders WHERE id=$1', [invitation.claim.id])
  ).rows[0];
  expect(persisted.request.request.privateSetup).toEqual(founder);
  expect(JSON.stringify(persisted)).not.toContain(invitation.token);
  expect(JSON.stringify(await links.preview(invitation.token))).not.toContain(issuer.signingKey);
  await expect(
    links.claim(first, {
      token: invitation.token,
      method: 'free',
      privateSetup: { ...founder, epochCommitment: 'ff'.repeat(32) },
    }),
  ).rejects.toMatchObject({ code: 'CREATION_ORDER_CONFLICT' });
  await expect(
    links.claim(second, { token: invitation.token, method: 'free', privateSetup: founder }),
  ).rejects.toMatchObject({ code: 'DAO_CLAIM_RESERVED' });
  expect((await links.claim(first, { token: invitation.token, method: 'free' })).dao).toEqual(
    result.dao,
  );
});
afterAll(async () => {
  await pool.end();
});
it('classifies both account references in erasure inventory', async () => {
  await assertErasureInventory(pool);
});
it('preview and list expose no secret and allocate no creation order', async () => {
  const before = await pool.query('SELECT count(*) FROM creation_orders');
  const result = await issue();
  expect(await links.preview(result.token)).toMatchObject({ state: 'ready' });
  expect(JSON.stringify(await links.list(issuer))).not.toContain(result.token);
  expect(
    (await pool.query('SELECT token_hash FROM dao_claim_links WHERE id=$1', [result.claim.id]))
      .rows[0].token_hash,
  ).not.toBe(result.token);
  expect((await pool.query('SELECT count(*) FROM creation_orders')).rows).toEqual(before.rows);
});
it('rejects non-executives, stale issuers and substituted networks', async () => {
  await expect(links.issue(first, { request })).rejects.toMatchObject({
    code: 'DAO_CLAIM_EXECUTIVE_REQUIRED',
  });
  const link = await issue();
  authorized = false;
  await expect(links.claim(first, { token: link.token, method: 'free' })).rejects.toMatchObject({
    code: 'DAO_CLAIM_EXECUTIVE_REQUIRED',
  });
  authorized = true;
  await expect(
    links.issue(issuer, {
      request: { ...request, token: { ...request.token, chainId: 'cd'.repeat(32) } },
    }),
  ).rejects.toMatchObject({ code: 'DAO_REFERENCE' });
});
it('refuses an executive in another DAO and an expired actual executive office', async () => {
  const memberships = await chain.memberships(issuer);
  const other = memberships.map((m) => ({ ...m, dao: { ...m.dao, daoId: '2' } }));
  const wrongDao = vi.spyOn(chain, 'memberships').mockResolvedValue(other);
  await expect(issue()).rejects.toMatchObject({ code: 'DAO_CLAIM_EXECUTIVE_REQUIRED' });
  wrongDao.mockRestore();
  const expired = governance();
  if (!expired.executivePolicy || !expired.executives[0]) throw Error('Owned office missing');
  expired.executivePolicy.inactivity_seconds = 10;
  expired.executives[0].last_active = Math.floor(Date.now() / 1000) - 20;
  const office = vi.spyOn(chain, 'governance').mockResolvedValue(expired);
  await expect(issue()).rejects.toMatchObject({ code: 'DAO_CLAIM_EXECUTIVE_REQUIRED' });
  office.mockRestore();
});
it('evaluates executive activity using authoritative chain time rather than the API host clock', async () => {
  const future = Math.floor(Date.now() / 1000) + 3600,
    state = governance();
  if (!state.executives[0]) throw Error('Owned office absent');
  state.executives[0].last_active = future - 1;
  const clock = vi
    .spyOn(chain, 'platform')
    .mockResolvedValue({ ...platform, headTime: new Date(future * 1000).toISOString() });
  const office = vi.spyOn(chain, 'governance').mockResolvedValue(state);
  try {
    expect((await links.eligibility(issuer)).eligible).toBe(true);
  } finally {
    clock.mockRestore();
    office.mockRestore();
  }
});
it('expires after seven days and permits revocation only before reservation', async () => {
  const link = await issue();
  expect(new Date(link.claim.expiresAt).getTime() - Date.now()).toBeGreaterThan(604790000);
  await links.revoke(issuer, link.claim.id);
  await expect(links.claim(first, { token: link.token, method: 'free' })).rejects.toMatchObject({
    code: 'DAO_CLAIM_REVOKED',
  });
  const expired = await issue();
  await pool.query("UPDATE dao_claim_links SET expires_at=now()-interval '1 second' WHERE id=$1", [
    expired.claim.id,
  ]);
  await expect(links.claim(first, { token: expired.token, method: 'free' })).rejects.toMatchObject({
    code: 'DAO_CLAIM_EXPIRED',
  });
});
it('leaves a failed preflight unclaimed', async () => {
  const link = await issue();
  chain.validateCreation.mockRejectedValueOnce(Error('Guardian absent'));
  await expect(links.claim(first, { token: link.token, method: 'free' })).rejects.toThrow(
    'Guardian absent',
  );
  expect((await links.preview(link.token)).state).toBe('ready');
});
it('serializes two confirming accounts and resumes the sole actual founder', async () => {
  const link = await issue(),
    before = creations;
  const outcomes = await Promise.allSettled(
    [first, second].map((account) => links.claim(account, { token: link.token, method: 'free' })),
  );
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  expect(creations - before).toBe(1);
  const stored = await pool.query('SELECT claimant_account_id FROM dao_claim_links WHERE id=$1', [
    link.claim.id,
  ]);
  const winner = stored.rows[0].claimant_account_id === first.id ? first : second;
  const initial = outcomes.find((outcome) => outcome.status === 'fulfilled');
  expect(initial?.status === 'fulfilled' && initial.value.founderExecutive).toBe(true);
  const resumed = await links.claim(winner, { token: link.token, method: 'free' });
  expect(initial?.status === 'fulfilled' && resumed.dao).toEqual(
    initial?.status === 'fulfilled' && initial.value.dao,
  );
  await expect(links.revoke(issuer, link.claim.id)).rejects.toMatchObject({
    code: 'DAO_CLAIM_RESERVED',
  });
});
it('reconciles a committed native transaction after losing its response', async () => {
  const link = await issue(),
    before = creations;
  failResponse = true;
  await expect(links.claim(first, { token: link.token, method: 'free' })).rejects.toThrow(
    'Lost response',
  );
  const resumed = await links.claim(first, { token: link.token, method: 'free' });
  expect(resumed).toMatchObject({ state: 'created', founderExecutive: true });
  expect(creations - before).toBe(1);
});
it('preserves native ownership across restoring a pre-reservation SQL snapshot', async () => {
  const link = await issue(),
    before = creations;
  const original = await links.claim(first, { token: link.token, method: 'free' });
  await pool.query('DELETE FROM creation_orders WHERE id=$1', [link.claim.id]);
  await pool.query(
    'UPDATE dao_claim_links SET claimant_account_id=NULL,method=NULL,completed_at=NULL WHERE id=$1',
    [link.claim.id],
  );
  await expect(links.claim(second, { token: link.token, method: 'free' })).rejects.toMatchObject({
    code: 'DAO_CLAIM_RESERVED',
  });
  const recovered = await links.claim(first, { token: link.token, method: 'free' });
  expect(recovered.dao).toEqual(original.dao);
  expect(creations - before).toBe(1);
});
it('reconciles restored revoked drafts in bounded cleanup while preserving the native claimant', async () => {
  const link = await issue();
  const original = await links.claim(first, { token: link.token, method: 'free' });
  await pool.query('DELETE FROM creation_orders WHERE id=$1', [link.claim.id]);
  await pool.query(
    'UPDATE dao_claim_links SET claimant_account_id=NULL,method=NULL,completed_at=NULL,revoked_at=now() WHERE id=$1',
    [link.claim.id],
  );
  for (let index = 0; index < 10; index++) {
    expect(await links.cleanup()).toBeLessThanOrEqual(5);
    if (
      (
        await pool.query('SELECT claimant_account_id FROM dao_claim_links WHERE id=$1', [
          link.claim.id,
        ])
      ).rows[0]?.claimant_account_id
    )
      break;
  }
  expect((await links.preview(link.token)).method).toBe('free');
  await expect(links.claim(second, { token: link.token, method: 'free' })).rejects.toMatchObject({
    code: 'DAO_CLAIM_RESERVED',
  });
  expect((await links.claim(first, { token: link.token, method: 'free' })).dao).toEqual(
    original.dao,
  );
});
it('keeps a reserved paid order usable after link expiry and issuer loses office', async () => {
  if (platform.creation) platform.creation.shared_usd = 2000;
  const link = await issue();
  const order = await links.claim(first, { token: link.token, method: 'card' });
  expect(order.state).toBe('awaiting-payment');
  await pool.query("UPDATE dao_claim_links SET expires_at=now()-interval '1 day' WHERE id=$1", [
    link.claim.id,
  ]);
  authorized = false;
  platform.sharedAvailable = false;
  expect(await links.claim(first, { token: link.token, method: 'card' })).toMatchObject({
    requestId: order.requestId,
  });
  await expect(links.claim(first, { token: link.token, method: 'free' })).rejects.toMatchObject({
    code: 'CREATION_ORDER_CONFLICT',
  });
  await expect(
    creation.prepare(first, {
      requestId: order.requestId,
      deployment: 'shared',
      method: 'card',
      request: {
        ...request,
        metadata: {
          schemaVersion: 1,
          title: 'Substituted',
          description: request.metadata.description,
        },
      },
    }),
  ).rejects.toMatchObject({ code: 'CREATION_ORDER_CONFLICT' });
  await links.cleanup();
  expect(
    (await pool.query('SELECT 1 FROM dao_claim_links WHERE id=$1', [link.claim.id])).rowCount,
  ).toBe(1);
});
