import { IdSchema } from '../../../../protocol/base.js';
import {
  RamUsageSchema,
  RamQuoteRequestSchema,
  RamQuoteSchema,
} from '../../../../protocol/resources.js';
import { daoPaymentKey } from '../../../../protocol/payments.js';
import type { Account } from '../../../../protocol/api.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
export async function ramUsage(
  chain: Pick<ChainGateway, 'dao' | 'network' | 'memberships' | 'ramUsage'>,
  account: Account,
  id: string,
) {
  IdSchema.parse(id);
  const dao = await chain.dao(id),
    network = await chain.network();
  if (
    dao.reference.daoId !== id ||
    dao.reference.chainId !== network.chainId ||
    dao.reference.contract !== network.runtime ||
    dao.reference.interfaceVersion !== network.interfaceVersion
  )
    throw new ApiError('DAO_REFERENCE');
  if (
    !(await chain.memberships(account)).some(
      (m) => m.active && daoPaymentKey(m.dao) === daoPaymentKey(dao.reference),
    )
  )
    throw new ApiError('MEMBER_REQUIRED', 403);
  if (!chain.ramUsage) throw new ApiError('RESOURCE_UNAVAILABLE', 503);
  const result = RamUsageSchema.parse(await chain.ramUsage(id));
  if (daoPaymentKey(result.dao) !== daoPaymentKey(dao.reference))
    throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  return result;
}
export async function ramQuote(
  chain: Pick<ChainGateway, 'dao' | 'network' | 'memberships' | 'ramUsage' | 'ramQuote'>,
  account: Account,
  value: unknown,
) {
  const input = RamQuoteRequestSchema.parse(value);
  const usage = await ramUsage(chain, account, input.dao.daoId);
  if (daoPaymentKey(input.dao) !== daoPaymentKey(usage.dao)) throw new ApiError('DAO_REFERENCE');
  if (!chain.ramQuote) throw new ApiError('RESOURCE_UNAVAILABLE', 503);
  const result = RamQuoteSchema.parse(await chain.ramQuote(input));
  if (
    daoPaymentKey(result.dao) !== daoPaymentKey(input.dao) ||
    result.order.payer !== input.payer ||
    result.order.purchases.length !== input.allocations.length ||
    input.allocations.some(
      (a) =>
        !result.order.purchases.some(
          (p) => p.receiver === a.receiver && p.minimum_bytes === a.minimumBytes,
        ),
    )
  )
    throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  return result;
}
