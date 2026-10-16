import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { TimePointSec } from '@greymass/eosio';
import { PrivateKey } from '@wharfkit/antelope';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
import {
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeActionSchemas,
  RuntimeTableSchemas,
} from '../sdk/index.js';
let chain: Blockchain, core: ReturnType<typeof loadContract>, key: PrivateKey, nonce: number;
const metadata = {
  schemaVersion: 4,
  title: 'Private DAO',
  description: '',
  purpose: 'custom',
  setup: null,
  privateIdentity: null,
};
const envelope = JSON.stringify({
  version: 1,
  algorithm: 'AES-256-GCM',
  iv: btoa('i'.repeat(12)),
  ciphertext: btoa('c'.repeat(32)),
});
const reference = {
  document_id: '41',
  version: 1,
  commitment: createHash('sha256').update(envelope).digest('hex'),
  key_epoch: '1',
};
const dao = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1 as const,
};
async function act(
  action: 'commitepoch' | 'putjson' | 'setagentdesc',
  data: unknown,
  signer = key,
) {
  const request = makeInstruction(
    dao,
    '1',
    String(nonce),
    1300,
    dao.contract,
    action,
    encodeAction(action, RuntimeActionSchemas[action].parse(data)),
  );
  await send(
    core,
    'submit',
    [request, signer.signDigest(instructionDigest(request)).toString()],
    'relay@active',
  );
  nonce++;
}
beforeEach(async () => {
  chain = new Blockchain();
  chain.setTime(TimePointSec.from(1000));
  chain.createAccounts('alice', 'relay', 'guardian', 'decide');
  core = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  key = PrivateKey.generate('K1');
  nonce = 0;
  await send(core, 'init', [dao.chainId], 'daclifycore@active');
  await send(
    core,
    'createdao',
    [1, 'alice', JSON.stringify(metadata), 1, 'eosio.token', '4,TLOS'],
    'alice@active',
  );
  await send(
    core,
    'initgov',
    [
      1,
      {
        participant_mode: 1,
        decide: 'decide',
        guardian: 'guardian',
        kind: 0,
        duration: 300,
        quorum: 5000,
        approval: 5001,
        governed_works: true,
        max_commitment: 10000,
        daily_commitment: 20000,
      },
    ],
    'alice@active',
  );
});
it('refuses a public operating name for a newly enrolled private agent', async () => {
  await expect(
    send(
      core,
      'enrollagent',
      [1, 1, '', key.toPublic().toString(), 'fixture', 0, 'secret operator canary'],
      'alice@active',
    ),
  ).rejects.toThrow('PRIVATE_AGENT_REQUIRED');
  expect(row(core, 'actors', 1n, 1n)).toBeUndefined();
});
it('retains only an exact encrypted description, under original agent authority, and allows signed clearing', async () => {
  await send(
    core,
    'enrollagent',
    [1, 1, '', key.toPublic().toString(), 'fixture', 0, 'Agent'],
    'alice@active',
  );
  await act('commitepoch', {
    runtime: dao.contract,
    dao_id: '1',
    member_id: '1',
    epoch: '1',
    commitment: 'ac'.repeat(32),
    self_grant: '{}',
  });
  await act('putjson', {
    runtime: dao.contract,
    dao_id: '1',
    member_id: '1',
    document_id: '41',
    version: 1,
    value: envelope,
    envelope_version: 1,
    key_epoch: '1',
  });
  const input = { runtime: dao.contract, dao_id: '1', member_id: '1', subject: '1', reference };
  await expect(act('setagentdesc', input, PrivateKey.generate('K1'))).rejects.toThrow();
  await expect(
    act('setagentdesc', { ...input, reference: { ...reference, commitment: '00'.repeat(32) } }),
  ).rejects.toThrow('PRIVATE_CONTENT_REFERENCE');
  await expect(
    act('setagentdesc', { ...input, reference: { ...reference, key_epoch: '2' } }),
  ).rejects.toThrow('PRIVATE_CONTENT_EPOCH');
  await act('setagentdesc', input);
  expect(row(core, 'actors', 1n, 1n)).toMatchObject({
    kind: 1,
    operator_label: 'Agent',
    description: { ...reference, document_id: 41, key_epoch: 1 },
  });
  const refs = core.tables.docrefs;
  if (!refs) throw Error('fixture docrefs');
  expect(
    z
      .array(z.object({ table: z.string(), document_id: z.coerce.string() }))
      .parse(refs(1n).getTableRows()),
  ).toContainEqual({ table: 'actors', document_id: '41' });
  expect(
    RuntimeActionSchemas.setagentdesc.safeParse({
      ...input,
      reference: { ...reference, operatorLabel: 'must never be public' },
    }).success,
  ).toBe(false);
  await act('setagentdesc', { ...input, reference: undefined });
  expect(row(core, 'actors', 1n, 1n)).toMatchObject({ operator_label: 'Agent' });
  expect(RuntimeTableSchemas.actors.parse(row(core, 'actors', 1n, 1n)).description).toBeUndefined();
  expect(
    z
      .array(z.object({ document_id: z.coerce.string() }))
      .parse(refs(1n).getTableRows())
      .some((row) => row.document_id === '41'),
  ).toBe(false);
});
