import {withTransaction} from '../auth/account-session.js';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import type {DaoRef} from '../../../../protocol/base.js';
import {daoPaymentKey} from '../../../../protocol/payments.js';
import type {ChainGateway} from '../chain.js';
import type {ErasureComponent} from '../../../../protocol/account-exit.js';
export interface HostedClosureReconciliation{hosting?:(dao:DaoRef)=>Promise<void>;storage?:(dao:DaoRef)=>Promise<void>}
export async function reconcileHostedClosure(pool:Pool,chain:ChainGateway,dao:DaoRef,providers:HostedClosureReconciliation):Promise<ErasureComponent>{
 const component={id:'hosted-dao:'+dao.daoId,state:'unavailable' as const,reason:'HOSTED_CLOSURE_RECONCILIATION_REQUIRED'};
 if(!chain.attestHostedClosure)return component;
 const summary=await chain.dao(dao.daoId);if(summary.lifecycle!=='closing')return {...component,reason:summary.lifecycle==='closed'?'DAO_ALREADY_CLOSED':'USER_CLOSURE_SIGNATURE_REQUIRED',state:summary.lifecycle==='closed'?'confirmed':'pending'};
 try{
  await withTransaction(pool,async db=>{await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['daclify.hosted-close:'+dao.chainId+':'+dao.contract+':'+dao.daoId]);await db.query('INSERT INTO hosted_closure_fences(chain_id,runtime,dao_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[dao.chainId,dao.contract,dao.daoId]);});
  await providers.hosting?.(dao);await providers.storage?.(dao);
  const paymentKey=daoPaymentKey(dao),storageKey=JSON.stringify([dao.chainId,dao.contract,dao.daoId]);
  const blocked=(await pool.query(`SELECT
   EXISTS(SELECT 1 FROM hosting_subscriptions WHERE dao_key=$1 AND state<>'ended') OR
   EXISTS(SELECT 1 FROM hosting_invoices i JOIN hosting_subscriptions s ON s.id=i.subscription_id WHERE s.dao_key=$1 AND (i.state='pending' OR i.state='settled' AND i.expires>extract(epoch FROM now()))) OR
   EXISTS(SELECT 1 FROM hosting_changes c JOIN hosting_subscriptions s ON s.id=c.subscription_id WHERE s.dao_key=$1 AND c.state='pending') OR
   EXISTS(SELECT 1 FROM storage_subscriptions WHERE dao_key=$2 AND state<>'ended') OR
   EXISTS(SELECT 1 FROM storage_invoices i JOIN storage_subscriptions s ON s.id=i.subscription_id WHERE s.dao_key=$2 AND (i.state IN('pending','review') OR i.state='verified' AND i.period_end>now())) OR
   EXISTS(SELECT 1 FROM storage_changes c JOIN storage_subscriptions s ON s.id=c.subscription_id WHERE s.dao_key=$2 AND c.state IN('pending','review')) OR
   EXISTS(SELECT 1 FROM dao_payment_orders WHERE dao_key=$1 AND (state IN('pending','open') OR dispute='open')) OR
   EXISTS(SELECT 1 FROM dao_payment_refunds r JOIN dao_payment_orders o ON o.id=r.order_id WHERE o.dao_key=$1 AND r.stripe_refund IS NULL) OR
   EXISTS(SELECT 1 FROM dao_merchants WHERE dao_key=$1 AND state<>'disconnected') AS blocked`,[paymentKey,storageKey])).rows[0];
  if(blocked?.blocked!==false){await chain.attestHostedClosure(dao,'00'.repeat(32));return {...component,reason:'HOSTED_SERVICE_LIABILITIES_REMAIN'};}
  const receipt=createHash('sha256').update(JSON.stringify(['daclify.hosted-closure.v1',dao])).digest('hex');
  await chain.attestHostedClosure(dao,receipt);
  await pool.query("UPDATE entitlements SET tier='free',expires_at=now(),storage_limit=0,relay_limit=0 WHERE dao_key IN($1,$2)",[paymentKey,storageKey]);
  return {...component,state:'confirmed',reason:'CONTROLLED_HOSTED_SERVICES_RECONCILED'};
 }catch{return component;}
}
