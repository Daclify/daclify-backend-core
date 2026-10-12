import { constants } from 'node:fs';
import { mkdir,lstat,open,link,unlink,opendir } from 'node:fs/promises';
import { isAbsolute,join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Pool } from 'pg';
import { withTransaction } from '../auth/account-session.js';
export const AccountExclusionSchema=z.strictObject({version:z.literal(1),operationId:z.uuid(),accountIds:z.array(z.uuid()).min(1).max(1024),statusHash:z.string().regex(/^[a-f0-9]{64}$/),expiresAt:z.iso.datetime(),statusExpiresAt:z.iso.datetime().optional()});
export type AccountExclusion=z.infer<typeof AccountExclusionSchema>;
// The controlled restore procedure must preserve this journal separately from ordinary SQL backups.
export class AccountErasureExclusions {
 private cleanupDirectory:Awaited<ReturnType<typeof opendir>>|undefined;
 constructor(private readonly directory:string){if(!isAbsolute(directory))throw Error('ACCOUNT_EXCLUSION_DIRECTORY');}
 private async prepare(){await mkdir(this.directory,{recursive:true,mode:0o700});const stat=await lstat(this.directory);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.uid!==process.getuid?.())throw Error('ACCOUNT_EXCLUSION_DIRECTORY');}
 async read(id:string):Promise<AccountExclusion|null>{
  await this.prepare();z.uuid().parse(id);let file:Awaited<ReturnType<typeof open>>;
  try{file=await open(join(this.directory,id+'.json'),constants.O_RDONLY|constants.O_NOFOLLOW);}catch(error){if(z.object({code:z.literal('ENOENT')}).safeParse(error).success)return null;throw error;}
  try{const stat=await file.stat();if(!stat.isFile()||stat.size>65536||(stat.mode&0o077)!==0||stat.uid!==process.getuid?.())throw Error('ACCOUNT_EXCLUSION_FILE');const record=AccountExclusionSchema.parse(JSON.parse(await file.readFile('utf8')));if(record.operationId!==id)throw Error('ACCOUNT_EXCLUSION_CONTEXT');return record;}finally{await file.close();}
 }
 async write(input:AccountExclusion){
  const record=AccountExclusionSchema.parse(input);await this.prepare();
  const temporary=join(this.directory,'.pending-'+randomUUID()),target=join(this.directory,record.operationId+'.json');
  const file=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{try{await file.writeFile(JSON.stringify(record)+'\n');await file.sync();}finally{await file.close();}
   try{await link(temporary,target);}catch(error){if(!z.object({code:z.literal('EEXIST')}).safeParse(error).success)throw error;}
   const directory=await open(this.directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{await directory.sync();}finally{await directory.close();}
   const saved=await this.read(record.operationId);if(!saved)throw Error('ACCOUNT_EXCLUSION_UNAVAILABLE');return saved;
  }finally{await unlink(temporary);}
 }
 async applyBeforeServe(pool:Pool){
  await this.prepare();let applied=0;
  for await(const entry of await opendir(this.directory)){
   const file=entry.name;
   if(!/^[a-f0-9-]{36}\.json$/.test(file))continue;
   const record=await this.read(file.slice(0,-5));if(!record)continue;
   // Keep exclusions until the last controlled backup has expired; copied backups are outside this guarantee.
   if(Date.parse(record.expiresAt)<=Date.now())continue;
   await withTransaction(pool,async db=>{
    await db.query('SELECT id FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[record.accountIds]);
    const result=await db.query("UPDATE accounts SET erasure_state='pending' WHERE id=ANY($1::uuid[]) AND erasure_state='none'",[record.accountIds]);applied+=result.rowCount??0;
    const owner=(await db.query<{id:string}>('SELECT id FROM accounts WHERE id=ANY($1::uuid[]) AND merged_into IS NULL ORDER BY id LIMIT 1',[record.accountIds])).rows[0];if(!owner)return;
    const components=[{id:'hosted',state:'pending',reason:'RESTORE_CLEANUP_PENDING'},{id:'native',state:'unavailable',reason:'RESTORED_OPERATION_REQUIRES_RECONCILIATION'},{id:'profiles',state:'pending',reason:'PROFILE_CLEANUP_PENDING'},{id:'apps',state:'unavailable',reason:'RESTORED_APP_NOTICE_REQUIRES_RECONCILIATION'},{id:'backups',state:'pending',reason:'CONTROLLED_BACKUP_EXPIRY_PENDING',expiresAt:record.expiresAt},{id:'shared-evidence',state:'retained',reason:'SETTLEMENT_AND_APPLICABLE_RETENTION'}];
    await db.query("INSERT INTO account_exit_operations(id,account_id,mode,intent,components,status_hash,expires_at) VALUES($1,$2,'delete-account',$3,$4,$5,$6) ON CONFLICT DO NOTHING",[record.operationId,owner.id,{version:1,mode:'delete-account',memberships:[]},JSON.stringify(components),Buffer.from(record.statusHash,'hex'),new Date(record.statusExpiresAt??record.expiresAt)]);
    for(const id of record.accountIds)await db.query('INSERT INTO account_exit_scope(operation_id,account_id) SELECT $1,id FROM accounts WHERE id=$2 AND EXISTS(SELECT 1 FROM account_exit_operations WHERE id=$1) ON CONFLICT DO NOTHING',[record.operationId,id]);
    await db.query("INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-account-exit','erase',$1,$2,now()) ON CONFLICT(job_key) DO UPDATE SET state='pending',due_at=now(),lease_owner=NULL,lease_until=NULL",['account-exit:'+record.operationId,{operationId:record.operationId}]);
   });
  }
  return applied;
 }
 async cleanup(){
  await this.prepare();this.cleanupDirectory??=await opendir(this.directory);let removed=0;
  for(let scanned=0;scanned<25;scanned++){
   const entry=await this.cleanupDirectory.read();if(!entry){await this.cleanupDirectory.close();this.cleanupDirectory=undefined;break;}
   const file=entry.name;
   if(/^\.pending-[a-f0-9-]{36}$/.test(file)){const stat=await lstat(join(this.directory,file));if(stat.isFile()&&Date.now()-stat.mtimeMs>3600000){await unlink(join(this.directory,file));removed++;}continue;}
   if(!/^[a-f0-9-]{36}\.json$/.test(file))continue;const record=await this.read(file.slice(0,-5));if(record&&Date.parse(record.expiresAt)<=Date.now()){await unlink(join(this.directory,file));removed++;}
  }
  return removed;
 }
}
