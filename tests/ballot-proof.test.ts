import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  createBallotKey,
  verifyBallotKey,
  encryptBallotChoice,
  verifyBallotChoice,
  addBallotCiphertexts,
  subtractBallotCiphertexts,
  decryptBallotChoice,
  proveBallotTally,
  verifyBallotTally,
} from './helpers/ballot-proof.js';

const context = '11'.repeat(32);
const other = '22'.repeat(32);
const identity = '00'.repeat(192);
const flip = (hex: string) =>
  hex.slice(0, -2) + (Number.parseInt(hex.slice(-2), 16) ^ 1).toString(16).padStart(2, '0');
const independent = z
  .object({
    proofCases: z.object({
      key: z.object({ context: z.string(), publicKey: z.string(), proof: z.string() }),
      unsafeKey: z.object({ context: z.string(), publicKey: z.string(), proof: z.string() }),
      unsafeVotes: z.array(
        z.object({ context: z.string(), ciphertext: z.string(), proof: z.string() }),
      ),
      unsafeTally: z.object({
        context: z.string(),
        ciphertext: z.string(),
        count: z.string(),
        up: z.string(),
        proof: z.string(),
      }),
      votes: z.array(
        z.object({
          context: z.string(),
          choice: z.number(),
          ciphertext: z.string(),
          proof: z.string(),
        }),
      ),
      tallies: z.array(
        z.object({
          context: z.string(),
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
      readFileSync(new URL('./fixtures/ballot-proof-vectors.json', import.meta.url), 'utf8'),
    ),
  ).proofCases;

describe('experimental encrypted binary ballot proofs', () => {
  it('rejects identity proof commitments that expose nonce information', () => {
    const key = independent.unsafeKey;
    expect(verifyBallotKey(key.context, key.publicKey, key.proof)).toBe(false);
    for (const vote of independent.unsafeVotes)
      expect(verifyBallotChoice(vote.context, key.publicKey, vote.ciphertext, vote.proof)).toBe(
        false,
      );
    const tally = independent.unsafeTally;
    expect(
      verifyBallotTally(
        tally.context,
        key.publicKey,
        tally.ciphertext,
        BigInt(tally.count),
        BigInt(tally.up),
        tally.proof,
      ),
    ).toBe(false);
  });
  it('agrees with independent Python key, response and tally proofs', () => {
    const key = independent.key;
    expect(verifyBallotKey(key.context, key.publicKey, key.proof)).toBe(true);
    for (const vote of independent.votes) {
      expect(verifyBallotChoice(vote.context, key.publicKey, vote.ciphertext, vote.proof)).toBe(
        true,
      );
      expect(decryptBallotChoice('2a' + '00'.repeat(31), vote.ciphertext)).toBe(vote.choice);
    }
    for (const tally of independent.tallies)
      expect(
        verifyBallotTally(
          tally.context,
          key.publicKey,
          tally.ciphertext,
          BigInt(tally.count),
          BigInt(tally.up),
          tally.proof,
        ),
      ).toBe(true);
  });
  it('proves key possession and rejects another ballot context or malformed key', () => {
    const key = createBallotKey(context);
    expect(verifyBallotKey(context, key.publicKey, key.proof)).toBe(true);
    expect(verifyBallotKey(other, key.publicKey, key.proof)).toBe(false);
    expect(verifyBallotKey(context, '00'.repeat(96), key.proof)).toBe(false);
    expect(verifyBallotKey(context, key.publicKey, flip(key.proof))).toBe(false);
  });

  it.each([0, 1])(
    'encrypts choice %i with a verifiable binary proof and executive decryption',
    (choice) => {
      const key = createBallotKey(context);
      const vote = encryptBallotChoice(context, key.publicKey, choice);
      expect(verifyBallotChoice(context, key.publicKey, vote.ciphertext, vote.proof)).toBe(true);
      expect(decryptBallotChoice(key.secret, vote.ciphertext)).toBe(choice);
      expect(verifyBallotChoice(other, key.publicKey, vote.ciphertext, vote.proof)).toBe(false);
    },
  );

  it('uses fresh encryption randomness for repeated choices', () => {
    const key = createBallotKey(context);
    const first = encryptBallotChoice(context, key.publicKey, 1);
    const second = encryptBallotChoice(context, key.publicKey, 1);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.proof).not.toBe(second.proof);
    expect(verifyBallotChoice(context, key.publicKey, second.ciphertext, first.proof)).toBe(false);
  });

  it('rejects nonbinary choices, identity ciphertexts and malformed proof scalars', () => {
    const key = createBallotKey(context);
    expect(() => encryptBallotChoice(context, key.publicKey, 2)).toThrow('BALLOT_CHOICE');
    const vote = encryptBallotChoice(context, key.publicKey, 0);
    expect(verifyBallotChoice(context, key.publicKey, vote.ciphertext, 'ff'.repeat(128))).toBe(
      false,
    );
    expect(verifyBallotChoice(context, key.publicKey, identity, vote.proof)).toBe(false);
    expect(verifyBallotChoice(context, key.publicKey, vote.ciphertext, vote.proof.slice(2))).toBe(
      false,
    );
    expect(
      verifyBallotChoice(context, createBallotKey(context).publicKey, vote.ciphertext, vote.proof),
    ).toBe(false);
  });

  it('proves the encrypted aggregate without publishing individual choices', () => {
    const key = createBallotKey(context);
    const votes = [1, 0, 1].map((choice) => encryptBallotChoice(context, key.publicKey, choice));
    const aggregate = votes.reduce(
      (sum, vote) => addBallotCiphertexts(sum, vote.ciphertext),
      identity,
    );
    const proof = proveBallotTally(context, key.secret, aggregate, 3n, 2n);
    expect(verifyBallotTally(context, key.publicKey, aggregate, 3n, 2n, proof)).toBe(true);
    expect(verifyBallotTally(context, key.publicKey, aggregate, 3n, 1n, proof)).toBe(false);
    expect(verifyBallotTally(context, key.publicKey, aggregate, 4n, 2n, proof)).toBe(false);
    expect(verifyBallotTally(other, key.publicKey, aggregate, 3n, 2n, proof)).toBe(false);
    expect(() => proveBallotTally(context, key.secret, aggregate, 3n, 1n)).toThrow('BALLOT_TALLY');
  });

  it('counts the changed response and removal instead of historical ciphertexts', () => {
    const key = createBallotKey(context);
    const old = encryptBallotChoice(context, key.publicKey, 1);
    const unchanged = encryptBallotChoice(context, key.publicKey, 1);
    const replacement = encryptBallotChoice(context, key.publicKey, 0);
    const initial = addBallotCiphertexts(old.ciphertext, unchanged.ciphertext);
    const oldProof = proveBallotTally(context, key.secret, initial, 2n, 2n);
    const changed = addBallotCiphertexts(
      subtractBallotCiphertexts(initial, old.ciphertext),
      replacement.ciphertext,
    );
    expect(verifyBallotTally(context, key.publicKey, changed, 2n, 2n, oldProof)).toBe(false);
    const changedProof = proveBallotTally(context, key.secret, changed, 2n, 1n);
    expect(verifyBallotTally(context, key.publicKey, changed, 2n, 1n, changedProof)).toBe(true);
    const removed = subtractBallotCiphertexts(changed, replacement.ciphertext);
    const removalProof = proveBallotTally(context, key.secret, removed, 1n, 1n);
    expect(removed).toBe(unchanged.ciphertext);
    expect(verifyBallotTally(context, key.publicKey, removed, 1n, 1n, removalProof)).toBe(true);
  });

  it('rejects omission or duplication against a frozen aggregate proof', () => {
    const key = createBallotKey(context);
    const vote = encryptBallotChoice(context, key.publicKey, 1);
    const proof = proveBallotTally(context, key.secret, vote.ciphertext, 1n, 1n);
    expect(verifyBallotTally(context, key.publicKey, identity, 0n, 0n, proof)).toBe(false);
    expect(
      verifyBallotTally(
        context,
        key.publicKey,
        addBallotCiphertexts(vote.ciphertext, vote.ciphertext),
        2n,
        2n,
        proof,
      ),
    ).toBe(false);
  });

  it('handles empty and cancelled aggregates without accepting impossible counts', () => {
    const key = createBallotKey(context);
    const proof = proveBallotTally(context, key.secret, identity, 0n, 0n);
    expect(verifyBallotTally(context, key.publicKey, identity, 0n, 0n, proof)).toBe(true);
    expect(verifyBallotTally(context, key.publicKey, identity, 0n, 1n, proof)).toBe(false);
    expect(() => proveBallotTally(context, key.secret, identity, -1n, 0n)).toThrow('BALLOT_COUNT');
    expect(() => proveBallotTally(context, key.secret, identity, 1n << 64n, 0n)).toThrow(
      'BALLOT_COUNT',
    );
    const vote = encryptBallotChoice(context, key.publicKey, 0);
    expect(subtractBallotCiphertexts(vote.ciphertext, vote.ciphertext)).toBe(identity);
  });
});
