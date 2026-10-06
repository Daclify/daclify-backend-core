#pragma once
#include "records.hpp"
namespace daclify {
struct gov_settings {
 uint8_t participant_mode; name decide; name guardian; uint8_t kind; uint32_t duration; uint16_t quorum; uint16_t approval;
 bool governed_works; int64_t max_commitment; int64_t daily_commitment;
 EOSLIB_SERIALIZE(gov_settings,(participant_mode)(decide)(guardian)(kind)(duration)(quorum)(approval)(governed_works)(max_commitment)(daily_commitment))
};
struct [[eosio::table("govpolicies"), eosio::contract("runtime")]] gov_policy_record {
 uint64_t dao_id; uint64_t revision=1; gov_settings config;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(gov_policy_record,(dao_id)(revision)(config))
};
using gov_policies=multi_index<"govpolicies"_n,gov_policy_record>;
struct [[eosio::table("actors"), eosio::contract("runtime")]] participant_record {
 uint64_t id; uint8_t kind=0; std::string operator_label; bool revoked=false; uint64_t credential_epoch=1;
 uint64_t primary_key()const{return id;}
 EOSLIB_SERIALIZE(participant_record,(id)(kind)(operator_label)(revoked)(credential_epoch))
};
using participants=multi_index<"actors"_n,participant_record>;
struct session_permission {
 name target; name action; checksum256 code_hash;
 EOSLIB_SERIALIZE(session_permission,(target)(action)(code_hash))
};
struct [[eosio::table("sessions"), eosio::contract("runtime")]] session_record {
 uint64_t id; uint64_t member_id; public_key signing_key; uint32_t expires; uint64_t credential_epoch; std::vector<session_permission> permissions;
 uint64_t primary_key()const{return id;} uint64_t by_member()const{return member_id;}
 checksum256 by_key()const{auto bytes=pack(signing_key);return sha256(bytes.data(),bytes.size());}
 EOSLIB_SERIALIZE(session_record,(id)(member_id)(signing_key)(expires)(credential_epoch)(permissions))
};
using scoped_sessions=multi_index<"sessions"_n,session_record,indexed_by<"bykey"_n,const_mem_fun<session_record,checksum256,&session_record::by_key>>,indexed_by<"bymember"_n,const_mem_fun<session_record,uint64_t,&session_record::by_member>>>;
struct [[eosio::table("guards"), eosio::contract("runtime")]] guardian_record {
 uint64_t dao_id; uint32_t paused_until=0; checksum256 reason;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(guardian_record,(dao_id)(paused_until)(reason))
};
using guardian_states=multi_index<"guards"_n,guardian_record>;
struct [[eosio::table("budgets"), eosio::contract("runtime")]] budget_record {
 uint64_t dao_id; uint32_t day; int64_t committed=0;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(budget_record,(dao_id)(day)(committed))
};
using commitment_budgets=multi_index<"budgets"_n,budget_record>;
inline bool dao_paused(name runtime,uint64_t dao_id){
 guardian_states rows(runtime,runtime.value);auto found=rows.find(dao_id);
 return found!=rows.end()&&found->paused_until>current_time_point().sec_since_epoch();
}
inline void check_agent_authority(name runtime,uint64_t dao_id,uint64_t member_id,bool exit=false){
 participants rows(runtime,dao_id);auto found=rows.find(member_id);
 if(found!=rows.end()&&found->kind==1){check(!found->revoked,"AGENT_REVOKED");if(!exit)check(!dao_paused(runtime,dao_id),"DAO_PAUSED");}
}
inline uint64_t credential_epoch(name runtime,uint64_t dao_id,uint64_t member_id){
 participants rows(runtime,dao_id);auto found=rows.find(member_id);return found==rows.end()?1:found->credential_epoch;
}
}
