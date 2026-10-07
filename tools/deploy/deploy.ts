import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APIClient, Action, PublicKey, Transaction, SignedTransaction } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadEnvFile } from '../../services/api/src/env-file.js';
import { creationActions, encodeContractAbi, encodeSystem } from './actions.js';
import {
  CORE_ROOT,
  deploymentAccounts,
  loadEnvironment,
  type DeployAccount,
  type DeployEnvironment,
  type DeployName,
} from './environment.js';
import { deployerKey, keyFilePath, loadOrCreateActiveKeys, type ActiveKey } from './keys.js';
import { contextPermissionPlan } from './permissions.js';
import { planDeployment, type AccountView } from './plan.js';
import { deploymentSend } from './send.js';
import { waitForIrreversibleBlock } from '../../services/api/src/chain-confirmation.js';

const usage = `Usage: npm run deploy -- <develop|production|testnet> [--set-contract] [--commit|--confirm]

develop dry-run reads the local fixture. --commit creates missing local accounts.
testnet dry-run reads Telos testnet. --commit spends testnet TLOS from the creator account.
Testnet names are ordinary 12-character accounts. The script does not create the creator.
production dry-run reads Telos mainnet. --confirm spends TLOS from the creator account.
The creator private key is DEPLOYER_PRIVATE_KEY. It is never printed.
Active keys are written to .artifacts/deploy/<environment>-keys.json.`;

const environmentName = process.argv[2];
if (
  environmentName !== 'develop' &&
  environmentName !== 'production' &&
  environmentName !== 'testnet'
) {
  console.log(usage);
  process.exitCode = 1;
} else {
  loadEnvFile(environmentName === 'develop' ? '.env' : `.env.${environmentName}`);
  const setContract = process.argv.includes('--set-contract');
  const commit = process.argv.includes('--commit');
  const confirm = process.argv.includes('--confirm');
  const send = deploymentSend(environmentName, { commit, confirm });
  await deploy(environmentName, setContract, send);
}

async function deploy(name: DeployName, setContract: boolean, send: boolean): Promise<void> {
  const environment = await loadEnvironment(name);
  const infoResponse = await fetch(`${environment.rpcUrl}/v1/chain/get_info`, {
    method: 'POST',
    body: '{}',
  });
  if (!infoResponse.ok) throw new Error('CHAIN_UNAVAILABLE');
  const info = z.object({ chain_id: z.string() }).parse(await infoResponse.json());
  if (info.chain_id !== environment.chainId) throw new Error('CHAIN_ID');
  const views = new Map<string, AccountView>();
  for (const account of deploymentAccounts(environment)) {
    views.set(account.name, await readAccount(environment.rpcUrl, account.name));
  }
  const changes = planDeployment(environment, views, setContract);
  const runtime = environment.accounts[0];
  if (!runtime) throw new Error('DEPLOY_RUNTIME');
  const modules = deploymentAccounts(environment).flatMap<
    Parameters<typeof contextPermissionPlan>[1][number]
  >((account) => {
    const id =
      account.contract === 'grants'
        ? 'grants-rounds'
        : account.contract === 'endorse'
          ? 'endorsement-admission'
          : account.contract;
    return id === 'decide' ||
      id === 'works' ||
      id === 'payroll' ||
      id === 'grants-rounds' ||
      id === 'endorsement-admission'
      ? [{ id, account: account.name }]
      : [];
  });
  console.log(
    'Context authority plan (review and apply separately with each account controller): ' +
      JSON.stringify(contextPermissionPlan(runtime.name, modules)),
  );
  console.log(`Environment ${environment.name} on ${environment.rpcUrl}`);
  console.log(`Chain ${environment.chainId} matches.`);
  for (const change of changes) {
    console.log(`${change.role} ${change.account}: ${change.action}; ${change.detail}`);
  }
  const creator = await readAccount(environment.rpcUrl, environment.creatorAccount);
  if (!creator.exists) {
    console.log(
      `Creator ${environment.creatorAccount} is not on this chain. Create that account before sending.`,
    );
    if (name === 'testnet') {
      console.log(
        'On testnet that creator is an ordinary 12-character account. Create and fund it, then this script can create the configured deployment accounts.',
      );
    }
  }
  if (!send) {
    console.log('Dry run. No transaction was sent.');
    return;
  }
  if (!creator.exists) throw new Error('CREATOR_MISSING');
  if (setContract) assertArtifacts(environment);
  const key = deployerKey();
  const permission = await creatorPermission(environment, key.toPublic());
  console.log(
    `Creator ${environment.creatorAccount}@${permission} matches the supplied public key.`,
  );
  const activeKeys = loadOrCreateActiveKeys(environment);
  console.log(
    `Active keys are stored in ${path.relative(CORE_ROOT, keyFilePath(environment.name))}.`,
  );
  const api = new APIClient({ url: environment.rpcUrl });
  for (const change of changes) {
    if (change.action === 'unchanged') continue;
    const account = deploymentAccounts(environment).find((item) => item.name === change.account);
    const active = activeKeys.find((item) => item.account === change.account);
    if (!account || !active) throw new Error('DEPLOY_ACCOUNT_VIEW');
    if (change.action === 'create') {
      const id = await pushActions(
        api,
        key,
        creationActions({
          creator: environment.creatorAccount,
          account: account.name,
          ownerKey: key.toPublic().toString(),
          activeKey: active.publicKey,
          inlineCode: account.inlineCode,
          resourceModel: environment.resourceModel,
          ramBytes: account.ramBytes,
          cpuStake: account.cpuStake,
          netStake: account.netStake,
        }).map((action) => ({
          account: action.account,
          name: action.name,
          authorizationActor: environment.creatorAccount,
          permission,
          data: encodeSystem(action.type, action.object),
        })),
      );
      console.log(`Created ${account.name} in ${id}.`);
    } else if (change.action === 'buyram') {
      const quota = views.get(account.name)?.ramQuota ?? 0;
      const id = await pushActions(api, key, [
        {
          account: 'eosio',
          name: 'buyrambytes',
          authorizationActor: environment.creatorAccount,
          permission,
          data: encodeSystem('buyrambytes', {
            payer: environment.creatorAccount,
            receiver: account.name,
            bytes: account.ramBytes - Math.max(quota, 0),
          }),
        },
      ]);
      console.log(`Bought RAM for ${account.name} in ${id}.`);
    } else {
      const id = await installContract(api, key, account);
      console.log(`Installed ${account.contract ?? 'contract'} on ${account.name} in ${id}.`);
    }
  }
}

async function readAccount(rpcUrl: string, account: string): Promise<AccountView> {
  const response = await fetch(`${rpcUrl}/v1/chain/get_account`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = z
      .object({
        error: z
          .object({ details: z.array(z.object({ message: z.string() })).optional() })
          .optional(),
      })
      .safeParse(body);
    const message = parsed.success ? (parsed.data.error?.details?.[0]?.message ?? '') : '';
    if (message.includes('unknown key')) {
      return { exists: false, ramQuota: 0, ramUsage: 0, hasCode: false };
    }
    throw new Error('CHAIN_UNAVAILABLE');
  }
  const accountRow = z
    .object({
      ram_quota: z.number(),
      ram_usage: z.number(),
      last_code_update: z.string(),
    })
    .parse(await response.json());
  return {
    exists: true,
    ramQuota: accountRow.ram_quota,
    ramUsage: accountRow.ram_usage,
    hasCode: !accountRow.last_code_update.startsWith('1970-01-01'),
  };
}

async function creatorPermission(
  environment: DeployEnvironment,
  key: PublicKey,
): Promise<'owner' | 'active'> {
  const response = await fetch(`${environment.rpcUrl}/v1/chain/get_account`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: environment.creatorAccount }),
  });
  if (!response.ok) throw new Error('DEPLOYER_PERMISSION');
  const account = z
    .object({
      permissions: z.array(
        z.object({
          perm_name: z.string(),
          required_auth: z.object({ keys: z.array(z.object({ key: z.string() })) }),
        }),
      ),
    })
    .parse(await response.json());
  for (const permission of ['active', 'owner'] as const) {
    const row = account.permissions.find((item) => item.perm_name === permission);
    if (row?.required_auth.keys.some((entry) => PublicKey.from(entry.key).equals(key))) {
      return permission;
    }
  }
  throw new Error('DEPLOYER_PERMISSION');
}

function artifactPath(
  contract: NonNullable<DeployAccount['contract']>,
  extension: 'wasm' | 'abi',
): string {
  const root =
    contract === 'runtime' || contract === 'hub' || contract === 'names'
      ? path.join(CORE_ROOT, '.artifacts', 'contracts')
      : path.join(CORE_ROOT, '..', 'daclify-backend-modules', '.artifacts', 'contracts');
  return path.join(root, `${contract}.${extension}`);
}

function assertArtifacts(environment: DeployEnvironment): void {
  for (const account of deploymentAccounts(environment)) {
    if (!account.contract) continue;
    for (const extension of ['wasm', 'abi'] as const) {
      try {
        readFileSync(artifactPath(account.contract, extension));
      } catch {
        throw new Error('DEPLOY_ARTIFACT_MISSING');
      }
    }
  }
}

async function installContract(
  api: APIClient,
  key: ReturnType<typeof deployerKey>,
  account: DeployAccount,
): Promise<string> {
  if (!account.contract) throw new Error('DEPLOY_ARTIFACT_MISSING');
  const wasm = readFileSync(artifactPath(account.contract, 'wasm'));
  const abiFile = readFileSync(artifactPath(account.contract, 'abi'));
  return pushActions(api, key, [
    {
      account: 'eosio',
      name: 'setcode',
      authorizationActor: account.name,
      permission: 'owner',
      data: encodeSystem('setcode', {
        account: account.name,
        vmtype: 0,
        vmversion: 0,
        code: new Uint8Array(wasm),
      }),
    },
    {
      account: 'eosio',
      name: 'setabi',
      authorizationActor: account.name,
      permission: 'owner',
      data: encodeSystem('setabi', {
        account: account.name,
        abi: encodeContractAbi(abiFile.toString('utf8')),
      }),
    },
  ]);
}

async function pushActions(
  api: APIClient,
  key: ActiveKey['privateKey'],
  actions: {
    account: string;
    name: string;
    authorizationActor: string;
    permission: 'owner' | 'active';
    data: Uint8Array;
  }[],
): Promise<string> {
  const info = await api.v1.chain.get_info();
  const transaction = Transaction.from({
    ...info.getTransactionHeader(120),
    actions: actions.map((action) =>
      Action.from({
        account: action.account,
        name: action.name,
        authorization: [{ actor: action.authorizationActor, permission: action.permission }],
        data: action.data,
      }),
    ),
  });
  const result = await api.v1.chain.push_transaction(
    SignedTransaction.from({
      ...transaction,
      signatures: [key.signDigest(transaction.signingDigest(info.chain_id))],
    }),
  );
  console.log(
    `Accepted ${result.transaction_id}; waiting for block ${result.processed.block_num} to be irreversible.`,
  );
  await waitForIrreversibleBlock(
    async () => Number((await api.v1.chain.get_info()).last_irreversible_block_num),
    result.processed.block_num,
  );
  return z.string().parse(String(result.transaction_id));
}
