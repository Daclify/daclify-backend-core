import {
  ContentPageQuerySchema,
  DaoContentSchema,
  type ContentPageQuery,
  type DaoContent,
} from '../../../protocol/content.js';
import { waitForIrreversibleBlock } from './chain-confirmation.js';
import {
  TreasurySchema,
  SettlementRequestSchema,
  evidenceForDao,
  evidenceTableMissing,
  type Treasury,
  type SettlementRequest,
  type SettlementResult,
} from '../../../protocol/treasury.js';
import {
  ABI,
  APIClient,
  Action,
  Serializer,
  Transaction,
  SignedTransaction,
  PrivateKey,
  Signature,
  PublicKey,
  Name,
} from '@wharfkit/antelope';
import {
  Catalog,
  ModulePermissions,
  ModuleApiRoutes,
  ModuleStateSchema,
  ModulePageQuerySchema,
  type ModulePageQuery,
  VERSION as MODULE_VERSION,
  type ModuleState,
  type ModuleDeployment,
  type FinalizationRequest,
  type FinalizationResult,
  type ExecutionRequest,
  type ExecutionResult,
} from '@daclify/modules';
import {
  encodeDecide,
  encodePayroll,
  ModuleCodeHashes,
  DecideTableSchemas,
  WorksTableSchemas,
  PayrollTableSchemas,
  GrantsTableSchemas,
  EndorseTableSchemas,
} from '@daclify/modules/sdk';
import { AccountResourceSchema, resourcesAcceptable } from './deployment-check.js';
import { randomBytes } from 'node:crypto';
import {
  ArchiveRoutes,
  OrdinaryPollArchiveInputSchema,
  archiveSourceSchema,
  planOrdinaryPollArchive,
  MAX_ARCHIVE_LEAVES,
  type ArchivePreviewRequest,
} from '@daclify/modules/archive';
import {
  HubDeploymentRowSchema,
  HubMetadataSchema,
  registryDirectory,
} from '../../../protocol/directory.js';
import { PaymentPolicySchema } from '../../../protocol/payments.js';
import type { DaoRef } from '../../../protocol/base.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../../../sdk/generated/releases.js';
import { parseModuleDeployments } from './deployment-config.js';
import { z } from 'zod';
import { executedChainResult } from './chain-result.js';
import {
  DaoSummarySchema,
  NetworkSchema,
  UserMembershipSchema,
  type Account,
  type DaoSummary,
  type Network,
  type UserMembership,
  type WalletIdentity,
  CreateDaoSchema,
} from '../../../protocol/api.js';
import {
  VERSION,
  NativeAccountSchema,
  Uint64Schema,
  IdSchema,
  ChainIdSchema,
  compatible,
} from '../../../protocol/base.js';
import {
  MetadataSchema,
  DaoPresets,
  GovernanceStateSchema,
  type GovernanceState,
} from '../../../protocol/dao.js';
import {
  RuntimeTableSchemas,
  encodeAction,
  instructionDigest,
  governanceSettings,
  type RuntimeActions,
  type instruction,
} from '../../../sdk/index.js';
import type { ChainGateway } from './chain.js';
import type { EvmRelay } from '../../../protocol/evm-wallet.js';
import type { Pool } from 'pg';
import { canonicalEvmSignature, evmTypedDigest, governanceTypedData } from '../../../sdk/evm.js';
import { recoverEvmDigest } from './auth/evm-proof.js';
import {
  resourcePolicyFromRow,
  RamUsageSchema,
  RamPayerUsageSchema,
} from '../../../protocol/resources.js';
import { ApiError, contractError } from './errors.js';
import {
  ChainPlatformSchema,
  ContractStatusSchema,
  type ChainPlatform,
} from '../../../protocol/platform.js';
import type { NamePurchase } from './billing/name.js';
import { HostingChainSchema, HostedPricingSchema } from '../../../protocol/hosting.js';
import {
  MarketRuleError,
  TelosNameSchema,
  loadFees,
  quoteName,
  readChainRows,
  type NamePolicy,
  type NameQuote,
} from './market/read.js';
import { readMarketplace, readNameService } from './market/routes.js';
export interface NativeChainConfig {
  rpcUrl: string;
  chainId: string;
  runtime: string;
  hub: string | null;
  environment: 'local' | 'testnet' | 'mainnet';
  relayActor: string;
  relayKey: PrivateKey;
  bootstrap?: { owner: string; key: PrivateKey };
  modules?: ReadonlyArray<{ id: ModuleDeployment['id']; account: string }>;
}
export function payrollSettlementAccount(
  modules: NativeChainConfig['modules'],
  source: string,
): string | undefined {
  const payroll = modules?.find((item) => item.id === 'payroll');
  if (!payroll || payroll.account !== source) return undefined;
  return payroll.account;
}
export class NativeChainGateway implements ChainGateway {
  private readonly api: APIClient;
  constructor(
    private readonly config: NativeChainConfig,
    private readonly pool?: Pool,
  ) {
    ChainIdSchema.parse(config.chainId);
    NativeAccountSchema.parse(config.runtime);
    NativeAccountSchema.parse(config.relayActor);
    const url = new URL(config.rpcUrl);
    if (url.username || url.password || url.search || url.hash)
      throw new Error('RPC_PUBLIC_ENDPOINT_REQUIRED');
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
    )
      throw new Error('Chain RPC requires TLS outside local tests');
    this.api = new APIClient({ url: config.rpcUrl });
  }
  private async reviewedRuntime(runtime: string) {
    const response = await fetch(this.config.rpcUrl + '/v1/chain/get_info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(10000),
    });
    if (
      !response.ok ||
      z.object({ chain_id: ChainIdSchema }).parse(await response.json()).chain_id !==
        this.config.chainId
    )
      throw new ApiError('PAYMENT_POLICY_UNAVAILABLE', 503);
    const value = await this.api.v1.chain.get_raw_abi(runtime).catch(() => {
      throw new ApiError('CHAIN_UNAVAILABLE', 503);
    });
    if (String(value.code_hash) !== RuntimeCodeHash || String(value.abi_hash) !== RuntimeRawAbiHash)
      throw new ApiError('PAYMENT_POLICY_UNAVAILABLE', 503);
    return value;
  }
  async paymentPolicy() {
    await this.reviewedRuntime(this.config.runtime);
    const market = (await this.table('mktcfg', this.config.runtime))[0];
    if (!market || market.dao_id === '0') throw new ApiError('PAYMENT_POLICY_UNAVAILABLE', 503);
    const row = (await this.table('paycfg', this.config.runtime))[0];
    return PaymentPolicySchema.parse({
      basisPoints: row?.bps ?? 500,
      revision: row?.revision ?? '0',
    });
  }
  async hosting(dao: DaoRef) {
    if (dao.chainId !== this.config.chainId || dao.contract !== this.config.runtime)
      throw new ApiError('HOSTING_DAO', 403);
    await this.reviewedRuntime(dao.contract);
    const [config, creation, pricing, market, people, caps] = await Promise.all([
      this.table('capcfg', dao.contract),
      this.table('createcfg', dao.contract),
      this.table('seatcfg', dao.contract),
      this.table('mktcfg', dao.contract),
      this.table('daos', dao.contract, dao.daoId, 1),
      this.table('daocaps', dao.contract, dao.daoId, 1),
    ]);
    const policy = config[0],
      record = people[0];
    if (!policy || policy.settler !== this.config.relayActor || creation[0]?.shared_usd !== 0)
      throw new ApiError('HOSTING_UNAVAILABLE', 503);
    if (record?.id !== dao.daoId) throw new ApiError('DAO_UNKNOWN', 404);
    const cap = caps[0]?.dao_id === dao.daoId ? caps[0] : undefined;
    const exempt = market[0]?.dao_id === dao.daoId;
    return HostingChainSchema.parse({
      dao,
      pricing: HostedPricingSchema.parse({
        freeSlots: policy.free_members,
        rates: pricing[0] ?? { first_usd: 100, next_usd: 50, rest_usd: 20, revision: '0' },
      }),
      activeMembers: record.member_count,
      effectiveCapacity: exempt
        ? 5000
        : cap && cap.expires > Date.now() / 1000
          ? Math.max(policy.free_members, cap.members)
          : policy.free_members,
      expires: cap?.expires ?? null,
      receipt: cap?.receipt ?? null,
      exempt,
    });
  }
  async attestCapacity(dao: DaoRef, members: number, expires: number, receipt: string) {
    await this.hosting(dao);
    ChainIdSchema.parse(receipt);
    await this.push(
      'setcapacity',
      { dao_id: dao.daoId, member_limit: members, expires, receipt },
      this.config.relayActor,
      this.config.relayKey,
    );
  }
  async revokeCapacity(dao: DaoRef, receipt: string) {
    await this.hosting(dao);
    await this.push(
      'revokecap',
      { dao_id: dao.daoId, receipt },
      this.config.relayActor,
      this.config.relayKey,
    );
  }
  async restoreCapacity(dao: DaoRef, receipt: string) {
    await this.hosting(dao);
    await this.push(
      'resumecap',
      { dao_id: dao.daoId, receipt },
      this.config.relayActor,
      this.config.relayKey,
    );
  }
  private async hubRows(runtime?: string) {
    if (!this.config.hub) return [];
    const key = runtime ? BigInt(Name.from(runtime).value.toString()) : null;
    const result = await readChainRows({
      rpcUrl: this.config.rpcUrl,
      code: this.config.hub,
      scope: this.config.hub,
      table: 'deployments',
      ...(key === null
        ? {}
        : {
            indexPosition: 2,
            keyType: 'i64',
            lowerBound: String(key),
            upperBound: String(key + 1n),
            limit: 2,
          }),
    });
    return z.array(HubDeploymentRowSchema).parse(result.rows);
  }
  async hubDirectory(after = '0') {
    Uint64Schema.parse(after);
    if (!this.config.hub) return { entries: [], skipped: 0, next: null };
    const result = await readChainRows({
      rpcUrl: this.config.rpcUrl,
      code: this.config.hub,
      scope: this.config.hub,
      table: 'deployments',
      paginate: true,
      lowerBound: after,
      limit: 100,
    });
    return { ...registryDirectory(result.rows, this.config.chainId), next: result.next ?? null };
  }
  async paymentMemberships(account: Account, dao: DaoRef) {
    if (dao.chainId !== this.config.chainId) throw new ApiError('PAYMENT_DAO', 403);
    if (dao.contract === this.config.runtime) return this.memberships(account);
    const listing = (await this.hubRows(dao.contract)).find(
      (row) => row.runtime === dao.contract && row.chain_id === dao.chainId && row.listed,
    );
    if (!listing) throw new ApiError('PAYMENT_DAO', 403);
    const metadata = HubMetadataSchema.parse(JSON.parse(listing.metadata));
    if (!metadata.daos.some((row) => row.daoId === dao.daoId))
      throw new ApiError('PAYMENT_DAO', 403);
    const raw = await this.reviewedRuntime(dao.contract);
    if (listing.code_hash !== String(raw.code_hash) || listing.abi_hash !== String(raw.abi_hash))
      throw new ApiError('PAYMENT_DAO', 403);
    const gateway = new NativeChainGateway(
      {
        ...this.config,
        runtime: dao.contract,
        modules: parseModuleDeployments(JSON.stringify(metadata.modules)),
      },
      this.pool,
    );
    const settings = (await gateway.table('settings', dao.contract))[0];
    if (settings?.chain_id !== dao.chainId) throw new ApiError('PAYMENT_DAO', 403);
    return (await gateway.memberships(account)).filter((m) => m.dao.daoId === dao.daoId);
  }
  async network(): Promise<Network> {
    const { abi } = await this.api.v1.chain.get_abi(this.config.runtime).catch(() => {
      throw new ApiError('CHAIN_UNAVAILABLE', 503);
    });
    const actions = abi?.actions.map((action) => Name.from(action.name).toString()) ?? [];
    const presets = await this.supportsPresets(actions);
    return NetworkSchema.parse({
      chainId: this.config.chainId,
      rpcUrl: this.config.rpcUrl,
      runtime: this.config.runtime,
      hub: this.config.hub,
      environment: this.config.environment,
      interfaceVersion: 1,
      coreVersion: VERSION,
      capabilities: [
        'internal-k1',
        'native-linked',
        'encrypted-documents',
        ...(actions.includes('authproof') ? ['native-sign-in'] : []),
        ...(actions.includes('submitevm') && actions.includes('linkevm')
          ? ['evm-eoa-governance']
          : []),
        ...(this.config.bootstrap ? ['shared-dao-create'] : []),
        ...(presets ? ['dao-presets', 'guarded-agents', 'governance-policy'] : []),
      ],
    });
  }
  async resourcePolicy() {
    const response = await fetch(this.config.rpcUrl + '/v1/chain/get_code_hash', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_name: this.config.runtime }),
      signal: AbortSignal.timeout(10000),
    });
    if (
      !response.ok ||
      z.object({ code_hash: ChainIdSchema }).parse(await response.json()).code_hash !==
        RuntimeCodeHash
    )
      throw new ApiError('RESOURCE_UNQUALIFIED', 503);
    const setting = (await this.table('settings', this.config.runtime))[0];
    if (setting?.chain_id !== this.config.chainId) throw new ApiError('DAO_REFERENCE');
    const row = (await this.table('resourcecfg', this.config.runtime))[0];
    return row ? resourcePolicyFromRow(row) : null;
  }
  async ramUsage(id: string) {
    IdSchema.parse(id);
    const startedAt = new Date().toISOString();
    await this.reviewedRuntime(this.config.runtime);
    const read = async <
      K extends 'ramobs' | 'ramstats' | 'ramalloc' | 'ramsources' | 'resourcecfg' | 'modules',
    >(
      table: K,
      scope: string,
    ) => {
      const page = await this.tablePage(table, scope, '0', 65);
      if (page.next !== null || page.rows.length > 64)
        throw new ApiError('RESOURCE_SCOPE_LIMIT', 503);
      return page.rows;
    };
    const [observers, stats, allocations, sources, policies, installed] = await Promise.all([
      read('ramobs', this.config.runtime),
      read('ramstats', id),
      read('ramalloc', id),
      read('ramsources', this.config.runtime),
      read('resourcecfg', this.config.runtime),
      read('modules', id),
    ]);
    const observer = observers[0];
    if (observer && observer.runtime_hash !== RuntimeCodeHash)
      throw new ApiError('RESOURCE_UNQUALIFIED', 503);
    const accounts = [
      ...new Set([
        this.config.runtime,
        ...stats.map((r) => r.payer),
        ...allocations.map((r) => r.payer),
        ...installed.map((r) => r.account),
      ]),
    ];
    if (accounts.length > 64) throw new ApiError('RESOURCE_SCOPE_LIMIT', 503);
    const code = async (account: string) => {
      const response = await fetch(this.config.rpcUrl + '/v1/chain/get_code_hash', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account_name: account }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new ApiError('CHAIN_UNAVAILABLE', 503);
      return z.object({ code_hash: ChainIdSchema }).parse(await response.json()).code_hash;
    };
    const payers = await Promise.all(
      accounts.map(async (payer) => {
        NativeAccountSchema.parse(payer);
        const [account, hash] = await Promise.all([
            this.api.v1.chain.get_account(payer),
            code(payer),
          ]),
          expected =
            payer === this.config.runtime
              ? RuntimeCodeHash
              : sources.find((r) => r.account === payer)?.code_hash,
          recorded = stats.find((r) => r.payer === payer),
          usage = observer
            ? (recorded ??
              RuntimeTableSchemas.ramstats.parse({
                payer,
                identity: '0',
                activity: '0',
                retained: '0',
                platform: '0',
              }))
            : null;
        if ((await code(payer)) !== hash) throw new ApiError('RESOURCE_SOURCE_CHANGED', 503);
        return RamPayerUsageSchema.parse({
          payer,
          moduleId: this.config.modules?.find((m) => m.account === payer)?.id ?? null,
          sourceVerified: expected !== undefined && expected === hash,
          usage: usage
            ? {
                identity: usage.identity,
                activity: usage.activity,
                retained: usage.retained,
                platform: usage.platform,
              }
            : null,
          purchasedBytes: allocations.find((r) => r.payer === payer)?.purchased_bytes ?? '0',
          globalQuotaBytes:
            BigInt(account.ram_quota.toString()) < 0n ? null : account.ram_quota.toString(),
          globalUsedBytes: account.ram_usage.toString(),
        });
      }),
    );
    await this.reviewedRuntime(this.config.runtime);
    const total =
      observer && payers.every((p) => p.sourceVerified)
        ? payers
            .reduce(
              (n, p) =>
                n +
                (p.usage
                  ? BigInt(p.usage.identity) +
                    BigInt(p.usage.activity) +
                    BigInt(p.usage.retained) +
                    BigInt(p.usage.platform)
                  : 0n),
              0n,
            )
            .toString()
        : null;
    return RamUsageSchema.parse({
      dao: {
        chainId: this.config.chainId,
        contract: this.config.runtime,
        daoId: id,
        interfaceVersion: 1,
      },
      observation: observer ? 'active' : 'disabled',
      enforcement: 'disabled',
      read: { startedAt, completedAt: new Date().toISOString(), atomic: false },
      policy: policies[0] ? resourcePolicyFromRow(policies[0]) : null,
      totalObservedBytes: total,
      purchasedBytes: payers.reduce((n, p) => n + BigInt(p.purchasedBytes), 0n).toString(),
      payers,
    });
  }
  async archivePreview(value: ArchivePreviewRequest) {
    const input = ArchiveRoutes.preview.input.parse(value);
    if (
      input.dao.chainId !== this.config.chainId ||
      input.dao.contract !== this.config.runtime ||
      input.dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE');
    await this.reviewedRuntime(input.dao.contract);
    const deployment = this.config.modules?.find((row) => row.id === 'decide');
    if (!deployment) throw new ApiError('ARCHIVE_UNAVAILABLE', 503);
    const source = archiveSourceSchema('ordinary-poll-votes');
    const reviewedSource = async () => {
      const raw = await this.api.v1.chain.get_raw_abi(deployment.account);
      if (String(raw.code_hash) !== source.codeHash || String(raw.abi_hash) !== source.rawAbiHash)
        throw new ApiError('ARCHIVE_SCHEMA_UNSUPPORTED', 409);
    };
    await reviewedSource();
    const installed = (await this.table('modules', input.dao.daoId)).find(
      (row) => row.account === deployment.account,
    );
    if (
      !installed ||
      installed.version !== 1 ||
      ((installed.actions.length || installed.grants.length) &&
        installed.code_hash !== source.codeHash)
    )
      throw new ApiError('MODULE_UNVERIFIED', 409);
    const info = await this.api.v1.chain.get_info();
    if (
      info.chain_id.toString() !== input.dao.chainId ||
      Number(info.last_irreversible_block_num) < 1
    )
      throw new ApiError('ARCHIVE_SNAPSHOT_UNQUALIFIED', 503);
    const [block, account] = await Promise.all([
      this.api.v1.chain.get_block(info.last_irreversible_block_num),
      this.api.v1.chain.get_account(deployment.account),
    ]);
    if (
      block.id.toString() !== info.last_irreversible_block_id.toString() ||
      Number(block.block_num) !== Number(info.last_irreversible_block_num)
    )
      throw new ApiError('ARCHIVE_SNAPSHOT_UNQUALIFIED', 503);
    const state: z.infer<typeof OrdinaryPollArchiveInputSchema> = {
      dao: input.dao,
      source: {
        account: deployment.account,
        codeHash: source.codeHash,
        abiHash: source.rawAbiHash,
      },
      snapshot: {
        blockNumber: Number(block.block_num),
        blockId: block.id.toString(),
        timestamp: new Date(block.timestamp.toMilliseconds()).toISOString(),
      },
      sourceUpdatedAt: new Date(account.last_code_update.toMilliseconds()).toISOString(),
      retentionSeconds: input.retentionSeconds,
      ballots: [],
      votes: [],
      terminals: [],
      elections: [],
      executions: [],
      grantplans: [],
    };
    const one = async <T>(table: string, schema: z.ZodType<T>, id: string) => {
      const result = await this.moduleRows(deployment.account, table, schema, id, id, 1, 'i64', 1);
      if (result.more || result.rows.length > 1)
        throw new ApiError('ARCHIVE_COVERAGE_INCOMPLETE', 409);
      return result.rows[0];
    };
    for (const id of input.ballotIds) {
      const [ballot, terminal, election, work, grant] = await Promise.all([
        one('ballots', DecideTableSchemas.ballots, id),
        one('pollends', DecideTableSchemas.pollends, id),
        one('elections', DecideTableSchemas.elections, id),
        one('executions', DecideTableSchemas.executions, id),
        one('grantplans', DecideTableSchemas.grantplans, id),
      ]);
      if (
        !ballot ||
        ballot.id !== id ||
        (terminal && terminal.ballot_id !== id) ||
        (election && election.id !== id) ||
        (work && work.ballot_id !== id) ||
        (grant && grant.ballot_id !== id)
      )
        throw new ApiError('BALLOT_UNKNOWN', 404);
      state.ballots.push(ballot);
      if (terminal) state.terminals.push(terminal);
      if (election) state.elections.push({ id: election.id, dao_id: election.dao_id });
      if (work) state.executions.push({ ballot_id: work.ballot_id, dao_id: work.dao_id });
      if (grant) state.grantplans.push({ ballot_id: grant.ballot_id, dao_id: grant.dao_id });
      let cursor = BigInt(id) << 64n;
      const upper = (BigInt(id) << 64n) | ((1n << 64n) - 1n);
      for (;;) {
        const page = await this.moduleRows(
          deployment.account,
          'votes',
          DecideTableSchemas.votes,
          cursor.toString(),
          upper.toString(),
          2,
          'i128',
          Math.min(256, MAX_ARCHIVE_LEAVES - state.votes.length + 1),
        );
        if (
          page.rows.some(
            (row) =>
              row.ballot !== id || ((BigInt(row.ballot) << 64n) | BigInt(row.member)) < cursor,
          ) ||
          state.votes.length + page.rows.length > MAX_ARCHIVE_LEAVES
        )
          throw new ApiError('ARCHIVE_COVERAGE_INCOMPLETE', 409);
        state.votes.push(...page.rows);
        if (!page.more) break;
        const last = page.rows.at(-1);
        if (!last || BigInt(last.member) === (1n << 64n) - 1n)
          throw new ApiError('ARCHIVE_COVERAGE_INCOMPLETE', 409);
        cursor = (BigInt(id) << 64n) | (BigInt(last.member) + 1n);
      }
    }
    await reviewedSource();
    await this.reviewedRuntime(input.dao.contract);
    try {
      return planOrdinaryPollArchive(state);
    } catch {
      throw new ApiError('ARCHIVE_SOURCE_INVALID', 409);
    }
  }
  async platform(): Promise<ChainPlatform> {
    const [network, info, abi] = await Promise.all([
      this.network(),
      this.api.v1.chain.get_info(),
      this.api.v1.chain.get_abi(this.config.runtime),
    ]);
    async function optional<K extends keyof typeof RuntimeTableSchemas>(
      self: NativeChainGateway,
      name: K,
    ) {
      return abi.abi?.tables.some((t) => t.name === name)
        ? ((await self.table(name, self.config.runtime))[0] ?? null)
        : null;
    }
    const [
      fees,
      market,
      creation,
      runtimeSettings,
      catalogue,
      hosting,
      seatPricing,
      paymentPolicy,
      resourcePolicy,
    ] = await Promise.all([
      optional(this, 'feecfg'),
      optional(this, 'mktcfg'),
      optional(this, 'createcfg'),
      optional(this, 'settings'),
      abi.abi?.tables.some((t) => t.name === 'catalogue')
        ? this.table('catalogue', this.config.runtime)
        : [],
      optional(this, 'capcfg'),
      optional(this, 'seatcfg'),
      optional(this, 'paycfg'),
      optional(this, 'resourcecfg'),
    ]);
    const contracts = await Promise.all(
      [
        ...new Set([
          this.config.runtime,
          ...(this.config.hub ? [this.config.hub] : []),
          ...(this.config.modules ?? []).map((m) => m.account),
          this.config.relayActor,
          ...(fees?.treasury ? [fees.treasury] : []),
          ...(fees?.names ? [fees.names] : []),
          ...(creation?.settler ? [creation.settler] : []),
        ]),
      ].map(async (account) => {
        const expectedHash = this.config.modules?.find((m) => m.account === account);
        const response = await fetch(this.config.rpcUrl + '/v1/chain/get_code_hash', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ account_name: account }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new ApiError('CHAIN_UNAVAILABLE', 503);
        const hash = z.object({ code_hash: ChainIdSchema }).parse(await response.json()).code_hash;
        const expectedCode =
          account === this.config.runtime
            ? RuntimeCodeHash
            : expectedHash
              ? ModuleCodeHashes[expectedHash.id]
              : null;
        const data = await this.api.v1.chain.get_account(account);
        return ContractStatusSchema.parse({
          account,
          moduleId: expectedHash?.id ?? null,
          codeHash: hash,
          expectedHash: expectedCode,
          verified: expectedCode !== null && hash === expectedCode,
          ramBytes: Number(data.ram_quota),
          ramUsed: Number(data.ram_usage),
          permissions: data.permissions.map((p) => ({
            name: String(p.perm_name),
            parent: String(p.parent),
            threshold: Number(p.required_auth.threshold),
            keys: p.required_auth.keys.map((k) => ({
              key: String(k.key),
              weight: Number(k.weight),
            })),
            accounts: p.required_auth.accounts.map((a) => ({
              actor: String(a.permission.actor),
              permission: String(a.permission.permission),
              weight: Number(a.weight),
            })),
            waits: p.required_auth.waits.map((w) => ({
              seconds: Number(w.wait_sec),
              weight: Number(w.weight),
            })),
          })),
        });
      }),
    );
    return ChainPlatformSchema.parse({
      network,
      chainId: String(info.chain_id),
      chainMatches: String(info.chain_id) === this.config.chainId,
      headBlock: Number(info.head_block_num),
      irreversibleBlock: Number(info.last_irreversible_block_num),
      headTime: String(info.head_block_time),
      contracts,
      catalogue,
      fees,
      market,
      creation,
      hosting,
      seatPricing,
      paymentPolicy,
      resourcePolicy: resourcePolicy ? resourcePolicyFromRow(resourcePolicy) : null,
      runtimeSettings,
      rateFresh:
        !!creation &&
        BigInt(creation.median) > 0n &&
        creation.observed_at <= Date.now() / 1000 &&
        Date.now() / 1000 - creation.observed_at <= 900,
      platformDao:
        market && market.dao_id !== '0'
          ? {
              chainId: this.config.chainId,
              contract: this.config.runtime,
              daoId: market.dao_id,
              interfaceVersion: 1,
            }
          : null,
      sharedAvailable:
        !!this.config.bootstrap &&
        !!creation &&
        creation.settler === this.config.relayActor &&
        !!fees &&
        contracts.filter((c) => c.expectedHash !== null).every((c) => c.verified) &&
        abi.abi?.actions.some((a) => a.name === 'createpaid') &&
        runtimeSettings?.chain_id === this.config.chainId &&
        String(info.chain_id) === this.config.chainId,
      independentAvailable: false,
    });
  }
  async creationOrder(reference: string) {
    ChainIdSchema.parse(reference);
    const result = await readChainRows({
      rpcUrl: this.config.rpcUrl,
      code: this.config.runtime,
      scope: this.config.runtime,
      table: 'createords',
      indexPosition: 2,
      keyType: 'sha256',
      lowerBound: reference,
      upperBound: reference,
    });
    return (
      z
        .array(RuntimeTableSchemas.createords)
        .parse(result.rows)
        .find((row) => row.reference === reference) ?? null
    );
  }
  async orderCreation(reference: string, creator: string, method: 'card' | 'tlos' | 'free') {
    const existing = await this.creationOrder(reference);
    if (existing) return existing;
    await this.push(
      method === 'free' ? 'orderfree' : 'ordercreate',
      method === 'free'
        ? { reference, creator }
        : { reference, creator, deployment: 0, method: method === 'tlos' ? 0 : 1 },
      this.config.relayActor,
      this.config.relayKey,
    );
    const row = await this.creationOrder(reference);
    if (!row) throw new ApiError('CREATION_ORDER_PENDING', 503);
    return row;
  }
  async attestCreation(reference: string, cardReference: string, usdCents: number, paidAt: number) {
    await this.push(
      'cardcreate',
      { reference, checkout_reference: cardReference, usd_cents: usdCents, paid_at: paidAt },
      this.config.relayActor,
      this.config.relayKey,
    );
  }
  private async supportsPresets(knownActions?: readonly string[]): Promise<boolean> {
    const actions =
      knownActions ??
      (await this.api.v1.chain.get_abi(this.config.runtime)).abi?.actions.map((action) =>
        Name.from(action.name).toString(),
      ) ??
      [];
    return [
      'initgov',
      'setdaogov',
      'enrollagent',
      'addmember',
      'addsession',
      'delsession',
      'submitsess',
      'guardpause',
      'guardrevoke',
      'guardrecover',
    ].every((name) => actions.includes(name));
  }
  async tablePage<K extends keyof typeof RuntimeTableSchemas>(
    table: K,
    scope: string,
    lower = '0',
    limit = 200,
  ): Promise<{ rows: z.infer<(typeof RuntimeTableSchemas)[K]>[]; next: string | null }> {
    Uint64Schema.parse(lower);
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: this.config.runtime,
        table,
        scope,
        json: true,
        key_type: 'i64',
        lower_bound: lower,
        limit,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError('CHAIN_UNAVAILABLE', 503);
    const body = z
      .object({ rows: z.array(z.unknown()), more: z.boolean(), next_key: z.string().optional() })
      .safeParse(await response.json());
    if (!body.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    const parsed = z.array(RuntimeTableSchemas[table]).safeParse(body.data.rows);
    if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    const next = body.data.more && limit !== 1 ? Uint64Schema.safeParse(body.data.next_key) : null;
    if (next && (!next.success || BigInt(next.data) <= BigInt(lower)))
      throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return { rows: parsed.data, next: next?.success ? next.data : null };
  }
  async table<K extends keyof typeof RuntimeTableSchemas>(
    table: K,
    scope: string,
    lower = '0',
    limit = 100,
  ): Promise<z.infer<(typeof RuntimeTableSchemas)[K]>[]> {
    const first = await this.tablePage(table, scope, lower, Math.min(limit, 200));
    const rows = first.rows;
    if (limit === 1) return rows;
    let cursor = first.next;
    while (cursor !== null) {
      const page = await this.tablePage(table, scope, cursor);
      rows.push(...page.rows);
      cursor = page.next;
    }
    return rows;
  }
  private async summary(row: z.infer<typeof RuntimeTableSchemas.daos>): Promise<DaoSummary> {
    const metadata = MetadataSchema.safeParse(JSON.parse(row.metadata));
    const setup =
      metadata.success && metadata.data.schemaVersion !== 1 ? metadata.data.setup : null;
    const policy = setup
      ? (await this.table('govpolicies', this.config.runtime, row.id, 1))[0]
      : undefined;
    if (setup && (!policy || policy.dao_id !== row.id))
      throw new ApiError('DAO_POLICY_UNAVAILABLE', 503);
    const [precision, symbol] = row.token_symbol.split(',');
    return DaoSummarySchema.parse({
      reference: {
        chainId: this.config.chainId,
        contract: this.config.runtime,
        daoId: row.id,
        interfaceVersion: 1,
      },
      title: metadata.success ? metadata.data.title : `DAO ${row.id}`,
      description: metadata.success ? metadata.data.description : '',
      privacy: ['public', 'encrypted-managed-allowed', 'encrypted-user-controlled'][row.privacy],
      owner: row.owner,
      token: {
        chainId: this.config.chainId,
        contract: row.token_contract,
        symbol,
        precision: Number(precision),
      },
      members: Number(row.member_count),
      available: row.available,
      reserved: row.reserved,
      claims: row.claims,
      keyEpoch: row.key_epoch,
      purpose:
        metadata.success && metadata.data.schemaVersion !== 1 ? metadata.data.purpose : 'custom',
      participantMode: policy
        ? ['humans', 'mixed', 'agents-guarded'][policy.config.participant_mode]
        : undefined,
      setup,
      ...(metadata.success && metadata.data.schemaVersion === 3
        ? { branding: metadata.data.branding }
        : {}),
    });
  }
  async content(daoId: string, query?: ContentPageQuery): Promise<DaoContent> {
    if (query === undefined) {
      const all = await this.content(daoId, {});
      while (Object.values(all.next).some((cursor) => cursor !== null)) {
        const page = await this.content(daoId, {
          members: all.next.members ?? 'done',
          documents: all.next.documents ?? 'done',
          keyGrants: all.next.keyGrants ?? 'done',
          epochs: all.next.epochs ?? 'done',
        });
        all.members.push(...page.members);
        all.documents.push(...page.documents);
        all.keyGrants.push(...page.keyGrants);
        all.epochs.push(...page.epochs);
        all.next = page.next;
      }
      return all;
    }
    query = ContentPageQuerySchema.parse(query);
    const dao = (await this.table('daos', this.config.runtime, daoId, 1))[0];
    if (!dao || dao.id !== daoId) throw new ApiError('DAO_UNKNOWN', 404);
    const read = <K extends keyof typeof RuntimeTableSchemas>(
      table: K,
      cursor: string | undefined,
    ) =>
      cursor === 'done'
        ? Promise.resolve({ rows: [], next: null })
        : this.tablePage(table, daoId, cursor ?? '0');
    const [members, documents, keyGrants, epochs] = await Promise.all([
      read('members', query.members),
      read('documents', query.documents),
      read('keygrants', query.keyGrants),
      read('epochs', query.epochs),
    ]);
    return DaoContentSchema.parse({
      dao: {
        chainId: this.config.chainId,
        contract: this.config.runtime,
        daoId,
        interfaceVersion: 1,
      },
      members: members.rows,
      documents: documents.rows,
      keyGrants: keyGrants.rows,
      epochs: epochs.rows,
      next: {
        members: members.next,
        documents: documents.next,
        keyGrants: keyGrants.next,
        epochs: epochs.next,
      },
    });
  }
  async listDaosPage(after = '0') {
    const page = await this.tablePage('daos', this.config.runtime, after, 50);
    return { daos: await Promise.all(page.rows.map((row) => this.summary(row))), next: page.next };
  }
  async listDaos(): Promise<DaoSummary[]> {
    const page = await this.listDaosPage();
    let cursor = page.next;
    while (cursor !== null) {
      const next = await this.listDaosPage(cursor);
      page.daos.push(...next.daos);
      cursor = next.next;
    }
    return page.daos;
  }
  async governance(daoId: string): Promise<GovernanceState> {
    const dao = await this.dao(daoId);
    const [policies, actors, sessions, guardians, budgets, admission] = await Promise.all([
      this.table('govpolicies', this.config.runtime, daoId, 1),
      this.table('actors', daoId, '0', 5000),
      this.table('sessions', daoId, '0', 5000),
      this.table('guards', this.config.runtime, daoId, 1),
      this.table('budgets', this.config.runtime, daoId, 1),
      this.api.v1.chain
        .get_abi(this.config.runtime)
        .then((result) =>
          result.abi?.tables.some((table) => table.name === 'admpolicies')
            ? this.table('admpolicies', this.config.runtime, daoId, 1)
            : [],
        ),
    ]);
    return GovernanceStateSchema.parse({
      dao: dao.reference,
      policy: policies.find((row) => row.dao_id === daoId) ?? null,
      actors,
      sessions,
      guardian: guardians.find((row) => row.dao_id === daoId) ?? null,
      budget: budgets.find((row) => row.dao_id === daoId) ?? null,
      admission: admission.find((row) => row.dao_id === daoId) ?? null,
    });
  }
  async dao(daoId: string): Promise<DaoSummary> {
    const row = (await this.table('daos', this.config.runtime, daoId, 1))[0];
    if (!row || row.id !== daoId) throw new ApiError('DAO_UNKNOWN', 404);
    return this.summary(row);
  }
  async treasury(daoId: string): Promise<Treasury> {
    const dao = await this.dao(daoId);
    const abi = await this.api.v1.chain.get_abi(this.config.runtime);
    const receiptsAvailable = abi.abi?.tables.some((table) => table.name === 'receipts') === true;
    return TreasurySchema.parse({
      dao: dao.reference,
      obligations: await this.table('obligations', daoId, '0', 5000),
      evidence: evidenceForDao(await this.evidenceRows(), daoId),
      receipts: receiptsAvailable ? await this.table('receipts', daoId, '0', 5000) : [],
      receiptsAvailable,
    });
  }
  private async evidenceRows(): Promise<z.infer<typeof RuntimeTableSchemas.evidence>[]> {
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: this.config.runtime,
        table: 'evidence',
        scope: this.config.runtime,
        json: true,
        key_type: 'i64',
        lower_bound: '0',
        limit: 5000,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      if (evidenceTableMissing(body)) return [];
      throw new ApiError('CHAIN_UNAVAILABLE', 503);
    }
    const body = z
      .object({ rows: z.array(z.unknown()), more: z.boolean() })
      .parse(await response.json());
    if (body.more) throw new ApiError('RESULT_LIMIT', 413);
    const parsed = z.array(RuntimeTableSchemas.evidence).safeParse(body.rows);
    if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return parsed.data;
  }
  async settle(input: SettlementRequest): Promise<SettlementResult> {
    input = SettlementRequestSchema.parse(input);
    if (
      input.dao.chainId !== this.config.chainId ||
      input.dao.contract !== this.config.runtime ||
      input.dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE');
    const read = async () => {
      const treasury = await this.treasury(input.dao.daoId);
      const obligation = treasury.obligations.find(
        (row) => row.source === input.source && row.source_id === input.sourceId,
      );
      if (!obligation) throw new ApiError('OBLIGATION_UNKNOWN', 404);
      return obligation;
    };
    const obligation = await read();
    const payrollAccount = payrollSettlementAccount(this.config.modules, input.source);
    if (payrollAccount) {
      if (obligation.status !== 1 && obligation.status !== 2)
        throw new ApiError('OBLIGATION_NOT_PAYABLE', 409);
      const state = await this.moduleState(input.dao.daoId);
      const deployment = state.modules.find(
        (module) => module.deployment.account === payrollAccount,
      );
      if (!deployment?.codeVerified) throw new ApiError('MODULE_UNVERIFIED', 409);
      try {
        const result = await this.pushEncoded(
          payrollAccount,
          'settle',
          encodePayroll('settle', {
            runtime: this.config.runtime,
            dao_id: input.dao.daoId,
            entry_id: input.sourceId,
          }),
          this.config.relayActor,
          this.config.relayKey,
        );
        return { state: 'settled', transactionId: result.transactionId };
      } catch (cause) {
        if ((await read()).status === 2) return { state: 'already-settled' };
        throw cause;
      }
    }
    if (obligation.status === 2) return { state: 'already-settled' };
    if (obligation.status !== 1) throw new ApiError('OBLIGATION_NOT_PAYABLE', 409);
    try {
      const result = await this.push(
        'payob',
        { dao_id: input.dao.daoId, source: input.source, source_id: input.sourceId },
        this.config.relayActor,
        this.config.relayKey,
      );
      return { state: 'settled', transactionId: result.transactionId };
    } catch (cause) {
      if ((await read()).status === 2) return { state: 'already-settled' };
      throw cause;
    }
  }
  async memberships(account: Account): Promise<UserMembership[]> {
    // ponytail: scans DAOs and their paged members; add a verified membership index when measured scale requires it.
    const daos = await this.listDaos();
    const matches: UserMembership[] = [];
    const wallets = await this.linkedWallets(account.id);
    if (wallets.length) await this.checkWalletChain();
    // This read model is intentionally bounded; an indexed projection replaces scans before large deployments.
    for (const dao of daos) {
      const rows = await this.table('members', dao.reference.daoId, '0', 5000);
      const id = await this.memberIdentity(account, dao.reference.daoId, rows, wallets);
      const member = rows.find((row) => row.id === id);
      if (member) matches.push(this.membershipView(dao, member));
    }
    return matches;
  }
  private membershipView(
    dao: DaoSummary,
    member: z.infer<typeof RuntimeTableSchemas.members>,
  ): UserMembership {
    return UserMembershipSchema.parse({
      dao: dao.reference,
      memberId: member.id,
      nonce: member.nonce,
      active: member.active,
      admin: member.admin,
      reviewer: member.reviewer,
      credits: member.credits,
      claim: member.claim,
      stake: member.stake,
      nativeAccount: member.native_account,
      custody: member.custody === 0 ? 'user-controlled' : 'managed',
      signingKey: member.signing_key,
    });
  }
  private async linkedWallets(accountId: string): Promise<WalletIdentity[]> {
    if (!this.pool) return [];
    const [native, evm] = await Promise.all([
      this.pool.query<{ native_account: string }>(
        "SELECT native_account FROM native_links WHERE account_id=$1 AND chain_id=$2 AND permission='active'",
        [accountId, this.config.chainId],
      ),
      this.pool.query<{ chain_id: 40 | 41; address: string }>(
        'SELECT chain_id,address FROM evm_links WHERE account_id=$1 AND control_verified_at IS NOT NULL',
        [accountId],
      ),
    ]);
    return [
      ...native.rows.map((row): WalletIdentity => ({
        kind: 'native',
        chainId: this.config.chainId,
        account: row.native_account,
      })),
      ...evm.rows.map((row): WalletIdentity => ({
        kind: 'evm',
        chainId: row.chain_id,
        address: row.address,
      })),
    ];
  }
  private async walletMemberId(
    daoId: string,
    rows: z.infer<typeof RuntimeTableSchemas.members>[],
    wallet: WalletIdentity,
  ): Promise<string | undefined> {
    if (wallet.kind === 'native') {
      if (wallet.chainId !== this.config.chainId) throw new ApiError('CHAIN_ID_MISMATCH', 503);
      return rows.find((row) => row.native_account === wallet.account)?.id;
    }
    const bindings = await this.table('evmbindings', daoId);
    const binding = bindings.find(
      (row) =>
        row.active &&
        row.chain_id === String(wallet.chainId) &&
        row.address.toLowerCase() === wallet.address.replace(/^0x/, '').toLowerCase(),
    );
    return binding && rows.some((row) => row.id === binding.member_id)
      ? binding.member_id
      : undefined;
  }
  async walletMemberships(wallet: WalletIdentity): Promise<UserMembership[]> {
    await this.checkWalletChain();
    const matches: UserMembership[] = [];
    for (const dao of await this.listDaos()) {
      const rows = await this.table('members', dao.reference.daoId);
      const id = await this.walletMemberId(dao.reference.daoId, rows, wallet);
      const member = rows.find((row) => row.id === id);
      if (member) matches.push(this.membershipView(dao, member));
    }
    return matches;
  }
  private async checkWalletChain(): Promise<void> {
    const info = await this.api.v1.chain.get_info().catch(() => {
      throw new ApiError('CHAIN_UNAVAILABLE', 503);
    });
    if (info.chain_id.toString() !== this.config.chainId)
      throw new ApiError('CHAIN_ID_MISMATCH', 503);
  }
  private async memberIdentity(
    account: Account,
    daoId: string,
    rows: z.infer<typeof RuntimeTableSchemas.members>[],
    wallets: WalletIdentity[],
  ): Promise<string | undefined> {
    const ids = new Set(
      (await Promise.all(wallets.map((wallet) => this.walletMemberId(daoId, rows, wallet)))).filter(
        (id) => id !== undefined,
      ),
    );
    if (account.signingKey === null) {
      if (ids.size > 1) throw new ApiError('WALLET_MEMBERSHIP_CONFLICT', 409);
      return ids.values().next().value;
    }
    const root = rows.find((row) => row.signing_key === account.signingKey);
    if (!this.pool) return root?.id;
    // A recorded root-key identity survives rotation; a newly paired wallet never creates this association.
    if (root)
      await this.pool.query(
        'INSERT INTO memberships(account_id,chain_id,contract,dao_id,member_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
        [account.id, this.config.chainId, this.config.runtime, daoId, root.id],
      );
    const saved = await this.pool.query<{ member_id: string }>(
      'SELECT member_id::text FROM memberships WHERE account_id=$1 AND chain_id=$2 AND contract=$3 AND dao_id=$4',
      [account.id, this.config.chainId, this.config.runtime, daoId],
    );
    const stored = saved.rows[0]?.member_id;
    if (stored && rows.some((row) => row.id === stored)) ids.add(stored);
    if (ids.size > 1) throw new ApiError('WALLET_MEMBERSHIP_CONFLICT', 409);
    return ids.values().next().value;
  }
  async memberProfile(
    daoId: string,
    memberId: string,
  ): Promise<{ accountName: string | null; profile: string | null }> {
    IdSchema.parse(daoId);
    IdSchema.parse(memberId);
    const rows = await this.table('profiles', this.config.runtime, '0', 5000);
    const row = rows.find((item) => item.dao_id === daoId && item.member_id === memberId);
    return row
      ? { accountName: row.account_name, profile: row.profile }
      : { accountName: null, profile: null };
  }
  private async push<K extends keyof RuntimeActions>(
    name: K,
    data: RuntimeActions[K],
    actor: string,
    key: PrivateKey,
  ): Promise<{ transactionId: string }> {
    return this.pushEncoded(this.config.runtime, name, encodeAction(name, data), actor, key);
  }
  private async pushEncoded(
    account: string,
    name: string,
    data: Uint8Array,
    actor: string,
    key: PrivateKey,
  ): Promise<{ transactionId: string }> {
    await this.assertResources(actor);
    const info = await this.api.v1.chain.get_info();
    if (info.chain_id.toString() !== this.config.chainId)
      throw new ApiError('CHAIN_ID_MISMATCH', 503);
    const transaction = Transaction.from({
      ...info.getTransactionHeader(60),
      actions: [
        Action.from({ account, name, authorization: [{ actor, permission: 'active' }], data }),
      ],
    });
    const signed = SignedTransaction.from({
      ...transaction,
      signatures: [key.signDigest(transaction.signingDigest(info.chain_id))],
    });
    try {
      const result = executedChainResult(
        await this.api.v1.chain.push_transaction(signed),
        transaction.id.toString(),
      );
      await this.confirmBlock(result.blockNum);
      return { transactionId: result.transactionId };
    } catch (cause) {
      throw contractError(cause);
    }
  }
  private async confirmBlock(block: number): Promise<void> {
    if (this.config.environment === 'local') return;
    try {
      await waitForIrreversibleBlock(
        async () => {
          const info = await this.api.v1.chain.get_info();
          if (String(info.chain_id) !== this.config.chainId)
            throw new ApiError('CHAIN_ID_MISMATCH', 503);
          return Number(info.last_irreversible_block_num);
        },
        block,
        8,
      );
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw new ApiError('CHAIN_UNAVAILABLE', 503);
    }
  }
  async finalize(input: FinalizationRequest): Promise<FinalizationResult> {
    input = ModuleApiRoutes.finalize.input.parse(input);
    if (
      input.dao.chainId !== this.config.chainId ||
      input.dao.contract !== this.config.runtime ||
      input.dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE');
    const state = await this.moduleState(input.dao.daoId);
    const deployment = state.modules.find((module) => module.deployment.id === 'decide');
    if (!deployment?.codeVerified || !deployment.compatible)
      throw new ApiError('MODULE_UNVERIFIED', 409);
    const ballot = state.ballots.find((row) => row.id === input.ballotId);
    if (!ballot) throw new ApiError('BALLOT_UNKNOWN', 404);
    if (ballot.status !== 0) return { state: 'already-finalized' };
    try {
      const result = await this.pushEncoded(
        deployment.deployment.account,
        'finalize',
        encodeDecide('finalize', {
          runtime: input.dao.contract,
          dao_id: input.dao.daoId,
          ballot_id: input.ballotId,
        }),
        this.config.relayActor,
        this.config.relayKey,
      );
      return { state: 'finalized', transactionId: result.transactionId };
    } catch (cause) {
      const current = await this.moduleState(input.dao.daoId);
      if (
        current.ballots.find((row) => row.id === input.ballotId)?.status !== 0 &&
        current.ballots.some((row) => row.id === input.ballotId)
      )
        return { state: 'already-finalized' };
      throw cause;
    }
  }
  async validateCreation(input: z.infer<typeof CreateDaoSchema>): Promise<void> {
    input = CreateDaoSchema.parse(input);
    if (input.token.chainId !== this.config.chainId) throw new ApiError('ASSET_CHAIN_MISMATCH');
    const guardian = input.setup?.governance.guardian;
    if (guardian) {
      const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_account`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account_name: guardian }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new ApiError('POLICY_GUARDIAN', 409);
      const account = z
        .object({ account_name: NativeAccountSchema })
        .safeParse(await response.json());
      if (!account.success || account.data.account_name !== guardian)
        throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    }
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: input.token.contract,
        scope: input.token.symbol,
        table: 'stat',
        json: true,
        limit: 2,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError('ASSET_UNAVAILABLE', 409);
    const stat = z
      .object({
        rows: z.array(z.object({ supply: z.string(), issuer: NativeAccountSchema })),
        more: z.boolean(),
      })
      .safeParse(await response.json());
    const row =
      stat.success && !stat.data.more && stat.data.rows.length === 1
        ? stat.data.rows[0]
        : undefined;
    const quantity = row?.supply.match(/^(0|[1-9][0-9]*)(?:\.([0-9]+))? ([A-Z]{1,7})$/);
    if (
      !quantity ||
      quantity[3] !== input.token.symbol ||
      (quantity[2]?.length ?? 0) !== input.token.precision
    )
      throw new ApiError('ASSET_UNAVAILABLE', 409);
  }
  async createDao(
    account: Account,
    input: z.infer<typeof CreateDaoSchema>,
    paid?: { reference: string; daoId: string },
  ): Promise<DaoSummary> {
    if (account.signingKey === null) throw new ApiError('VAULT_IDENTITY_REQUIRED', 409);
    await this.validateCreation(input);
    const bootstrap = this.config.bootstrap;
    if (!bootstrap) throw new ApiError('DAO_CREATION_UNAVAILABLE', 503);
    if (input.token.chainId !== this.config.chainId) throw new ApiError('ASSET_CHAIN_MISMATCH');
    if (
      !input.foundingAgent &&
      input.privacy === 'encrypted-user-controlled' &&
      account.custody === 'managed'
    )
      throw new ApiError('CUSTODY_POLICY', 403);
    const setup = input.setup;
    const preset = setup
      ? DaoPresets.find(
          (preset) => preset.id === setup.presetId && preset.version === setup.presetVersion,
        )
      : undefined;
    const installations: RuntimeActions['setmodule'][] = [];
    const decide = this.config.modules?.find((module) => module.id === 'decide');
    if (setup) {
      if (!preset || !decide) throw new ApiError('PRESET_MODULE_UNAVAILABLE', 503);
      if (!(await this.supportsPresets())) throw new ApiError('DAO_POLICY_UNAVAILABLE', 503);
      for (const id of preset.modules) {
        const deployment = this.config.modules?.find((module) => module.id === id);
        if (!deployment) throw new ApiError('PRESET_MODULE_UNAVAILABLE', 503);
        const response = await fetch(this.config.rpcUrl + '/v1/chain/get_code_hash', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ account_name: deployment.account }),
          signal: AbortSignal.timeout(10000),
        });
        const hash = response.ok
          ? z.object({ code_hash: ChainIdSchema }).safeParse(await response.json())
          : undefined;
        if (!hash?.success || hash.data.code_hash !== ModuleCodeHashes[deployment.id])
          throw new ApiError('MODULE_UNVERIFIED', 409);
        const permissions = ModulePermissions[deployment.id];
        installations.push({
          dao_id: '0',
          account: deployment.account,
          version: 1,
          actions: [...permissions.actions],
          grants: [...permissions.grants],
          code_hash: hash.data.code_hash,
        });
      }
    }
    const id = paid
      ? IdSchema.parse(paid.daoId)
      : BigInt(`0x${randomBytes(8).toString('hex')}`).toString();
    if (id === '0') throw new ApiError('DAO_ID_RETRY', 503);
    const info = await this.api.v1.chain.get_info();
    if (info.chain_id.toString() !== this.config.chainId)
      throw new ApiError('CHAIN_ID_MISMATCH', 503);
    const actions = [
      Action.from({
        account: this.config.runtime,
        name: paid ? 'createpaid' : 'createdao',
        authorization: [
          { actor: bootstrap.owner, permission: 'active' },
          ...(paid && this.config.relayActor !== bootstrap.owner
            ? [{ actor: this.config.relayActor, permission: 'active' }]
            : []),
        ],
        data: encodeAction(paid ? 'createpaid' : 'createdao', {
          ...(paid ? { reference: paid.reference, creator: account.signingKey } : {}),
          dao_id: id,
          owner: bootstrap.owner,
          metadata: JSON.stringify(
            setup
              ? {
                  schemaVersion: 2,
                  title: input.metadata.title,
                  description: input.metadata.description,
                  purpose: setup.presetId,
                  setup,
                }
              : input.metadata,
          ),
          privacy:
            input.privacy === 'public' ? 0 : input.privacy === 'encrypted-managed-allowed' ? 1 : 2,
          token_contract: input.token.contract,
          token_symbol: `${input.token.precision},${input.token.symbol}`,
        }),
      }),
      Action.from({
        account: this.config.runtime,
        name: 'enroll',
        authorization: [{ actor: bootstrap.owner, permission: 'active' }],
        data: encodeAction('enroll', {
          dao_id: id,
          member_id: '1',
          native_account: '',
          signing_key: account.signingKey,
          encryption_key: JSON.stringify(account.encryptionKey),
          custody: account.custody === 'managed' ? 1 : 0,
        }),
      }),
    ];
    if (setup && decide) {
      actions.splice(
        1,
        0,
        Action.from({
          account: this.config.runtime,
          name: 'initgov',
          authorization: [{ actor: bootstrap.owner, permission: 'active' }],
          data: encodeAction('initgov', {
            dao_id: id,
            settings: governanceSettings(setup, decide.account),
          }),
        }),
      );
      if (input.foundingAgent) {
        actions[2] = Action.from({
          account: this.config.runtime,
          name: 'enrollagent',
          authorization: [{ actor: bootstrap.owner, permission: 'active' }],
          data: encodeAction('enrollagent', {
            dao_id: id,
            member_id: '1',
            native_account: '',
            signing_key: input.foundingAgent.signingKey,
            encryption_key: JSON.stringify(input.foundingAgent.encryptionKey),
            custody: 0,
            operator_label: input.foundingAgent.operator,
          }),
        });
      }
      for (const installation of installations)
        actions.push(
          Action.from({
            account: this.config.runtime,
            name: 'setmodule',
            authorization: [{ actor: bootstrap.owner, permission: 'active' }],
            data: encodeAction('setmodule', { ...installation, dao_id: id }),
          }),
        );
    }
    const transaction = Transaction.from({ ...info.getTransactionHeader(60), actions });
    await this.assertResources(bootstrap.owner);
    try {
      const result = await this.api.v1.chain.push_transaction(
        SignedTransaction.from({
          ...transaction,
          signatures: [
            bootstrap.key.signDigest(transaction.signingDigest(info.chain_id)),
            ...(paid && this.config.relayActor !== bootstrap.owner
              ? [this.config.relayKey.signDigest(transaction.signingDigest(info.chain_id))]
              : []),
          ],
        }),
      );
      await this.confirmBlock(executedChainResult(result, transaction.id.toString()).blockNum);
    } catch (cause) {
      throw contractError(cause);
    }
    const row = (await this.table('daos', this.config.runtime, id, 1))[0];
    if (!row || row.id !== id) throw new ApiError('CHAIN_UNAVAILABLE', 503);
    return this.summary(row);
  }
  async execute(input: ExecutionRequest): Promise<ExecutionResult> {
    if (
      input.dao.chainId !== this.config.chainId ||
      input.dao.contract !== this.config.runtime ||
      input.dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE');
    const state = await this.moduleState(input.dao.daoId);
    const deployment = state.modules.find((module) => module.deployment.id === 'decide');
    if (!deployment?.compatible || !deployment.codeVerified)
      throw new ApiError('MODULE_UNVERIFIED', 409);
    input = ModuleApiRoutes.execute.input.parse(input);
    const awardPlan = state.grantPlans.find((plan) => plan.ballot_id === input.ballotId);
    const plan = awardPlan ?? state.executions.find((plan) => plan.ballot_id === input.ballotId);
    if (!plan) throw new ApiError('EXECUTION_UNKNOWN', 404);
    if (plan.executed) return { state: 'already-executed' };
    const ballot = state.ballots.find((ballot) => ballot.id === input.ballotId);
    if (ballot?.status !== 1) throw new ApiError('BALLOT_NOT_PASSED', 409);
    try {
      const result = await this.pushEncoded(
        deployment.deployment.account,
        awardPlan ? 'executeaward' : 'execute',
        encodeDecide(awardPlan ? 'executeaward' : 'execute', {
          runtime: input.dao.contract,
          dao_id: input.dao.daoId,
          ballot_id: input.ballotId,
        }),
        this.config.relayActor,
        this.config.relayKey,
      );
      return { state: 'executed', transactionId: result.transactionId };
    } catch (cause) {
      const current = await this.moduleState(input.dao.daoId);
      if (
        [...current.executions, ...current.grantPlans].some(
          (plan) => plan.ballot_id === input.ballotId && plan.executed,
        )
      )
        return { state: 'already-executed' };
      throw cause;
    }
  }
  private async moduleRows<T>(
    account: string,
    table: string,
    schema: z.ZodType<T>,
    lower: string,
    upper: string,
    index = 1,
    keyType = 'i64',
    limit = 200,
  ): Promise<{ rows: T[]; more: boolean }> {
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: account,
        table,
        scope: this.config.runtime,
        json: true,
        limit,
        index_position: index,
        key_type: keyType,
        lower_bound: lower,
        upper_bound: upper,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError('CHAIN_UNAVAILABLE', 503);
    const parsed = z
      .object({ rows: z.array(schema), more: z.boolean() })
      .safeParse(await response.json());
    if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return parsed.data;
  }
  private async modulePage<T extends { id: string; dao_id: string }>(
    account: string,
    table: string,
    schema: z.ZodType<T>,
    daoId: string,
    cursor: string | undefined,
  ) {
    if (cursor === 'done') return { rows: [], next: null };
    // ponytail: continuation scans shared primary rows in bounded pages; migrate a DAO/id composite index if this becomes costly.
    const first = !cursor || cursor === '0';
    const page = await this.moduleRows(
      account,
      table,
      schema,
      first ? daoId : cursor,
      first ? daoId : ((1n << 64n) - 1n).toString(),
      first ? 2 : 1,
      'i64',
      first ? 50 : 200,
    );
    const last = page.rows.at(-1);
    if (
      (page.more && !last) ||
      (!first && page.rows.some((row) => BigInt(row.id) < BigInt(cursor)))
    )
      throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    const next =
      page.more && last && BigInt(last.id) < (1n << 64n) - 1n
        ? (BigInt(last.id) + 1n).toString()
        : null;
    return { rows: page.rows.filter((row) => row.dao_id === daoId), next };
  }
  async moduleState(daoId: string, query?: ModulePageQuery): Promise<ModuleState> {
    if (query === undefined) {
      const all = await this.moduleState(daoId, {});
      while (Object.values(all.next).some((cursor) => cursor !== null)) {
        const page = await this.moduleState(daoId, {
          ballots: all.next.ballots ?? 'done',
          projects: all.next.projects ?? 'done',
          schedules: all.next.schedules ?? 'done',
          rounds: all.next.rounds ?? 'done',
          applications: all.next.applications ?? 'done',
          joinApplications: all.next.joinApplications ?? 'done',
          elections: all.next.elections ?? 'done',
          terms: all.next.terms ?? 'done',
        });
        all.ballots.push(...page.ballots);
        all.votes.push(...page.votes);
        all.projects.push(...page.projects);
        all.milestones.push(...page.milestones);
        all.agreements.push(...page.agreements);
        all.schedules.push(...page.schedules);
        all.entries.push(...page.entries);
        all.controls.push(...page.controls);
        all.executions.push(...page.executions);
        all.grantPlans.push(...page.grantPlans);
        all.rounds.push(...page.rounds);
        all.applications.push(...page.applications);
        all.joinApplications.push(...page.joinApplications);
        all.elections.push(...page.elections);
        all.nominations.push(...page.nominations);
        all.terms.push(...page.terms);
        all.next = page.next;
      }
      return all;
    }
    query = ModulePageQuerySchema.parse(query);
    const next: ModuleState['next'] = {
      ballots: null,
      projects: null,
      schedules: null,
      rounds: null,
      applications: null,
      joinApplications: null,
      elections: null,
      terms: null,
    };
    const dao = (await this.table('daos', this.config.runtime, daoId, 1))[0];
    if (!dao || dao.id !== daoId) throw new ApiError('DAO_UNKNOWN', 404);
    const installed = await this.table('modules', daoId, '0', 100);
    const states: ModuleState['modules'] = [];
    let ballots: ModuleState['ballots'] = [];
    let votes: ModuleState['votes'] = [];
    let projects: ModuleState['projects'] = [];
    let milestones: ModuleState['milestones'] = [];
    let agreements: ModuleState['agreements'] = [];
    let schedules: ModuleState['schedules'] = [];
    let entries: ModuleState['entries'] = [];
    let controls: ModuleState['controls'] = [];
    let executions: ModuleState['executions'] = [];
    let elections: ModuleState['elections'] = [],
      nominations: ModuleState['nominations'] = [],
      terms: ModuleState['terms'] = [];
    let joinApplications: ModuleState['joinApplications'] = [];
    let grantPlans: ModuleState['grantPlans'] = [],
      rounds: ModuleState['rounds'] = [],
      applications: ModuleState['applications'] = [];
    for (const deployment of this.config.modules ?? []) {
      NativeAccountSchema.parse(deployment.account);
      const manifest = Catalog.find((item) => item.id === deployment.id);
      if (!manifest) throw new ApiError('MODULE_UNSUPPORTED');
      const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_code_hash`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account_name: deployment.account }),
        signal: AbortSignal.timeout(10000),
      });
      const hash = response.ok
        ? z.object({ code_hash: ChainIdSchema }).safeParse(await response.json())
        : undefined;
      const verified =
        hash?.success === true && hash.data.code_hash === ModuleCodeHashes[deployment.id];
      const enabled = installed.find((item) => item.account === deployment.account);
      const pinned =
        !enabled ||
        (enabled.actions.length === 0 && enabled.grants.length === 0) ||
        (hash?.success === true && enabled.code_hash === hash.data.code_hash);
      states.push({
        deployment: {
          id: deployment.id,
          account: deployment.account,
          version: MODULE_VERSION,
          codeHash: ModuleCodeHashes[deployment.id],
        },
        manifest,
        enabled: !!enabled && enabled.actions.length > 0,
        installed: !!enabled,
        compatible:
          compatible(VERSION, manifest.coreRange) &&
          (!enabled || enabled.version === manifest.interfaceVersion),
        codeVerified: verified && pinned,
        actions: enabled?.actions ?? [],
        grants: enabled?.grants ?? [],
      });
      if (!verified) continue;
      if (!enabled) continue;
      if (deployment.id === 'decide') {
        const electionPage = await this.modulePage(
          deployment.account,
          'elections',
          DecideTableSchemas.elections,
          daoId,
          query.elections,
        );
        elections = electionPage.rows;
        next.elections = electionPage.next;
        const termPage = await this.modulePage(
          deployment.account,
          'terms',
          DecideTableSchemas.terms,
          daoId,
          query.terms,
        );
        terms = termPage.rows;
        next.terms = termPage.next;
        for (const election of elections) {
          const nominees = await this.moduleRows(
            deployment.account,
            'nominations',
            DecideTableSchemas.nominations,
            election.id,
            election.id,
            3,
            'i64',
            15,
          );
          nominations.push(
            ...nominees.rows.filter((n) => n.dao_id === daoId && n.election_id === election.id),
          );
        }
        const page = await this.modulePage(
          deployment.account,
          'ballots',
          DecideTableSchemas.ballots,
          daoId,
          query.ballots,
        );
        ballots = page.rows;
        next.ballots = page.next;
        for (const ballot of ballots) {
          const plan = await this.moduleRows(
            deployment.account,
            'executions',
            DecideTableSchemas.executions,
            ballot.id,
            ballot.id,
            1,
            'i64',
            1,
          );
          executions.push(
            ...plan.rows.filter((row) => row.ballot_id === ballot.id && row.dao_id === daoId),
          );
          const award = await this.moduleRows(
            deployment.account,
            'grantplans',
            DecideTableSchemas.grantplans,
            ballot.id,
            ballot.id,
            1,
            'i64',
            1,
          );
          grantPlans.push(
            ...award.rows.filter((row) => row.ballot_id === ballot.id && row.dao_id === daoId),
          );
          if (query.memberId) {
            const key = ((BigInt(ballot.id) << 64n) | BigInt(query.memberId)).toString();
            const page = await this.moduleRows(
              deployment.account,
              'votes',
              DecideTableSchemas.votes,
              key,
              key,
              2,
              'i128',
              1,
            );
            votes.push(
              ...page.rows.filter(
                (row) => row.ballot === ballot.id && row.member === query.memberId,
              ),
            );
          }
        }
      }
      if (deployment.id === 'works') {
        const page = await this.modulePage(
          deployment.account,
          'projects',
          WorksTableSchemas.projects,
          daoId,
          query.projects,
        );
        projects = page.rows;
        next.projects = page.next;
        for (const project of projects) {
          const consent = await this.moduleRows(
            deployment.account,
            'agreements',
            WorksTableSchemas.agreements,
            project.id,
            project.id,
            1,
            'i64',
            1,
          );
          agreements.push(
            ...consent.rows.filter((row) => row.dao_id === daoId && row.project_id === project.id),
          );
          const items = await this.moduleRows(
            deployment.account,
            'milestones',
            WorksTableSchemas.milestones,
            project.id,
            project.id,
            2,
            'i64',
            16,
          );
          milestones.push(
            ...items.rows.filter((row) => row.project_id === project.id && row.dao_id === daoId),
          );
        }
      }
      if (deployment.id === 'endorsement-admission') {
        const page = await this.modulePage(
          deployment.account,
          'joinapps',
          EndorseTableSchemas.joinapps,
          daoId,
          query.joinApplications,
        );
        joinApplications = page.rows;
        next.joinApplications = page.next;
      }
      if (deployment.id === 'grants-rounds') {
        const r = await this.modulePage(
          deployment.account,
          'rounds',
          GrantsTableSchemas.rounds,
          daoId,
          query.rounds,
        );
        rounds = r.rows;
        next.rounds = r.next;
        const a = await this.modulePage(
          deployment.account,
          'applications',
          GrantsTableSchemas.applications,
          daoId,
          query.applications,
        );
        applications = a.rows;
        next.applications = a.next;
      }
      if (deployment.id === 'payroll') {
        const page = await this.modulePage(
          deployment.account,
          'schedules',
          PayrollTableSchemas.schedules,
          daoId,
          query.schedules,
        );
        schedules = page.rows;
        next.schedules = page.next;
        for (const schedule of schedules) {
          const items = await this.moduleRows(
            deployment.account,
            'entries',
            PayrollTableSchemas.entries,
            schedule.id,
            schedule.id,
            2,
            'i64',
            12,
          );
          entries.push(
            ...items.rows.filter((row) => row.schedule_id === schedule.id && row.dao_id === daoId),
          );
          const flags = await this.moduleRows(
            deployment.account,
            'controls',
            PayrollTableSchemas.controls,
            schedule.id,
            schedule.id,
            1,
            'i64',
            1,
          );
          controls.push(...flags.rows.filter((row) => row.schedule_id === schedule.id));
        }
      }
    }
    return ModuleStateSchema.parse({
      dao: {
        chainId: this.config.chainId,
        contract: this.config.runtime,
        daoId,
        interfaceVersion: 1,
      },
      modules: states,
      next,
      ballots,
      votes,
      projects,
      milestones,
      agreements,
      schedules,
      entries,
      controls,
      executions,
      grantPlans,
      rounds,
      applications,
      joinApplications,
      elections,
      nominations,
      terms,
    });
  }
  private async assertResources(account: string): Promise<void> {
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_account`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_name: account }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError('CHAIN_UNAVAILABLE', 503);
    const parsed = AccountResourceSchema.safeParse(await response.json());
    if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    if (
      !resourcesAcceptable({
        cpuAvailable: parsed.data.cpu_limit.available,
        netAvailable: parsed.data.net_limit.available,
        ramQuota: parsed.data.ram_quota,
        ramUsage: parsed.data.ram_usage,
      })
    )
      throw new ApiError('RELAY_RESOURCES', 503);
  }
  async relay(
    account: Account,
    request: instruction,
    signature: string,
    sessionId?: string,
  ): Promise<{ transactionId: string }> {
    if (account.signingKey === null) throw new ApiError('VAULT_IDENTITY_REQUIRED', 409);
    if (request.chain_id !== this.config.chainId || request.deployment !== this.config.runtime)
      throw new ApiError('INSTRUCTION_DOMAIN');
    let valid = false;
    try {
      valid = Signature.from(signature).verifyDigest(
        instructionDigest(request),
        PublicKey.from(account.signingKey),
      );
    } catch {
      valid = false;
    }
    if (!valid) throw new ApiError('SIGNATURE_INVALID', 403);
    const member = (await this.table('members', request.dao_id, request.member_id, 1))[0];
    if (!member || member.id !== request.member_id) throw new ApiError('MEMBERSHIP_REQUIRED', 403);
    if (sessionId !== undefined) {
      IdSchema.parse(sessionId);
      const credential = (await this.table('sessions', request.dao_id, sessionId, 1))[0];
      if (
        !credential ||
        credential.id !== sessionId ||
        credential.member_id !== request.member_id ||
        credential.signing_key !== account.signingKey
      )
        throw new ApiError('MEMBERSHIP_REQUIRED', 403);
      return this.push(
        'submitsess',
        { request, session_id: sessionId, sig: signature },
        this.config.relayActor,
        this.config.relayKey,
      );
    }
    if (member.signing_key !== account.signingKey) throw new ApiError('MEMBERSHIP_REQUIRED', 403);
    return this.push(
      'submit',
      { request, sig: signature },
      this.config.relayActor,
      this.config.relayKey,
    );
  }
  async evmBinding(daoId: string, memberId: string) {
    IdSchema.parse(daoId);
    IdSchema.parse(memberId);
    const abi = await this.api.v1.chain.get_abi(this.config.runtime);
    if (!abi.abi?.tables.some((table) => table.name === 'evmbindings')) return null;
    const record = (await this.table('evmbindings', daoId, memberId, 1))[0];
    return record?.member_id === memberId ? record : null;
  }
  async relayEvm(account: Account, input: EvmRelay): Promise<{ transactionId: string }> {
    const request = input.request;
    if (request.chain_id !== this.config.chainId || request.deployment !== this.config.runtime)
      throw new ApiError('INSTRUCTION_DOMAIN');
    const member = (await this.table('members', request.dao_id, request.member_id, 1))[0];
    if (
      !member ||
      member.id !== request.member_id ||
      (await this.memberIdentity(
        account,
        request.dao_id,
        [member],
        await this.linkedWallets(account.id),
      )) !== request.member_id
    )
      throw new ApiError('MEMBERSHIP_REQUIRED', 403);
    const binding = await this.evmBinding(request.dao_id, request.member_id);
    if (
      !binding?.active ||
      binding.chain_id !== input.evm_chain_id ||
      binding.address !== input.address ||
      binding.epoch !== input.binding_epoch
    )
      throw new ApiError('EVM_BINDING', 409);
    const chainId = Number(binding.chain_id);
    if (chainId !== 40 && chainId !== 41) throw new ApiError('EVM_CHAIN_INVALID', 400);
    try {
      const signature = canonicalEvmSignature(`0x${input.proof}`);
      const typed = governanceTypedData(request, {
        chainId,
        address: `0x${binding.address}`,
        epoch: binding.epoch,
      });
      if (recoverEvmDigest(evmTypedDigest(typed), signature) !== `0x${binding.address}`)
        throw new Error('Signature mismatch');
    } catch {
      throw new ApiError('EVM_SIGNATURE_INVALID', 401);
    }
    return this.push('submitevm', input, this.config.relayActor, this.config.relayKey);
  }
  marketplace() {
    return readMarketplace(this.config.rpcUrl, this.config.runtime);
  }
  nameService() {
    return readNameService(this.config.rpcUrl, this.config.runtime);
  }
  async nameQuote(accountName: string): Promise<NameQuote> {
    const name = TelosNameSchema.parse(accountName);
    const service = await this.nameService();
    if (
      !service.configured ||
      !service.treasury ||
      service.thirdPartyBps === null ||
      service.firstPartyBps === null ||
      service.bumpBps === null ||
      service.quotePremiumBps === null
    ) {
      throw new ApiError('NAMES_UNCONFIGURED', 503);
    }
    if (await this.nativeAccountExists(name)) throw new ApiError('NAME_TAKEN', 409);
    const namesAccount = await this.namesAccount();
    if (await this.saleForName(namesAccount, name)) throw new ApiError('NAME_SOLD', 409);
    const policy: NamePolicy = {
      bumpBps: service.bumpBps,
      quotePremiumBps: service.quotePremiumBps,
      median: service.oracleMedian ? BigInt(service.oracleMedian) : 0n,
      quotedPrecision: service.oraclePrecision ?? 4,
      observedAt: service.oracleObservedAt ?? 0,
    };
    try {
      return quoteName({
        accountName: name,
        tiers: service.tiers,
        listings: service.listings,
        suffixes: service.suffixes,
        policy,
        treasury: service.treasury,
        thirdPartyBps: service.thirdPartyBps,
        firstPartyBps: service.firstPartyBps,
      });
    } catch (error) {
      if (error instanceof MarketRuleError) throw new ApiError(error.code, 409);
      throw error;
    }
  }
  async fulfillName(purchase: NamePurchase): Promise<void> {
    const namesAccount = await this.namesAccount();
    if (await this.saleForReference(namesAccount, purchase.reference)) return;
    const quote = await this.nameQuote(purchase.accountName);
    if (quote.usdCents !== purchase.usdCents || quote.usdCents < 1) {
      throw new ApiError('NAME_PRICE', 409);
    }
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_abi`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_name: namesAccount }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json().catch(() => undefined);
    const abiValue = z.object({ abi: z.unknown() }).safeParse(body);
    if (
      !response.ok ||
      !abiValue.success ||
      typeof abiValue.data.abi !== 'object' ||
      abiValue.data.abi === null
    ) {
      throw new ApiError('NAMES_UNCONFIGURED', 503);
    }
    const data = Serializer.encode({
      abi: ABI.from(JSON.stringify(abiValue.data.abi)),
      type: 'fulfill',
      object: {
        settler: this.config.relayActor,
        account_name: purchase.accountName,
        owner_key: purchase.ownerKey,
        active_key: purchase.activeKey,
        usd_cents: purchase.usdCents,
        reference: purchase.reference,
      },
    }).array;
    try {
      await this.pushEncoded(
        namesAccount,
        'fulfill',
        data,
        this.config.relayActor,
        this.config.relayKey,
      );
    } catch (error) {
      if (await this.saleForReference(namesAccount, purchase.reference)) return;
      if (error instanceof ApiError && error.code !== 'CHAIN_ACTION_REJECTED') throw error;
      throw new ApiError('CHAIN_UNAVAILABLE', 503);
    }
  }
  private async namesAccount(): Promise<string> {
    const fees = await loadFees(this.config.rpcUrl, this.config.runtime);
    if (!fees?.names) throw new ApiError('NAMES_UNCONFIGURED', 503);
    return fees.names;
  }
  private async nativeAccountExists(account: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_account`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account_name: account }),
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      throw new ApiError('CHAIN_UNAVAILABLE', 503);
    }
  }
  private async saleForName(names: string, accountName: string): Promise<boolean> {
    const table = await readChainRows({
      rpcUrl: this.config.rpcUrl,
      code: names,
      scope: names,
      table: 'sales',
      limit: 1,
      indexPosition: 2,
      keyType: 'name',
      lowerBound: accountName,
      upperBound: accountName,
    });
    return table.rows.some((row) => {
      const parsed = z.object({ account_name: z.string() }).safeParse(row);
      return parsed.success && parsed.data.account_name === accountName;
    });
  }
  private async saleForReference(names: string, reference: string): Promise<boolean> {
    const table = await readChainRows({
      rpcUrl: this.config.rpcUrl,
      code: names,
      scope: names,
      table: 'sales',
      limit: 1,
      indexPosition: 3,
      keyType: 'sha256',
      lowerBound: reference,
      upperBound: reference,
    });
    return table.rows.some((row) => {
      const parsed = z.object({ reference: z.string() }).safeParse(row);
      return parsed.success && parsed.data.reference === reference;
    });
  }
}
