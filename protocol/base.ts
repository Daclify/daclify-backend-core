import { z } from 'zod';
import { CID } from 'multiformats/cid';
import { satisfies, valid, validRange } from 'semver';

export const VERSION = '0.1.0-alpha.1';
export const INTERFACE_VERSION = 1;
export const MAX_ASSET_UNITS = (1n << 62n) - 1n;
export const Uint64Schema = z
  .string()
  .max(20)
  .refine(
    (value) => /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) <= (1n << 64n) - 1n,
    'Invalid uint64',
  );
export const IdSchema = Uint64Schema.refine((value) => value !== '0', 'ID must be positive');
export const ChainIdSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const NativeAccountSchema = z
  .string()
  .regex(/^[a-z1-5][a-z1-5.]{0,12}$/)
  .refine(
    (value) => !value.endsWith('.') && (value.length < 13 || /^[a-j1-5]$/.test(value.slice(-1))),
    'Noncanonical account',
  );
export const DaoRefSchema = z.strictObject({
  chainId: ChainIdSchema,
  contract: NativeAccountSchema,
  daoId: IdSchema,
  interfaceVersion: z.literal(1),
});
export const AssetRefSchema = z.strictObject({
  chainId: ChainIdSchema,
  contract: NativeAccountSchema,
  symbol: z.string().regex(/^[A-Z]{1,7}$/),
  precision: z.int().min(0).max(18),
});
export const CustodySchema = z.enum(['user-controlled', 'managed']);
export const PrivacySchema = z.enum([
  'public',
  'encrypted-managed-allowed',
  'encrypted-user-controlled',
]);
export const CapabilitySchema = z.enum([
  'ballot.create',
  'ballot.finalize',
  'obligation.create',
  'obligation.execute',
  'member.manage',
  'credit.issue',
  'content.publish',
  'notification.send',
]);
export const ModuleManifestSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
  version: z.string().refine((value) => valid(value) !== null),
  coreRange: z.string().refine((value) => validRange(value) !== null && value !== '*'),
  interfaceVersion: z.literal(1),
  configVersion: z.int().min(1),
  capabilities: z
    .array(CapabilitySchema)
    .max(16)
    .refine((values) => new Set(values).size === values.length),
  helpTopic: z.string().regex(/^[a-z][a-z0-9.-]{1,63}$/),
});
export const MetadataSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    title: z.string().min(1).max(160),
    description: z.string().max(4000).default(''),
  })
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 4096,
    'Metadata exceeds 4096 bytes',
  );
export const CidSchema = z
  .string()
  .max(128)
  .refine((value) => {
    try {
      const cid = CID.parse(value);
      return (
        cid.version === 1 &&
        [0x55, 0x70, 0x71].includes(cid.code) &&
        cid.multihash.code === 0x12 &&
        cid.multihash.size === 32 &&
        cid.toString() === value
      );
    } catch {
      return false;
    }
  }, 'Invalid canonical CID');
export const DocumentSchema = z.strictObject({
  dao: DaoRefSchema,
  id: IdSchema,
  version: z.int().min(1),
  cid: CidSchema,
  commitment: ChainIdSchema,
  size: z.int().min(0).max(100_000_000),
  envelopeVersion: z.int().min(0).max(1),
});
export const ErrorSchema = z.strictObject({
  code: z.string().regex(/^[A-Z_]+$/),
  message: z.string(),
  requestId: z.string().optional(),
});
export type DaoRef = z.infer<typeof DaoRefSchema>;
export type AssetRef = z.infer<typeof AssetRefSchema>;
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;
export type Custody = z.infer<typeof CustodySchema>;
export type Privacy = z.infer<typeof PrivacySchema>;

function precisionScale(precision: number): bigint {
  if (!Number.isInteger(precision) || precision < 0 || precision > 18)
    throw new RangeError('Unsupported precision');
  return 10n ** BigInt(precision);
}
export function checkedAdd(left: bigint, right: bigint): bigint {
  const result = left + right;
  if (result < 0n || result > MAX_ASSET_UNITS)
    throw new RangeError('Amount outside native asset range');
  return result;
}
export function parseUnits(value: string, precision: number): bigint {
  const scale = precisionScale(precision);
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) throw new TypeError('Noncanonical amount');
  const [whole = '', fraction = ''] = value.split('.');
  if (fraction.length > precision) throw new RangeError('Amount exceeds precision');
  return checkedAdd(BigInt(whole) * scale, BigInt(fraction.padEnd(precision, '0') || '0'));
}
export function formatUnits(units: bigint, precision: number): string {
  const scale = precisionScale(precision);
  checkedAdd(units, 0n);
  return precision === 0
    ? units.toString()
    : `${units / scale}.${(units % scale).toString().padStart(precision, '0')}`;
}
export function compatible(version: string, range: string): boolean {
  return valid(version) !== null && validRange(range) !== null && satisfies(version, range);
}
