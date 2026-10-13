import { z } from 'zod';
import { AppBindingSchema } from './mini-app-database.js';
import { ApiOriginSchema, ChainIdSchema, IdSchema, NativeAccountSchema } from './base.js';

const ReleaseVersion = z
  .string()
  .max(64)
  .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/);
const HttpsUrl = z
  .url()
  .max(1024)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  });
export const ConnectionCheckSchema = z.strictObject({
  stage: z.enum(['configuration', 'readiness', 'identity', 'event']),
  status: z.enum(['passed', 'failed', 'not-run']),
  codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/)).max(4),
});
export const ConnectionDiagnosticsSchema = z
  .strictObject({ version: z.literal(1), checks: z.array(ConnectionCheckSchema).length(4) })
  .refine(
    (value) => new Set(value.checks.map((check) => check.stage)).size === 4,
    'Each diagnostic stage occurs once',
  );
export type ConnectionDiagnostics = z.infer<typeof ConnectionDiagnosticsSchema>;
export const AppReadinessSchema = z.strictObject({
  version: z.literal(1),
  binding: AppBindingSchema,
});
export const MiniAppConnectionSchema = z.strictObject({
  version: z.literal(1),
  binding: AppBindingSchema,
  callbackUrl: HttpsUrl,
  frontendOrigin: ApiOriginSchema,
  activityAccount: NativeAccountSchema,
  releaseId: ChainIdSchema,
  coreVersion: ReleaseVersion,
  modulesVersion: ReleaseVersion,
  manifestHash: ChainIdSchema,
  starterUrl: HttpsUrl,
  diagnostics: ConnectionDiagnosticsSchema,
});
export type MiniAppConnection = z.infer<typeof MiniAppConnectionSchema>;
export const MiniAppReleaseManifestSchema = z
  .strictObject({
    version: z.literal(1),
    releaseId: ChainIdSchema,
    coreVersion: ReleaseVersion,
    modulesVersion: ReleaseVersion,
    packageLockHash: ChainIdSchema,
    files: z
      .array(
        z.strictObject({
          name: z.enum(['core.tgz', 'modules.tgz', 'starter.tgz']),
          sha256: ChainIdSchema,
          bytes: z
            .int()
            .min(1)
            .max(16 * 1024 * 1024),
        }),
      )
      .length(3),
  })
  .refine(
    (value) => new Set(value.files.map((file) => file.name)).size === 3,
    'Each immutable artifact occurs once',
  );
export type MiniAppReleaseManifest = z.infer<typeof MiniAppReleaseManifestSchema>;
export const MiniAppsRoutes = {
  miniAppConnection: {
    method: 'GET',
    path: '/v1/mini-apps/connections/:daoId/:appId',
    params: z.strictObject({ daoId: IdSchema, appId: IdSchema }),
    response: MiniAppConnectionSchema,
    helpTopic: 'connected-apps',
  },
  checkMiniAppConnection: {
    method: 'POST',
    path: '/v1/mini-apps/connections/:daoId/:appId/check',
    params: z.strictObject({ daoId: IdSchema, appId: IdSchema }),
    input: z.strictObject({}).default({}),
    response: ConnectionDiagnosticsSchema,
    helpTopic: 'connected-apps',
  },
  miniAppRelease: {
    method: 'GET',
    path: '/v1/mini-apps/releases/:releaseId',
    params: z.strictObject({ releaseId: ChainIdSchema }),
    response: MiniAppReleaseManifestSchema,
    helpTopic: 'connected-apps',
  },
} as const;

const boundedText = (bytes: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => new TextEncoder().encode(value).length <= bytes,
      'Text exceeds its UTF-8 byte limit',
    );
const directoryUrl = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  });
export const MiniAppListingInputSchema = z.strictObject({
  origin: directoryUrl.refine(
    (value) => new URL(value).origin === value,
    'Use the canonical HTTPS origin',
  ),
  title: boundedText(120),
  description: boundedText(2000),
  documentation: directoryUrl.optional(),
  source: directoryUrl.optional(),
  releases: z
    .array(ChainIdSchema)
    .max(8)
    .refine((values) => new Set(values).size === values.length),
});
export const MiniAppListingSchema = MiniAppListingInputSchema.extend({
  id: z.uuid(),
  status: z.enum(['unverified', 'published', 'hidden']),
  created: z.iso.datetime(),
  updated: z.iso.datetime(),
  expires: z.iso.datetime(),
});
export const MiniAppOriginProofSchema = z.strictObject({
  version: z.literal(1),
  listingId: z.uuid(),
  accountId: z.uuid(),
  origin: MiniAppListingInputSchema.shape.origin,
  challenge: ChainIdSchema,
  expires: z.iso.datetime(),
});
const listingId = z.object({ id: z.uuid() });
export const MiniAppDirectoryRoutes = {
  miniAppListingReports: {
    method: 'GET',
    path: '/v1/mini-apps/directory/reports',
    query: z.strictObject({ id: z.uuid(), after: z.uuid().optional() }),
    response: z.strictObject({
      reports: z
        .array(
          z.strictObject({
            reason: boundedText(500),
            created: z.iso.datetime(),
            expires: z.iso.datetime(),
          }),
        )
        .max(25),
      next: z.uuid().nullable(),
    }),
    helpTopic: 'mini-app-directory',
  },
  miniAppDirectory: {
    method: 'GET',
    path: '/v1/mini-apps/directory',
    query: z.strictObject({ after: z.uuid().optional(), mine: z.enum(['1']).optional() }),
    response: z.strictObject({
      listings: z.array(MiniAppListingSchema).max(25),
      next: z.uuid().nullable(),
      publicationAvailable: z.boolean(),
    }),
    helpTopic: 'mini-app-directory',
  },
  miniAppListingSubmit: {
    method: 'POST',
    path: '/v1/mini-apps/directory/submit',
    input: MiniAppListingInputSchema,
    response: MiniAppListingSchema,
    helpTopic: 'mini-app-directory',
  },
  miniAppListingUpdate: {
    method: 'POST',
    path: '/v1/mini-apps/directory/update',
    input: listingId
      .extend({ listing: MiniAppListingInputSchema, withdraw: z.boolean().default(false) })
      .strict(),
    response: MiniAppListingSchema,
    helpTopic: 'mini-app-directory',
  },
  miniAppListingVerify: {
    method: 'POST',
    path: '/v1/mini-apps/directory/verify',
    input: listingId.extend({ complete: z.boolean().default(false) }).strict(),
    response: z.discriminatedUnion('state', [
      z.strictObject({
        state: z.literal('challenge'),
        proof: MiniAppOriginProofSchema,
        proofUrl: directoryUrl,
      }),
      z.strictObject({ state: z.literal('verified'), listing: MiniAppListingSchema }),
    ]),
    helpTopic: 'mini-app-directory',
  },
  miniAppListingTransfer: {
    method: 'POST',
    path: '/v1/mini-apps/directory/transfer',
    input: listingId.extend({ successorAccountId: z.uuid() }).strict(),
    response: z.strictObject({ expires: z.iso.datetime() }),
    helpTopic: 'mini-app-directory',
  },
  miniAppListingReport: {
    method: 'POST',
    path: '/v1/mini-apps/directory/report',
    input: listingId.extend({ reason: boundedText(500) }).strict(),
    response: z.strictObject({ received: z.literal(true) }),
    helpTopic: 'mini-app-directory',
  },
  miniAppListingModerate: {
    method: 'POST',
    path: '/v1/mini-apps/directory/moderate',
    input: listingId.extend({ decision: z.enum(['hide', 'restore']) }).strict(),
    response: MiniAppListingSchema,
    helpTopic: 'mini-app-directory',
  },
} as const;
