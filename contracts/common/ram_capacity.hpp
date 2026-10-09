#pragma once
#include "records.hpp"
#include "telos_resources.hpp"
namespace daclify {
struct [[eosio::table("rampools"),eosio::contract("runtime")]] ram_payer_pool {
 name payer;uint64_t quota_bytes,baseline_bytes,platform_headroom;checksum256 source_hash;
 uint64_t primary_key()const{return payer.value;}
 EOSLIB_SERIALIZE(ram_payer_pool,(payer)(quota_bytes)(baseline_bytes)(platform_headroom)(source_hash))
};
using ram_pools=ram_table<"rampools"_n,ram_payer_pool>;
struct [[eosio::table("ramlimits"),eosio::contract("runtime")]] ram_dao_limit {
 name payer;uint64_t activity=0,identity=0,completion=0;
 uint64_t primary_key()const{return payer.value;}
 EOSLIB_SERIALIZE(ram_dao_limit,(payer)(activity)(identity)(completion))
};
using ram_limits=ram_table<"ramlimits"_n,ram_dao_limit>;
struct [[eosio::table("ramgrants"),eosio::contract("runtime")]] ram_grant_receipt {
 uint64_t id,dao_id;name payer;uint64_t reference,activity,identity,completion;
 uint64_t primary_key()const{return id;}
 checksum256 by_reference()const{auto value=pack(std::make_tuple(payer,reference));return sha256(value.data(),value.size());}
 EOSLIB_SERIALIZE(ram_grant_receipt,(id)(dao_id)(payer)(reference)(activity)(identity)(completion))
};
using ram_grants=ram_table<"ramgrants"_n,ram_grant_receipt,indexed_by<"byreference"_n,const_mem_fun<ram_grant_receipt,checksum256,&ram_grant_receipt::by_reference>>>;
struct ram_offer {
 name payer;uint64_t activity,completion;
 EOSLIB_SERIALIZE(ram_offer,(payer)(activity)(completion))
};
struct [[eosio::table("ramauto"),eosio::contract("runtime")]] ram_auto_policy {
 bool enabled=false;uint64_t policy_revision=0;std::vector<ram_offer> offers;
 EOSLIB_SERIALIZE(ram_auto_policy,(enabled)(policy_revision)(offers))
};
using ram_auto_settings=ram_singleton<"ramauto"_n,ram_auto_policy>;
struct [[eosio::table("ramentitle"),eosio::contract("runtime")]] ram_entitlement {
 name payer;uint64_t policy_revision,identity_per_slot;uint32_t slots;
 uint64_t primary_key()const{return payer.value;}
 EOSLIB_SERIALIZE(ram_entitlement,(payer)(policy_revision)(identity_per_slot)(slots))
};
using ram_entitlements=ram_table<"ramentitle"_n,ram_entitlement>;
struct [[eosio::table("raminherit"),eosio::contract("runtime")]] ram_inherited_capacity {
 name payer;uint64_t activity,identity,completion,activity_headroom,identity_headroom,completion_headroom;
 uint64_t primary_key()const{return payer.value;}
 EOSLIB_SERIALIZE(ram_inherited_capacity,(payer)(activity)(identity)(completion)(activity_headroom)(identity_headroom)(completion_headroom))
};
using ram_inherited=ram_table<"raminherit"_n,ram_inherited_capacity>;
inline uint64_t ram_used(const ram_counter& row){return add64(add64(row.identity,row.activity),add64(row.retained,row.platform));}
inline uint64_t ram_limit_bytes(const ram_dao_limit& value){return add64(add64(value.activity,value.identity),value.completion);}
inline uint64_t committed_ram(name runtime,name payer,uint64_t target_dao=0,uint64_t extra=0){
 uint64_t total=0,count=0;daos communities(runtime,runtime.value);
 for(const auto& dao:communities){check(++count<=5000,"RAM_POOL_SCAN_LIMIT");ram_counters used(runtime,dao.id);auto u=used.find(payer.value);ram_limits limits(runtime,dao.id);auto limit=limits.find(payer.value);
  ram_table<"ramalloc"_n,ram_allocation> bought(runtime,dao.id);auto purchase=bought.find(payer.value);uint64_t allocated=limit==limits.end()?0:ram_limit_bytes(*limit);if(purchase!=bought.end())allocated=add64(allocated,purchase->purchased_bytes);if(dao.id==target_dao)allocated=add64(allocated,extra);
  total=add64(total,std::max(allocated,u==used.end()?uint64_t(0):ram_used(*u)));
 }
 ram_counters shared(runtime,0);auto platform=shared.find(payer.value);if(platform!=shared.end())total=add64(total,ram_used(*platform));
 if(payer==runtime)total=add64(total,ram_observer_settings(runtime,runtime.value).get().meter_bytes);return total;
}
inline void check_ram_pool(name runtime,const ram_payer_pool& pool,uint64_t target_dao=0,uint64_t extra=0){
 if(pool.payer!=runtime){ram_payer_binding binding(pool.payer,pool.payer.value);check(binding.exists()&&binding.get().runtime==runtime,"RAM_PAYER_RUNTIME");}
 check(pool.source_hash==get_code_hash(pool.payer),"RAM_SOURCE_CODE");const auto quota=telos_unmanaged_ram(pool.payer);
 check(quota>=pool.quota_bytes&&pool.baseline_bytes<=quota&&pool.platform_headroom<=quota-pool.baseline_bytes,"RAM_POOL_BACKING");
 check(committed_ram(runtime,pool.payer,target_dao,extra)<=quota-pool.baseline_bytes-pool.platform_headroom,"RAM_POOL_EXHAUSTED");
}
}
