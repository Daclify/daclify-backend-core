import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
import type { AccountExit } from './service.js';
export async function processAccountExitJob(pool:Pool,service:AccountExit,owner:string){
 const job=await leaseJob(pool,z.uuid().parse(owner),{moduleId:'core-account-exit',kind:'erase'});if(!job)return 'idle';
 const payload=z.strictObject({operationId:z.uuid()}).safeParse(job.payload);let outcome='retry';
 if(!payload.success)outcome='failed';else try{outcome=await service.eraseHosted(payload.data.operationId);}catch{/* Keep the leased operation recoverable; ordinary logs carry no identity or provider material. */}
 const saved=await pool.query("UPDATE jobs SET state=$1,lease_owner=NULL,lease_until=NULL,last_error_code=$2,due_at=now()+($3::int*interval '1 second') WHERE id=$4 AND state='running' AND lease_owner=$5 AND lease_until>now()",[outcome==='completed'?'completed':outcome==='failed'?'failed':'pending',outcome==='retry'?'EXIT_CLEANUP_PENDING':outcome==='failed'?'EXIT_JOB_INVALID':null,Math.min(3600,30*2**Math.min(job.attempts,7)),job.id,owner]);return saved.rowCount===1?outcome:'lost';
}
export function startAccountExitWorker(pool:Pool,service:AccountExit){const owner=randomUUID();return startPollingWorker(async()=>{const result=await processAccountExitJob(pool,service,owner);await service.cleanup();return result;},'ACCOUNT_EXIT_WORKER_UNAVAILABLE');}
