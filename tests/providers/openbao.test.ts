import { beforeAll, describe, expect, it } from 'vitest';
import { Checksum256 } from '@wharfkit/antelope';
import { OpenBaoCustody } from '../../services/custody/openbao.js';
const address = process.env.OPENBAO_URL;
const token = process.env.OPENBAO_TOKEN;
if (!address || !token)
  throw new Error(
    'OpenBao integration requires OPENBAO_URL and OPENBAO_TOKEN; this suite cannot silently skip',
  );
const provider = new OpenBaoCustody(address, token);
const signer = `test-${Date.now()}`;
const digest = Checksum256.hash(new TextEncoder().encode('Daclify provider characterization'));
beforeAll(async () => {
  const response = await fetch(`${address}/v1/sys/mounts/transit`, {
    method: 'POST',
    headers: { 'X-Vault-Token': token, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'transit' }),
  });
  if (!response.ok && response.status !== 400) throw new Error('Failed to enable Transit');
});
describe('real OpenBao R1 custody', () => {
  it('creates a nonexportable managed signer and recovers the public key from its Antelope signature', async () => {
    const publicKey = await provider.createSigner(signer);
    const signature = await provider.sign(signer, digest);
    expect(signature.recoverDigest(digest).equals(publicKey)).toBe(true);
    expect(signature.verifyDigest(digest, publicKey)).toBe(true);
    expect(publicKey.toString()).toMatch(/^PUB_R1_/);
  });
  it('rejects invalid provider key paths before network access', async () => {
    await expect(provider.createSigner('../admin')).rejects.toThrow('Invalid key name');
  });
  it('does not sign for an unknown signer', async () => {
    await expect(provider.sign('missing-signer', digest)).rejects.toThrow('CUSTODY_UNAVAILABLE');
  });
  it('round-trips independently wrapped content recovery data', async () => {
    const wrapped = await provider.wrap(
      'test-content',
      new TextEncoder().encode('disposable content key'),
    );
    expect(new TextDecoder().decode(await provider.unwrap('test-content', wrapped))).toBe(
      'disposable content key',
    );
  });
  it('rejects a tampered wrapped ciphertext', async () => {
    await expect(provider.unwrap('test-content', 'vault:v1:invalid')).rejects.toThrow(
      'CUSTODY_UNAVAILABLE',
    );
  });
});
