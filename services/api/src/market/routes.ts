import type { FastifyInstance } from 'fastify';
import { PublicKey } from '@wharfkit/antelope';
import { z } from 'zod';
import type { ChainGateway } from '../chain.js';
import type { StripeBilling } from '../billing/service.js';
import { ApiError } from '../errors.js';
import {
  NamesInventoryQuerySchema,
  type NamesInventoryQuery,
} from '../../../../protocol/service-api.js';
import {
  MarketRuleError,
  TelosNameSchema,
  loadCatalogue,
  loadFees,
  loadMarketPolicy,
  loadNames,
  oracleTlos,
  type FeeSettings,
  type ListedModule,
  type NameListing,
  type NameQuote,
  type NameSuffix,
  type NameTier,
} from './read.js';

export interface MarketChain {
  marketplace(): Promise<{
    configured: boolean;
    reason: string | null;
    thirdPartyBps: number | null;
    firstPartyBps: number | null;
    treasury: string | null;
    modules: ListedModule[];
  }>;
  nameService(query?: NamesInventoryQuery): Promise<{
    contract: string | null;
    tokenContract: string | null;
    configured: boolean;
    reason: string | null;
    thirdPartyBps: number | null;
    firstPartyBps: number | null;
    treasury: string | null;
    tiers: Array<NameTier & { netStake: string; cpuStake: string; tlosQuote: string | null }>;
    listings: NameListing[];
    suffixes: NameSuffix[];
    listingsNext?: string | null;
    suffixesNext?: string | null;
    bumpBps: number | null;
    quotePremiumBps: number | null;
    oracleMedian: string | null;
    oraclePrecision: number | null;
    oracleObservedAt: number | null;
    daoId: string | null;
  }>;
  nameQuote(accountName: string): Promise<NameQuote>;
  fulfillName(purchase: {
    accountName: string;
    ownerKey: string;
    activeKey: string;
    usdCents: number;
    netUsdCents?: number;
    reference: string;
  }): Promise<void>;
}

const absentCatalogue = {
  configured: false,
  reason: 'The catalogue is not on this chain yet.',
  thirdPartyBps: null,
  firstPartyBps: null,
  treasury: null,
  modules: [],
};
const absentNames = {
  contract: null,
  tokenContract: null,
  configured: false,
  reason: 'The Telos nameservice is not on this chain yet.',
  thirdPartyBps: null,
  firstPartyBps: null,
  treasury: null,
  tiers: [],
  listings: [],
  suffixes: [],
  bumpBps: null,
  quotePremiumBps: null,
  oracleMedian: null,
  oraclePrecision: null,
  oracleObservedAt: null,
  daoId: null,
};

export function isMarketChain(value: object): value is MarketChain {
  return (
    'marketplace' in value &&
    typeof value.marketplace === 'function' &&
    'nameService' in value &&
    typeof value.nameService === 'function' &&
    'nameQuote' in value &&
    typeof value.nameQuote === 'function' &&
    'fulfillName' in value &&
    typeof value.fulfillName === 'function'
  );
}

const NameCheckoutSchema = z
  .strictObject({
    accountName: TelosNameSchema,
    ownerKey: z.string().min(1).max(128),
    activeKey: z.string().min(1).max(128),
  })
  .superRefine((value, context) => {
    for (const key of [value.ownerKey, value.activeKey]) {
      try {
        if (PublicKey.from(key).toString() !== key) {
          context.addIssue({ code: 'custom', message: 'NAME_KEY' });
        }
      } catch {
        context.addIssue({ code: 'custom', message: 'NAME_KEY' });
      }
    }
  });

export function registerMarketRoutes(
  app: FastifyInstance,
  chain: ChainGateway,
  billing: StripeBilling | undefined,
  session: (token: string | undefined, csrf?: string) => Promise<{ id: string }>,
  admitCheckout: (accountId: string, now: number) => boolean,
  cookieName: string,
): void {
  const market = isMarketChain(chain) ? chain : undefined;
  app.get('/v1/marketplace', async () => market?.marketplace() ?? absentCatalogue);
  app.get('/v1/names', async (request) => ({
    ...(market
      ? await market.nameService(NamesInventoryQuerySchema.parse(request.query))
      : absentNames),
    cardPayments: Boolean(billing),
  }));
  app.get<{ Querystring: { name?: string } }>('/v1/names/quote', async (request) => {
    if (!market) throw new ApiError('NAMES_UNCONFIGURED', 503);
    const accountName = TelosNameSchema.parse(request.query.name);
    try {
      return await market.nameQuote(accountName);
    } catch (error) {
      if (error instanceof MarketRuleError) throw new ApiError(error.code, 409);
      throw error;
    }
  });
  app.post('/v1/names/checkout', async (request) => {
    if (!market) throw new ApiError('NAMES_UNCONFIGURED', 503);
    if (!billing) throw new ApiError('STRIPE_NOT_CONFIGURED', 503);
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (!admitCheckout(account.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    const input = NameCheckoutSchema.parse(request.body);
    let quote: NameQuote;
    try {
      quote = await market.nameQuote(input.accountName);
    } catch (error) {
      if (error instanceof MarketRuleError) throw new ApiError(error.code, 409);
      throw error;
    }
    if (quote.party !== 'first-party') throw new ApiError('NAME_CARD_SELLER_UNSUPPORTED', 409);
    if (quote.kind !== 'basic') throw new ApiError('NAME_CARD_PREMIUM_UNSUPPORTED', 409);
    if (quote.usdCents < 1) throw new ApiError('CARD_UNAVAILABLE', 409);
    return billing.startNameCheckout({
      accountId: account.id,
      accountName: input.accountName,
      ownerKey: input.ownerKey,
      activeKey: input.activeKey,
      usdCents: quote.usdCents,
    });
  });
}

export function marketplaceView(fees: FeeSettings | undefined, modules: ListedModule[]) {
  if (!fees || !fees.treasury) return absentCatalogue;
  return {
    configured: true,
    reason: null,
    thirdPartyBps: fees.thirdPartyBps,
    firstPartyBps: fees.firstPartyBps,
    treasury: fees.treasury,
    modules,
  };
}

export async function readMarketplace(rpcUrl: string, runtime: string) {
  const fees = await loadFees(rpcUrl, runtime);
  if (!fees) return marketplaceView(undefined, []);
  return marketplaceView(fees, await loadCatalogue(rpcUrl, runtime));
}

export async function readNameService(
  rpcUrl: string,
  runtime: string,
  query: NamesInventoryQuery & { accountName?: string } = {},
) {
  const fees = await loadFees(rpcUrl, runtime);
  if (!fees?.names) return absentNames;
  const [names, governance] = await Promise.all([
    loadNames(rpcUrl, fees.names, query),
    loadMarketPolicy(rpcUrl, runtime),
  ]);
  if (!names) return absentNames;
  if (!names.treasury) {
    return {
      ...absentNames,
      reason: 'Nameservice fees are not set on this chain yet.',
    };
  }
  const median = names.policy && names.policy.median > 0n ? names.policy.median.toString() : null;
  return {
    configured: true,
    reason: null,
    thirdPartyBps: names.thirdPartyBps,
    contract: fees.names,
    tokenContract: names.tokenContract ?? null,
    firstPartyBps: names.firstPartyBps,
    treasury: names.treasury,
    tiers: names.tiers.map((tier) => ({
      kind: tier.kind,
      price: tier.price,
      usdCents: tier.usdCents,
      ramBytes: tier.ramBytes,
      netStake: tier.netStake ?? '0.0000 TLOS',
      cpuStake: tier.cpuStake ?? '0.0000 TLOS',
      tlosQuote:
        tier.kind === 'basic' ? (tier.tlosQuote ?? oracleTlos(tier.usdCents, names.policy)) : null,
    })),
    listings: names.listings,
    suffixes: names.suffixes,
    listingsNext: names.listingsNext ?? null,
    suffixesNext: names.suffixesNext ?? null,
    bumpBps: names.policy?.bumpBps ?? 2000,
    quotePremiumBps: names.policy?.quotePremiumBps ?? 2000,
    oracleMedian: median,
    oraclePrecision: median ? (names.policy?.quotedPrecision ?? null) : null,
    oracleObservedAt: median ? (names.policy?.observedAt ?? null) : null,
    daoId: governance.daoId,
  };
}
