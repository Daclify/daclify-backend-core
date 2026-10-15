#pragma once
#include "quick_accounts.hpp"
namespace daclify {
inline void quick_require_proof(name runtime,const quick_anchor& method,const checksum256& digest,const std::vector<char>& proof){
 quick_anchor_valid(method);
 if(method.kind==0){check(proof.size()==66&&proof[0]==0,"QUICK_SIGNATURE");assert_recover_key(digest,unpack<signature>(proof),unpack<public_key>(method.credential));return;}
 if(method.kind==1){check(proof.empty(),"QUICK_SIGNATURE");require_auth(unpack<permission_level>(method.credential));return;}
 const auto wallet=unpack<std::tuple<uint64_t,checksum160>>(method.credential);
 const auto body=evm_hash_words({evm_text("QuickAccount(bytes32 operation)"),digest.extract_as_byte_array()});
 const auto chain=runtime_settings_table(runtime,runtime.value).get().chain_id;
 check(recover_evm_address(evm_typed_digest(chain,runtime,std::get<0>(wallet),body),proof)==std::get<1>(wallet),"QUICK_SIGNATURE");
}
inline void quick_domain(name authority,name runtime,uint16_t version,const checksum256& chain,name deployment,name requested_authority,uint32_t expires){
 check(version==1&&deployment==runtime&&requested_authority==authority&&chain==runtime_settings_table(runtime,runtime.value).get().chain_id,"QUICK_DOMAIN");
 const auto now=current_time_point().sec_since_epoch();check(expires>now&&uint64_t(expires)<=uint64_t(now)+300,"QUICK_EXPIRES");
}
inline void save_quick_configuration(name authority,name runtime,const quick_configuration& value){
 quick_settings rows(authority,runtime.value);auto found=rows.find(0);if(found==rows.end())rows.emplace(authority,[&](auto& row){row=value;});else rows.modify(found,same_payer,[&](auto& row){row=value;});
}
inline quick_configuration quick_gateway(name authority,name runtime){
 check_ram_payer_runtime(authority,runtime);const auto cfg=quick_settings(authority,runtime.value).get(0,"QUICK_NOT_CONFIGURED");require_auth(cfg.gateway);
 check(get_code_hash(cfg.source)==cfg.code_hash,"QUICK_CODE");return cfg;
}
inline void configure_quick(name authority,name runtime,name source,const checksum256& code_hash,const permission_level& gateway,uint32_t maximum){
 require_auth(permission_level{runtime,"active"_n});require_auth(permission_level{authority,"active"_n});
 runtime_settings_table(runtime,runtime.value).get();
 check(source!=runtime&&source!=authority&&is_account(source)&&code_hash!=checksum256{}&&get_code_hash(source)==code_hash,"QUICK_SOURCE");
 check(gateway.actor.value&&gateway.permission.value&&is_account(gateway.actor),"QUICK_GATEWAY");check(maximum>0&&maximum<=5000,"QUICK_CAPACITY");
 ram_payer_binding binding(authority,authority.value);
 if(binding.exists())check(binding.get().runtime==runtime,"RAM_PAYER_RUNTIME");
 else{ram_observer_settings observer(runtime,runtime.value);if(observer.exists()){check(observer.get().runtime_hash==get_code_hash(runtime),"RAM_OBSERVER_REQUIRED");ram_sources sources(runtime,runtime.value);check(sources.get(authority.value,"RAM_SOURCE_UNKNOWN").code_hash==get_code_hash(authority),"RAM_SOURCE_CODE");}const ram_payer_owner owner{runtime};binding.set(owner,authority);observe_ram(runtime,0,authority,"rampayer"_n,pack_size(owner)+224,0);}
 quick_settings settings(authority,runtime.value);auto found=settings.find(0);auto cfg=found==settings.end()?quick_configuration{}:*found;check(maximum>=cfg.records,"QUICK_CAPACITY");
 cfg.source=source;cfg.code_hash=code_hash;cfg.gateway=gateway;cfg.maximum=maximum;save_quick_configuration(authority,runtime,cfg);
}
inline void register_quick_account(name authority,name runtime,const quick_registration& request,const std::vector<char>& proof){
 auto cfg=quick_gateway(authority,runtime);quick_domain(authority,runtime,request.version,request.chain_id,request.runtime,request.authority,request.expires);
 const auto identity=quick_identity(request.chain_id,runtime,request.anchor);quick_accounts rows(authority,runtime.value);auto identities=rows.get_index<"byidentity"_n>();auto found=identities.find(identity);
 if(found!=identities.end())check(request.account_id==found->id&&!found->active&&request.epoch==found->epoch,"QUICK_ACCOUNT_EXISTS");
 else check(!request.account_id&&!request.epoch,"QUICK_ACCOUNT_UNKNOWN");
 quick_require_proof(runtime,request.anchor,quick_digest("qregister",request),proof);
 if(found!=identities.end())rows.modify(rows.get(found->id),same_payer,[](auto& value){value.active=true;value.deactivated_at=0;value.epoch=add64(value.epoch,1);value.approval=quick_anchor{};});
 else{
  check(cfg.records<cfg.maximum&&cfg.next_id<std::numeric_limits<uint64_t>::max(),"QUICK_CAPACITY");
  rows.emplace(authority,[&](auto& value){value.id=cfg.next_id;value.identity=identity;});++cfg.next_id;++cfg.records;save_quick_configuration(authority,runtime,cfg);
 }
}
inline quick_account quick_controlled_account(name authority,name runtime,const quick_control& request){
 quick_gateway(authority,runtime);quick_domain(authority,runtime,request.version,request.chain_id,request.runtime,request.authority,request.expires);
 const auto value=quick_accounts(authority,runtime.value).get(request.account_id,"QUICK_ACCOUNT_UNKNOWN");check(value.active,"QUICK_ACCOUNT_INACTIVE");
 check(value.identity==quick_identity(request.chain_id,runtime,request.anchor),"QUICK_IDENTITY");check(value.epoch==request.epoch,"QUICK_EPOCH");check(value.nonce==request.nonce,"QUICK_NONCE");return value;
}
inline quick_anchor quick_credential(const quick_account& account,const quick_control& request){
 auto method=request.use_default?account.approval:request.anchor;quick_anchor_valid(method);return method;
}
inline void set_quick_default(name authority,name runtime,const quick_default& request,const std::vector<char>& proof,const std::vector<char>& incoming){
 const auto account=quick_controlled_account(authority,runtime,request.control);check(!request.control.use_default,"QUICK_ROOT_REQUIRED");
 const auto digest=quick_digest("qdefault",request);quick_require_proof(runtime,request.control.anchor,digest,proof);
 if(request.method.kind==3)check(request.method.credential.empty()&&incoming.empty(),"QUICK_ANCHOR");
 else{check(request.method.kind==1||request.method.kind==2,"QUICK_APPROVAL");quick_require_proof(runtime,request.method,digest,incoming);}
 quick_accounts rows(authority,runtime.value);rows.modify(rows.get(account.id),same_payer,[&](auto& value){value.approval=request.method;value.epoch=add64(value.epoch,1);value.nonce=add64(value.nonce,1);});
}
inline void submit_quick(name authority,name runtime,const quick_instruction& request,const std::vector<char>& proof){
 const auto account=quick_controlled_account(authority,runtime,request.control);const auto cfg=quick_settings(authority,runtime.value).get(0,"QUICK_NOT_CONFIGURED");
 check(request.target==cfg.source,"QUICK_TARGET");check(request.action=="respond"_n||request.action=="remove"_n,"QUICK_ACTION");check(request.code_hash==cfg.code_hash,"QUICK_CODE");
 check(request.data.size()>=26&&request.data.size()<=16384,"QUICK_PAYLOAD");const auto context=unpack<quick_actor_context>(request.data);const auto method=quick_credential(account,request.control);
 check(context.runtime==runtime&&context.authority==authority&&context.account_id==account.id&&quick_same_anchor(context.credential,method),"QUICK_CONTEXT");
 quick_require_proof(runtime,method,quick_digest("qsubmit",request),proof);
 quick_accounts rows(authority,runtime.value);rows.modify(rows.get(account.id),same_payer,[](auto& value){value.nonce=add64(value.nonce,1);});
 action outgoing;outgoing.account=request.target;outgoing.name=request.action;outgoing.authorization={{authority,"execctx"_n}};outgoing.data=request.data;outgoing.send();
}
inline void deactivate_quick(name authority,name runtime,const quick_control& request,const std::vector<char>& proof){
 const auto account=quick_controlled_account(authority,runtime,request);quick_require_proof(runtime,quick_credential(account,request),quick_digest("qdeactivate",request),proof);
 quick_accounts rows(authority,runtime.value);rows.modify(rows.get(account.id),same_payer,[](auto& value){value.active=false;value.deactivated_at=current_time_point().sec_since_epoch();value.approval=quick_anchor{};value.epoch=add64(value.epoch,1);value.nonce=add64(value.nonce,1);});
}
inline void prune_quick_accounts(name authority,name runtime,const std::vector<uint64_t>& ids){
 check_ram_payer_runtime(authority,runtime);check(!ids.empty()&&ids.size()<=25,"QUICK_BATCH");auto cfg=quick_settings(authority,runtime.value).get(0,"QUICK_NOT_CONFIGURED");quick_accounts rows(authority,runtime.value);const auto now=current_time_point().sec_since_epoch();
 for(auto id:ids){auto found=rows.find(id);if(found==rows.end())continue;check(!found->active&&uint64_t(found->deactivated_at)+30*86400<=now,"QUICK_RETENTION");check(cfg.records>0,"QUICK_ACCOUNTING");rows.erase(found);--cfg.records;}
 save_quick_configuration(authority,runtime,cfg);
}
}
