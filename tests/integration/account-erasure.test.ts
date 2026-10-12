import { afterAll,beforeAll,it,expect } from 'vitest';
import { randomBytes,randomUUID,generateKeyPairSync } from 'node:crypto';
import { Pool } from 'pg';
import {z} from 'zod';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
import { assertErasureInventory } from '../../services/api/src/account-exit/inventory.js';
import { AccountExit } from '../../services/api/src/account-exit/service.js';
import { readAccount,openAccountSession } from '../../services/api/src/auth/account-session.js';
import { readSession } from '../../services/api/src/auth.js';
import { authChain } from '../helpers/auth-chain.js';
const url=process.env.DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test')||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Owned erasure test database required');
const database='daclify_erasure_'+randomBytes(6).toString('hex')+'_test',target=new URL(url);target.pathname='/'+database;
const owner=new Pool({connectionString:url}),pool=new Pool({connectionString:target.toString()});
let canonical:string,retired:string;
beforeAll(async()=>{await owner.query(`CREATE DATABASE ${database}`);await migrate(pool);});
afterAll(async()=>{await pool.end();await owner.query(`DROP DATABASE ${database} WITH(FORCE)`);await owner.end();});
async function fixture(){
 canonical=randomUUID();retired=randomUUID();const key=PrivateKey.generate('K1');
 await pool.query("INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,'user-controlled',$3)",[canonical,key.toPublic().toString(),generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'jwk'})]);
 await pool.query("INSERT INTO accounts(id,signing_key,custody,encryption_key,merged_into) VALUES($1,NULL,'user-controlled',NULL,$2)",[retired,canonical]);
 await pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)',['email:'+canonical,canonical]);
 return key;
}
it('narrows published 041 guards only for monotonic pending-to-erased transitions',async()=>{
 await fixture();
 await expect(pool.query('UPDATE accounts SET signing_key=NULL WHERE id=$1',[canonical])).rejects.toThrow();
 await expect(pool.query("UPDATE accounts SET custody='managed' WHERE id=$1",[retired])).rejects.toThrow();
 await pool.query("UPDATE accounts SET erasure_state='pending' WHERE id=ANY($1::uuid[])",[[canonical,retired]]);
 await pool.query("DELETE FROM credentials WHERE account_id=$1",[canonical]);
 await pool.query("UPDATE accounts SET signing_key=NULL,encryption_key=NULL,erasure_state='erased',erased_at=now() WHERE id=ANY($1::uuid[])",[[canonical,retired]]);
 await expect(pool.query("UPDATE accounts SET erasure_state='none' WHERE id=$1",[canonical])).rejects.toThrow();
 await expect(pool.query('UPDATE accounts SET merged_into=NULL WHERE id=$1',[retired])).rejects.toThrow();
 await expect(pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)',['email:forbidden',retired])).rejects.toThrow();
 expect((await pool.query('SELECT account_scope($1) AS id',[canonical])).rowCount).toBe(0);
 expect(await readAccount(pool,canonical)).toBeNull();
});
it('fails closed when a new foreign-key data class has no erasure policy',async()=>{
 await assertErasureInventory(pool);
 await pool.query('CREATE TABLE unclassified_personal(id uuid PRIMARY KEY,account_id uuid REFERENCES accounts(id))');
 await expect(assertErasureInventory(pool)).rejects.toThrow('ERASURE_INVENTORY_INCOMPLETE');
 await pool.query('DROP TABLE unclassified_personal');
});
it('freezes aliases, revokes auth and erases hosted data while native reads are unavailable',async()=>{
 await fixture();const session=await openAccountSession(pool,canonical);
 const chain={...authChain,memberships:async()=>{throw Error('offline');}};
 const service=new AccountExit(pool,chain,{backupRetentionSeconds:86400});
 const intent={version:1,mode:'delete-account',memberships:[]} as const;
 const operation=await service.begin(canonical,intent,{reauthenticated:true});
 expect(await readSession(pool,session.token)).toBeUndefined();
 expect((await pool.query('SELECT account_id FROM account_exit_scope WHERE operation_id=$1',[operation.id])).rows.map(row=>row.account_id).sort()).toEqual([canonical,retired].sort());
 await service.eraseHosted(operation.id);
 expect((await pool.query('SELECT signing_key,encryption_key,erasure_state FROM accounts WHERE id=ANY($1::uuid[])',[[canonical,retired]])).rows).toEqual(expect.arrayContaining([{signing_key:null,encryption_key:null,erasure_state:'erased'}]));
 expect((await pool.query('SELECT 1 FROM credentials WHERE account_id=$1',[canonical])).rowCount).toBe(0);
 expect(await openAccountSession(pool,canonical).catch(e=>e.code)).toBe('AUTH_REQUIRED');
 expect(await service.status(operation.statusCapability)).toMatchObject({state:'processing',components:expect.arrayContaining([expect.objectContaining({id:'hosted',state:'confirmed'}),expect.objectContaining({id:'native',state:'unavailable'})])});
 await expect(service.submitNativeStep(operation.id,'1',{})).rejects.toThrow();
});
it('returns the same frozen operation and bounds row cleanup across two leased workers',async()=>{
 const {processAccountExitJob}=await import('../../services/api/src/account-exit/jobs.js');
 await pool.query("UPDATE jobs SET state='completed' WHERE module_id='core-account-exit'");
 await fixture();const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});
 const capability=randomBytes(32).toString('base64url'),intent={version:1,mode:'delete-account',memberships:[]};
 // More rows than one cleanup batch; erased aliases cannot create replacement authority during pruning.
 for(let index=0;index<60;index++)await pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)',['fixture:'+canonical+':'+index,canonical]);
 const operation=await service.begin(canonical,intent,{reauthenticated:true,statusCapability:capability});
 expect(await service.begin(canonical,intent,{reauthenticated:true,statusCapability:capability})).toEqual(operation);
 const outcomes=await Promise.all([processAccountExitJob(pool,service,randomUUID()),processAccountExitJob(pool,service,randomUUID())]);
 expect(outcomes).toContain('idle');expect(outcomes).toContain('retry');
 expect(Number((await pool.query('SELECT count(*) FROM credentials WHERE account_id=$1',[canonical])).rows[0].count)).toBe(36);
 await expect(pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)',['fixture:late',canonical])).rejects.toThrow();
 await pool.query("UPDATE jobs SET due_at=now() WHERE job_key=$1",['account-exit:'+operation.id]);
 expect(await processAccountExitJob(pool,service,randomUUID())).toBe('retry');
 await pool.query("UPDATE jobs SET due_at=now() WHERE job_key=$1",['account-exit:'+operation.id]);
 let final='retry';for(let attempts=0;attempts<10&&final==='retry';attempts++){await pool.query("UPDATE jobs SET due_at=now() WHERE job_key=$1",['account-exit:'+operation.id]);final=await processAccountExitJob(pool,service,randomUUID());}expect(final).toBe('completed');
 expect(await readAccount(pool,canonical)).toBeNull();
});
it('applies the independent exclusion journal before restored SQL can serve an old identity',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{execFileSync}=await import('node:child_process');
 const {AccountErasureExclusions}=await import('../../services/api/src/account-exit/exclusions.js');
 const directory=await mkdtemp('/tmp/daclify-erasure-restore-'),restoreName='daclify_erasure_restore_'+randomBytes(6).toString('hex')+'_test',restoreUrl=new URL(url??'');restoreUrl.pathname='/'+restoreName;
 const restored=new Pool({connectionString:restoreUrl.toString()});
 try{
  await fixture();const journal=new AccountErasureExclusions(directory),capability=randomBytes(32).toString('base64url');
  const env={...process.env,LD_LIBRARY_PATH:'/data/daclify-runtime/postgres/usr/lib/x86_64-linux-gnu'};
  const dump=directory+'/before.dump';
  execFileSync('/data/daclify-runtime/postgres/usr/lib/postgresql/17/bin/pg_dump',['--dbname',target.toString(),'--format=custom','--no-owner','--no-acl','--file',dump],{env,stdio:'pipe'});
  const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400,exclusions:journal});
  const operation=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true,statusCapability:capability});
  await service.eraseHosted(operation.id);
  await owner.query(`CREATE DATABASE ${restoreName}`);
  execFileSync('/data/daclify-runtime/postgres/usr/lib/postgresql/17/bin/pg_restore',['--dbname',restoreUrl.toString(),'--no-owner','--no-acl',dump],{env,stdio:'pipe'});
  expect(await readAccount(restored,canonical)).not.toBeNull();
  await journal.applyBeforeServe(restored);
  expect(await readAccount(restored,canonical)).toBeNull();
  await expect(openAccountSession(restored,canonical)).rejects.toMatchObject({code:'AUTH_REQUIRED'});
  const resumed=new AccountExit(restored,authChain,{backupRetentionSeconds:86400,exclusions:journal});
  expect(await resumed.status(capability)).toMatchObject({id:operation.id,components:expect.arrayContaining([expect.objectContaining({id:'native',state:'unavailable'})])});
  await resumed.eraseHosted(operation.id);
  expect((await restored.query('SELECT signing_key,encryption_key,erasure_state FROM accounts WHERE id=$1',[canonical])).rows[0]).toEqual({signing_key:null,encryption_key:null,erasure_state:'erased'});
 }finally{await restored.end();await owner.query(`DROP DATABASE IF EXISTS ${restoreName} WITH(FORCE)`);await rm(directory,{recursive:true,force:true});}
});
it('requires fresh body-bound ownership and leaves only a read-only status capability after logout',async()=>{
 const {createServer}=await import('../../services/api/src/server.js'),{controlledInject}=await import('../helpers/account-control.js');
 const key=await fixture(),login=await openAccountSession(pool,canonical),service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});
 const app=await createServer(pool,authChain,'http://localhost:5173',{accountExit:service});
 try{
  const headers={origin:'http://localhost:5173',cookie:'daclify_session='+login.token,'x-csrf-token':login.csrfToken};
  const capability=randomBytes(32).toString('base64url'),payload={intent:{version:1,mode:'delete-account',memberships:[]},statusCapability:capability};
  expect((await app.inject({method:'POST',url:'/v1/me/exit',headers,payload})).statusCode).toBe(403);
  const started=await controlledInject(app,key,{method:'POST',url:'/v1/me/exit',headers,payload});expect(started.statusCode).toBe(200);
  expect((await app.inject({method:'GET',url:'/v1/me/exit/preflight',headers})).statusCode).toBe(401);
  const result=await app.inject({method:'POST',url:'/v1/account-exit/status',headers:{origin:headers.origin},payload:{capability}});expect(result.statusCode).toBe(200);
  expect(result.headers['cache-control']).toBe('no-store');expect(result.json()).not.toHaveProperty('statusCapability');
  expect((await app.inject({method:'POST',url:'/v1/account-exit/status',headers:{origin:headers.origin},payload:{capability:randomBytes(32).toString('base64url')}})).statusCode).toBe(404);
 }finally{await app.close();}
});
it('stores a native packet before send and reconciles an unknown response without a second submission',async()=>{
 const {makeInstruction,encodeAction}=await import('../../sdk/index.js');
 const {exitInstructionDigest,exitOperationCommitment,exitStepCommitment}=await import('../../sdk/account-exit.js');
 const key=await fixture();const reference={chainId:'ab'.repeat(32),contract:'daclifycore',daoId:'1',interfaceVersion:1 as const};
 let submissions=0,visible=false;
 const chain={...authChain,memberships:async()=>[{dao:reference,memberId:'1',nonce:'0',active:true,admin:false,reviewer:false,credits:'0',claim:'0',stake:'0',nativeAccount:'',custody:'user-controlled' as const}],
 prepareExitSubmission:async()=>({transactionId:'ab'.repeat(32),packet:'aa',firstBlock:1,cursor:1,expiresAt:new Date(Date.now()+60000).toISOString()}),
 submitPreparedExit:async()=>{submissions++;expect((await pool.query('SELECT transaction_id FROM account_exit_steps WHERE operation_id=$1',[operation.id])).rows[0]?.transaction_id).toBe('ab'.repeat(32));throw Error('unknown after delivery');},
 reconcileExitSubmission:async()=>({state:visible?'confirmed' as const:'unavailable' as const,cursor:1}),
 };
 const service=new AccountExit(pool,chain,{backupRetentionSeconds:86400});
 const operation=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[{chainId:reference.chainId,runtime:reference.contract,daoId:'1',memberId:'1',choice:'leave'}]},{reauthenticated:true});
 const request=makeInstruction(reference,'1','0',Math.floor(Date.now()/1000)+300,'daclifycore','leave',encodeAction('leave',{runtime:'daclifycore',dao_id:'1',member_id:'1'}));
 const signed={operation:exitOperationCommitment(operation.id),step_digest:exitStepCommitment(operation.id,'departure',request),request,sig:''};signed.sig=key.signDigest(exitInstructionDigest(signed.operation,signed.step_digest,request)).toString();
 await service.submitNativeStep(operation.id,'departure',signed);expect(submissions).toBe(1);
 visible=true;const completed=await service.submitNativeStep(operation.id,'departure',signed);expect(submissions).toBe(1);
 expect(completed.components.find(component=>component.id==='native')?.state).toBe('confirmed');
 await expect(service.submitNativeStep(operation.id,'changed-step',signed)).rejects.toMatchObject({code:'EXIT_STEP_CONTEXT'});
});
it('upgrades the published 041 account guards without changing their hash or historical identities',async()=>{
 const {readFile,readdir}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const name='daclify_erasure_041_'+randomBytes(6).toString('hex')+'_test',oldUrl=new URL(url??'');oldUrl.pathname='/'+name;
 const old=new Pool({connectionString:oldUrl.toString()});
 try{
  await owner.query(`CREATE DATABASE ${name}`);
  await old.query('CREATE TABLE schema_migrations(namespace text NOT NULL,name text NOT NULL,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,name))');
  for(const file of (await readdir('migrations')).filter(file=>/^\d{3}_.*\.sql$/.test(file)&&file<='041_account_reconnect.sql').sort()){
   const sql=await readFile('migrations/'+file,'utf8');await old.query(sql);await old.query('INSERT INTO schema_migrations(namespace,name,hash) VALUES($1,$2,$3)',['core',file,createHash('sha256').update(sql).digest('hex')]);
  }
  const id=randomUUID(),alias=randomUUID(),key=PrivateKey.generate('K1');
  await old.query("INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,'user-controlled',$3)",[id,key.toPublic().toString(),generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'jwk'})]);
  await old.query("INSERT INTO accounts(id,signing_key,custody,encryption_key,merged_into) VALUES($1,NULL,'user-controlled',NULL,$2)",[alias,id]);
  await expect(old.query('UPDATE accounts SET signing_key=NULL WHERE id=$1',[id])).rejects.toThrow();
  await expect(old.query("UPDATE accounts SET custody='managed' WHERE id=$1",[alias])).rejects.toThrow();
  const before=(await old.query("SELECT hash FROM schema_migrations WHERE name='041_account_reconnect.sql'")).rows[0];
  await migrate(old);
  await old.query("UPDATE accounts SET erasure_state='pending' WHERE id=ANY($1::uuid[])",[[id,alias]]);
  await old.query("UPDATE accounts SET signing_key=NULL,encryption_key=NULL,wallet_origin=NULL,erasure_state='erased',erased_at=now() WHERE id=ANY($1::uuid[])",[[id,alias]]);
  expect((await old.query("SELECT hash FROM schema_migrations WHERE name='041_account_reconnect.sql'")).rows[0]).toEqual(before);
  expect((await old.query('SELECT id,merged_into FROM accounts ORDER BY id')).rows).toEqual(expect.arrayContaining([{id,merged_into:null},{id:alias,merged_into:id}]));
 }finally{await old.end();await owner.query(`DROP DATABASE IF EXISTS ${name} WITH(FORCE)`);}
});
it('removes key/email challenges and personal reconciliation jobs before nulling the owner',async()=>{
 const key=await fixture(),mailbox=canonical+'@example.com';
 await pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)',['email:'+mailbox,canonical]);
 const rootChallenge=randomUUID(),emailChallenge=randomUUID(),jobId=randomUUID();
 await pool.query('INSERT INTO challenges(id,signing_key,message,expires_at) VALUES($1,$2,$3,now()+interval \'5 minutes\')',[rootChallenge,key.toPublic().toString(),'private-login-context']);
 await pool.query("INSERT INTO signin_challenges(id,purpose,subject,secret_hash,context_hash,expires_at) VALUES($1,'email-login',$2,$3,$4,now()+interval '5 minutes')",[emailChallenge,mailbox,randomBytes(32),randomBytes(32)]);
 await pool.query("INSERT INTO jobs(id,module_id,kind,job_key,payload,due_at) VALUES($1,'core-profiles','reconcile',$2,$3,now())",[jobId,'personal:'+jobId,{accountId:canonical}]);
 const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});
 const operation=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});
 await service.eraseHosted(operation.id);
 expect((await pool.query('SELECT 1 FROM challenges WHERE id=$1',[rootChallenge])).rowCount).toBe(0);
 expect((await pool.query('SELECT 1 FROM signin_challenges WHERE id=$1',[emailChallenge])).rowCount).toBe(0);
 expect((await pool.query('SELECT 1 FROM jobs WHERE id=$1',[jobId])).rowCount).toBe(0);
 expect((await service.status(operation.statusCapability)).components).toEqual(expect.arrayContaining([expect.objectContaining({id:'apps',state:'confirmed'})]));
});
it('distinguishes current native profile removal from controlled envelopes and confirms elapsed backup retention',async()=>{
 await fixture();const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});
 const operation=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});
 await service.eraseHosted(operation.id);
 await pool.query("UPDATE account_exit_operations SET components=(SELECT jsonb_agg(CASE WHEN c->>'id'='backups' THEN c||jsonb_build_object('expiresAt','2020-01-01T00:00:00.000Z') ELSE c END) FROM jsonb_array_elements(components)c) WHERE id=$1",[operation.id]);
 const report=await service.status(operation.statusCapability);
 expect(report.components.find(c=>c.id==='backups')).toMatchObject({state:'confirmed',reason:'CONTROLLED_BACKUP_HORIZON_ELAPSED'});
 expect(report.state).toBe('complete');
});
it('rejects a new unclassified dependent table even without a direct account foreign key',async()=>{
 await pool.query('CREATE TABLE unclassified_recovery_note(id uuid PRIMARY KEY,credential_id bytea REFERENCES passkeys(credential_id))');
 try{await expect(assertErasureInventory(pool)).rejects.toThrow('ERASURE_INVENTORY_INCOMPLETE');}finally{await pool.query('DROP TABLE unclassified_recovery_note');}
});
it('allows deliberate fresh enrollment with a new UUID after erasure without reviving the old UUID',async()=>{
 const {createChallenge,authenticate}=await import('../../services/api/src/auth.js');
 const key=await fixture(),encryption=(await readAccount(pool,canonical))?.encryptionKey;if(!encryption)throw Error('FIXTURE');
 const oldId=canonical,service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});
 const op=await service.begin(oldId,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});await service.eraseHosted(op.id);
 const challenge=await createChallenge(pool,{signingKey:key.toPublic().toString(),encryptionKey:encryption},'http://localhost:5173');
 const login=await authenticate(pool,challenge.id,key.signMessage(new TextEncoder().encode(challenge.message)).toString(),encryption);
 expect(login.account.id).not.toBe(oldId);expect(await readAccount(pool,oldId)).toBeNull();expect(await readAccount(pool,login.account.id)).not.toBeNull();
});
it('retains cached membership references for an offline deletion without granting authority from the cache',async()=>{
 await fixture();await pool.query('INSERT INTO memberships(account_id,chain_id,contract,dao_id,member_id) VALUES($1,$2,$3,7,9)',[canonical,'ab'.repeat(32),'daclifycore']);
 const service=new AccountExit(pool,{...authChain,memberships:async()=>{throw Error('offline');}},{backupRetentionSeconds:86400});
 const preflight=await service.preflight(canonical);expect(preflight.nativeAvailable).toBe(false);expect(preflight.memberships[0]).toMatchObject({reference:{daoId:'7'},memberId:'9',reason:'CACHED_REFERENCE_REQUIRES_NATIVE_RECHECK'});
 const op=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});await service.eraseHosted(op.id);
 expect((await service.status(op.statusCapability)).components).toEqual(expect.arrayContaining([expect.objectContaining({id:'native-profile:'+['ab'.repeat(32),'daclifycore','7','9'].join(':'),state:'unavailable'})]));
 expect((await pool.query('SELECT 1 FROM memberships WHERE account_id=$1',[canonical])).rowCount).toBe(0);
});
it('keeps closure blocked by hosted liabilities and rejects late billing creation after its fence',async()=>{
 await fixture();const reference={chainId:'ab'.repeat(32),contract:'daclifycore',daoId:'1',interfaceVersion:1 as const};let acknowledgments=0;
 const chain={...authChain,memberships:async()=>[{dao:reference,memberId:'1',nonce:'0',active:true,admin:true,reviewer:false,credits:'0',claim:'0',stake:'0',nativeAccount:'',custody:'user-controlled' as const}],dao:async()=>({reference,title:'Closure fixture',description:'',privacy:'public' as const,owner:'alice',token:{chainId:reference.chainId,contract:'eosio.token',symbol:'TLOS',precision:4},members:1,available:'0',reserved:'0',claims:'0',keyEpoch:'0',lifecycle:'closing' as const}),attestHostedClosure:async(_dao:typeof reference,receipt:string)=>{if(receipt!=='00'.repeat(32))acknowledgments++;}};
 const policy='ef'.repeat(32);await pool.query('INSERT INTO hosting_prices(policy_key,pricing) VALUES($1,$2) ON CONFLICT DO NOTHING',[policy,{freeSlots:1,rates:{}}]);
 const subscription=randomUUID();await pool.query("INSERT INTO hosting_subscriptions(id,dao_key,dao,created_by,request_id,pricing,extra_slots,price_key) VALUES($1,$2,$3,$4,$5,$6,1,$7)",[subscription,JSON.stringify([reference.chainId,reference.contract,reference.daoId,1]),reference,canonical,randomUUID(),{freeSlots:1,rates:{}},policy]);
 const service=new AccountExit(pool,chain,{backupRetentionSeconds:86400});const op=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[{chainId:reference.chainId,runtime:reference.contract,daoId:'1',memberId:'1',choice:'close'}]},{reauthenticated:true});
 expect(await service.eraseHosted(op.id)).toBe('retry');expect(acknowledgments).toBe(0);
 expect((await service.status(op.statusCapability)).components.find(c=>c.id==='hosted-dao:1')).toMatchObject({state:'unavailable',reason:'HOSTED_SERVICE_LIABILITIES_REMAIN'});
 await pool.query("UPDATE hosting_subscriptions SET state='ended' WHERE id=$1",[subscription]);await service.eraseHosted(op.id);expect(acknowledgments).toBe(1);
 await expect(pool.query("INSERT INTO hosting_subscriptions(id,dao_key,dao,created_by,request_id,pricing,extra_slots,price_key) VALUES($1,$2,$3,$4,$5,$6,1,$7)",[randomUUID(),JSON.stringify([reference.chainId,reference.contract,reference.daoId,1]),reference,canonical,randomUUID(),{freeSlots:1,rates:{}},policy])).rejects.toThrow('HOSTED_DAO_CLOSING');
});
it('does not mark a job complete when its lease was lost after idempotent hosted erasure',async()=>{
 const {processAccountExitJob}=await import('../../services/api/src/account-exit/jobs.js');
 await pool.query("UPDATE jobs SET state='completed' WHERE module_id='core-account-exit'");await fixture();
 class LosingLeaseExit extends AccountExit{override async eraseHosted(id:string){const result=await super.eraseHosted(id);await pool.query("UPDATE jobs SET lease_owner=$2 WHERE job_key=$1",['account-exit:'+id,randomUUID()]);return result;}}
 const service=new LosingLeaseExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});
 const operation=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});
 expect(await processAccountExitJob(pool,service,randomUUID())).toBe('lost');
 expect((await pool.query('SELECT state FROM jobs WHERE job_key=$1',['account-exit:'+operation.id])).rows[0]?.state).toBe('running');
 expect((await service.status(operation.statusCapability)).components.find(c=>c.id==='hosted')?.state).toBe('confirmed');
});
it('removes unreferenced erased UUID anchors after status and backup expiry while preserving a required history anchor',async()=>{
 await fixture();const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:1});
 const operation=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});
 await pool.query("UPDATE accounts SET signing_key=NULL,encryption_key=NULL,wallet_origin=NULL,erasure_state='erased',erased_at='2000-01-01' WHERE id=ANY($1::uuid[])",[[canonical,retired]]);
 await service.eraseHosted(operation.id);await pool.query("UPDATE account_exit_operations SET expires_at='2000-01-01' WHERE id=$1",[operation.id]);
 const evidence=await pool.query("INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,'required-history','{}') RETURNING id",[canonical]);
 await service.cleanup();await service.cleanup();expect((await pool.query('SELECT 1 FROM accounts WHERE id=$1',[retired])).rowCount).toBe(0);expect((await pool.query('SELECT 1 FROM accounts WHERE id=$1',[canonical])).rowCount).toBe(1);
 await pool.query('DELETE FROM audit_events WHERE id=$1',[evidence.rows[0].id]);await service.cleanup();const {ErasureInventory}=await import('../../services/api/src/account-exit/inventory.js');const blockers=[];for(const item of ErasureInventory)if((await pool.query('SELECT 1 FROM '+item.table+' WHERE '+item.column+'=$1',[canonical])).rowCount)blockers.push(item.table);expect((await pool.query('SELECT 1 FROM accounts WHERE id=$1',[canonical])).rowCount,JSON.stringify(blockers)).toBe(0);
});
it('erases personal credential-history subjects while retaining justified shared history',async()=>{
 await fixture();await pool.query("INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,'shared-required-history',$2)",[canonical,{receipt:'synthetic-settlement'}]);
 const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});const op=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});
 for(let attempt=0;attempt<10;attempt++)if(await service.eraseHosted(op.id)==='completed')break;
 expect((await pool.query("SELECT public_reference FROM audit_events WHERE account_id=$1 AND kind='credential.change'",[canonical])).rowCount).toBe(0);
 expect((await pool.query("SELECT public_reference FROM audit_events WHERE account_id=$1 AND kind='shared-required-history'",[canonical])).rows[0]?.public_reference).toEqual({receipt:'synthetic-settlement'});
});
it('erases unsubmitted temporary reservations without deleting published DAO content or accepting active-owner deletes',async()=>{
 await fixture();const asset=randomUUID(),upload=randomUUID();
 await pool.query("INSERT INTO asset_uploads(id,account_id,dao_key,provider_scope,import_profile,request_id,kind,reference_key,expected_bytes,commitment,request_hash) VALUES($1,$2,'fixture','fixture','public-cidv1-file-v1',$3,'media','temporary',1,$4,$4)",[asset,canonical,randomUUID(),'ac'.repeat(32)]);
 await pool.query("INSERT INTO uploads(id,account_id,dao_key,expected_size,privacy,expires_at) VALUES($1,$2,'fixture',1,'encrypted',now()+interval '1 hour')",[upload,canonical]);
 await expect(pool.query('DELETE FROM asset_uploads WHERE id=$1',[asset])).rejects.toThrow('ASSET_REQUEST_IMMUTABLE');
 const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});const op=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});await service.eraseHosted(op.id);
 expect((await pool.query('SELECT 1 FROM asset_uploads WHERE id=$1',[asset])).rowCount).toBe(0);expect((await pool.query('SELECT 1 FROM uploads WHERE id=$1',[upload])).rowCount).toBe(0);
});
it('rejects an expired account-control signature before starting irreversible erasure',async()=>{
 const {createServer}=await import('../../services/api/src/server.js'),{createHash}=await import('node:crypto');const key=await fixture(),login=await openAccountSession(pool,canonical);
 const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400}),app=await createServer(pool,authChain,'http://localhost:5173',{accountExit:service});
 try{
  const headers={origin:'http://localhost:5173',cookie:'daclify_session='+login.token,'x-csrf-token':login.csrfToken},payload={intent:{version:1,mode:'delete-account',memberships:[]},statusCapability:randomBytes(32).toString('base64url')};
  const challenge=await app.inject({method:'POST',url:'/v1/account/control',headers,payload:{path:'/v1/me/exit',bodyHash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')}});const value=z.object({id:z.uuid(),message:z.string()}).parse(challenge.json());
  await pool.query("UPDATE account_control_intents SET expires_at=now()-interval '1 second' WHERE id=$1",[value.id]);
  const result=await app.inject({method:'POST',url:'/v1/me/exit',headers:{...headers,'x-account-intent-id':value.id,'x-account-signature':key.signMessage(new TextEncoder().encode(value.message)).toString()},payload});expect(result.statusCode).toBe(403);expect(await readAccount(pool,canonical)).not.toBeNull();
 }finally{await app.close();}
});
it('expires minimal unavailable provider pointers instead of retaining them after the disclosed reconciliation window',async()=>{
 await fixture();const pointer='de'.repeat(32);await pool.query("INSERT INTO recovery_object_cleanup(receipt_hash,account_id,receipt,state,expires_at) VALUES($1,$2,'{}','unavailable',now()-interval '1 second')",[pointer,canonical]);
 const service=new AccountExit(pool,{...authChain,memberships:async()=>[]},{backupRetentionSeconds:86400}),op=await service.begin(canonical,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});await service.eraseHosted(op.id);await service.cleanup();expect((await pool.query('SELECT 1 FROM recovery_object_cleanup WHERE receipt_hash=$1',[pointer])).rowCount).toBe(0);await service.eraseHosted(op.id);expect((await service.status(op.statusCapability)).components.find(c=>c.id==='recovery-provider')).toMatchObject({state:'unavailable',reason:'PROVIDER_RECONCILIATION_WINDOW_EXPIRED'});
});
