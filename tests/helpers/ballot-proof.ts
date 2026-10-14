// Experimental qualification only; not a published voting or cryptography API.
import { bls12_381 } from '@noble/curves/bls12-381.js';
import { sha256 } from '@noble/hashes/sha2.js';

const Point = bls12_381.G1.Point;
type G1 = ReturnType<typeof Point.fromAffine>;
const G = Point.BASE;
const Z = Point.ZERO;
const Q = Point.Fn.ORDER;
const P = bls12_381.fields.Fp.ORDER;
const MAX_COUNT = (1n << 64n) - 1n;

function bytes(hex: string, length: number): Uint8Array {
  if (hex.length !== length * 2 || !/^[0-9a-f]*$/.test(hex)) throw new Error('BALLOT_ENCODING');
  return Uint8Array.from({ length }, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

function hex(value: Uint8Array): string {
  return Array.from(value, (v) => v.toString(16).padStart(2, '0')).join('');
}

function integer(value: Uint8Array): bigint {
  return value.reduceRight((sum, byte) => (sum << 8n) | BigInt(byte), 0n);
}

function encoded(value: bigint, length: number): string {
  if (value < 0n || value >= 1n << BigInt(length * 8)) throw new Error('BALLOT_ENCODING');
  const result = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = Number(value & 255n);
    value >>= 8n;
  }
  return hex(result);
}

function scalar(value: string, nonzero = false): bigint {
  const n = integer(bytes(value, 32));
  if (n >= Q || (nonzero && n === 0n)) throw new Error('BALLOT_SCALAR');
  return n;
}

function randomScalar(nonzero = true): bigint {
  for (;;) {
    const n = integer(crypto.getRandomValues(new Uint8Array(32)));
    if (n < Q && (!nonzero || n !== 0n)) return n;
  }
}

function point(value: string, allowIdentity = true): G1 {
  const raw = bytes(value, 96);
  const x = integer(raw.subarray(0, 48));
  const y = integer(raw.subarray(48));
  if (x >= P || y >= P) throw new Error('BALLOT_POINT');
  if (x === 0n && y === 0n) {
    if (!allowIdentity) throw new Error('BALLOT_POINT');
    return Z;
  }
  const p = Point.fromAffine({ x, y });
  p.assertValidity();
  return p;
}

function pointHex(value: G1): string {
  if (value.is0()) return '00'.repeat(96);
  const { x, y } = value.toAffine();
  return encoded(x, 48) + encoded(y, 48);
}

function scale(point: G1, value: bigint): G1 {
  return value === 0n || point.is0() ? Z : point.multiply(value);
}

function cipher(value: string, response = false): { R: G1; S: G1 } {
  bytes(value, 192);
  return { R: point(value.slice(0, 192), !response), S: point(value.slice(192)) };
}

function mod(value: bigint): bigint {
  return ((value % Q) + Q) % Q;
}

function challenge(tag: string, context: string, ...values: string[]): bigint {
  const parts = [
    new TextEncoder().encode(tag + '\0'),
    bytes(context, 32),
    ...values.map((v) => bytes(v, v.length / 2)),
  ];
  const input = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    input.set(part, offset);
    offset += part.length;
  }
  return integer(sha256(input).reverse()) % Q;
}

function counts(count: bigint, up: bigint) {
  if (count < 0n || count > MAX_COUNT || up < 0n || up > count) throw new Error('BALLOT_COUNT');
}

export function createBallotKey(context: string): {
  secret: string;
  publicKey: string;
  proof: string;
} {
  bytes(context, 32);
  const x = randomScalar(),
    w = randomScalar();
  const publicKey = pointHex(scale(G, x));
  const c = challenge('daclify.quick-ballot.key.v1', context, publicKey, pointHex(scale(G, w)));
  return { secret: encoded(x, 32), publicKey, proof: encoded(c, 32) + encoded(mod(w + c * x), 32) };
}

export function verifyBallotKey(context: string, publicKey: string, proof: string): boolean {
  try {
    bytes(proof, 64);
    const Y = point(publicKey, false),
      c = scalar(proof.slice(0, 64)),
      z = scalar(proof.slice(64));
    const A = scale(G, z).subtract(scale(Y, c));
    if (A.is0()) return false;
    return c === challenge('daclify.quick-ballot.key.v1', context, publicKey, pointHex(A));
  } catch {
    return false;
  }
}

export function encryptBallotChoice(
  context: string,
  publicKey: string,
  choice: number,
): { ciphertext: string; proof: string } {
  if (choice !== 0 && choice !== 1) throw new Error('BALLOT_CHOICE');
  const Y = point(publicKey, false);
  const r = randomScalar(),
    w = randomScalar();
  const R = scale(G, r),
    S = scale(Y, r).add(choice ? G : Z);
  const realA = scale(G, w),
    realB = scale(Y, w);
  let cj: bigint, zj: bigint, simulatedA: G1, simulatedB: G1;
  do {
    cj = randomScalar(false);
    zj = randomScalar(false);
    simulatedA = scale(G, zj).subtract(scale(R, cj));
    simulatedB = scale(Y, zj).subtract(scale(choice === 0 ? S.subtract(G) : S, cj));
  } while (simulatedA.is0() || simulatedB.is0());
  const A0 = choice === 0 ? realA : simulatedA,
    B0 = choice === 0 ? realB : simulatedB;
  const A1 = choice === 1 ? realA : simulatedA,
    B1 = choice === 1 ? realB : simulatedB;
  const ciphertext = pointHex(R) + pointHex(S);
  const h = challenge(
    'daclify.quick-ballot.response.v1',
    context,
    publicKey,
    ciphertext,
    pointHex(A0),
    pointHex(B0),
    pointHex(A1),
    pointHex(B1),
  );
  const cr = mod(h - cj),
    zr = mod(w + cr * r);
  const proof = (choice === 0 ? [cr, zr, cj, zj] : [cj, zj, cr, zr])
    .map((n) => encoded(n, 32))
    .join('');
  return { ciphertext, proof };
}

export function verifyBallotChoice(
  context: string,
  publicKey: string,
  ciphertext: string,
  proof: string,
): boolean {
  try {
    bytes(proof, 128);
    const Y = point(publicKey, false),
      { R, S } = cipher(ciphertext, true);
    const c0 = scalar(proof.slice(0, 64)),
      z0 = scalar(proof.slice(64, 128));
    const c1 = scalar(proof.slice(128, 192)),
      z1 = scalar(proof.slice(192));
    const A0 = scale(G, z0).subtract(scale(R, c0)),
      B0 = scale(Y, z0).subtract(scale(S, c0));
    const A1 = scale(G, z1).subtract(scale(R, c1)),
      B1 = scale(Y, z1).subtract(scale(S.subtract(G), c1));
    if (A0.is0() || B0.is0() || A1.is0() || B1.is0()) return false;
    return (
      mod(c0 + c1) ===
      challenge(
        'daclify.quick-ballot.response.v1',
        context,
        publicKey,
        ciphertext,
        pointHex(A0),
        pointHex(B0),
        pointHex(A1),
        pointHex(B1),
      )
    );
  } catch {
    return false;
  }
}

export function addBallotCiphertexts(left: string, right: string): string {
  const a = cipher(left),
    b = cipher(right);
  return pointHex(a.R.add(b.R)) + pointHex(a.S.add(b.S));
}

export function subtractBallotCiphertexts(left: string, right: string): string {
  const a = cipher(left),
    b = cipher(right);
  return pointHex(a.R.subtract(b.R)) + pointHex(a.S.subtract(b.S));
}

export function decryptBallotChoice(secret: string, ciphertext: string): 0 | 1 {
  const { R, S } = cipher(ciphertext, true);
  const value = S.subtract(scale(R, scalar(secret, true)));
  if (value.is0()) return 0;
  if (value.equals(G)) return 1;
  throw new Error('BALLOT_CIPHERTEXT');
}

export function proveBallotTally(
  context: string,
  secret: string,
  ciphertext: string,
  count: bigint,
  up: bigint,
): string {
  counts(count, up);
  const x = scalar(secret, true),
    Y = scale(G, x),
    { R, S } = cipher(ciphertext);
  if (!S.subtract(scale(R, x)).equals(scale(G, up))) throw new Error('BALLOT_TALLY');
  const w = randomScalar();
  const c = challenge(
    'daclify.quick-ballot.tally.v1',
    context,
    pointHex(Y),
    ciphertext,
    encoded(count, 8),
    encoded(up, 8),
    pointHex(scale(G, w)),
    pointHex(scale(R, w)),
  );
  return encoded(c, 32) + encoded(mod(w + c * x), 32);
}

export function verifyBallotTally(
  context: string,
  publicKey: string,
  ciphertext: string,
  count: bigint,
  up: bigint,
  proof: string,
): boolean {
  try {
    counts(count, up);
    bytes(proof, 64);
    const Y = point(publicKey, false),
      { R, S } = cipher(ciphertext);
    const c = scalar(proof.slice(0, 64)),
      z = scalar(proof.slice(64));
    const D = S.subtract(scale(G, up));
    const A = scale(G, z).subtract(scale(Y, c)),
      B = scale(R, z).subtract(scale(D, c));
    if (A.is0()) return false;
    return (
      c ===
      challenge(
        'daclify.quick-ballot.tally.v1',
        context,
        publicKey,
        ciphertext,
        encoded(count, 8),
        encoded(up, 8),
        pointHex(A),
        pointHex(B),
      )
    );
  } catch {
    return false;
  }
}
