import {checkNativeAuthority} from './auth/native-proof.js';
import { NamesActionSchemas, NamesTableSchemas } from '../../../sdk/generated/names-schemas.js';
import { EncryptionPublicKeySchema } from '../../../protocol/crypto.js';
import { ProfileRecipientPageSchema } from '../../../protocol/profiles.js';
import { decodeRawNativeProfile } from '../../../sdk/profiles.js';
import { privateHandoverCommitment,exitInstructionDigest } from '../../../sdk/account-exit.js';
import { DaoHandoverSchema,SignedExitInstructionSchema,ExitSubmissionSchema,type ExitSubmission } from '../../../protocol/account-exit.js';
import { namesAbi, NamesCodeHash } from '../../../sdk/names.js';
import {
  ContentPageQuerySchema,
  DaoContentSchema,
  type ContentPageQuery,
  type DaoContent,
} from '../../../protocol/content.js';
import { waitForIrreversibleBlock } from './chain-confirmation.js';
import { createRpcClient } from './rpc.js';
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
  Checksum256,
  Signature,
  PublicKey,
  Name,
  UInt64,
} from '@wharfkit/antelope';
import {
  Catalog,
  ModulePermissions,
  ModuleApiRoutes,
  ModuleStateSchema,
  ModulePageQuerySchema,
  GoverningDocumentQuerySchema,
  GoverningDocumentPageSchema,
  type GoverningDocumentQuery,
  type GoverningDocumentPage,
  type ModulePageQuery,
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
  ActivityTableSchemas,
} from '@daclify/modules/sdk';
import { AppActivityPageSchema, appConfigurationHash } from '../../../protocol/connected-apps.js';
import { AccountResourceSchema, resourcesAcceptable } from './deployment-check.js';
import { randomBytes } from 'node:crypto';
import {
  ArchiveRoutes,
  ArchiveProgressSchema,
  ArchiveLiveVotesRequestSchema,
  ArchiveLiveVotesSchema,
  ArchivePruneBatchSchema,
  type ArchivePruneBatch,
  OrdinaryPollArchiveInputSchema,
  archiveSourceSchema,
  planOrdinaryPollArchive,
  planDocumentArchive,
  DocumentArchiveInputSchema,
  MAX_ARCHIVE_LEAVES,
  type ArchiveSelection,
} from '@daclify/modules/archive';
import {
  HubDeploymentRowSchema,
  HubMetadataSchema,
  registryDirectory,
} from '../../../protocol/directory.js';
import { PaymentPolicySchema } from '../../../protocol/payments.js';
import type { DaoRef } from '../../../protocol/base.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../../../sdk/generated/releases.js';
import { runtimeAbi } from '../../../sdk/generated/runtime.js';
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
  RuntimeActionSchemas,
  encodeAction,
  instructionDigest,
  governanceSettings,
  type RuntimeActions,
  type instruction,
} from '../../../sdk/index.js';
import type { ChainGateway } from './chain.js';
import type { EvmRelay } from '../../../protocol/evm-wallet.js';
import type { Pool, PoolClient } from 'pg';
import { canonicalEvmSignature, evmTypedDigest, governanceTypedData, exitGovernanceTypedData } from '../../../sdk/evm.js';
import { recoverEvmDigest } from './auth/evm-proof.js';
import {
  resourcePolicyFromRow,
  RamUsageSchema,
  RamPayerUsageSchema,
} from '../../../protocol/resources.js';
import { ApiError, contractError } from './errors.js';
import { nativeRamQuote } from './resources/native-quote.js';
import type { RamQuoteRequest } from '../../../protocol/resources.js';
import {
  ChainPlatformSchema,
  ContractStatusSchema,
  type ChainPlatform,
} from '../../../protocol/platform.js';
import type { NamePurchase } from './billing/name.js';
import { HostingChainSchema, HostedPricingSchema } from '../../../protocol/hosting.js';
import { ModuleFeePricingSchema, ModuleFeeChainSchema } from '../../../protocol/module-fees.js';
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
import { PeopleRoutes, PublicProfileSchema } from '../../../protocol/people.js';
export interface NativeChainConfig {
  rpcUrl: string;
  chainId: string;
  runtime: string;
  hub: string | null;
  environment: 'local' | 'testnet' | 'mainnet';
  relayActor: string;
  relayKey: PrivateKey;
  relayPermission?: 'active' | 'operator';
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
const defaultSeatPricing = RuntimeTableSchemas.seatcfg.parse({
  first_usd: 100,
  next_usd: 50,
  rest_usd: 20,
  revision: '0',
});
const defaultPaymentPolicy = RuntimeTableSchemas.paycfg.parse({ bps: 500, revision: '0' });
export class NativeChainGateway implements ChainGateway {
  readonly connectedApps: import('./connected-apps/chain.js').ConnectedAppsChain = {
    keys: async (app, memberId) => {
      await this.reviewedRuntime(this.config.runtime);
      const code = await this.api.v1.chain.get_raw_abi(app.activityAccount);
      if (String(code.code_hash) !== ModuleCodeHashes.activity)
        throw new ApiError('MODULE_CODE', 503);
      const domain = ((BigInt(app.dao.daoId) << 64n) | BigInt(app.appId)).toString(),
        page = await this.moduleRows(
          app.activityAccount,
          'appkeys',
          ActivityTableSchemas.appkeys,
          domain,
          domain,
          2,
          'i128',
          128,
        );
      if (
        page.more ||
        page.rows.some((row) => row.dao_id !== app.dao.daoId || row.app_id !== app.appId)
      )
        throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
      const grants = [];
      for (const key of page.rows) {
        const grantDomain = ((BigInt(key.id) << 64n) | BigInt(memberId)).toString(),
          found = await this.moduleRows(
            app.activityAccount,
            'appgrants',
            ActivityTableSchemas.appgrants,
            grantDomain,
            grantDomain,
            2,
            'i128',
            1,
          );
        grants.push(
          ...found.rows.filter(
            (row) =>
              row.dao_id === app.dao.daoId &&
              row.key_epoch === key.id &&
              row.recipient === memberId,
          ),
        );
      }
      const count = await this.moduleRows(
        app.activityAccount,
        'appcounts',
        ActivityTableSchemas.appcounts,
        domain,
        domain,
        2,
        'i128',
        1,
      );
      return ModuleApiRoutes.appKeys.response.parse({
        currentEpoch: count.rows[0]?.current_key_epoch ?? '0',
        dao: app.dao,
        appId: app.appId,
        keys: page.rows,
        grants,
      });
    },
    activity: async (app, query) => {
      const registration = (await this.connectedApps.registry(app.dao.daoId)).find(
        (row) => row.id === app.appId,
      );
      const installation = (await this.table('modules', app.dao.daoId, '0', 100)).find(
        (row) => row.account === app.activityAccount,
      );
      const deployment = (this.config.modules ?? []).find(
        (row) => row.id === 'activity' && row.account === app.activityAccount,
      );
      if (
        !registration?.enabled ||
        registration.config_hash !== appConfigurationHash(app) ||
        !installation ||
        !deployment ||
        installation.code_hash !== ModuleCodeHashes.activity
      )
        throw new ApiError('APP_SCOPE', 403);
      const deployed = await this.api.v1.chain.get_raw_abi(app.activityAccount);
      if (String(deployed.code_hash) !== ModuleCodeHashes.activity)
        throw new ApiError('MODULE_CODE', 503);
      let page: { rows: z.infer<typeof ActivityTableSchemas.activities>[]; more: boolean };
      if (query.eventId) {
        const parts = [
            Serializer.encode({ type: 'uint64', object: app.dao.daoId }).array,
            Serializer.encode({ type: 'uint64', object: app.appId }).array,
            Serializer.encode({ type: 'checksum256', object: query.eventId }).array,
          ],
          data = Uint8Array.from(parts.flatMap((part) => Array.from(part))),
          key = Checksum256.hash(data).toString();
        page = await this.moduleRows(
          app.activityAccount,
          'activities',
          ActivityTableSchemas.activities,
          key,
          key,
          3,
          'sha256',
          1,
        );
      } else if (!query.after) {
        const domain = ((BigInt(app.dao.daoId) << 64n) | BigInt(app.appId)).toString();
        page = await this.moduleRows(
          app.activityAccount,
          'activities',
          ActivityTableSchemas.activities,
          domain,
          domain,
          2,
          'i128',
          50,
        );
      } else
        page = await this.moduleRows(
          app.activityAccount,
          'activities',
          ActivityTableSchemas.activities,
          query.after,
          ((1n << 64n) - 1n).toString(),
          1,
          'i64',
          50,
        );
      const rows = page.rows.filter(
        (row) =>
          row.dao_id === app.dao.daoId &&
          row.app_id === app.appId &&
          (!query.eventId || row.event_id === query.eventId),
      );
      const last = page.rows.at(-1),
        next =
          !query.eventId && page.more && last && BigInt(last.id) < (1n << 64n) - 1n
            ? (BigInt(last.id) + 1n).toString()
            : null;
      return AppActivityPageSchema.parse({
        receipts: rows.map((row) => ({
          receiptId: row.id,
          appId: row.app_id,
          memberId: row.actor,
          eventId: row.event_id,
          sourceId: row.source_id,
          sourceRevision: row.source_revision,
          kind: row.kind === 1 ? 'completed' : 'review-requested',
          status: ['recorded', 'pending-review', 'accepted', 'rejected'][row.status],
          createdAt: row.created_at,
          evidenceCid: row.evidence_cid,
          evidenceHash: row.evidence_hash,
          keyEpoch: row.key_epoch,
        })),
        next,
      });
    },
    network: () => this.network(),
    registry: async (daoId) => {
      await this.reviewedRuntime(this.config.runtime);
      return this.table('appregs', IdSchema.parse(daoId), '0', 64);
    },
    membership: async (account, daoId) => {
      await this.reviewedRuntime(this.config.runtime);
      const dao = await this.dao(daoId),
        wallets = await this.linkedWallets(account.id);
      if (wallets.length) await this.checkWalletChain();
      const rows = await this.table('members', daoId, '0', 5000),
        id = await this.memberIdentity(account, daoId, rows, wallets),
        member = rows.find((row) => row.id === id);
      if (!member?.active) return null;
      const actor = (await this.table('actors', daoId, member.id, 1))[0];
      if (actor?.id === member.id && actor.revoked) return null;
      if (actor?.kind === 1) {
        const guard = (await this.table('guards', this.config.runtime, daoId, 1))[0];
        if (guard?.dao_id === daoId && guard.paused_until > Date.now() / 1000) return null;
      }
      return this.membershipView(dao, member);
    },
    session: async (daoId, id) => {
      const [credentials, scopes] = await Promise.all([
          this.table('sessions', daoId, id, 1),
          this.table('appscopes', daoId, id, 1),
        ]),
        credential = credentials[0],
        scope = scopes[0];
      if (credential?.id !== id || scope?.id !== id) return null;
      const actor = (await this.table('actors', daoId, credential.member_id, 1))[0];
      if (
        actor?.id === credential.member_id &&
        (actor.revoked || actor.credential_epoch !== credential.credential_epoch)
      )
        return null;
      const app = (await this.connectedApps.registry(daoId)).find((row) => row.id === scope.app_id);
      if (
        !app?.enabled ||
        app.revision !== scope.revision ||
        credential.expires <= Date.now() / 1000
      )
        return null;
      const installed = (
        await this.table('modules', daoId, Name.from(app.target).value.toString(), 1)
      )[0];
      if (
        installed?.account !== app.target ||
        installed.code_hash !== ModuleCodeHashes.activity ||
        credential.permissions.length !== 2 ||
        ['recordact', 'askreview'].some(
          (action) =>
            !credential.permissions.some(
              (permission) =>
                permission.action === action &&
                permission.target === app.target &&
                permission.code_hash === installed.code_hash,
            ),
        )
      )
        return null;
      const deployed = await this.api.v1.chain.get_raw_abi(app.target);
      if (String(deployed.code_hash) !== installed.code_hash) return null;
      return { credential, scope };
    },
    relay: async (account, request, signature, sessionId, appId) => {
      const member = await this.connectedApps.membership(account, request.dao_id),
        session = await this.connectedApps.session(request.dao_id, sessionId);
      if (
        !member ||
        member.memberId !== request.member_id ||
        !session ||
        session.credential.member_id !== member.memberId ||
        session.scope.app_id !== appId ||
        session.credential.expires <= Date.now() / 1000
      )
        throw new ApiError('APP_GRANT_REVOKED', 403);
      if (request.chain_id !== this.config.chainId || request.deployment !== this.config.runtime)
        throw new ApiError('INSTRUCTION_DOMAIN');
      let valid = false;
      try {
        valid = Signature.from(signature).verifyDigest(
          instructionDigest(request),
          PublicKey.from(session.credential.signing_key),
        );
      } catch {
        valid = false;
      }
      if (!valid) throw new ApiError('SIGNATURE_INVALID', 403);
      return this.push(
        'submitsess',
        { request, session_id: sessionId, sig: signature },
        this.config.relayActor,
        this.config.relayKey,
      );
    },
  };
  private readonly api: APIClient;
  constructor(
    private readonly config: NativeChainConfig,
    private readonly pool?: Pool,
  ) {
    ChainIdSchema.parse(config.chainId);
    NativeAccountSchema.parse(config.runtime);
    NativeAccountSchema.parse(config.relayActor);
    z.enum(['active', 'operator']).parse(config.relayPermission ?? 'active');
    const url = new URL(config.rpcUrl);
    if (url.username || url.password || url.search || url.hash)
      throw new Error('RPC_PUBLIC_ENDPOINT_REQUIRED');
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
    )
      throw new Error('Chain RPC requires TLS outside local tests');
    this.api = createRpcClient(config.rpcUrl);
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
      basisPoints: row?.bps ?? defaultPaymentPolicy.bps,
      revision: row?.revision ?? defaultPaymentPolicy.revision,
    });
  }
  async moduleFeePricing() {
    await this.reviewedRuntime(this.config.runtime);
    const [fees, catalogue] = await Promise.all([
      this.table('modfees', this.config.runtime),
      this.table('catalogue', this.config.runtime),
    ]);
    return ModuleFeePricingSchema.parse({
      chainId: this.config.chainId,
      runtime: this.config.runtime,
      interfaceVersion: 1,
      freeMembers: 10,
      plans: await Promise.all(
        fees.map(async (fee) => {
          const listing = catalogue.find(
            (row) => row.account === fee.account && row.party === 0 && row.complies === 1,
          );
          if (!listing) throw new ApiError('MODULE_PRICING_UNAVAILABLE', 503);
          const deployed = await this.api.v1.chain.get_raw_abi(fee.account);
          if (deployed.code_hash.toString() !== listing.code_hash)
            throw new ApiError('MODULE_PRICING_UNAVAILABLE', 503);
          return {
            pricing: {
              account: fee.account,
              revision: fee.revision,
              monthlyUsdCents: fee.monthly_usd,
              actions: fee.actions,
            },
            title: listing.title,
            codeHash: listing.code_hash,
          };
        }),
      ),
    });
  }
  async moduleFeeState(dao: DaoRef) {
    if (
      dao.chainId !== this.config.chainId ||
      dao.contract !== this.config.runtime ||
      dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE', 403);
    const [pricing, summary, installed, terms] = await Promise.all([
      this.moduleFeePricing(),
      this.dao(dao.daoId),
      this.table('modules', dao.daoId),
      this.table('modterms', dao.daoId),
    ]);
    return ModuleFeeChainSchema.parse({
      dao,
      activeMembers: summary.members,
      freeMembers: 10,
      modules: pricing.plans.map((plan) => ({
        ...plan,
        installed: installed.some(
          (row) =>
            row.account === plan.pricing.account &&
            row.actions.length > 0 &&
            row.code_hash === plan.codeHash,
        ),
        term: terms.find((row) => row.account === plan.pricing.account) ?? null,
      })),
    });
  }
  async attestModuleTerm(
    dao: DaoRef,
    account: string,
    expectedReceipt: string,
    expires: number,
    receipt: string,
  ) {
    await this.moduleFeeState(dao);
    await this.push(
      'setmodterm',
      { dao_id: dao.daoId, account, expected_receipt: expectedReceipt, expires, receipt },
      this.config.relayActor,
      this.config.relayKey,
    );
  }
  async revokeModuleTerm(dao: DaoRef, account: string, receipt: string) {
    await this.moduleFeeState(dao);
    await this.push(
      'revmodterm',
      { dao_id: dao.daoId, account, receipt },
      this.config.relayActor,
      this.config.relayKey,
    );
  }
  async resumeModuleTerm(dao: DaoRef, account: string, receipt: string) {
    await this.moduleFeeState(dao);
    await this.push(
      'resmodterm',
      { dao_id: dao.daoId, account, receipt },
      this.config.relayActor,
      this.config.relayKey,
    );
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
        rates: pricing[0] ?? defaultSeatPricing,
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
  async attestHostedClosure(dao:DaoRef,receipt:string):Promise<void>{
    await this.hosting(dao);ChainIdSchema.parse(receipt);
    const life=(await this.table('daolife',this.config.runtime,dao.daoId,1))[0];
    if(!life||life.dao_id!==dao.daoId||life.state!==1)throw new ApiError('HOSTED_CLOSURE_CONTEXT',409);
    await this.push('closehost',{dao_id:dao.daoId,closing_at:life.transitioned_at,receipt},this.config.relayActor,this.config.relayKey);
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
    const ownershipPolicy = [
      ['setnativegov', ['creator', 'inline_code']],
      ['handover', ['expected_creator', 'expected_policy_version']],
    ] as const;
    const creatorOwnership = ownershipPolicy.every(([action, fields]) => {
      const type = abi?.actions.find((row) => row.name.toString() === action)?.type;
      const shape = abi?.structs.find((row) => row.name === type);
      return fields.every((field) => shape?.fields.some((row) => row.name === field));
    });
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
        ...(creatorOwnership ? ['creator-owner-executive-active'] : []),
        'internal-k1',
        'native-linked',
        'encrypted-documents',
        ...(actions.includes('setencprof') && actions.includes('delprofile')
          ? ['encrypted-profiles-v2']
          : []),
        ...(actions.includes('authproof') ? ['native-sign-in'] : []),
        ...(actions.includes('handover') &&
        actions.includes('refreshgov') &&
        actions.includes('electexec')
          ? ['executive-authority']
          : []),
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
    if ((await this.table('rammigrate', this.config.runtime))[0]?.active)
      throw new ApiError('RAM_MIGRATION_ACTIVE', 503);
    const read = async <
      K extends
        | 'ramobs'
        | 'ramstats'
        | 'ramalloc'
        | 'ramlimits'
        | 'ramentitle'
        | 'ramsources'
        | 'resourcecfg'
        | 'modules',
    >(
      table: K,
      scope: string,
    ) => {
      const page = await this.tablePage(table, scope, '0', 65);
      if (page.next !== null || page.rows.length > 64)
        throw new ApiError('RESOURCE_SCOPE_LIMIT', 503);
      return page.rows;
    };
    const [observers, stats, allocations, limits, entitlements, sources, policies, installed] =
      await Promise.all([
        read('ramobs', this.config.runtime),
        read('ramstats', id),
        read('ramalloc', id),
        read('ramlimits', id),
        read('ramentitle', id),
        read('ramsources', this.config.runtime),
        read('resourcecfg', this.config.runtime),
        read('modules', id),
      ]);
    const observer = observers[0];
    let completionHolds: { rows: number; bytes: string } | null = null;
    if (observer) {
      let count = 0,
        heldBytes = 0n;
      const abi = ABI.from(runtimeAbi);
      // ponytail: bounded to 5,000 holds; add a native aggregate if measured outstanding work exceeds this.
      for (const table of ['ramholds', 'ramclmholds'] as const) {
        let cursor: string | null = '0',
          familyCount = 0;
        while (cursor !== null) {
          const page: {
            rows: z.infer<typeof RuntimeTableSchemas.ramholds>[];
            next: string | null;
          } = await this.tablePage(table, id, cursor);
          count += page.rows.length;
          familyCount += page.rows.length;
          if (count > 5000) throw new ApiError('RESOURCE_SCOPE_LIMIT', 503);
          for (const row of page.rows)
            heldBytes += BigInt(
              Serializer.encode({ abi, type: 'ram_completion_hold', object: row }).array.length +
                240,
            );
          cursor = page.next;
        }
        if (familyCount) heldBytes += 112n;
      }
      completionHolds = { rows: count, bytes: heldBytes.toString() };
    }
    if (observer && observer.runtime_hash !== RuntimeCodeHash)
      throw new ApiError('RESOURCE_UNQUALIFIED', 503);
    const accounts = [
      ...new Set([
        this.config.runtime,
        ...stats.map((r) => r.payer),
        ...allocations.map((r) => r.payer),
        ...limits.map((r) => r.payer),
        ...entitlements.map((r) => r.payer),
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
          allocation: (() => {
            const limit = limits.find((r) => r.payer === payer);
            return limit
              ? { activity: limit.activity, identity: limit.identity, completion: limit.completion }
              : null;
          })(),
          entitlement: (() => {
            const value = entitlements.find((r) => r.payer === payer);
            return value
              ? {
                  policy_revision: value.policy_revision,
                  identity_per_slot: value.identity_per_slot,
                  slots: value.slots,
                }
              : null;
          })(),
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
    if ((await this.table('rammigrate', this.config.runtime))[0]?.active)
      throw new ApiError('RAM_MIGRATION_ACTIVE', 503);
    const quotaEnabled = (await this.table('ramquota', id))[0]?.enabled === true;
    if (quotaEnabled && (!observer || payers.some((payer) => !payer.sourceVerified)))
      throw new ApiError('RESOURCE_UNQUALIFIED', 503);
    return RamUsageSchema.parse({
      dao: {
        chainId: this.config.chainId,
        contract: this.config.runtime,
        daoId: id,
        interfaceVersion: 1,
      },
      observation: observer ? 'active' : 'disabled',
      enforcement: quotaEnabled ? 'active' : 'disabled',
      completionHolds,
      read: { startedAt, completedAt: new Date().toISOString(), atomic: false },
      policy: policies[0] ? resourcePolicyFromRow(policies[0]) : null,
      totalObservedBytes: total,
      purchasedBytes: payers.reduce((n, p) => n + BigInt(p.purchasedBytes), 0n).toString(),
      payers,
    });
  }
  async ramQuote(input: RamQuoteRequest) {
    const installed = await this.table('modules', input.dao.daoId);
    if (
      input.allocations.some(
        (a) =>
          a.receiver !== this.config.runtime && !installed.some((m) => m.account === a.receiver),
      )
    )
      throw new ApiError('RAM_RECEIVER_UNINSTALLED');
    const result = await nativeRamQuote(this.api, input, await this.ramUsage(input.dao.daoId));
    await this.reviewedRuntime(this.config.runtime);
    return result;
  }
  async ramOrder(reference: string) {
    ChainIdSchema.parse(reference);
    await this.reviewedRuntime(this.config.runtime);
    const read = async () => {
      const page = await this.api.v1.chain.get_table_rows({
        code: this.config.runtime,
        scope: this.config.runtime,
        table: 'ramorders',
        json: true,
        index_position: 'secondary',
        key_type: 'sha256',
        lower_bound: Checksum256.from(reference),
        upper_bound: Checksum256.from(reference),
        limit: 2,
      });
      const rows = z.array(RuntimeTableSchemas.ramorders).max(1).parse(page.rows);
      if (page.more || rows.some((r) => r.reference !== reference))
        throw new ApiError('RAM_RECEIPT_INVALID', 503);
      return rows[0] ?? null;
    };
    const first = await read();
    if (!first) return null;
    const info = await this.api.v1.chain.get_info();
    if (info.chain_id.toString() !== this.config.chainId) throw new ApiError('DAO_REFERENCE');
    await this.confirmBlock(Number(info.head_block_num));
    const current = await read();
    if (JSON.stringify(first) !== JSON.stringify(current))
      throw new ApiError('RAM_ORDER_PENDING', 503);
    await this.reviewedRuntime(this.config.runtime);
    return current;
  }
  async fulfilRam(input: RuntimeActions['fulfilram']) {
    await this.reviewedRuntime(this.config.runtime);
    const config = (await this.table('createcfg', this.config.runtime))[0];
    if (config?.settler !== this.config.relayActor)
      throw new ApiError('RAM_BILLING_AUTHORITY_UNCONFIGURED', 503);
    const info = await this.api.v1.chain.get_info();
    const policy = await this.resourcePolicy();
    if (!policy || policy.revision !== input.policy_revision)
      throw new ApiError('RESOURCE_POLICY_CHANGED', 409);
    return this.push(
      'fulfilram',
      {
        ...input,
        expires:
          Math.floor(info.head_block_time.toMilliseconds() / 1000) + policy.quoteLifetimeSeconds,
      },
      this.config.relayActor,
      this.config.relayKey,
    );
  }
  async archiveLiveVotes(value: z.infer<typeof ArchiveLiveVotesRequestSchema>) {
    const input = ArchiveLiveVotesRequestSchema.parse(value),
      dao = input.dao;
    if (
      dao.chainId !== this.config.chainId ||
      dao.contract !== this.config.runtime ||
      dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE');
    await this.reviewedRuntime(dao.contract);
    const deployment = this.config.modules?.find((m) => m.id === 'decide');
    if (!deployment) throw new ApiError('ARCHIVE_SOURCE_UNCONFIGURED', 503);
    const schema = archiveSourceSchema('ordinary-poll-votes');
    const review = async () => {
      const raw = await this.api.v1.chain.get_raw_abi(deployment.account);
      if (
        raw.code_hash.toString() !== schema.codeHash ||
        raw.abi_hash.toString() !== schema.rawAbiHash
      )
        throw new ApiError('ARCHIVE_SCHEMA_UNSUPPORTED', 409);
    };
    await review();
    const ballot = await this.moduleRows(
      deployment.account,
      'ballots',
      DecideTableSchemas.ballots,
      input.parentId,
      input.parentId,
      1,
      'i64',
      2,
    );
    const parent = ballot.rows[0];
    if (
      ballot.more ||
      ballot.rows.length !== 1 ||
      !parent ||
      parent.dao_id !== dao.daoId ||
      parent.id !== input.parentId
    )
      throw new ApiError('BALLOT_UNKNOWN', 404);
    const read = async () => {
      const rows: z.infer<typeof ArchiveLiveVotesSchema> = [];
      let cursor = BigInt(input.parentId) << 64n;
      const upper = cursor | ((1n << 64n) - 1n);
      for (;;) {
        const page = await this.moduleRows(
          deployment.account,
          'votes',
          DecideTableSchemas.votes,
          cursor.toString(),
          upper.toString(),
          2,
          'i128',
          Math.min(256, MAX_ARCHIVE_LEAVES - rows.length + 1),
        );
        if (
          page.rows.some(
            (r) =>
              r.ballot !== input.parentId ||
              ((BigInt(r.ballot) << 64n) | BigInt(r.member)) < cursor,
          ) ||
          rows.length + page.rows.length > MAX_ARCHIVE_LEAVES
        )
          throw new ApiError('ARCHIVE_COVERAGE_INCOMPLETE', 409);
        rows.push(...page.rows);
        if (!page.more) break;
        const last = page.rows.at(-1);
        if (!last || BigInt(last.member) === (1n << 64n) - 1n)
          throw new ApiError('ARCHIVE_COVERAGE_INCOMPLETE', 409);
        cursor = (BigInt(input.parentId) << 64n) | (BigInt(last.member) + 1n);
      }
      return ArchiveLiveVotesSchema.parse(rows);
    };
    const first = await read(),
      info = await this.api.v1.chain.get_info();
    if (info.chain_id.toString() !== dao.chainId) throw new ApiError('DAO_REFERENCE');
    await this.confirmBlock(Number(info.head_block_num));
    const current = await read();
    await review();
    await this.reviewedRuntime(dao.contract);
    if (JSON.stringify(first) !== JSON.stringify(current))
      throw new ApiError('ARCHIVE_HISTORY_PENDING', 503);
    return current;
  }
  async archiveHistory(value: z.infer<typeof ArchiveRoutes.history.input>) {
    const input = ArchiveRoutes.history.input.parse(value),
      dao = input.dao;
    if (
      dao.chainId !== this.config.chainId ||
      dao.contract !== this.config.runtime ||
      dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE');
    await this.reviewedRuntime(dao.contract);
    const read = async () => {
      const page = await this.api.v1.chain.get_table_rows({
        code: dao.contract,
        scope: dao.daoId,
        table: 'archives',
        json: true,
        lower_bound: UInt64.from(input.cursor ?? '0'),
        limit: 20,
      });
      const anchors = z.array(RuntimeTableSchemas.archives).max(20).parse(page.rows);
      if (
        anchors.some(
          (a) =>
            a.dao_id !== dao.daoId ||
            a.manifest.runtime !== dao.contract ||
            a.manifest.chain_id !== dao.chainId,
        )
      )
        throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
      return ArchiveRoutes.history.response.parse({
        dao,
        anchors,
        next: page.more ? page.next_key : null,
      });
    };
    const first = await read(),
      info = await this.api.v1.chain.get_info();
    if (info.chain_id.toString() !== dao.chainId) throw new ApiError('DAO_REFERENCE');
    await this.confirmBlock(Number(info.head_block_num));
    const current = await read();
    await this.reviewedRuntime(dao.contract);
    if (JSON.stringify(first) !== JSON.stringify(current))
      throw new ApiError('ARCHIVE_ANCHOR_PENDING', 503);
    return current;
  }
  async archiveProgress(dao: DaoRef, commitment: string) {
    const anchor = await this.archiveAnchor(dao, commitment);
    if (!anchor) throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
    const read = async () => {
      const settings = await this.api.v1.chain.get_table_rows({
        code: dao.contract,
        scope: dao.contract,
        table: 'archcfg',
        json: true,
        limit: 2,
      });
      const cfg = z.array(RuntimeTableSchemas.archcfg).max(1).parse(settings.rows)[0];
      if (settings.more || !cfg) throw new ApiError('ARCHIVE_PRUNING_DISABLED', 503);
      const page = await this.api.v1.chain.get_table_rows({
        code: dao.contract,
        scope: dao.daoId,
        table: 'archpos',
        json: true,
        lower_bound: UInt64.from((BigInt(anchor.id) * 32n).toString()),
        upper_bound: UInt64.from((BigInt(anchor.id) * 32n + 31n).toString()),
        limit: 33,
      });
      const positions = z.array(RuntimeTableSchemas.archpos).max(32).parse(page.rows);
      if (
        page.more ||
        positions.length !== anchor.manifest.families[0]?.chunks.length ||
        positions.some(
          (r, i) =>
            r.dao_id !== dao.daoId ||
            r.archive_id !== anchor.id ||
            r.chunk_ordinal !== i ||
            BigInt(r.id) !== BigInt(anchor.id) * 32n + BigInt(i),
        )
      )
        throw new ApiError('ARCHIVE_PROGRESS_INVALID', 503);
      return ArchiveProgressSchema.parse({ anchor, positions, enabled: cfg.pruning_enabled });
    };
    const first = await read();
    const info = await this.api.v1.chain.get_info();
    await this.confirmBlock(Number(info.head_block_num));
    const current = await read();
    if (JSON.stringify(first) !== JSON.stringify(current))
      throw new ApiError('ARCHIVE_ANCHOR_PENDING', 503);
    return current;
  }
  async pruneArchive(dao: DaoRef, commitment: string, value: ArchivePruneBatch) {
    const input = ArchivePruneBatchSchema.parse(value),
      before = await this.archiveProgress(dao, commitment);
    if (
      !before.enabled ||
      before.anchor.revoked ||
      !before.anchor.approved_by ||
      before.anchor.approved_by === '0'
    )
      throw new ApiError('ARCHIVE_PRUNING_DISABLED', 409);
    if (
      input.runtime !== dao.contract ||
      input.dao_id !== dao.daoId ||
      input.archive_id !== before.anchor.id
    )
      throw new ApiError('DAO_REFERENCE');
    const progress = before.positions[input.chunk_ordinal];
    if (!progress) throw new ApiError('ARCHIVE_PROGRESS_INVALID', 503);
    const end = input.start + input.proofs.length;
    if (progress.pruned >= end) return;
    if (input.start !== progress.pruned) throw new ApiError('ARCHIVE_PROGRESS_CHANGED', 409);
    const account = before.anchor.manifest.source;
    const documentSource =
      account === dao.contract && before.anchor.manifest.families[0]?.kind === 'document-versions';
    if (documentSource) {
      if (before.anchor.manifest.code_hash !== RuntimeCodeHash)
        throw new ApiError('ARCHIVE_SCHEMA_UNSUPPORTED', 409);
      const { runtime: _runtime, ...data } = input;
      try {
        await this.pushEncoded(
          account,
          'prunedocs',
          encodeAction('prunedocs', data),
          this.config.relayActor,
          this.config.relayKey,
        );
      } catch (cause) {
        const current = await this.archiveProgress(dao, commitment);
        if ((current.positions[input.chunk_ordinal]?.pruned ?? 0) >= end) return;
        throw cause;
      }
      const after = await this.archiveProgress(dao, commitment);
      if ((after.positions[input.chunk_ordinal]?.pruned ?? 0) < end)
        throw new ApiError('ARCHIVE_PROGRESS_INVALID', 503);
      return;
    }
    const source = this.config.modules?.find((m) => m.id === 'decide' && m.account === account);
    if (!source || ModuleCodeHashes.decide !== before.anchor.manifest.code_hash)
      throw new ApiError('MODULE_UNVERIFIED', 409);
    try {
      await this.pushEncoded(
        account,
        'prunevotes',
        encodeDecide('prunevotes', input),
        this.config.relayActor,
        this.config.relayKey,
      );
    } catch (cause) {
      const current = await this.archiveProgress(dao, commitment);
      if ((current.positions[input.chunk_ordinal]?.pruned ?? 0) >= end) return;
      throw cause;
    }
    const after = await this.archiveProgress(dao, commitment);
    if ((after.positions[input.chunk_ordinal]?.pruned ?? 0) < end)
      throw new ApiError('ARCHIVE_PRUNE_PENDING', 503);
  }
  async archiveAnchor(dao: DaoRef, manifestCommitment: string) {
    ChainIdSchema.parse(manifestCommitment);
    if (
      dao.chainId !== this.config.chainId ||
      dao.contract !== this.config.runtime ||
      dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE');
    await this.reviewedRuntime(dao.contract);
    const read = async () => {
      const page = await this.api.v1.chain.get_table_rows({
        code: dao.contract,
        scope: dao.daoId,
        table: 'archives',
        json: true,
        index_position: 'secondary',
        key_type: 'sha256',
        lower_bound: Checksum256.from(manifestCommitment),
        upper_bound: Checksum256.from(manifestCommitment),
        limit: 2,
      });
      const rows = z.array(RuntimeTableSchemas.archives).max(1).parse(page.rows);
      if (
        page.more ||
        rows.some(
          (r) =>
            r.dao_id !== dao.daoId ||
            r.manifest.dao_id !== dao.daoId ||
            r.manifest.chain_id !== dao.chainId ||
            r.manifest.runtime !== dao.contract ||
            r.manifest_commitment !== manifestCommitment,
        )
      )
        throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
      return rows[0] ?? null;
    };
    const first = await read();
    if (!first) return null;
    const info = await this.api.v1.chain.get_info();
    if (info.chain_id.toString() !== dao.chainId) throw new ApiError('DAO_REFERENCE');
    await this.confirmBlock(Number(info.head_block_num));
    const current = await read();
    if (JSON.stringify(first) !== JSON.stringify(current))
      throw new ApiError('ARCHIVE_ANCHOR_PENDING', 503);
    await this.reviewedRuntime(dao.contract);
    return current;
  }
  async attestArchive(value: RuntimeActions['archattest']) {
    const input = RuntimeActionSchemas.archattest.parse(value);
    await this.reviewedRuntime(this.config.runtime);
    if (
      input.manifest.runtime !== this.config.runtime ||
      input.manifest.chain_id !== this.config.chainId ||
      input.manifest.dao_id !== input.dao_id
    )
      throw new ApiError('DAO_REFERENCE');
    const config = (await this.table('archcfg', this.config.runtime))[0];
    if (config?.verifier !== this.config.relayActor)
      throw new ApiError('ARCHIVE_VERIFIER_UNCONFIGURED', 503);
    const dao: DaoRef = {
      chainId: this.config.chainId,
      contract: this.config.runtime,
      daoId: input.dao_id,
      interfaceVersion: 1,
    };
    let failure: unknown;
    try {
      await this.push('archattest', input, this.config.relayActor, this.config.relayKey);
    } catch (cause) {
      failure = cause;
    }
    const row = await this.archiveAnchor(dao, input.manifest_commitment),
      info = await this.api.v1.chain.get_info();
    if (info.chain_id.toString() !== dao.chainId) throw new ApiError('DAO_REFERENCE');
    const now = Math.floor(info.head_block_time.toMilliseconds() / 1000);
    if (
      !row ||
      row.verifier !== this.config.relayActor ||
      row.retention_seconds !== input.retention_seconds ||
      row.attested_at > now ||
      now - row.attested_at > 900 ||
      row.manifest_cid !== input.manifest_cid ||
      row.manifest_bytes !== input.manifest_bytes ||
      row.backup_commitment !== input.backup_commitment ||
      JSON.stringify(row.manifest) !== JSON.stringify(input.manifest)
    ) {
      if (failure) throw failure;
      throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
    }
    return row;
  }
  private async documentArchivePreview(
    input: z.infer<typeof ArchiveRoutes.preview.input> & { documentRows: string[] },
  ) {
    const dao = input.dao,
      source = archiveSourceSchema('document-versions');
    await this.reviewedRuntime(dao.contract);
    const raw = await this.api.v1.chain.get_raw_abi(dao.contract);
    if (
      raw.code_hash.toString() !== source.codeHash ||
      raw.abi_hash.toString() !== source.rawAbiHash
    )
      throw new ApiError('ARCHIVE_SCHEMA_UNSUPPORTED', 409);
    const read = async () => {
      const [statePage, installedPage, sourcesPage, scansPage] = await Promise.all([
        this.moduleRows(
          dao.contract,
          'docstate',
          RuntimeTableSchemas.docstate,
          '0',
          '0',
          1,
          'i64',
          1,
          dao.daoId,
        ),
        this.moduleRows(
          dao.contract,
          'modules',
          RuntimeTableSchemas.modules,
          '0',
          '18446744073709551615',
          1,
          'i64',
          65,
          dao.daoId,
        ),
        this.moduleRows(
          dao.contract,
          'docsrcs',
          RuntimeTableSchemas.docsrcs,
          '0',
          '18446744073709551615',
          1,
          'i64',
          65,
          dao.daoId,
        ),
        this.moduleRows(
          dao.contract,
          'docscan',
          RuntimeTableSchemas.docscan,
          '0',
          '18446744073709551615',
          1,
          'i64',
          257,
          dao.daoId,
        ),
      ]);
      if (
        [statePage, installedPage, sourcesPage, scansPage].some((p) => p.more) ||
        installedPage.rows.length > 64 ||
        sourcesPage.rows.length > 64 ||
        scansPage.rows.length > 256
      )
        throw new ApiError('ARCHIVE_COVERAGE_INCOMPLETE', 409);
      let complete = statePage.rows[0]?.complete === true;
      for (const grant of installedPage.rows.filter((r) => r.actions.length > 0))
        if (
          !sourcesPage.rows.some(
            (s) => s.source === grant.account && s.code_hash === grant.code_hash,
          )
        )
          complete = false;
      const sourcePins = [];
      for (const entry of sourcesPage.rows) {
        const response = await fetch(this.config.rpcUrl + '/v1/chain/get_code_hash', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ account_name: entry.source }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new ApiError('CHAIN_UNAVAILABLE', 503);
        const current = z.object({ code_hash: ChainIdSchema }).parse(await response.json());
        sourcePins.push({ source: entry.source, codeHash: current.code_hash });
        if (
          current.code_hash !== entry.code_hash ||
          entry.tables.some(
            (table) =>
              !scansPage.rows.some(
                (scan) =>
                  scan.source === entry.source &&
                  scan.table === table &&
                  scan.complete &&
                  scan.code_hash === entry.code_hash,
              ),
          )
        )
          complete = false;
      }
      const documents = [],
        heads = [],
        clocks = [],
        references = [];
      for (const id of input.documentRows) {
        const page = await this.moduleRows(
            dao.contract,
            'documents',
            RuntimeTableSchemas.documents,
            id,
            id,
            1,
            'i64',
            1,
            dao.daoId,
          ),
          document = page.rows[0];
        if (!document || document.id !== id) throw new ApiError('DOCUMENT_UNKNOWN', 404);
        const index = ((BigInt(document.document_id) << 32n) | BigInt(document.version)).toString();
        const [head, clock, ref] = await Promise.all([
          this.moduleRows(
            dao.contract,
            'docheads',
            RuntimeTableSchemas.docheads,
            document.document_id,
            document.document_id,
            1,
            'i64',
            1,
            dao.daoId,
          ),
          this.moduleRows(
            dao.contract,
            'docclocks',
            RuntimeTableSchemas.docclocks,
            id,
            id,
            1,
            'i64',
            1,
            dao.daoId,
          ),
          this.moduleRows(
            dao.contract,
            'docrefs',
            RuntimeTableSchemas.docrefs,
            index,
            index,
            3,
            'i128',
            1,
            dao.daoId,
          ),
        ]);
        documents.push(document);
        heads.push(...head.rows);
        clocks.push(...clock.rows);
        references.push(
          ...ref.rows.map((r) => ({ document_id: r.document_id, version: r.version })),
        );
      }
      return {
        state: {
          coverageComplete: complete,
          documents,
          heads: [...new Map(heads.map((h) => [h.document_id, h])).values()],
          clocks,
          references,
        },
        sourcePins,
        installed: installedPage.rows,
        sources: sourcesPage.rows,
        scans: scansPage.rows,
      };
    };
    const first = await read(),
      info = await this.api.v1.chain.get_info();
    await this.confirmBlock(Number(info.head_block_num));
    const current = await read();
    if (JSON.stringify(first) !== JSON.stringify(current))
      throw new ApiError('ARCHIVE_ANCHOR_PENDING', 503);
    const head = await this.api.v1.chain.get_info(),
      [block, account] = await Promise.all([
        this.api.v1.chain.get_block(head.last_irreversible_block_num),
        this.api.v1.chain.get_account(dao.contract),
      ]);
    if (
      head.chain_id.toString() !== dao.chainId ||
      block.id.toString() !== head.last_irreversible_block_id.toString() ||
      Number(block.block_num) !== Number(head.last_irreversible_block_num)
    )
      throw new ApiError('ARCHIVE_SNAPSHOT_UNQUALIFIED', 503);
    await this.reviewedRuntime(dao.contract);
    return planDocumentArchive(
      DocumentArchiveInputSchema.parse({
        dao,
        source: { account: dao.contract, codeHash: source.codeHash, abiHash: source.rawAbiHash },
        snapshot: {
          blockNumber: Number(block.block_num),
          blockId: block.id.toString(),
          timestamp: new Date(block.timestamp.toMilliseconds()).toISOString(),
        },
        sourceUpdatedAt: new Date(account.last_code_update.toMilliseconds()).toISOString(),
        retentionSeconds: input.retentionSeconds,
        ...current.state,
      }),
    );
  }
  async archivePreview(value: ArchiveSelection) {
    const input = ArchiveRoutes.preview.input.parse(value);
    if ('documentRows' in input) {
      if (
        input.dao.chainId !== this.config.chainId ||
        input.dao.contract !== this.config.runtime ||
        input.dao.interfaceVersion !== 1
      )
        throw new ApiError('DAO_REFERENCE');
      return this.documentArchivePreview(input);
    }
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
      ramReserve,
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
      optional(this, 'ramreserve'),
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
      seatPricing:
        seatPricing ??
        (abi.abi?.tables.some((table) => table.name === 'seatcfg') ? defaultSeatPricing : null),
      paymentPolicy:
        paymentPolicy ??
        (market && market.dao_id !== '0' && abi.abi?.tables.some((table) => table.name === 'paycfg')
          ? defaultPaymentPolicy
          : null),
      resourcePolicy: resourcePolicy ? resourcePolicyFromRow(resourcePolicy) : null,
      ramReserve,
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
    profileDao?: string,
  ): Promise<{ rows: z.infer<(typeof RuntimeTableSchemas)[K]>[]; next: string | null }> {
    Uint64Schema.parse(lower);
    if (profileDao && table !== 'profiles') throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    const base = profileDao ? BigInt(IdSchema.parse(profileDao)) << 64n : 0n;
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: this.config.runtime,
        table,
        scope,
        json: true,
        key_type: profileDao ? 'i128' : 'i64',
        ...(profileDao ? { index_position: 2, upper_bound: (base + (1n << 64n)).toString() } : {}),
        lower_bound: (base + BigInt(lower)).toString(),
        limit,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      if (table === 'memberacts' || table === 'daolife') {
        const legacy = z
          .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
          .safeParse(await response.json().catch(() => undefined));
        if (
          legacy.success &&
          legacy.data.error.details.some(
            (detail) => detail.message === `Table ${table} is not specified in the ABI`,
          )
        )
          return { rows: [], next: null };
      }
      throw new ApiError('CHAIN_UNAVAILABLE', 503);
    }
    const body = z
      .object({ rows: z.array(z.unknown()), more: z.boolean(), next_key: z.string().optional() })
      .safeParse(await response.json());
    if (!body.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    const parsed = z.array(RuntimeTableSchemas[table]).safeParse(body.data.rows);
    if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    let cursor = body.data.next_key;
    if (profileDao && body.data.more) {
      if (
        !cursor ||
        cursor.length > 39 ||
        !/^\d+$/.test(cursor) ||
        BigInt(cursor) < base ||
        BigInt(cursor) >= base + (1n << 64n)
      )
        throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
      cursor = (BigInt(cursor) - base).toString();
    }
    const next = body.data.more && limit !== 1 ? Uint64Schema.safeParse(cursor) : null;
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
    const life = (await this.tablePage('daolife', this.config.runtime, row.id, 1)).rows.find(
      (item) => item.dao_id === row.id,
    );
    if (life && life.state !== 1 && life.state !== 2)
      throw new ApiError('DAO_LIFECYCLE_UNSUPPORTED', 503);
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
      lifecycle: !life ? 'active' : life.state === 1 ? 'closing' : 'closed',
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
  async nativeGovernanceWalletInUse(chainId: string, account: string): Promise<boolean> {
    if (chainId !== this.config.chainId) return false;
    await this.checkWalletChain();
    const abi = await this.api.v1.chain.get_abi(this.config.runtime);
    if (!abi.abi?.tables.some((table) => table.name === 'nativegov')) return false;
    const cfg = (await this.table('nativegov', this.config.runtime, '0', 1))[0];
    if (!cfg?.handed_over) return false;
    const offices = await this.table('executives', cfg.dao_id, '0', 8);
    const bindings = await Promise.all(
      offices.map(async (office) => {
        const [people, actors] = await Promise.all([
          this.table('members', cfg.dao_id, office.member_id, 1),
          this.table('actors', cfg.dao_id, office.member_id, 1),
        ]);
        const member = people[0],
          actor = actors[0];
        return (
          member?.id === office.member_id &&
          member.active &&
          member.native_account === account &&
          !(actor?.id === office.member_id && actor.revoked)
        );
      }),
    );
    return bindings.some(Boolean);
  }
  async pruneExpiredSessions(dao: DaoRef, sessionIds: readonly string[]): Promise<void> {
    if (
      dao.chainId !== this.config.chainId ||
      dao.contract !== this.config.runtime ||
      dao.interfaceVersion !== 1 ||
      sessionIds.length > 16
    )
      throw new ApiError('DAO_REFERENCE');
    const ids = z
      .array(z.string().regex(/^[1-9][0-9]{0,19}$/))
      .max(16)
      .parse(sessionIds);
    await this.reviewedRuntime(dao.contract);
    for (const id of new Set(ids)) {
      if (BigInt(id) > 18446744073709551615n) throw new ApiError('DAO_REFERENCE');
      // The native action checks expiry. The relay can neither remove live sessions nor grant authority.
      await this.push(
        'pruneappses',
        { dao_id: dao.daoId, after: String(BigInt(id) - 1n), limit: 1 },
        this.config.relayActor,
        this.config.relayKey,
      );
    }
  }
  async governance(daoId: string): Promise<GovernanceState> {
    const dao = await this.dao(daoId);
    const abi = await this.api.v1.chain.get_abi(this.config.runtime);
    const available = new Set(abi.abi?.tables.map((table) => table.name));
    const [
      policies,
      actors,
      sessions,
      guardians,
      budgets,
      admission,
      executivePolicies,
      executives,
      excludedVoters,
      nativeGovernance,
      executiveHandovers,
      market,
    ] = await Promise.all([
      this.table('govpolicies', this.config.runtime, daoId, 1),
      this.table('actors', daoId, '0', 5000),
      this.table('sessions', daoId, '0', 5000),
      this.table('guards', this.config.runtime, daoId, 1),
      this.table('budgets', this.config.runtime, daoId, 1),
      available.has('admpolicies') ? this.table('admpolicies', this.config.runtime, daoId, 1) : [],
      available.has('execpols') ? this.table('execpols', this.config.runtime, daoId, 1) : [],
      available.has('executives') ? this.table('executives', daoId, '0', 8) : [],
      available.has('nonvoters') ? this.table('nonvoters', daoId, '0', 5000) : [],
      available.has('nativegov') ? this.table('nativegov', this.config.runtime, '0', 1) : [],
      available.has('execpending') ? this.table('execpending', this.config.runtime, daoId, 1) : [],
      available.has('mktcfg') ? this.table('mktcfg', this.config.runtime, '0', 1) : [],
    ]);
    return GovernanceStateSchema.parse({
      dao: dao.reference,
      policy: policies.find((row) => row.dao_id === daoId) ?? null,
      actors,
      sessions,
      guardian: guardians.find((row) => row.dao_id === daoId) ?? null,
      budget: budgets.find((row) => row.dao_id === daoId) ?? null,
      admission: admission.find((row) => row.dao_id === daoId) ?? null,
      executivePolicy: executivePolicies.find((row) => row.dao_id === daoId) ?? null,
      executives,
      excludedVoters,
      executiveMembers: (
        await Promise.all(
          executives.map((office) => this.table('members', daoId, office.member_id, 1)),
        )
      ).flat(),
      nativeGovernance: nativeGovernance.find((row) => row.dao_id === daoId) ?? null,
      executiveHandover: executiveHandovers.find((row) => row.dao_id === daoId) ?? null,
      nativeSetupEligible:
        market.some((row) => row.dao_id === daoId) ||
        nativeGovernance.some((row) => row.dao_id === daoId),
    });
  }
  async dao(daoId: string): Promise<DaoSummary> {
    const row = (await this.table('daos', this.config.runtime, daoId, 1))[0];
    if (!row || row.id !== daoId) throw new ApiError('DAO_UNKNOWN', 404);
    return this.summary(row);
  }
  async privateAccessPolicy(daoId: string) {
    const row = (await this.table('daos', this.config.runtime, daoId, 1))[0];
    if (!row || row.id !== daoId) throw new ApiError('DAO_UNKNOWN', 404);
    if (row.history_policy > 1) throw new ApiError('DAO_POLICY_UNAVAILABLE', 503);
    const { PrivateAccessPolicySchema } = await import('../../../protocol/content.js');
    return PrivateAccessPolicySchema.parse({
      dao: {
        chainId: this.config.chainId,
        contract: this.config.runtime,
        daoId,
        interfaceVersion: 1,
      },
      privacy: ['public', 'encrypted-managed-allowed', 'encrypted-user-controlled'][row.privacy],
      historyPolicy: row.history_policy === 0 ? 'full-history' : 'from-join',
      keyEpoch: row.key_epoch,
    });
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
  async memberships(account: Account, db: Pick<PoolClient, 'query'> | undefined = this.pool): Promise<UserMembership[]> {
    // ponytail: scans DAOs and their paged members; add a verified membership index when measured scale requires it.
    const daos = await this.listDaos();
    const matches: UserMembership[] = [];
    const wallets = await this.linkedWallets(account.id, db);
    if (wallets.length) await this.checkWalletChain();
    // This read model is intentionally bounded; an indexed projection replaces scans before large deployments.
    for (const dao of daos) {
      const rows = await this.table('members', dao.reference.daoId, '0', 5000);
      const id = await this.memberIdentity(account, dao.reference.daoId, rows, wallets, db);
      const member = rows.find((row) => row.id === id);
      if (member) matches.push(this.membershipView(dao, member));
    }
    return matches;
  }
  async profileKeyMember(daoId: string, memberId: string) {
    await this.reviewedRuntime(this.config.runtime);
    const member = (
      await this.table('members', IdSchema.parse(daoId), IdSchema.parse(memberId), 1)
    )[0];
    if (!member || member.id !== memberId) return null;
    let key: unknown;
    try {
      key = JSON.parse(member.encryption_key);
    } catch {
      return null;
    }
    const encryptionKey = EncryptionPublicKeySchema.safeParse(key);
    return encryptionKey.success
      ? { memberId: member.id, active: member.active, encryptionKey: encryptionKey.data }
      : null;
  }
  async profileKeyRecipients(daoId: string, after?: string) {
    await this.reviewedRuntime(this.config.runtime);
    const start = after === undefined ? '0' : (BigInt(IdSchema.parse(after)) + 1n).toString();
    if (BigInt(start) > (1n << 64n) - 1n) return { recipients: [], next: null };
    const members = await this.table('members', IdSchema.parse(daoId), start, 51);
    const page = members.slice(0, 50);
    const recipients = page.flatMap((member) => {
      if (!member.active) return [];
      let value: unknown;
      try {
        value = JSON.parse(member.encryption_key);
      } catch {
        return [];
      }
      const key = EncryptionPublicKeySchema.safeParse(value);
      return key.success ? [{ memberId: member.id, encryptionKey: key.data }] : [];
    });
    return ProfileRecipientPageSchema.parse({
      recipients,
      next: members.length > 50 ? page.at(-1)?.id : null,
    });
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
  private async linkedWallets(accountId: string, db: Pick<PoolClient, 'query'> | undefined = this.pool): Promise<WalletIdentity[]> {
    if (!db) return [];
    const [native, evm] = await Promise.all([
      db.query<{ native_account: string }>(
        "SELECT native_account FROM native_links WHERE account_id=$1 AND chain_id=$2 AND permission='active'",
        [accountId, this.config.chainId],
      ),
      db.query<{ chain_id: 40 | 41; address: string }>(
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
    db: Pick<PoolClient, 'query'> | undefined = this.pool,
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
    if (!db) return root?.id;
    // A recorded root-key identity survives rotation; a newly paired wallet never creates this association.
    if (root)
      await db.query(
        'INSERT INTO memberships(account_id,chain_id,contract,dao_id,member_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
        [account.id, this.config.chainId, this.config.runtime, daoId, root.id],
      );
    const saved = await db.query<{ member_id: string }>(
      'SELECT member_id::text FROM memberships WHERE account_id=$1 AND chain_id=$2 AND contract=$3 AND dao_id=$4',
      [account.id, this.config.chainId, this.config.runtime, daoId],
    );
    const stored = saved.rows[0]?.member_id;
    if (stored && rows.some((row) => row.id === stored)) ids.add(stored);
    if (ids.size > 1) throw new ApiError('WALLET_MEMBERSHIP_CONFLICT', 409);
    return ids.values().next().value;
  }
  async privateHandover(daoId: string) {
    IdSchema.parse(daoId);
    const { abi } = await this.api.v1.chain.get_abi(this.config.runtime);
    const action = abi?.actions.find((row) => row.name.toString() === 'accepthand');
    const acceptsBinding = abi?.structs
      .find((row) => row.name === action?.type)
      ?.fields.some((field) => field.name === 'expected_commitment');
    if (!acceptsBinding || !abi?.tables.some((row) => row.name === 'handovers'))
      throw new ApiError('PRIVATE_HANDOVER_UNSUPPORTED', 409);
    const page = await this.tablePage('handovers', this.config.runtime, daoId, 1);
    const h = page.rows.find((row) => row.dao_id === daoId);
    if (!h) return null;
    const [daos, from, to, fromActor, toActor, epochs, lifecycle, info] = await Promise.all([
      this.tablePage('daos', this.config.runtime, daoId, 1),
      this.tablePage('members', daoId, h.departing, 1),
      this.tablePage('members', daoId, h.successor, 1),
      this.tablePage('actors', daoId, h.departing, 1),
      this.tablePage('actors', daoId, h.successor, 1),
      this.tablePage('epochs', daoId, h.last_epoch, 2),
      this.tablePage('daolife', this.config.runtime, daoId, 1),
      this.api.v1.chain.get_info(),
    ]);
    const d = daos.rows.find((row) => row.id === daoId);
    if (lifecycle.rows.some((row) => row.dao_id === daoId && row.state !== 1 && row.state !== 2))
      throw new ApiError('DAO_LIFECYCLE_UNSUPPORTED', 503);
    const departing = from.rows.find((row) => row.id === h.departing),
      successor = to.rows.find((row) => row.id === h.successor);
    const stale =
      !d ||
      !d.privacy ||
      d.key_epoch !== h.key_epoch ||
      d.history_policy !== h.history_policy ||
      !departing?.active ||
      !departing.admin ||
      !successor?.active ||
      !successor.admin ||
      (fromActor.rows.find((row) => row.id === h.departing)?.credential_epoch ?? '1') !==
        h.departing_credentials ||
      (toActor.rows.find((row) => row.id === h.successor)?.credential_epoch ?? '1') !==
        h.successor_credentials ||
      (!!successor &&
        Checksum256.hash(new TextEncoder().encode(successor.encryption_key)).toString() !==
          h.successor_key) ||
      epochs.rows.length !== 1 ||
      epochs.rows[0]?.epoch !== h.last_epoch ||
      lifecycle.rows.some((row) => row.dao_id === daoId && row.state === 2);
    return DaoHandoverSchema.parse({
      ...h,
      commitment: privateHandoverCommitment(
        { chainId: this.config.chainId, contract: this.config.runtime, daoId, interfaceVersion: 1 },
        h,
      ),
      status:
        h.expires <= info.head_block_time.toMilliseconds() / 1000
          ? 'expired'
          : stale
            ? 'stale'
            : h.complete && h.accepted
              ? 'ready'
              : 'pending',
    });
  }
  async memberProfile(
    daoId: string,
    memberId: string,
  ): Promise<{ accountName: string | null; profile: string | null }> {
    IdSchema.parse(daoId);
    IdSchema.parse(memberId);
    const page = await this.tablePage('profiles', this.config.runtime, memberId, 1, daoId);
    const row = page.rows.find((item) => item.dao_id === daoId && item.member_id === memberId);
    return row
      ? { accountName: row.account_name, profile: row.profile }
      : { accountName: null, profile: null };
  }
  async publicMembers(value: z.infer<typeof PeopleRoutes.members.query>) {
    const query = PeopleRoutes.members.query.parse(value);
    const daos = await this.tablePage(
      'daos',
      this.config.runtime,
      query.daoId ?? query.onlyDao ?? '0',
      2,
    );
    const dao = daos.rows[0];
    if (
      !dao ||
      (query.onlyDao && dao.id !== query.onlyDao) ||
      (query.memberId && dao.id !== query.daoId)
    )
      return PeopleRoutes.members.response.parse({ members: [], next: null });
    const after = query.memberId ?? (dao.id === query.daoId ? (query.after ?? '0') : '0');
    const page = await this.tablePage('members', dao.id, after, query.memberId ? 1 : 50);
    if (query.memberId && page.rows[0]?.id !== query.memberId)
      return PeopleRoutes.members.response.parse({ members: [], next: null });
    const [published, activity] = page.rows.length
      ? await Promise.all([
          this.people(
            query.memberId ? { daoId: dao.id, memberId: query.memberId } : { daoId: dao.id, after },
          ),
          this.tablePage('memberacts', dao.id, after, query.memberId ? 1 : 50),
        ])
      : [null, null];
    const lastActive = new Map(
      activity?.rows.map((row) => [row.member_id, row.last_active || null]),
    );
    const profiles = new Map(
      published?.profiles.map((person) => [person.memberId, person.profile]),
    );
    const nextDaoId = query.onlyDao || query.memberId ? null : (daos.rows[1]?.id ?? daos.next);
    if (nextDaoId && BigInt(nextDaoId) <= BigInt(dao.id))
      throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return PeopleRoutes.members.response.parse({
      members: page.rows.map((member) => ({
        id: member.id,
        native_account: member.native_account,
        active: member.active,
        identityKey: Checksum256.hash(
          Serializer.encode({ object: PublicKey.from(member.signing_key) }),
        ).toString(),
        lastActive: lastActive.get(member.id) ?? null,
        dao: {
          chainId: this.config.chainId,
          contract: this.config.runtime,
          daoId: dao.id,
          interfaceVersion: 1,
        },
        profile: profiles.get(member.id) ?? null,
      })),
      next:
        page.next && !query.memberId
          ? { daoId: dao.id, after: page.next }
          : nextDaoId
            ? { daoId: nextDaoId, after: '0' }
            : null,
    });
  }
  async people(value: z.infer<typeof PeopleRoutes.list.query>) {
    const query = PeopleRoutes.list.query.parse(value);
    const page = await this.tablePage(
      'profiles',
      this.config.runtime,
      query.memberId ?? query.after ?? '0',
      query.memberId ? 1 : 50,
      query.daoId,
    );
    const profiles: z.infer<typeof PeopleRoutes.list.response>['profiles'] = [];
    let skipped = 0;
    for (const row of page.rows) {
      if (query.memberId && row.member_id !== query.memberId) continue;
      if (query.daoId && row.dao_id !== query.daoId)
        throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
      try {
        const decoded = decodeRawNativeProfile(row);
        if (
          decoded.version === 2 &&
          (decoded.context.chainId !== this.config.chainId ||
            decoded.context.runtime !== this.config.runtime ||
            decoded.context.daoId !== row.dao_id ||
            decoded.context.memberId !== row.member_id)
        )
          throw new Error('PROFILE_CONTEXT');
        const profile =
          decoded.version === 1
            ? decoded.profile
            : PublicProfileSchema.parse({ name: row.account_name });
        if (profile.name !== row.account_name) throw new Error('PROFILE_NAME');
        profiles.push({
          id: row.id,
          dao: {
            chainId: this.config.chainId,
            contract: this.config.runtime,
            daoId: row.dao_id,
            interfaceVersion: 1,
          },
          memberId: row.member_id,
          accountName: row.account_name,
          profile,
        });
      } catch {
        skipped++;
      }
    }
    return PeopleRoutes.list.response.parse({ profiles, next: page.next, skipped });
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
        Action.from({
          account,
          name,
          authorization: [
            {
              actor,
              permission:
                actor === this.config.relayActor
                  ? (this.config.relayPermission ?? 'active')
                  : 'active',
            },
          ],
          data,
        }),
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
    let creationPermission = 'active';
    if (bootstrap.owner === this.config.runtime) {
      const owner = await this.api.v1.chain.get_account(bootstrap.owner);
      const service = owner.permissions.find((p) => p.perm_name.toString() === 'service');
      if (service) {
        const auth = service.required_auth;
        if (
          auth.threshold.toNumber() !== 1 ||
          auth.keys.length !== 1 ||
          auth.accounts.length ||
          auth.waits.length ||
          !auth.keys[0]?.key.equals(bootstrap.key.toPublic())
        )
          throw new ApiError('BOOTSTRAP_UNAVAILABLE', 503);
        creationPermission = 'service';
      }
    }
    const actions = [
      Action.from({
        account: this.config.runtime,
        name: paid ? 'createpaid' : 'createdao',
        authorization: [
          { actor: bootstrap.owner, permission: creationPermission },
          ...(paid && this.config.relayActor !== bootstrap.owner
            ? [
                {
                  actor: this.config.relayActor,
                  permission: this.config.relayPermission ?? 'active',
                },
              ]
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
        authorization: [{ actor: bootstrap.owner, permission: creationPermission }],
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
          authorization: [{ actor: bootstrap.owner, permission: creationPermission }],
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
          authorization: [{ actor: bootstrap.owner, permission: creationPermission }],
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
            authorization: [{ actor: bootstrap.owner, permission: creationPermission }],
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
          // One signing key can satisfy both account authorities; duplicate keys are rejected.
          signatures: [
            bootstrap.key.signDigest(transaction.signingDigest(info.chain_id)),
            ...(paid &&
            this.config.relayActor !== bootstrap.owner &&
            !this.config.relayKey.toPublic().equals(bootstrap.key.toPublic())
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
    scope = this.config.runtime,
  ): Promise<{ rows: T[]; more: boolean }> {
    const response = await fetch(`${this.config.rpcUrl}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: account,
        table,
        scope,
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
  async clearGoverningDocuments(
    input: z.infer<typeof ModuleApiRoutes.clearDocuments.input>,
  ): Promise<{ transactionId: string }> {
    const request = ModuleApiRoutes.clearDocuments.input.parse(input);
    if (
      request.dao.chainId !== this.config.chainId ||
      request.dao.contract !== this.config.runtime ||
      request.dao.interfaceVersion !== 1
    )
      throw new ApiError('DAO_REFERENCE');
    const page = await this.governingDocuments(request.dao.daoId, {});
    if (!page.available || !page.module?.enabled) throw new ApiError('MODULE_UNVERIFIED', 409);
    const result = await this.pushEncoded(
      page.module.deployment.account,
      'cleardocs',
      encodeDecide('cleardocs', {
        runtime: this.config.runtime,
        dao_id: request.dao.daoId,
        proposal_ids: request.proposalIds,
      }),
      this.config.relayActor,
      this.config.relayKey,
    );
    return { transactionId: result.transactionId };
  }
  async governingDocuments(
    daoId: string,
    input: GoverningDocumentQuery,
  ): Promise<GoverningDocumentPage> {
    const query = GoverningDocumentQuerySchema.parse(input);
    const state = await this.moduleState(daoId, {
      activities: 'done',
      ballots: 'done',
      projects: 'done',
      schedules: 'done',
      elections: 'done',
      terms: 'done',
      joinApplications: 'done',
      rounds: 'done',
      applications: 'done',
    });
    const module = state.modules.find((item) => item.deployment.id === 'decide') ?? null;
    const page: GoverningDocumentPage = {
      dao: state.dao,
      module,
      policyRevision: null,
      available: !!module && module.installed && module.compatible && module.codeVerified,
      registrations: [],
      changes: [],
      acceptances: [],
      acceptedAdoptionIds: [],
      ballots: [],
      votes: [],
      next: null,
    };
    if (!page.available || !module) return GoverningDocumentPageSchema.parse(page);
    const runtimeResponse = await fetch(this.config.rpcUrl + '/v1/chain/get_code_hash', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_name: this.config.runtime }),
      signal: AbortSignal.timeout(10000),
    });
    if (!runtimeResponse.ok) throw new ApiError('CHAIN_UNAVAILABLE', 503);
    if (
      z.object({ code_hash: ChainIdSchema }).parse(await runtimeResponse.json()).code_hash !==
      RuntimeCodeHash
    ) {
      page.available = false;
      return GoverningDocumentPageSchema.parse(page);
    }
    const policy = (await this.table('govpolicies', this.config.runtime, daoId, 1))[0];
    if (policy?.dao_id === daoId) page.policyRevision = policy.revision;
    const account = module.deployment.account;
    const one = async <T extends { id: string; dao_id: string }>(
      table: string,
      schema: z.ZodType<T>,
      id: string,
    ) => {
      const found = (await this.moduleRows(account, table, schema, id, id, 1, 'i64', 1)).rows[0];
      if (!found || found.id !== id || found.dao_id !== daoId)
        throw new ApiError('DOCUMENT_UNKNOWN', 404);
      return found;
    };
    const bounded = async <T extends { id: string; dao_id: string }>(
      table: string,
      schema: z.ZodType<T>,
      domainId: string,
      belongs: (row: T) => boolean,
      cursor: (row: T) => string = (row) => row.id,
    ) => {
      const after = query.after ?? '0';
      const result = await this.moduleRows(
        account,
        table,
        schema,
        ((BigInt(domainId) << 64n) | BigInt(after)).toString(),
        ((BigInt(domainId) << 64n) | ((1n << 64n) - 1n)).toString(),
        2,
        'i128',
        25,
      );
      let previous = BigInt(after) - 1n;
      if (result.rows.length > 25) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
      for (const row of result.rows) {
        if (row.dao_id !== daoId || !belongs(row) || BigInt(cursor(row)) <= previous)
          throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
        previous = BigInt(cursor(row));
      }
      const last = result.rows.at(-1);
      if (result.more && (!last || BigInt(cursor(last)) === (1n << 64n) - 1n))
        throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
      page.next = result.more && last ? (BigInt(cursor(last)) + 1n).toString() : null;
      return result.rows;
    };
    if (query.adoptionId) {
      const adopted = await one('docchanges', DecideTableSchemas.docchanges, query.adoptionId);
      if (adopted.status !== 1) throw new ApiError('DOCUMENT_NOT_ADOPTED', 409);
      page.changes = [adopted];
      page.registrations = [await one('docregs', DecideTableSchemas.docregs, adopted.register_id)];
      page.acceptances = await bounded(
        'docaccepts',
        DecideTableSchemas.docaccepts,
        query.adoptionId,
        (row) => row.adoption_id === query.adoptionId,
        (row) => row.member_id,
      );
    } else if (query.registerId) {
      page.registrations = [await one('docregs', DecideTableSchemas.docregs, query.registerId)];
      page.changes = await bounded(
        'docchanges',
        DecideTableSchemas.docchanges,
        query.registerId,
        (row) => row.register_id === query.registerId,
      );
    } else {
      page.registrations = await bounded('docregs', DecideTableSchemas.docregs, daoId, () => true);
      page.changes = await Promise.all(
        page.registrations.flatMap((row) =>
          [row.adopted_id, row.pending_id]
            .filter((id) => id !== '0')
            .map((id) => one('docchanges', DecideTableSchemas.docchanges, id)),
        ),
      );
      if (query.memberId)
        for (const registered of page.registrations) {
          if (registered.adopted_id === '0') continue;
          const key = ((BigInt(registered.adopted_id) << 64n) | BigInt(query.memberId)).toString();
          const accepted = await this.moduleRows(
            account,
            'docaccepts',
            DecideTableSchemas.docaccepts,
            key,
            key,
            2,
            'i128',
            1,
          );
          if (
            accepted.rows.some(
              (row) =>
                row.dao_id === daoId &&
                row.adoption_id === registered.adopted_id &&
                row.member_id === query.memberId,
            )
          )
            page.acceptedAdoptionIds.push(registered.adopted_id);
        }
    }
    const ballotIds = [
      ...new Set(page.changes.filter((row) => row.ballot_id !== '0').map((row) => row.ballot_id)),
    ];
    page.ballots = await Promise.all(
      ballotIds.map((id) => one('ballots', DecideTableSchemas.ballots, id)),
    );
    if (query.memberId)
      for (const id of ballotIds) {
        const key = ((BigInt(id) << 64n) | BigInt(query.memberId)).toString();
        const votes = await this.moduleRows(
          account,
          'votes',
          DecideTableSchemas.votes,
          key,
          key,
          2,
          'i128',
          1,
        );
        page.votes.push(
          ...votes.rows.filter((row) => row.ballot === id && row.member === query.memberId),
        );
      }
    return GoverningDocumentPageSchema.parse(page);
  }
  async moduleState(daoId: string, query?: ModulePageQuery): Promise<ModuleState> {
    if (query === undefined) {
      const all = await this.moduleState(daoId, {});
      while (Object.values(all.next).some((cursor) => cursor !== null)) {
        const page = await this.moduleState(daoId, {
          activities: all.next.activities ?? 'done',
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
        all.activities.push(...page.activities);
        all.activityReviews.push(...page.activityReviews);
        all.activityDecisions.push(...page.activityDecisions);
        all.appKeys.push(...page.appKeys);
        all.appKeyGrants.push(...page.appKeyGrants);
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
      activities: null,
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
    let activities: ModuleState['activities'] = [],
      activityReviews: ModuleState['activityReviews'] = [],
      activityDecisions: ModuleState['activityDecisions'] = [],
      appKeys: ModuleState['appKeys'] = [],
      appKeyGrants: ModuleState['appKeyGrants'] = [];
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
          version: manifest.version,
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
      if (deployment.id === 'activity' && query.activities !== 'done') {
        const page = await this.moduleRows(
          deployment.account,
          'activities',
          ActivityTableSchemas.activities,
          query.activities ?? '0',
          ((1n << 64n) - 1n).toString(),
          1,
          'i64',
          50,
        );
        activities = page.rows.filter((row) => row.dao_id === daoId);
        const last = page.rows.at(-1);
        next.activities =
          page.more && last && BigInt(last.id) < (1n << 64n) - 1n
            ? (BigInt(last.id) + 1n).toString()
            : null;
        for (const receipt of activities) {
          const [reviews, decisions, keys] = await Promise.all([
            this.moduleRows(
              deployment.account,
              'actreviews',
              ActivityTableSchemas.actreviews,
              receipt.id,
              receipt.id,
              1,
              'i64',
              1,
            ),
            this.moduleRows(
              deployment.account,
              'actdecisions',
              ActivityTableSchemas.actdecisions,
              receipt.id,
              receipt.id,
              1,
              'i64',
              1,
            ),
            receipt.key_epoch === '0'
              ? Promise.resolve({ rows: [], more: false })
              : this.moduleRows(
                  deployment.account,
                  'appkeys',
                  ActivityTableSchemas.appkeys,
                  receipt.key_epoch,
                  receipt.key_epoch,
                  1,
                  'i64',
                  1,
                ),
          ]);
          activityReviews.push(
            ...reviews.rows.filter((row) => row.id === receipt.id && row.dao_id === daoId),
          );
          activityDecisions.push(
            ...decisions.rows.filter((row) => row.id === receipt.id && row.dao_id === daoId),
          );
          appKeys.push(
            ...keys.rows.filter((row) => row.dao_id === daoId && row.app_id === receipt.app_id),
          );
          if (query.memberId && receipt.key_epoch !== '0') {
            const domain = ((BigInt(receipt.key_epoch) << 64n) | BigInt(query.memberId)).toString(),
              grants = await this.moduleRows(
                deployment.account,
                'appgrants',
                ActivityTableSchemas.appgrants,
                domain,
                domain,
                2,
                'i128',
                1,
              );
            appKeyGrants.push(
              ...grants.rows.filter(
                (row) =>
                  row.dao_id === daoId &&
                  row.recipient === query.memberId &&
                  row.key_epoch === receipt.key_epoch,
              ),
            );
          }
        }
      }
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
      activities,
      activityReviews,
      activityDecisions,
      appKeys,
      appKeyGrants,
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
        ...(parsed.data.cpu_limit.max === undefined ? {} : { cpuMax: parsed.data.cpu_limit.max }),
        ...(parsed.data.net_limit.max === undefined ? {} : { netMax: parsed.data.net_limit.max }),
        ramQuota: parsed.data.ram_quota,
        ramUsage: parsed.data.ram_usage,
      })
    )
      throw new ApiError('RELAY_RESOURCES', 503);
  }
  async prepareSettlement(input:unknown):Promise<ExitSubmission>{
    const signed=SignedExitInstructionSchema.parse(input);if(!['withdraw','unstake'].includes(signed.request.action))throw new ApiError('EXIT_SETTLEMENT_SCOPE',403);
    return this.prepareExitSubmission(signed);
  }
  async submitSettlement(input:ExitSubmission):Promise<{transactionId:string}>{
    const {transaction}=await this.exitPacket(input),action=transaction.actions[0];if(!action)throw new ApiError('EXIT_PACKET',403);
    const decoded=z.object({request:z.object({action:z.string()})}).parse(Serializer.objectify(Serializer.decode({abi:runtimeAbi,type:action.name.toString(),data:action.data})));
    if(!['withdraw','unstake'].includes(decoded.request.action))throw new ApiError('EXIT_SETTLEMENT_SCOPE',403);
    return this.submitPreparedExit(input);
  }
  async prepareExitSubmission(input:unknown):Promise<ExitSubmission>{
    const signed=SignedExitInstructionSchema.parse(input),request=signed.request;
    await this.reviewedRuntime(this.config.runtime);
    if(request.chain_id!==this.config.chainId||request.deployment!==this.config.runtime)throw new ApiError('INSTRUCTION_DOMAIN',403);
    const member=(await this.table('members',request.dao_id,request.member_id,1))[0];
    if(!member||member.id!==request.member_id||member.nonce!==request.nonce)throw new ApiError('EXIT_MEMBER_CHANGED',409);
    let name:'submitexit'|'exitevm'='submitexit';
    if('sig' in signed){
      let valid=false;try{valid=Signature.from(signed.sig).verifyDigest(exitInstructionDigest(signed.operation,signed.step_digest,request),PublicKey.from(member.signing_key));}catch{}
      if(!valid)throw new ApiError('SIGNATURE_INVALID',403);
    }else if('proof' in signed){
      name='exitevm';const binding=await this.evmBinding(request.dao_id,request.member_id),chainId=Number(signed.evm_chain_id);
      if(!binding?.active||binding.chain_id!==signed.evm_chain_id||binding.address!==signed.address||binding.epoch!==signed.binding_epoch||(chainId!==40&&chainId!==41))throw new ApiError('EVM_BINDING',409);
      try{const typed=exitGovernanceTypedData(signed.operation,signed.step_digest,request,{chainId,address:'0x'+signed.address,epoch:signed.binding_epoch});if(recoverEvmDigest(evmTypedDigest(typed),canonicalEvmSignature('0x'+signed.proof))!=='0x'+signed.address)throw Error('Signature');}catch{throw new ApiError('EVM_SIGNATURE_INVALID',401);}
    }else{
      exitInstructionDigest(signed.operation,signed.step_digest,request);
      if(member.native_account!==signed.account)throw new ApiError('EXIT_SIGNER_REQUIRED',403);
      const transaction=Serializer.decode({type:Transaction,data:signed.packedTransaction}),expected=Action.from({account:this.config.runtime,name:'exitnative',authorization:[{actor:signed.account,permission:signed.permission}],data:encodeAction('exitnative',{operation:signed.operation,step_digest:signed.step_digest,request})});
      if(Serializer.encode({object:transaction}).hexString!==signed.packedTransaction||!transaction.actions[0]?.equals(expected)||transaction.actions.length!==1||transaction.expiration.toMilliseconds()<=Date.now()||transaction.expiration.toMilliseconds()>Date.now()+61000)throw new ApiError('EXIT_PACKET',403);
      const info=await this.api.v1.chain.get_info();if(info.chain_id.toString()!==this.config.chainId)throw new ApiError('CHAIN_ID_MISMATCH',503);
      const packet=ExitSubmissionSchema.parse({transactionId:transaction.id.toString(),packet:Serializer.encode({object:SignedTransaction.from({...transaction,signatures:signed.signatures})}).hexString,firstBlock:Number(info.head_block_num),cursor:Number(info.head_block_num),expiresAt:transaction.expiration.toDate().toISOString()});
      await this.exitPacket(packet);return packet;
    }
    await this.assertResources(this.config.relayActor);
    const info=await this.api.v1.chain.get_info();if(info.chain_id.toString()!==this.config.chainId)throw new ApiError('CHAIN_ID_MISMATCH',503);
    const transaction=Transaction.from({...info.getTransactionHeader(60),actions:[Action.from({account:this.config.runtime,name,authorization:[{actor:this.config.relayActor,permission:this.config.relayPermission??'active'}],data:encodeAction(name,signed)})]});
    const packet=SignedTransaction.from({...transaction,signatures:[this.config.relayKey.signDigest(transaction.signingDigest(info.chain_id))]});
    return ExitSubmissionSchema.parse({transactionId:transaction.id.toString(),packet:Serializer.encode({object:packet}).hexString,firstBlock:Number(info.head_block_num),cursor:Number(info.head_block_num),expiresAt:transaction.expiration.toDate().toISOString()});
  }
  private async exitPacket(input:ExitSubmission,scoped=false){
    const packet=ExitSubmissionSchema.parse(input),transaction=Serializer.decode({type:SignedTransaction,data:packet.packet});
    if(Serializer.encode({object:transaction}).hexString!==packet.packet||transaction.id.toString()!==packet.transactionId||transaction.actions.length!==1||transaction.signatures.length<1||transaction.signatures.length>32||transaction.context_free_actions.length||transaction.context_free_data.length||transaction.transaction_extensions.length||Number(transaction.delay_sec)!==0||transaction.expiration.toDate().toISOString()!==packet.expiresAt)throw new ApiError('EXIT_PACKET',403);
    const action=transaction.actions[0];if(!action||action.account.toString()!==this.config.runtime||action.authorization.length!==1)throw new ApiError('EXIT_PACKET',403);
    const authorization=action.authorization[0];if(!authorization)throw new ApiError('EXIT_PACKET',403);
    if(!scoped&&action.name.toString()==='exitnative'){
      const account=await this.api.v1.chain.get_account(authorization.actor),permission=account.permissions.find(value=>value.perm_name.toString()===authorization.permission.toString());
      if(authorization.permission.toString()!=='active'||!permission)throw new ApiError('EXIT_PACKET',403);
      checkNativeAuthority(transaction.transaction,transaction.signatures.map(value=>value.toString()),this.config.chainId,permission.required_auth);
    }else{
      if(!(scoped?['submitsess']:['submitexit','exitevm']).includes(action.name.toString())||transaction.signatures.length!==1||authorization.actor.toString()!==this.config.relayActor||authorization.permission.toString()!==(this.config.relayPermission??'active'))throw new ApiError('EXIT_PACKET',403);
      const signature=transaction.signatures[0];if(!signature||!signature.verifyDigest(transaction.transaction.signingDigest(this.config.chainId),this.config.relayKey.toPublic()))throw new ApiError('EXIT_PACKET',403);
    }
    return {packet,transaction};
  }
  async submitPreparedExit(input:ExitSubmission):Promise<{transactionId:string}>{
    const {packet,transaction}=await this.exitPacket(input);await this.reviewedRuntime(this.config.runtime);
    const result=executedChainResult(await this.api.v1.chain.push_transaction(transaction),packet.transactionId);
    await this.confirmBlock(result.blockNum);return {transactionId:result.transactionId};
  }
  async reconcileExitSubmission(input:ExitSubmission):Promise<{state:'confirmed'|'pending'|'unavailable';cursor:number}>{
    return this.reconcilePacket(input,false);
  }
  async reconcileScopedSubmission(input:ExitSubmission):Promise<{state:'confirmed'|'pending'|'unavailable';cursor:number}>{
    return this.reconcilePacket(input,true);
  }
  private async reconcilePacket(input:ExitSubmission,scoped:boolean):Promise<{state:'confirmed'|'pending'|'unavailable';cursor:number}>{
    const {packet}=await this.exitPacket(input,scoped);await this.reviewedRuntime(this.config.runtime);
    try{const result=await this.api.v1.chain.get_transaction_status(packet.transactionId);if(result.state==='IRREVERSIBLE')return {state:'confirmed',cursor:packet.cursor};}catch{/* Nodes may not enable finality tracking; reconcile the exact ID in irreversible blocks. */}
    const info=await this.api.v1.chain.get_info();if(info.chain_id.toString()!==this.config.chainId)throw new ApiError('CHAIN_ID_MISMATCH',503);
    const end=Math.min(Number(info.last_irreversible_block_num),packet.firstBlock+128,packet.cursor+24);
    for(let cursor=packet.cursor;cursor<=end;cursor++){
      const value=await this.api.call({path:'/v1/chain/get_block',params:{block_num_or_id:cursor}});
      const block=z.object({block_num:z.int(),timestamp:z.string(),transactions:z.array(z.object({status:z.string(),trx:z.union([z.string(),z.object({id:ChainIdSchema})])}))}).parse(value);
      if(block.block_num!==cursor)throw new ApiError('EXIT_RECEIPT',503);
      if(block.transactions.some(item=>(typeof item.trx==='string'?item.trx:item.trx.id)===packet.transactionId&&item.status==='executed'))return {state:'confirmed',cursor};
      if(Date.parse(block.timestamp+(block.timestamp.endsWith('Z')?'':'Z'))>Date.parse(packet.expiresAt))return {state:'unavailable',cursor};
    }
    return {state:packet.cursor>=packet.firstBlock+128?'unavailable':'pending',cursor:end>=packet.cursor?end+1:packet.cursor};
  }
  private async checkRelayAuthority(account:Account,request:instruction,signature:string,sessionId?:string):Promise<void>{
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
    let signingKey = member.signing_key;
    if (sessionId !== undefined) {
      IdSchema.parse(sessionId);
      const credential = (await this.table('sessions', request.dao_id, sessionId, 1))[0];
      if (!credential || credential.id !== sessionId || credential.member_id !== request.member_id)
        throw new ApiError('MEMBERSHIP_REQUIRED', 403);
      signingKey = credential.signing_key;
    }
    let valid = false;
    try {
      valid = Signature.from(signature).verifyDigest(
        instructionDigest(request),
        PublicKey.from(signingKey),
      );
    } catch {
      valid = false;
    }
    if (!valid) throw new ApiError('SIGNATURE_INVALID', 403);
  }
  async prepareScopedSubmission(account:Account,request:instruction,signature:string,sessionId:string):Promise<ExitSubmission>{
    await this.reviewedRuntime(this.config.runtime);
    if(request.chain_id!==this.config.chainId||request.deployment!==this.config.runtime||request.version!==1)throw new ApiError('INSTRUCTION_DOMAIN',403);
    if(!['open','vote','review','recordact'].includes(request.action)||request.target===this.config.runtime)throw new ApiError('MCP_SCOPE_REQUIRED',403);
    await this.checkRelayAuthority(account,request,signature,sessionId);
    await this.assertResources(this.config.relayActor);
    const info=await this.api.v1.chain.get_info();if(info.chain_id.toString()!==this.config.chainId)throw new ApiError('CHAIN_ID_MISMATCH',503);
    const transaction=Transaction.from({...info.getTransactionHeader(60),actions:[Action.from({account:this.config.runtime,name:'submitsess',authorization:[{actor:this.config.relayActor,permission:this.config.relayPermission??'active'}],data:encodeAction('submitsess',{request,session_id:sessionId,sig:signature})})]});
    const signed=SignedTransaction.from({...transaction,signatures:[this.config.relayKey.signDigest(transaction.signingDigest(info.chain_id))]});
    return ExitSubmissionSchema.parse({transactionId:transaction.id.toString(),packet:Serializer.encode({object:signed}).hexString,firstBlock:Number(info.head_block_num),cursor:Number(info.head_block_num),expiresAt:transaction.expiration.toDate().toISOString()});
  }
  async submitPreparedScoped(input:ExitSubmission):Promise<{transactionId:string}>{
    const {packet,transaction}=await this.exitPacket(input,true);await this.reviewedRuntime(this.config.runtime);
    const result=executedChainResult(await this.api.v1.chain.push_transaction(transaction),packet.transactionId);
    await this.confirmBlock(result.blockNum);return {transactionId:result.transactionId};
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
    if (
      request.target === this.config.runtime &&
      request.action === 'setprofile' &&
      (await this.network()).capabilities.includes('encrypted-profiles-v2')
    )
      throw new ApiError('PROFILE_ENCRYPTION_REQUIRED', 409);
    await this.checkRelayAuthority(account,request,signature,sessionId);
    if (sessionId !== undefined) {
      return this.push(
        'submitsess',
        { request, session_id: sessionId, sig: signature },
        this.config.relayActor,
        this.config.relayKey,
      );
    }
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
  nameService(query?: import('../../../protocol/service-api.js').NamesInventoryQuery) {
    return readNameService(this.config.rpcUrl, this.config.runtime, query);
  }
  async nameQuote(accountName: string): Promise<NameQuote> {
    const name = TelosNameSchema.parse(accountName);
    const service = await readNameService(this.config.rpcUrl, this.config.runtime, {
      accountName: name,
    });
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
    if (quote.party !== 'first-party') throw new ApiError('NAME_CARD_ROUTING', 409);
    const policyRows = await readChainRows({
      rpcUrl: this.config.rpcUrl,
      code: namesAccount,
      scope: namesAccount,
      table: 'profitcfg',
      limit: 1,
    });
    const policy =
      policyRows.status === 'rows' && policyRows.rows.length > 0
        ? NamesTableSchemas.profitcfg.parse(policyRows.rows[0])
        : undefined;
    const dynamic =
      policy !== undefined &&
      quote.kind === 'basic' &&
      quote.party === 'first-party' &&
      !quote.listed &&
      !quote.suffix;
    if ((await this.api.v1.chain.get_raw_abi(namesAccount)).code_hash.toString() !== NamesCodeHash)
      throw new ApiError('NAMES_UNCONFIGURED', 503);
    if (purchase.netUsdCents === undefined) throw new ApiError('NAME_NET_REQUIRED', 409);
    if (!dynamic && (quote.usdCents !== purchase.usdCents || quote.usdCents < 1))
      throw new ApiError('NAME_PRICE', 409);
    const actionName = 'fulfillnet';
    const value = {
      settler: this.config.relayActor,
      account_name: purchase.accountName,
      owner_key: purchase.ownerKey,
      active_key: purchase.activeKey,
      usd_cents: purchase.usdCents,
      reference: purchase.reference,
    };
    const input = NamesActionSchemas.fulfillnet.parse({
      ...value,
      net_usd_cents: purchase.netUsdCents,
    });
    const data = Serializer.encode({
      abi: ABI.from(namesAbi),
      type: actionName,
      object: input,
    }).array;
    try {
      await this.pushEncoded(
        namesAccount,
        actionName,
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
