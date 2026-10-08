#pragma once
#include "ram.hpp"
#include <eosio/singleton.hpp>
#include <eosio/crypto.hpp>
namespace daclify {
struct [[eosio::table("ramobs"),eosio::contract("runtime")]] ram_observer_config {
  uint64_t meter_bytes=0;
  eosio::checksum256 runtime_hash;
  EOSLIB_SERIALIZE(ram_observer_config,(meter_bytes)(runtime_hash))
};
using ram_observer_settings=eosio::singleton<"ramobs"_n,ram_observer_config>;
struct [[eosio::table("ramsources"),eosio::contract("runtime")]] ram_source {
  eosio::name account;eosio::checksum256 code_hash;
  uint64_t primary_key()const{return account.value;}
  EOSLIB_SERIALIZE(ram_source,(account)(code_hash))
};
using ram_sources=eosio::multi_index<"ramsources"_n,ram_source>;
struct [[eosio::table("ramstats"),eosio::contract("runtime")]] ram_counter {
  eosio::name payer;uint64_t identity=0;uint64_t activity=0;uint64_t retained=0;uint64_t platform=0;
  uint64_t primary_key()const{return payer.value;}
  EOSLIB_SERIALIZE(ram_counter,(payer)(identity)(activity)(retained)(platform))
};
using ram_counters=eosio::multi_index<"ramstats"_n,ram_counter>;
inline uint8_t ram_category(eosio::name table,uint64_t dao_id){
  if(!dao_id)return 3;
  switch(table.value){
    case "members"_n.value:case "actors"_n.value:case "sessions"_n.value:case "evmbindings"_n.value:case "profiles"_n.value:case "epochs"_n.value:case "keygrants"_n.value:return 0;
    case "receipts"_n.value:case "evidence"_n.value:case "capreceipts"_n.value:case "createords"_n.value:case "obligations"_n.value:case "budgets"_n.value:case "executions"_n.value:case "grantplans"_n.value:case "agreements"_n.value:case "controls"_n.value:case "entries"_n.value:case "schedules"_n.value:case "terms"_n.value:return 2;
    default:return 1;
  }
}
inline void observe_ram(eosio::name runtime,uint64_t dao_id,eosio::name payer,eosio::name table,uint64_t added,uint64_t removed){
  ram_observer_settings config(runtime,runtime.value);if(!config.exists())return;
  eosio::action(eosio::permission_level{payer,"active"_n},runtime,"ramadjust"_n,std::make_tuple(dao_id,payer,ram_category(table,dao_id),added,removed)).send();
}
}
