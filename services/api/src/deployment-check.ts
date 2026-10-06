import { z } from 'zod';
import {
  RESOURCE_CPU_FLOOR_USEC,
  RESOURCE_NET_FLOOR_BYTES,
  RESOURCE_RAM_FLOOR_BYTES,
} from './limits.js';

export const GET_CODE_HASH_FEATURE =
  'bcd2a26394b36614fd4894241d3c451ab0f6fd110958c3423073621a70826e99';

const ChainInfoSchema = z.object({
  chain_id: z.string(),
  head_block_num: z.number().int(),
  last_irreversible_block_num: z.number().int(),
  server_version_string: z.string(),
});
const FeatureResponseSchema = z.object({
  activated_protocol_features: z.array(
    z.object({
      feature_digest: z.string(),
      activation_block_num: z.number().int(),
      specification: z.array(z.object({ name: z.string(), value: z.string() })).default([]),
    }),
  ),
  more: z.boolean().optional(),
});
export const AccountResourceSchema = z.object({
  cpu_limit: z.object({ available: z.number().int() }),
  net_limit: z.object({ available: z.number().int() }),
  ram_quota: z.number().int(),
  ram_usage: z.number().int(),
});
const CodeHashSchema = z.object({ code_hash: z.string().regex(/^[0-9a-f]{64}$/) });

export interface ResourceReading {
  cpuAvailable: number;
  netAvailable: number;
  ramQuota: number;
  ramUsage: number;
}

export function resourcesAcceptable(account: ResourceReading): boolean {
  const cpuOk = account.cpuAvailable < 0 || account.cpuAvailable >= RESOURCE_CPU_FLOOR_USEC;
  const netOk = account.netAvailable < 0 || account.netAvailable >= RESOURCE_NET_FLOOR_BYTES;
  const ramAvailable =
    account.ramQuota < 0 ? Number.POSITIVE_INFINITY : account.ramQuota - account.ramUsage;
  return cpuOk && netOk && ramAvailable >= RESOURCE_RAM_FLOOR_BYTES;
}

export interface DeploymentAssessment {
  ok: boolean;
  failures: string[];
}

export function assessDeployment(input: {
  chainId: string;
  expectedChainId?: string;
  featureDigests: readonly string[];
  moreFeatures: boolean;
  accounts: readonly {
    account: string;
    actualHash: string;
    expectedHash?: string;
    resources: ResourceReading;
  }[];
}): DeploymentAssessment {
  const failures: string[] = [];
  if (input.expectedChainId && input.chainId !== input.expectedChainId) failures.push('CHAIN_ID');
  if (input.moreFeatures) failures.push('FEATURE_PAGE');
  if (!input.featureDigests.includes(GET_CODE_HASH_FEATURE)) failures.push('GET_CODE_HASH');
  for (const account of input.accounts) {
    if (account.expectedHash && account.actualHash !== account.expectedHash)
      failures.push(`CODE_HASH:${account.account}`);
    if (!resourcesAcceptable(account.resources)) failures.push(`RESOURCES:${account.account}`);
  }
  return { ok: failures.length === 0, failures };
}

export interface DeploymentReport {
  rpcUrl: string;
  chainId: string;
  headBlockNum: number;
  lastIrreversibleBlockNum: number;
  serverVersion: string;
  getCodeHash: { digest: string; active: boolean; activationBlockNum: number | null };
  accounts: {
    account: string;
    codeHash: string;
    expectedHash: string | null;
    resourcesAcceptable: boolean;
  }[];
  failures: string[];
}

async function postJson(request: typeof fetch, url: string, body: unknown): Promise<unknown> {
  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`RPC_HTTP_${response.status}`);
  return response.json();
}

export async function collectDeployment(
  rpcUrl: string,
  request: typeof fetch,
  accounts: readonly { account: string; expectedHash?: string }[],
  expectedChainId?: string,
): Promise<DeploymentReport & { ok: boolean }> {
  const info = ChainInfoSchema.parse(await postJson(request, `${rpcUrl}/v1/chain/get_info`, {}));
  const features = FeatureResponseSchema.parse(
    await postJson(request, `${rpcUrl}/v1/chain/get_activated_protocol_features`, { limit: 1000 }),
  );
  const feature = features.activated_protocol_features.find(
    (item) => item.feature_digest === GET_CODE_HASH_FEATURE,
  );
  const checked = [];
  for (const account of accounts) {
    const hash = CodeHashSchema.parse(
      await postJson(request, `${rpcUrl}/v1/chain/get_code_hash`, {
        account_name: account.account,
      }),
    );
    const resources = AccountResourceSchema.parse(
      await postJson(request, `${rpcUrl}/v1/chain/get_account`, { account_name: account.account }),
    );
    const reading = {
      cpuAvailable: resources.cpu_limit.available,
      netAvailable: resources.net_limit.available,
      ramQuota: resources.ram_quota,
      ramUsage: resources.ram_usage,
    };
    checked.push({
      account: account.account,
      actualHash: hash.code_hash,
      ...(account.expectedHash ? { expectedHash: account.expectedHash } : {}),
      resources: reading,
      resourcesAcceptable: resourcesAcceptable(reading),
    });
  }
  const assessment = assessDeployment({
    chainId: info.chain_id,
    ...(expectedChainId ? { expectedChainId } : {}),
    featureDigests: features.activated_protocol_features.map((item) => item.feature_digest),
    moreFeatures: features.more === true,
    accounts: checked,
  });
  return {
    ok: assessment.ok,
    rpcUrl,
    chainId: info.chain_id,
    headBlockNum: info.head_block_num,
    lastIrreversibleBlockNum: info.last_irreversible_block_num,
    serverVersion: info.server_version_string,
    getCodeHash: {
      digest: GET_CODE_HASH_FEATURE,
      active: feature !== undefined,
      activationBlockNum: feature?.activation_block_num ?? null,
    },
    accounts: checked.map((account) => ({
      account: account.account,
      codeHash: account.actualHash,
      expectedHash: account.expectedHash ?? null,
      resourcesAcceptable: account.resourcesAcceptable,
    })),
    failures: assessment.failures,
  };
}
