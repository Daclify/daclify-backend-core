import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import {
  APIClient,
  APIError,
  Action,
  ABI,
  Transaction,
  SignedTransaction,
} from '@wharfkit/antelope';
import {
  ArchiveDomainSchema,
  ArchiveRowSchema,
  ArchiveProofSchema,
} from '@daclify/modules/archive';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const vector = z
  .object({
    domain: ArchiveDomainSchema,
    domainHash: z.string().regex(/^[a-f0-9]{64}$/),
    rows: z.array(ArchiveRowSchema),
    leaves: z.array(z.string()),
    root: z.string(),
    proofs: z.array(ArchiveProofSchema),
  })
  .parse(
    JSON.parse(readFileSync('../daclify-backend-modules/tests/fixtures/archive-v1.json', 'utf8')),
  );
const abi = ABI.from(readFileSync('.artifacts/contracts/ramprobe.abi', 'utf8')),
  api = new APIClient({ url: network.url });
let seq = 0;
async function check(data: Record<string, unknown>, action = 'chkarchive') {
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
  const tx = Transaction.from({
    ...info.getTransactionHeader(60 + seq++),
    actions: [
      Action.from(
        {
          account: 'permprobe',
          name: action,
          authorization: [{ actor: 'permprobe', permission: 'active' }],
          data,
        },
        abi,
      ),
    ],
  });
  try {
    const result = await api.v1.chain.push_transaction(
      SignedTransaction.from({
        ...tx,
        signatures: [fixtureKey('permprobe').signDigest(tx.signingDigest(network.chainId))],
      }),
    );
    executedChainResult(result, tx.id.toString());
  } catch (error) {
    const failure = z
      .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
      .safeParse(error instanceof APIError ? error.response.json : undefined);
    for (const detail of failure.success ? failure.data.error.details : []) {
      const code = detail.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1];
      if (code) throw new Error(code);
    }
    throw new Error('NATIVE_ARCHIVE_CHECK_REJECTED');
  }
}
beforeAll(() => {
  unlockFixtureWallet(network.container);
  execFileSync(
    'docker',
    [
      'exec',
      network.container,
      'cleos',
      '--wallet-url',
      'http://127.0.0.1:8900',
      'set',
      'contract',
      'permprobe',
      '/work/.artifacts/contracts',
      'ramprobe.wasm',
      'ramprobe.abi',
      '-p',
      'permprobe@active',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
});
it('matches the independent v1 archive vectors with compiled C++ on the native runtime', async () => {
  for (const [index, row] of vector.rows.entries())
    await check({
      domain: vector.domain,
      index,
      primary: row.primaryKey,
      row: row.packed,
      proof: vector.proofs[index],
      domain_hash: vector.domainHash,
      leaf_hash: vector.leaves[index],
      root: vector.root,
    });
});
it('rejects malformed paths, odd-leaf siblings and incorrect roots before pruning could use them', async () => {
  const row = vector.rows[2];
  if (!row) throw new Error('VECTOR_REQUIRED');
  const base = {
    domain: vector.domain,
    index: 2,
    primary: row.primaryKey,
    row: row.packed,
    proof: vector.proofs[2],
    domain_hash: vector.domainHash,
    leaf_hash: vector.leaves[2],
    root: vector.root,
  };
  await expect(check({ ...base, proof: [] })).rejects.toThrow('ARCHIVE_PROOF_DEPTH');
  await expect(check({ ...base, proof: ['00'.repeat(32), '00'.repeat(32)] })).rejects.toThrow(
    'ARCHIVE_PROOF_DUPLICATE',
  );
  await expect(check({ ...base, root: '00'.repeat(32) })).rejects.toThrow('ARCHIVE_PROOF_ROOT');
  await expect(check({ ...base, domain: { ...vector.domain, leaf_count: 0 } })).rejects.toThrow(
    'ARCHIVE_DOMAIN',
  );
  await expect(check({ ...base, index: 3 })).rejects.toThrow('ARCHIVE_PROOF_INDEX');
});
it('matches the independent packed manifest descriptor in compiled C++ and rejects changed coverage', async () => {
  const fixture = z
    .object({
      nativeDescriptor: z.record(z.string(), z.unknown()),
      descriptorCommitment: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .parse(
      JSON.parse(
        readFileSync('../daclify-backend-modules/tests/fixtures/archive-manifest-v1.json', 'utf8'),
      ),
    );
  await check(
    { descriptor: fixture.nativeDescriptor, expected: fixture.descriptorCommitment },
    'chkmanifest',
  );
  await expect(
    check(
      {
        descriptor: { ...fixture.nativeDescriptor, block_number: 101 },
        expected: fixture.descriptorCommitment,
      },
      'chkmanifest',
    ),
  ).rejects.toThrow('ARCHIVE_DESCRIPTOR_COMMITMENT');
});
