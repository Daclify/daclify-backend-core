import {ABI,Serializer} from '@wharfkit/antelope';
import {appjoinAbi,type AppjoinActions} from './generated/appjoin.js';
import {AppjoinActionSchemas} from './generated/appjoin-schemas.js';
export {AppjoinActionSchemas as AppJoinActionSchemas,AppjoinTableSchemas as AppJoinTableSchemas} from './generated/appjoin-schemas.js';
export {appjoinAbi as appJoinAbi} from './generated/appjoin.js';
export {AppJoinCodeHash,AppJoinRawAbiHash} from './generated/appjoin-release.js';
export type AppJoinActions=AppjoinActions;
export type AppJoinProof=AppjoinActions['appadmit']['proof'];
export function encodeAppJoin<K extends keyof AppjoinActions>(name:K,value:AppjoinActions[K]):Uint8Array {
  return Serializer.encode({abi:ABI.from(appjoinAbi),type:name,object:AppjoinActionSchemas[name].parse(value)}).array;
}
