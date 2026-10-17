import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ABI } from '@wharfkit/antelope';
import { z } from 'zod';
import { ModulePermissions } from '@daclify/modules';
import {
  encodeDecide,
  encodePayroll,
  ModuleCodeHashes,
  ballotCommitment,
  DecideTableSchemas,
  PayrollTableSchemas,
} from '@daclify/modules/sdk';
import { encodeAction, RuntimeTableSchemas, RuntimeCodeHash } from '../../sdk/index.js';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';
import { contractRamGrowth } from '../../tools/deploy/upgrade-journal.js';
import {
  permissionAuditAccount,
  contextPermissionPlan,
  contextLinkRepairActions,
  assertContextLinkUpgrade,
} from '../../tools/deploy/permissions.js';
const context = contextPermissionPlan('daclifycore', nativeModules);
const missingNames = new Set([
  'daclifycore/recovergrant',
  'daclifycore/ackrecgrant',
  'daclifycore/setcontacts',
  'daclifycore/cancelrec',
  'daclifycore/setrecpolicy',
  'daclifycore/putrecpack',
  'daclifycore/setagentdesc',
  'payroll/commitpriv',
  'payroll/editpriv',
]);
const missingLinks = context.links.filter((link) =>
  missingNames.has(link.account + '/' + link.action),
);
let fixture: NativeContracts | undefined;
beforeAll(async () => {
  const f = await nativeContracts('pre-private-content', true);
  fixture = f;
  const original = permissionAuditAccount(
    await f.api.call({ path: '/v1/chain/get_account', params: { account_name: 'daclifycore' } }),
  );
  const initial = contextLinkRepairActions(context, original);
  if (initial.length) await f.push(initial, [f.key('daclifycore')]);
  expect(missingLinks).toHaveLength(9);
  await f.push(
    missingLinks.map((link) =>
      f.system(
        'unlinkauth',
        { account: 'daclifycore', code: link.account, type: link.action },
        'daclifycore',
        'owner',
      ),
    ),
    [f.key('daclifycore')],
  );
}, 90000);
afterAll(async () => {
  await fixture?.stop();
});
it('preserves original keys, an open ballot and approved payroll through the exact released cohort and signed opt-in successors', async () => {
  if (!fixture) throw Error('OWNED_FIXTURE_REQUIRED');
  const f = fixture;
  expect((await f.api.v1.chain.get_raw_abi('daclifycore')).code_hash.toString()).toBe(
    'afa80071de5578e915c5b4c37d02f294c612a713299fa264116e7f338d65ca2d',
  );
  const dao = await f.dummyDao('alice', false, 1, [], 2);
  const metadata = JSON.stringify({
    schemaVersion: 1,
    title: 'Legacy public identity',
    description: 'Legacy public mission',
  });
  await dao.act('daclifycore', 'setmeta', encodeAction('setmeta', { ...dao.actor(), metadata }));
  await dao.act(
    'daclifycore',
    'commitepoch',
    encodeAction('commitepoch', {
      ...dao.actor(),
      epoch: '1',
      commitment: 'ac'.repeat(32),
      self_grant: '{}',
    }),
  );
  const envelope = JSON.stringify({
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: btoa('i'.repeat(12)),
    ciphertext: btoa('c'.repeat(32)),
  });
  const commitment = createHash('sha256').update(envelope).digest('hex');
  await dao.act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...dao.actor(),
      document_id: '14',
      version: 1,
      value: envelope,
      envelope_version: 1,
      key_epoch: '1',
    }),
  );
  await dao.act(
    'decide',
    'openpoll',
    encodeDecide('openpoll', {
      ...dao.actor(),
      ballot_id: '77',
      kind: 0,
      choices: 3,
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: JSON.stringify({
        schemaVersion: 3,
        semantics: 'poll',
        title: 'Legacy public question',
        description: 'Historical wording stays visible',
        options: ['No', 'Yes', 'Later'],
      }),
    }),
  );
  await dao.act(
    'payroll',
    'commitdoc',
    encodePayroll('commitdoc', {
      ...dao.actor(),
      schedule_id: '91',
      recipient: '2',
      quantity: '1.0000 TLOS',
      periods: 2,
      interval: 86400,
      starts: Math.floor(Date.now() / 1000) + 2,
      label: 'Legacy agreed payroll name',
      document_id: '14',
      document_version: 1,
      expected: commitment,
      successor_of: '0',
    }),
  );
  const read = async (account: string, table: string) =>
    (
      await f.api.v1.chain.get_table_rows({
        code: account,
        scope: 'daclifycore',
        table,
        limit: 100,
      })
    ).rows;
  const before = {
      ballots: z.array(DecideTableSchemas.ballots).parse(await read('decide', 'ballots')),
      ballotDefinitions: z
        .array(DecideTableSchemas.ballotdefs)
        .parse(await read('decide', 'ballotdefs')),
      payrollTerms: z.array(PayrollTableSchemas.payterms).parse(await read('payroll', 'payterms')),
      entries: z.array(PayrollTableSchemas.entries).parse(await read('payroll', 'entries')),
    },
    totals = await dao.totals(),
    original = await dao.member('1');
  const poll = before.ballots.find((row) => row.id === '77'),
    definition = before.ballotDefinitions.find((row) => row.ballot_id === '77');
  if (!poll || !definition) throw Error('LEGACY_BALLOT_REQUIRED');
  expect(definition.version).toBe(1);
  const primaryTables = new Set(
    ABI.from(readFileSync('.artifacts/privacy-upgrade/runtime.abi', 'utf8')).tables.map((row) =>
      String(row.name),
    ),
  );
  const runtimeRows = async () => {
    const scopes = await f.api.v1.chain.get_table_by_scope({ code: 'daclifycore', limit: 100 });
    expect(scopes.more).toBe('');
    const result = [];
    for (const item of scopes.rows) {
      if (!primaryTables.has(String(item.table))) continue;
      const rows = await f.api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: String(item.scope),
        table: String(item.table),
        json: false,
        limit: 100,
      });
      expect(rows.more).toBe(false);
      result.push({ scope: String(item.scope), table: String(item.table), rows: rows.rows });
    }
    return result;
  };
  const originalRows = await runtimeRows();
  const nativeAccount = async () =>
    permissionAuditAccount(
      await f.api.call({ path: '/v1/chain/get_account', params: { account_name: 'daclifycore' } }),
    );
  const originalPermissions = await nativeAccount();
  const repairs = contextLinkRepairActions(context, originalPermissions);
  expect(repairs).toHaveLength(9);
  await expect(
    f.push(
      [
        ...repairs,
        ...missingLinks.map((link) =>
          f.system(
            'unlinkauth',
            { account: 'daclifycore', code: link.account, type: link.action },
            'daclifycore',
            'owner',
          ),
        ),
      ],
      [f.key('daclifycore')],
    ),
  ).rejects.toThrow('NATIVE_REJECTED:transaction_exception');
  assertContextLinkUpgrade(originalPermissions, await nativeAccount());
  const originalAccountRam = Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage),
    originalAbiBytes = (await f.api.v1.chain.get_raw_abi('daclifycore')).abi.array.length;
  // Installing code alone never rewrites per-DAO consent, frozen definitions or approved liabilities.
  await f.deploy('daclifycore', '.artifacts/contracts/runtime');
  expect(
    Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage) - originalAccountRam,
  ).toBe(
    contractRamGrowth(
      readFileSync('.artifacts/contracts/runtime.wasm').length,
      readFileSync('.artifacts/privacy-upgrade/runtime.wasm').length,
      (await f.api.v1.chain.get_raw_abi('daclifycore')).abi.array.length,
      originalAbiBytes,
    ),
  );
  await f.call('daclifycore', 'rebindramobs', {
    expected_old_hash: 'afa80071de5578e915c5b4c37d02f294c612a713299fa264116e7f338d65ca2d',
    expected_new_hash: RuntimeCodeHash,
  });
  await f.push(repairs, [f.key('daclifycore')]);
  assertContextLinkUpgrade(originalPermissions, await nativeAccount(), missingLinks);
  // Rollback is qualified before any private writes; later application writes require a new review.
  await f.push(
    missingLinks.map((link) =>
      f.system(
        'unlinkauth',
        { account: 'daclifycore', code: link.account, type: link.action },
        'daclifycore',
        'owner',
      ),
    ),
    [f.key('daclifycore')],
  );
  await f.deploy('daclifycore', '.artifacts/privacy-upgrade/runtime');
  await f.call('daclifycore', 'rebindramobs', {
    expected_old_hash: RuntimeCodeHash,
    expected_new_hash: 'afa80071de5578e915c5b4c37d02f294c612a713299fa264116e7f338d65ca2d',
  });
  expect(await runtimeRows()).toEqual(originalRows);
  assertContextLinkUpgrade(originalPermissions, await nativeAccount());
  await f.deploy('daclifycore', '.artifacts/contracts/runtime');
  await f.call('daclifycore', 'rebindramobs', {
    expected_old_hash: 'afa80071de5578e915c5b4c37d02f294c612a713299fa264116e7f338d65ca2d',
    expected_new_hash: RuntimeCodeHash,
  });
  await f.push(repairs, [f.key('daclifycore')]);
  for (const name of ['decide', 'payroll'] as const) {
    await f.deploy(name, '../daclify-backend-modules/.artifacts/contracts/' + name);
    await f.call('daclifycore', 'setramcode', { account: name, code_hash: ModuleCodeHashes[name] });
    await f.call('daclifycore', 'listmod', {
      account: name,
      publisher: 'alice',
      party: 0,
      accepts_fee_rule: 1,
      price: '0.0000 TLOS',
      code_hash: ModuleCodeHashes[name],
      title: 'Owned qualified upgrade ' + name,
    });
    await f.call(
      'daclifycore',
      'setmodule',
      {
        dao_id: dao.daoId,
        account: name,
        version: 1,
        actions: ModulePermissions[name].actions,
        grants: ModulePermissions[name].grants,
        code_hash: ModuleCodeHashes[name],
      },
      'alice',
    );
  }
  expect((await dao.state()).ballotDefinitions.find((row) => row.ballot_id === '77')).toEqual(
    definition,
  );
  expect((await dao.state()).payrollTerms).toEqual(before.payrollTerms);
  const afterInstall = await dao.totals();
  expect([afterInstall.available, afterInstall.reserved, afterInstall.claims]).toEqual([
    totals.available,
    totals.reserved,
    totals.claims,
  ]);
  expect((await dao.member('1')).signing_key).toBe(original.signing_key);
  const next = JSON.stringify({
    schemaVersion: 4,
    title: 'Private DAO',
    description: '',
    purpose: 'custom',
    setup: null,
    privateIdentity: { documentId: '14', version: 1, commitment, keyEpoch: '1' },
  });
  const update = encodeAction('setmeta', {
    ...dao.actor(),
    metadata: next,
    expected: createHash('sha256').update(metadata).digest('hex'),
  });
  await expect(
    dao.act(
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', {
        ...dao.actor('2'),
        metadata: next,
        expected: createHash('sha256').update(metadata).digest('hex'),
      }),
      '2',
    ),
  ).rejects.toThrow('ADMIN_REQUIRED');
  await dao.act('daclifycore', 'setmeta', update);
  await expect(dao.act('daclifycore', 'setmeta', update)).rejects.toThrow(
    'PRIVATE_METADATA_CHANGED',
  );
  await expect(
    dao.act('daclifycore', 'setmeta', encodeAction('setmeta', { ...dao.actor(), metadata })),
  ).rejects.toThrow('PRIVATE_METADATA_DOWNGRADE');
  const identityBytes = async () => {
    const rows = await f.api.v1.chain.get_table_rows({
      code: 'daclifycore',
      scope: dao.daoId,
      table: 'ramstats',
      limit: 20,
    });
    const counter = z
      .array(RuntimeTableSchemas.ramstats)
      .parse(rows.rows)
      .find((row) => row.payer === 'daclifycore');
    if (!counter) throw Error('RAM_COUNTER_REQUIRED');
    return BigInt(counter.identity);
  };
  const actorBytes = async () => {
    const rows = await f.api.v1.chain.get_table_rows({
      code: 'daclifycore',
      scope: dao.daoId,
      table: 'actors',
      key_type: 'i64',
      limit: 1,
      json: false,
    });
    const packed = z.array(z.string()).parse(rows.rows)[0];
    if (!packed) throw Error('ACTOR_BYTES_REQUIRED');
    return BigInt(packed.length / 2);
  };
  const beforeActorRam = await identityBytes(),
    beforeActorBytes = await actorBytes();
  await dao.act(
    'daclifycore',
    'setagentdesc',
    encodeAction('setagentdesc', {
      ...dao.actor(),
      subject: '1',
      reference: { document_id: '14', version: 1, commitment, key_epoch: '1' },
    }),
  );
  expect((await identityBytes()) - beforeActorRam).toBe((await actorBytes()) - beforeActorBytes);
  const retainedBytes = async () => {
    const rows = await f.api.v1.chain.get_table_rows({
      code: 'daclifycore',
      scope: dao.daoId,
      table: 'ramstats',
      limit: 20,
    });
    const counter = z
      .array(RuntimeTableSchemas.ramstats)
      .parse(rows.rows)
      .find((row) => row.payer === 'payroll');
    if (!counter) throw Error('RAM_COUNTER_REQUIRED');
    return BigInt(counter.retained);
  };
  const controlBytes = async () => {
    const rows = await f.api.v1.chain.get_table_rows({
      code: 'payroll',
      scope: 'daclifycore',
      table: 'controls',
      key_type: 'i64',
      limit: 1,
      json: false,
    });
    const packed = z.array(z.string()).parse(rows.rows)[0];
    if (!packed) throw Error('CONTROL_BYTES_REQUIRED');
    return BigInt(packed.length / 2);
  };
  const beforeControlRam = await retainedBytes(),
    beforeControlBytes = await controlBytes();
  await dao.act(
    'payroll',
    'editpriv',
    encodePayroll('editpriv', {
      ...dao.actor(),
      schedule_id: '91',
      label: { document_id: '14', version: 1, commitment, key_epoch: '1' },
    }),
  );
  expect((await retainedBytes()) - beforeControlRam).toBe(
    (await controlBytes()) - beforeControlBytes,
  );
  expect((await dao.state()).payrollTerms).toEqual(before.payrollTerms);
  const hash = ballotCommitment({
    chainId: f.chainId,
    runtime: dao.reference.contract,
    decide: 'decide',
    ballot: poll,
    definition,
  });
  expect(hash).toBe(definition.commitment);
  await dao.act(
    'decide',
    'votecommit',
    encodeDecide('votecommit', { ...dao.actor('2'), ballot_id: '77', choice: 1, expected: hash }),
    '2',
  );
  const entry = before.entries.find((row) => row.schedule_id === '91');
  if (!entry) throw Error('PAYROLL_ENTRY_REQUIRED');
  await f.call('payroll', 'settle', {
    runtime: 'daclifycore',
    dao_id: dao.daoId,
    entry_id: entry.id,
  });
  expect((await dao.totals()).claims).toBe('10000');
  const member = await dao.member('1');
  expect({ ...member, nonce: original.nonce }).toEqual(original);
  const rows = await f.api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: dao.daoId,
    table: 'members',
    limit: 20,
  });
  expect(z.array(RuntimeTableSchemas.members).parse(rows.rows)).toHaveLength(3);
});
