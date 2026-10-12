import { beforeAll, afterAll, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import { migrate } from '../../services/api/src/store.js';
import { MiniAppCleanup } from '../../services/api/src/mini-apps/cleanup.js';
import { appBindingHash } from '../../protocol/mini-app-database.js';
import { verifyCleanupNotice, VerifiedIssuerKeysSchema } from '../../sdk/mini-app-cleanup.js';
import { miniBinding, miniActor } from '../helpers/mini-app-store.js';
import { appConfigurationHash } from '../../protocol/connected-apps.js';
import { ConnectedApps } from '../../services/api/src/connected-apps/service.js';
import { authChain } from '../helpers/auth-chain.js';
import { AppIssuerKeySchema } from '../../services/api/src/connected-apps/config.js';
import { UserMembershipSchema } from '../../protocol/api.js';
import { readAccount } from '../../services/api/src/auth/account-session.js';
import { PrivateKey } from '@wharfkit/antelope';
const source = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(source.hostname) || !source.pathname.endsWith('_test'))
  throw Error('OWNED_TEST_DATABASE_REQUIRED');
const database = 'daclify_cleanup_' + randomBytes(6).toString('hex') + '_test',
  target = new URL(source);
target.pathname = '/' + database;
const owner = new Pool({ connectionString: source.toString() }),
  pool = new Pool({ connectionString: target.toString() });
beforeAll(async () => {
  await owner.query('CREATE DATABASE ' + database);
  await migrate(pool);
});
afterAll(async () => {
  await pool.end();
  await owner.query('DROP DATABASE ' + database);
  await owner.end();
});
it('freezes scope, re-signs the same event after an unknown response and applies only an exact leased acknowledgment', async () => {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }),
    jwk = AppIssuerKeySchema.parse({
      ...keys.privateKey.export({ format: 'jwk' }),
      kid: 'cleanup-owned-fixture-key',
    });
  const config = {
    schemaVersion: 2 as const,
    dao: {
      chainId: miniBinding.chainId,
      contract: miniBinding.runtime,
      daoId: miniBinding.daoId,
      interfaceVersion: 1,
    },
    appId: '1',
    revision: '1',
    name: 'Owned app',
    origins: ['https://tasks.example'],
    redirectUris: ['https://tasks.example/callback'],
    cleanupUrl: 'https://tasks.example/cleanup',
    activityAccount: 'daclifyactiv',
    enabled: true,
  };
  const native = {
    id: '1',
    revision: '1',
    config_hash: appConfigurationHash(config),
    target: 'daclifyactiv',
    enabled: true,
    security_epoch: '1',
  };
  let memberId = '1';
  const connected = await ConnectedApps.create(
    pool,
    {
      network: authChain.network,
      registry: async () => [native],
      membership: async (account) =>
        UserMembershipSchema.parse({
          dao: config.dao,
          memberId,
          nonce: '0',
          active: true,
          admin: false,
          reviewer: false,
          credits: '0',
          stake: '0',
          claim: '0',
          nativeAccount: '',
          custody: 'user-controlled',
          signingKey: account.signingKey,
        }),
      session: async () => null,
      relay: async () => {
        throw Error('unused');
      },
      activity: async () => ({ receipts: [], next: null }),
      keys: async () => {
        throw Error('unused');
      },
    },
    { issuer: miniBinding.issuer, frontendOrigin: 'https://frontend.example', signingKey: jwk },
  );
  const account = randomUUID(),
    operation = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,'user-controlled',$3)",
    [
      account,
      PrivateKey.generate('K1').toPublic().toString(),
      keys.publicKey.export({ format: 'jwk' }),
    ],
  );
  await pool.query(
    'INSERT INTO connected_apps(id,chain_id,runtime,dao_id,app_id) VALUES($1,$2,$3,$4,$5)',
    [
      miniBinding.clientId,
      miniBinding.chainId,
      miniBinding.runtime,
      miniBinding.daoId,
      miniBinding.appId,
    ],
  );
  await pool.query(
    'INSERT INTO connected_app_configs(client_id,revision,config,config_hash) VALUES($1,$2,$3,$4)',
    [miniBinding.clientId, '1', config, native.config_hash],
  );
  await pool.query(
    "INSERT INTO account_exit_operations(id,account_id,mode,intent,components,status_hash,expires_at) VALUES($1,$2,'delete-account',$3,$4,$5,now()+interval '30 days')",
    [
      operation,
      account,
      { version: 1, mode: 'delete-account', memberships: [] },
      JSON.stringify([{ id: 'apps', state: 'pending', reason: 'APP_CLEANUP_NOTICES_PENDING' }]),
      randomBytes(32),
    ],
  );
  const principal = await readAccount(pool, account);
  if (!principal) throw Error('FIXTURE_ACCOUNT');
  const issued = await connected.claims(principal, miniBinding.clientId, '1', null, null);
  expect(
    (
      await pool.query(
        "SELECT to_jsonb(s)->>'member_id' AS member FROM connected_app_subjects s WHERE account_id=$1",
        [account],
      )
    ).rows,
  ).toEqual([{ member: '1' }]);
  memberId = '2';
  await expect(connected.claims(principal, miniBinding.clientId, '1', null, null)).rejects.toThrow(
    'APP_SUBJECT_MEMBER_CHANGED',
  );
  memberId = '1';
  await pool.query(
    'INSERT INTO account_exit_memberships(operation_id,context,reference) VALUES($1,$2,$3)',
    [operation, 'owned', { reference: config.dao, memberId: miniActor.memberId }],
  );
  await pool.query(
    'INSERT INTO account_exit_app_subjects(operation_id,client_id,subject,member_id,configuration_hash) VALUES($1,$2,$3,1,$4)',
    [operation, miniBinding.clientId, issued.sub, appConfigurationHash(config)],
  );
  const seen: string[] = [];
  let unavailable = true;
  const service = new MiniAppCleanup(pool, connected, {
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    request: async (_url, _address, _signal, token) => {
      const notice = await verifyCleanupNotice(
        token,
        miniBinding.issuer,
        VerifiedIssuerKeysSchema.parse(connected.jwks()),
        miniBinding,
      );
      seen.push(notice.eventId);
      if (unavailable) throw Error('unknown response');
      return {
        status: 200,
        bytes: new TextEncoder().encode(
          JSON.stringify({
            eventId: notice.eventId,
            bindingHash: appBindingHash(miniBinding),
            state: 'confirmed',
            retentionCodes: [],
          }),
        ),
      };
    },
  });
  const draft = { ...config, revision: '2', cleanupUrl: 'https://tasks.example/unpublished-draft' };
  await pool.query(
    'INSERT INTO connected_app_configs(client_id,revision,config,config_hash) VALUES($1,$2,$3,$4)',
    [miniBinding.clientId, '2', draft, appConfigurationHash(draft)],
  );
  await service.freeze(pool, operation);
  expect(await service.process(operation)).toBe('retry');
  unavailable = false;
  await pool.query('UPDATE mini_app_cleanup_notices SET due_at=now()');
  expect(await service.process(operation)).toBe('completed');
  expect(seen).toHaveLength(2);
  expect(seen[1]).toBe(seen[0]);
  expect((await pool.query('SELECT subject,member_id FROM mini_app_cleanup_notices')).rows).toEqual(
    [{ subject: null, member_id: null }],
  );
  expect(
    (await pool.query('SELECT components FROM account_exit_operations WHERE id=$1', [operation]))
      .rows[0]?.components,
  ).toEqual([{ id: 'apps', state: 'confirmed', reason: 'APP_OPERATOR_ACKNOWLEDGED' }]);
  expect(await service.process(operation)).toBe('completed');
  expect(seen).toHaveLength(2);
  const second = randomUUID();
  await pool.query(
    "INSERT INTO account_exit_operations(id,account_id,mode,intent,components,status_hash,expires_at) VALUES($1,$2,'delete-account',$3,$4,$5,now()+interval '30 days')",
    [
      second,
      account,
      { version: 1, mode: 'delete-account', memberships: [] },
      JSON.stringify([{ id: 'apps', state: 'pending', reason: 'APP_CLEANUP_PENDING' }]),
      randomBytes(32),
    ],
  );
  for (const subject of [randomUUID(), randomUUID()])
    await pool.query(
      'INSERT INTO account_exit_app_subjects(operation_id,client_id,subject,member_id,configuration_hash) VALUES($1,$2,$3,1,$4)',
      [second, miniBinding.clientId, subject, appConfigurationHash(config)],
    );
  await service.freeze(pool, second);
  const previous = seen.length;
  expect(await service.process(second)).toBe('progress');
  expect(seen.length - previous).toBe(1);
  expect(await service.process(second)).toBe('completed');
  expect(seen.length - previous).toBe(2);

  async function createOperation(
    mode: 'leave-all' | 'delete-account' = 'delete-account',
    known = true,
  ) {
    const id = randomUUID(),
      components = [
        { id: 'apps', state: 'pending', reason: 'APP_CLEANUP_PENDING' },
        ...(mode === 'leave-all'
          ? [
              {
                id:
                  'membership:' +
                  miniBinding.chainId +
                  ':' +
                  miniBinding.runtime +
                  ':' +
                  miniBinding.daoId +
                  ':1',
                state: 'pending',
                reason: 'SIGNATURE_REQUIRED',
              },
            ]
          : []),
      ];
    await pool.query(
      "UPDATE account_exit_operations SET state='expired' WHERE account_id=$1 AND state='processing'",
      [account],
    );
    await pool.query(
      "INSERT INTO account_exit_operations(id,account_id,mode,intent,components,status_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '30 days')",
      [
        id,
        account,
        mode,
        { version: 1, mode, memberships: [] },
        JSON.stringify(components),
        randomBytes(32),
      ],
    );
    await pool.query(
      'INSERT INTO account_exit_app_subjects(operation_id,client_id,subject,member_id,configuration_hash) VALUES($1,$2,$3,$4,$5)',
      [id, miniBinding.clientId, issued.sub, known ? '1' : null, appConfigurationHash(config)],
    );
    await Promise.all([service.freeze(pool, id), service.freeze(pool, id)]);
    expect(
      (await pool.query('SELECT 1 FROM mini_app_cleanup_notices WHERE operation_id=$1', [id]))
        .rowCount,
    ).toBe(1);
    return id;
  }
  const waiting = await createOperation('leave-all'),
    beforeDeparture = seen.length;
  expect(await service.process(waiting)).toBe('retry');
  expect(seen.length).toBe(beforeDeparture);
  await pool.query(
    "UPDATE account_exit_operations SET components=(SELECT jsonb_agg(CASE WHEN c->>'id' LIKE 'membership:%' THEN c||jsonb_build_object('state','confirmed') ELSE c END) FROM jsonb_array_elements(components)c) WHERE id=$1",
    [waiting],
  );
  expect(await service.process(waiting)).toBe('completed');
  expect(seen.length).toBe(beforeDeparture + 1);
  const legacy = await createOperation('delete-account', false);
  expect(await service.process(legacy)).toBe('completed');
  expect(
    (
      await pool.query('SELECT state,reason FROM mini_app_cleanup_notices WHERE operation_id=$1', [
        legacy,
      ])
    ).rows,
  ).toEqual([{ state: 'unavailable', reason: 'APP_MEMBER_REFERENCE_UNAVAILABLE' }]);
  const privateTarget = await createOperation(),
    beforePrivate = seen.length,
    privateService = new MiniAppCleanup(pool, connected, {
      lookup: async () => [{ address: '127.0.0.1', family: 4 }],
      request: async () => {
        throw Error('Private address must not be requested');
      },
    });
  expect(await privateService.process(privateTarget)).toBe('retry');
  expect(seen.length).toBe(beforePrivate);
  const stale = await createOperation();
  native.config_hash = 'ef'.repeat(32);
  await pool.query('UPDATE mini_app_cleanup_notices SET attempts=11 WHERE operation_id=$1', [
    stale,
  ]);
  expect(await service.process(stale)).toBe('completed');
  expect(seen.length).toBe(beforePrivate);
  native.config_hash = appConfigurationHash(config);
  const mismatched = await createOperation(),
    wrongAck = new MiniAppCleanup(pool, connected, {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      request: async () => ({
        status: 200,
        bytes: new TextEncoder().encode(
          JSON.stringify({
            eventId: randomUUID(),
            bindingHash: appBindingHash(miniBinding),
            state: 'confirmed',
            retentionCodes: [],
          }),
        ),
      }),
    });
  expect(await wrongAck.process(mismatched)).toBe('retry');
  expect(
    (
      await pool.query(
        'SELECT acknowledgment FROM mini_app_cleanup_notices WHERE operation_id=$1',
        [mismatched],
      )
    ).rows,
  ).toEqual([{ acknowledgment: null }]);
  const expired = await createOperation();
  await pool.query(
    "UPDATE mini_app_cleanup_notices SET expires_at=now()-interval '1 second' WHERE operation_id=$1",
    [expired],
  );
  expect(await service.process(expired)).toBe('completed');
  expect(
    (
      await pool.query(
        'SELECT state,subject,member_id FROM mini_app_cleanup_notices WHERE operation_id=$1',
        [expired],
      )
    ).rows,
  ).toEqual([{ state: 'unavailable', subject: null, member_id: null }]);
});
