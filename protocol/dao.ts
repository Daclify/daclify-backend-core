import { z } from 'zod';
import {
  MAX_ASSET_UNITS,
  NativeAccountSchema,
  Uint64Schema,
  DaoRefSchema,
  ModuleManifestSchema,
} from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import { EncryptionPublicKeySchema, SigningPublicKeySchema } from './crypto.js';

export const DaoPurposeSchema = z.enum([
  'community',
  'ngo-grants',
  'gaming-guild',
  'team',
  'custom',
]);
export const ParticipantModeSchema = z.enum(['humans', 'mixed', 'agents-guarded']);
const CommitmentSchema = Uint64Schema.pipe(
  z.string().refine((value) => BigInt(value) <= MAX_ASSET_UNITS),
);
export const GovernanceConfigSchema = z
  .strictObject({
    weight: z.enum(['member', 'credit', 'native-stake']),
    duration: z.int().min(60).max(2592000),
    quorumBasisPoints: z.int().min(1).max(10000),
    approvalBasisPoints: z.int().min(5001).max(10000),
    governedWorks: z.boolean(),
    maxCommitment: CommitmentSchema,
    dailyCommitment: CommitmentSchema,
    guardian: z.union([z.literal(''), NativeAccountSchema]),
  })
  .refine(
    (value) =>
      CommitmentSchema.safeParse(value.dailyCommitment).success &&
      CommitmentSchema.safeParse(value.maxCommitment).success &&
      (value.dailyCommitment === '0' ||
        (value.maxCommitment !== '0' &&
          BigInt(value.dailyCommitment) >= BigInt(value.maxCommitment))),
    'Daily limit must cover one commitment',
  );
export const DaoSetupSchema = z
  .strictObject({
    presetId: DaoPurposeSchema,
    presetVersion: z.literal(1),
    participantMode: ParticipantModeSchema,
    governance: GovernanceConfigSchema,
  })
  .refine(
    (value) =>
      value.participantMode !== 'agents-guarded' ||
      (value.governance.guardian !== '' &&
        value.governance.maxCommitment !== '0' &&
        value.governance.dailyCommitment !== '0' &&
        value.governance.governedWorks),
    'Agent-only DAOs require a guardian, commitment limits and governed Works funding',
  );
export const FoundingAgentSchema = z.strictObject({
  signingKey: SigningPublicKeySchema,
  encryptionKey: EncryptionPublicKeySchema,
  operator: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[\x20-\x7e]+$/),
});
const identity = {
  title: z.string().min(1).max(160),
  description: z.string().max(4000).default(''),
};
export const LegacyMetadataSchema = z.strictObject({ schemaVersion: z.literal(1), ...identity });
export const PresetMetadataSchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    ...identity,
    purpose: DaoPurposeSchema,
    setup: DaoSetupSchema,
  })
  .refine(
    (value) => value.purpose === value.setup.presetId,
    'Purpose must match preset provenance',
  );
export const MetadataSchema = z
  .union([LegacyMetadataSchema, PresetMetadataSchema])
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 4096,
    'Metadata exceeds 4096 bytes',
  );
const defaults = {
  weight: 'member',
  duration: 259200,
  quorumBasisPoints: 5000,
  approvalBasisPoints: 5001,
  governedWorks: true,
  maxCommitment: '0',
  dailyCommitment: '0',
  guardian: '',
} satisfies z.input<typeof GovernanceConfigSchema>;
export const DaoPresetSchema = z.strictObject({
  id: DaoPurposeSchema,
  version: z.literal(1),
  title: z.string(),
  description: z.string(),
  modules: z.array(ModuleManifestSchema.shape.id).max(16),
  governance: GovernanceConfigSchema,
  helpTopic: z.literal('dao-presets'),
});
export const DaoPresets = Object.freeze(
  [
    {
      id: 'community',
      title: 'Community',
      description: 'Shared decisions, projects and community resources.',
      modules: ['decide', 'works'],
      governance: defaults,
      helpTopic: 'dao-presets',
    },
    {
      id: 'ngo-grants',
      title: 'NGO / grants',
      description:
        'Milestone funding, independent reviews and evidence of outcomes. This does not establish legal or charitable status.',
      modules: ['decide', 'works'],
      governance: { ...defaults, approvalBasisPoints: 6667 },
      helpTopic: 'dao-presets',
    },
    {
      id: 'gaming-guild',
      title: 'Gaming guild',
      description:
        'Guild decisions, funded contributions and shared resources. Game integrations are separate modules.',
      modules: ['decide', 'works'],
      governance: defaults,
      helpTopic: 'dao-presets',
    },
    {
      id: 'team',
      title: 'Team / cooperative',
      description: 'Contributor decisions, project delivery and recurring compensation.',
      modules: ['decide', 'works', 'payroll'],
      governance: defaults,
      helpTopic: 'dao-presets',
    },
    {
      id: 'custom',
      title: 'Custom',
      description: 'Start with voting and choose additional modules yourself.',
      modules: ['decide'],
      governance: { ...defaults, governedWorks: false },
      helpTopic: 'dao-presets',
    },
  ].map((preset) => {
    const parsed = DaoPresetSchema.parse({ ...preset, version: 1 });
    return Object.freeze({
      ...parsed,
      modules: Object.freeze(parsed.modules),
      governance: Object.freeze(parsed.governance),
    });
  }),
);
export const GovernanceStateSchema = z.strictObject({
  dao: DaoRefSchema,
  policy: RuntimeTableSchemas.govpolicies.nullable(),
  actors: z.array(RuntimeTableSchemas.actors),
  sessions: z.array(RuntimeTableSchemas.sessions),
  guardian: RuntimeTableSchemas.guards.nullable(),
  budget: RuntimeTableSchemas.budgets.nullable(),
});
export function defaultDaoSetup(presetId: DaoPurpose = 'community'): DaoSetup {
  const preset = DaoPresets.find((preset) => preset.id === presetId);
  if (!preset) throw new Error('PRESET_UNKNOWN');
  return DaoSetupSchema.parse({
    presetId,
    presetVersion: preset.version,
    participantMode: 'humans',
    governance: { ...preset.governance },
  });
}
export type DaoPurpose = z.infer<typeof DaoPurposeSchema>;
export type ParticipantMode = z.infer<typeof ParticipantModeSchema>;
export type GovernanceConfig = z.infer<typeof GovernanceConfigSchema>;
export type DaoSetup = z.infer<typeof DaoSetupSchema>;
export type GovernanceState = z.infer<typeof GovernanceStateSchema>;
