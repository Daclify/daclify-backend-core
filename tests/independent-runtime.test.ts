import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZERO_CODE_HASH, wasmCodeHash } from './helpers/code-hash.js';
import { loadContract, row, send } from './helpers/vert.js';
import { listFirstParty } from './helpers/list-module.js';

const worksHash = wasmCodeHash('.artifacts/contracts/modrelay.wasm');
const signer = PrivateKey.generate('K1');
const daoSchema = z.object({
  reserved: z.number(),
  active_ballots: z.number(),
});

async function boot(
  chain: Blockchain,
  runtimeName: string,
  works: ReturnType<typeof loadContract> | undefined,
  token: ReturnType<typeof loadContract> | undefined,
  fundToken: boolean,
) {
  const runtime = loadContract(chain, runtimeName, '.artifacts/contracts/runtime');
  const module = works ?? loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  let funded = token;
  if (fundToken) funded = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'init', ['ab'.repeat(32)], `${runtimeName}@active`);
  await listFirstParty(runtime, 'works', worksHash, runtimeName);
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, 'alice', signer.toPublic().toString(), 'key', 0],
    'alice@active',
  );
  await send(
    runtime,
    'setmodule',
    [1, 'works', 1, ['propose'], ['reserve', 'govlock'], worksHash],
    'alice@active',
  );
  if (fundToken && funded) {
    await send(funded, 'create', ['eosio.token', '1000.0000 TLOS'], 'eosio.token@active');
    await send(funded, 'issue', ['alice', '30.0000 TLOS', ''], 'eosio.token@active');
  }
  if (!funded) throw new Error('TOKEN_FIXTURE');
  await send(funded, 'transfer', ['alice', runtimeName, '10.0000 TLOS', 'dao:1'], 'alice@active');
  return { runtime, works: module, token: funded };
}

describe('independent deployment with the Hub stopped', () => {
  it('runs treasury and a pinned module callback without a Hub account', async () => {
    const chain = new Blockchain();
    chain.createAccounts('alice');
    const first = await boot(chain, 'daoone', undefined, undefined, true);
    const second = await boot(chain, 'daotwo', first.works, first.token, false);
    await send(first.works, 'reserve', ['daoone', 1, 1, 1, '1.0000 TLOS', 0], 'works@active');
    expect(daoSchema.parse(row(first.runtime, 'daos', first.runtime.toBigInt(), 1n)).reserved).toBe(
      10000,
    );
    expect(
      daoSchema.parse(row(second.runtime, 'daos', second.runtime.toBigInt(), 1n)).reserved,
    ).toBe(0);
    chain.createAccounts('daclifyhub');
  });

  it('keeps documents, obligations, and governance locks when the module is removed', async () => {
    const chain = new Blockchain();
    chain.createAccounts('alice');
    const { runtime, works } = await boot(chain, 'daoone', undefined, undefined, true);
    const cid = CID.createV1(
      0x55,
      await sha256.digest(new TextEncoder().encode('document')),
    ).toString();
    await send(
      runtime,
      'putdoc',
      ['daoone', 1, 1, 7, 1, cid, '{}', 'ab'.repeat(32), 8, 0, 0],
      'daoone@active',
    );
    await send(works, 'reserve', ['daoone', 1, 4, 1, '1.0000 TLOS', 0], 'works@active');
    await send(works, 'govlock', ['daoone', 1, 4, 100], 'works@active');
    await send(runtime, 'setmodule', [1, 'works', 1, [], [], ZERO_CODE_HASH], 'alice@active');
    expect(
      z
        .object({ document_id: z.union([z.string(), z.number()]), cid: z.string() })
        .parse(row(runtime, 'documents', 1n, 1n)),
    ).toMatchObject({ cid });
    expect(
      z
        .object({ source: z.string(), status: z.number() })
        .parse(row(runtime, 'obligations', 1n, 1n)),
    ).toMatchObject({ source: 'works', status: 0 });
    expect(
      z.object({ active: z.boolean(), source: z.string() }).parse(row(runtime, 'govlocks', 1n, 1n)),
    ).toMatchObject({ active: true, source: 'works' });
    expect(daoSchema.parse(row(runtime, 'daos', runtime.toBigInt(), 1n))).toMatchObject({
      reserved: 10000,
      active_ballots: 1,
    });
    await expect(
      send(works, 'reserve', ['daoone', 1, 5, 1, '1.0000 TLOS', 0], 'works@active'),
    ).rejects.toThrow('MODULE_GRANT');
  });

  it('registers with the Hub without giving the Hub treasury or upgrade authority', async () => {
    const chain = new Blockchain();
    chain.createAccounts('alice');
    const { runtime, works } = await boot(chain, 'daoone', undefined, undefined, true);
    const hub = loadContract(chain, 'daclifyhub', '.artifacts/contracts/hub');
    await send(
      hub,
      'regdeploy',
      ['daoone', 'alice', 'ef'.repeat(32), 1, 'ab'.repeat(32), 'cd'.repeat(32), '{}', false],
      ['daoone@active', 'alice@active'],
    );
    await expect(
      send(
        runtime,
        'setmodule',
        [1, 'works', 1, ['propose'], ['reserve'], worksHash],
        'daclifyhub@active',
      ),
    ).rejects.toThrow();
    await send(works, 'reserve', ['daoone', 1, 9, 1, '1.0000 TLOS', 0], 'works@active');
    expect(daoSchema.parse(row(runtime, 'daos', runtime.toBigInt(), 1n)).reserved).toBe(10000);
  });
});
