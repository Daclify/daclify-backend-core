import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { statSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { encodePayroll, ModuleCodeHashes } from '@daclify/modules/sdk';
import { encodeAction, RuntimeCodeHash } from '../../sdk/index.js';
import {
  nativeContracts,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';
let fixture: NativeContracts | undefined, dao: DummyDao;
function f() {
  if (!fixture) throw Error('OWNED_FIXTURE_REQUIRED');
  return fixture;
}
beforeAll(async () => {
  fixture = await nativeContracts();
  dao = await fixture.dummyDao('alice', false, 1, [], 2);
}, 90000);
afterAll(async () => {
  await fixture?.stop();
});
it('retains private agent/payroll references under native authority without changing agreed liabilities or original keys', async () => {
  const original = await dao.member('1');
  await dao.act(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', {
      ...dao.actor(),
      metadata: JSON.stringify({
        schemaVersion: 4,
        title: 'Private DAO',
        description: '',
        purpose: 'custom',
        setup: null,
        privateIdentity: null,
      }),
      expected: createHash('sha256').update('{}').digest('hex'),
    }),
  );
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
    }),
    commitment = createHash('sha256').update(envelope).digest('hex');
  for (const documentId of ['42', '91', '99'])
    await dao.act(
      'daclifycore',
      'putjson',
      encodeAction('putjson', {
        ...dao.actor(),
        document_id: documentId,
        version: 1,
        value: envelope,
        envelope_version: 1,
        key_epoch: '1',
      }),
    );
  const ram = async () => {
    const accounts = await Promise.all(
      ['daclifycore', 'payroll'].map((name) => f().api.v1.chain.get_account(name)),
    );
    return accounts.reduce((sum, account) => sum + Number(account.ram_usage.toString()), 0);
  };
  const reference = { document_id: '91', version: 1, commitment, key_epoch: '1' };
  const before = await dao.totals(),
    beforeCommitRam = await ram();
  const committed = await dao.act(
    'payroll',
    'commitpriv',
    encodePayroll('commitpriv', {
      ...dao.actor(),
      schedule_id: '91',
      recipient: '2',
      quantity: '1.0000 TLOS',
      periods: 2,
      interval: 86400,
      starts: Math.floor(Date.now() / 1000) + 300,
      label: reference,
      document_id: '42',
      document_version: 1,
      expected: commitment,
      successor_of: '0',
    }),
  );
  const commitRam = (await ram()) - beforeCommitRam;
  const initialState = await dao.state(),
    after = await dao.totals();
  expect(BigInt(after.available)).toBe(BigInt(before.available) - 20000n);
  expect(BigInt(after.reserved)).toBe(BigInt(before.reserved) + 20000n);
  const names = await f().gateway.privatePayroll(dao.daoId, '91');
  expect(names.agreed).toEqual({ documentId: '91', version: 1, commitment, keyEpoch: '1' });
  expect(names.agreed).toEqual(names.display);
  await dao.act(
    'payroll',
    'edit',
    encodePayroll('edit', {
      ...dao.actor(),
      schedule_id: '91',
      paused: 1,
      label: 'Private payroll',
    }),
  );
  const changedEnvelope = JSON.stringify({
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: btoa('j'.repeat(12)),
    ciphertext: btoa('d'.repeat(32)),
  });
  const display = {
    ...reference,
    version: 2,
    commitment: createHash('sha256').update(changedEnvelope).digest('hex'),
  };
  await dao.act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...dao.actor(),
      document_id: '91',
      version: 2,
      value: changedEnvelope,
      envelope_version: 1,
      key_epoch: '1',
    }),
  );
  const beforeRenameRam = await ram();
  const edited = await dao.act(
    'payroll',
    'editpriv',
    encodePayroll('editpriv', { ...dao.actor(), schedule_id: '91', label: display }),
  );
  const renameRam = (await ram()) - beforeRenameRam;
  expect((await dao.state()).controls[0]?.paused).toBe(1);
  expect((await dao.state()).schedules).toEqual(initialState.schedules);
  expect((await dao.state()).payrollTerms).toEqual(initialState.payrollTerms);
  expect((await dao.totals()).reserved).toBe(after.reserved);
  await expect(
    f().call('payroll', 'releaselabel', {
      runtime: 'daclifycore',
      dao_id: dao.daoId,
      schedule_id: '91',
    }),
  ).rejects.toThrow();
  const description = { documentId: '99', version: 1, commitment, keyEpoch: '1' };
  const nativeDescription = { document_id: '99', version: 1, commitment, key_epoch: '1' };
  await expect(
    dao.act(
      'daclifycore',
      'setagentdesc',
      encodeAction('setagentdesc', {
        ...dao.actor('2'),
        subject: '1',
        reference: nativeDescription,
      }),
      '2',
    ),
  ).rejects.toThrow();
  const beforeAgentRam = await ram();
  const described = await dao.act(
    'daclifycore',
    'setagentdesc',
    encodeAction('setagentdesc', { ...dao.actor(), subject: '1', reference: nativeDescription }),
  );
  const agentRam = (await ram()) - beforeAgentRam;
  expect((await f().gateway.privateAgent(dao.daoId, '1')).reference).toEqual(description);
  expect((await dao.member('1')).signing_key).toBe(original.signing_key);
  expect((await f().gateway.governance(dao.daoId)).actors[0]?.operator_label).toBe('Agent');
  const cpu = (result: typeof committed) =>
    z
      .object({ receipt: z.object({ cpu_usage_us: z.number().int().nonnegative() }) })
      .parse(result.processed).receipt.cpu_usage_us;
  writeFileSync(
    '.artifacts/native/private-module-resources.json',
    JSON.stringify(
      {
        runtimeCodeHash: RuntimeCodeHash,
        payrollCodeHash: ModuleCodeHashes.payroll,
        runtimeWasmBytes: statSync('.artifacts/contracts/runtime.wasm').size,
        payrollWasmBytes: statSync('../daclify-backend-modules/.artifacts/contracts/payroll.wasm')
          .size,
        privateCommitRamBytes: commitRam,
        privateCommitCpuUs: cpu(committed),
        displayRenameRamBytes: renameRam,
        displayRenameCpuUs: cpu(edited),
        agentDescriptionRamBytes: agentRam,
        agentDescriptionCpuUs: cpu(described),
        newTables: 0,
        newSecondaryIndexes: 0,
        note: 'Owned local Spring authority/resource check with synthetic envelopes; actual encryption/decryption is tested in browsers. No network cost guarantee.',
      },
      null,
      2,
    ) + '\n',
  );
});
