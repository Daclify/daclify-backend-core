import {
  DaoSetupSchema,
  type DaoSetup,
  type GovernanceConfig,
  type ParticipantMode,
} from '../protocol/dao.js';
import type { RuntimeActions } from './generated/runtime.js';
const modes: Record<ParticipantMode, number> = { humans: 0, mixed: 1, 'agents-guarded': 2 };
const weights: Record<GovernanceConfig['weight'], number> = {
  member: 0,
  credit: 1,
  'native-stake': 2,
};
export function governanceSettings(
  setup: DaoSetup,
  decide: string,
): RuntimeActions['initgov']['settings'] {
  const value = DaoSetupSchema.parse(setup);
  return {
    participant_mode: modes[value.participantMode],
    decide,
    guardian: value.governance.guardian,
    kind: weights[value.governance.weight],
    duration: value.governance.duration,
    quorum: value.governance.quorumBasisPoints,
    approval: value.governance.approvalBasisPoints,
    governed_works: value.governance.governedWorks,
    max_commitment: value.governance.maxCommitment,
    daily_commitment: value.governance.dailyCommitment,
  };
}
