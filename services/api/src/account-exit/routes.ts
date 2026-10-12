import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import type { ChainGateway } from '../chain.js';
import type { FastifyInstance } from 'fastify';
import type { Account } from '../../../../protocol/api.js';
import { AccountExitRoutes,ExitNativeStepRoute,ExitSettlementRoutes } from '../../../../protocol/account-exit.js';
import type { AccountExit } from './service.js';
export function registerAccountExitRoutes(app:FastifyInstance,service:AccountExit,cookieName:string,session:(token:string|undefined,csrf?:string)=>Promise<Account>,spend:(id:string)=>void){
 app.post(ExitNativeStepRoute.path,async(request,reply)=>{reply.header('cache-control','no-store');const params=ExitNativeStepRoute.params.parse(request.params),input=ExitNativeStepRoute.input.parse(request.body);return service.submitNativeStep(params.id,params.stepId,input.signed);});
 app.get(AccountExitRoutes.exitPreflight.path,async(request,reply)=>{reply.header('cache-control','no-store');const account=await session(request.cookies[cookieName]);return service.preflight(account.id);});
 app.post(AccountExitRoutes.exitBegin.path,async(request,reply)=>{
  reply.header('cache-control','no-store');const account=await session(request.cookies[cookieName],typeof request.headers['x-csrf-token']==='string'?request.headers['x-csrf-token']:'');spend(account.id);
  const input=AccountExitRoutes.exitBegin.input.parse(request.body);
  // The shared literal AccountControlPaths hook has verified fresh origin/audience/session/body-bound ownership.
  const operation=await service.begin(account.id,input.intent,{reauthenticated:true,statusCapability:input.statusCapability});
  if(input.intent.mode==='delete-account')reply.clearCookie(cookieName,{path:'/'});return operation;
 });
 app.post(AccountExitRoutes.exitStatus.path,async(request,reply)=>{reply.header('cache-control','no-store');const input=AccountExitRoutes.exitStatus.input.parse(request.body);return service.status(input.capability);});
}

export function registerSettlementRoutes(app:FastifyInstance,chain:ChainGateway){
 const limit=createWindowLimiter(20,60000,2000);
 for(const route of [ExitSettlementRoutes.settlementPrepare,ExitSettlementRoutes.settlementSubmit,ExitSettlementRoutes.settlementReceipt]){
  app.post(route.path,async(request,reply)=>{
   reply.header('cache-control','no-store');if(!limit(request.ip,Date.now()))throw new ApiError('RATE_LIMIT',429);
   if(route===ExitSettlementRoutes.settlementPrepare){if(!chain.prepareSettlement)throw new ApiError('EXIT_NATIVE_STEP_UNAVAILABLE',503);return chain.prepareSettlement(route.input.parse(request.body));}
   const packet=ExitSettlementRoutes.settlementSubmit.input.parse(request.body);
   if(route===ExitSettlementRoutes.settlementSubmit){if(!chain.submitSettlement)throw new ApiError('EXIT_NATIVE_STEP_UNAVAILABLE',503);return chain.submitSettlement(packet);}
   if(!chain.reconcileExitSubmission)throw new ApiError('EXIT_NATIVE_STEP_UNAVAILABLE',503);return chain.reconcileExitSubmission(packet);
  });
 }
}
