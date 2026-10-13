import { z } from 'zod';
import { ApiRoutes, ConnectedAppsRoutes, type McpConnection } from '@daclify/core-protocol';
import type { CommunityModuleAdapter } from '@daclify/core-protocol/community-agent';
import { ModuleApiRoutes } from '@daclify/modules';
import { encodeDecide, encodeWorks, encodeActivity, ModuleCodeHashes } from '@daclify/modules/sdk';

export interface ScopedModuleAdapter {
  readActivity(
    connection: Pick<McpConnection, 'dao'>,
    input: Parameters<CommunityModuleAdapter['readActivity']>[1],
    request: Parameters<CommunityModuleAdapter['readActivity']>[2],
  ): ReturnType<CommunityModuleAdapter['readActivity']>;
  prepare(
    input: Parameters<CommunityModuleAdapter['prepare']>[0],
    context: Omit<Parameters<CommunityModuleAdapter['prepare']>[1], 'connection'> & {
      connection: Pick<McpConnection, 'dao'>;
    },
  ): ReturnType<CommunityModuleAdapter['prepare']>;
}
export function communityModuleAdapter(app?: {
  appId: string;
  revision: string;
  configHash: string;
}): ScopedModuleAdapter {
  return {
    async readActivity(connection, input, request) {
      const state = ModuleApiRoutes.state.response.parse(
        await request(ModuleApiRoutes.state.path.replace(':id', connection.dao.daoId)),
      );
      if (JSON.stringify(state.dao) !== JSON.stringify(connection.dao))
        throw new Error('MCP_DOMAIN');
      const after = input.tool === 'list_activity' ? input.input.after : undefined;
      return {
        activities: state.activities
          .filter(
            (value) =>
              value.dao_id === connection.dao.daoId &&
              value.key_epoch === '0' &&
              (!after || BigInt(value.id) > BigInt(after)),
          )
          .slice(0, 25),
        next: state.next.activities,
      };
    },
    async prepare(input, { connection, member, governance, request }) {
      const dao = ApiRoutes.dao.response.parse(
        await request(ApiRoutes.dao.path.replace(':id', connection.dao.daoId)),
      );
      if (
        JSON.stringify(dao.reference) !== JSON.stringify(connection.dao) ||
        dao.privacy !== 'public'
      )
        throw new Error('MCP_PUBLIC_DAO_REQUIRED');
      const state = ModuleApiRoutes.state.response.parse(
        await request(ModuleApiRoutes.state.path.replace(':id', connection.dao.daoId)),
      );
      if (JSON.stringify(state.dao) !== JSON.stringify(connection.dao))
        throw new Error('MCP_DOMAIN');
      const id =
        input.tool === 'prepare_review'
          ? 'works'
          : input.tool === 'prepare_activity'
            ? 'activity'
            : 'decide';
      const module = state.modules.find((value) => value.deployment.id === id);
      const action =
        input.tool === 'prepare_proposal'
          ? 'open'
          : input.tool === 'prepare_vote'
            ? 'vote'
            : input.tool === 'prepare_review'
              ? 'review'
              : 'recordact';
      if (
        !module?.enabled ||
        !module.installed ||
        !module.compatible ||
        !module.codeVerified ||
        module.deployment.codeHash !== ModuleCodeHashes[id] ||
        !module.actions.includes(action)
      )
        throw new Error('MCP_MODULE_PIN');
      const base = {
        runtime: connection.dao.contract,
        dao_id: connection.dao.daoId,
        member_id: member.memberId,
      };
      let data: Uint8Array;
      if (input.tool === 'prepare_proposal') {
        const policy = governance.policy;
        if (
          !policy ||
          policy.config.decide !== module.deployment.account ||
          state.ballots.some((value) => value.id === input.input.ballotId)
        )
          throw new Error('MCP_POLICY_CHANGED');
        data = encodeDecide('open', {
          ...base,
          ballot_id: input.input.ballotId,
          kind: policy.config.kind,
          choices: input.input.options.length,
          duration: policy.config.duration,
          quorum: policy.config.quorum,
          approval: policy.config.approval,
          metadata: JSON.stringify({
            schemaVersion: 1,
            title: input.input.title,
            description: input.input.description,
            options: input.input.options,
          }),
        });
      } else if (input.tool === 'prepare_vote') {
        const poll = state.ballots.find(
          (value) => value.dao_id === connection.dao.daoId && value.id === input.input.pollId,
        );
        const choice = z.coerce.number().int().min(0).max(7).parse(input.input.optionId);
        if (
          !poll ||
          poll.status !== 0 ||
          poll.closes <= Date.now() / 1000 ||
          choice >= poll.choices ||
          governance.excludedVoters.some((value) => value.member_id === member.memberId)
        )
          throw new Error('MCP_VOTE_UNAVAILABLE');
        data = encodeDecide('vote', { ...base, ballot_id: poll.id, choice });
      } else if (input.tool === 'prepare_review') {
        const milestone = state.milestones.find(
          (value) => value.dao_id === connection.dao.daoId && value.id === input.input.milestoneId,
        );
        const project = state.projects.find(
          (value) => value.dao_id === connection.dao.daoId && value.id === milestone?.project_id,
        );
        if (
          !member.reviewer ||
          !project ||
          !milestone ||
          project.contributor === member.memberId ||
          project.status !== 1 ||
          milestone.status !== 2
        )
          throw new Error('MCP_INDEPENDENT_REVIEW_REQUIRED');
        data = encodeWorks('review', {
          ...base,
          milestone_id: milestone.id,
          approve: input.input.approve,
          document_id: input.input.documentId,
          document_version: input.input.documentVersion,
        });
      } else {
        if (!app || app.appId !== input.input.appId) throw new Error('MCP_APP_CREDENTIAL_REQUIRED');
        const apps = ConnectedAppsRoutes.connectedApps.response.parse(
          await request(
            ConnectedAppsRoutes.connectedApps.path.replace(':id', connection.dao.daoId),
          ),
        );
        const current = apps.find((value) => value.config.appId === app.appId);
        if (
          !current?.native?.enabled ||
          current.configHash !== app.configHash ||
          current.config.revision !== app.revision ||
          current.native.revision !== app.revision ||
          current.native.config_hash !== app.configHash ||
          current.native.target !== module.deployment.account ||
          current.config.activityAccount !== module.deployment.account
        )
          throw new Error('MCP_APP_REVISION_CHANGED');
        if (state.activities.some((value) => value.event_id === input.input.eventId))
          throw new Error('MCP_ACTIVITY_RECONCILE_REQUIRED');
        data = encodeActivity('recordact', {
          ...base,
          app_id: app.appId,
          source_id: input.input.sourceId,
          source_revision: input.input.sourceRevision,
          event_id: input.input.eventId,
          evidence_cid: '',
          evidence_hash: '00'.repeat(32),
          key_epoch: '0',
        });
      }
      return {
        target: module.deployment.account,
        action,
        data,
        codeHash: module.deployment.codeHash,
      };
    },
  };
}
