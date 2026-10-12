import type { FastifyInstance } from 'fastify';
import type { Account } from '../../../../protocol/api.js';
import { ProfileContextSchema, ProfileRoutes } from '../../../../protocol/profiles.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
import type { ProfileKeys } from './keys.js';
export function registerProfileRoutes(
  app: FastifyInstance,
  service: ProfileKeys,
  chain: ChainGateway,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
) {
  app.post(ProfileRoutes.profileKeysShare.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const input = ProfileRoutes.profileKeysShare.input.parse(request.body);
    await service.put(account.id, input.grants);
    await service.reconcile(input.context);
    return service.status(input.context);
  });
  app.post(ProfileRoutes.profileKeysRemove.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const input = ProfileRoutes.profileKeysRemove.input.parse(request.body);
    return service.remove(account.id, input.context, input.ciphertextCommitment);
  });
  app.get(ProfileRoutes.profileKeysGet.path, async (request) => {
    const account = await session(request.cookies[cookieName]);
    const params = ProfileRoutes.profileKeysGet.params.parse(request.params),
      network = await chain.network();
    return service.get(
      account.id,
      ProfileContextSchema.parse({
        version: 2,
        chainId: network.chainId,
        runtime: network.runtime,
        ...params,
      }),
    );
  });
  app.get(ProfileRoutes.profileRecipients.path, async (request) => {
    const account = await session(request.cookies[cookieName]);
    const { daoId } = ProfileRoutes.profileRecipients.params.parse(request.params);
    const { after } = ProfileRoutes.profileRecipients.query.parse(request.query);
    const network = await chain.network();
    if (
      !(await chain.memberships(account)).some(
        (member) =>
          member.active &&
          member.dao.chainId === network.chainId &&
          member.dao.contract === network.runtime &&
          member.dao.daoId === daoId,
      )
    )
      throw new ApiError('PROFILE_AUDIENCE', 403);
    if (!chain.profileKeyRecipients) throw new ApiError('PROFILE_KEYS_UNAVAILABLE', 503);
    return chain.profileKeyRecipients(daoId, after);
  });
}
