import type { DeployName } from './environment.js';

export function deploymentSend(
  name: DeployName,
  flags: { commit: boolean; confirm: boolean },
): boolean {
  if (flags.confirm && name !== 'production') throw new Error('CONFIRM_IS_PRODUCTION_ONLY');
  if (flags.commit && name === 'production') throw new Error('PRODUCTION_REQUIRES_CONFIRM');
  return name === 'production' ? flags.confirm : flags.commit;
}
