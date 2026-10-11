import { IdSchema } from '../../protocol/base.js';
import { RuntimeActionSchemas } from '../../sdk/generated/schemas.js';

export function activityInitializationBatches(daoId: string, memberIds: readonly string[]) {
  IdSchema.parse(daoId);
  if (memberIds.length > 5000 || new Set(memberIds).size !== memberIds.length)
    throw new Error('ACTIVITY_MEMBERS_INVALID');
  const ids = memberIds
    .map((id) => BigInt(IdSchema.parse(id)))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const batches = [];
  for (let index = 0; index < ids.length; index += 50) {
    const id = ids[index];
    if (id === undefined) throw new Error('ACTIVITY_MEMBER_REQUIRED');
    batches.push(
      RuntimeActionSchemas.initactivity.parse({
        dao_id: daoId,
        after: id.toString(),
        limit: Math.min(50, ids.length - index),
      }),
    );
  }
  return batches;
}
