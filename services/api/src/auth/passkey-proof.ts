import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { z } from 'zod';

type Cbor = number | Uint8Array | string | boolean | null | Cbor[] | Map<Cbor, Cbor>;

const P256_PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d03010703420004', 'hex');

export interface PasskeyCredential {
  credentialId: Uint8Array;
  publicKey: Uint8Array;
  signCount: number;
}

function fail(): never {
  throw new Error('PASSKEY_INVALID');
}

function readArgument(bytes: Uint8Array, offset: number, info: number): [number, number] {
  if (info < 24) return [info, offset];
  if (info === 24) {
    const value = bytes[offset];
    if (value === undefined) fail();
    return [value, offset + 1];
  }
  if (info === 25) {
    const high = bytes[offset];
    const low = bytes[offset + 1];
    if (high === undefined || low === undefined) fail();
    return [high * 256 + low, offset + 2];
  }
  return fail();
}

function readCbor(bytes: Uint8Array, offset: number): [Cbor, number] {
  const initial = bytes[offset];
  if (initial === undefined) fail();
  const major = initial >> 5;
  const info = initial & 0x1f;
  if (major === 7 && info === 20) return [false, offset + 1];
  if (major === 7 && info === 21) return [true, offset + 1];
  if (major === 7 && info === 22) return [null, offset + 1];
  const [argument, cursor] = readArgument(bytes, offset + 1, info);
  if (major === 0) return [argument, cursor];
  if (major === 1) return [-1 - argument, cursor];
  if (major === 2 || major === 3) {
    const end = cursor + argument;
    if (end > bytes.length) fail();
    const slice = bytes.subarray(cursor, end);
    return [major === 2 ? Uint8Array.from(slice) : Buffer.from(slice).toString('utf8'), end];
  }
  if (major === 4) {
    const items: Cbor[] = [];
    let next = cursor;
    for (let index = 0; index < argument; index += 1) {
      const [item, itemEnd] = readCbor(bytes, next);
      items.push(item);
      next = itemEnd;
    }
    return [items, next];
  }
  if (major === 5) {
    const map = new Map<Cbor, Cbor>();
    let next = cursor;
    for (let index = 0; index < argument; index += 1) {
      const [key, keyEnd] = readCbor(bytes, next);
      const [value, valueEnd] = readCbor(bytes, keyEnd);
      map.set(key, value);
      next = valueEnd;
    }
    return [map, next];
  }
  return fail();
}

function decodeCbor(bytes: Uint8Array, exact: boolean): Cbor {
  if (bytes.length === 0 || bytes.length > 16384) fail();
  const [value, offset] = readCbor(bytes, 0);
  if (exact && offset !== bytes.length) fail();
  return value;
}

function asMap(value: Cbor): Map<Cbor, Cbor> {
  if (!(value instanceof Map)) fail();
  return value;
}

function mapField(value: Cbor, key: Cbor): Cbor {
  const map = asMap(value);
  if (!map.has(key)) fail();
  const found = map.get(key);
  if (found === undefined) fail();
  return found;
}

function bytesField(value: Cbor, key: Cbor, length?: number): Uint8Array {
  const found = mapField(value, key);
  if (!(found instanceof Uint8Array) || (length !== undefined && found.length !== length)) fail();
  return found;
}

function same(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function clientData(
  json: Uint8Array,
  expectedType: 'webauthn.create' | 'webauthn.get',
  origin: string,
  challenge: Uint8Array,
): void {
  if (json.length === 0 || json.length > 16384 || challenge.length < 16 || challenge.length > 64)
    fail();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(json).toString('utf8'));
  } catch {
    fail();
  }
  const claims = z
    .object({
      type: z.string(),
      challenge: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
      origin: z.string(),
      crossOrigin: z.boolean().optional(),
    })
    .parse(parsed);
  if (claims.type !== expectedType || claims.origin !== origin || claims.crossOrigin === true)
    fail();
  if (!same(Buffer.from(claims.challenge, 'base64url'), challenge)) fail();
}

function flags(data: Uint8Array, attested: boolean): number {
  if (data.length < 37) fail();
  const flag = data[32];
  if (flag === undefined || (flag & 0x01) === 0 || (flag & 0x04) === 0) fail();
  if (((flag & 0x40) !== 0) !== attested) fail();
  return Buffer.from(data.subarray(33, 37)).readUInt32BE(0);
}

function relyingParty(origin: string): string {
  const url = new URL(origin);
  if (url.username || url.password || (url.protocol !== 'https:' && url.protocol !== 'http:'))
    fail();
  return url.hostname;
}

function attestedCredential(data: Uint8Array, rpId: string): PasskeyCredential {
  const signCount = flags(data, true);
  const hash = createHash('sha256').update(rpId).digest();
  if (!same(data.subarray(0, 32), hash) || data.length < 55) fail();
  const idLength = Buffer.from(data.subarray(53, 55)).readUInt16BE(0);
  const idEnd = 55 + idLength;
  if (idLength < 1 || idLength > 1023 || idEnd > data.length) fail();
  const cose = decodeCbor(data.subarray(idEnd), false);
  if (mapField(cose, 1) !== 2 || mapField(cose, 3) !== -7 || mapField(cose, -1) !== 1) fail();
  const encoded = Buffer.concat([
    P256_PREFIX,
    Buffer.from(bytesField(cose, -2, 32)),
    Buffer.from(bytesField(cose, -3, 32)),
  ]);
  createPublicKey({ key: encoded, format: 'der', type: 'spki' });
  return {
    credentialId: Uint8Array.from(data.subarray(55, idEnd)),
    publicKey: encoded,
    signCount,
  };
}

export function verifyPasskeyRegistration(input: {
  origin: string;
  challenge: Uint8Array;
  clientDataJSON: Uint8Array;
  attestationObject: Uint8Array;
}): PasskeyCredential {
  try {
    if (input.attestationObject.length > 16384) fail();
    clientData(input.clientDataJSON, 'webauthn.create', input.origin, input.challenge);
    const attestation = decodeCbor(input.attestationObject, true);
    if (mapField(attestation, 'fmt') !== 'none') fail();
    if (asMap(mapField(attestation, 'attStmt')).size !== 0) fail();
    const authData = bytesField(attestation, 'authData');
    return attestedCredential(authData, relyingParty(input.origin));
  } catch (error) {
    if (error instanceof Error && error.message === 'PASSKEY_INVALID') throw error;
    fail();
  }
}

export function verifyPasskeyAssertion(input: {
  origin: string;
  challenge: Uint8Array;
  clientDataJSON: Uint8Array;
  authenticatorData: Uint8Array;
  signature: Uint8Array;
  publicKey: Uint8Array;
  storedSignCount: number;
}): { signCount: number } {
  try {
    if (input.signature.length < 8 || input.signature.length > 200) fail();
    if (
      !Number.isInteger(input.storedSignCount) ||
      input.storedSignCount < 0 ||
      input.storedSignCount > 0xffffffff
    )
      fail();
    clientData(input.clientDataJSON, 'webauthn.get', input.origin, input.challenge);
    const signCount = flags(input.authenticatorData, false);
    const hash = createHash('sha256').update(relyingParty(input.origin)).digest();
    if (!same(input.authenticatorData.subarray(0, 32), hash)) fail();
    if ((input.storedSignCount > 0 || signCount > 0) && signCount <= input.storedSignCount) fail();
    const signed = Buffer.concat([
      Buffer.from(input.authenticatorData),
      createHash('sha256').update(input.clientDataJSON).digest(),
    ]);
    const valid = verify(
      'sha256',
      signed,
      { key: Buffer.from(input.publicKey), format: 'der', type: 'spki' },
      Buffer.from(input.signature),
    );
    if (!valid) fail();
    return { signCount };
  } catch (error) {
    if (error instanceof Error && error.message === 'PASSKEY_INVALID') throw error;
    fail();
  }
}
