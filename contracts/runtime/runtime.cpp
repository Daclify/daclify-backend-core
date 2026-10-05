#include "records.hpp"
#define JSON_NOEXCEPTION
#define JSON_HAS_FILESYSTEM 0
#define JSON_HAS_EXPERIMENTAL_FILESYSTEM 0
#include "json.hpp"
using namespace daclify;
CONTRACT runtime : public contract {
public:
  using contract::contract;
  TABLE settings { checksum256 chain_id; uint16_t interface_version=1; EOSLIB_SERIALIZE(settings,(chain_id)(interface_version)) };
  using config = singleton<"settings"_n,settings>;
  ACTION init(checksum256 chain_id) {
    require_auth(get_self()); config c(get_self(),get_self().value);
    check(!c.exists(),"ALREADY_INITIALIZED"); c.set(settings{chain_id,1},get_self());
  }
  ACTION createdao(uint64_t dao_id,name owner,std::string metadata,uint8_t privacy,name token_contract,symbol token_symbol) {
    require_auth(owner); configuration(); check(dao_id>0,"DAO_ID"); check(privacy<=2,"PRIVACY_POLICY");
    check(is_account(owner),"OWNER_ACCOUNT"); check(token_contract.value>0&&token_symbol.is_valid(),"ASSET_IDENTITY");
    check(dao_rows.find(dao_id)==dao_rows.end(),"DAO_EXISTS"); validate_metadata(metadata);
    dao_rows.emplace(get_self(),[&](auto& d){ d.id=dao_id; d.owner=owner; d.metadata=metadata; d.privacy=privacy; d.token_contract=token_contract; d.token_symbol=token_symbol; });
  }
  ACTION enroll(uint64_t dao_id,uint64_t member_id,name native_account,public_key signing_key,std::string encryption_key,uint8_t custody) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN"); require_auth(d.owner);
    check(member_id>d.max_member&&member_id>0,"MEMBER_ID"); check(d.member_count<5000,"MEMBER_LIMIT");
    check(custody<=1&&!(d.privacy==2&&custody==1),"CUSTODY_POLICY");
    check(!encryption_key.empty()&&encryption_key.size()<=1024,"ENCRYPTION_KEY");
    check(!native_account.value||is_account(native_account),"NATIVE_ACCOUNT");
    members rows(get_self(),dao_id);
    if(native_account.value) { auto index=rows.get_index<"bynative"_n>(); check(index.find(native_account.value)==index.end(),"CREDENTIAL_EXISTS"); }
    auto key_index=rows.get_index<"bykey"_n>(); auto packed=pack(signing_key);
    check(key_index.find(sha256(packed.data(),packed.size()))==key_index.end(),"CREDENTIAL_EXISTS");
    if(native_account.value) require_auth(native_account);
    const bool first=d.max_member==0;
    rows.emplace(get_self(),[&](auto& m){m.id=member_id;m.native_account=native_account;m.signing_key=signing_key;m.encryption_key=encryption_key;m.custody=custody;m.admin=first;m.join_epoch=d.key_epoch;});
    dao_rows.modify(d,same_payer,[&](auto& r){r.member_count++;r.max_member=member_id;if(first)r.admin_count++;});
  }
  ACTION submit(instruction request,signature sig) {
    validate_instruction(request);
    members rows(get_self(),request.dao_id); const auto& m=rows.get(request.member_id,"MEMBER_UNKNOWN");
    auto packed=pack(request); auto digest=sha256(packed.data(),packed.size());
    assert_recover_key(digest,sig,m.signing_key);
    dispatch(request);
  }
  ACTION submitnat(instruction request) {
    validate_instruction(request); members rows(get_self(),request.dao_id);
    const auto& m=rows.get(request.member_id,"MEMBER_UNKNOWN"); check(m.native_account.value,"NATIVE_UNLINKED");
    require_auth(m.native_account); dispatch(request);
  }
  ACTION setmeta(name runtime,uint64_t dao_id,uint64_t member_id,std::string metadata) {
    authorized_actor(runtime,dao_id,member_id,true); validate_metadata(metadata);
    const auto& d=dao_rows.get(dao_id); dao_rows.modify(d,same_payer,[&](auto& r){r.metadata=metadata;});
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
  ACTION setcredits(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t target,uint64_t quantity) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");members rows(get_self(),dao_id);const auto& m=rows.get(target,"MEMBER_UNKNOWN");
    dao_rows.modify(d,same_payer,[&](auto& r){if(quantity>=m.credits){r.credit_supply=add64(r.credit_supply,quantity-m.credits);if(m.active)r.eligible_credits=add64(r.eligible_credits,quantity-m.credits);}else{r.credit_supply-=m.credits-quantity;if(m.active)r.eligible_credits-=m.credits-quantity;}});rows.modify(m,same_payer,[&](auto& r){r.credits=quantity;});
  }
  ACTION reserve(uint64_t dao_id,name source,uint64_t source_id,uint64_t recipient,asset quantity,uint32_t due) {
    require_source(dao_id,source,"reserve"_n);const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");
    check(source_id>0,"OBLIGATION_ID");check(quantity.symbol==d.token_symbol&&quantity.amount>0,"ASSET_QUANTITY");
    members people(get_self(),dao_id);check(people.get(recipient,"MEMBER_UNKNOWN").active,"MEMBER_INACTIVE");
    check(quantity.amount<=d.available,"INSUFFICIENT_AVAILABLE");
    obligations rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();check(index.find(source_hash(source,source_id))==index.end(),"OBLIGATION_EXISTS");
    auto next=rows.available_primary_key();check(next<std::numeric_limits<uint64_t>::max(),"OBLIGATION_LIMIT");if(next==0)next=1;
    rows.emplace(get_self(),[&](auto& r){r.id=next;r.source=source;r.source_id=source_id;r.recipient=recipient;r.quantity=quantity;r.due=due;r.status=0;});
    dao_rows.modify(d,same_payer,[&](auto& r){r.available=add_amount(r.available,-quantity.amount);r.reserved=add_amount(r.reserved,quantity.amount);});
  }
  ACTION approveob(uint64_t dao_id,name source,uint64_t source_id) {
    require_source(dao_id,source,"approve"_n);obligations rows(get_self(),dao_id);auto id=obligation_id(rows,source,source_id);const auto& o=rows.get(id);
    check(o.status==0,"NOT_APPROVABLE");rows.modify(o,same_payer,[](auto& r){r.status=1;});
  }
  ACTION cancelob(uint64_t dao_id,name source,uint64_t source_id) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");if(!has_auth(d.owner))require_source(dao_id,source,"cancel"_n);else require_auth(d.owner);
    obligations rows(get_self(),dao_id);const auto& o=rows.get(obligation_id(rows,source,source_id));check(o.status==0,"NOT_CANCELLABLE");
    dao_rows.modify(d,same_payer,[&](auto& r){r.reserved=add_amount(r.reserved,-o.quantity.amount);r.available=add_amount(r.available,o.quantity.amount);});
    rows.modify(o,same_payer,[](auto& r){r.status=3;});
  }
  ACTION payob(uint64_t dao_id,name source,uint64_t source_id) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");obligations rows(get_self(),dao_id);const auto& o=rows.get(obligation_id(rows,source,source_id));
    check(o.status==1&&o.due<=current_time_point().sec_since_epoch(),"NOT_PAYABLE");
    members people(get_self(),dao_id);const auto& m=people.get(o.recipient,"MEMBER_UNKNOWN");
    auto quantity=o.quantity;auto destination=m.native_account;
    rows.modify(o,same_payer,[](auto& r){r.status=2;});
    dao_rows.modify(d,same_payer,[&](auto& r){r.reserved=add_amount(r.reserved,-quantity.amount);if(!destination.value)r.claims=add_amount(r.claims,quantity.amount);});
    if(destination.value)action(permission_level{get_self(),"active"_n},d.token_contract,"transfer"_n,std::make_tuple(get_self(),destination,quantity,std::string("Daclify approved obligation"))).send();
    else people.modify(m,same_payer,[&](auto& r){r.claim=add_amount(r.claim,quantity.amount);});
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
    rows.modify(m,same_payer,[&](auto& r){r.signing_key=signing_key;});
  }
  ACTION linknative(name runtime,uint64_t dao_id,uint64_t member_id,name account) {
    authorized_actor(runtime,dao_id,member_id);require_auth(account);check(is_account(account),"NATIVE_ACCOUNT");members rows(get_self(),dao_id);
    auto index=rows.get_index<"bynative"_n>();auto linked=index.find(account.value);check(linked==index.end()||linked->id==member_id,"CREDENTIAL_EXISTS");
    const auto& m=rows.get(member_id);rows.modify(m,same_payer,[&](auto& r){r.native_account=account;});
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
  }
  ACTION unstake(name runtime,uint64_t dao_id,uint64_t member_id,name destination,asset quantity) {
    authorized_actor(runtime,dao_id,member_id,false,true);const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");check(quantity.symbol==d.token_symbol&&quantity.amount>0,"ASSET_QUANTITY");check(destination!=get_self()&&is_account(destination),"PAYOUT_DESTINATION");members people(get_self(),dao_id);const auto& m=people.get(member_id);check(quantity.amount<=m.stake,"INSUFFICIENT_STAKE");
    dao_rows.modify(d,same_payer,[&](auto& r){r.staked=add_amount(r.staked,-quantity.amount);if(m.active)r.eligible_stake=add_amount(r.eligible_stake,-quantity.amount);});people.modify(m,same_payer,[&](auto& r){r.stake=add_amount(r.stake,-quantity.amount);});
    action(permission_level{get_self(),"active"_n},d.token_contract,"transfer"_n,std::make_tuple(get_self(),destination,quantity,std::string("Daclify governance unstake"))).send();
  }
  [[eosio::on_notify("*::transfer")]] void deposit(name from,name to,asset quantity,std::string memo) {
    if(to!=get_self()||from==get_self())return;
    check(quantity.is_valid()&&quantity.amount>0,"ASSET_QUANTITY");check(memo.size()<=64,"DEPOSIT_REFERENCE");
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
  settings configuration() { config c(get_self(),get_self().value); check(c.exists(),"NOT_INITIALIZED"); return c.get(); }
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
  void validate_cid(const std::string& cid) {
    check(cid.size()==59&&cid[0]=='b',"CID_FORMAT");std::vector<uint8_t> raw;uint32_t bits=0;uint8_t count=0;
    const std::string alphabet="abcdefghijklmnopqrstuvwxyz234567";
    for(size_t i=1;i<cid.size();i++){auto position=alphabet.find(cid[i]);check(position!=std::string::npos,"CID_FORMAT");bits=(bits<<5)|position;count+=5;if(count>=8){count-=8;raw.push_back((bits>>count)&255);bits&=(1u<<count)-1;}}
    check(bits==0&&raw.size()==36&&raw[0]==1&&(raw[1]==0x55||raw[1]==0x70||raw[1]==0x71)&&raw[2]==0x12&&raw[3]==32,"CID_FORMAT");
  }
  void authorized_actor(name runtime,uint64_t dao_id,uint64_t member_id,bool admin=false,bool exit=false) {
    check(runtime==get_self(),"RUNTIME_DOMAIN");if(get_sender().value){check(get_sender()==get_self(),"ACTOR_SENDER");require_auth(permission_level{get_self(),"execctx"_n});}else require_auth(get_self());members rows(get_self(),dao_id);
    const auto& m=rows.get(member_id,"MEMBER_UNKNOWN");check(m.active||exit,"MEMBER_INACTIVE");check(!admin||m.admin,"ADMIN_REQUIRED");
  }
  uint64_t parse_id(const std::string& value) {check(!value.empty()&&value.size()<=20&&value[0]!='0',"DEPOSIT_REFERENCE");uint64_t out=0;for(auto c:value){check(c>='0'&&c<='9',"DEPOSIT_REFERENCE");check(out<=(std::numeric_limits<uint64_t>::max()-(c-'0'))/10,"DEPOSIT_REFERENCE");out=out*10+(c-'0');}return out;}
  checksum256 source_hash(name source,uint64_t id){auto packed=pack(std::make_tuple(source,id));return sha256(packed.data(),packed.size());}
  uint64_t obligation_id(obligations& rows,name source,uint64_t id){auto index=rows.get_index<"bysource"_n>();const auto& o=index.get(source_hash(source,id),"OBLIGATION_UNKNOWN");check(o.source==source&&o.source_id==id,"OBLIGATION_DOMAIN");return o.id;}
  void install_module(uint64_t dao_id,name account,uint16_t version,const std::vector<name>& actions,const std::vector<name>& grants,checksum256 code_hash) {
    check(is_account(account)&&account!=get_self(),"MODULE_ACCOUNT");check(version==1&&actions.size()<=16&&grants.size()<=16,"MODULE_VERSION_OR_LIMIT");
    for(auto grant:grants)check(grant=="reserve"_n||grant=="approve"_n||grant=="cancel"_n||grant=="govlock"_n,"MODULE_GRANT_UNKNOWN");
    auto unique=[](const auto& list){for(size_t i=0;i<list.size();i++){check(list[i].value>0,"MODULE_ACTION");for(size_t j=i+1;j<list.size();j++)check(list[i]!=list[j],"DUPLICATE_GRANT");}};unique(actions);unique(grants);
    // Clearing both lists removes a module after its code has changed. Any remaining
    // action or grant must pin the hash of the code loaded at that account.
    checksum256 pinned{};
    if(!actions.empty()||!grants.empty()){check(code_hash!=checksum256(),"MODULE_CODE");check(get_code_hash(account)==code_hash,"MODULE_CODE");pinned=code_hash;}
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
    members rows(get_self(),r.dao_id);const auto& m=rows.get(r.member_id,"MEMBER_UNKNOWN");check(m.active||(r.target==get_self()&&(r.action=="withdraw"_n||r.action=="unstake"_n)),"MEMBER_INACTIVE");
    check(r.nonce==m.nonce&&m.nonce<std::numeric_limits<uint64_t>::max(),"NONCE");
    auto now=current_time_point().sec_since_epoch();check(r.expires>now&&uint64_t(r.expires)<=uint64_t(now)+900,"EXPIRED_OR_TOO_LONG");
    check(r.data.size()>=24&&r.data.size()<=16384,"PAYLOAD_SIZE");auto context=unpack<actor_context>(r.data);
    check(context.runtime==get_self()&&context.dao_id==r.dao_id&&context.member_id==r.member_id,"PAYLOAD_DOMAIN");
    if(r.target==get_self())check(r.action=="setmeta"_n||r.action=="putdoc"_n||r.action=="putjson"_n||r.action=="rotateepoch"_n||r.action=="rotatekey"_n||r.action=="commitepoch"_n||r.action=="linknative"_n||r.action=="setactive"_n||r.action=="setroles"_n||r.action=="grantkey"_n||r.action=="withdraw"_n||r.action=="unstake"_n||r.action=="modconfig"_n||r.action=="setcredits"_n,"ACTION_UNSUPPORTED");
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
  if(code==receiver){switch(action_name){EOSIO_DISPATCH_HELPER(runtime,(init)(createdao)(enroll)(submit)(submitnat)(setmeta)(grantcredit)(setmodule)(reserve)(approveob)(cancelob)(payob)(putdoc)(putjson)(commitepoch)(rotateepoch)(rotatekey)(linknative)(setactive)(setroles)(grantkey)(govlock)(govunlock)(withdraw)(unstake)(modconfig)(setcredits))}}
  else if(action_name=="transfer"_n.value) execute_action(name(receiver),name(code),&runtime::deposit);
}
