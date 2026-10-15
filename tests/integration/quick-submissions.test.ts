import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
import { QuickBallots, type QuickGateway } from '../../services/api/src/quick-ballots/service.js';
import { quickAccountCandidate } from '../../services/api/src/quick-ballots/accounts.js';
import { QuickAuthCodeHash } from '../../sdk/quick-accounts.js';
import type { ExitSubmission } from '../../protocol/account-exit.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
const config = {
  chainId: '11'.repeat(32),
  runtime: 'daclifycore1',
  authority: 'quickauth',
  authorityCodeHash: QuickAuthCodeHash,
  source: 'quickvote',
  sourceCodeHash: '22'.repeat(32),
  gateway: { actor: 'gateway', permission: 'active' },
};
async function fixture() {
  const owner = randomUUID(),
    token = randomUUID(),
    key = PrivateKey.generate('K1');
  await pool.query(
    "INSERT INTO accounts(id,signing_key,encryption_key,custody) VALUES($1,$2,$3,'user-controlled')",
    [
      owner,
      key.toPublic().toString(),
      generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }),
    ],
  );
  let signed = 0,
    sent = 0,
    confirmed = false;
  const unused = async () => {
    throw Error('unused');
  };
  const gateway: QuickGateway = {
    list: unused,
    detail: unused,
    responses: unused,
    ownResponse: unused,
    readers: unused,
    advance: unused,
    finalize: unused,
    dueBallots: unused,
    needsAdvance: unused,
    configuration: async () => config,
    account: async () => null,
    defaultOwner: async () => null,
    prepareSubmission: async () => {
      ++signed;
      return {
        transactionId: '33'.repeat(32),
        packet: 'aabb',
        firstBlock: 1,
        cursor: 1,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      };
    },
    submit: async (_prepared, packet) => {
      ++sent;
      const stored = await pool.query<{ packet: ExitSubmission }>(
        'SELECT packet FROM quick_account_preparations WHERE account_id=$1',
        [owner],
      );
      expect(stored.rows[0]?.packet).toEqual(packet);
      throw Error('CONNECTION_DROPPED_AFTER_BROADCAST');
    },
    reconcile: async (_prepared, packet) => ({
      state: confirmed ? 'confirmed' : 'pending',
      cursor: packet.cursor + 1,
    }),
  };
  const service = new QuickBallots(pool, gateway, 41);
  const candidate = await quickAccountCandidate(
    pool,
    owner,
    { chainId: config.chainId, runtime: config.runtime },
    41,
  );
  return {
    owner,
    token,
    key,
    candidate,
    service,
    gateway,
    counts: () => ({ signed, sent }),
    confirm: () => {
      confirmed = true;
    },
  };
}
it('persists one exact signed packet before broadcast and reconciles it after a lost response', async () => {
  const f = await fixture();
  expect(f.candidate.frozen).toBe(false);
  expect(
    (await pool.query('SELECT 1 FROM quick_account_anchors WHERE account_id=$1', [f.owner]))
      .rowCount,
  ).toBe(0);
  const prepared = await f.service.prepare(f.owner, f.token, {
    expectedIdentity: f.candidate.identity,
    intent: { operation: 'register' },
  });
  const input = { id: prepared.id, proof: '11'.repeat(66), incoming: '' };
  expect(await f.service.submit(f.owner, f.token, input)).toEqual({
    transactionId: '33'.repeat(32),
    state: 'pending',
  });
  f.confirm();
  expect(await f.service.submit(f.owner, f.token, input)).toEqual({
    transactionId: '33'.repeat(32),
    state: 'confirmed',
  });
  expect(f.counts()).toEqual({ signed: 1, sent: 1 });
});
it('binds preparations to owner and session and freezes their exact intent and packet in SQL', async () => {
  const f = await fixture(),
    other = await fixture();
  const prepared = await f.service.prepare(f.owner, f.token, {
    expectedIdentity: f.candidate.identity,
    intent: { operation: 'register' },
  });
  const input = { id: prepared.id, proof: '11'.repeat(66), incoming: '' };
  await expect(f.service.submit(other.owner, f.token, input)).rejects.toThrow(
    'QUICK_PREPARATION_UNKNOWN',
  );
  await expect(f.service.submit(f.owner, other.token, input)).rejects.toThrow(
    'QUICK_PREPARATION_UNKNOWN',
  );
  await expect(
    pool.query(
      "UPDATE quick_account_preparations SET prepared=jsonb_set(prepared,'{context,source}','\"evil\"') WHERE id=$1",
      [prepared.id],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  await f.service.submit(f.owner, f.token, input);
  await expect(
    pool.query(
      "UPDATE quick_account_preparations SET packet=jsonb_set(packet,'{packet}','\"ccdd\"') WHERE id=$1",
      [prepared.id],
    ),
  ).rejects.toMatchObject({ code: '23514' });
});
it('rejects stale identity and an already owned paired wallet without freezing a second canonical identity', async () => {
  const f = await fixture();
  await expect(
    f.service.prepare(f.owner, f.token, {
      expectedIdentity: 'ff'.repeat(32),
      intent: { operation: 'register' },
    }),
  ).rejects.toThrow('QUICK_IDENTITY_CHANGED');
  await pool.query(
    "INSERT INTO native_links(account_id,chain_id,native_account,permission) VALUES($1,$2,$3,'active')",
    [
      f.owner,
      config.chainId,
      'q' +
        randomUUID()
          .replace(/[^a-f]/g, '')
          .slice(0, 10),
    ],
  );
  f.gateway.defaultOwner = async () => 'ff'.repeat(32);
  await expect(
    f.service.prepare(f.owner, f.token, {
      expectedIdentity: f.candidate.identity,
      intent: { operation: 'register' },
    }),
  ).rejects.toThrow('QUICK_ORIGINAL_ACCOUNT_REQUIRED');
  expect(
    (await pool.query('SELECT 1 FROM quick_account_anchors WHERE account_id=$1', [f.owner]))
      .rowCount,
  ).toBe(0);
});
it('bounds pending preparations', async () => {
  const f = await fixture();
  for (let i = 0; i < 20; i++)
    await f.service.prepare(f.owner, f.token, {
      expectedIdentity: f.candidate.identity,
      intent: { operation: 'register' },
    });
  await expect(
    f.service.prepare(f.owner, f.token, {
      expectedIdentity: f.candidate.identity,
      intent: { operation: 'register' },
    }),
  ).rejects.toThrow('QUICK_PREPARATION_LIMIT');
});

it('exposes account setup only to its session and requires CSRF and origin for preparations', async () => {
  const { createServer } = await import('../../services/api/src/server.js');
  const { authChain } = await import('../helpers/auth-chain.js');
  const { openAccountSession } = await import('../../services/api/src/auth/account-session.js');
  const f = await fixture();
  const login = await openAccountSession(pool, f.owner);
  const server = await createServer(pool, authChain, 'http://localhost:5178', {
    quickBallots: f.service,
  });
  try {
    expect((await server.inject({ method: 'GET', url: '/v1/me/quick-account' })).statusCode).toBe(
      401,
    );
    const cookie = 'daclify_session=' + login.token;
    expect(
      (await server.inject({ method: 'GET', url: '/v1/me/quick-account', headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    const payload = { expectedIdentity: f.candidate.identity, intent: { operation: 'register' } };
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/v1/me/quick-account/prepare',
          headers: { cookie, origin: 'http://localhost:5178' },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/v1/me/quick-account/prepare',
          headers: { cookie, origin: 'https://untrusted.example', 'x-csrf-token': login.csrfToken },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    const result = await server.inject({
      method: 'POST',
      url: '/v1/me/quick-account/prepare',
      headers: { cookie, origin: 'http://localhost:5178', 'x-csrf-token': login.csrfToken },
      payload,
    });
    expect(result.statusCode).toBe(200);
  } finally {
    await server.close();
  }
});

it('requires on-chain removal of a Quick default before unlinking that wallet', async () => {
  const f = await fixture(),
    db = await pool.connect();
  try {
    f.gateway.defaultOwner = async () => f.candidate.identity;
    await expect(
      f.service.walletChange(
        db,
        f.owner,
        { kind: 'native', account: 'alice', permission: 'active' },
        null,
      ),
    ).rejects.toThrow('QUICK_APPROVAL_CHANGE_REQUIRED');
    f.gateway.defaultOwner = async () => null;
    await expect(
      f.service.walletChange(
        db,
        f.owner,
        { kind: 'native', account: 'alice', permission: 'active' },
        null,
      ),
    ).resolves.toBeUndefined();
    f.gateway.defaultOwner = async () => 'ff'.repeat(32);
    await expect(
      f.service.walletChange(db, f.owner, null, {
        kind: 'native',
        account: 'alice',
        permission: 'active',
      }),
    ).rejects.toThrow('QUICK_ORIGINAL_ACCOUNT_REQUIRED');
  } finally {
    db.release();
  }
});
it('accounts for Quick projections and signed preparations in the deletion inventory', async () => {
  const { assertErasureInventory } =
    await import('../../services/api/src/account-exit/inventory.js');
  await expect(assertErasureInventory(pool)).resolves.toBeUndefined();
});

it('requires native deactivation before deleting the account and blocks a still usable registration packet', async () => {
  const { requireQuickDeactivation } =
    await import('../../services/api/src/quick-ballots/accounts.js');
  const f = await fixture();
  const prepared = await f.service.prepare(f.owner, f.token, {
    expectedIdentity: f.candidate.identity,
    intent: { operation: 'register' },
  });
  await expect(requireQuickDeactivation(pool, [f.owner], f.gateway)).rejects.toThrow(
    'QUICK_REGISTRATION_PENDING',
  );
  f.gateway.account = async () => ({
    id: '1',
    identity: f.candidate.identity,
    approval: { kind: 3, credential: '' },
    epoch: '0',
    nonce: '0',
    active: true,
    deactivated_at: 0,
  });
  await expect(requireQuickDeactivation(pool, [f.owner], f.gateway)).rejects.toThrow(
    'QUICK_DEACTIVATION_REQUIRED',
  );
  f.gateway.account = async () => ({
    id: '1',
    identity: f.candidate.identity,
    approval: { kind: 3, credential: '' },
    epoch: '1',
    nonce: '1',
    active: false,
    deactivated_at: Math.floor(Date.now() / 1000),
  });
  await expect(requireQuickDeactivation(pool, [f.owner], f.gateway)).resolves.toBeUndefined();
  expect(prepared.action).toBe('qregister');
});

it('does not count confirmed transactions against the twenty pending preparations', async () => {
  const f = await fixture();
  f.confirm();
  for (let i = 0; i < 21; i++) {
    const prepared = await f.service.prepare(f.owner, f.token, {
      expectedIdentity: f.candidate.identity,
      intent: { operation: 'register' },
    });
    expect(
      (
        await f.service.submit(f.owner, f.token, {
          id: prepared.id,
          proof: '11'.repeat(66),
          incoming: '',
        })
      ).state,
    ).toBe('confirmed');
  }
});

it('requires a signed-in, CSRF-protected session before spending relay resources on a snapshot', async () => {
  const { createServer } = await import('../../services/api/src/server.js');
  const { authChain } = await import('../helpers/auth-chain.js');
  const { openAccountSession } = await import('../../services/api/src/auth/account-session.js');
  const f = await fixture(),
    login = await openAccountSession(pool, f.owner);
  f.gateway.advance = async () => ({ transactionId: null, prepared: true });
  const server = await createServer(pool, authChain, 'http://localhost:5178', {
    quickBallots: f.service,
  });
  try {
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/v1/quick-ballots/1/advance',
          headers: { origin: 'http://localhost:5178' },
          payload: {},
        })
      ).statusCode,
    ).toBe(401);
    const response = await server.inject({
      method: 'POST',
      url: '/v1/quick-ballots/1/advance',
      headers: {
        origin: 'http://localhost:5178',
        cookie: 'daclify_session=' + login.token,
        'x-csrf-token': login.csrfToken,
      },
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ transactionId: null, prepared: true });
  } finally {
    await server.close();
  }
});
