import { z } from 'zod';
import { NativeAccountSchema } from '../../../protocol/base.js';

const ModuleDeploymentConfigSchema = z
  .array(
    z.strictObject({
      id: z.enum(['decide', 'works', 'payroll']),
      account: NativeAccountSchema,
    }),
  )
  .max(3)
  .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'Duplicate module');

export type ModuleDeploymentConfig = z.infer<typeof ModuleDeploymentConfigSchema>;

export function parseModuleDeployments(value: string): ModuleDeploymentConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('MODULE_DEPLOYMENTS_INVALID');
  }
  const result = ModuleDeploymentConfigSchema.safeParse(parsed);
  if (!result.success) throw new Error('MODULE_DEPLOYMENTS_INVALID');
  return result.data;
}
