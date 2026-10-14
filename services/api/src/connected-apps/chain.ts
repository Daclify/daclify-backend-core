import type { z } from 'zod';
import type { Account, Network, UserMembership } from '../../../../protocol/api.js';
import type { RuntimeTableSchemas } from '../../../../sdk/generated/schemas.js';
import type { instruction } from '../../../../sdk/index.js';
export interface ConnectedAppsChain {
  admission?: {
    source(): string | null;
    gateway(): { account: string; permission: string };
    policy(daoId: string, appId: string): Promise<z.infer<typeof import('../../../../sdk/app-admission.js').AppJoinTableSchemas.appjoins> | null>;
    invitation(daoId: string, id: string): Promise<z.infer<typeof import('../../../../sdk/app-admission.js').AppJoinTableSchemas.appinvites> | null>;
    member(account: Account, daoId: string): Promise<z.infer<typeof import('../../../../protocol/connected-apps.js').AppAdmissionMemberSchema> | null>;
    admit(account: Account, app: import('../../../../protocol/connected-apps.js').ConnectedAppConfig, invitationId: string, tokenHash: string, proof?: {expires:number;signature:string}): Promise<void>;
  };
  keys(
    app: import('../../../../protocol/connected-apps.js').ConnectedAppConfig,
    memberId: string,
  ): Promise<z.infer<typeof import('@daclify/modules').ModuleApiRoutes.appKeys.response>>;
  activity(
    app: import('../../../../protocol/connected-apps.js').ConnectedAppConfig,
    query: z.infer<typeof import('../../../../protocol/connected-apps.js').AppActivityQuerySchema>,
  ): Promise<
    z.infer<typeof import('../../../../protocol/connected-apps.js').AppActivityPageSchema>
  >;
  network(): Promise<Network>;
  registry(daoId: string): Promise<z.infer<typeof RuntimeTableSchemas.appregs>[]>;
  membership(account: Account, daoId: string): Promise<UserMembership | null>;
  session(
    daoId: string,
    id: string,
  ): Promise<{
    credential: z.infer<typeof RuntimeTableSchemas.sessions>;
    scope: z.infer<typeof RuntimeTableSchemas.appscopes>;
  } | null>;
  relay(
    account: Account,
    request: instruction,
    signature: string,
    sessionId: string,
    appId: string,
  ): Promise<{ transactionId: string }>;
}
