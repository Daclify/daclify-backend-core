import { Checksum256, Serializer } from '@wharfkit/antelope';
import { DaoRefSchema, type DaoRef } from '../protocol/base.js';
import { RuntimeTableSchemas } from './generated/schemas.js';
import { z } from 'zod';
import { DaoHandoverSchema, type DaoHandover } from '../protocol/account-exit.js';
type Handover = z.infer<typeof RuntimeTableSchemas.handovers>;
export function privateHandoverCommitment(input: DaoRef, value: Handover | DaoHandover): string {
  const reference = DaoRefSchema.parse(input),
    handover = z.union([RuntimeTableSchemas.handovers, DaoHandoverSchema]).parse(value);
  if (reference.daoId !== handover.dao_id) throw new Error('PRIVATE_HANDOVER_CONTEXT');
  const fields: Array<{ type: string; object: string | number }> = [
    { type: 'string', object: 'daclify.private-handover.v1' },
    { type: 'checksum256', object: reference.chainId },
    { type: 'name', object: reference.contract },
    ...[
      handover.dao_id,
      handover.initiator,
      handover.departing,
      handover.successor,
      handover.departing_credentials,
      handover.successor_credentials,
    ].map((object) => ({ type: 'uint64', object })),
    { type: 'checksum256', object: handover.successor_key },
    { type: 'uint64', object: handover.key_epoch },
    { type: 'uint8', object: handover.history_policy },
    { type: 'uint64', object: handover.last_epoch },
    { type: 'uint32', object: handover.expires },
  ];
  const encoded = fields.map((field) => Serializer.encode(field).array);
  const bytes = new Uint8Array(encoded.reduce((sum, field) => sum + field.length, 0));
  let offset = 0;
  for (const field of encoded) {
    bytes.set(field, offset);
    offset += field.length;
  }
  return Checksum256.hash(bytes).toString();
}
