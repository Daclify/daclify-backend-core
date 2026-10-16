import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { ABI, Serializer } from '@wharfkit/antelope';
import { CID } from 'multiformats/cid';
import { create as multihash } from 'multiformats/hashes/digest';
import { z } from 'zod';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import {
  archiveSourceSchema,
  buildArchiveTree,
  encodeArchiveChunk,
  verifyArchiveChunkDescriptor,
  decodeReleasedArchiveRow,
} from '@daclify/modules/archive';
import { encodeAction, RuntimeCodeHash, RuntimeTableSchemas } from '../../sdk/index.js';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';

let fixture: NativeContracts | undefined;
beforeAll(async () => {
  fixture = await nativeContracts(false, true);
}, 90000);
afterAll(async () => {
  await fixture?.stop();
});
it('prunes only verified superseded ciphertext and restores its exact row without replacing its decryption key', async () => {
  if (!fixture) throw Error('OWNED_FIXTURE_REQUIRED');
  const f = fixture,
    runtime = 'daclifycore',
    dao = await f.dummyDao('alice', false, 0, [], 2);
  // No module rights or liabilities are created in this isolated archive fixture.
  for (const module of nativeModules) {
    await f.call(
      runtime,
      'setmodule',
      {
        dao_id: dao.daoId,
        account: module.account,
        version: 1,
        actions: [],
        grants: [],
        code_hash: ModuleCodeHashes[module.id],
      },
      'alice',
    );
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]),
    iv = randomBytes(12);
  const plaintext = new TextEncoder().encode('Owned confidential archive recovery canary');
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const value = JSON.stringify({
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: iv.toString('base64'),
    ciphertext: Buffer.from(encrypted).toString('base64'),
  });
  await dao.act(
    runtime,
    'commitepoch',
    encodeAction('commitepoch', {
      ...dao.actor(),
      epoch: '1',
      commitment: 'ab'.repeat(32),
      self_grant: '{}',
    }),
  );
  for (const version of [1, 2])
    await dao.act(
      runtime,
      'putjson',
      encodeAction('putjson', {
        ...dao.actor(),
        document_id: '88',
        version,
        value,
        envelope_version: 1,
        key_epoch: '1',
      }),
    );
  const content = () => f.gateway.content(dao.daoId);
  const original = (await content()).documents.find((row) => row.version === 1);
  if (!original) throw Error('ORIGINAL_ROW_REQUIRED');
  const agedHash = createHash('sha256')
    .update(readFileSync('.artifacts/document-aged/runtime.wasm'))
    .digest('hex');
  const agedAbi = await f.deploy(runtime, '.artifacts/document-aged/runtime');
  await f.call(runtime, 'rebindramobs', {
    expected_old_hash: RuntimeCodeHash,
    expected_new_hash: agedHash,
  });
  await f.push(
    [
      f.action(
        runtime,
        'agedoc',
        { dao_id: dao.daoId, id: original.id },
        [{ actor: runtime, permission: 'active' }],
        agedAbi,
      ),
    ],
    [f.key(runtime)],
  );
  await f.deploy(runtime, '.artifacts/contracts/runtime');
  await f.call(runtime, 'rebindramobs', {
    expected_old_hash: agedHash,
    expected_new_hash: RuntimeCodeHash,
  });
  await f.push(
    ['archapprove', 'restoredoc'].map((action) =>
      f.system(
        'linkauth',
        { account: runtime, code: runtime, type: action, requirement: 'execctx' },
        runtime,
        'owner',
      ),
    ),
    [f.key(runtime)],
  );
  await f.call(runtime, 'backfilldocs', { dao_id: dao.daoId, limit: 25 });
  await f.call(runtime, 'setarchcfg', {
    verifier: 'alice',
    minimum_retention_seconds: 90 * 86400,
    pruning_enabled: true,
  });
  const schema = archiveSourceSchema('document-versions'),
    abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
  const records = [
    {
      primaryKey: original.id,
      packed: Serializer.encode({ abi, type: 'document_record', object: original }).hexString,
    },
  ];
  const info = await f.api.v1.chain.get_info(),
    block = await f.api.v1.chain.get_block(info.last_irreversible_block_num);
  const domain = {
    format_version: 1 as const,
    chain_id: f.chainId,
    runtime,
    dao_id: dao.daoId,
    source: runtime,
    code_hash: RuntimeCodeHash,
    abi_hash: schema.rawAbiHash,
    schema_hash: schema.schemaHash,
    table: 'documents',
    scope: dao.daoId,
    chunk_ordinal: 0,
    leaf_count: 1,
  };
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const cid = (bytes: Uint8Array) =>
    CID.createV1(0x55, multihash(0x12, Buffer.from(hash(bytes), 'hex'))).toString();
  const tree = buildArchiveTree(domain, records),
    bytes = encodeArchiveChunk(domain, records);
  const chunk = {
    domain,
    root: tree.root,
    cid: cid(bytes),
    bytes: bytes.length,
    commitment: hash(bytes),
    first_key: original.id,
    last_key: original.id,
  };
  const manifest = {
    format_version: 1,
    chain_id: f.chainId,
    runtime,
    dao_id: dao.daoId,
    source: runtime,
    code_hash: RuntimeCodeHash,
    abi_hash: schema.rawAbiHash,
    block_number: block.block_num.toNumber(),
    block_id: block.id.toString(),
    timestamp: block.timestamp.toDate().toISOString(),
    families: [
      {
        kind: 'document-versions',
        parent_id: '88',
        table: 'documents',
        scope: dao.daoId,
        schema_hash: schema.schemaHash,
        records: '1',
        chunks: [chunk],
      },
    ],
    files: [],
  };
  const body = new TextEncoder().encode(JSON.stringify(manifest)),
    commitment = hash(body);
  // This attests owned fixture bytes; independent provider and backup qualification is separate.
  await f.call(
    runtime,
    'archattest',
    {
      dao_id: dao.daoId,
      manifest,
      manifest_cid: cid(body),
      manifest_bytes: body.length,
      manifest_commitment: commitment,
      backup_commitment: hash(bytes),
      retention_seconds: 90 * 86400,
    },
    'alice',
  );
  const anchors = await f.api.v1.chain.get_table_rows({
    code: runtime,
    scope: dao.daoId,
    table: 'archives',
    limit: 25,
  });
  const anchor = z
    .array(RuntimeTableSchemas.archives)
    .parse(anchors.rows)
    .find((row) => row.manifest_commitment === commitment);
  if (!anchor) throw Error('ANCHOR_REQUIRED');
  const prune = {
    dao_id: dao.daoId,
    archive_id: anchor.id,
    chunk_ordinal: 0,
    start: 0,
    proofs: [{ primary_key: original.id, siblings: [] }],
  };
  await expect(f.call(runtime, 'prunedocs', prune)).rejects.toThrow('ARCHIVE_APPROVAL');
  await dao.act(
    runtime,
    'archapprove',
    encodeAction('archapprove', {
      ...dao.actor(),
      manifest_commitment: commitment,
      descriptor_commitment: anchor.descriptor_commitment,
      backup_commitment: hash(bytes),
      retention_seconds: 90 * 86400,
    }),
  );
  const { first_key, last_key, ...descriptor } = chunk;
  const readableChunk = { ...descriptor, firstKey: first_key, lastKey: last_key };
  const corrupt = bytes.slice();
  corrupt[corrupt.length - 1] = (corrupt.at(-1) ?? 0) ^ 1;
  expect(() => verifyArchiveChunkDescriptor(readableChunk, corrupt)).toThrow();
  const ram = async () => Number((await f.api.v1.chain.get_account(runtime)).ram_usage.toString());
  const activity = async () => {
    const rows = await f.api.v1.chain.get_table_rows({
      code: runtime,
      scope: dao.daoId,
      table: 'ramstats',
      limit: 25,
    });
    const row = z
      .array(RuntimeTableSchemas.ramstats)
      .parse(rows.rows)
      .find((row) => row.payer === runtime);
    if (!row) throw Error('RAM_COUNTER_REQUIRED');
    return Number(row.activity);
  };
  const beforeRam = await ram(),
    beforeActivity = await activity();
  const pruned = await f.call(runtime, 'prunedocs', prune);
  const removed = beforeRam - (await ram());
  expect(removed).toBeGreaterThan(0);
  expect(beforeActivity - (await activity())).toBe(removed);
  await f.call(runtime, 'prunedocs', prune);
  expect((await content()).documents.map((row) => row.version)).toEqual([2]);
  const packed = verifyArchiveChunkDescriptor(readableChunk, bytes)[0];
  if (!packed) throw Error('ARCHIVED_ROW_REQUIRED');
  const decoded = decodeReleasedArchiveRow(domain, packed, '88');
  if (decoded.kind !== 'document-versions') throw Error('ARCHIVE_FAMILY');
  expect(decoded.value).toEqual(original);
  await expect(
    dao.act(
      runtime,
      'restoredoc',
      encodeAction('restoredoc', {
        ...dao.actor(),
        original: { ...original, commitment: '00'.repeat(32) },
      }),
    ),
  ).rejects.toThrow('DOCUMENT_RESTORE_COMMITMENT');
  const restored = await dao.act(
    runtime,
    'restoredoc',
    encodeAction('restoredoc', { ...dao.actor(), original }),
  );
  expect(await ram()).toBe(beforeRam);
  expect(await activity()).toBe(beforeActivity);
  const cpu = (result: typeof pruned) =>
    z.object({ receipt: z.object({ cpu_usage_us: z.number() }) }).parse(result.processed).receipt
      .cpu_usage_us;
  writeFileSync(
    '.artifacts/native/private-archive-resources.json',
    JSON.stringify(
      {
        runtimeCodeHash: RuntimeCodeHash,
        removedRamBytes: removed,
        pruneCpuUs: cpu(pruned),
        restoreCpuUs: cpu(restored),
        note: 'Owned native fixture; archive attestation uses owned verified bytes, not independent-provider qualification.',
      },
      null,
      2,
    ) + '\n',
  );
  expect((await content()).documents).toContainEqual(original);
  const replacement = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'decrypt',
  ]);
  await expect(
    crypto.subtle.decrypt({ name: 'AES-GCM', iv }, replacement, encrypted),
  ).rejects.toThrow();
  expect(
    new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)),
  ).toEqual(plaintext);
}, 90000);
