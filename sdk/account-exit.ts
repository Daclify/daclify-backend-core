import { runtimeAbi } from './generated/runtime.js';
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

export const ExitCoreActions = Object.freeze(['leave','startclose','closedao','delprofile','beginhand','scanhand','accepthand','withdraw','unstake'] as const);
export function exitInstructionDigest(operation:string,stepDigest:string,request:import('./generated/runtime.js').instruction):Checksum256 {
 if(request.target!==request.deployment||!ExitCoreActions.some(action=>action===request.action))throw Error('EXIT_ACTION');
 const nonzero=z.string().regex(/^[a-f0-9]{64}$/).refine(value=>value!=='0'.repeat(64));
 const parts=[Serializer.encode({type:'string',object:'daclify.account-exit.v1'}).array,Serializer.encode({type:'checksum256',object:nonzero.parse(operation)}).array,Serializer.encode({type:'checksum256',object:nonzero.parse(stepDigest)}).array,Serializer.encode({abi:runtimeAbi,type:'instruction',object:request}).array];
 const bytes=new Uint8Array(parts.reduce((size,part)=>size+part.length,0));let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return Checksum256.hash(bytes);
}

export function exitOperationCommitment(operationId:string):string {
 z.uuid().parse(operationId);const encoded=Serializer.encode({type:'string',object:'daclify.account-exit.operation.v1:'+operationId});return Checksum256.hash(encoded).toString();
}
export function exitStepCommitment(operationId:string,stepId:string,request:import('./generated/runtime.js').instruction):string {
 z.uuid().parse(operationId);z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/).parse(stepId);
 const encoded=Serializer.encode({type:'string',object:JSON.stringify(['daclify.account-exit.step.v1',operationId,stepId,Checksum256.hash(Serializer.encode({abi:runtimeAbi,type:'instruction',object:request})).toString()])});return Checksum256.hash(encoded).toString();
}
