import assert from 'node:assert/strict';
import {
  createBallotKey,
  verifyBallotKey,
  encryptBallotChoice,
  verifyBallotChoice,
  addBallotCiphertexts,
  decryptBallotChoice,
  proveBallotTally,
  verifyBallotTally,
} from '../../tests/helpers/ballot-proof.js';

const keyContext = '44'.repeat(32);
const key = createBallotKey(keyContext);
assert(verifyBallotKey(keyContext, key.publicKey, key.proof));
const results: {
  syntheticResponses: number;
  encryptionMs: number;
  verificationMs: number;
  tallyMs: number;
  ciphertextBytesPerResponse: number;
  validityProofBytesPerResponse: number;
  finalProofBytes: number;
  observedRssBytes: number;
}[] = [];
for (const count of [1, 32, 128]) {
  let observedRssBytes = process.memoryUsage().rss;
  const votes: (ReturnType<typeof encryptBallotChoice> & { context: string })[] = [];
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const context = i.toString(16).padStart(64, '0');
    votes.push({ context, ...encryptBallotChoice(context, key.publicKey, i % 2) });
    observedRssBytes = Math.max(observedRssBytes, process.memoryUsage().rss);
  }
  const encryptionMs = performance.now() - start;
  const verifyStart = performance.now();
  for (const vote of votes)
    assert(verifyBallotChoice(vote.context, key.publicKey, vote.ciphertext, vote.proof));
  const verificationMs = performance.now() - verifyStart;
  const tallyStart = performance.now();
  let aggregate = '00'.repeat(192),
    up = 0n;
  for (const vote of votes) {
    aggregate = addBallotCiphertexts(aggregate, vote.ciphertext);
    up += BigInt(decryptBallotChoice(key.secret, vote.ciphertext));
    observedRssBytes = Math.max(observedRssBytes, process.memoryUsage().rss);
  }
  assert.equal(up, BigInt(Math.floor(count / 2)));
  const countValue = BigInt(count);
  const proof = proveBallotTally(keyContext, key.secret, aggregate, countValue, up);
  const tallyMs = performance.now() - tallyStart;
  assert(verifyBallotTally(keyContext, key.publicKey, aggregate, countValue, up, proof));
  assert.equal(proof.length / 2, 64);
  results.push({
    syntheticResponses: count,
    encryptionMs,
    verificationMs,
    tallyMs,
    ciphertextBytesPerResponse: 192,
    validityProofBytesPerResponse: 128,
    finalProofBytes: 64,
    observedRssBytes,
  });
}
process.stdout.write(
  JSON.stringify(
    {
      scope:
        'Synthetic Node client/prover measurements; not browser, production server or blockchain table-RAM capacity',
      nodeVersion: process.version,
      results,
    },
    null,
    2,
  ) + '\n',
);
