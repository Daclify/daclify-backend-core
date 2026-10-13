import type { Pool } from 'pg';
import type { NativeChainGateway } from '../native-chain.js';
import { readAccount } from '../auth/account-session.js';
import { daoPaymentKey } from '../../../../protocol/payments.js';
export function governedDirectoryModeration(
  pool: Pool,
  chain: Pick<NativeChainGateway, 'platform' | 'memberships'>,
) {
  return {
    available: async () => !!(await chain.platform()).platformDao,
    authorize: async (accountId: string) => {
      const [account, platform] = await Promise.all([
        readAccount(pool, accountId),
        chain.platform(),
      ]);
      if (!account || !platform.platformDao) return false;
      const reference = platform.platformDao;
      return (await chain.memberships(account)).some(
        (member) =>
          member.active && member.admin && daoPaymentKey(member.dao) === daoPaymentKey(reference),
      );
    },
  };
}
