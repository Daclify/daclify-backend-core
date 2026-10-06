import { DaoContentSchema, type DaoContent } from '../../../protocol/content.js';
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
} from '@wharfkit/antelope';
import {
  Catalog,
  ModulePermissions,
  ModuleApiRoutes,
  ModuleStateSchema,
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
} from '@daclify/modules/sdk';
import { AccountResourceSchema, resourcesAcceptable } from './deployment-check.js';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  DaoSummarySchema,
  NetworkSchema,
  UserMembershipSchema,
  type Account,
  type DaoSummary,
  type Network,
  type UserMembership,
  type CreateDaoSchema,
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
import { ApiError } from './errors.js';
import {
  ChainPlatformSchema,
  ContractStatusSchema,
  type ChainPlatform,
} from '../../../protocol/platform.js';
import type { NamePurchase } from './billing/name.js';
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
  constructor(private readonly config: NativeChainConfig) {
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
  async network(): Promise<Network> {
    const presets = await this.supportsPresets();
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
        ...(this.config.bootstrap ? ['shared-dao-create'] : []),
        ...(presets ? ['dao-presets', 'guarded-agents', 'governance-policy'] : []),
      ],
    });
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
    const [fees, market, creation, runtimeSettings, catalogue] = await Promise.all([
      optional(this, 'feecfg'),
      optional(this, 'mktcfg'),
      optional(this, 'createcfg'),
      optional(this, 'settings'),
      abi.abi?.tables.some((t) => t.name === 'catalogue')
        ? this.table('catalogue', this.config.runtime)
        : [],
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
        const data = await this.api.v1.chain.get_account(account);
        return ContractStatusSchema.parse({
          account,
          moduleId: expectedHash?.id ?? null,
          codeHash: hash,
          expectedHash: expectedHash ? ModuleCodeHashes[expectedHash.id] : null,
          verified: !!expectedHash && hash === ModuleCodeHashes[expectedHash.id],
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
  async orderCreation(reference: string, creator: string, method: 'card' | 'tlos') {
    const existing = await this.creationOrder(reference);
    if (existing) return existing;
    await this.push(
      'ordercreate',
      { reference, creator, deployment: 0, method: method === 'tlos' ? 0 : 1 },
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
  private async supportsPresets(): Promise<boolean> {
    const { abi } = await this.api.v1.chain.get_abi(this.config.runtime);
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
    ].every((name) => abi?.actions.some((action) => action.name === name));
  }
  async table<K extends keyof typeof RuntimeTableSchemas>(
    table: K,
    scope: string,
    lower = '0',
    limit = 100,
  ): Promise<z.infer<(typeof RuntimeTableSchemas)[K]>[]> {
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
      .parse(await response.json());
    if (body.more && limit !== 1) throw new ApiError('RESULT_LIMIT', 413);
    const parsed = z.array(RuntimeTableSchemas[table]).safeParse(body.rows);
    if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return parsed.data;
  }
  private async summary(row: z.infer<typeof RuntimeTableSchemas.daos>): Promise<DaoSummary> {
    const metadata = MetadataSchema.safeParse(JSON.parse(row.metadata));
    const setup =
      metadata.success && metadata.data.schemaVersion === 2 ? metadata.data.setup : null;
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
        metadata.success && metadata.data.schemaVersion === 2 ? metadata.data.purpose : 'custom',
      participantMode: policy
        ? ['humans', 'mixed', 'agents-guarded'][policy.config.participant_mode]
        : undefined,
      setup,
    });
  }
  async content(daoId: string): Promise<DaoContent> {
    const dao = (await this.table('daos', this.config.runtime, daoId, 1))[0];
    if (!dao || dao.id !== daoId) throw new ApiError('DAO_UNKNOWN', 404);
    const [members, documents, keyGrants, epochs] = await Promise.all([
      this.table('members', daoId, '0', 5000),
      this.table('documents', daoId, '0', 1000),
      this.table('keygrants', daoId, '0', 1000),
      this.table('epochs', daoId, '0', 1000),
    ]);
    return DaoContentSchema.parse({
      dao: {
        chainId: this.config.chainId,
        contract: this.config.runtime,
        daoId,
        interfaceVersion: 1,
      },
      members,
      documents,
      keyGrants,
      epochs,
    });
  }
  async listDaos(): Promise<DaoSummary[]> {
    return Promise.all(
      (await this.table('daos', this.config.runtime, '0', 500)).map((row) => this.summary(row)),
    );
  }
  async governance(daoId: string): Promise<GovernanceState> {
    const dao = await this.dao(daoId);
    // ponytail: 5,000 credentials per snapshot; add pagination before supporting larger DAO credential sets.
    const [policies, actors, sessions, guardians, budgets] = await Promise.all([
      this.table('govpolicies', this.config.runtime, daoId, 1),
      this.table('actors', daoId, '0', 5000),
      this.table('sessions', daoId, '0', 5000),
      this.table('guards', this.config.runtime, daoId, 1),
      this.table('budgets', this.config.runtime, daoId, 1),
    ]);
    return GovernanceStateSchema.parse({
      dao: dao.reference,
      policy: policies.find((row) => row.dao_id === daoId) ?? null,
      actors,
      sessions,
      guardian: guardians.find((row) => row.dao_id === daoId) ?? null,
      budget: budgets.find((row) => row.dao_id === daoId) ?? null,
    });
  }
  async dao(daoId: string): Promise<DaoSummary> {
    const row = (await this.table('daos', this.config.runtime, daoId, 1))[0];
    if (!row || row.id !== daoId) throw new ApiError('DAO_UNKNOWN', 404);
    return this.summary(row);
  }
  async treasury(daoId: string): Promise<Treasury> {
    const dao = await this.dao(daoId);
    return TreasurySchema.parse({
      dao: dao.reference,
      obligations: await this.table('obligations', daoId, '0', 5000),
      evidence: evidenceForDao(await this.evidenceRows(), daoId),
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
    const daos = await this.listDaos();
    const matches: UserMembership[] = [];
    // This read model is intentionally bounded; an indexed projection replaces scans before large deployments.
    for (const dao of daos) {
      const rows = await this.table('members', dao.reference.daoId, '0', 5000);
      const member = rows.find((row) => row.signing_key === account.signingKey);
      if (member)
        matches.push(
          UserMembershipSchema.parse({
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
          }),
        );
    }
    return matches;
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
      const result = await this.api.v1.chain.push_transaction(signed);
      return {
        transactionId: z
          .string()
          .regex(/^[0-9a-f]{64}$/)
          .parse(result.transaction_id),
      };
    } catch {
      throw new ApiError('CHAIN_ACTION_REJECTED', 409);
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
  async createDao(
    account: Account,
    input: z.infer<typeof CreateDaoSchema>,
    paid?: { reference: string; daoId: string },
  ): Promise<DaoSummary> {
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
      await this.api.v1.chain.push_transaction(
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
    } catch {
      throw new ApiError('CHAIN_ACTION_REJECTED', 409);
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
    const plan = state.executions.find((plan) => plan.ballot_id === input.ballotId);
    if (!plan) throw new ApiError('EXECUTION_UNKNOWN', 404);
    if (plan.executed) return { state: 'already-executed' };
    const ballot = state.ballots.find((ballot) => ballot.id === input.ballotId);
    if (ballot?.status !== 1) throw new ApiError('BALLOT_NOT_PASSED', 409);
    try {
      const result = await this.pushEncoded(
        deployment.deployment.account,
        'execute',
        encodeDecide('execute', {
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
      if (current.executions.some((plan) => plan.ballot_id === input.ballotId && plan.executed))
        return { state: 'already-executed' };
      throw cause;
    }
  }
  private async moduleRows<T>(account: string, table: string, schema: z.ZodType<T>): Promise<T[]> {
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: account,
        table,
        scope: this.config.runtime,
        json: true,
        limit: 1000,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError('CHAIN_UNAVAILABLE', 503);
    const body = z
      .object({ rows: z.array(z.unknown()), more: z.boolean() })
      .parse(await response.json());
    if (body.more) throw new ApiError('RESULT_LIMIT', 413);
    const parsed = z.array(schema).safeParse(body.rows);
    if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return parsed.data;
  }
  async moduleState(daoId: string): Promise<ModuleState> {
    const dao = (await this.table('daos', this.config.runtime, daoId, 1))[0];
    if (!dao || dao.id !== daoId) throw new ApiError('DAO_UNKNOWN', 404);
    const installed = await this.table('modules', daoId, '0', 100);
    const states: ModuleState['modules'] = [];
    let ballots: ModuleState['ballots'] = [];
    let votes: ModuleState['votes'] = [];
    let projects: ModuleState['projects'] = [];
    let milestones: ModuleState['milestones'] = [];
    let schedules: ModuleState['schedules'] = [];
    let entries: ModuleState['entries'] = [];
    let controls: ModuleState['controls'] = [];
    let executions: ModuleState['executions'] = [];
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
        compatible:
          compatible(VERSION, manifest.coreRange) &&
          (!enabled || enabled.version === manifest.interfaceVersion),
        codeVerified: verified && pinned,
        actions: enabled?.actions ?? [],
        grants: enabled?.grants ?? [],
      });
      if (!verified) continue;
      if (deployment.id === 'decide') {
        executions = (
          await this.moduleRows(deployment.account, 'executions', DecideTableSchemas.executions)
        ).filter((row) => row.dao_id === daoId);
        ballots = (
          await this.moduleRows(deployment.account, 'ballots', DecideTableSchemas.ballots)
        ).filter((row) => row.dao_id === daoId);
        const ids = new Set(ballots.map((row) => row.id));
        votes = (
          await this.moduleRows(deployment.account, 'votes', DecideTableSchemas.votes)
        ).filter((row) => ids.has(row.ballot));
      }
      if (deployment.id === 'works') {
        projects = (
          await this.moduleRows(deployment.account, 'projects', WorksTableSchemas.projects)
        ).filter((row) => row.dao_id === daoId);
        milestones = (
          await this.moduleRows(deployment.account, 'milestones', WorksTableSchemas.milestones)
        ).filter((row) => row.dao_id === daoId);
      }
      if (deployment.id === 'payroll') {
        schedules = (
          await this.moduleRows(deployment.account, 'schedules', PayrollTableSchemas.schedules)
        ).filter((row) => row.dao_id === daoId);
        entries = (
          await this.moduleRows(deployment.account, 'entries', PayrollTableSchemas.entries)
        ).filter((row) => row.dao_id === daoId);
        const scheduleIds = new Set(schedules.map((row) => row.id));
        controls = (
          await this.moduleRows(deployment.account, 'controls', PayrollTableSchemas.controls)
        ).filter((row) => scheduleIds.has(row.schedule_id));
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
      ballots,
      votes,
      projects,
      milestones,
      schedules,
      entries,
      controls,
      executions,
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
