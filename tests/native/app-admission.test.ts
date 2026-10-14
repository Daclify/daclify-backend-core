import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrivateKey, ABI, Serializer, Checksum256, Authority, UInt64 } from '@wharfkit/antelope';
import { writeFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import { encodeAction, encodeAppJoin, instructionDigest, makeInstruction, RuntimeTableSchemas } from '../../sdk/index.js';
import {AppJoinCodeHash,AppJoinRawAbiHash,AppJoinTableSchemas} from '../../sdk/app-admission.js';
import { ModuleCodeHashes, activityAbi, encodeDecide, DecideTableSchemas } from '@daclify/modules/sdk';
import { nativeContracts, nativeModules, type NativeContracts, type DummyDao } from '../helpers/native-contracts.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
let owned: NativeContracts | undefined, dao: DummyDao;
const regular = PrivateKey.generate('K1'), admin = PrivateKey.generate('K1');
const invitationKey = PrivateKey.generate('K1');
const metrics: Record<string, { ramBytes:number;cpuUs:number }> = {};
function fixture() { if (!owned) throw new Error('FIXTURE_REQUIRED'); return owned; }
async function ram() { const accounts=await Promise.all(['daclifycore','appjoin'].map(name=>fixture().api.v1.chain.get_account(name)));return accounts.reduce((bytes,account)=>bytes+account.ram_usage.toNumber(),0); }
async function measured(name:string, action:()=>Promise<unknown>) {
  const before=await ram(),result=await action();
  const receipt=z.object({processed:z.object({receipt:z.object({cpu_usage_us:z.number()})})}).parse(result);
  metrics[name]={ramBytes:(await ram())-before,cpuUs:receipt.processed.receipt.cpu_usage_us};
}
async function rows(table:keyof typeof RuntimeTableSchemas) {
  return (await fixture().api.v1.chain.get_table_rows({code:'daclifycore',scope:dao.daoId,table,limit:100})).rows;
}
function join(key:PrivateKey,id='0') {
  const proof={version:1,action:'appadmit',source:'appjoin',chain_id:fixture().chainId,runtime:'daclifycore',dao_id:dao.daoId,app_id:'1',app_revision:'1',invitation_id:id,token_hash:id==='0'?'00'.repeat(32):'cd'.repeat(32),signing_key:key.toPublic().toString(),encryption_key:'disposable',custody:0,expires:Math.floor(Date.now()/1000)+120};
  return {proof,...(id!=='0'?{invitation_signature:invitationKey.signDigest(Checksum256.hash(Serializer.encode({abi:fixture().abi('appjoin'),type:'app_join_proof',object:proof}))).toString()}:{})};
}
beforeAll(async()=>{
  owned=await nativeContracts();
  await owned.push(contextLinkRepairActions(owned.context,await owned.api.v1.chain.get_account('daclifycore')),[owned.key('daclifycore')]);
  await owned.create('activity');await owned.deploy('activity','../daclify-backend-modules/.artifacts/contracts/activity');
  await owned.call('daclifycore','listmod',{account:'activity',publisher:'alice',party:0,accepts_fee_rule:1,price:'0.0000 TLOS',code_hash:ModuleCodeHashes.activity,title:'Owned app admission qualification'});
  dao=await owned.dummyDao();
  await owned.call('daclifycore','listmod',{account:'appjoin',publisher:'alice',party:0,accepts_fee_rule:1,price:'0.0000 TLOS',code_hash:AppJoinCodeHash,title:'App admission source'});
  await owned.call('daclifycore','setmodule',{dao_id:dao.daoId,account:'appjoin',version:1,actions:['setappjoin','appinvite'],grants:['admitapp'],code_hash:AppJoinCodeHash},'alice');
  await owned.call('appjoin','init',{runtime:'daclifycore'});
  await owned.call('appjoin','bindrampool',{runtime:'daclifycore'});
  await owned.push(['setappjoin','appinvite'].map(type=>fixture().system('linkauth',{account:'daclifycore',code:'appjoin',type,requirement:'execctx'},'daclifycore','owner')),[owned.key('daclifycore')]);
  await owned.update('appjoin','active','owner',Authority.from({threshold:1,keys:[{key:owned.key('appjoin').toPublic(),weight:1}],accounts:[{permission:{actor:'appjoin',permission:'eosio.code'},weight:1}],waits:[]}));
  await owned.call('daclifycore','setmodule',{dao_id:dao.daoId,account:'activity',version:1,actions:['recordact','askreview'],grants:[],code_hash:ModuleCodeHashes.activity},'alice');
  await dao.act('daclifycore','setexecs',encodeAction('setexecs',{...dao.actor(),member_ids:['1'],inactivity_seconds:0,quorum_bps:10000}));
  await dao.act('daclifycore','setapp',encodeAction('setapp',{...dao.actor(),app_id:'1',target:'activity',revision:'1',config_hash:'ef'.repeat(32),enabled:true}));
  await measured('policy',()=>dao.act('appjoin','setappjoin',encodeAppJoin('setappjoin',{...dao.actor(),app_id:'1',app_revision:'1',gateway:'relay',gateway_permission:'active',public_join:true,enabled:true})));
},90000);
afterAll(async()=>{
  writeFileSync('.artifacts/app-admission-native.json',JSON.stringify({runtimeWasmBytes:statSync('.artifacts/contracts/runtime.wasm').size,appJoinWasmBytes:statSync('.artifacts/contracts/appjoin.wasm').size,metrics},null,2)+'\n');
  await owned?.stop();
});
it('requires the actual approved gateway authority and admits one non-voting identity',async()=>{
  await expect(fixture().call('appjoin','appadmit',join(regular),'alice')).rejects.toThrow();
  await measured('ordinaryJoin',()=>fixture().call('appjoin','appadmit',join(regular),'relay'));
  await fixture().call('appjoin','appadmit',join(regular),'relay');
  expect(await dao.member('4')).toMatchObject({admin:false,active:true});
  expect((await rows('nonvoters')).map(r=>RuntimeTableSchemas.nonvoters.parse(r).member_id)).toContain('4');
  expect((await rows('members')).length).toBe(4);
});
it('requires native admin signature for an invite and grants admin plus executive rights atomically',async()=>{
  const invite={...dao.actor(),app_id:'1',app_revision:'1',invitation_id:'77',token_hash:'cd'.repeat(32),invitation_key:invitationKey.toPublic().toString(),admin:true,expires:Math.floor(Date.now()/1000)+600,revoke:false};
  await expect(dao.act('appjoin','appinvite',encodeAppJoin('appinvite',{...invite,member_id:'2'}),'2')).rejects.toThrow('ADMIN_REQUIRED');
  await measured('adminInvitation',()=>dao.act('appjoin','appinvite',encodeAppJoin('appinvite',invite)));
  await measured('adminJoin',()=>fixture().call('appjoin','appadmit',join(admin,'77'),'relay'));
  expect(await dao.member('5')).toMatchObject({admin:true,active:true});
  expect((await rows('executives')).map(r=>RuntimeTableSchemas.executives.parse(r).member_id)).toEqual(['1','5']);
  expect((await rows('nonvoters')).map(r=>RuntimeTableSchemas.nonvoters.parse(r).member_id)).not.toContain('5');
  await fixture().call('appjoin','appadmit',join(admin,'77'),'relay');
  await expect(fixture().call('appjoin','appadmit',join(PrivateKey.generate('K1'),'77'),'relay')).rejects.toThrow('APP_INVITE_USED');
});
it('rejects real voting by an app non-voter and rolls back privileged admission during a ballot',async()=>{
  await dao.act('decide','open',encodeDecide('open',{...dao.actor(),ballot_id:'77',kind:0,choices:2,duration:60,quorum:5000,approval:5001,metadata:'{"title":"Owned app eligibility ballot"}'}));
  const definitions=await fixture().api.v1.chain.get_table_rows({code:'decide',scope:'daclifycore',table:'ballotdefs',lower_bound:UInt64.from('77'),limit:1});
  const expected=DecideTableSchemas.ballotdefs.parse(definitions.rows[0]).commitment;
  const request=makeInstruction(dao.reference,'4',(await dao.member('4')).nonce,Math.floor(Date.now()/1000)+120,'decide','votecommit',encodeDecide('votecommit',{...dao.actor('4'),ballot_id:'77',expected,choice:1}));
  const action=fixture().action('daclifycore','submit',{request,sig:regular.signDigest(instructionDigest(request))},[{actor:'relay',permission:'active'}],fixture().abi('daclifycore'));
  await expect(fixture().push([action],[fixture().key('relay')])).rejects.toThrow('VOTER_INELIGIBLE');
  await dao.act('appjoin','appinvite',encodeAppJoin('appinvite',{...dao.actor(),app_id:'1',app_revision:'1',invitation_id:'78',token_hash:'cd'.repeat(32),invitation_key:invitationKey.toPublic().toString(),admin:true,expires:Math.floor(Date.now()/1000)+600,revoke:false}));
  await expect(fixture().call('appjoin','appadmit',join(PrivateKey.generate('K1'),'78'),'relay')).rejects.toThrow('GOVERNANCE_LOCKED');
  expect((await rows('members')).length).toBe(5);
});

it('stops admission if a configured DAO later becomes the platform governing DAO',async()=>{
 await fixture().call('daclifycore','setnativegov',{dao_id:dao.daoId,contracts:[],service_key:fixture().key('relay').toPublic().toString(),creator:'alice',inline_code:[]},'daclifycore','owner');
 await expect(fixture().call('appjoin','appadmit',join(admin),'relay')).rejects.toThrow('NATIVE_GOVERNANCE_REQUIRED');
});
it('registers and backfills the admission source in bounded operator-authorized RAM migration batches',async()=>{
 await expect(fixture().call('appjoin','checkmig',{runtime:'daclifycore',kind:7},'alice')).rejects.toThrow();
 await fixture().call('daclifycore','setlifecode',{account:'appjoin',code_hash:AppJoinCodeHash,kind:7});
 const deployed=await fixture().api.v1.chain.get_raw_abi('appjoin');expect(String(deployed.code_hash)).toBe(AppJoinCodeHash);expect(String(deployed.abi_hash)).toBe(AppJoinRawAbiHash);
 await fixture().push([fixture().action('activity','bindrampool',{runtime:'daclifycore'},[{actor:'activity',permission:'active'}],ABI.from(activityAbi))],[fixture().key('activity')]);for(const module of nativeModules)await fixture().call(module.account,'bindrampool',{runtime:'daclifycore'});
 await fixture().call('daclifycore','beginram',{sources:[{account:'activity',kind:6,code_hash:ModuleCodeHashes.activity},...nativeModules.map((module,index)=>({account:module.account,kind:index+1,code_hash:ModuleCodeHashes[module.id]})),{account:'appjoin',kind:7,code_hash:AppJoinCodeHash}]});
 for(const table of ['rampayer','appjoins','appinvites','closechecks']){
  await fixture().call('appjoin','scanram',{runtime:'daclifycore',table,limit:25},'daclifycore');
  await fixture().call('appjoin','scanram',{runtime:'daclifycore',table,limit:25},'daclifycore');
 }
 const cursors=await fixture().api.v1.chain.get_table_rows({code:'appjoin',scope:'appjoin',table:'ramcursors',limit:25});
 expect(cursors.rows.length).toBeGreaterThan(0);
 for(const row of cursors.rows)expect(AppJoinTableSchemas.ramcursors.parse(row).complete).toBe(true);
});
