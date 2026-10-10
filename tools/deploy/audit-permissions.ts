import { Serializer } from '@wharfkit/antelope';
import { createRpcClient } from '../../services/api/src/rpc.js';
import { deploymentAccounts, loadEnvironment } from './environment.js';
import {
  auditContextPermission,
  contextLinkRepairActions,
  deploymentContextPermissionPlan,
  upgradePermissionLinks,
  permissionAuditAccount,
} from './permissions.js';

const profile = process.argv[2];
if (
  process.argv.length !== 3 ||
  (profile !== 'develop' && profile !== 'testnet' && profile !== 'production')
) {
  console.error('Usage: npm run audit:permissions -- <develop|testnet|production>');
  process.exitCode = 1;
} else {
  try {
    const environment = await loadEnvironment(profile);
    const client = createRpcClient(environment.rpcUrl);
    const info = await client.v1.chain.get_info();
    if (info.chain_id.toString() !== environment.chainId) throw new Error('CHAIN_ID_MISMATCH');
    const definitions = deploymentAccounts(environment);
    const accounts = await Promise.all(
      definitions.map(async (definition) =>
        permissionAuditAccount(
          await client.call({
            path: '/v1/chain/get_account',
            params: { account_name: definition.name },
          }),
        ),
      ),
    );
    for (const [index, account] of accounts.entries())
      if (account.account_name.toString() !== definitions[index]?.name)
        throw new Error('PERMISSION_ACCOUNT_MISMATCH');
    const plan = deploymentContextPermissionPlan(environment);
    const runtime = accounts.find((account) => account.account_name.toString() === plan.account);
    if (!runtime) throw new Error('DEPLOY_RUNTIME');
    const context = auditContextPermission(plan, runtime);
    const repairRequiresReview =
      !context.authorityMatches ||
      context.unexpectedLinks.length > 0 ||
      context.missingLinks.some((link) => link.currentPermission !== null);
    const upgrades = accounts.flatMap((account, index) =>
      definitions[index]?.contract
        ? [{ account: account.account_name.toString(), links: upgradePermissionLinks(account) }]
        : [],
    );
    console.log(
      JSON.stringify(
        {
          mode: 'read-only; unsigned proposals only',
          chainId: environment.chainId,
          rpcUrl: environment.rpcUrl,
          observedBlock: info.head_block_num.toString(),
          checkedAt: new Date().toISOString(),
          context,
          upgrades,
          upgradePolicyEvaluated: false,
          unsignedRepair: repairRequiresReview
            ? null
            : {
                chainId: environment.chainId,
                unsigned: true,
                actions: contextLinkRepairActions(plan, runtime).map((action) =>
                  Serializer.objectify(action),
                ),
              },
          repairRequiresReview,
        },
        null,
        2,
      ),
    );
    if (repairRequiresReview || context.missingLinks.length) process.exitCode = 2;
  } catch {
    console.error(
      'PERMISSION_AUDIT_FAILED: verify the deployment profile, chain and account reads.',
    );
    process.exitCode = 1;
  }
}
