import {expect,it} from 'vitest';
import {PrivateKey,Signature,PublicKey,ABI,Serializer,Checksum256} from '@wharfkit/antelope';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {invitationCredential,makeAppJoinProof,signAppInvitation} from '../sdk/connected-apps.js';
import {ConnectedAppConfigSchema} from '../protocol/connected-apps.js';
import {AccountSchema} from '../protocol/api.js';
import {appJoinAbi} from '../sdk/app-admission.js';
it('derives a private-link credential and binds its signature to the recipient and full app',()=>{
  const token='I'.repeat(43),credential=invitationCredential(token);
  const account=AccountSchema.parse({id:randomUUID(),signingKey:PrivateKey.generate('K1').toPublic().toString(),custody:'user-controlled',encryptionKey:generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'jwk'})});
  const config=ConnectedAppConfigSchema.parse({dao:{chainId:'ab'.repeat(32),contract:'daclifycore',daoId:'1',interfaceVersion:1},appId:'1',revision:'1',name:'Garden',origins:['https://garden.example'],redirectUris:['https://garden.example/callback'],activityAccount:'activity',enabled:true});
  const proof=makeAppJoinProof(config,account,'appjoin','77',credential.tokenHash),signature=Signature.from(signAppInvitation(token,proof));
  const digest=(value:typeof proof)=>Checksum256.hash(Serializer.encode({abi:ABI.from(appJoinAbi),type:'app_join_proof',object:value}));
  expect(signature.verifyDigest(digest(proof),PublicKey.from(credential.invitationKey))).toBe(true);
  for(const other of [{...proof,dao_id:'2'},{...proof,app_id:'2'},{...proof,signing_key:PrivateKey.generate('K1').toPublic().toString()},{...proof,expires:proof.expires+1}])expect(signature.verifyDigest(digest(other),PublicKey.from(credential.invitationKey))).toBe(false);
  expect(()=>signAppInvitation('J'.repeat(43),proof)).toThrow('APP_INVITE_DOMAIN');
});
