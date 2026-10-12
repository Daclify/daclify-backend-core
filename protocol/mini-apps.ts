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
