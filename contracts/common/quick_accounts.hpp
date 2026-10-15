#pragma once
#include "runtime_settings.hpp"
#include "evm_authorization.hpp"

namespace daclify {
struct quick_anchor {
 uint8_t kind=3;std::vector<char> credential;
 EOSLIB_SERIALIZE(quick_anchor,(kind)(credential))
};
struct quick_registration {
 uint16_t version;checksum256 chain_id;name runtime,authority;quick_anchor anchor;uint64_t account_id,epoch;uint32_t expires;
 EOSLIB_SERIALIZE(quick_registration,(version)(chain_id)(runtime)(authority)(anchor)(account_id)(epoch)(expires))
};
struct quick_control {
 uint16_t version;checksum256 chain_id;name runtime,authority;quick_anchor anchor;uint64_t account_id,epoch,nonce;uint32_t expires;bool use_default;
 EOSLIB_SERIALIZE(quick_control,(version)(chain_id)(runtime)(authority)(anchor)(account_id)(epoch)(nonce)(expires)(use_default))
};
struct quick_default {
 quick_control control;quick_anchor method;
 EOSLIB_SERIALIZE(quick_default,(control)(method))
};
struct quick_instruction {
 quick_control control;name target,action;checksum256 code_hash;std::vector<char> data;
 EOSLIB_SERIALIZE(quick_instruction,(control)(target)(action)(code_hash)(data))
};
struct quick_actor_context {
 name runtime,authority;uint64_t account_id;quick_anchor credential;
 EOSLIB_SERIALIZE(quick_actor_context,(runtime)(authority)(account_id)(credential))
};
struct [[eosio::table("qcfg"),eosio::contract("quickauth")]] quick_configuration {
 uint64_t id=0;name source;checksum256 code_hash;permission_level gateway;uint32_t maximum=5000,records=0;uint64_t next_id=1;
 uint64_t primary_key()const{return id;}uint64_t ram_owner(name,uint64_t)const{return 0;}
 EOSLIB_SERIALIZE(quick_configuration,(id)(source)(code_hash)(gateway)(maximum)(records)(next_id))
};
using quick_settings=ram_table<"qcfg"_n,quick_configuration>;
struct [[eosio::table("qaccounts"),eosio::contract("quickauth")]] quick_account {
 uint64_t id;checksum256 identity;quick_anchor approval;uint64_t epoch=1,nonce=0;bool active=true;uint32_t deactivated_at=0;
 uint64_t ram_owner(name,uint64_t)const{return 0;}
 uint64_t primary_key()const{return id;}checksum256 by_identity()const{return identity;}
 EOSLIB_SERIALIZE(quick_account,(id)(identity)(approval)(epoch)(nonce)(active)(deactivated_at))
};
// The sole secondary index enforces one registration per immutable anchor/domain.
using quick_accounts=ram_table<"qaccounts"_n,quick_account,indexed_by<"byidentity"_n,const_mem_fun<quick_account,checksum256,&quick_account::by_identity>>>;

inline void quick_anchor_valid(const quick_anchor& value){
 if(value.kind==0){check(value.credential.size()==34&&value.credential[0]==0,"QUICK_ANCHOR");return;}
 if(value.kind==1){check(value.credential.size()==16,"QUICK_ANCHOR");auto actor=unpack<permission_level>(value.credential);check(actor.actor.value&&actor.permission=="active"_n,"QUICK_ANCHOR");return;}
 if(value.kind==2){check(value.credential.size()==28,"QUICK_ANCHOR");auto wallet=unpack<std::tuple<uint64_t,checksum160>>(value.credential);check(std::get<0>(wallet)==40||std::get<0>(wallet)==41,"QUICK_ANCHOR");return;}
 check(false,"QUICK_ANCHOR");
}
inline checksum256 quick_identity(const checksum256& chain,name runtime,const quick_anchor& anchor){
 quick_anchor_valid(anchor);auto bytes=pack(std::make_tuple(std::string("daclify.quick-account.v1"),chain,runtime,anchor.kind,anchor.credential));return sha256(bytes.data(),bytes.size());
}
template<typename T>checksum256 quick_digest(const char* operation,const T& request){
 auto bytes=pack(std::make_tuple(std::string("daclify.quick-account.")+operation+".v1",request));return sha256(bytes.data(),bytes.size());
}
inline bool quick_same_anchor(const quick_anchor& a,const quick_anchor& b){return a.kind==b.kind&&a.credential==b.credential;}
}
