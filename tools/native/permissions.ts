import { execFileSync } from 'node:child_process';
import { z } from 'zod';
export const localCoreCallbacks = [
  'setmeta',
  'putdoc',
  'putjson',
  'commitepoch',
  'rotateepoch',
  'linknative',
  'setactive',
  'setroles',
  'grantkey',
  'withdraw',
  'unstake',
  'modconfig',
  'setcredits',
] as const;
export function configureFixtureContext(container: string, runtime = 'daclifycore'): void {
  z.literal('daclify-v2-native').parse(container);
  z.enum(['daclifycore', 'daclifytwo']).parse(runtime);
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
  const authority = {
    threshold: 1,
    keys: [],
    waits: [],
    accounts: [{ permission: { actor: runtime, permission: 'eosio.code' }, weight: 1 }],
  };
  cleos([
    'set',
    'account',
    'permission',
    runtime,
    'execctx',
    JSON.stringify(authority),
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
  for (const action of localCoreCallbacks)
    if (!linked.some((link) => link.account === runtime && link.action === action))
      cleos([
        'set',
        'action',
        'permission',
        runtime,
        runtime,
        action,
        'execctx',
        '-p',
        `${runtime}@active`,
      ]);
  for (const [account, actions] of [
    ['decide', ['open', 'vote']],
    ['works', ['propose', 'accept', 'submitwork', 'review', 'cancel']],
    ['payroll', ['commit']],
  ] as const)
    for (const action of actions)
      if (!linked.some((link) => link.account === account && link.action === action))
        cleos([
          'set',
          'action',
          'permission',
          runtime,
          account,
          action,
          'execctx',
          '-p',
          `${runtime}@active`,
        ]);
}
