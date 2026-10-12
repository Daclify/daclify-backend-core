import { describe,it,expect } from 'vitest';
import { ExitIntentSchema,ExitReportSchema } from '../protocol/account-exit.js';
import { ErasureInventory } from '../services/api/src/account-exit/inventory.js';
describe('account exit trust boundaries',()=>{
 it('rejects implicit closure, duplicate memberships and unsafe identifiers',()=>{
  const member={chainId:'ab'.repeat(32),runtime:'daclifycore',daoId:'18446744073709551615',memberId:'1',choice:'leave'};
  expect(ExitIntentSchema.parse({version:1,mode:'delete-account',memberships:[member]}).memberships[0]?.daoId).toBe(member.daoId);
  expect(()=>ExitIntentSchema.parse({version:1,mode:'delete-account',memberships:[member,member]})).toThrow();
  expect(()=>ExitIntentSchema.parse({version:1,mode:'delete-account',memberships:[{...member,choice:'automatic'}]})).toThrow();
  expect(()=>ExitIntentSchema.parse({version:1,mode:'delete-account',memberships:[{...member,daoId:18446744073709551615}]})).toThrow();
 });
 it('never accepts an unavailable component as proof of erasure',()=>{
  expect(()=>ExitReportSchema.parse({version:1,id:crypto.randomUUID(),mode:'delete-account',state:'complete',components:[{id:'hosted',state:'unavailable',reason:'HOST_UNAVAILABLE'}],expiresAt:new Date().toISOString()})).toThrow();
 });
 it('assigns every registered account-owned class a bounded policy and purpose',()=>{
  expect(ErasureInventory.length).toBeGreaterThanOrEqual(43);
  for(const item of ErasureInventory){expect(item.purpose.length).toBeGreaterThan(10);expect(item.expiry.length).toBeGreaterThan(5);expect(['erase','retain','minimize']).toContain(item.disposition);}
  expect(new Set(ErasureInventory.map(x=>x.table+'.'+x.column)).size).toBe(ErasureInventory.length);
 });
});
it('binds exit signatures to the operation and prepared step without accepting arbitrary actions',async()=>{
 const { exitInstructionDigest }=await import('../sdk/account-exit.js');
 const { makeInstruction,encodeAction }=await import('../sdk/index.js');
 const ref={chainId:'ab'.repeat(32),contract:'daclifycore',daoId:'1',interfaceVersion:1 as const};
 const request=makeInstruction(ref,'1','0',12345,'daclifycore','leave',encodeAction('leave',{runtime:'daclifycore',dao_id:'1',member_id:'1'}));
 const a=exitInstructionDigest('ac'.repeat(32),'bd'.repeat(32),request).hexString;
 expect(exitInstructionDigest('ad'.repeat(32),'bd'.repeat(32),request).hexString).not.toBe(a);
 expect(exitInstructionDigest('ac'.repeat(32),'be'.repeat(32),request).hexString).not.toBe(a);
 expect(()=>exitInstructionDigest('ac'.repeat(32),'bd'.repeat(32),{...request,action:'setcredits'})).toThrow('EXIT_ACTION');
});
