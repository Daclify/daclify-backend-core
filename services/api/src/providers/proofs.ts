import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../errors.js';
export interface ProviderPrincipal {
  provider: 'google' | 'telegram';
  subject: string;
  proofHash: Uint8Array;
  expires: Date;
}
export async function verifyGoogle(
  token: string,
  clientId: string,
  nonce: string,
  key: JWTVerifyGetKey | CryptoKey | Uint8Array,
): Promise<ProviderPrincipal> {
  try {
    if (!token || token.length > 16384 || !clientId || !nonce) throw new Error('Invalid proof');
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256'],
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
      requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'],
      clockTolerance: 30,
      maxTokenAge: '10m',
    });
    const claims = z
      .object({
        sub: z.string().regex(/^[\x21-\x7e]{1,255}$/),
        nonce: z.literal(nonce),
        exp: z.number().int(),
        iat: z.number().int(),
        azp: z.string().optional(),
        aud: z.union([z.string(), z.array(z.string())]),
      })
      .parse(payload);
    if (
      claims.iat > Math.floor(Date.now() / 1000) + 30 ||
      (claims.azp !== undefined && claims.azp !== clientId) ||
      (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId)
    )
      throw new Error('Invalid audience');
    return {
      provider: 'google',
      subject: claims.sub,
      proofHash: createHash('sha256').update(token).digest(),
      expires: new Date(claims.exp * 1000),
    };
  } catch {
    throw new ApiError('PROVIDER_INVALID', 401);
  }
}
export function verifyTelegram(
  initData: string,
  botToken: string,
  now = Math.floor(Date.now() / 1000),
): ProviderPrincipal {
  try {
    if (
      !initData ||
      initData.length > 16384 ||
      !Number.isSafeInteger(now) ||
      !/^\d+:[A-Za-z0-9_-]+$/.test(botToken)
    )
      throw new Error('Invalid proof');
    const fields = new URLSearchParams(initData);
    const pairs = Array.from(fields);
    if (pairs.length > 32) throw new Error('Invalid proof');
    const names = new Set<string>();
    for (const [key, value] of pairs) {
      if (names.has(key) || !/^[_a-z]+$/.test(key) || /[\r\n]/.test(value))
        throw new Error('Ambiguous data');
      names.add(key);
    }
    const hash = z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .parse(fields.get('hash'));
    const date = z
      .string()
      .regex(/^[1-9][0-9]{0,10}$/)
      .parse(fields.get('auth_date'));
    const issued = Number(date);
    if (!Number.isSafeInteger(issued) || issued > now + 30 || now - issued > 300)
      throw new Error('Invalid freshness');
    const check = pairs
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = createHmac('sha256', secret).update(check).digest();
    if (!timingSafeEqual(Buffer.from(hash, 'hex'), expected)) throw new Error('Invalid signature');
    const user = z
      .object({
        id: z
          .number()
          .int()
          .min(1)
          .max(2 ** 52 - 1),
      })
      .parse(JSON.parse(z.string().parse(fields.get('user'))));
    return {
      provider: 'telegram',
      subject: String(user.id),
      proofHash: createHash('sha256')
        .update(`${botToken.split(':')[0]}:${hash}`)
        .digest(),
      expires: new Date((issued + 300) * 1000),
    };
  } catch {
    throw new ApiError('PROVIDER_INVALID', 401);
  }
}
