import { readFileSync } from 'node:fs';
import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { TimePointSec, Name } from '@greymass/eosio';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
import { listFirstParty } from './helpers/list-module.js';
import { wasmCodeHash } from './helpers/code-hash.js';

const keys = Array.from({ length: 4 }, () => PrivateKey.generate('K1'));
const invitationKey = PrivateKey.generate('K1');
function requiredKey(index:number){const key=keys[index];if(!key)throw new Error('FIXTURE_KEY');return key;}
let chain: Blockchain, core: ReturnType<typeof loadContract>, appjoin: ReturnType<typeof loadContract>;
async function act(action: string, fields: object, member = 1) {
  const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
  const person = z.object({ nonce: z.number() }).parse(row(core, 'members', 1n, BigInt(member)));
  const target=['setappjoin','appinvite'].includes(action)?'appjoin':'daclifycore';
  const actionAbi=target==='appjoin'?ABI.from(readFileSync('.artifacts/contracts/appjoin.abi','utf8')):abi;
  const request = { version: 1, chain_id: 'ab'.repeat(32), deployment: 'daclifycore', dao_id: 1,
    member_id: member, nonce: person.nonce, expires: chain.timestamp.toMilliseconds() / 1000 + 120,
    target, action,
    data: Serializer.encode({ abi:actionAbi, type: action, object: { runtime: 'daclifycore', dao_id: 1, member_id: member, ...fields } }).hexString };
  const key = keys[member - 1];
  if (!key) throw new Error('FIXTURE_KEY');
  await send(core, 'submit', [request, key.signDigest(Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }))).toString()], 'relay@active');
}
async function policy(publicJoin = true) {
  await act('setappjoin', { app_id: 1, app_revision: 1, gateway: 'relay', gateway_permission: 'active', public_join: publicJoin, enabled: true });
}
async function invite(admin = false, id = 1) {
  await act('appinvite', { app_id: 1, app_revision: 1, invitation_id: id, token_hash: 'cd'.repeat(32), invitation_key: invitationKey.toPublic().toString(), admin,
    expires: chain.timestamp.toMilliseconds() / 1000 + 600, revoke: false });
}
async function join(key = keys[1], invitation = 0, actor = 'relay@active', withSignature = true) {
  if (!key) throw new Error('FIXTURE_KEY');
  const proof={version:1,action:'appadmit',source:'appjoin',chain_id:'ab'.repeat(32),runtime:'daclifycore',dao_id: 1, app_id: 1, app_revision: 1, invitation_id: invitation,
    token_hash: invitation ? 'cd'.repeat(32) : '00'.repeat(32), signing_key: key.toPublic().toString(), encryption_key: 'encryption', custody: 0, expires:chain.timestamp.toMilliseconds()/1000+120};
  const abi=ABI.from(readFileSync('.artifacts/contracts/appjoin.abi','utf8'));
  const signature=invitation&&withSignature?invitationKey.signDigest(Checksum256.hash(Serializer.encode({abi,type:'app_join_proof',object:proof}))).toString():undefined;
  await send(appjoin, 'appadmit', {proof,invitation_signature:signature}, actor);
}
beforeEach(async () => {
  chain = new Blockchain(); chain.createAccounts('alice', 'relay', 'intruder');
  core = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  appjoin=loadContract(chain,'appjoin','.artifacts/contracts/appjoin');
  loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  loadContract(chain, 'activity', '../daclify-backend-modules/.artifacts/contracts/activity');
  const hash = wasmCodeHash('../daclify-backend-modules/.artifacts/contracts/activity.wasm');
  await send(core, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await listFirstParty(core, 'activity', hash);
  await send(core, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(core, 'enroll', [1, 1, '', requiredKey(0).toPublic().toString(), 'encryption', 0], 'alice@active');
  await send(core, 'appoint', [1, [1], 0, 10000], 'alice@active');
  await send(core, 'setmodule', [1, 'activity', 1, ['recordact', 'askreview'], [], hash], 'alice@active');
  await act('setapp', { app_id: 1, target: 'activity', revision: 1, config_hash: 'ef'.repeat(32), enabled: true });
  const sourceHash=wasmCodeHash('.artifacts/contracts/appjoin.wasm');
  await listFirstParty(core,'appjoin',sourceHash);
  await send(core,'setmodule',[1,'appjoin',1,['setappjoin','appinvite'],['admitapp'],sourceHash],'alice@active');
  await send(appjoin,'init',['daclifycore'],'appjoin@active');
  await send(appjoin,'bindrampool',['daclifycore'],'appjoin@active');
});
it('atomically admits public app visitors as ordinary non-voters and retries one identity', async () => {
  await policy(); await join(); await join();
  expect(row(core, 'members', 1n, 2n)).toMatchObject({ active: true, admin: false, reviewer: false });
  expect(row(core, 'nonvoters', 1n, 2n)).toMatchObject({ member_id: 2 });
  expect(row(core, 'executives', 1n, 2n)).toBeUndefined();
  expect(row(core, 'members', 1n, 3n)).toBeUndefined();
});
it('administrator invitation grants admin, voting and executive office without replacing leaders', async () => {
  await policy(false); await invite(true); await join(keys[1], 1); await join(keys[1], 1);
  expect(row(core, 'members', 1n, 2n)).toMatchObject({ admin: true });
  expect(row(core, 'nonvoters', 1n, 2n)).toBeUndefined();
  expect(row(core, 'executives', 1n, 1n)).toMatchObject({ member_id: 1 });
  expect(row(core, 'executives', 1n, 2n)).toMatchObject({ member_id: 2 });
  await expect(join(keys[2], 1)).rejects.toThrow('APP_INVITE_USED');
});
it('ordinary invitation is non-voting even when public signup is disabled', async () => {
  await policy(false); await expect(join()).rejects.toThrow('APP_JOIN_DISABLED');
  await invite(); await join(keys[1], 1);
  expect(row(core, 'nonvoters', 1n, 2n)).toMatchObject({ member_id: 2 });
  expect(row(core, 'members', 1n, 2n)).toMatchObject({ admin: false });
});
it('the approved gateway cannot claim an invitation without its private-link signature', async () => {
  await policy(false);await invite(true);
  await expect(join(keys[1],1,'relay@active',false)).rejects.toThrow('APP_INVITE_PROOF');
});
it('rejects another gateway, role forgery and removed-member reactivation', async () => {
  await policy(); await expect(join(keys[1], 0, 'intruder@active')).rejects.toThrow();
  await join(); await expect(act('appinvite', { app_id: 1, app_revision: 1, invitation_id: 1, token_hash: 'cd'.repeat(32), invitation_key: invitationKey.toPublic().toString(), admin: true, expires: chain.timestamp.toMilliseconds() / 1000 + 600, revoke: false }, 2)).rejects.toThrow('ADMIN_REQUIRED');
  await act('setactive', { target: 2, active: false });
  await expect(join()).rejects.toThrow('MEMBER_INACTIVE');
});
it('preserves existing member rights when they sign in through ordinary signup', async () => {
  await policy(); await join(keys[0]);
  expect(row(core, 'members', 1n, 1n)).toMatchObject({ admin: true });
  expect(row(core, 'nonvoters', 1n, 1n)).toBeUndefined();
});
it('rejects expired or revoked invitations and an updated application', async () => {
  await policy(false); await invite(true);
  await act('appinvite', { app_id: 1, app_revision: 1, invitation_id: 1, token_hash: 'cd'.repeat(32), invitation_key: invitationKey.toPublic().toString(), admin: true, expires: chain.timestamp.toMilliseconds() / 1000 + 600, revoke: true });
  await expect(join(keys[1], 1)).rejects.toThrow('APP_INVITE_REVOKED');
  await invite(false, 2); chain.addTime(TimePointSec.from(601));
  await expect(join(keys[1], 2)).rejects.toThrow('APP_INVITE_EXPIRED');
  await act('setapp', { app_id: 1, target: 'activity', revision: 2, config_hash: 'ef'.repeat(32), enabled: true });
  await expect(join()).rejects.toThrow('APP_REVISION');
});

it('promotes an existing non-voter with the same member identity and keeps the original executives',async()=>{
 await policy();await join();await invite(true);await join(keys[1],1);
 expect(row(core,'members',1n,2n)).toMatchObject({admin:true});
 expect(row(core,'nonvoters',1n,2n)).toBeUndefined();
 expect(row(core,'executives',1n,1n)).toMatchObject({member_id:1});
 expect(row(core,'executives',1n,2n)).toMatchObject({member_id:2});
 expect(row(core,'members',1n,3n)).toBeUndefined();
});
it('refuses a still-live admin link after its issuing administrator becomes inactive',async()=>{
 await policy();await invite(true,1);await join(keys[1],1);await invite(true,2);
 await act('setactive',{target:1,active:false},2);
 await expect(join(keys[2],2)).rejects.toThrow('APP_INVITE_ISSUER');
 expect(row(appjoin,'appinvites',BigInt(core.name.value.toString()),2n)).toMatchObject({member_id:0});
});
it('prunes expired invitation records in bounded batches after the retention interval',async()=>{
 await policy();for(let id=1;id<=30;id++)await invite(false,id);
 chain.addTime(TimePointSec.from(31*86400));
 await send(appjoin,'pruneappinv',{dao_id:1},'relay@active');
 const scope=BigInt(core.name.value.toString());
 expect(row(appjoin,'appinvites',scope,1n)).toBeUndefined();
 expect(row(appjoin,'appinvites',scope,26n)).toBeDefined();
 await send(appjoin,'pruneappinv',{dao_id:1},'relay@active');
 expect(row(appjoin,'appinvites',scope,26n)).toBeUndefined();
});

it('accepts the pinned admission source as kind 7 for RAM migration',async()=>{
 const activity=chain.getAccount(Name.from('activity'));if(!activity)throw new Error('FIXTURE_ACTIVITY');
 await send(activity,'bindrampool',{runtime:'daclifycore'},'activity@active');
 await send(core,'beginram',{sources:[{account:'activity',kind:6,code_hash:wasmCodeHash('../daclify-backend-modules/.artifacts/contracts/activity.wasm')},{account:'appjoin',kind:7,code_hash:wasmCodeHash('.artifacts/contracts/appjoin.wasm')}]},'daclifycore@active');
});
