import { createHash, createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  verifyPasskeyAssertion,
  verifyPasskeyRegistration,
} from '../services/api/src/auth/passkey-proof.js';

const origin = 'http://127.0.0.1:5178';
const rpId = '127.0.0.1';
const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = keys.publicKey.export({ format: 'jwk' });
const x = Buffer.from(String(jwk.x), 'base64url');
const y = Buffer.from(String(jwk.y), 'base64url');
const credentialId = randomBytes(16);

function cborText(value: string): Buffer {
  return Buffer.concat([Buffer.from([0x60 + value.length]), Buffer.from(value)]);
}
function cborBytes(value: Buffer): Buffer {
  if (value.length < 24) return Buffer.concat([Buffer.from([0x40 + value.length]), value]);
  if (value.length < 256) return Buffer.concat([Buffer.from([0x58, value.length]), value]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(value.length);
  return Buffer.concat([Buffer.from([0x59]), length, value]);
}
function cborInt(value: number): Buffer {
  if (value >= 0 && value < 24) return Buffer.from([value]);
  const argument = value < 0 ? -1 - value : value;
  const major = value < 0 ? 0x20 : 0x00;
  if (argument < 24) return Buffer.from([major + argument]);
  return Buffer.from([major + 24, argument]);
}
function coseKey(): Buffer {
  const pairs = [
    [cborInt(1), cborInt(2)],
    [cborInt(3), cborInt(-7)],
    [cborInt(-1), cborInt(1)],
    [cborInt(-2), cborBytes(x)],
    [cborInt(-3), cborBytes(y)],
  ];
  return Buffer.concat([Buffer.from([0xa0 + pairs.length]), ...pairs.flat()]);
}
function authData(signCount: number, attested: boolean): Buffer {
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(signCount);
  const head = Buffer.concat([
    createHash('sha256').update(rpId).digest(),
    Buffer.from([attested ? 0x45 : 0x05]),
    counter,
  ]);
  if (!attested) return head;
  const idLength = Buffer.alloc(2);
  idLength.writeUInt16BE(credentialId.length);
  return Buffer.concat([head, Buffer.alloc(16), idLength, credentialId, coseKey()]);
}
function attestation(signCount: number): Buffer {
  const data = cborBytes(authData(signCount, true));
  return Buffer.concat([
    Buffer.from([0xa3]),
    cborText('fmt'),
    cborText('none'),
    cborText('attStmt'),
    Buffer.from([0xa0]),
    cborText('authData'),
    data,
  ]);
}
function clientData(type: 'webauthn.create' | 'webauthn.get', challenge: Buffer, site = origin) {
  return Buffer.from(
    JSON.stringify({
      type,
      challenge: challenge.toString('base64url'),
      origin: site,
      crossOrigin: false,
    }),
  );
}
function sign(data: Buffer): Buffer {
  return createSign('SHA256').update(data).sign(keys.privateKey);
}
function signed(authenticatorData: Buffer, json: Buffer): Buffer {
  return sign(Buffer.concat([authenticatorData, createHash('sha256').update(json).digest()]));
}

describe('passkey registration', () => {
  it('keeps the credential public key and ignores the vault signing key', () => {
    const challenge = randomBytes(32);
    const registered = verifyPasskeyRegistration({
      origin,
      challenge,
      clientDataJSON: clientData('webauthn.create', challenge),
      attestationObject: attestation(0),
    });
    expect(Buffer.from(registered.credentialId)).toEqual(credentialId);
    expect(registered.signCount).toBe(0);
    expect(Buffer.from(registered.publicKey).toString('hex')).not.toContain('PVT_');
    const json = clientData('webauthn.get', challenge);
    const authenticatorData = authData(1, false);
    expect(
      verifyPasskeyAssertion({
        origin,
        challenge,
        clientDataJSON: json,
        authenticatorData,
        signature: signed(authenticatorData, json),
        publicKey: registered.publicKey,
        storedSignCount: 0,
      }).signCount,
    ).toBe(1);
  });
  it('rejects a different origin, a missing user check, and a cloned counter', () => {
    const challenge = randomBytes(32);
    const registered = verifyPasskeyRegistration({
      origin,
      challenge,
      clientDataJSON: clientData('webauthn.create', challenge),
      attestationObject: attestation(0),
    });
    const json = clientData('webauthn.get', challenge, 'http://evil.example');
    const authenticatorData = authData(2, false);
    expect(() =>
      verifyPasskeyAssertion({
        origin,
        challenge,
        clientDataJSON: json,
        authenticatorData,
        signature: signed(authenticatorData, json),
        publicKey: registered.publicKey,
        storedSignCount: 1,
      }),
    ).toThrow('PASSKEY_INVALID');
    const unverified = Buffer.concat([
      authenticatorData.subarray(0, 32),
      Buffer.from([0x01]),
      authenticatorData.subarray(33),
    ]);
    const sameSite = clientData('webauthn.get', challenge);
    expect(() =>
      verifyPasskeyAssertion({
        origin,
        challenge,
        clientDataJSON: sameSite,
        authenticatorData: unverified,
        signature: signed(unverified, sameSite),
        publicKey: registered.publicKey,
        storedSignCount: 1,
      }),
    ).toThrow('PASSKEY_INVALID');
    expect(() =>
      verifyPasskeyAssertion({
        origin,
        challenge,
        clientDataJSON: sameSite,
        authenticatorData,
        signature: signed(authenticatorData, sameSite),
        publicKey: registered.publicKey,
        storedSignCount: 2,
      }),
    ).toThrow('PASSKEY_INVALID');
  });
});
