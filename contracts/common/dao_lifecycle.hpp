#pragma once
#include "records.hpp"
namespace daclify {
struct [[eosio::table("lifehashes"),eosio::contract("runtime")]] lifecycle_source {
 name account;checksum256 code_hash;uint8_t kind;
 uint64_t primary_key()const{return account.value;}
 EOSLIB_SERIALIZE(lifecycle_source,(account)(code_hash)(kind))
};
using lifecycle_sources=ram_table<"lifehashes"_n,lifecycle_source>;
// One fixed proof per DAO/module, bound to both the executing code and retirement generation.
struct [[eosio::table("closechecks"),eosio::contract(DACLIFY_RAM_PAYER_CONTRACT)]] closure_check {
 uint64_t dao_id;checksum256 code_hash;uint32_t closing_at;uint8_t stage=0;uint64_t cursor=0;bool complete=false;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(closure_check,(dao_id)(code_hash)(closing_at)(stage)(cursor)(complete))
};
using closure_checks=ram_table<"closechecks"_n,closure_check>;
struct [[eosio::table("hostclose"),eosio::contract("runtime")]] hosted_closure {
 uint64_t dao_id;uint32_t closing_at;name settler;checksum256 receipt;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(hosted_closure,(dao_id)(closing_at)(settler)(receipt))
};
using hosted_closures=ram_table<"hostclose"_n,hosted_closure>;
inline uint8_t dao_lifecycle(name runtime,uint64_t dao_id){
 dao_lifecycles rows(runtime,runtime.value);auto found=rows.find(dao_id);return found==rows.end()?0:found->state;
}
inline void require_active_dao(name runtime,uint64_t dao_id){
 const auto state=dao_lifecycle(runtime,dao_id);check(state==0,state==1?"DAO_CLOSING":"DAO_CLOSED");
}
inline void require_retirement_action(name runtime,uint64_t dao_id,name action_name,bool core){
 const auto state=dao_lifecycle(runtime,dao_id);if(!state)return;
 const bool exit=core&&(action_name=="leave"_n||action_name=="withdraw"_n||action_name=="unstake"_n||action_name=="delprofile"_n);
 if(state==2){check(exit,"DAO_CLOSED");return;}
 check(state==1,"DAO_LIFECYCLE_UNSUPPORTED");
 const bool continuation=core?
  (action_name=="closedao"_n||action_name=="beginhand"_n||action_name=="scanhand"_n||action_name=="accepthand"_n||action_name=="grantkey"_n||action_name=="commitepoch"_n||action_name=="rotateepoch"_n||action_name=="putdoc"_n||action_name=="putjson"_n||action_name=="restoredoc"_n||action_name=="rotatekey"_n||action_name=="unlinknat"_n||action_name=="unlinkevm"_n||action_name=="delsession"_n||action_name=="setactive"_n||action_name=="setroles"_n||action_name=="setapp"_n||action_name=="refreshgov"_n||action_name=="heartbeat"_n||action_name=="setexecs"_n||action_name=="archapprove"_n||action_name=="archrevoke"_n||action_name=="confirmext"_n):
  (action_name=="submitwork"_n||action_name=="review"_n||action_name=="cancel"_n||action_name=="vote"_n||action_name=="edit"_n||action_name=="reviewapp"_n||action_name=="closeapp"_n||action_name=="closeround"_n||action_name=="unwitness"_n||action_name=="reviewact"_n||action_name=="linkdecision"_n||action_name=="newappkey"_n||action_name=="grantappkey"_n||action_name=="canceldoc"_n||action_name=="ackdoc"_n);
 check(exit||continuation,"DAO_CLOSING");
}
}
