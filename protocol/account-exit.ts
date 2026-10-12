import { z } from 'zod';
import { ChainIdSchema, IdSchema } from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
export const DaoLifecycleSchema = z.enum(['active', 'closing', 'closed']);
export type DaoLifecycle = z.infer<typeof DaoLifecycleSchema>;
export const DaoHandoverSchema = RuntimeTableSchemas.handovers.extend({
  commitment: ChainIdSchema,
  status: z.enum(['pending', 'ready', 'expired', 'stale']),
});
export type DaoHandover = z.infer<typeof DaoHandoverSchema>;
export const AccountExitRoutes = {
  daoHandover: {
    method: 'GET',
    path: '/v1/daos/:id/handover',
    params: z.strictObject({ id: IdSchema }),
    response: DaoHandoverSchema.nullable(),
    helpTopic: 'accounts',
  },
} as const;
