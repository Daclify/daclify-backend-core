import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import { loadContract, send, row } from './helpers/vert.js';
let core: ReturnType<typeof loadContract>;
beforeEach(async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'bob');
  core = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  await send(core, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(core, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  for (const id of [1, 2])
    await send(
      core,
      'enroll',
      [1, id, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
});
const put = (document: number, version: number, member = 1) =>
  send(
    core,
    'putjson',
    ['daclifycore', 1, member, document, version, '{}', 0, 0],
    'daclifycore@active',
  );
it('preserves document and primary-key high water without altering original document serialization', async () => {
  await put(9, 1);
  await put(9, 2);
  await put(8, 1);
  expect(RuntimeTableSchemas.docheads.parse(row(core, 'docheads', 1n, 9n))).toMatchObject({
    version: 2,
    author: '1',
  });
  expect(RuntimeTableSchemas.docstate.parse(row(core, 'docstate', 1n, 0n)).high_water).toBe('3');
  const clock = RuntimeTableSchemas.docclocks.parse(row(core, 'docclocks', 1n, 1n));
  expect(clock).toMatchObject({ document_id: '9', version: 1, legacy: false });
  await expect(put(9, 2)).rejects.toThrow('DOCUMENT_VERSION');
  await expect(put(9, 3, 2)).rejects.toThrow('DOCUMENT_AUTHOR');
  expect(RuntimeTableSchemas.docstate.parse(row(core, 'docstate', 1n, 0n)).high_water).toBe('3');
});
it('backfills in bounded pages without resetting creation clocks or allocating duplicate state', async () => {
  for (const id of [1, 2, 3]) await put(id, 1);
  await expect(send(core, 'backfilldocs', [1, 26], 'daclifycore@active')).rejects.toThrow(
    'DOCUMENT_SCAN_BOUNDS',
  );
  await expect(send(core, 'backfilldocs', [1, 1], 'alice@active')).rejects.toThrow();
  const clock = row(core, 'docclocks', 1n, 1n);
  await send(core, 'backfilldocs', [1, 1], 'daclifycore@active');
  expect(RuntimeTableSchemas.docstate.parse(row(core, 'docstate', 1n, 0n))).toMatchObject({
    cursor: '1',
    complete: false,
  });
  await send(core, 'backfilldocs', [1, 1], 'daclifycore@active');
  await send(core, 'backfilldocs', [1, 1], 'daclifycore@active');
  expect(RuntimeTableSchemas.docstate.parse(row(core, 'docstate', 1n, 0n))).toMatchObject({
    cursor: '3',
    complete: true,
  });
  await send(core, 'backfilldocs', [1, 1], 'daclifycore@active');
  expect(row(core, 'docclocks', 1n, 1n)).toEqual(clock);
});

it('refuses direct creation of source coverage attestations', async () => {
  await expect(send(core, 'docsrc', [1, 'alice', ['projects']], 'alice@active')).rejects.toThrow(
    'DOCUMENT_SOURCE_SENDER',
  );
});
