import { z } from 'zod';
import { ChainIdSchema, IdSchema, NativeAccountSchema, DaoRefSchema, Uint64Schema } from './base.js';
import { RuntimeTableSchemas,RuntimeActionSchemas } from '../sdk/generated/schemas.js';
export const DaoLifecycleSchema = z.enum(['active', 'closing', 'closed']);
export type DaoLifecycle = z.infer<typeof DaoLifecycleSchema>;
export const DaoHandoverSchema = RuntimeTableSchemas.handovers.extend({
  commitment: ChainIdSchema,
  status: z.enum(['pending', 'ready', 'expired', 'stale']),
});
export type DaoHandover = z.infer<typeof DaoHandoverSchema>;


export const ExitMembershipSchema = z.strictObject({
 chainId: ChainIdSchema, runtime: NativeAccountSchema, daoId: IdSchema, memberId: IdSchema,
 choice: z.enum(['leave','handover','close']),
});
export const ExitIntentSchema = z.strictObject({
 version:z.literal(1),mode:z.enum(['leave-all','delete-account']),memberships:z.array(ExitMembershipSchema).max(256),
}).refine(value=>new Set(value.memberships.map(m=>[m.chainId,m.runtime,m.daoId].join(':'))).size===value.memberships.length,'Duplicate membership');
export type ExitIntent = z.infer<typeof ExitIntentSchema>;
export const ErasureComponentStateSchema=z.enum(['pending','confirmed','unavailable','retained']);
export const ErasureComponentSchema=z.strictObject({id:z.string().min(1).max(256),state:ErasureComponentStateSchema,reason:z.string().min(1).max(128),expiresAt:z.iso.datetime().optional()});
export type ErasureComponent=z.infer<typeof ErasureComponentSchema>;
export const ExitReportSchema=z.strictObject({version:z.literal(1),id:z.uuid(),mode:ExitIntentSchema.shape.mode,state:z.enum(['processing','complete','expired']),components:z.array(ErasureComponentSchema).max(1024),expiresAt:z.iso.datetime()}).refine(value=>value.state!=='complete'||value.components.every(component=>['confirmed','retained'].includes(component.state)),'Unresolved erasure');
export type ExitReport=z.infer<typeof ExitReportSchema>;
export const ExitCapabilitySchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const ExitBeginSchema=z.strictObject({intent:ExitIntentSchema,statusCapability:ExitCapabilitySchema});
export const ExitOperationSchema=ExitReportSchema.safeExtend({statusCapability:ExitCapabilitySchema});
export type ExitOperation=z.infer<typeof ExitOperationSchema>;

export const ExitPreflightSchema=z.strictObject({
 version:z.literal(1),nativeAvailable:z.boolean(),memberships:z.array(z.strictObject({
  reference:DaoRefSchema,memberId:IdSchema,nonce:Uint64Schema,active:z.boolean(),admin:z.boolean(),
  claim:Uint64Schema,stake:Uint64Schema,nativeAccount:NativeAccountSchema.nullable(),
  soleMember:z.boolean().nullable(),lifecycle:DaoLifecycleSchema.nullable(),reason:z.string().max(128),
 })).max(256),limits:z.strictObject({memberships:z.literal(256),statusDays:z.literal(30)}),retained:z.string().max(4096),
});
export type ExitPreflight=z.infer<typeof ExitPreflightSchema>;
export const AccountExitRoutes = {
  exitPreflight:{method:'GET',path:'/v1/me/exit/preflight',response:ExitPreflightSchema,helpTopic:'account-exit'},
  exitBegin:{method:'POST',path:'/v1/me/exit',input:ExitBeginSchema,response:ExitOperationSchema,helpTopic:'account-exit'},
  exitStatus:{method:'POST',path:'/v1/account-exit/status',input:z.strictObject({capability:ExitCapabilitySchema}),response:ExitReportSchema,helpTopic:'account-exit'},
  daoHandover: {
    method: 'GET',
    path: '/v1/daos/:id/handover',
    params: z.strictObject({ id: IdSchema }),
    response: DaoHandoverSchema.nullable(),
    helpTopic: 'accounts',
  },
} as const;

export const SignedExitInstructionSchema=RuntimeActionSchemas.submitexit.refine(value=>value.request.data.length<=1024,'Exit payload bound');
export const ExitSubmissionSchema=z.strictObject({transactionId:ChainIdSchema,packet:z.string().regex(/^(?:[a-f0-9]{2})+$/).max(8192),firstBlock:z.int().positive(),cursor:z.int().nonnegative(),expiresAt:z.iso.datetime()}).refine(value=>value.cursor>=value.firstBlock&&value.cursor<=value.firstBlock+129,'Receipt scan bound');
export type ExitSubmission=z.infer<typeof ExitSubmissionSchema>;
export const ExitNativeStepInputSchema=z.strictObject({signed:SignedExitInstructionSchema});

export const ExitNativeStepRoute={method:'POST',path:'/v1/me/exit/:id/steps/:stepId',params:z.strictObject({id:z.uuid(),stepId:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)}),input:ExitNativeStepInputSchema,response:ExitReportSchema,helpTopic:'account-exit'} as const;

export const ExitSettlementRoutes={
 settlementPrepare:{method:'POST',path:'/v1/account-exit/settlement/prepare',input:SignedExitInstructionSchema,response:ExitSubmissionSchema,helpTopic:'account-exit'},
 settlementSubmit:{method:'POST',path:'/v1/account-exit/settlement/submit',input:ExitSubmissionSchema,response:z.strictObject({transactionId:ChainIdSchema}),helpTopic:'account-exit'},
 settlementReceipt:{method:'POST',path:'/v1/account-exit/settlement/receipt',input:ExitSubmissionSchema,response:z.strictObject({state:z.enum(['confirmed','pending','unavailable']),cursor:z.int().nonnegative()}),helpTopic:'account-exit'},
} as const;
