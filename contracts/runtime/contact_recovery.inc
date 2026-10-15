  void check_contact_encryption(const std::string& value){
    check(value.size()<=256&&nlohmann::json::accept(value),"RECOVERY_ENCRYPTION_KEY");auto k=nlohmann::json::parse(value);
    check(k.is_object()&&k.size()==4&&k.contains("kty")&&k.contains("crv")&&k.contains("x")&&k.contains("y"),"RECOVERY_ENCRYPTION_KEY");
    check(k["kty"]=="EC"&&k["crv"]=="P-256"&&k["x"].is_string()&&k["y"].is_string(),"RECOVERY_ENCRYPTION_KEY");
    for(auto field:{"x","y"}){const auto s=k[field].get<std::string>();check(s.size()==43&&std::all_of(s.begin(),s.end(),[](char c){return (c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='-'||c=='_';})&&std::string("AEIMQUYcgkosw048").find(s.back())!=std::string::npos,"RECOVERY_ENCRYPTION_KEY");}
  }
  checksum256 contact_request_hash(const contact_request& request){auto bytes=pack(request);return sha256(bytes.data(),bytes.size());}
  void check_contact_proof(const contact_proof& proof,name action_name,const signature& sig,checksum256 data_hash,uint64_t request_id){
    auto now=current_time_point().sec_since_epoch();
    check(proof.action==action_name&&proof.chain_id==configuration().chain_id&&proof.runtime==get_self(),"RECOVERY_DOMAIN");
    check(proof.expires>now&&uint64_t(proof.expires)<=uint64_t(now)+900,"RECOVERY_PROOF_EXPIRED");
    check(proof.contact<3&&proof.data_hash==data_hash&&proof.request_id==request_id,"RECOVERY_CONTEXT");
    contact_policies policies(get_self(),proof.dao_id);const auto& p=policies.get(proof.member_id,"RECOVERY_NOT_ENROLLED");
    check(p.revision==proof.revision&&p.contacts.size()==3,"RECOVERY_POLICY_CHANGED");
    members people(get_self(),proof.dao_id);check(people.get(proof.member_id,"MEMBER_UNKNOWN").signing_key==p.owner_key,"RECOVERY_POLICY_CHANGED");
    auto bytes=pack(proof);assert_recover_key(sha256(bytes.data(),bytes.size()),sig,p.contacts[proof.contact].signing_key);
  }
  ACTION setcontacts(name runtime,uint64_t dao_id,uint64_t member_id,std::vector<recovery_contact> contacts,bool documents){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);require_active_dao(get_self(),dao_id);
    participants actors(get_self(),dao_id);auto actor=actors.find(member_id);check(actor==actors.end()||actor->kind==0,"HUMAN_REQUIRED");
    check(contacts.empty()||contacts.size()==3,"RECOVERY_CONTACT_COUNT");check(!documents||(!contacts.empty()&&contact_documents_allowed(get_self(),dao_id)),"RECOVERY_DOCUMENT_POLICY");
    members people(get_self(),dao_id);const auto& member=people.get(member_id);check(contacts.empty()||member.custody==0,"RECOVERY_USER_CONTROLLED_REQUIRED");
    check(contacts.empty()||!contact_key_retired(get_self(),member.signing_key),"RECOVERY_KEY_RETIRED");
    for(size_t i=0;i<contacts.size();++i){check(contacts[i].signing_key.index()==0&&contacts[i].signing_key!=member.signing_key,"RECOVERY_CONTACT_KEY");check_contact_encryption(contacts[i].encryption_key);
      for(size_t j=0;j<i;++j)check(contacts[i].signing_key!=contacts[j].signing_key&&nlohmann::json::parse(contacts[i].encryption_key)!=nlohmann::json::parse(contacts[j].encryption_key),"RECOVERY_CONTACT_DUPLICATE");}
    contact_policies rows(get_self(),dao_id);auto old=rows.find(member_id);contact_policy p;
    if(old!=rows.end()){p=*old;p.revision=add64(p.revision,1);}p.member_id=member_id;p.owner_key=member.signing_key;p.contacts=contacts;p.accepted=0;p.documents=documents;
    if(old==rows.end())rows.emplace(get_self(),[&](auto& r){r=p;});else rows.modify(old,same_payer,[&](auto& r){r=p;});
    contact_requests pending(get_self(),dao_id);auto request=pending.find(member_id);if(request!=pending.end())pending.erase(request);
  }
  ACTION acceptcont(contact_proof proof,signature sig){
    check_contact_proof(proof,"acceptcont"_n,sig,checksum256{},0);
    contact_policies rows(get_self(),proof.dao_id);const auto& p=rows.get(proof.member_id);check(!(p.accepted&(1<<proof.contact)),"RECOVERY_CONTACT_ACCEPTED");
    rows.modify(p,same_payer,[&](auto& r){r.accepted|=1<<proof.contact;});
  }
  ACTION startrecover(contact_request request,signature new_sig,contact_proof proof,signature sig){
    require_active_dao(get_self(),request.dao_id);const auto now=current_time_point().sec_since_epoch();
    check(request.action=="startrecover"_n&&request.chain_id==configuration().chain_id&&request.runtime==get_self()&&proof.dao_id==request.dao_id&&proof.member_id==request.member_id&&proof.revision==request.revision,"RECOVERY_DOMAIN");
    check(request.expires>uint64_t(now)+contact_recovery_wait&&uint64_t(request.expires)<=uint64_t(now)+604800,"RECOVERY_EXPIRY");
    check_contact_encryption(request.encryption_key);check(request.signing_key.index()==0,"RECOVERY_SIGNING_KEY");
    contact_policies policies(get_self(),request.dao_id);const auto& p=policies.get(request.member_id,"RECOVERY_NOT_ENROLLED");
    check(p.accepted==7&&p.contacts.size()==3,"RECOVERY_CONTACTS_PENDING");check(request.request_id==add64(p.next_request,1),"RECOVERY_SEQUENCE");
    auto hash=contact_request_hash(request);assert_recover_key(hash,new_sig,request.signing_key);check_contact_proof(proof,"startrecover"_n,sig,hash,request.request_id);
    members people(get_self(),request.dao_id);const auto& m=people.get(request.member_id,"MEMBER_UNKNOWN");check(m.custody==0,"RECOVERY_USER_CONTROLLED_REQUIRED");
    check(m.signing_key!=request.signing_key,"RECOVERY_SIGNING_KEY");check_unique_key(request.dao_id,request.signing_key);
    if(request.native_account.value)check(is_account(request.native_account),"NATIVE_ACCOUNT");
    contact_requests rows(get_self(),request.dao_id);auto old=rows.find(request.member_id);check(old==rows.end()||old->request.expires<=now,"RECOVERY_ALREADY_PENDING");if(old!=rows.end())rows.erase(old);
    rows.emplace(get_self(),[&](auto& r){r.member_id=request.member_id;r.request=request;r.old_signing_key=m.signing_key;r.approvals=1<<proof.contact;});
    policies.modify(p,same_payer,[&](auto& r){r.next_request=request.request_id;});
  }
  ACTION approverec(contact_proof proof,signature sig){
    contact_requests rows(get_self(),proof.dao_id);const auto& pending=rows.get(proof.member_id,"RECOVERY_REQUEST_UNKNOWN");
    check_contact_proof(proof,"approverec"_n,sig,contact_request_hash(pending.request),pending.request.request_id);
    const auto now=current_time_point().sec_since_epoch();check(uint64_t(now)+contact_recovery_wait<pending.request.expires,"RECOVERY_EXPIRY");
    check(!(pending.approvals&(1<<proof.contact)),"RECOVERY_DUPLICATE_APPROVAL");
    rows.modify(pending,same_payer,[&](auto& r){r.approvals|=1<<proof.contact;if(!r.execute_after)r.execute_after=now+contact_recovery_wait;});
  }
  ACTION cancelrec(name runtime,uint64_t dao_id,uint64_t member_id){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    contact_requests rows(get_self(),dao_id);const auto& r=rows.get(member_id,"RECOVERY_REQUEST_UNKNOWN");rows.erase(r);
  }
  ACTION prunerec(uint64_t dao_id,uint64_t member_id){
    contact_requests rows(get_self(),dao_id);auto r=rows.find(member_id);if(r!=rows.end()&&r->request.expires<=current_time_point().sec_since_epoch())rows.erase(r);
  }
  ACTION finishrec(uint64_t dao_id,uint64_t member_id,uint64_t request_id){
    require_active_dao(get_self(),dao_id);contact_requests pending(get_self(),dao_id);const auto request=pending.get(member_id,"RECOVERY_REQUEST_UNKNOWN");
    check(request.request.request_id==request_id,"RECOVERY_SEQUENCE");const auto now=current_time_point().sec_since_epoch();
    check(request.execute_after>0,"RECOVERY_PENDING");check(request.execute_after<=now,"RECOVERY_WAIT");check(request.request.expires>now,"RECOVERY_EXPIRY");
    contact_policies policies(get_self(),dao_id);const auto& policy=policies.get(member_id);check(policy.revision==request.request.revision&&policy.accepted==7,"RECOVERY_POLICY_CHANGED");
    members people(get_self(),dao_id);const auto member=people.get(member_id,"MEMBER_UNKNOWN");check(member.signing_key==request.old_signing_key,"RECOVERY_POLICY_CHANGED");
    participants actors(get_self(),dao_id);auto actor=actors.find(member_id);check(actor==actors.end()||actor->kind==0,"HUMAN_REQUIRED");
    check_unique_key(dao_id,request.request.signing_key);if(request.request.native_account.value){require_auth(request.request.native_account);auto index=people.get_index<"bynative"_n>();auto existing=index.find(request.request.native_account.value);check(existing==index.end()||existing->id==member_id,"CREDENTIAL_EXISTS");}
    check(!contact_key_retired(get_self(),request.request.signing_key),"RECOVERY_KEY_RETIRED");
    retired_contact_keys retired(get_self(),get_self().value);auto retired_index=retired.get_index<"bykey"_n>();
    retired_contact_key old_key{};old_key.signing_key=member.signing_key;auto previous=retired_index.find(old_key.by_key());
    contact_roots roots(get_self(),get_self().value);auto root_index=roots.get_index<"bykey"_n>();auto current=root_index.find(old_key.by_key());
    uint64_t identity_id=previous!=retired_index.end()?previous->identity_id:current!=root_index.end()?current->id:0;
    if(!identity_id){identity_id=roots.available_primary_key();if(!identity_id)identity_id=1;check(identity_id<std::numeric_limits<uint64_t>::max(),"RECOVERY_IDENTITY_LIMIT");roots.emplace(get_self(),[&](auto& r){r.id=identity_id;r.dao_id=dao_id;r.signing_key=member.signing_key;r.origin_key=member.signing_key;});}
    const auto identity=roots.get(identity_id);retired_contact_key incoming{};incoming.signing_key=request.request.signing_key;
    auto other=root_index.find(incoming.by_key());check(other==root_index.end()||other->id==identity_id,"RECOVERY_IDENTITY_CONFLICT");
    if(identity.signing_key!=request.request.signing_key){
      retired_contact_key key{};key.dao_id=dao_id;key.signing_key=identity.signing_key;key.identity_id=identity_id;key.id=retired.available_primary_key();if(!key.id)key.id=1;check(key.id<std::numeric_limits<uint64_t>::max(),"RECOVERY_IDENTITY_LIMIT");
      check(retired_index.find(key.by_key())==retired_index.end(),"RECOVERY_IDENTITY_CHANGED");retired.emplace(get_self(),[&](auto& r){r=key;});
      roots.modify(roots.get(identity_id),same_payer,[&](auto& r){r.signing_key=request.request.signing_key;});
    }
    bump_credentials(dao_id,member_id);people.modify(people.get(member_id),same_payer,[&](auto& r){r.signing_key=request.request.signing_key;r.encryption_key=request.request.encryption_key;r.native_account=request.request.native_account;});
    evm_bindings bindings(get_self(),dao_id);auto binding=bindings.find(member_id);if(binding!=bindings.end())bindings.modify(binding,same_payer,[](auto& r){r.active=false;r.epoch=add64(r.epoch,1);});
    check_native_controller(dao_id);native_governance_settings native(get_self(),get_self().value);
    if(native.exists()){const auto cfg=native.get();check(cfg.dao_id!=dao_id||!cfg.handed_over||std::find(cfg.admin_members.begin(),cfg.admin_members.end(),member_id)==cfg.admin_members.end()||request.request.native_account.value,"RECOVERY_NATIVE_ROLE_CHANGED");}
    refresh_native_governance(dao_id);check(people.get(member_id).admin==member.admin,"RECOVERY_NATIVE_ROLE_CHANGED");bump_app_security(get_self(),dao_id);
    contact_results results(get_self(),dao_id);auto old=results.find(member_id);contact_result result{member_id,request.request,request.old_signing_key,now,dao_rows.get(dao_id).key_epoch,policy.documents&&contact_documents_allowed(get_self(),dao_id)};
    result.identity_id=identity_id;
    if(old==results.end())results.emplace(get_self(),[&](auto& r){r=result;});else results.modify(old,same_payer,[&](auto& r){r=result;});
    policies.modify(policy,same_payer,[&](auto& r){r.owner_key=request.request.signing_key;});pending.erase(pending.get(member_id));
  }
  ACTION setrecpolicy(name runtime,uint64_t dao_id,uint64_t member_id,bool allowed){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);require_active_dao(get_self(),dao_id);
    check(dao_rows.get(dao_id).privacy>0||!allowed,"DAO_PUBLIC");
    contact_document_policies rows(get_self(),get_self().value);auto old=rows.find(dao_id);
    if(old==rows.end())rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.allowed=allowed;});
    else{if(old->allowed&&!allowed){const auto& d=dao_rows.get(dao_id);dao_rows.modify(d,same_payer,[](auto& r){r.key_epoch=add64(r.key_epoch,1);});}rows.modify(old,same_payer,[&](auto& r){r.allowed=allowed;r.revision=add64(r.revision,1);});}
  }
  ACTION putrecpack(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t packet_id,std::string packet){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);require_active_dao(get_self(),dao_id);
    check(packet.size()>0&&packet.size()<=16000&&nlohmann::json::accept(packet),"RECOVERY_PACKET_SIZE");
    contact_policies policies(get_self(),dao_id);const auto& p=policies.get(member_id,"RECOVERY_NOT_ENROLLED");check(p.documents&&p.accepted==7&&contact_documents_allowed(get_self(),dao_id),"RECOVERY_DOCUMENT_POLICY");
    check(p.owner_key==members(get_self(),dao_id).get(member_id).signing_key,"RECOVERY_POLICY_CHANGED");
    auto value=nlohmann::json::parse(packet);check(value.is_object()&&value.contains("context")&&value.contains("version")&&value["version"]==1,"RECOVERY_PACKET_CONTEXT");
    const auto& context=value["context"];check(context.is_object()&&context.contains("revision")&&context.contains("packetId")&&context["revision"]==std::to_string(p.revision)&&context["packetId"]==std::to_string(packet_id),"RECOVERY_PACKET_CONTEXT");
    check(context.contains("target")&&context["target"].is_object()&&context["target"].contains("memberId")&&context["target"]["memberId"]==std::to_string(member_id)&&context["target"].contains("dao"),"RECOVERY_PACKET_CONTEXT");
    const auto& dao=context["target"]["dao"];std::string chain;const char* digits="0123456789abcdef";for(auto byte:configuration().chain_id.extract_as_byte_array()){chain+=digits[byte>>4];chain+=digits[byte&15];}
    check(dao.is_object()&&dao.contains("chainId")&&dao["chainId"]==chain&&dao.contains("contract")&&dao["contract"]==get_self().to_string()&&dao.contains("daoId")&&dao["daoId"]==std::to_string(dao_id),"RECOVERY_PACKET_CONTEXT");
    check(context.contains("epochs")&&context["epochs"].is_array()&&!context["epochs"].empty()&&context["epochs"].size()<=64,"RECOVERY_PACKET_CONTEXT");
    contact_document_policies docs(get_self(),get_self().value);const auto& cfg=docs.get(dao_id);check(packet_id==add64(cfg.next_packet,1),"RECOVERY_PACKET_SEQUENCE");
    contact_document_packets packets(get_self(),dao_id);packets.emplace(get_self(),[&](auto& r){r.id=packet_id;r.member_id=member_id;r.revision=p.revision;r.packet=packet;r.commitment=sha256(packet.data(),packet.size());});docs.modify(cfg,same_payer,[&](auto& r){r.next_packet=packet_id;});
  }
  ACTION ackrecpack(contact_proof proof,signature sig){
    contact_document_packets rows(get_self(),proof.dao_id);const auto& packet=rows.get(proof.request_id,"RECOVERY_PACKET_UNKNOWN");
    check(packet.member_id==proof.member_id&&packet.revision==proof.revision,"RECOVERY_PACKET_CONTEXT");
    check_contact_proof(proof,"ackrecpack"_n,sig,packet.commitment,packet.id);
    check(!(packet.acknowledged&(1<<proof.contact)),"RECOVERY_CONTACT_ACCEPTED");rows.modify(packet,same_payer,[&](auto& r){r.acknowledged|=1<<proof.contact;});
  }
  ACTION ackrecgrant(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t recipient){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);
    contact_results rows(get_self(),dao_id);const auto& r=rows.get(recipient,"RECOVERY_RESULT_UNKNOWN");const auto epoch=dao_rows.get(dao_id).key_epoch;
    check(epoch>r.document_epoch,"RECOVERY_NEW_EPOCH_REQUIRED");rows.modify(r,same_payer,[&](auto& result){result.future_grants=true;result.document_epoch=epoch-1;});
  }
  ACTION recovergrant(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t request_id,uint64_t epoch,std::string envelope){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,false,true);
    contact_results results(get_self(),dao_id);const auto& result=results.get(member_id,"RECOVERY_RESULT_UNKNOWN");
    check(result.request.request_id==request_id&&result.request.signing_key==members(get_self(),dao_id).get(member_id).signing_key,"RECOVERY_CONTEXT");
    check(result.documents_approved&&contact_documents_allowed(get_self(),dao_id),"RECOVERY_DOCUMENT_POLICY");
    key_grants originals(get_self(),dao_id);auto original=originals.get_index<"bymember"_n>();check(original.find((uint128_t(member_id)<<64)|epoch)!=original.end(),"RECOVERY_EPOCH_NOT_GRANTED");
    require_epoch(dao_id,epoch);check(envelope.size()>0&&envelope.size()<=8192&&nlohmann::json::accept(envelope),"KEY_GRANT_SIZE");
    contact_epoch_grants rows(get_self(),dao_id);contact_epoch_grant value{};value.member_id=member_id;value.request_id=request_id;value.epoch=epoch;value.envelope=envelope;
    auto index=rows.get_index<"bycontext"_n>();auto old=index.find(value.by_context());
    if(old!=index.end()){check(old->envelope==envelope,"RECOVERY_GRANT_EXISTS");return;}
    value.id=rows.available_primary_key();if(!value.id)value.id=1;check(value.id<std::numeric_limits<uint64_t>::max(),"RECOVERY_GRANT_LIMIT");rows.emplace(get_self(),[&](auto& r){r=value;});
  }
