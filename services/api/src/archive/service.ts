import { ArchiveRoutes } from '@daclify/modules/archive';
import type { Account } from '../../../../protocol/api.js';
import { daoPaymentKey } from '../../../../protocol/payments.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
export async function archivePreview(chain: ChainGateway, account: Account, value: unknown) {
  const input = ArchiveRoutes.preview.input.parse(value),
    network = await chain.network();
  if (
    input.dao.chainId !== network.chainId ||
    input.dao.contract !== network.runtime ||
    input.dao.interfaceVersion !== network.interfaceVersion
  )
    throw new ApiError('DAO_REFERENCE');
  if (
    !(await chain.memberships(account)).some(
      (member) =>
        daoPaymentKey(member.dao) === daoPaymentKey(input.dao) && member.active && member.admin,
    )
  )
    throw new ApiError('ARCHIVE_ADMIN_REQUIRED', 403);
  if (!chain.archivePreview) throw new ApiError('ARCHIVE_UNAVAILABLE', 503);
  const result = ArchiveRoutes.preview.response.parse(await chain.archivePreview(input));
  if (daoPaymentKey(result.dao) !== daoPaymentKey(input.dao))
    throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  return result;
}
