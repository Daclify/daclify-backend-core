import {expect,it,vi} from 'vitest';
import {PrivateKey} from '@wharfkit/antelope';
import {ModuleStateSchema} from '@daclify/modules';
import {ballotCommitment,ModuleCodeHashes} from '@daclify/modules/sdk';
import {NativeChainGateway} from '../services/api/src/native-chain.js';
const dao={chainId:'ab'.repeat(32),contract:'daclifycore',daoId:'1',interfaceVersion:1 as const};
it('exports all live votes rather than the requesting member vote and rejects a racing ballot',async()=>{
 const gateway=new NativeChainGateway({rpcUrl:'http://127.0.0.1:19988',chainId:dao.chainId,runtime:dao.contract,hub:null,environment:'local',relayActor:'relay',relayKey:PrivateKey.generate('K1'),modules:[{id:'decide',account:'decide'}]});
 const state=ModuleStateSchema.parse({dao,modules:[],ballots:[],votes:[],projects:[],milestones:[],schedules:[],entries:[],controls:[]});
 const {Catalog}=await import('@daclify/modules');const manifest=Catalog.find(row=>row.id==='decide');if(!manifest)throw Error('Fixture manifest');state.modules.push({deployment:{id:'decide',account:'decide',version:manifest.version,codeHash:ModuleCodeHashes.decide},manifest,enabled:true,installed:true,compatible:true,codeVerified:true,actions:[],grants:[]});
 const ballot={id:'1',dao_id:'1',creator:'1',kind:0,choices:2,closes:1000,quorum:5000,approval:5001,denominator:'3',max_member:'3',cast:'2',tallies:['0','2'],status:1,winner:1,metadata:JSON.stringify({schemaVersion:3,semantics:'proposal',title:'Budget',description:'Approve it',options:['Reject','Approve']})};state.ballots=[ballot];
 const definition={ballot_id:'1',dao_id:'1',version:1,purpose:0,policy_revision:'0',policy_hash:'00'.repeat(32),commitment:'00'.repeat(32)};definition.commitment=ballotCommitment({chainId:dao.chainId,runtime:dao.contract,decide:'decide',ballot,definition});state.ballotDefinitions=[definition];
 const live=[{id:'1',ballot:'1',member:'2',weight:'1',choice:1},{id:'2',ballot:'1',member:'3',weight:'1',choice:1}];
 vi.spyOn(gateway,'moduleState').mockResolvedValue(state);vi.spyOn(gateway,'archiveLiveVotes').mockResolvedValue(live);
 let current=ballot;
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({rows:[current],more:false})));
 try{expect(await gateway.ballotExport('1','1')).toMatchObject({definition,votes:live,coverage:'complete-live'});current={...ballot,cast:'3',tallies:['0','3']};await expect(gateway.ballotExport('1','1')).rejects.toThrow('ARCHIVE_HISTORY_PENDING');}finally{vi.unstubAllGlobals();}
});
