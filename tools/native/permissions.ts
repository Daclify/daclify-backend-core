import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { FixtureContainerSchema } from './network.js';
import { contextPermissionPlan } from '../deploy/permissions.js';
export function configureFixtureContext(
  container: string,
  runtime = 'daclifycore',
  moduleAccounts: Partial<
    Record<'decide' | 'works' | 'payroll' | 'grants' | 'endorse', string>
  > = {},
): void {
  FixtureContainerSchema.parse(container);
  z.enum(['daclifycore', 'daclifytwo', 'upgcore']).parse(runtime);
  function cleos(args: string[]): string {
    try {
      return execFileSync(
        'docker',
        ['exec', container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    } catch {
      throw new Error('Local context permission configuration failed');
    }
  }
  const plan = contextPermissionPlan(runtime, [
    { id: 'decide', account: moduleAccounts.decide ?? 'decide' },
    { id: 'works', account: moduleAccounts.works ?? 'works' },
    { id: 'payroll', account: moduleAccounts.payroll ?? 'payroll' },
    { id: 'grants-rounds', account: moduleAccounts.grants ?? 'grants' },
    { id: 'endorsement-admission', account: moduleAccounts.endorse ?? 'endorse' },
  ]);
  cleos([
    'set',
    'account',
    'permission',
    runtime,
    'execctx',
    JSON.stringify(plan.authority),
    'active',
    '-p',
    `${runtime}@active`,
  ]);
  const permissions = z
    .object({
      permissions: z.array(
        z.object({
          perm_name: z.string(),
          linked_actions: z
            .array(z.object({ account: z.string(), action: z.string().nullable() }))
            .default([]),
        }),
      ),
    })
    .parse(JSON.parse(cleos(['get', 'account', runtime, '--json'])));
  const linked =
    permissions.permissions.find((p) => p.perm_name === 'execctx')?.linked_actions ?? [];
  for (const link of plan.links)
    if (
      !linked.some((current) => current.account === link.account && current.action === link.action)
    )
      cleos([
        'set',
        'action',
        'permission',
        runtime,
        link.account,
        link.action,
        'execctx',
        '-p',
        `${runtime}@active`,
      ]);
}
