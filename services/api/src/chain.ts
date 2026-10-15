import type { ContactRecoveryState } from '../../../protocol/contact-recovery.js';
import type {
  ContentPageQuery,
  DaoContent,
  PrivateAccessPolicy,
} from '../../../protocol/content.js';
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
import type { DaoHandover } from '../../../protocol/account-exit.js';
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
  contactRecoveryGrant?(
    input: import('../../../protocol/contact-recovery.js').ContactRecoveryGrantQuery,
  ): Promise<{ grant: import('../../../protocol/crypto.js').EpochGrant | null }>;
  accountRecoveryIdentity?(signingKey: string): Promise<{
    network: Pick<Network, 'chainId' | 'runtime'>;
    identity: NonNullable<ContactRecoveryState['identity']>;
  } | null>;
  accountKeyRetired?(signingKey: string): Promise<boolean>;
  contactRecovery?(
    target: import('../../../protocol/contact-recovery.js').ContactRecoveryTarget,
    after?: string,
  ): Promise<import('../../../protocol/contact-recovery.js').ContactRecoveryState>;
  submitContactRecovery?(
    input: import('../../../protocol/contact-recovery.js').ContactRecoverySubmit,
  ): Promise<{ transactionId: string }>;
  quickBallots?: import('./quick-ballots/service.js').QuickGateway;
  arbitration?(
    input: z.infer<typeof import('@daclify/modules').ModuleApiRoutes.arbitration.input>,
  ): Promise<z.infer<typeof import('@daclify/modules').ModuleApiRoutes.arbitration.response>>;
  ballotExport?(daoId: string, ballotId: string): Promise<import('@daclify/modules').BallotExport>;
  moduleFeePricing?(): Promise<import('../../../protocol/module-fees.js').ModuleFeePricing>;
  moduleFeeState?(dao: DaoRef): Promise<import('../../../protocol/module-fees.js').ModuleFeeChain>;
  attestModuleTerm?(
    dao: DaoRef,
    account: string,
    expectedReceipt: string,
    expires: number,
    receipt: string,
  ): Promise<void>;
  revokeModuleTerm?(dao: DaoRef, account: string, receipt: string): Promise<void>;
  resumeModuleTerm?(dao: DaoRef, account: string, receipt: string): Promise<void>;
  connectedApps?: import('./connected-apps/chain.js').ConnectedAppsChain;
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
  pruneExpiredSessions?(dao: DaoRef, sessionIds: readonly string[]): Promise<void>;
  execute(input: ExecutionRequest): Promise<ExecutionResult>;
  treasury(daoId: string): Promise<Treasury>;
  settle(input: SettlementRequest): Promise<SettlementResult>;
  finalize(input: FinalizationRequest): Promise<FinalizationResult>;
  contentDocument(
    daoId: string,
    documentId: string,
    version: number,
  ): Promise<{
    dao: DaoRef;
    document: DaoContent['documents'][number] | null;
  }>;
  content(daoId: string, query?: ContentPageQuery): Promise<DaoContent>;
  privateAccessPolicy?(daoId: string): Promise<PrivateAccessPolicy>;
  privateHandover?(daoId: string): Promise<DaoHandover | null>;
  dao(daoId: string): Promise<DaoSummary>;
  network(): Promise<Network>;
  moduleState(daoId: string, query?: ModulePageQuery): Promise<ModuleState>;
  governingDocuments?(
    daoId: string,
    query: import('@daclify/modules').GoverningDocumentQuery,
  ): Promise<import('@daclify/modules').GoverningDocumentPage>;
  clearGoverningDocuments?(
    input: z.infer<typeof import('@daclify/modules').ModuleApiRoutes.clearDocuments.input>,
  ): Promise<{ transactionId: string }>;
  listDaosPage?(after?: string): Promise<{ daos: DaoSummary[]; next: string | null }>;
  listDaos(): Promise<DaoSummary[]>;
  memberships(
    account: Account,
    db?: Pick<import('pg').PoolClient, 'query'>,
  ): Promise<UserMembership[]>;
  profileKeyMember?(
    daoId: string,
    memberId: string,
  ): Promise<
    (import('../../../protocol/profiles.js').ProfileRecipient & { active: boolean }) | null
  >;
  profileKeyRecipients?(
    daoId: string,
    after?: string,
  ): Promise<import('../../../protocol/profiles.js').ProfileRecipientPage>;
  memberProfile(
    daoId: string,
    memberId: string,
  ): Promise<{ accountName: string | null; profile: string | null }>;
  createDao(account: Account, input: z.infer<typeof CreateDaoSchema>): Promise<DaoSummary>;
  attestHostedClosure?(dao: DaoRef, receipt: string): Promise<void>;
  prepareSettlement?(
    input: unknown,
  ): Promise<import('../../../protocol/account-exit.js').ExitSubmission>;
  submitSettlement?(
    packet: import('../../../protocol/account-exit.js').ExitSubmission,
  ): Promise<{ transactionId: string }>;
  prepareExitSubmission?(
    input: unknown,
  ): Promise<import('../../../protocol/account-exit.js').ExitSubmission>;
  submitPreparedExit?(
    packet: import('../../../protocol/account-exit.js').ExitSubmission,
  ): Promise<{ transactionId: string }>;
  reconcileExitSubmission?(
    packet: import('../../../protocol/account-exit.js').ExitSubmission,
  ): Promise<{ state: 'confirmed' | 'pending' | 'unavailable'; cursor: number }>;
  relay(
    account: Account,
    request: instruction,
    signature: string,
    sessionId?: string,
  ): Promise<{ transactionId: string }>;
  prepareScopedSubmission?(
    account: Account,
    request: instruction,
    signature: string,
    sessionId: string,
  ): Promise<import('../../../protocol/account-exit.js').ExitSubmission>;
  submitPreparedScoped?(
    packet: import('../../../protocol/account-exit.js').ExitSubmission,
  ): Promise<{ transactionId: string }>;
  reconcileScopedSubmission?(
    packet: import('../../../protocol/account-exit.js').ExitSubmission,
  ): Promise<{ state: 'confirmed' | 'pending' | 'unavailable'; cursor: number }>;
}
