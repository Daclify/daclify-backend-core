import { z } from 'zod';
import { CleanupNoticeSchema, type CleanupNotice } from '../protocol/account-exit.js';
import {
  AppBindingSchema,
  appBindingHash,
  type AppBinding,
} from '../protocol/mini-app-database.js';
import { ApiOriginSchema } from '../protocol/base.js';
const KeySchema = z.strictObject({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  y: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  kid: z.string().min(1).max(64),
  alg: z.literal('ES256'),
  use: z.literal('sig'),
});
export const VerifiedIssuerKeysSchema = z
  .strictObject({ keys: z.array(KeySchema).min(1).max(8) })
  .refine((v) => new Set(v.keys.map((k) => k.kid)).size === v.keys.length, 'Duplicate issuer key');
export type VerifiedIssuerKeys = z.infer<typeof VerifiedIssuerKeysSchema>;
const decode = (s: string) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
const json = (s: string): unknown =>
  JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(s)));
export async function verifyCleanupNotice(
  token: string,
  configuredIssuer: string,
  inputKeys: VerifiedIssuerKeys,
  expectedBinding: AppBinding,
): Promise<CleanupNotice> {
  const issuer = ApiOriginSchema.parse(configuredIssuer),
    binding = AppBindingSchema.parse(expectedBinding),
    keys = VerifiedIssuerKeysSchema.parse(inputKeys);
  if (binding.issuer !== issuer || token.length > 16384) throw Error('APP_CLEANUP_CONTEXT');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !p || !/^[A-Za-z0-9_-]+$/.test(p)))
    throw Error('APP_CLEANUP_TOKEN');
  const [headerText, payloadText, signatureText] = parts;
  if (!headerText || !payloadText || !signatureText) throw Error('APP_CLEANUP_TOKEN');
  const header = z
      .strictObject({
        alg: z.literal('ES256'),
        kid: z.string(),
        typ: z.literal('daclify-cleanup+jwt'),
      })
      .parse(json(headerText)),
    jwk = keys.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw Error('APP_CLEANUP_KEY');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const signature = decode(signatureText);
  if (
    signature.length !== 64 ||
    !(await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      signature,
      new TextEncoder().encode(headerText + '.' + payloadText),
    ))
  )
    throw Error('APP_CLEANUP_SIGNATURE');
  const payload = z
    .object({
      iss: z.literal(issuer),
      aud: z.literal('daclify.cleanup:' + binding.clientId),
      sub: z.uuid(),
      jti: z.uuid(),
      iat: z.int(),
      exp: z.int(),
    })
    .passthrough()
    .parse(json(payloadText));
  const now = Math.floor(Date.now() / 1000);
  if (
    payload.iat > now + 30 ||
    payload.exp <= now ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > 600
  )
    throw Error('APP_CLEANUP_EXPIRED');
  const {
      iss: _issuer,
      aud: _audience,
      sub: _subject,
      jti: _event,
      iat: _issued,
      exp: _expiry,
      ...body
    } = payload,
    notice = CleanupNoticeSchema.parse(body);
  if (
    appBindingHash(notice.binding) !== appBindingHash(binding) ||
    notice.subject !== payload.sub ||
    notice.eventId !== payload.jti ||
    Date.parse(notice.issuedAt) > Date.now() + 30000 ||
    Date.parse(notice.expiresAt) <= Date.now() ||
    Math.floor(Date.parse(notice.issuedAt) / 1000) !== payload.iat ||
    Math.floor(Date.parse(notice.expiresAt) / 1000) !== payload.exp
  )
    throw Error('APP_CLEANUP_CONTEXT');
  return notice;
}
