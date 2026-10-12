import { z } from 'zod';
import {
  AppBindingSchema,
  appBindingHash,
  type AppBinding,
} from '../../../../protocol/mini-app-database.js';
import {
  MiniAppConnectionSchema,
  ConnectionDiagnosticsSchema,
  type MiniAppConnection,
  type ConnectionDiagnostics,
} from '../../../../protocol/mini-apps.js';
import { IdSchema, VERSION } from '../../../../protocol/base.js';
import { VERSION as MODULES_VERSION } from '@daclify/modules';
import type { ConnectedApps } from '../connected-apps/service.js';
import { ApiError } from '../errors.js';
import type { MiniAppArtifacts } from './artifacts.js';
import { probeReadiness, type ProbeDependencies } from './probe.js';

export class MiniAppConnections {
  constructor(
    readonly apps: ConnectedApps,
    readonly artifacts?: MiniAppArtifacts,
    private readonly probe?: ProbeDependencies,
  ) {}
  private async registered(daoId: string, appId: string) {
    const network = await this.apps.chain.network();
    const row = z
      .object({ id: z.uuid() })
      .safeParse(
        (
          await this.apps.pool.query(
            'SELECT id FROM connected_apps WHERE chain_id=$1 AND runtime=$2 AND dao_id=$3 AND app_id=$4',
            [network.chainId, network.runtime, IdSchema.parse(daoId), IdSchema.parse(appId)],
          )
        ).rows[0],
      );
    if (!row.success) throw new ApiError('APP_UNKNOWN', 404);
    return this.apps.client(row.data.id);
  }
  async buildConnection(
    daoId: string,
    appId: string,
    accountId: string,
  ): Promise<MiniAppConnection> {
    const app = await this.registered(daoId, appId);
    const account = await this.apps.account(z.uuid().parse(accountId));
    const member = await this.apps.chain.membership(account, daoId);
    if (
      !member?.active ||
      !member.admin ||
      member.dao.chainId !== app.config.dao.chainId ||
      member.dao.contract !== app.config.dao.contract ||
      member.dao.daoId !== app.config.dao.daoId
    )
      throw new ApiError('ADMIN_REQUIRED', 403);
    const artifacts = this.artifacts;
    if (!artifacts) throw new ApiError('MINI_APP_RELEASE_UNAVAILABLE', 503);
    if (
      artifacts.manifest.coreVersion !== VERSION ||
      artifacts.manifest.modulesVersion !== MODULES_VERSION
    )
      throw new ApiError('MINI_APP_RELEASE_VERSION', 503);
    const callbackUrl = app.config.redirectUris[0];
    if (!callbackUrl) throw new ApiError('APP_CONFIG', 409);
    return MiniAppConnectionSchema.parse({
      version: 1,
      binding: AppBindingSchema.parse({
        schemaVersion: 1,
        chainId: app.config.dao.chainId,
        runtime: app.config.dao.contract,
        daoId: app.config.dao.daoId,
        appId: app.config.appId,
        issuer: this.apps.config.issuer,
        clientId: app.clientId,
      }),
      callbackUrl,
      frontendOrigin: this.apps.config.frontendOrigin,
      activityAccount: app.config.activityAccount,
      releaseId: artifacts.manifest.releaseId,
      coreVersion: artifacts.manifest.coreVersion,
      modulesVersion: artifacts.manifest.modulesVersion,
      manifestHash: artifacts.manifestHash,
      starterUrl:
        this.apps.config.issuer +
        '/v1/mini-apps/releases/' +
        artifacts.manifest.releaseId +
        '/files/starter.tgz',
      diagnostics: {
        version: 1,
        checks: [
          { stage: 'configuration', status: 'passed', codes: [] },
          { stage: 'readiness', status: 'not-run', codes: ['APP_CHECK_REQUIRED'] },
          { stage: 'identity', status: 'not-run', codes: ['APP_LOGIN_REQUIRED'] },
          { stage: 'event', status: 'not-run', codes: ['APP_NATIVE_EVENT_REQUIRED'] },
        ],
      },
    });
  }
  async checkConnection(input: AppBinding): Promise<ConnectionDiagnostics> {
    const binding = AppBindingSchema.parse(input);
    const app = await this.registered(binding.daoId, binding.appId);
    const expected = AppBindingSchema.parse({
      schemaVersion: 1,
      chainId: app.config.dao.chainId,
      runtime: app.config.dao.contract,
      daoId: app.config.dao.daoId,
      appId: app.config.appId,
      issuer: this.apps.config.issuer,
      clientId: app.clientId,
    });
    if (appBindingHash(binding) !== appBindingHash(expected))
      throw new ApiError('APP_ACTOR_BINDING', 403);
    const readiness = app.config.sourceApiBase
      ? await probeReadiness(
          new URL(
            app.config.sourceApiBase.replace(/\/$/, '') + '/.well-known/daclify-mini-app.json',
          ),
          binding,
          this.probe,
        )
      : {
          stage: 'readiness' as const,
          status: 'not-run' as const,
          codes: ['APP_SOURCE_UNAVAILABLE'],
        };
    return ConnectionDiagnosticsSchema.parse({
      version: 1,
      checks: [
        { stage: 'configuration', status: 'passed', codes: [] },
        readiness,
        { stage: 'identity', status: 'not-run', codes: ['APP_LOGIN_REQUIRED'] },
        { stage: 'event', status: 'not-run', codes: ['APP_NATIVE_EVENT_REQUIRED'] },
      ],
    });
  }
}
