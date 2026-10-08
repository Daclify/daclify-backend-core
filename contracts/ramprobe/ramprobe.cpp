#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>
#include <eosio/privileged.hpp>
#include "ram.hpp"
using namespace eosio;
// Disposable calibration fixture; excluded from production deployment manifests.
CONTRACT ramprobe : public contract {
public:
  using contract::contract;
  TABLE sample {
    uint64_t id; uint64_t value; std::vector<char> payload;
    uint64_t primary_key()const{return id;}
    uint64_t key64()const{return value;}
    uint128_t key128()const{return (uint128_t(value)<<64)|id;}
    checksum256 key256()const{auto bytes=pack(value);return sha256(bytes.data(),bytes.size());}
    EOSLIB_SERIALIZE(sample,(id)(value)(payload))
  };
  using samples=multi_index<"samples"_n,sample,
    indexed_by<"byvalue"_n,const_mem_fun<sample,uint64_t,&sample::key64>>,
    indexed_by<"bywide"_n,const_mem_fun<sample,uint128_t,&sample::key128>>,
    indexed_by<"byhash"_n,const_mem_fun<sample,checksum256,&sample::key256>>>;
  TABLE foreign_row {uint64_t id;uint64_t primary_key()const{return id;}EOSLIB_SERIALIZE(foreign_row,(id))};
  using foreign_rows=multi_index<"foreignrows"_n,foreign_row>;
  ACTION put(uint64_t id,uint64_t value,std::vector<char> payload){
    require_auth(get_self());check(payload.size()<=4096,"PROBE_BOUND");samples rows(get_self(),get_self().value);auto it=rows.find(id);
    if(it==rows.end())rows.emplace(get_self(),[&](auto& r){r.id=id;r.value=value;r.payload=payload;});
    else rows.modify(it,same_payer,[&](auto& r){r.value=value;r.payload=payload;});
  }
  ACTION remove(uint64_t id,bool secondary){
    require_auth(get_self());samples rows(get_self(),get_self().value);
    if(secondary){auto index=rows.get_index<"byhash"_n>();index.erase(index.iterator_to(rows.get(id)));}
    else rows.erase(rows.find(id));
  }
  ACTION foreign(name payer,uint64_t id){require_auth(get_self());require_auth(payer);foreign_rows rows(get_self(),get_self().value);rows.emplace(payer,[&](auto& r){r.id=id;});}
  ACTION foreignrm(uint64_t id){require_auth(get_self());foreign_rows rows(get_self(),get_self().value);rows.erase(rows.find(id));}
  ACTION checkquota(name account,int64_t expected){require_auth(get_self());int64_t ram,net,cpu;get_resource_limits(account,ram,net,cpu);check(ram==expected,"RAM_QUOTA_READER");}
  ACTION checkcost(uint64_t id,uint64_t expected,uint64_t headers){require_auth(get_self());samples rows(get_self(),get_self().value);const auto& r=rows.get(id);using i64=indexed_by<"byvalue"_n,const_mem_fun<sample,uint64_t,&sample::key64>>;using i128=indexed_by<"bywide"_n,const_mem_fun<sample,uint128_t,&sample::key128>>;using i256=indexed_by<"byhash"_n,const_mem_fun<sample,checksum256,&sample::key256>>;check(daclify::ram_row_bytes<sample,i64,i128,i256>(r)==expected,"RAM_ROW_RECIPE");check(daclify::ram_scope_bytes<i64,i128,i256>()==headers,"RAM_SCOPE_RECIPE");}
};
EOSIO_DISPATCH(ramprobe,(put)(remove)(foreign)(foreignrm)(checkquota)(checkcost))
