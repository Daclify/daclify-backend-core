import type { DaoContent } from '../../../protocol/content.js';
import type { Treasury, SettlementRequest, SettlementResult } from '../../../protocol/treasury.js';
import type { ModuleState, FinalizationRequest, FinalizationResult } from '@daclify/modules';
import type { DaoSummary, Network, Account, UserMembership } from '../../../protocol/api.js';
import type { instruction } from '../../../sdk/index.js';
import type { CreateDaoSchema } from '../../../protocol/api.js';
import type { z } from 'zod';
import type { GovernanceState } from '../../../protocol/dao.js';
import type { ExecutionRequest, ExecutionResult } from '@daclify/modules';
export interface ChainGateway {
  governance(daoId: string): Promise<GovernanceState>;
  execute(input: ExecutionRequest): Promise<ExecutionResult>;
  treasury(daoId: string): Promise<Treasury>;
  settle(input: SettlementRequest): Promise<SettlementResult>;
  finalize(input: FinalizationRequest): Promise<FinalizationResult>;
  content(daoId: string): Promise<DaoContent>;
  dao(daoId: string): Promise<DaoSummary>;
  network(): Promise<Network>;
  moduleState(daoId: string): Promise<ModuleState>;
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
