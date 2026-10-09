import type { ContentPageQuery, DaoContent } from '../../../protocol/content.js';
import type { Treasury, SettlementRequest, SettlementResult } from '../../../protocol/treasury.js';
import type {
  ModulePageQuery,
  ModuleState,
  FinalizationRequest,
  FinalizationResult,
} from '@daclify/modules';
import type {
  DaoSummary,
  Network,
  Account,
  UserMembership,
  WalletIdentity,
} from '../../../protocol/api.js';
import type { RuntimeActions } from '../../../sdk/generated/runtime.js';
import type { instruction } from '../../../sdk/index.js';
import type { EvmRelay } from '../../../protocol/evm-wallet.js';
import type { RuntimeTableSchemas } from '../../../sdk/generated/schemas.js';
import type { CreateDaoSchema } from '../../../protocol/api.js';
import type { z } from 'zod';
import type { GovernanceState } from '../../../protocol/dao.js';
import type { ExecutionRequest, ExecutionResult } from '@daclify/modules';
import type { DaoRef } from '../../../protocol/base.js';
import type { PaymentPolicy } from '../../../protocol/payments.js';
import type {
  ResourcePolicy,
  RamUsage,
  RamQuote,
  RamQuoteRequest,
} from '../../../protocol/resources.js';
import type { HostingChain } from '../../../protocol/hosting.js';
import type { HubDirectorySchema } from '../../../protocol/directory.js';
import type {
  ArchiveSelection,
  OrdinaryPollArchivePlan,
  ArchivePruneBatch,
  ArchiveProgressSchema,
} from '@daclify/modules/archive';
export interface ChainGateway {
  publicMembers?(
    query: z.infer<typeof import('../../../protocol/people.js').PeopleRoutes.members.query>,
  ): Promise<z.infer<typeof import('../../../protocol/people.js').PeopleRoutes.members.response>>;
  people?(
    query: z.infer<typeof import('../../../protocol/people.js').PeopleRoutes.list.query>,
  ): Promise<z.infer<typeof import('../../../protocol/people.js').PeopleRoutes.list.response>>;
  archiveLiveVotes?(
    input: z.infer<typeof import('@daclify/modules/archive').ArchiveLiveVotesRequestSchema>,
  ): Promise<z.infer<typeof import('@daclify/modules/archive').ArchiveLiveVotesSchema>>;
  archiveHistory?(
    input: z.infer<typeof import('@daclify/modules/archive').ArchiveHistoryRequestSchema>,
  ): Promise<z.infer<typeof import('@daclify/modules/archive').ArchiveHistoryListSchema>>;
  archiveAnchor?(
    dao: DaoRef,
    manifestCommitment: string,
  ): Promise<z.infer<typeof RuntimeTableSchemas.archives> | null>;
  attestArchive?(
    input: RuntimeActions['archattest'],
  ): Promise<z.infer<typeof RuntimeTableSchemas.archives>>;
  archiveProgress?(
    dao: DaoRef,
    manifestCommitment: string,
  ): Promise<z.infer<typeof ArchiveProgressSchema>>;
  pruneArchive?(dao: DaoRef, manifestCommitment: string, input: ArchivePruneBatch): Promise<void>;
  archivePreview?(input: ArchiveSelection): Promise<OrdinaryPollArchivePlan>;
  resourcePolicy?(): Promise<ResourcePolicy | null>;
  ramUsage?(daoId: string): Promise<RamUsage>;
  ramQuote?(input: RamQuoteRequest): Promise<RamQuote>;
  hosting?(dao: DaoRef): Promise<HostingChain>;
  attestCapacity?(dao: DaoRef, members: number, expires: number, receipt: string): Promise<void>;
  restoreCapacity?(dao: DaoRef, receipt: string): Promise<void>;
  revokeCapacity?(dao: DaoRef, receipt: string): Promise<void>;
  paymentPolicy?(): Promise<PaymentPolicy>;
  paymentMemberships?(account: Account, dao: DaoRef): Promise<UserMembership[]>;
  hubDirectory?(after?: string): Promise<z.infer<typeof HubDirectorySchema>>;
  walletMemberships?(wallet: WalletIdentity): Promise<UserMembership[]>;
  evmBinding?(
    daoId: string,
    memberId: string,
  ): Promise<z.infer<typeof RuntimeTableSchemas.evmbindings> | null>;
  relayEvm?(account: Account, input: EvmRelay): Promise<{ transactionId: string }>;
  nativeGovernanceWalletInUse?(chainId: string, account: string): Promise<boolean>;
  governance(daoId: string): Promise<GovernanceState>;
  execute(input: ExecutionRequest): Promise<ExecutionResult>;
  treasury(daoId: string): Promise<Treasury>;
  settle(input: SettlementRequest): Promise<SettlementResult>;
  finalize(input: FinalizationRequest): Promise<FinalizationResult>;
  content(daoId: string, query?: ContentPageQuery): Promise<DaoContent>;
  dao(daoId: string): Promise<DaoSummary>;
  network(): Promise<Network>;
  moduleState(daoId: string, query?: ModulePageQuery): Promise<ModuleState>;
  listDaosPage?(after?: string): Promise<{ daos: DaoSummary[]; next: string | null }>;
  listDaos(): Promise<DaoSummary[]>;
  memberships(account: Account): Promise<UserMembership[]>;
  memberProfile(
    daoId: string,
    memberId: string,
  ): Promise<{ accountName: string | null; profile: string | null }>;
  createDao(account: Account, input: z.infer<typeof CreateDaoSchema>): Promise<DaoSummary>;
  relay(
    account: Account,
    request: instruction,
    signature: string,
    sessionId?: string,
  ): Promise<{ transactionId: string }>;
}
