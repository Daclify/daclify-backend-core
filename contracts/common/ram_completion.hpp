#pragma once
#include "records.hpp"
namespace daclify {
struct [[eosio::table("ramholds"),eosio::contract("runtime")]] ram_completion_hold {
 uint64_t id,recipient;bool ready=false;std::vector<char> padding;
 uint64_t primary_key()const{return id;}
 uint64_t by_recipient()const{return ready?recipient:0;}
 EOSLIB_SERIALIZE(ram_completion_hold,(id)(recipient)(ready)(padding))
};
using ram_hold_index=indexed_by<"byrecipient"_n,const_mem_fun<ram_completion_hold,uint64_t,&ram_completion_hold::by_recipient>>;
using ram_holds=ram_table<"ramholds"_n,ram_completion_hold,ram_hold_index>;
inline void hold_obligation_receipts(name runtime,uint64_t dao,uint64_t obligation,uint64_t recipient){
 if(!ram_observer_settings(runtime,runtime.value).exists())return;
 // Physical padding backs both receipts and the measured reference-token transfer headroom.
 ram_holds rows(runtime,dao);rows.emplace(runtime,[&](auto& r){r.id=obligation;r.recipient=recipient;r.padding.resize(1024);});
 const auto& held=rows.get(obligation);auto claim=held;claim.ready=true;claim.padding.resize(512);
 finance_receipt receipt{};
 check(ram_row_bytes<ram_completion_hold,ram_hold_index>(held)>=ram_row_bytes<ram_completion_hold,ram_hold_index>(claim)+ram_row_bytes(receipt)+ram_scope_bytes<>(),"RAM_COMPLETION_RECIPE");
 check(ram_row_bytes<ram_completion_hold,ram_hold_index>(claim)>=ram_row_bytes(receipt)+ram_scope_bytes<>()+368,"RAM_COMPLETION_RECIPE");
}
inline void settle_receipt_hold(name runtime,uint64_t dao,uint64_t obligation,bool claim){
 ram_holds rows(runtime,dao);auto found=rows.find(obligation);if(found==rows.end())return;
 check(!found->ready,"RAM_HOLD_STATE");
 if(claim)rows.modify(found,same_payer,[](auto& r){r.ready=true;r.padding.resize(512);});else rows.erase(found);
}
inline void consume_claim_hold(name runtime,uint64_t dao,uint64_t recipient){
 ram_holds rows(runtime,dao);auto index=rows.get_index<"byrecipient"_n>();auto found=index.find(recipient);
 uint32_t released=0;while(found!=index.end()&&found->ready&&found->recipient==recipient&&released++<25)found=index.erase(found);
}
}
