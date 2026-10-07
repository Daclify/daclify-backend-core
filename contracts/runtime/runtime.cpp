#include "admission.hpp"
#include "records.hpp"
#include "governance.hpp"
#include "creation.hpp"
#include "evm_authorization.hpp"
#include <eosio/transaction.hpp>
#define JSON_NOEXCEPTION
#define JSON_HAS_FILESYSTEM 0
#define JSON_HAS_EXPERIMENTAL_FILESYSTEM 0
#include "json.hpp"
using namespace daclify;
CONTRACT runtime : public contract {
public:
  // Off-chain login signs this inert action. Accidental broadcast grants no rights.
  ACTION authproof(name account,checksum256 intent) { require_auth(account);check(intent!=checksum256{},"AUTH_INTENT"); }
  using contract::contract;
  TABLE settings { checksum256 chain_id; uint16_t interface_version=1; EOSLIB_SERIALIZE(settings,(chain_id)(interface_version)) };
  using config = singleton<"settings"_n,settings>;
  ACTION init(checksum256 chain_id) {
    require_auth(get_self()); config c(get_self(),get_self().value);
    check(!c.exists(),"ALREADY_INITIALIZED"); c.set(settings{chain_id,1},get_self());
  }
  ACTION createdao(uint64_t dao_id,name owner,std::string metadata,uint8_t privacy,name token_contract,symbol token_symbol) {
    check(!creation_settings(get_self(),get_self().value).exists(),"CREATION_PAYMENT_REQUIRED");
    create_dao(dao_id,owner,metadata,privacy,token_contract,token_symbol);
  }
  ACTION createpaid(uint64_t dao_id,name owner,std::string metadata,uint8_t privacy,name token_contract,symbol token_symbol,checksum256 reference,public_key creator) {
    auto cfg=creation_settings(get_self(),get_self().value).get();require_auth(cfg.settler);
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();const auto& order=index.get(reference,"CREATION_UNKNOWN");
    check(order.creator==creator&&order.deployment==0,"CREATION_OWNER");check(order.paid,"CREATION_UNPAID");check(!order.used,"CREATION_USED");
    create_dao(dao_id,owner,metadata,privacy,token_contract,token_symbol);
    index.modify(order,same_payer,[&](auto& r){r.used=true;r.dao_id=dao_id;});
  }
private:
  void create_dao(uint64_t dao_id,name owner,const std::string& metadata,uint8_t privacy,name token_contract,symbol token_symbol) {
    require_auth(owner); configuration(); check(dao_id>0,"DAO_ID"); check(privacy<=2,"PRIVACY_POLICY");
    check(is_account(owner),"OWNER_ACCOUNT"); check(token_contract.value>0&&token_symbol.is_valid(),"ASSET_IDENTITY");
    check(dao_rows.find(dao_id)==dao_rows.end(),"DAO_EXISTS"); validate_dao_metadata(metadata);
    dao_rows.emplace(get_self(),[&](auto& d){ d.id=dao_id; d.owner=owner; d.metadata=metadata; d.privacy=privacy; d.token_contract=token_contract; d.token_symbol=token_symbol; });
  }
public:
  ACTION setcreate(uint32_t shared_usd,uint32_t independent_usd,uint16_t premium_bps,name settler) {
    require_auth(get_self());save_creation(shared_usd,independent_usd,premium_bps,settler);
  }
  ACTION govcreate(name runtime,uint64_t dao_id,uint64_t member_id,uint32_t shared_usd,uint32_t independent_usd,uint16_t premium_bps,name settler) {
    platform_actor(runtime,dao_id,member_id);save_creation(shared_usd,independent_usd,premium_bps,settler);
  }
  ACTION setcrrate(uint64_t median,uint8_t precision,uint32_t observed_at) {
    require_auth(get_self());auto now=current_time_point().sec_since_epoch();check(median>0&&precision<=18&&observed_at<=now&&now-observed_at<=900,"CREATION_RATE");
    creation_settings saved(get_self(),get_self().value);auto cfg=saved.get();cfg.median=median;cfg.precision=precision;cfg.observed_at=observed_at;saved.set(cfg,get_self());
  }
  ACTION ordercreate(checksum256 reference,public_key creator,uint8_t deployment,uint8_t method) {
    auto cfg=creation_settings(get_self(),get_self().value).get();require_auth(cfg.settler);check(reference!=checksum256()&&deployment<=1&&method<=1,"CREATION_ORDER");
    const auto fees=fee_configuration();check(fees.token_symbol==symbol("TLOS",4),"CREATION_ASSET");
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();check(index.find(reference)==index.end(),"CREATION_EXISTS");
    uint32_t usd=deployment==0?cfg.shared_usd:cfg.independent_usd;auto now=current_time_point().sec_since_epoch();uint64_t expiry=uint64_t(now)+(method==0?900:3600);check(expiry<=std::numeric_limits<uint32_t>::max(),"TIME_RANGE");
    int64_t amount=0;if(method==0){check(cfg.median>0&&cfg.observed_at<=now&&now-cfg.observed_at<=900,"CREATION_RATE");__int128 scale=1;for(uint8_t i=0;i<cfg.precision;i++)scale*=10;__int128 numerator=__int128(usd)*scale*(10000+cfg.premium_bps)*10000;__int128 denominator=__int128(100)*cfg.median*10000;auto units=(numerator+denominator-1)/denominator;check(units>0&&units<=asset::max_amount,"CREATION_AMOUNT");amount=int64_t(units);}
    auto id=orders.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"CREATION_LIMIT");
    orders.emplace(get_self(),[&](auto& r){r.id=id;r.reference=reference;r.creator=creator;r.deployment=deployment;r.method=method;r.usd_cents=usd;r.tlos_due=asset(amount,fees.token_symbol);r.created_at=now;r.expires=expiry;});
  }
  ACTION cardcreate(checksum256 reference,uint32_t usd_cents,checksum256 checkout_reference,uint32_t paid_at) {
    auto cfg=creation_settings(get_self(),get_self().value).get();require_auth(cfg.settler);check(checkout_reference!=checksum256(),"CREATION_CARD");
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();const auto& order=index.get(reference,"CREATION_UNKNOWN");
    check(order.method==1&&order.usd_cents==usd_cents,"CREATION_AMOUNT");check(paid_at>=order.created_at&&paid_at<=order.expires&&paid_at<=current_time_point().sec_since_epoch(),"CREATION_EXPIRED");
    if(order.paid){check(order.card_reference==checkout_reference,"CREATION_CARD");return;}
    auto cards=orders.get_index<"bycard"_n>();check(cards.find(checkout_reference)==cards.end(),"CREATION_CARD");
    index.modify(order,same_payer,[&](auto& r){r.paid=true;r.card_reference=checkout_reference;});
  }
  ACTION enroll(uint64_t dao_id,uint64_t member_id,name native_account,public_key signing_key,std::string encryption_key,uint8_t custody) {
    enroll_member(dao_id,member_id,native_account,signing_key,encryption_key,custody,0,"");
  }
  ACTION enrollagent(uint64_t dao_id,uint64_t member_id,name native_account,public_key signing_key,std::string encryption_key,uint8_t custody,std::string operator_label) {
    enroll_member(dao_id,member_id,native_account,signing_key,encryption_key,custody,1,operator_label);
  }
  ACTION addmember(name runtime,uint64_t dao_id,uint64_t member_id,public_key signing_key,std::string encryption_key,uint8_t custody,uint8_t kind,std::string operator_label) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);check(kind<=1,"PARTICIPANT_MODE");
    const auto& d=dao_rows.get(dao_id);check(d.max_member<std::numeric_limits<uint64_t>::max(),"MEMBER_LIMIT");
    enroll_member(dao_id,d.max_member+1,name{},signing_key,encryption_key,custody,kind,operator_label,false);
  }
  ACTION initgov(uint64_t dao_id,gov_settings settings) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");require_auth(d.owner);check(d.max_member==0,"BOOTSTRAP_ONLY");
    gov_policies rows(get_self(),get_self().value);check(rows.find(dao_id)==rows.end(),"POLICY_EXISTS");validate_policy(settings);
    rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.config=settings;});
  }
  ACTION setdaogov(name runtime,uint64_t dao_id,uint64_t member_id,gov_settings settings) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);validate_policy(settings);
    const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");
    gov_policies rows(get_self(),get_self().value);auto found=rows.find(dao_id);
    if(found==rows.end()){check(settings.participant_mode!=2,"PARTICIPANT_MODE");rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.config=settings;});}
    else{check(settings.participant_mode==found->config.participant_mode&&settings.guardian==found->config.guardian&&settings.decide==found->config.decide,"POLICY_IDENTITY_IMMUTABLE");rows.modify(found,same_payer,[&](auto& r){r.revision=add64(r.revision,1);r.config=settings;});}
  }
  ACTION addsession(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t session_id,public_key signing_key,uint32_t expires,std::vector<session_permission> permissions) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    auto now=current_time_point().sec_since_epoch();check(session_id>0&&expires>now&&uint64_t(expires)<=uint64_t(now)+604800,"SESSION_EXPIRY");
    check(!permissions.empty()&&permissions.size()<=16,"SESSION_SCOPE");check_unique_key(dao_id,signing_key);
    scoped_sessions rows(get_self(),dao_id);check(rows.find(session_id)==rows.end(),"SESSION_EXISTS");auto index=rows.get_index<"bymember"_n>();uint32_t count=0;
    for(auto it=index.lower_bound(member_id);it!=index.end()&&it->member_id==member_id;++it)++count;
    check(count<16,"SESSION_LIMIT");
    for(size_t i=0;i<permissions.size();i++){
      const auto& permission=permissions[i];
      for(size_t j=0;j<i;j++)check(permission.target!=permissions[j].target||permission.action!=permissions[j].action,"SESSION_SCOPE");
      if(permission.target==get_self()){check((permission.action=="putjson"_n||permission.action=="putdoc"_n)&&permission.code_hash==checksum256(),"SESSION_SCOPE");}
      else{check(permission.action=="open"_n||permission.action=="vote"_n||permission.action=="openwork"_n||permission.action=="propose"_n||permission.action=="submitwork"_n||permission.action=="review"_n,"SESSION_SCOPE");modules installed(get_self(),dao_id);const auto& grant=installed.get(permission.target.value,"MODULE_DISABLED");check_pinned(grant,permission.target);check(permission.code_hash==grant.code_hash&&std::find(grant.actions.begin(),grant.actions.end(),permission.action)!=grant.actions.end(),"SESSION_SCOPE");}
    }
    rows.emplace(get_self(),[&](auto& r){r.id=session_id;r.member_id=member_id;r.signing_key=signing_key;r.expires=expires;r.credential_epoch=credential_epoch(get_self(),dao_id,member_id);r.permissions=permissions;});
  }
  ACTION delsession(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t session_id) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    scoped_sessions rows(get_self(),dao_id);const auto& r=rows.get(session_id,"SESSION_UNKNOWN");check(r.member_id==member_id,"SESSION_MEMBER");rows.erase(r);
  }
  ACTION guardpause(uint64_t dao_id,uint32_t until,checksum256 reason) {
    require_guardian(dao_id);auto now=current_time_point().sec_since_epoch();check(until>now&&uint64_t(until)<=uint64_t(now)+86400,"PAUSE_DURATION");check(reason!=checksum256(),"PAUSE_REASON");
    guardian_states rows(get_self(),get_self().value);auto found=rows.find(dao_id);
    if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.paused_until=until;r.reason=reason;});
    else{check(until>=found->paused_until,"PAUSE_DURATION");rows.modify(found,same_payer,[&](auto& r){r.paused_until=until;r.reason=reason;});}
  }
  ACTION guardrevoke(uint64_t dao_id,uint64_t member_id) {
    require_guardian(dao_id);participants rows(get_self(),dao_id);const auto& p=rows.get(member_id,"AGENT_UNKNOWN");check(p.kind==1,"AGENT_REQUIRED");
    rows.modify(p,same_payer,[&](auto& r){r.revoked=true;r.credential_epoch=add64(r.credential_epoch,1);});
  }
  ACTION guardrecover(uint64_t dao_id,uint64_t member_id,public_key signing_key) {
    require_guardian(dao_id);participants rows(get_self(),dao_id);const auto& p=rows.get(member_id,"AGENT_UNKNOWN");check(p.kind==1&&p.revoked,"AGENT_RECOVERY");
    check_unique_key(dao_id,signing_key);members people(get_self(),dao_id);const auto& m=people.get(member_id,"MEMBER_UNKNOWN");
    people.modify(m,same_payer,[&](auto& r){r.signing_key=signing_key;r.native_account=name{};});
    evm_bindings bindings(get_self(),dao_id);auto binding=bindings.find(member_id);if(binding!=bindings.end())bindings.modify(binding,same_payer,[](auto& r){r.active=false;r.epoch=add64(r.epoch,1);});
    rows.modify(p,same_payer,[&](auto& r){r.revoked=false;r.credential_epoch=add64(r.credential_epoch,1);});
  }
  ACTION setadmit(name runtime,uint64_t dao_id,uint64_t member_id,bool enabled,name source,uint8_t threshold,bool allow_agents,bool admin_override){
    authorized_actor(runtime,dao_id,member_id,true);check(threshold>=1&&threshold<=20,"ENDORSEMENT_THRESHOLD");if(enabled){modules installed(get_self(),dao_id);const auto& grant=installed.get(source.value,"MODULE_DISABLED");check_pinned(grant,source);check(std::find(grant.grants.begin(),grant.grants.end(),"admit"_n)!=grant.grants.end(),"MODULE_GRANT");}
    admission_policies rows(get_self(),get_self().value);auto found=rows.find(dao_id);auto update=[&](auto& r){r.mode=enabled?1:0;r.source=enabled?source:name{};r.threshold=threshold;r.allow_agents=allow_agents;r.admin_override=enabled&&admin_override;};if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;update(r);});else rows.modify(found,same_payer,[&](auto& r){r.revision=add64(r.revision,1);update(r);});
  }
  ACTION admitfrom(uint64_t dao_id,name source,uint64_t application_id,uint64_t revision){
    require_source(dao_id,source,"admit"_n);admission_policies policies(get_self(),get_self().value);const auto& policy=policies.get(dao_id,"ADMISSION_POLICY_UNKNOWN");check(policy.mode==1&&policy.source==source,"ADMISSION_POLICY_CHANGED");admission_applications apps(source,get_self().value);const auto& app=apps.get(application_id,"APPLICATION_UNKNOWN");check(app.dao_id==dao_id&&app.admitted&&app.revision==revision&&app.policy_revision==policy.revision,"APPLICATION_DOMAIN");check(current_time_point().sec_since_epoch()<app.expires,"APPLICATION_EXPIRED");
    enroll_member(dao_id,app.member_id,name{},app.signing_key,app.encryption_key,app.custody,app.kind,app.operator_label,false,true);
  }
private:
  void enroll_member(uint64_t dao_id,uint64_t member_id,name native_account,public_key signing_key,const std::string& encryption_key,uint8_t custody,uint8_t kind,const std::string& operator_label,bool owner_auth=true,bool endorsed=false) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN"); if(owner_auth)require_auth(d.owner);
    admission_policies admission(get_self(),get_self().value);auto rule=admission.find(dao_id);check(endorsed||rule==admission.end()||rule->mode==0||rule->admin_override,"ADMISSION_REQUIRED");
    gov_policies policies(get_self(),get_self().value);auto policy=policies.find(dao_id);
    check(kind==0||(policy!=policies.end()&&policy->config.participant_mode>0),"PARTICIPANT_MODE");
    check(kind==1||policy==policies.end()||policy->config.participant_mode!=2,"PARTICIPANT_MODE");
    if(kind==1){check(!operator_label.empty()&&operator_label.size()<=64,"AGENT_OPERATOR");for(unsigned char c:operator_label)check(c>=0x20&&c<=0x7e,"AGENT_OPERATOR");}
    check(member_id>d.max_member&&member_id>0,"MEMBER_ID"); check(d.member_count<5000,"MEMBER_LIMIT");
    check(custody<=1&&!(d.privacy==2&&custody==1),"CUSTODY_POLICY");
    check(!encryption_key.empty()&&encryption_key.size()<=1024,"ENCRYPTION_KEY");
    check(!native_account.value||is_account(native_account),"NATIVE_ACCOUNT");
    members rows(get_self(),dao_id);
    if(native_account.value) { auto index=rows.get_index<"bynative"_n>(); check(index.find(native_account.value)==index.end(),"CREDENTIAL_EXISTS"); }
    auto key_index=rows.get_index<"bykey"_n>(); auto packed=pack(signing_key);
    check(key_index.find(sha256(packed.data(),packed.size()))==key_index.end(),"CREDENTIAL_EXISTS");
    if(native_account.value) require_auth(native_account);
    check_unique_key(dao_id,signing_key);
    const bool first=d.max_member==0;
    rows.emplace(get_self(),[&](auto& m){m.id=member_id;m.native_account=native_account;m.signing_key=signing_key;m.encryption_key=encryption_key;m.custody=custody;m.admin=first;m.join_epoch=d.key_epoch;});
    dao_rows.modify(d,same_payer,[&](auto& r){r.member_count++;r.max_member=member_id;if(first)r.admin_count++;});
    if(kind==1){participants actors(get_self(),dao_id);actors.emplace(get_self(),[&](auto& r){r.id=member_id;r.kind=1;r.operator_label=operator_label;});}
  }
public:
  ACTION submit(instruction request,signature sig) {
    validate_instruction(request);
    members rows(get_self(),request.dao_id); const auto& m=rows.get(request.member_id,"MEMBER_UNKNOWN");
    auto packed=pack(request); auto digest=sha256(packed.data(),packed.size());
    assert_recover_key(digest,sig,m.signing_key);
    dispatch(request);
  }
  ACTION submitsess(instruction request,uint64_t session_id,signature sig) {
    validate_instruction(request);scoped_sessions sessions(get_self(),request.dao_id);const auto& credential=sessions.get(session_id,"SESSION_UNKNOWN");
    check(credential.member_id==request.member_id,"SESSION_MEMBER");check(credential.expires>current_time_point().sec_since_epoch(),"SESSION_EXPIRED");
    check(credential.credential_epoch==credential_epoch(get_self(),request.dao_id,request.member_id),"SESSION_REVOKED");
    bool permitted=false;for(const auto& permission:credential.permissions)if(permission.target==request.target&&permission.action==request.action){permitted=true;if(permission.target!=get_self())check(permission.code_hash==get_code_hash(permission.target),"SESSION_REVOKED");}
    check(permitted,"SESSION_SCOPE");auto packed=pack(request);assert_recover_key(sha256(packed.data(),packed.size()),sig,credential.signing_key);
    dispatch(request);
  }
  ACTION submitnat(instruction request) {
    validate_instruction(request); members rows(get_self(),request.dao_id);
    const auto& m=rows.get(request.member_id,"MEMBER_UNKNOWN"); check(m.native_account.value,"NATIVE_UNLINKED");
    require_auth(m.native_account); dispatch(request);
  }
  ACTION submitevm(instruction request,uint64_t evm_chain_id,checksum160 address,uint64_t binding_epoch,std::vector<char> proof) {
    validate_instruction(request);evm_bindings bindings(get_self(),request.dao_id);const auto& binding=bindings.get(request.member_id,"EVM_UNLINKED");
    check(binding.active&&binding.chain_id==evm_chain_id&&binding.address==address&&binding.epoch==binding_epoch,"EVM_BINDING");
    const auto data_hash=sha256(request.data.data(),request.data.size()).extract_as_byte_array();
    const auto body=evm_hash_words({evm_text("DaclifyInstruction(uint16 version,bytes32 nativeChain,uint64 runtime,uint64 daoId,uint64 memberId,uint64 evmChainId,address wallet,uint64 bindingEpoch,uint64 nonce,uint32 expires,uint64 target,uint64 action,bytes32 dataHash,uint16 signatureVersion)"),evm_uint(request.version),request.chain_id.extract_as_byte_array(),evm_uint(request.deployment.value),evm_uint(request.dao_id),evm_uint(request.member_id),evm_uint(evm_chain_id),evm_address_word(address),evm_uint(binding_epoch),evm_uint(request.nonce),evm_uint(request.expires),evm_uint(request.target.value),evm_uint(request.action.value),data_hash,evm_uint(1)});
    check(recover_evm_address(evm_typed_digest(request.chain_id,get_self(),evm_chain_id,body),proof)==address,"EVM_ADDRESS");dispatch(request);
  }
  ACTION setmeta(name runtime,uint64_t dao_id,uint64_t member_id,std::string metadata) {
    authorized_actor(runtime,dao_id,member_id,true); validate_dao_metadata(metadata);
    const auto& d=dao_rows.get(dao_id);
    const auto before=nlohmann::json::parse(d.metadata);const auto after=nlohmann::json::parse(metadata);
    if(before.is_object()&&before.contains("schemaVersion")&&(before["schemaVersion"]==2||before["schemaVersion"]==3)&&before.contains("setup")){
      check(after.is_object()&&after.contains("schemaVersion")&&(after["schemaVersion"]==2||after["schemaVersion"]==3)&&after.contains("setup")&&after["setup"]==before["setup"]&&after.contains("purpose")&&before.contains("purpose")&&after["purpose"]==before["purpose"],"PRESET_IDENTITY_IMMUTABLE");
      if(before["schemaVersion"]==3)check(after["schemaVersion"]==3,"METADATA_VERSION");
    }else if(after.is_object()&&after.contains("schemaVersion")){
      if(after["schemaVersion"]==3)check(after["setup"].is_null()&&after["purpose"]=="custom","PRESET_IDENTITY_IMMUTABLE");
    }
    dao_rows.modify(d,same_payer,[&](auto& r){r.metadata=metadata;});
  }
  ACTION setprofile(name runtime,uint64_t dao_id,uint64_t member_id,name account_name,std::string profile) {
    authorized_actor(runtime,dao_id,member_id);validate_profile(profile,account_name);
    profiles rows(get_self(),get_self().value);auto members_index=rows.get_index<"bymember"_n>();auto names=rows.get_index<"byname"_n>();
    auto mine=members_index.find((uint128_t(dao_id)<<64)|member_id);auto taken=names.find(account_name.value);
    if(mine==members_index.end()){check(taken==names.end(),"NAME_TAKEN");rows.emplace(get_self(),[&](auto& r){r.id=rows.available_primary_key();r.dao_id=dao_id;r.member_id=member_id;r.account_name=account_name;r.profile=profile;});}
    else{check(mine->account_name==account_name,"NAME_IMMUTABLE");check(taken==names.end()||taken->id==mine->id,"NAME_TAKEN");members_index.modify(mine,same_payer,[&](auto& r){r.profile=profile;});}
  }
  ACTION grantcredit(uint64_t dao_id,uint64_t member_id,uint64_t quantity) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN"); require_auth(d.owner); check(quantity>0,"QUANTITY"); check(d.active_ballots==0,"GOVERNANCE_LOCKED");
    members rows(get_self(),dao_id); const auto& m=rows.get(member_id,"MEMBER_UNKNOWN"); check(m.active,"MEMBER_INACTIVE");
    rows.modify(m,same_payer,[&](auto& r){r.credits=add64(r.credits,quantity);});
    dao_rows.modify(d,same_payer,[&](auto& r){r.credit_supply=add64(r.credit_supply,quantity);r.eligible_credits=add64(r.eligible_credits,quantity);});
  }
  ACTION setmodule(uint64_t dao_id,name account,uint16_t version,std::vector<name> actions,std::vector<name> grants,checksum256 code_hash) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");require_auth(d.owner);install_module(dao_id,account,version,actions,grants,code_hash);
  }
  ACTION modconfig(name runtime,uint64_t dao_id,uint64_t member_id,name account,uint16_t version,std::vector<name> actions,std::vector<name> grants,checksum256 code_hash) {
    authorized_actor(runtime,dao_id,member_id,true);install_module(dao_id,account,version,actions,grants,code_hash);
  }
  // Platform shares are basis points of a module charge. 10000 keeps the whole charge.
  // Governance of this contract can raise or lower either share later.
  ACTION setfees(uint16_t third_party_bps,uint16_t first_party_bps,name treasury,name token_contract,symbol token_symbol,name names) {
    require_auth(get_self());
    check(third_party_bps<=10000&&first_party_bps<=10000,"FEE_BPS");
    check(is_account(treasury)&&treasury!=get_self()&&is_account(token_contract),"FEE_ACCOUNT");
    check(token_symbol.is_valid(),"FEE_SYMBOL");
    check(!names.value||is_account(names),"FEE_ACCOUNT");
    fee_settings saved(get_self(),get_self().value);
    if(saved.exists()){
      const auto previous=saved.get();
      if(previous.token_contract!=token_contract||previous.token_symbol!=token_symbol){
        check(!creation_settings(get_self(),get_self().value).exists(),"CREATION_ASSET_IMMUTABLE");
        catalogue listed(get_self(),get_self().value);check(listed.begin()==listed.end(),"FEE_SYMBOL");
      }
    }
    saved.set(fee_config{third_party_bps,first_party_bps,treasury,token_contract,token_symbol,names},get_self());
    if(names.value)action(permission_level{get_self(),"active"_n},names,"setrates"_n,std::make_tuple(get_self(),third_party_bps,first_party_bps,treasury,token_contract,token_symbol)).send();
  }
  // party 0 is a Daclify module. party 1 is a module someone else listed.
  // accepts_fee_rule must be 1. A refused rule is not stored.
  ACTION listmod(name account,name publisher,uint8_t party,uint8_t accepts_fee_rule,asset price,checksum256 code_hash,std::string title) {
    const auto cfg=fee_configuration();
    check(accepts_fee_rule==1,"FEE_RULE");
    check(party<=1,"FEE_PARTY");
    check(is_account(account)&&account!=get_self(),"MODULE_ACCOUNT");
    check(is_account(publisher),"FEE_ACCOUNT");
    if(party==0){require_auth(get_self());check(publisher==cfg.treasury,"FEE_ACCOUNT");}
    else{require_auth(publisher);check(publisher!=cfg.treasury,"FEE_PARTY");}
    save_listing(account,publisher,party,accepts_fee_rule,price,code_hash,title);
  }
  ACTION unlistmod(name account) {
    catalogue rows(get_self(),get_self().value);const auto& item=rows.get(account.value,"MODULE_UNLISTED");
    if(has_auth(get_self()))require_auth(get_self());else require_auth(item.publisher);
    remove_listing(account);
  }
  ACTION setmodcopy(name account,std::string summary,std::string detail) {
    catalogue listed(get_self(),get_self().value);const auto& item=listed.get(account.value,"MODULE_UNLISTED");
    if(item.party==0)require_auth(get_self());else require_auth(item.publisher);
    save_copy(account,summary,detail);
  }
  // Contract authority until setgov links a DAO. Admins then use govfees.
  ACTION setpolicy(uint16_t bump_bps,uint16_t quote_premium_bps) {
    require_auth(get_self());
    market_settings saved(get_self(),get_self().value);
    publish_policy(bump_bps,quote_premium_bps,saved.exists()?saved.get().dao_id:0);
  }
  ACTION setgov(uint64_t dao_id) {
    require_auth(get_self());
    if(dao_id)dao_rows.get(dao_id,"DAO_UNKNOWN");
    market_settings saved(get_self(),get_self().value);
    const uint16_t bump=saved.exists()?saved.get().bump_bps:2000;
    const uint16_t premium=saved.exists()?saved.get().quote_premium_bps:2000;
    publish_policy(bump,premium,dao_id);
  }
  ACTION setoracle(uint64_t median,uint8_t quoted_precision,uint32_t observed_at) {
    require_auth(get_self());
    const auto cfg=fee_configuration();
    check(cfg.names.value,"FEE_ACCOUNT");
    action(permission_level{get_self(),"active"_n},cfg.names,"setoracle"_n,std::make_tuple(get_self(),median,quoted_precision,observed_at)).send();
  }
  ACTION govfees(name runtime,uint64_t dao_id,uint64_t member_id,uint16_t third_party_bps,uint16_t first_party_bps,uint16_t bump_bps,uint16_t quote_premium_bps) {
    authorized_actor(runtime,dao_id,member_id,true);
    market_settings saved(get_self(),get_self().value);
    check(saved.exists()&&saved.get().dao_id==dao_id&&dao_id!=0,"DAO_UNKNOWN");
    check(third_party_bps<=10000&&first_party_bps<=10000,"FEE_BPS");
    auto cfg=fee_configuration();
    cfg.third_party_bps=third_party_bps;cfg.first_party_bps=first_party_bps;
    fee_settings(get_self(),get_self().value).set(cfg,get_self());
    if(cfg.names.value)action(permission_level{get_self(),"active"_n},cfg.names,"setrates"_n,std::make_tuple(get_self(),third_party_bps,first_party_bps,cfg.treasury,cfg.token_contract,cfg.token_symbol)).send();
    publish_policy(bump_bps,quote_premium_bps,dao_id);
  }
  ACTION govlist(name runtime,uint64_t dao_id,uint64_t member_id,name account,asset price,checksum256 code_hash,std::string title) {
    platform_actor(runtime,dao_id,member_id);auto cfg=fee_configuration();save_listing(account,cfg.treasury,0,1,price,code_hash,title);
  }
  ACTION govunlist(name runtime,uint64_t dao_id,uint64_t member_id,name account) {
    platform_actor(runtime,dao_id,member_id);remove_listing(account);
  }
  ACTION govmodcopy(name runtime,uint64_t dao_id,uint64_t member_id,name account,std::string summary,std::string detail) {
    platform_actor(runtime,dao_id,member_id);catalogue listed(get_self(),get_self().value);check(listed.get(account.value,"MODULE_UNLISTED").party==0,"FEE_PARTY");save_copy(account,summary,detail);
  }
  ACTION setcredits(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t target,uint64_t quantity) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");members rows(get_self(),dao_id);const auto& m=rows.get(target,"MEMBER_UNKNOWN");
    dao_rows.modify(d,same_payer,[&](auto& r){if(quantity>=m.credits){r.credit_supply=add64(r.credit_supply,quantity-m.credits);if(m.active)r.eligible_credits=add64(r.eligible_credits,quantity-m.credits);}else{r.credit_supply-=m.credits-quantity;if(m.active)r.eligible_credits-=m.credits-quantity;}});rows.modify(m,same_payer,[&](auto& r){r.credits=quantity;});
  }
  ACTION reserve(uint64_t dao_id,name source,uint64_t source_id,uint64_t recipient,asset quantity,uint32_t due) {
    require_source(dao_id,source,"reserve"_n);const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");
    check(source_id>0,"OBLIGATION_ID");check(quantity.symbol==d.token_symbol&&quantity.amount>0,"ASSET_QUANTITY");
    members people(get_self(),dao_id);check(people.get(recipient,"MEMBER_UNKNOWN").active,"MEMBER_INACTIVE");
    check(quantity.amount<=d.available,"INSUFFICIENT_AVAILABLE");
    check(!dao_paused(get_self(),dao_id),"DAO_PAUSED");charge_commitment(dao_id,quantity.amount);
    obligations rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();check(index.find(source_hash(source,source_id))==index.end(),"OBLIGATION_EXISTS");
    auto next=rows.available_primary_key();check(next<std::numeric_limits<uint64_t>::max(),"OBLIGATION_LIMIT");if(next==0)next=1;
    rows.emplace(get_self(),[&](auto& r){r.id=next;r.source=source;r.source_id=source_id;r.recipient=recipient;r.quantity=quantity;r.due=due;r.status=0;});
    dao_rows.modify(d,same_payer,[&](auto& r){r.available=add_amount(r.available,-quantity.amount);r.reserved=add_amount(r.reserved,quantity.amount);});
  }
  ACTION approveob(uint64_t dao_id,name source,uint64_t source_id) {
    check(!dao_paused(get_self(),dao_id),"DAO_PAUSED");
    require_source(dao_id,source,"approve"_n);obligations rows(get_self(),dao_id);auto id=obligation_id(rows,source,source_id);const auto& o=rows.get(id);
    check(o.status==0,"NOT_APPROVABLE");rows.modify(o,same_payer,[](auto& r){r.status=1;});
  }
  ACTION cancelob(uint64_t dao_id,name source,uint64_t source_id) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");if(!has_auth(d.owner))require_source(dao_id,source,"cancel"_n);else require_auth(d.owner);
    obligations rows(get_self(),dao_id);const auto& o=rows.get(obligation_id(rows,source,source_id));check(o.status==0,"NOT_CANCELLABLE");
    dao_rows.modify(d,same_payer,[&](auto& r){r.reserved=add_amount(r.reserved,-o.quantity.amount);r.available=add_amount(r.available,o.quantity.amount);});
    rows.modify(o,same_payer,[](auto& r){r.status=3;});
  }
  ACTION confirmext(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t obligation_id,std::string chain,std::string payer,uint64_t recipient,asset quantity,checksum256 reference) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);
    auto text=[](const std::string& value,size_t max,const char* error){check(value.size()>=1&&value.size()<=max,error);for(unsigned char c:value)check(c>=0x21&&c<=0x7e,error);};
    text(chain,64,"EVIDENCE_CHAIN");text(payer,128,"EVIDENCE_PAYER");check(reference!=checksum256(),"EVIDENCE_REFERENCE");
    obligations debts(get_self(),dao_id);const auto& obligation=debts.get(obligation_id,"OBLIGATION_UNKNOWN");
    check(obligation.status==1,"EVIDENCE_STATE");check(obligation.recipient==recipient,"EVIDENCE_RECIPIENT");check(obligation.quantity==quantity,"EVIDENCE_AMOUNT");
    evidence rows(get_self(),get_self().value);auto index=rows.get_index<"byref"_n>();check(index.find(reference)==index.end(),"EVIDENCE_REUSED");
    auto id=rows.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"EVIDENCE_LIMIT");
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.dao_id=dao_id;r.obligation_id=obligation_id;r.recipient=recipient;r.quantity=quantity;r.chain=chain;r.payer=payer;r.reference=reference;r.mode=1;});
  }
  ACTION payob(uint64_t dao_id,name source,uint64_t source_id) {
    check(!dao_paused(get_self(),dao_id),"DAO_PAUSED");
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");obligations rows(get_self(),dao_id);const auto& o=rows.get(obligation_id(rows,source,source_id));
    check(o.status==1&&o.due<=current_time_point().sec_since_epoch(),"NOT_PAYABLE");
    members people(get_self(),dao_id);const auto& m=people.get(o.recipient,"MEMBER_UNKNOWN");
    auto quantity=o.quantity;auto destination=m.native_account;
    rows.modify(o,same_payer,[](auto& r){r.status=2;});
    dao_rows.modify(d,same_payer,[&](auto& r){r.reserved=add_amount(r.reserved,-quantity.amount);if(!destination.value)r.claims=add_amount(r.claims,quantity.amount);});
    if(destination.value)action(permission_level{get_self(),"active"_n},d.token_contract,"transfer"_n,std::make_tuple(get_self(),destination,quantity,std::string("Daclify approved obligation"))).send();
    else people.modify(m,same_payer,[&](auto& r){r.claim=add_amount(r.claim,quantity.amount);});
    receipt(dao_id,destination.value?1:0,o.id,o.recipient,destination,d.token_contract,quantity);
  }
  ACTION putdoc(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t document_id,uint32_t version,std::string cid,std::string metadata,checksum256 commitment,uint32_t bytes,uint16_t envelope_version,uint64_t key_epoch) {
    authorized_actor(runtime,dao_id,member_id);const auto& d=dao_rows.get(dao_id);check(document_id>0&&version>0,"DOCUMENT_ID");validate_cid(cid);validate_metadata(metadata);check(bytes<=100000000,"CONTENT_SIZE");
    check(envelope_version<=1,"ENVELOPE_VERSION");
    if(d.privacy){check(envelope_version==1,"PRIVACY_ENVELOPE");check(metadata=="{}","PRIVATE_METADATA");check(key_epoch==d.key_epoch,"KEY_EPOCH");require_epoch(dao_id,key_epoch);}else check(envelope_version==0&&key_epoch==0,"PUBLIC_ENVELOPE");
    append_document(dao_id,member_id,document_id,version,cid,metadata,commitment,bytes,envelope_version,key_epoch);
  }
  ACTION putjson(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t document_id,uint32_t version,std::string value,uint16_t envelope_version,uint64_t key_epoch) {
    authorized_actor(runtime,dao_id,member_id);const auto& d=dao_rows.get(dao_id);check(document_id>0&&version>0,"DOCUMENT_ID");validate_metadata(value);
    if(d.privacy){check(envelope_version==1&&key_epoch==d.key_epoch,"PRIVACY_ENVELOPE");require_epoch(dao_id,key_epoch);validate_envelope(value);}else check(envelope_version==0&&key_epoch==0,"PUBLIC_ENVELOPE");
    append_document(dao_id,member_id,document_id,version,"",value,sha256(value.data(),value.size()),value.size(),envelope_version,key_epoch);
  }
  ACTION commitepoch(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t epoch,checksum256 commitment,std::string self_grant) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.privacy>0,"DAO_PUBLIC");check(epoch==d.key_epoch,"KEY_EPOCH");check(commitment!=checksum256{},"EPOCH_COMMITMENT");epochs rows(get_self(),dao_id);check(rows.find(epoch)==rows.end(),"EPOCH_COMMITTED");rows.emplace(get_self(),[&](auto& r){r.epoch=epoch;r.commitment=commitment;r.creator=member_id;});
    // Commit and the founder's encrypted grant are atomic, so a lost client cannot strand a key between transactions.
    grantkey(runtime,dao_id,member_id,member_id,epoch,self_grant);
  }
  ACTION rotateepoch(name runtime,uint64_t dao_id,uint64_t member_id) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.privacy>0,"DAO_PUBLIC");dao_rows.modify(d,same_payer,[](auto& r){r.key_epoch=add64(r.key_epoch,1);});
  }
  ACTION rotatekey(name runtime,uint64_t dao_id,uint64_t member_id,public_key signing_key) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    members rows(get_self(),dao_id);const auto& m=rows.get(member_id,"MEMBER_UNKNOWN");
    auto packed=pack(signing_key);auto digest=sha256(packed.data(),packed.size());check(digest!=m.by_key(),"SIGNING_KEY");
    auto index=rows.get_index<"bykey"_n>();check(index.find(digest)==index.end(),"CREDENTIAL_EXISTS");
    check_unique_key(dao_id,signing_key);bump_credentials(dao_id,member_id);
    rows.modify(m,same_payer,[&](auto& r){r.signing_key=signing_key;});
  }
  ACTION linknative(name runtime,uint64_t dao_id,uint64_t member_id,name account) {
    check(get_sender()==get_self(),"ACTOR_SENDER");
    authorized_actor(runtime,dao_id,member_id);require_auth(account);check(is_account(account),"NATIVE_ACCOUNT");members rows(get_self(),dao_id);
    auto index=rows.get_index<"bynative"_n>();auto linked=index.find(account.value);check(linked==index.end()||linked->id==member_id,"CREDENTIAL_EXISTS");
    const auto& m=rows.get(member_id);check(m.native_account!=account,"ALREADY_IN_STATE");bump_credentials(dao_id,member_id);rows.modify(m,same_payer,[&](auto& r){r.native_account=account;});
  }
  ACTION unlinknat(name runtime,uint64_t dao_id,uint64_t member_id) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    members rows(get_self(),dao_id);const auto& m=rows.get(member_id);check(m.native_account.value,"NATIVE_UNLINKED");bump_credentials(dao_id,member_id);rows.modify(m,same_payer,[](auto& r){r.native_account=name{};});
  }
  ACTION linkevm(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t evm_chain_id,checksum160 address,uint64_t epoch,uint64_t nonce,uint32_t expires,std::vector<char> proof) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);check((evm_chain_id==40||evm_chain_id==41)&&address!=checksum160{},"EVM_CHAIN_ADDRESS");
    members people(get_self(),dao_id);const auto& member=people.get(member_id);check(member.nonce>0&&nonce==member.nonce-1,"NONCE");
    const auto now=current_time_point().sec_since_epoch();check(expires>now&&uint64_t(expires)<=uint64_t(now)+900,"EXPIRED_OR_TOO_LONG");
    evm_bindings bindings(get_self(),dao_id);const auto previous=bindings.find(member_id);check(epoch==(previous==bindings.end()?1:add64(previous->epoch,1)),"EVM_BINDING_EPOCH");
    const auto lookup=pack(std::make_tuple(evm_chain_id,address));const auto wallet=bindings.get_index<"bywallet"_n>();const auto owner=wallet.find(sha256(lookup.data(),lookup.size()));check(owner==wallet.end()||owner->member_id==member_id,"CREDENTIAL_EXISTS");
    const auto chain=configuration().chain_id;
    const auto body=evm_hash_words({evm_text("DaclifyBinding(bytes32 nativeChain,uint64 runtime,uint64 daoId,uint64 memberId,uint64 evmChainId,address wallet,uint64 epoch,uint64 nonce,uint32 expires,uint16 signatureVersion)"),chain.extract_as_byte_array(),evm_uint(get_self().value),evm_uint(dao_id),evm_uint(member_id),evm_uint(evm_chain_id),evm_address_word(address),evm_uint(epoch),evm_uint(nonce),evm_uint(expires),evm_uint(1)});
    check(recover_evm_address(evm_typed_digest(chain,get_self(),evm_chain_id,body),proof)==address,"EVM_ADDRESS");
    bump_credentials(dao_id,member_id);
    if(previous==bindings.end())bindings.emplace(get_self(),[&](auto& r){r.member_id=member_id;r.chain_id=evm_chain_id;r.address=address;r.epoch=epoch;});else bindings.modify(previous,same_payer,[&](auto& r){r.chain_id=evm_chain_id;r.address=address;r.epoch=epoch;r.active=true;});
  }
  ACTION unlinkevm(name runtime,uint64_t dao_id,uint64_t member_id) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);evm_bindings bindings(get_self(),dao_id);const auto& binding=bindings.get(member_id,"EVM_UNLINKED");check(binding.active,"EVM_UNLINKED");bump_credentials(dao_id,member_id);bindings.modify(binding,same_payer,[](auto& r){r.active=false;r.epoch=add64(r.epoch,1);});
  }
  ACTION setactive(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t target,bool active) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);members rows(get_self(),dao_id);const auto& m=rows.get(target,"MEMBER_UNKNOWN");check(m.active!=active,"ALREADY_IN_STATE");
    if(active)check(d.active_ballots==0,"GOVERNANCE_LOCKED");if(!active&&m.admin)check(d.admin_count>1,"LAST_ADMIN");
    dao_rows.modify(d,same_payer,[&](auto& r){if(active){r.member_count++;if(m.admin)r.admin_count++;r.eligible_credits=add64(r.eligible_credits,m.credits);r.eligible_stake=add_amount(r.eligible_stake,m.stake);}else{r.member_count--;if(m.admin)r.admin_count--;r.eligible_credits-=m.credits;r.eligible_stake=add_amount(r.eligible_stake,-m.stake);if(r.privacy)r.key_epoch=add64(r.key_epoch,1);}});
    rows.modify(m,same_payer,[&](auto& r){r.active=active;});
  }
  ACTION setroles(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t target,bool admin,bool reviewer) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);members rows(get_self(),dao_id);const auto& m=rows.get(target,"MEMBER_UNKNOWN");check(m.active,"MEMBER_INACTIVE");
    if(m.admin&&!admin)check(d.admin_count>1,"LAST_ADMIN");
    if(m.admin!=admin)dao_rows.modify(d,same_payer,[&](auto& r){if(admin)r.admin_count++;else r.admin_count--;});
    rows.modify(m,same_payer,[&](auto& r){r.admin=admin;r.reviewer=reviewer;});
  }
  ACTION grantkey(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t recipient,uint64_t epoch,std::string envelope) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.privacy>0,"DAO_PUBLIC");
    members people(get_self(),dao_id);const auto& m=people.get(recipient,"MEMBER_UNKNOWN");check(m.active,"MEMBER_INACTIVE");check(!(d.privacy==2&&m.custody==1),"CUSTODY_POLICY");
    check(epoch>0&&epoch<=d.key_epoch&&(d.history_policy==0||epoch>=m.join_epoch),"KEY_EPOCH");require_epoch(dao_id,epoch);check(envelope.size()>0&&envelope.size()<=8192,"KEY_GRANT_SIZE");check(nlohmann::json::accept(envelope),"KEY_GRANT_JSON");
    key_grants rows(get_self(),dao_id);auto index=rows.get_index<"bymember"_n>();check(index.find((uint128_t(recipient)<<64)|epoch)==index.end(),"KEY_GRANT_EXISTS");auto id=rows.available_primary_key();if(!id)id=1;
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.epoch=epoch;r.recipient=recipient;r.grantor=member_id;r.envelope=envelope;});
  }
  ACTION govlock(uint64_t dao_id,name source,uint64_t source_id,uint32_t expires) {
    require_source(dao_id,source,"govlock"_n);const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");auto now=current_time_point().sec_since_epoch();check(expires>now&&uint64_t(expires)<=uint64_t(now)+2678400,"LOCK_EXPIRY");check(source_id>0&&d.active_ballots<64,"LOCK_LIMIT");
    governance_locks rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();check(index.find(source_hash(source,source_id))==index.end(),"LOCK_EXISTS");auto id=rows.available_primary_key();if(!id)id=1;
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.source=source;r.source_id=source_id;r.expires=expires;r.active=true;});dao_rows.modify(d,same_payer,[](auto& r){r.active_ballots++;});
  }
  ACTION govunlock(uint64_t dao_id,name source,uint64_t source_id) {
    governance_locks rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();const auto& lock=index.get(source_hash(source,source_id),"LOCK_UNKNOWN");check(lock.source==source&&lock.source_id==source_id,"LOCK_DOMAIN");check(lock.active,"LOCK_INACTIVE");
    if(lock.expires>current_time_point().sec_since_epoch())require_source(dao_id,source,"govlock"_n);
    rows.modify(rows.get(lock.id),same_payer,[](auto& r){r.active=false;});const auto& d=dao_rows.get(dao_id);check(d.active_ballots>0,"LOCK_COUNTER");dao_rows.modify(d,same_payer,[](auto& r){r.active_ballots--;});
  }
  ACTION withdraw(name runtime,uint64_t dao_id,uint64_t member_id,name destination,asset quantity) {
    authorized_actor(runtime,dao_id,member_id,false,true);const auto& d=dao_rows.get(dao_id);check(quantity.symbol==d.token_symbol&&quantity.amount>0,"ASSET_QUANTITY");check(destination!=get_self()&&is_account(destination),"PAYOUT_DESTINATION");members people(get_self(),dao_id);const auto& m=people.get(member_id);check(quantity.amount<=m.claim,"INSUFFICIENT_CLAIM");
    people.modify(m,same_payer,[&](auto& r){r.claim=add_amount(r.claim,-quantity.amount);});dao_rows.modify(d,same_payer,[&](auto& r){r.claims=add_amount(r.claims,-quantity.amount);});
    action(permission_level{get_self(),"active"_n},d.token_contract,"transfer"_n,std::make_tuple(get_self(),destination,quantity,std::string("Daclify claim withdrawal"))).send();
    receipt(dao_id,2,0,member_id,destination,d.token_contract,quantity);
  }
  ACTION unstake(name runtime,uint64_t dao_id,uint64_t member_id,name destination,asset quantity) {
    authorized_actor(runtime,dao_id,member_id,false,true);const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");check(quantity.symbol==d.token_symbol&&quantity.amount>0,"ASSET_QUANTITY");check(destination!=get_self()&&is_account(destination),"PAYOUT_DESTINATION");members people(get_self(),dao_id);const auto& m=people.get(member_id);check(quantity.amount<=m.stake,"INSUFFICIENT_STAKE");
    dao_rows.modify(d,same_payer,[&](auto& r){r.staked=add_amount(r.staked,-quantity.amount);if(m.active)r.eligible_stake=add_amount(r.eligible_stake,-quantity.amount);});people.modify(m,same_payer,[&](auto& r){r.stake=add_amount(r.stake,-quantity.amount);});
    action(permission_level{get_self(),"active"_n},d.token_contract,"transfer"_n,std::make_tuple(get_self(),destination,quantity,std::string("Daclify governance unstake"))).send();
  }
  [[eosio::on_notify("*::transfer")]] void deposit(name from,name to,asset quantity,std::string memo) {
    if(to!=get_self()||from==get_self())return;
    check(quantity.is_valid()&&quantity.amount>0,"ASSET_QUANTITY");
    if(memo.rfind("create:",0)==0){creation_payment(quantity,memo);return;}
    if(memo.rfind("mod:",0)==0){settle_module(from,quantity,memo);return;}
    check(memo.size()<=64,"DEPOSIT_REFERENCE");
    std::vector<std::string> parts;size_t start=0;
    for(size_t i=0;i<=memo.size();i++)if(i==memo.size()||memo[i]==':'){parts.push_back(memo.substr(start,i-start));start=i+1;}
    check(parts.size()==2||parts.size()==3,"DEPOSIT_REFERENCE");bool stake=parts[0]=="stake";check((stake&&parts.size()==3)||(!stake&&parts[0]=="dao"&&parts.size()==2),"DEPOSIT_REFERENCE");
    auto dao_id=parse_id(parts[1]);const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");
    check(get_first_receiver()==d.token_contract&&quantity.symbol==d.token_symbol,"TOKEN_IDENTITY");
    if(stake){check(d.active_ballots==0,"GOVERNANCE_LOCKED");members people(get_self(),dao_id);const auto& m=people.get(parse_id(parts[2]),"MEMBER_UNKNOWN");check(m.active&&m.native_account==from,"STAKE_OWNER");people.modify(m,same_payer,[&](auto& r){r.stake=add_amount(r.stake,quantity.amount);});}
    dao_rows.modify(d,same_payer,[&](auto& r){if(stake){r.staked=add_amount(r.staked,quantity.amount);r.eligible_stake=add_amount(r.eligible_stake,quantity.amount);}else r.available=add_amount(r.available,quantity.amount);});
  }
private:
  daos dao_rows{get_self(),get_self().value};
  void platform_actor(name runtime,uint64_t dao_id,uint64_t member_id) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);market_settings saved(get_self(),get_self().value);check(saved.exists()&&saved.get().dao_id==dao_id&&dao_id!=0,"PLATFORM_DAO");
  }
  void save_creation(uint32_t shared_usd,uint32_t independent_usd,uint16_t premium_bps,name settler) {
    check(shared_usd>0&&shared_usd<=100000000&&independent_usd>0&&independent_usd<=100000000&&premium_bps<=10000,"CREATION_PRICE");check(is_account(settler),"CREATION_SETTLER");
    creation_settings saved(get_self(),get_self().value);auto cfg=saved.exists()?saved.get():creation_policy{};cfg.shared_usd=shared_usd;cfg.independent_usd=independent_usd;cfg.premium_bps=premium_bps;cfg.settler=settler;saved.set(cfg,get_self());
  }
  void save_listing(name account,name publisher,uint8_t party,uint8_t accepts_fee_rule,asset price,checksum256 code_hash,const std::string& title) {
    const auto cfg=fee_configuration();check(accepts_fee_rule==1&&party<=1,"FEE_RULE");check(is_account(account)&&account!=get_self()&&is_account(publisher),"MODULE_ACCOUNT");
    check(price.is_valid()&&price.amount>=0&&price.symbol==cfg.token_symbol,"MODULE_PRICE");
    check(code_hash!=checksum256()&&get_code_hash(account)==code_hash,"MODULE_CODE");
    check(title.size()>=1&&title.size()<=64,"MODULE_TITLE");
    for(unsigned char c:title)check(c>=0x20&&c<=0x7e,"MODULE_TITLE");
    catalogue rows(get_self(),get_self().value);auto it=rows.find(account.value);
    if(it!=rows.end()){check(it->party==party,"FEE_PARTY");if(party==1)check(it->publisher==publisher,"FEE_ACCOUNT");}
    auto write=[&](auto& r){r.account=account;r.publisher=publisher;r.party=party;r.complies=1;r.price=price;r.code_hash=code_hash;r.title=title;};
    if(it==rows.end())rows.emplace(get_self(),write);else rows.modify(it,same_payer,write);
  }
  void remove_listing(name account) {
    catalogue rows(get_self(),get_self().value);const auto& item=rows.get(account.value,"MODULE_UNLISTED");
    rows.erase(item);
    modcopy copy(get_self(),get_self().value);auto text=copy.find(account.value);if(text!=copy.end())copy.erase(text);
  }
  void save_copy(name account,const std::string& summary,const std::string& detail) {
    check(summary.size()>=1&&summary.size()<=160,"MODULE_SUMMARY");
    for(unsigned char c:summary)check(c>=0x20&&c<=0x7e,"MODULE_SUMMARY");
    check(detail.size()<=2000,"MODULE_DETAIL");
    for(unsigned char c:detail)check(c=='\n'||(c>=0x20&&c<=0x7e),"MODULE_DETAIL");
    modcopy copy(get_self(),get_self().value);auto it=copy.find(account.value);
    auto write=[&](auto& r){r.account=account;r.summary=summary;r.detail=detail;};
    if(it==copy.end())copy.emplace(get_self(),write);else copy.modify(it,same_payer,write);
  }
  void creation_payment(asset quantity,const std::string& memo) {
    check(memo.size()==71,"CREATION_REFERENCE");std::array<uint8_t,32> bytes{};
    auto nibble=[](char c)->uint8_t{check((c>='0'&&c<='9')||(c>='a'&&c<='f'),"CREATION_REFERENCE");return c<='9'?c-'0':c-'a'+10;};
    for(size_t i=0;i<32;i++)bytes[i]=(nibble(memo[7+i*2])<<4)|nibble(memo[8+i*2]);
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();const auto& order=index.get(checksum256(bytes),"CREATION_UNKNOWN");
    const auto cfg=fee_configuration();check(get_first_receiver()==cfg.token_contract&&quantity.symbol==cfg.token_symbol,"TOKEN_IDENTITY");check(order.method==0&&quantity==order.tlos_due,"CREATION_AMOUNT");check(!order.paid,"CREATION_PAID");check(order.expires>=current_time_point().sec_since_epoch(),"CREATION_EXPIRED");
    index.modify(order,same_payer,[](auto& r){r.paid=true;});pay_share(cfg.token_contract,cfg.treasury,quantity,"Daclify DAO creation");
  }

  void validate_policy(const gov_settings& settings){
    check(settings.participant_mode<=2&&settings.kind<=2,"POLICY_KIND");check(is_account(settings.decide)&&settings.decide!=get_self(),"POLICY_DECIDE");
    check(settings.duration>=60&&settings.duration<=2592000,"POLICY_DURATION");check(settings.quorum>0&&settings.quorum<=10000&&settings.approval>=5001&&settings.approval<=10000,"POLICY_THRESHOLD");
    check(settings.max_commitment>=0&&settings.max_commitment<=asset::max_amount&&settings.daily_commitment>=0&&settings.daily_commitment<=asset::max_amount,"POLICY_BUDGET");
    check(!settings.daily_commitment||(settings.max_commitment>0&&settings.daily_commitment>=settings.max_commitment),"POLICY_BUDGET");
    check(!settings.guardian.value||is_account(settings.guardian),"POLICY_GUARDIAN");
    if(settings.participant_mode==2)check(settings.guardian.value&&settings.max_commitment>0&&settings.daily_commitment>0&&settings.governed_works,"AGENT_POLICY");
  }
  void require_guardian(uint64_t dao_id){
    gov_policies rows(get_self(),get_self().value);const auto& policy=rows.get(dao_id,"POLICY_UNKNOWN");check(policy.config.guardian.value,"GUARDIAN_UNCONFIGURED");require_auth(policy.config.guardian);
  }
  void check_unique_key(uint64_t dao_id,const public_key& key){
    auto bytes=pack(key);auto hash=sha256(bytes.data(),bytes.size());
    members people(get_self(),dao_id);auto roots=people.get_index<"bykey"_n>();check(roots.find(hash)==roots.end(),"CREDENTIAL_EXISTS");
    scoped_sessions sessions(get_self(),dao_id);auto delegated=sessions.get_index<"bykey"_n>();check(delegated.find(hash)==delegated.end(),"CREDENTIAL_EXISTS");
  }
  void bump_credentials(uint64_t dao_id,uint64_t member_id){
    participants rows(get_self(),dao_id);auto found=rows.find(member_id);
    if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r.id=member_id;r.credential_epoch=2;});
    else rows.modify(found,same_payer,[&](auto& r){r.credential_epoch=add64(r.credential_epoch,1);});
  }
  void charge_commitment(uint64_t dao_id,int64_t quantity){
    gov_policies rows(get_self(),get_self().value);auto policy=rows.find(dao_id);if(policy==rows.end())return;
    const auto& config=policy->config;check(!config.max_commitment||quantity<=config.max_commitment,"COMMITMENT_LIMIT");
    if(!config.daily_commitment)return;
    const uint32_t day=current_time_point().sec_since_epoch()/86400;
    commitment_budgets budgets(get_self(),get_self().value);auto saved=budgets.find(dao_id);
    int64_t before=saved!=budgets.end()&&saved->day==day?saved->committed:0;const auto committed=add_amount(before,quantity);check(committed<=config.daily_commitment,"DAILY_LIMIT");
    if(saved==budgets.end())budgets.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.day=day;r.committed=committed;});
    else budgets.modify(saved,same_payer,[&](auto& r){r.day=day;r.committed=committed;});
  }
  settings configuration() { config c(get_self(),get_self().value); check(c.exists(),"NOT_INITIALIZED"); return c.get(); }
  fee_config fee_configuration() { fee_settings saved(get_self(),get_self().value); check(saved.exists(),"FEE_UNSET"); return saved.get(); }
  void publish_policy(uint16_t bump_bps,uint16_t quote_premium_bps,uint64_t dao_id) {
    check(bump_bps<=10000&&quote_premium_bps<=10000,"FEE_BPS");
    market_settings(get_self(),get_self().value).set(market_policy{bump_bps,quote_premium_bps,dao_id},get_self());
    const auto cfg=fee_configuration();
    if(cfg.names.value)action(permission_level{get_self(),"active"_n},cfg.names,"setpolicy"_n,std::make_tuple(get_self(),bump_bps,quote_premium_bps)).send();
  }
  void pay_share(name token,name to,asset quantity,const std::string& memo) {
    if(quantity.amount==0)return;
    check(to!=get_self()&&is_account(to),"FEE_ACCOUNT");
    action(permission_level{get_self(),"active"_n},token,"transfer"_n,std::make_tuple(get_self(),to,quantity,memo)).send();
  }
  void settle_module(name from,asset quantity,const std::string& memo) {
    check(memo.size()>4&&memo.size()<=16,"MODULE_PAYMENT");
    const name modaccount(memo.substr(4));
    check(memo==std::string("mod:")+modaccount.to_string(),"MODULE_PAYMENT");
    const auto cfg=fee_configuration();
    check(get_first_receiver()==cfg.token_contract&&quantity.symbol==cfg.token_symbol,"TOKEN_IDENTITY");
    catalogue listed(get_self(),get_self().value);const auto& item=listed.get(modaccount.value,"MODULE_UNLISTED");
    check(item.complies==1,"FEE_RULE");
    check(item.price.amount>0&&quantity==item.price,"MODULE_PRICE");
    const uint16_t bps=item.party==0?cfg.first_party_bps:cfg.third_party_bps;
    const __int128 fee=(__int128)quantity.amount*bps/10000;
    check(fee>=0&&fee<=quantity.amount,"FEE_SPLIT");
    const asset platform((int64_t)fee,quantity.symbol);
    const asset publisher_share(quantity.amount-(int64_t)fee,quantity.symbol);
    modpays payments(get_self(),get_self().value);
    auto id=payments.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"PAYMENT_LIMIT");
    payments.emplace(get_self(),[&](auto& r){r.id=id;r.modaccount=modaccount;r.payer=from;r.publisher=item.publisher;r.gross=quantity;r.platform_fee=platform;r.publisher_share=publisher_share;r.party=item.party;r.bps=bps;});
    pay_share(cfg.token_contract,cfg.treasury,platform,"Daclify platform fee");
    pay_share(cfg.token_contract,item.publisher,publisher_share,"Daclify module payment");
  }
  void require_epoch(uint64_t dao_id,uint64_t epoch){epochs rows(get_self(),dao_id);check(rows.find(epoch)!=rows.end(),"EPOCH_UNCOMMITTED");}
  void append_document(uint64_t dao_id,uint64_t member_id,uint64_t document_id,uint32_t version,const std::string& cid,const std::string& metadata,checksum256 commitment,uint32_t bytes,uint16_t envelope_version,uint64_t key_epoch) {
    documents rows(get_self(),dao_id);auto index=rows.get_index<"byversion"_n>();auto upper=index.upper_bound((uint128_t(document_id)<<32)|std::numeric_limits<uint32_t>::max());
    bool found=false;if(upper!=index.begin()){--upper;found=upper->document_id==document_id;}
    if(found){check(upper->version<std::numeric_limits<uint32_t>::max()&&version==upper->version+1,"DOCUMENT_VERSION");members people(get_self(),dao_id);check(upper->author==member_id||people.get(member_id).admin,"DOCUMENT_AUTHOR");}
    else check(version==1,"DOCUMENT_VERSION");
    auto id=rows.available_primary_key();if(id==0)id=1;
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.document_id=document_id;r.version=version;r.author=member_id;r.cid=cid;r.metadata=metadata;r.commitment=commitment;r.bytes=bytes;r.envelope_version=envelope_version;r.key_epoch=key_epoch;});
  }
  void validate_envelope(const std::string& value) {
    const auto envelope=nlohmann::json::parse(value);
    check(envelope.is_object()&&envelope.size()==4&&envelope.contains("version")&&envelope["version"].is_number_integer()&&envelope["version"]==1&&envelope.contains("algorithm")&&envelope["algorithm"]=="AES-256-GCM"&&envelope.contains("iv")&&envelope["iv"].is_string()&&envelope.contains("ciphertext")&&envelope["ciphertext"].is_string(),"PRIVACY_ENVELOPE");
    const auto iv=envelope["iv"].get<std::string>();const auto ciphertext=envelope["ciphertext"].get<std::string>();const std::string alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    check(iv.size()==16&&ciphertext.size()>=24&&ciphertext.size()%4==0,"PRIVACY_ENVELOPE");for(auto c:iv)check(alphabet.find(c)!=std::string::npos,"PRIVACY_ENVELOPE");
    size_t padding=0;for(size_t i=0;i<ciphertext.size();i++){if(ciphertext[i]=='='){padding++;check(i>=ciphertext.size()-2&&padding<=2,"PRIVACY_ENVELOPE");}else check(!padding&&alphabet.find(ciphertext[i])!=std::string::npos,"PRIVACY_ENVELOPE");}
  }
  void validate_metadata(const std::string& metadata) { check(metadata.size()>0&&metadata.size()<=4096,"METADATA_SIZE"); check(nlohmann::json::accept(metadata),"METADATA_JSON"); }
  void receipt(uint64_t dao_id,uint8_t kind,uint64_t obligation,uint64_t recipient,name destination,name token_contract,asset quantity){
    finance_receipts rows(get_self(),dao_id);auto id=rows.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"RECEIPT_LIMIT");
    std::vector<char> bytes(transaction_size());check(read_transaction(bytes.data(),bytes.size())==bytes.size(),"TRANSACTION_BYTES");const auto tx=sha256(bytes.data(),bytes.size());
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.kind=kind;r.obligation_id=obligation;r.recipient=recipient;r.destination=destination;r.token_contract=token_contract;r.quantity=quantity;r.at=current_time_point().sec_since_epoch();r.transaction_id=tx;});
  }
  void validate_dao_metadata(const std::string& metadata){
    validate_metadata(metadata);const auto value=nlohmann::json::parse(metadata);
    if(!value.is_object()||!value.contains("schemaVersion")||value["schemaVersion"]!=3)return;
    check(value.size()==6&&value.contains("title")&&value["title"].is_string()&&value.contains("description")&&value["description"].is_string()&&value.contains("purpose")&&value["purpose"].is_string()&&value.contains("setup")&&value.contains("branding")&&value["branding"].is_object(),"METADATA_FIELDS");
    const auto title=value["title"].get<std::string>();check(!title.empty()&&title.size()<=640,"METADATA_FIELDS");
    for(auto it=value["branding"].begin();it!=value["branding"].end();++it){
      if(it.key()=="summary"){check(it.value().is_string()&&it.value().get<std::string>().size()<=1120,"BRANDING_IMAGE");continue;}
      check(it.key()=="logo"||it.key()=="cover","BRANDING_IMAGE");const auto& image=it.value();
      check(image.is_object()&&image.size()==4&&image.contains("cid")&&image["cid"].is_string()&&image.contains("bytes")&&image["bytes"].is_number_unsigned()&&image["bytes"].get<uint64_t>()>0&&image["bytes"].get<uint64_t>()<=2097152&&image.contains("mediaType")&&image["mediaType"].is_string()&&image.contains("commitment")&&image["commitment"].is_string(),"BRANDING_IMAGE");
      validate_cid(image["cid"].get<std::string>());const auto mime=image["mediaType"].get<std::string>();check(mime=="image/png"||mime=="image/jpeg"||mime=="image/webp","BRANDING_IMAGE");
      const auto hash=image["commitment"].get<std::string>();check(hash.size()==64,"BRANDING_IMAGE");for(auto c:hash)check((c>='0'&&c<='9')||(c>='a'&&c<='f'),"BRANDING_IMAGE");
    }
  }
  void validate_profile(const std::string& profile,name account_name) {
    const std::string written=account_name.to_string();
    check(account_name.value&&written.size()<=12&&written.front()!='.'&&written.back()!='.'&&written.find("..")==std::string::npos,"PROFILE_NAME");
    check(profile.size()>0&&profile.size()<=4096,"METADATA_SIZE");check(nlohmann::json::accept(profile),"METADATA_JSON");
    const auto value=nlohmann::json::parse(profile);check(value.is_object(),"METADATA_JSON");
    const std::vector<std::string> keys={"name","fullName","location","email","telegram","introduction","motto","facebook","instagram","youtube","linkedin","website","avatar","background"};
    for(auto it=value.begin();it!=value.end();++it){bool known=false;for(const auto& key:keys)if(it.key()==key)known=true;check(known&&it.value().is_string(),"PROFILE_FIELD");}
    check(value.contains("name")&&value["name"].get<std::string>()==written,"PROFILE_NAME");
    auto limited=[&](const char* key,size_t max){if(value.contains(key))check(value[key].get<std::string>().size()<=max,"PROFILE_FIELD");};
    limited("fullName",80);limited("location",80);limited("email",254);limited("telegram",32);limited("introduction",2000);limited("motto",140);
    limited("facebook",300);limited("instagram",300);limited("youtube",300);limited("linkedin",300);limited("website",300);limited("avatar",300);limited("background",300);
    if(value.contains("email")){const auto email=value["email"].get<std::string>();check(email.empty()||(email.find(' ')==std::string::npos&&email.find('@')!=std::string::npos),"PROFILE_FIELD");}
    if(value.contains("telegram")){const auto handle=value["telegram"].get<std::string>();if(!handle.empty()){check(handle.size()>=5,"PROFILE_FIELD");for(auto c:handle)check((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_',"PROFILE_FIELD");}}
    auto link=[&](const char* key){if(!value.contains(key))return;const auto ref=value[key].get<std::string>();if(ref.empty())return;check(ref.rfind("https://",0)==0&&ref.find(' ')==std::string::npos,"PROFILE_FIELD");};
    auto image=[&](const char* key){if(!value.contains(key))return;const auto ref=value[key].get<std::string>();if(!ref.empty())validate_cid(ref);};
    link("facebook");link("instagram");link("youtube");link("linkedin");link("website");image("avatar");image("background");
  }
  void validate_cid(const std::string& cid) {
    check(cid.size()==59&&cid[0]=='b',"CID_FORMAT");std::vector<uint8_t> raw;uint32_t bits=0;uint8_t count=0;
    const std::string alphabet="abcdefghijklmnopqrstuvwxyz234567";
    for(size_t i=1;i<cid.size();i++){auto position=alphabet.find(cid[i]);check(position!=std::string::npos,"CID_FORMAT");bits=(bits<<5)|position;count+=5;if(count>=8){count-=8;raw.push_back((bits>>count)&255);bits&=(1u<<count)-1;}}
    check(bits==0&&raw.size()==36&&raw[0]==1&&(raw[1]==0x55||raw[1]==0x70||raw[1]==0x71)&&raw[2]==0x12&&raw[3]==32,"CID_FORMAT");
  }
  void authorized_actor(name runtime,uint64_t dao_id,uint64_t member_id,bool admin=false,bool exit=false) {
    gov_policies policies(get_self(),get_self().value);if(policies.find(dao_id)!=policies.end())check(get_sender()==get_self(),"ACTOR_SENDER");
    check_agent_authority(get_self(),dao_id,member_id,exit);
    check(runtime==get_self(),"RUNTIME_DOMAIN");if(get_sender().value){check(get_sender()==get_self(),"ACTOR_SENDER");require_auth(permission_level{get_self(),"execctx"_n});}else require_auth(get_self());members rows(get_self(),dao_id);
    const auto& m=rows.get(member_id,"MEMBER_UNKNOWN");check(m.active||exit,"MEMBER_INACTIVE");check(!admin||m.admin,"ADMIN_REQUIRED");
  }
  uint64_t parse_id(const std::string& value) {check(!value.empty()&&value.size()<=20&&value[0]!='0',"DEPOSIT_REFERENCE");uint64_t out=0;for(auto c:value){check(c>='0'&&c<='9',"DEPOSIT_REFERENCE");check(out<=(std::numeric_limits<uint64_t>::max()-(c-'0'))/10,"DEPOSIT_REFERENCE");out=out*10+(c-'0');}return out;}
  checksum256 source_hash(name source,uint64_t id){auto packed=pack(std::make_tuple(source,id));return sha256(packed.data(),packed.size());}
  uint64_t obligation_id(obligations& rows,name source,uint64_t id){auto index=rows.get_index<"bysource"_n>();const auto& o=index.get(source_hash(source,id),"OBLIGATION_UNKNOWN");check(o.source==source&&o.source_id==id,"OBLIGATION_DOMAIN");return o.id;}
  void install_module(uint64_t dao_id,name account,uint16_t version,const std::vector<name>& actions,const std::vector<name>& grants,checksum256 code_hash) {
    check(is_account(account)&&account!=get_self(),"MODULE_ACCOUNT");check(version==1&&actions.size()<=16&&grants.size()<=16,"MODULE_VERSION_OR_LIMIT");
    for(auto grant:grants)check(grant=="reserve"_n||grant=="approve"_n||grant=="cancel"_n||grant=="govlock"_n||grant=="awardwork"_n||grant=="admit"_n,"MODULE_GRANT_UNKNOWN");
    auto unique=[](const auto& list){for(size_t i=0;i<list.size();i++){check(list[i].value>0,"MODULE_ACTION");for(size_t j=i+1;j<list.size();j++)check(list[i]!=list[j],"DUPLICATE_GRANT");}};unique(actions);unique(grants);
    // Clearing both lists removes a module after its code has changed. Any remaining
    // action or grant must pin the hash of the code loaded at that account.
    checksum256 pinned{};
    if(!actions.empty()||!grants.empty()){
      check(code_hash!=checksum256(),"MODULE_CODE");check(get_code_hash(account)==code_hash,"MODULE_CODE");pinned=code_hash;
      catalogue listed(get_self(),get_self().value);const auto& item=listed.get(account.value,"MODULE_UNLISTED");
      check(item.complies==1,"FEE_RULE");check(item.code_hash==code_hash,"MODULE_CODE");
    }
    modules rows(get_self(),dao_id);auto it=rows.find(account.value);
    if(it==rows.end())rows.emplace(get_self(),[&](auto& r){r.account=account;r.version=version;r.actions=actions;r.grants=grants;r.code_hash=pinned;});else rows.modify(it,same_payer,[&](auto& r){r.version=version;r.actions=actions;r.grants=grants;r.code_hash=pinned;});
  }
  void check_pinned(const module_record& installed,name account){check(installed.code_hash!=checksum256()&&get_code_hash(account)==installed.code_hash,"MODULE_CODE");}
  // The module account key satisfies require_auth on a direct action. Only that
  // account's executing contract sets get_sender, so the key cannot skip the module.
  // The stored hash must still match that contract, so replacing its code drops the grant.
  void require_source(uint64_t dao_id,name source,name grant){check(get_sender()==source,"SOURCE_SENDER");require_auth(source);modules rows(get_self(),dao_id);const auto& installed=rows.get(source.value,"MODULE_DISABLED");check(std::find(installed.grants.begin(),installed.grants.end(),grant)!=installed.grants.end(),"MODULE_GRANT");check_pinned(installed,source);}
  void validate_instruction(const instruction& r) {
    auto c=configuration();check(r.version==c.interface_version&&r.chain_id==c.chain_id&&r.deployment==get_self(),"INSTRUCTION_DOMAIN");
    const auto& d=dao_rows.get(r.dao_id,"DAO_UNKNOWN");(void)d;
    check_agent_authority(get_self(),r.dao_id,r.member_id,r.target==get_self()&&(r.action=="withdraw"_n||r.action=="unstake"_n));
    members rows(get_self(),r.dao_id);const auto& m=rows.get(r.member_id,"MEMBER_UNKNOWN");check(m.active||(r.target==get_self()&&(r.action=="withdraw"_n||r.action=="unstake"_n)),"MEMBER_INACTIVE");
    check(r.nonce==m.nonce&&m.nonce<std::numeric_limits<uint64_t>::max(),"NONCE");
    auto now=current_time_point().sec_since_epoch();check(r.expires>now&&uint64_t(r.expires)<=uint64_t(now)+900,"EXPIRED_OR_TOO_LONG");
    check(r.data.size()>=24&&r.data.size()<=16384,"PAYLOAD_SIZE");auto context=unpack<actor_context>(r.data);
    check(context.runtime==get_self()&&context.dao_id==r.dao_id&&context.member_id==r.member_id,"PAYLOAD_DOMAIN");
    if(r.target==get_self())check(r.action=="govcreate"_n||r.action=="govlist"_n||r.action=="govunlist"_n||r.action=="govmodcopy"_n||r.action=="addmember"_n||r.action=="setadmit"_n||r.action=="setdaogov"_n||r.action=="addsession"_n||r.action=="delsession"_n||r.action=="setmeta"_n||r.action=="setprofile"_n||r.action=="putdoc"_n||r.action=="putjson"_n||r.action=="rotateepoch"_n||r.action=="rotatekey"_n||r.action=="commitepoch"_n||r.action=="linknative"_n||r.action=="unlinknat"_n||r.action=="linkevm"_n||r.action=="unlinkevm"_n||r.action=="setactive"_n||r.action=="setroles"_n||r.action=="grantkey"_n||r.action=="withdraw"_n||r.action=="unstake"_n||r.action=="modconfig"_n||r.action=="setcredits"_n||r.action=="confirmext"_n||r.action=="govfees"_n,"ACTION_UNSUPPORTED");
    else { modules rows(get_self(),r.dao_id);const auto& installed=rows.get(r.target.value,"MODULE_DISABLED");check(std::find(installed.actions.begin(),installed.actions.end(),r.action)!=installed.actions.end(),"ACTION_UNSUPPORTED");check_pinned(installed,r.target); }
  }
  void dispatch(const instruction& r) {
    members rows(get_self(),r.dao_id);const auto& m=rows.get(r.member_id);rows.modify(m,same_payer,[](auto& row){row.nonce++;});
    action outgoing;outgoing.account=r.target;outgoing.name=r.action;outgoing.authorization={{get_self(),"execctx"_n}};outgoing.data=r.data;
    if(r.target==get_self()&&r.action=="linknative"_n){auto data=unpack<std::tuple<name,uint64_t,uint64_t,name>>(r.data);auto incoming=std::get<3>(data);require_auth(incoming);outgoing.authorization.push_back(permission_level{incoming,"active"_n});}
    outgoing.send();
  }
};
extern "C" void apply(uint64_t receiver,uint64_t code,uint64_t action_name) {
  if(code==receiver){switch(action_name){
    EOSIO_DISPATCH_HELPER(runtime,(authproof)(unlinknat)(linkevm)(unlinkevm)(submitevm)(setadmit)(admitfrom))
    EOSIO_DISPATCH_HELPER(runtime,(init)(createdao)(enroll)(submit)(submitnat)(setmeta)(setprofile)(grantcredit)(setmodule)(reserve)(approveob)(cancelob)(confirmext)(payob)(putdoc)(putjson)(commitepoch)(rotateepoch)(rotatekey)(linknative)(setactive)(setroles)(grantkey)(govlock)(govunlock)(withdraw)(unstake)(modconfig)(setcredits))
    EOSIO_DISPATCH_HELPER(runtime,(enrollagent)(addmember)(initgov)(setdaogov)(addsession)(delsession)(guardpause)(guardrevoke)(guardrecover)(submitsess)(setfees)(listmod)(unlistmod)(setmodcopy)(setpolicy)(setgov)(setoracle)(govfees)(setcreate)(govcreate)(setcrrate)(ordercreate)(cardcreate)(createpaid)(govlist)(govunlist)(govmodcopy))
  }}
  else if(action_name=="transfer"_n.value) execute_action(name(receiver),name(code),&runtime::deposit);
}
