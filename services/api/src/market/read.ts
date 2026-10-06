import { z } from 'zod';
import { NativeAccountSchema } from '../../../../protocol/base.js';
import { ApiError } from '../errors.js';
import {
  USD_PRECISION,
  TLOS_PRECISION,
  formatTlosMinor,
  requiredTlosMinor,
} from '../service-price.js';

export const TelosNameSchema = NativeAccountSchema.refine(
  (value) => value.length <= 12 && !value.includes('..'),
  'NAME',
);

const AssetString = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)? [A-Z]{1,7}$/);
const AccountName = z.string().max(13);
const Uint32Value = z.preprocess(
  (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
  z.number().int().min(0).max(4294967295),
);
const BpsValue = z.preprocess(
  (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
  z.number().int().min(0).max(10000),
);
const FlagValue = z.union([z.literal(0), z.literal(1)]);
const WholeValue = z.union([
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^(0|[1-9][0-9]*)$/),
]);
const PrecisionValue = z.preprocess(
  (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
  z.number().int().min(0).max(18),
);

const FeeRow = z.strictObject({
  third_party_bps: BpsValue,
  first_party_bps: BpsValue,
  treasury: AccountName,
  token_contract: AccountName,
  token_symbol: z.string().regex(/^(0|[1-9][0-9]?),[A-Z]{1,7}$/),
  names: AccountName,
});
const CatalogueRow = z.strictObject({
  account: NativeAccountSchema,
  publisher: NativeAccountSchema,
  party: FlagValue,
  complies: FlagValue,
  price: AssetString,
  code_hash: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().min(1).max(64),
});
const NamesConfigRow = z.strictObject({
  runtime: AccountName,
  settler: AccountName,
  treasury: AccountName,
  third_party_bps: BpsValue,
  first_party_bps: BpsValue,
  token_contract: AccountName,
  token_symbol: z.string().regex(/^(0|[1-9][0-9]?),[A-Z]{1,7}$/),
});
const TierRow = z.strictObject({
  kind: FlagValue,
  price: AssetString,
  usd_cents: Uint32Value,
  ram_bytes: Uint32Value,
  net_stake: AssetString,
  cpu_stake: AssetString,
});
const ListingRow = z.strictObject({
  account_name: NativeAccountSchema,
  seller: NativeAccountSchema,
  price: AssetString,
  usd_cents: Uint32Value,
  accepts: FlagValue,
  sold: FlagValue,
});
const CopyRow = z.strictObject({
  account: NativeAccountSchema,
  summary: z.string().min(1).max(160),
  detail: z.string().max(2000),
});
const PolicyRow = z.strictObject({
  bump_bps: BpsValue,
  quote_premium_bps: BpsValue,
  median: WholeValue,
  quoted_precision: PrecisionValue,
  observed_at: Uint32Value,
});
const MarketPolicyRow = z.strictObject({
  bump_bps: BpsValue,
  quote_premium_bps: BpsValue,
  dao_id: WholeValue,
});
const SuffixRow = z.strictObject({
  suffix: NativeAccountSchema,
  seller: NativeAccountSchema,
  price: AssetString,
  usd_cents: Uint32Value,
  accepts: FlagValue,
  sales_count: Uint32Value,
});

export interface FeeSettings {
  thirdPartyBps: number;
  firstPartyBps: number;
  treasury: string;
  tokenContract: string;
  tokenSymbol: string;
  names: string;
}
export interface ListedModule {
  account: string;
  publisher: string;
  party: 'first-party' | 'third-party';
  price: string;
  title: string;
  codeHash: string;
  summary: string;
  detail: string;
}
export interface NameTier {
  kind: 'basic' | 'premium';
  price: string;
  usdCents: number;
  ramBytes: number;
  netStake?: string;
  cpuStake?: string;
}
export interface NameListing {
  accountName: string;
  seller: string;
  price: string;
  usdCents: number;
  sold: boolean;
}
export interface NameSuffix {
  suffix: string;
  seller: string;
  price: string;
  usdCents: number;
  sales: number;
}
export interface NamePolicy {
  bumpBps: number;
  quotePremiumBps: number;
  median: bigint;
  quotedPrecision: number;
  observedAt: number;
}
export interface NameQuote {
  accountName: string;
  kind: 'basic' | 'premium';
  listed: boolean;
  seller: string;
  party: 'first-party' | 'third-party';
  price: string;
  usdCents: number;
  platformBps: number;
  suffix: string | null;
  bumpBps: number;
  quotePremiumBps: number;
  ramBytes: number;
  netStake: string;
  cpuStake: string;
  priceFromOracle: boolean;
  sales: number;
  nextPrice: string | null;
  nextUsdCents: number | null;
}

export class MarketRuleError extends Error {
  constructor(readonly code: 'TIER_UNSET' | 'NAME_SOLD' | 'FEE_RULE' | 'FEE_UNSET' | 'SUFFIX') {
    super(code);
    this.name = 'MarketRuleError';
  }
}

export function classifyTelosName(accountName: string): 'basic' | 'premium' {
  return accountName.length === 12 && !accountName.includes('.') ? 'basic' : 'premium';
}

const AssetParts = /^(0|[1-9][0-9]*)(?:\.([0-9]+))? ([A-Z]{1,7})$/;

function whole(value: number | string): bigint {
  return BigInt(value);
}

export function parseAsset(price: string): { minor: bigint; precision: number; symbol: string } {
  const match = AssetParts.exec(price);
  const units = match?.[1];
  const symbol = match?.[3];
  if (!match || units === undefined || symbol === undefined) throw new Error('PRICE');
  const fraction = match[2] ?? '';
  return { minor: BigInt(units + fraction), precision: fraction.length, symbol };
}

export function formatAsset(minor: bigint, precision: number, symbol: string): string {
  if (precision === 0) return `${minor.toString()} ${symbol}`;
  const scale = 10n ** BigInt(precision);
  const fraction = (minor % scale).toString().padStart(precision, '0');
  return `${(minor / scale).toString()}.${fraction} ${symbol}`;
}

export function raisedMinor(amount: bigint, bumpBps: number): bigint {
  if (amount <= 0n || bumpBps <= 0) return amount;
  return (amount * BigInt(10_000 + bumpBps) + 9999n) / 10_000n;
}

export function matchingSuffix(
  accountName: string,
  suffixes: readonly NameSuffix[],
): NameSuffix | undefined {
  let best: NameSuffix | undefined;
  for (let index = 0; index < accountName.length; index += 1) {
    if (accountName[index] !== '.') continue;
    const tail = accountName.slice(index + 1);
    const found = suffixes.find((item) => item.suffix === tail);
    if (found && (!best || tail.length > best.suffix.length)) best = found;
  }
  return best;
}

export function oracleTlos(usdCents: number, policy: NamePolicy | undefined): string | null {
  if (!policy || policy.median <= 0n || usdCents <= 0) return null;
  return formatTlosMinor(
    requiredTlosMinor({
      fiatMinor: BigInt(usdCents),
      fiatPrecision: USD_PRECISION,
      median: policy.median,
      quotedPrecision: policy.quotedPrecision,
      tlosPrecision: TLOS_PRECISION,
      premiumBps: policy.quotePremiumBps,
    }),
  );
}

export function quoteName(input: {
  accountName: string;
  tiers: readonly NameTier[];
  listings: readonly NameListing[];
  suffixes?: readonly NameSuffix[];
  policy?: NamePolicy;
  treasury: string;
  thirdPartyBps: number;
  firstPartyBps: number;
}): NameQuote {
  if (!input.treasury) throw new MarketRuleError('FEE_UNSET');
  const kind = classifyTelosName(input.accountName);
  const tier = input.tiers.find((item) => item.kind === kind);
  if (!tier) throw new MarketRuleError('TIER_UNSET');
  const bumpBps = input.policy?.bumpBps ?? 2000;
  const quotePremiumBps = input.policy?.quotePremiumBps ?? 2000;
  const resources = {
    ramBytes: tier.ramBytes,
    netStake: tier.netStake ?? '0.0000 TLOS',
    cpuStake: tier.cpuStake ?? '0.0000 TLOS',
  };
  const base = {
    accountName: input.accountName,
    kind,
    bumpBps,
    quotePremiumBps,
    ...resources,
    sales: 0,
    nextPrice: null,
    nextUsdCents: null,
  };
  const listing = input.listings.find((item) => item.accountName === input.accountName);
  if (listing?.sold) throw new MarketRuleError('NAME_SOLD');
  if (listing) {
    return {
      ...base,
      listed: true,
      seller: listing.seller,
      party: 'third-party',
      price: listing.price,
      usdCents: listing.usdCents,
      platformBps: input.thirdPartyBps,
      suffix: null,
      priceFromOracle: false,
    };
  }
  const suffix = matchingSuffix(input.accountName, input.suffixes ?? []);
  if (suffix) {
    const stored = parseAsset(suffix.price);
    const converted = stored.minor === 0n ? oracleTlos(suffix.usdCents, input.policy) : null;
    const nextUsd =
      suffix.usdCents > 0 ? Number(raisedMinor(BigInt(suffix.usdCents), bumpBps)) : null;
    const nextStored =
      stored.minor > 0n
        ? formatAsset(raisedMinor(stored.minor, bumpBps), stored.precision, stored.symbol)
        : null;
    return {
      ...base,
      listed: false,
      seller: suffix.seller,
      party: 'third-party',
      price: converted ?? suffix.price,
      usdCents: suffix.usdCents,
      platformBps: input.thirdPartyBps,
      suffix: suffix.suffix,
      priceFromOracle: converted !== null,
      sales: suffix.sales,
      nextPrice: nextStored ?? (nextUsd === null ? null : oracleTlos(nextUsd, input.policy)),
      nextUsdCents: nextUsd,
    };
  }
  if (input.accountName.includes('.')) throw new MarketRuleError('SUFFIX');
  const converted = kind === 'basic' ? oracleTlos(tier.usdCents, input.policy) : null;
  return {
    ...base,
    listed: false,
    seller: input.treasury,
    party: 'first-party',
    price: converted ?? tier.price,
    usdCents: tier.usdCents,
    platformBps: input.firstPartyBps,
    suffix: null,
    priceFromOracle: converted !== null,
  };
}

interface RowResult {
  status: 'rows' | 'missing';
  rows: unknown[];
}

export async function readChainRows(input: {
  rpcUrl: string;
  code: string;
  scope: string;
  table: string;
  limit?: number;
  indexPosition?: number;
  keyType?: string;
  lowerBound?: string;
  upperBound?: string;
}): Promise<RowResult> {
  let response: Response;
  try {
    response = await fetch(`${input.rpcUrl}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: input.code,
        scope: input.scope,
        table: input.table,
        json: true,
        limit: input.limit ?? 100,
        ...(input.indexPosition
          ? { index_position: input.indexPosition, key_type: input.keyType }
          : {}),
        ...(input.lowerBound ? { lower_bound: input.lowerBound } : {}),
        ...(input.upperBound ? { upper_bound: input.upperBound } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError('CHAIN_UNAVAILABLE', 503);
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (tableUnavailable(body, input.table)) return { status: 'missing', rows: [] };
    throw new ApiError('CHAIN_UNAVAILABLE', 503);
  }
  const parsed = z
    .object({ rows: z.array(z.unknown()), more: z.boolean().optional() })
    .safeParse(body);
  if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  if (parsed.data.more) throw new ApiError('RESULT_LIMIT', 413);
  return { status: 'rows', rows: parsed.data.rows };
}

function tableUnavailable(body: unknown, table: string): boolean {
  const text = JSON.stringify(body ?? '');
  return (
    text.includes(`Table ${table} is not specified in the ABI`) ||
    text.includes('No ABI found') ||
    text.includes('Unknown account') ||
    text.includes('Account not found')
  );
}

export async function loadFees(rpcUrl: string, runtime: string): Promise<FeeSettings | undefined> {
  const table = await readChainRows({
    rpcUrl,
    code: runtime,
    scope: runtime,
    table: 'feecfg',
    limit: 1,
  });
  if (table.status === 'missing' || table.rows.length === 0) return undefined;
  const row = FeeRow.safeParse(table.rows[0]);
  if (!row.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  return {
    thirdPartyBps: row.data.third_party_bps,
    firstPartyBps: row.data.first_party_bps,
    treasury: row.data.treasury,
    tokenContract: row.data.token_contract,
    tokenSymbol: row.data.token_symbol,
    names: row.data.names,
  };
}

export async function loadCatalogue(rpcUrl: string, runtime: string): Promise<ListedModule[]> {
  const [table, copy] = await Promise.all([
    readChainRows({ rpcUrl, code: runtime, scope: runtime, table: 'catalogue', limit: 100 }),
    readChainRows({ rpcUrl, code: runtime, scope: runtime, table: 'modcopy', limit: 100 }),
  ]);
  if (table.status === 'missing') return [];
  const text = new Map<string, { summary: string; detail: string }>();
  if (copy.status === 'rows') {
    for (const entry of copy.rows) {
      const row = CopyRow.safeParse(entry);
      if (!row.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
      text.set(row.data.account, { summary: row.data.summary, detail: row.data.detail });
    }
  }
  return table.rows.flatMap((entry) => {
    const row = CatalogueRow.safeParse(entry);
    if (!row.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    if (row.data.complies !== 1) return [];
    const description = text.get(row.data.account);
    return [
      {
        account: row.data.account,
        publisher: row.data.publisher,
        party: row.data.party === 0 ? ('first-party' as const) : ('third-party' as const),
        price: row.data.price,
        title: row.data.title,
        codeHash: row.data.code_hash,
        summary: description?.summary ?? '',
        detail: description?.detail ?? '',
      },
    ];
  });
}

export interface NamesChainState {
  thirdPartyBps: number;
  firstPartyBps: number;
  treasury: string;
  tiers: NameTier[];
  listings: NameListing[];
  suffixes: NameSuffix[];
  policy?: NamePolicy;
}

export async function loadNames(
  rpcUrl: string,
  names: string,
): Promise<NamesChainState | undefined> {
  const config = await readChainRows({
    rpcUrl,
    code: names,
    scope: names,
    table: 'namescfg',
    limit: 1,
  });
  if (config.status === 'missing' || config.rows.length === 0) return undefined;
  const saved = NamesConfigRow.safeParse(config.rows[0]);
  if (!saved.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  const [tiers, listings, policy, suffixes] = await Promise.all([
    readChainRows({ rpcUrl, code: names, scope: names, table: 'tiers', limit: 10 }),
    readChainRows({ rpcUrl, code: names, scope: names, table: 'namelist', limit: 100 }),
    readChainRows({ rpcUrl, code: names, scope: names, table: 'policy', limit: 1 }),
    readChainRows({ rpcUrl, code: names, scope: names, table: 'suffixes', limit: 100 }),
  ]);
  if (tiers.status === 'missing' || listings.status === 'missing') return undefined;
  const policyRow =
    policy.status === 'rows' && policy.rows[0] ? PolicyRow.safeParse(policy.rows[0]) : undefined;
  if (policyRow && !policyRow.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  const savedPolicy = policyRow?.success
    ? {
        bumpBps: policyRow.data.bump_bps,
        quotePremiumBps: policyRow.data.quote_premium_bps,
        median: whole(policyRow.data.median),
        quotedPrecision: policyRow.data.quoted_precision,
        observedAt: policyRow.data.observed_at,
      }
    : undefined;
  return {
    thirdPartyBps: saved.data.third_party_bps,
    firstPartyBps: saved.data.first_party_bps,
    treasury: saved.data.treasury,
    ...(savedPolicy ? { policy: savedPolicy } : {}),
    tiers: tiers.rows.map((entry) => {
      const row = TierRow.safeParse(entry);
      if (!row.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
      return {
        kind: row.data.kind === 0 ? ('basic' as const) : ('premium' as const),
        price: row.data.price,
        usdCents: row.data.usd_cents,
        ramBytes: row.data.ram_bytes,
        netStake: row.data.net_stake,
        cpuStake: row.data.cpu_stake,
      };
    }),
    listings: listings.rows.flatMap((entry) => {
      const row = ListingRow.safeParse(entry);
      if (!row.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
      if (row.data.accepts !== 1) return [];
      return [
        {
          accountName: row.data.account_name,
          seller: row.data.seller,
          price: row.data.price,
          usdCents: row.data.usd_cents,
          sold: row.data.sold === 1,
        },
      ];
    }),
    suffixes:
      suffixes.status === 'missing'
        ? []
        : suffixes.rows.flatMap((entry) => {
            const row = SuffixRow.safeParse(entry);
            if (!row.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
            if (row.data.accepts !== 1) return [];
            return [
              {
                suffix: row.data.suffix,
                seller: row.data.seller,
                price: row.data.price,
                usdCents: row.data.usd_cents,
                sales: row.data.sales_count,
              },
            ];
          }),
  };
}

export async function loadMarketPolicy(
  rpcUrl: string,
  runtime: string,
): Promise<{ daoId: string | null }> {
  const table = await readChainRows({
    rpcUrl,
    code: runtime,
    scope: runtime,
    table: 'mktcfg',
    limit: 1,
  });
  if (table.status === 'missing' || table.rows.length === 0) return { daoId: null };
  const row = MarketPolicyRow.safeParse(table.rows[0]);
  if (!row.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  const daoId = whole(row.data.dao_id);
  return { daoId: daoId === 0n ? null : daoId.toString() };
}
