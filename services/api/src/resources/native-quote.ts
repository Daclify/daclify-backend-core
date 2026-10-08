import { APIClient, Name } from '@wharfkit/antelope';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { daoPaymentKey } from '../../../../protocol/payments.js';
import { Uint64Schema, MAX_ASSET_UNITS } from '../../../../protocol/base.js';
import {
  RamQuoteSchema,
  ramMarketCost,
  ramPurchasePrice,
  tlosAsset,
  type RamUsage,
  type RamQuoteRequest,
} from '../../../../protocol/resources.js';
import { ApiError } from '../errors.js';
export const TELOS_RAM_SYSTEM_CODE =
  '48d74c3df9f5c9952c0f87ab6c01e1c6dfe621429f59932ecf609b5d81e668e4';
export const TELOS_RAM_SYSTEM_ABI =
  'fccb1a515b98d2232a1227279666d9a3fcd41f67fafa0d75212cc0a282564361';
// Same downloaded ABI, re-encoded by cleos/WharfKit; qualified on the owned native fixture.
const REPACKED_SYSTEM_ABI = '324806b94fa561f9db4d8b5aeca0b70b4a98b39de64267c338af37102620aaa7';
const marketSchema = z.object({
  base: z.object({ balance: z.string().regex(/^[1-9][0-9]* RAM$/) }),
  quote: z.object({ balance: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{4} TLOS$/) }),
});
export async function nativeRamQuote(api: APIClient, input: RamQuoteRequest, usage: RamUsage) {
  if (daoPaymentKey(input.dao) !== daoPaymentKey(usage.dao)) throw new ApiError('DAO_REFERENCE');
  if (usage.observation !== 'active' || !usage.policy)
    throw new ApiError('RESOURCE_UNQUALIFIED', 503);
  if (input.payer === input.dao.contract) throw new ApiError('RAM_PAYER');
  const system = async () => {
    const raw = await api.v1.chain.get_raw_abi('eosio');
    if (
      String(raw.code_hash) !== TELOS_RAM_SYSTEM_CODE ||
      ![TELOS_RAM_SYSTEM_ABI, REPACKED_SYSTEM_ABI].includes(String(raw.abi_hash))
    )
      throw new ApiError('RAM_SYSTEM_UNQUALIFIED', 503);
    return String(raw.abi_hash);
  };
  const systemAbi = await system();
  const page = await api.v1.chain.get_table_rows({
    code: 'eosio',
    scope: 'eosio',
    table: 'rammarket',
    json: true,
    limit: 2,
  });
  const rows = z.array(marketSchema).length(1).parse(page.rows);
  if (page.more) throw new ApiError('RAM_SYSTEM_UNQUALIFIED', 503);
  const row = rows[0];
  if (!row) throw new ApiError('RAM_SYSTEM_UNQUALIFIED', 503);
  let ram = BigInt(row.base.balance.split(' ')[0] ?? ''),
    tokens = BigInt(row.quote.balance.replace('.', '').split(' ')[0] ?? '');
  const allocations = [...input.allocations].sort((a, b) => {
    const left = BigInt(Name.from(a.receiver).value.toString()),
      right = BigInt(Name.from(b.receiver).value.toString());
    return left < right ? -1 : left > right ? 1 : 0;
  });
  let base = 0n;
  const purchases = [];
  for (const allocation of allocations) {
    const payer = usage.payers.find((p) => p.payer === allocation.receiver);
    if (!payer?.sourceVerified || payer.globalQuotaBytes === null)
      throw new ApiError('RAM_RECEIVER_UNQUALIFIED', 503);
    const [resource, voters, account] = await Promise.all([
      api.v1.chain.get_table_rows({
        code: 'eosio',
        scope: allocation.receiver,
        table: 'userres',
        json: true,
        lower_bound: Name.from(allocation.receiver),
        upper_bound: Name.from(allocation.receiver),
        limit: 1,
      }),
      api.v1.chain.get_table_rows({
        code: 'eosio',
        scope: 'eosio',
        table: 'voters',
        json: true,
        lower_bound: Name.from(allocation.receiver),
        upper_bound: Name.from(allocation.receiver),
        limit: 1,
      }),
      api.v1.chain.get_account(allocation.receiver),
    ]);
    const resources = z
      .array(
        z.object({
          owner: z.literal(allocation.receiver),
          ram_bytes: z.union([
            Uint64Schema,
            z.int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(String),
          ]),
        }),
      )
      .length(1)
      .parse(resource.rows);
    const modes = z
      .array(z.object({ owner: z.literal(allocation.receiver), flags1: z.int().nonnegative() }))
      .max(1)
      .parse(voters.rows);
    if (
      (modes[0]?.flags1 ?? 0) & 1 ||
      !resources[0] ||
      BigInt(resources[0].ram_bytes) + 1400n !== BigInt(account.ram_quota.toString())
    )
      throw new ApiError('RAM_RESOURCE_MODE_UNSUPPORTED', 503);
    const bytes = BigInt(allocation.minimumBytes);
    let quantity: bigint;
    try {
      quantity = ramMarketCost(bytes, ram, tokens);
    } catch {
      throw new ApiError('RAM_PURCHASE_RANGE');
    }
    const net = quantity - (quantity + 199n) / 200n;
    const acquired = (net * ram) / (tokens + net);
    ram -= acquired;
    tokens += net;
    base += quantity;
    if (base > MAX_ASSET_UNITS) throw new ApiError('RAM_PURCHASE_RANGE');
    purchases.push({
      receiver: allocation.receiver,
      quantity: tlosAsset(quantity),
      minimum_bytes: allocation.minimumBytes,
    });
  }
  const price = ramPurchasePrice(base, 'tlos', usage.policy);
  if (price.total > MAX_ASSET_UNITS) throw new ApiError('RAM_PURCHASE_RANGE');
  if ((await system()) !== systemAbi) throw new ApiError('RAM_SYSTEM_UNQUALIFIED', 503);
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== input.dao.chainId) throw new ApiError('DAO_REFERENCE');
  const time = info.head_block_time.toMilliseconds();
  return RamQuoteSchema.parse({
    dao: input.dao,
    rail: 'tlos',
    baseUnits: base.toString(),
    feeUnits: price.fee.toString(),
    totalUnits: price.total.toString(),
    feeBps: usage.policy.nativeRamBps,
    order: {
      dao_id: input.dao.daoId,
      payer: input.payer,
      reference: randomBytes(32).toString('hex'),
      policy_revision: usage.policy.revision,
      maximum: tlosAsset(price.total),
      expires: Math.floor(time / 1000) + usage.policy.quoteLifetimeSeconds,
      purchases,
    },
    systemCodeHash: TELOS_RAM_SYSTEM_CODE,
    systemRawAbiHash: systemAbi,
    quotedAt: new Date(time).toISOString(),
  });
}
