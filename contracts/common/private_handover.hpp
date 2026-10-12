#pragma once
#include "dao_lifecycle.hpp"
#include "governance.hpp"
namespace daclify {
// One bounded preparation per DAO; expiry or consumption reclaims its row. No secondary index.
struct [[eosio::table("handovers"),eosio::contract("runtime")]] private_handover_record {
 uint64_t dao_id;uint64_t initiator;uint64_t departing;uint64_t successor;
 uint64_t departing_credentials;uint64_t successor_credentials;checksum256 successor_key;
 uint64_t key_epoch;uint8_t history_policy;uint64_t last_epoch;uint64_t cursor=0;
 bool complete=false;bool accepted=false;uint32_t expires;
 uint64_t primary_key()const{return dao_id;}
 uint64_t ram_owner(name,uint64_t)const{return dao_id;}
 EOSLIB_SERIALIZE(private_handover_record,(dao_id)(initiator)(departing)(successor)(departing_credentials)(successor_credentials)(successor_key)(key_epoch)(history_policy)(last_epoch)(cursor)(complete)(accepted)(expires))
};
using private_handovers=ram_table<"handovers"_n,private_handover_record>;
inline checksum256 private_handover_commitment(checksum256 chain,name runtime,const private_handover_record& h){
 const auto bytes=pack(std::make_tuple(std::string("daclify.private-handover.v1"),chain,runtime,h.dao_id,h.initiator,h.departing,h.successor,h.departing_credentials,h.successor_credentials,h.successor_key,h.key_epoch,h.history_policy,h.last_epoch,h.expires));
 return sha256(bytes.data(),bytes.size());
}
inline bool private_handover_current(name runtime,const private_handover_record& h){
 if(dao_lifecycle(runtime,h.dao_id)==2)return false;
 daos communities(runtime,runtime.value);const auto d=communities.find(h.dao_id);if(d==communities.end()||!d->privacy||d->key_epoch!=h.key_epoch||d->history_policy!=h.history_policy)return false;
 members people(runtime,h.dao_id);const auto from=people.find(h.departing),to=people.find(h.successor);
 if(from==people.end()||to==people.end()||!from->active||!from->admin||!to->active||!to->admin)return false;
 if(credential_epoch(runtime,h.dao_id,h.departing)!=h.departing_credentials||credential_epoch(runtime,h.dao_id,h.successor)!=h.successor_credentials)return false;
 if(sha256(to->encryption_key.data(),to->encryption_key.size())!=h.successor_key)return false;
 epochs recorded(runtime,h.dao_id);if(recorded.begin()==recorded.end())return false;auto last=recorded.end();--last;return last->epoch==h.last_epoch;
}
inline void consume_private_handover(name runtime,uint64_t dao_id,uint64_t departing){
 daos communities(runtime,runtime.value);const auto& d=communities.get(dao_id);
 if(!d.privacy||dao_lifecycle(runtime,dao_id)==2)return;
 members people(runtime,dao_id);const auto& member=people.get(departing);if(!member.active||!member.admin)return;
 private_handovers rows(runtime,runtime.value);auto h=rows.find(dao_id);check(h!=rows.end()&&h->departing==departing,"PRIVATE_HANDOVER_REQUIRED");
 check(h->expires>current_time_point().sec_since_epoch(),"PRIVATE_HANDOVER_EXPIRED");check(private_handover_current(runtime,*h),"PRIVATE_HANDOVER_STALE");
 check(h->complete&&h->accepted,"PRIVATE_HANDOVER_REQUIRED");rows.erase(h);
}
}
