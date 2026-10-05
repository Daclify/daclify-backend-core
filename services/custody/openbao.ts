import { type Checksum256, PublicKey, Signature } from '@wharfkit/antelope';
import { createPublicKey } from 'node:crypto';
import { z } from 'zod';
import { p256 } from '@noble/curves/nist.js';
const KeySchema = z.object({
  data: z.object({
    type: z.literal('ecdsa-p256'),
    exportable: z.literal(false),
    allow_plaintext_backup: z.literal(false),
    latest_version: z.literal(1),
    keys: z.record(z.string(), z.object({ public_key: z.string() })),
  }),
});
const SignatureSchema = z.object({ data: z.object({ signature: z.string().regex(/^vault:v1:/) }) });
const WrappedSchema = z.object({
  data: z.object({ ciphertext: z.string().regex(/^vault:v[1-9][0-9]*:/) }),
});
const PlainSchema = z.object({ data: z.object({ plaintext: z.string() }) });
const JwkSchema = z.object({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  x: z.string(),
  y: z.string(),
});
function keyName(name: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) throw new Error('Invalid key name');
  return name;
}
export function canonicalR1(compact: Uint8Array): Uint8Array {
  try {
    const signature = p256.Signature.fromBytes(compact, 'compact');
    return (
      signature.hasHighS()
        ? new p256.Signature(signature.r, p256.Point.CURVE().n - signature.s)
        : signature
    ).toBytes('compact');
  } catch {
    throw new Error('CUSTODY_UNAVAILABLE');
  }
}
export class OpenBaoCustody {
  constructor(
    readonly address: string,
    private readonly token: string,
  ) {
    const url = new URL(address);
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
    )
      throw new Error('Custody requires TLS outside local tests');
    if (!token) throw new Error('Custody token required');
  }
  private async request(path: string, data?: object): Promise<unknown> {
    try {
      const response = await fetch(`${this.address}/v1/transit/${path}`, {
        method: data ? 'POST' : 'GET',
        headers: { 'X-Vault-Token': this.token, 'content-type': 'application/json' },
        ...(data ? { body: JSON.stringify(data) } : {}),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Provider rejected request');
      return response.status === 204 ? undefined : await response.json();
    } catch {
      throw new Error('CUSTODY_UNAVAILABLE');
    }
  }
  private async publicKey(name: string): Promise<PublicKey> {
    const metadata = KeySchema.parse(await this.request(`keys/${keyName(name)}`));
    const pem = metadata.data.keys['1']?.public_key;
    if (!pem) throw new Error('CUSTODY_UNAVAILABLE');
    const jwk = JwkSchema.parse(createPublicKey(pem).export({ format: 'jwk' }));
    const x = Buffer.from(jwk.x, 'base64url');
    const y = Buffer.from(jwk.y, 'base64url');
    if (x.length !== 32 || y.length !== 32) throw new Error('CUSTODY_UNAVAILABLE');
    return PublicKey.from({
      type: 'R1',
      compressed: Uint8Array.from([2 + ((y[31] ?? 0) & 1), ...x]),
    });
  }
  async createSigner(name: string): Promise<PublicKey> {
    await this.request(`keys/${keyName(name)}`, {
      type: 'ecdsa-p256',
      derived: false,
      exportable: false,
      allow_plaintext_backup: false,
    });
    return this.publicKey(name);
  }
  async sign(name: string, digest: Checksum256): Promise<Signature> {
    keyName(name);
    const publicKey = await this.publicKey(name);
    const response = SignatureSchema.parse(
      await this.request(`sign/${name}/sha2-256`, {
        input: Buffer.from(digest.array).toString('base64'),
        prehashed: true,
        marshaling_algorithm: 'jws',
        key_version: 1,
      }),
    );
    const compact = canonicalR1(
      Buffer.from(response.data.signature.slice('vault:v1:'.length), 'base64url'),
    );
    if (compact.length !== 64) throw new Error('CUSTODY_UNAVAILABLE');
    for (let recid = 0; recid < 4; recid++) {
      const signature = Signature.from({
        type: 'R1',
        r: compact.subarray(0, 32),
        s: compact.subarray(32),
        recid,
      });
      try {
        if (signature.recoverDigest(digest).equals(publicKey)) return signature;
      } catch {
        /* Other recovery branches are not valid curve points. */
      }
    }
    throw new Error('CUSTODY_UNAVAILABLE');
  }
  async wrap(name: string, bytes: Uint8Array): Promise<string> {
    const key = `content-${keyName(name)}`;
    if (bytes.byteLength > 4096) throw new Error('Content key payload too large');
    await this.request(`keys/${key}`, {
      type: 'aes256-gcm96',
      exportable: false,
      allow_plaintext_backup: false,
    });
    return WrappedSchema.parse(
      await this.request(`encrypt/${key}`, { plaintext: Buffer.from(bytes).toString('base64') }),
    ).data.ciphertext;
  }
  async unwrap(name: string, ciphertext: string): Promise<Uint8Array> {
    const value = PlainSchema.parse(
      await this.request(`decrypt/content-${keyName(name)}`, { ciphertext }),
    );
    return Uint8Array.from(Buffer.from(value.data.plaintext, 'base64'));
  }
}
