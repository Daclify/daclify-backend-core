#pragma once
#include "governance.hpp"
namespace daclify {
struct [[eosio::table("admpolicies"),eosio::contract("runtime")]] admission_policy {
 uint64_t dao_id;uint64_t revision=1;uint8_t mode=0;name source;uint8_t threshold=1;bool allow_agents=false;bool admin_override=false;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(admission_policy,(dao_id)(revision)(mode)(source)(threshold)(allow_agents)(admin_override))
};
using admission_policies=multi_index<"admpolicies"_n,admission_policy>;
struct [[eosio::table("joinapps"),eosio::contract("endorse")]] admission_application {
 uint64_t id;uint64_t dao_id;uint64_t sponsor;uint64_t revision=1;uint64_t policy_revision;public_key signing_key;std::string encryption_key;uint8_t custody;uint8_t kind;std::string operator_label;uint64_t document_id;uint32_t document_version;checksum256 document_commitment;uint32_t expires;std::vector<uint64_t> witnesses;bool admitted=false;uint64_t member_id=0;
 uint64_t primary_key()const{return id;}uint64_t by_dao()const{return dao_id;}
 EOSLIB_SERIALIZE(admission_application,(id)(dao_id)(sponsor)(revision)(policy_revision)(signing_key)(encryption_key)(custody)(kind)(operator_label)(document_id)(document_version)(document_commitment)(expires)(witnesses)(admitted)(member_id))
};
using admission_applications=multi_index<"joinapps"_n,admission_application,indexed_by<"bydao"_n,const_mem_fun<admission_application,uint64_t,&admission_application::by_dao>>>;
inline bool eligible_witness(name runtime,uint64_t dao_id,uint64_t member_id,bool agents){
 members people(runtime,dao_id);auto person=people.find(member_id);if(person==people.end()||!person->active)return false;
 participants actors(runtime,dao_id);auto actor=actors.find(member_id);return actor==actors.end()||(!actor->revoked&&(agents||actor->kind==0));
}
}
