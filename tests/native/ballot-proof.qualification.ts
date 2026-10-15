import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ABI } from '@wharfkit/antelope';
import { createHash } from 'node:crypto';
import { readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import {
  nativeProcess,
  type NativeProcess,
  type NativePushResult,
} from '../helpers/native-process.js';
import {
  createBallotKey,
  encryptBallotChoice,
  addBallotCiphertexts,
  proveBallotTally,
} from '../helpers/ballot-proof.js';

const artifact = z.enum(['.artifacts/contracts/ballotprobe', '.artifacts/ballot-proof/ballotprobe']).parse(process.env.DACLIFY_BALLOT_PROOF_ARTIFACT ?? '.artifacts/contracts/ballotprobe');
const pointHex = z.string().regex(/^[0-9a-f]{192}$/);
const scalarHex = z.string().regex(/^[0-9a-f]{64}$/);
const vectors = z
  .object({
    generator: pointHex,
    double: pointHex,
    negative: pointHex,
    identity: pointHex,
    smallOrder: pointHex,
    invalidCoordinate: pointHex,
    noncanonicalX: pointHex,
    noncanonicalY: pointHex,
    scalarZero: scalarHex,
    scalarOne: scalarHex,
    scalarTwo: scalarHex,
    scalarOrder: scalarHex,
    scalarLast: scalarHex,
    proofCases: z.object({
      key: z.object({ context: scalarHex, publicKey: pointHex, proof: z.string() }),
      unsafeKey: z.object({ context: scalarHex, publicKey: pointHex, proof: z.string() }),
      unsafeVotes: z.array(
        z.object({ context: scalarHex, ciphertext: z.string(), proof: z.string() }),
      ),
      unsafeTally: z.object({
        context: scalarHex,
        ciphertext: z.string(),
        count: z.string(),
        up: z.string(),
        proof: z.string(),
      }),
      votes: z.array(
        z.object({
          context: scalarHex,
          choice: z.number(),
          ciphertext: z.string(),
          proof: z.string(),
        }),
      ),
      tallies: z.array(
        z.object({
          context: scalarHex,
          ciphertext: z.string(),
          count: z.string(),
          up: z.string(),
          proof: z.string(),
        }),
      ),
    }),
  })
  .parse(
    JSON.parse(
      readFileSync(new URL('../fixtures/ballot-proof-vectors.json', import.meta.url), 'utf8'),
    ),
  );

const receipt = z.object({
  receipt: z.object({ cpu_usage_us: z.number(), net_usage_words: z.number() }),
  elapsed: z.number().optional(),
});

describe('private ballot native proof qualification', () => {
  let f: NativeProcess;
  let abi: ABI;
  let initialRam = '';
  const measurements: { action: string; cpuUs: number; elapsedUs?: number }[] = [];
  const rejectedRpcLatency: { action: string; wallMs: number }[] = [];

  beforeAll(async () => {
    const space = statfsSync('/tmp');
    if (space.bavail * space.bsize < 1024 ** 3) throw new Error('PROBE_FREE_SPACE_REQUIRED');
    f = await nativeProcess();
    await f.create('ballotprobe');
    await f.create('alice');
    const digest = f.featureDigests.get('BLS_PRIMITIVES2');
    if (!digest) throw new Error('PROBE_BLS_FEATURE_REQUIRED');
    const boot = ABI.from(readFileSync('.artifacts/contracts/boot.abi', 'utf8'));
    await f.push(
      [
        f.action(
          'eosio',
          'activate',
          { feature_digest: digest },
          [{ actor: 'eosio', permission: 'active' }],
          boot,
        ),
      ],
      [f.key('eosio')],
    );
    for (let attempt = 0; attempt < 50; attempt++) {
      const features = await f.api.v1.chain.get_activated_protocol_features({ limit: 100 });
      if (
        features.activated_protocol_features.some((row) => row.feature_digest.toString() === digest)
      )
        break;
      if (attempt === 49) throw new Error('PROBE_BLS_ACTIVATION_TIMEOUT');
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
    abi = await f.deploy('ballotprobe', artifact);
    initialRam = (await f.api.v1.chain.get_account('ballotprobe')).ram_usage.toString();
  }, 60000);

  afterAll(async () => {
    if (f) await f.stop();
  });

  async function call(action: string, data: object, actor = 'ballotprobe') {
    const started = performance.now();
    let result: NativePushResult;
    try {
      result = await f.push(
        [f.action('ballotprobe', action, data, [{ actor, permission: 'active' }], abi)],
        [f.key(actor)],
      );
    } catch (cause) {
      rejectedRpcLatency.push({ action, wallMs: performance.now() - started });
      throw cause;
    }
    const value = receipt.parse(result.processed);
    measurements.push({
      action,
      cpuUs: value.receipt.cpu_usage_us,
      ...(value.elapsed === undefined ? {} : { elapsedUs: value.elapsed }),
    });
    return result;
  }

  it.each([
    ['doubling', vectors.generator, vectors.generator, vectors.double],
    ['identity', vectors.generator, vectors.identity, vectors.generator],
    ['inverse', vectors.generator, vectors.negative, vectors.identity],
  ])('adds G1 points with independent %s vectors', async (_name, left, right, expected) => {
    await expect(call('g1add', { left, right, expected })).resolves.toBeDefined();
  });

  it.each([
    ['two', vectors.scalarTwo, vectors.double],
    ['one', vectors.scalarOne, vectors.generator],
    ['zero', vectors.scalarZero, vectors.identity],
    ['largest canonical scalar', vectors.scalarLast, vectors.negative],
  ])('multiplies G1 by %s using the native intrinsic', async (_name, scalar, expected) => {
    await expect(
      call('g1mul', { point: vectors.generator, scalar, expected }),
    ).resolves.toBeDefined();
  });

  it('rejects off-curve and noncanonical field coordinates', async () => {
    for (const point of [
      '01'.repeat(96),
      vectors.invalidCoordinate,
      vectors.noncanonicalX,
      vectors.noncanonicalY,
    ]) {
      await expect(call('g1check', { point, subgroup: true })).rejects.toThrow('BLS_POINT');
    }
  });

  it('rejects the on-curve order-three point as a subgroup member', async () => {
    await expect(
      call('g1check', { point: vectors.smallOrder, subgroup: false }),
    ).resolves.toBeDefined();
    await expect(call('g1check', { point: vectors.smallOrder, subgroup: true })).rejects.toThrow(
      /BLS_(POINT|SUBGROUP)/,
    );
    await expect(
      call('g1check', { point: vectors.generator, subgroup: true }),
    ).resolves.toBeDefined();
  });

  it('rejects malformed point/scalar widths and out-of-range scalars', async () => {
    await expect(call('g1check', { point: '00'.repeat(95), subgroup: true })).rejects.toThrow(
      'BLS_POINT_SIZE',
    );
    await expect(
      call('g1mul', {
        point: vectors.generator,
        scalar: '00'.repeat(31),
        expected: vectors.identity,
      }),
    ).rejects.toThrow('BLS_SCALAR_SIZE');
    await expect(
      call('g1mul', {
        point: vectors.generator,
        scalar: '00'.repeat(33),
        expected: vectors.identity,
      }),
    ).rejects.toThrow('BLS_SCALAR_SIZE');
    await expect(
      call('g1mul', {
        point: vectors.generator,
        scalar: vectors.scalarOrder,
        expected: vectors.identity,
      }),
    ).rejects.toThrow('BLS_SCALAR_RANGE');
    await expect(
      call('g1mul', {
        point: vectors.generator,
        scalar: 'ff'.repeat(32),
        expected: vectors.identity,
      }),
    ).rejects.toThrow('BLS_SCALAR_RANGE');
  });

  it('rejects an incorrect expected result and a different signing account', async () => {
    await expect(
      call('g1add', {
        left: vectors.generator,
        right: vectors.generator,
        expected: vectors.generator,
      }),
    ).rejects.toThrow('BLS_RESULT');
    await expect(
      call(
        'g1mul',
        { point: vectors.generator, scalar: vectors.scalarOne, expected: vectors.generator },
        'alice',
      ),
    ).rejects.toThrow('NATIVE_AUTH_REJECTED');
  });

  it('verifies an independent executive key-possession proof', async () => {
    const { context, publicKey, proof } = vectors.proofCases.key;
    await expect(call('validkey', { context, key: publicKey, proof })).resolves.toBeDefined();
    await expect(
      call('validkey', { context: 'ff'.repeat(32), key: publicKey, proof }),
    ).rejects.toThrow('BLS_KEY_PROOF');
  });

  it('verifies independent binary-response proofs on actual WASM', async () => {
    for (const vote of vectors.proofCases.votes)
      await expect(
        call('validvote', {
          context: vote.context,
          key: vectors.proofCases.key.publicKey,
          ciphertext: vote.ciphertext,
          proof: vote.proof,
        }),
      ).resolves.toBeDefined();
  });

  it('rejects substituted votes, wrong contexts and noncanonical proof scalars', async () => {
    const first = vectors.proofCases.votes[0];
    const second = vectors.proofCases.votes[1];
    if (!first || !second) throw new Error('PROOF_VECTORS_REQUIRED');
    const value = {
      context: first.context,
      key: vectors.proofCases.key.publicKey,
      ciphertext: first.ciphertext,
      proof: first.proof,
    };
    await expect(call('validvote', { ...value, context: 'ff'.repeat(32) })).rejects.toThrow(
      'BLS_VOTE_PROOF',
    );
    await expect(call('validvote', { ...value, ciphertext: second.ciphertext })).rejects.toThrow(
      'BLS_VOTE_PROOF',
    );
    await expect(call('validvote', { ...value, proof: 'ff'.repeat(128) })).rejects.toThrow(
      'BLS_SCALAR_RANGE',
    );
    await expect(call('validvote', { ...value, proof: '00'.repeat(128) })).rejects.toThrow(
      'BLS_PROOF_NONCE',
    );
    await expect(
      call('validvote', { ...value, ciphertext: vectors.identity + first.ciphertext.slice(192) }),
    ).rejects.toThrow('BLS_IDENTITY');
    await expect(call('validvote', { ...value, key: vectors.smallOrder })).rejects.toThrow(
      'BLS_SUBGROUP',
    );
  });

  it('verifies changed, removed, empty and zero-nonce-sum aggregate tallies', async () => {
    for (const tally of vectors.proofCases.tallies)
      await expect(
        call('validtally', { ...tally, key: vectors.proofCases.key.publicKey }),
      ).resolves.toBeDefined();
  });

  it('rejects a changed tally, response count, context or aggregate', async () => {
    const first = vectors.proofCases.tallies[0];
    const changed = vectors.proofCases.tallies[1];
    if (!first || !changed) throw new Error('PROOF_VECTORS_REQUIRED');
    const value = { ...first, key: vectors.proofCases.key.publicKey };
    await expect(call('validtally', { ...value, up: '1' })).rejects.toThrow('BLS_TALLY_PROOF');
    await expect(call('validtally', { ...value, count: '4' })).rejects.toThrow('BLS_TALLY_PROOF');
    await expect(call('validtally', { ...value, count: '1' })).rejects.toThrow('BLS_TALLY_BOUNDS');
    await expect(call('validtally', { ...value, context: 'ff'.repeat(32) })).rejects.toThrow(
      'BLS_TALLY_PROOF',
    );
    await expect(call('validtally', { ...value, ciphertext: changed.ciphertext })).rejects.toThrow(
      'BLS_TALLY_PROOF',
    );
  });

  it('rejects identity proof commitments even when their equations hold', async () => {
    const key = vectors.proofCases.unsafeKey;
    await expect(
      call('validkey', { context: key.context, key: key.publicKey, proof: key.proof }),
    ).rejects.toThrow('BLS_PROOF_NONCE');
    for (const vote of vectors.proofCases.unsafeVotes)
      await expect(
        call('validvote', {
          context: vote.context,
          key: key.publicKey,
          ciphertext: vote.ciphertext,
          proof: vote.proof,
        }),
      ).rejects.toThrow('BLS_PROOF_NONCE');
    await expect(
      call('validtally', { ...vectors.proofCases.unsafeTally, key: key.publicKey }),
    ).rejects.toThrow('BLS_PROOF_NONCE');
  });

  it('accepts freshly generated client proofs without sending the secret key', async () => {
    const context = '57'.repeat(32);
    const key = createBallotKey(context);
    await call('validkey', { context, key: key.publicKey, proof: key.proof });
    let aggregate = '00'.repeat(192);
    for (const choice of [0, 1]) {
      const vote = encryptBallotChoice(context, key.publicKey, choice);
      await call('validvote', {
        context,
        key: key.publicKey,
        ciphertext: vote.ciphertext,
        proof: vote.proof,
      });
      aggregate = addBallotCiphertexts(aggregate, vote.ciphertext);
    }
    const proof = proveBallotTally(context, key.secret, aggregate, 2n, 1n);
    await expect(
      call('validtally', {
        context,
        key: key.publicKey,
        ciphertext: aggregate,
        count: '2',
        up: '1',
        proof,
      }),
    ).resolves.toBeDefined();
  });

  it('uses no persistent table RAM and records actual verification costs', async () => {
    const finalRam = (await f.api.v1.chain.get_account('ballotprobe')).ram_usage.toString();
    expect(finalRam).toBe(initialRam);
    expect(measurements.length).toBeGreaterThanOrEqual(7);
    expect(measurements.every((row) => row.cpuUs >= 0)).toBe(true);
    const output = process.env.DACLIFY_BALLOT_PROOF_REPORT;
    if (output) {
      const wasm = readFileSync(artifact + '.wasm');
      const rawAbi = readFileSync(artifact + '.abi');
      const observed = await f.api.v1.chain.get_raw_abi('ballotprobe');
      const codeHash = createHash('sha256').update(wasm).digest('hex');
      expect(observed.code_hash.toString()).toBe(codeHash);
      writeFileSync(
        output,
        JSON.stringify(
          {
            scope:
              'Stateless BLS12-381 primitives and key/response/tally proof relations; not product ballot authorization, key-grant, state or archive qualification',
            chainId: f.chainId,
            compiler: 'cdt-cpp version 4.1.1',
            runtime: 'v1.2.2',
            optimization: '-O=s',
            codeHash,
            rawAbiHash: observed.abi_hash.toString(),
            abiJsonHash: createHash('sha256').update(rawAbi).digest('hex'),
            wasmBytes: wasm.length,
            ramBefore: initialRam,
            ramAfter: finalRam,
            measurements,
            rejectedRpcLatency,
          },
          null,
          2,
        ) + '\n',
      );
    }
  });
});
