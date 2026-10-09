#pragma once
#include "governance.hpp"
namespace daclify {
struct [[eosio::table("execpols"),eosio::contract("runtime")]] executive_policy {
 uint64_t dao_id; uint32_t inactivity_seconds=2592000; uint16_t quorum_bps=10000; uint64_t revision=1;uint32_t last_election_start=0;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(executive_policy,(dao_id)(inactivity_seconds)(quorum_bps)(revision)(last_election_start))
};
using executive_policies=ram_table<"execpols"_n,executive_policy>;
struct [[eosio::table("executives"),eosio::contract("runtime")]] executive_record {
 uint64_t member_id;uint32_t last_active;uint64_t office_epoch;uint64_t election_id=0;
 uint64_t primary_key()const{return member_id;}
 EOSLIB_SERIALIZE(executive_record,(member_id)(last_active)(office_epoch)(election_id))
};
using executives=ram_table<"executives"_n,executive_record>;
struct [[eosio::table("nonvoters"),eosio::contract("runtime")]] excluded_voter {
 uint64_t member_id;uint64_t primary_key()const{return member_id;}
 EOSLIB_SERIALIZE(excluded_voter,(member_id))
};
using nonvoters=ram_table<"nonvoters"_n,excluded_voter>;
struct [[eosio::table("nativegov"),eosio::contract("runtime")]] native_governance {
 uint64_t dao_id;std::vector<name> contracts;public_key service_key;bool handed_over=false;std::vector<name> signers;uint32_t threshold=0;std::vector<uint64_t> admin_members;
 EOSLIB_SERIALIZE(native_governance,(dao_id)(contracts)(service_key)(handed_over)(signers)(threshold)(admin_members))
};
using native_governance_settings=ram_singleton<"nativegov"_n,native_governance>;
struct [[eosio::table("execpending"),eosio::contract("runtime")]] executive_handover {
 uint64_t dao_id;uint64_t election_id;uint32_t starts;uint32_t ends;std::vector<uint64_t> members;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(executive_handover,(dao_id)(election_id)(starts)(ends)(members))
};
using executive_handovers=ram_table<"execpending"_n,executive_handover>;
inline bool can_vote(name runtime,uint64_t dao_id,uint64_t member_id){nonvoters rows(runtime,dao_id);return rows.find(member_id)==rows.end();}
inline uint64_t voting_denominator(name runtime,uint64_t dao_id,uint8_t kind){
 daos communities(runtime,runtime.value);const auto& d=communities.get(dao_id);uint64_t total=kind==0?d.member_count:kind==1?d.eligible_credits:uint64_t(d.eligible_stake);
 nonvoters excluded(runtime,dao_id);members people(runtime,dao_id);for(const auto& r:excluded){const auto& m=people.get(r.member_id);if(m.active){auto weight=kind==0?1:kind==1?m.credits:uint64_t(m.stake);check(total>=weight,"VOTER_WEIGHT");total-=weight;}}return total;
}
inline bool executive_active(const executive_record& r,const executive_policy& p){auto now=current_time_point().sec_since_epoch();return r.last_active<=now&&(p.inactivity_seconds==0||uint64_t(now)-r.last_active<p.inactivity_seconds);}
struct native_permission_weight {permission_level permission;uint16_t weight;EOSLIB_SERIALIZE(native_permission_weight,(permission)(weight))};
struct native_key_weight {public_key key;uint16_t weight;EOSLIB_SERIALIZE(native_key_weight,(key)(weight))};
struct native_wait_weight {uint32_t wait_sec;uint16_t weight;EOSLIB_SERIALIZE(native_wait_weight,(wait_sec)(weight))};
struct native_authority {uint32_t threshold;std::vector<native_key_weight> keys;std::vector<native_permission_weight> accounts;std::vector<native_wait_weight> waits;EOSLIB_SERIALIZE(native_authority,(threshold)(keys)(accounts)(waits))};
inline native_authority delegated_authority(std::vector<permission_level> permissions,uint32_t threshold=1){
 std::sort(permissions.begin(),permissions.end(),[](const auto& a,const auto& b){return a.actor!=b.actor?a.actor<b.actor:a.permission<b.permission;});native_authority result{threshold,{},{},{}};for(const auto& p:permissions)result.accounts.push_back({p,1});return result;
}
}
