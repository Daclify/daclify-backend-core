import { deploymentAccounts, DEPLOY_ROLES, type DeployEnvironment } from './environment.js';

export interface AccountView {
  exists: boolean;
  ramQuota: number;
  ramUsage: number;
  hasCode: boolean;
}

export interface DeployChange {
  role: string;
  account: string;
  action: 'create' | 'buyram' | 'set-contract' | 'unchanged';
  detail: string;
}

export function planDeployment(
  environment: DeployEnvironment,
  views: ReadonlyMap<string, AccountView>,
  setContract: boolean,
): DeployChange[] {
  const changes: DeployChange[] = [];
  deploymentAccounts(environment).forEach((account, index) => {
    const role = index < DEPLOY_ROLES.length ? DEPLOY_ROLES[index] : account.contract;
    if (!role) throw new Error('DEPLOY_ACCOUNT_VIEW');
    const view = views.get(account.name);
    if (!view) throw new Error('DEPLOY_ACCOUNT_VIEW');
    if (!view.exists) {
      changes.push({
        role,
        account: account.name,
        action: 'create',
        detail:
          environment.resourceModel === 'telos'
            ? `new account, ${account.ramBytes} bytes RAM, CPU ${account.cpuStake}, NET ${account.netStake}`
            : 'new account on the local chain',
      });
    } else if (
      environment.resourceModel === 'telos' &&
      view.ramQuota >= 0 &&
      view.ramQuota < account.ramBytes
    ) {
      changes.push({
        role,
        account: account.name,
        action: 'buyram',
        detail: `buy ${account.ramBytes - view.ramQuota} more bytes; quota is ${view.ramQuota}`,
      });
    }
    if (setContract && account.contract && (!view.exists || !view.hasCode)) {
      changes.push({
        role,
        account: account.name,
        action: 'set-contract',
        detail: `install ${account.contract}`,
      });
    }
    if (view.exists && !changes.some((change) => change.account === account.name)) {
      const ram =
        view.ramQuota < 0 ? 'RAM unlimited' : `RAM quota ${view.ramQuota}, used ${view.ramUsage}`;
      changes.push({
        role,
        account: account.name,
        action: 'unchanged',
        detail: view.hasCode ? `${ram}; code is installed` : `${ram}; no contract`,
      });
    }
  });
  return changes;
}
