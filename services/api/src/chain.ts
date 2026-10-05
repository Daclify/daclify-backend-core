import type { DaoContent } from '../../../protocol/content.js';
import type { Treasury, SettlementRequest, SettlementResult } from '../../../protocol/treasury.js';
import type { ModuleState, FinalizationRequest, FinalizationResult } from '@daclify/modules';
import type { DaoSummary, Network, Account, UserMembership } from '../../../protocol/api.js';
import type { instruction } from '../../../sdk/index.js';
import type { CreateDaoSchema } from '../../../protocol/api.js';
import type { z } from 'zod';
export interface ChainGateway {
  treasury(daoId: string): Promise<Treasury>;
  settle(input: SettlementRequest): Promise<SettlementResult>;
  finalize(input: FinalizationRequest): Promise<FinalizationResult>;
  content(daoId: string): Promise<DaoContent>;
  dao(daoId: string): Promise<DaoSummary>;
  network(): Promise<Network>;
  moduleState(daoId: string): Promise<ModuleState>;
  listDaos(): Promise<DaoSummary[]>;
  memberships(account: Account): Promise<UserMembership[]>;
  createDao(account: Account, input: z.infer<typeof CreateDaoSchema>): Promise<DaoSummary>;
  relay(
    account: Account,
    request: instruction,
    signature: string,
  ): Promise<{ transactionId: string }>;
}
