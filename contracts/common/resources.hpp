#pragma once
#include "ram.hpp"
#include <eosio/singleton.hpp>
#include <eosio/crypto.hpp>
#include <eosio/asset.hpp>
namespace daclify {
#ifndef DACLIFY_RAM_PAYER_CONTRACT
#define DACLIFY_RAM_PAYER_CONTRACT "runtime"
#endif
struct [[eosio::table("rampayer"),eosio::contract(DACLIFY_RAM_PAYER_CONTRACT)]] ram_payer_owner {
  eosio::name runtime;
  EOSLIB_SERIALIZE(ram_payer_owner,(runtime))
};
using ram_payer_binding=eosio::singleton<"rampayer"_n,ram_payer_owner>;
inline void check_ram_payer_runtime(eosio::name payer,eosio::name runtime){
  ram_payer_binding binding(payer,payer.value);
  if(binding.exists())eosio::check(binding.get().runtime==runtime,"RAM_PAYER_RUNTIME");
}
struct [[eosio::table("ramreserve"),eosio::contract("runtime")]] ram_operator_reserve {
  eosio::asset available=eosio::asset(0,eosio::symbol("TLOS",4));
  EOSLIB_SERIALIZE(ram_operator_reserve,(available))
};
struct [[eosio::table("ramcards"),eosio::contract("runtime")]] ram_card_receipt {
  uint64_t id,dao_id;eosio::checksum256 reference;uint16_t operational_bps;eosio::name fulfiller;
  uint64_t primary_key()const{return id;}
  EOSLIB_SERIALIZE(ram_card_receipt,(id)(dao_id)(reference)(operational_bps)(fulfiller))
};
struct ram_purchase {
  eosio::name receiver;eosio::asset quantity;uint64_t minimum_bytes;
  EOSLIB_SERIALIZE(ram_purchase,(receiver)(quantity)(minimum_bytes))
};
struct ram_acquisition {
  eosio::name receiver;eosio::asset quantity;uint64_t minimum_bytes,before_bytes,acquired_bytes=0;
  EOSLIB_SERIALIZE(ram_acquisition,(receiver)(quantity)(minimum_bytes)(before_bytes)(acquired_bytes))
};
struct [[eosio::table("ramorders"),eosio::contract("runtime")]] ram_order {
  uint64_t id,dao_id;eosio::checksum256 reference;eosio::name payer,treasury;
  uint64_t policy_revision;uint16_t fee_bps;uint32_t expires;
  eosio::asset maximum,spent,platform_fee,received;std::vector<ram_acquisition> purchases;
  bool funded=false,settled=false;
  uint64_t primary_key()const{return id;}
  eosio::checksum256 by_reference()const{return reference;}
  EOSLIB_SERIALIZE(ram_order,(id)(dao_id)(reference)(payer)(treasury)(policy_revision)(fee_bps)(expires)(maximum)(spent)(platform_fee)(received)(purchases)(funded)(settled))
};
struct [[eosio::table("ramalloc"),eosio::contract("runtime")]] ram_allocation {
  eosio::name payer;uint64_t purchased_bytes=0;
  uint64_t primary_key()const{return payer.value;}
  EOSLIB_SERIALIZE(ram_allocation,(payer)(purchased_bytes))
};
struct [[eosio::table("ramintent"),eosio::contract("runtime")]] ram_payment_intent {
  ram_order order;eosio::checksum256 transaction_id;
  EOSLIB_SERIALIZE(ram_payment_intent,(order)(transaction_id))
};
struct [[eosio::table("resourcecfg"),eosio::contract("runtime")]] resource_policy {
  uint16_t schema_version=1;uint64_t revision=0;
  uint16_t native_ram_bps=500,card_ram_bps=2000;
  uint64_t included_activity_bytes=262144,identity_bytes_per_slot=2048;
  uint32_t quote_lifetime_seconds=300,grace_seconds=2592000;
  uint64_t storage_free_bytes=100000000,storage_unit_bytes=1000000000;
  uint32_t storage_monthly_usd=100;
  EOSLIB_SERIALIZE(resource_policy,(schema_version)(revision)(native_ram_bps)(card_ram_bps)(included_activity_bytes)(identity_bytes_per_slot)(quote_lifetime_seconds)(grace_seconds)(storage_free_bytes)(storage_unit_bytes)(storage_monthly_usd))
};
struct [[eosio::table("ramobs"),eosio::contract("runtime")]] ram_observer_config {
  uint64_t meter_bytes=0;
  eosio::checksum256 runtime_hash;
  EOSLIB_SERIALIZE(ram_observer_config,(meter_bytes)(runtime_hash))
};
using ram_observer_settings=eosio::singleton<"ramobs"_n,ram_observer_config>;
struct [[eosio::table("rammigrate"),eosio::contract("runtime")]] ram_migration_state {
 bool active=true;
 bool globals_complete=false,advanced=false;uint64_t dao_cursor=0;
 EOSLIB_SERIALIZE(ram_migration_state,(active)(globals_complete)(advanced)(dao_cursor))
};
using ram_migration_settings=eosio::singleton<"rammigrate"_n,ram_migration_state>;
inline bool ram_backfill_active(eosio::name runtime){ram_migration_settings rows(runtime,runtime.value);return rows.exists()&&rows.get().active;}
struct [[eosio::table("rammigsrcs"),eosio::contract("runtime")]] ram_migration_source {
 eosio::name account;uint8_t kind;eosio::checksum256 code_hash;
 uint64_t primary_key()const{return account.value;}
 EOSLIB_SERIALIZE(ram_migration_source,(account)(kind)(code_hash))
};
using ram_migration_sources=eosio::multi_index<"rammigsrcs"_n,ram_migration_source>;
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
#ifdef DACLIFY_MODULE_METERING
  if(table=="termholds"_n)return 2;
#endif
  switch(table.value){
    case "members"_n.value:case "actors"_n.value:case "sessions"_n.value:case "evmbindings"_n.value:case "profiles"_n.value:case "epochs"_n.value:case "keygrants"_n.value:return 0;
    case "docsrcs"_n.value:case "docheads"_n.value:case "docclocks"_n.value:case "docstate"_n.value:case "docscan"_n.value:case "ramentitle"_n.value:case "ramholds"_n.value:case "ramclmholds"_n.value:case "ramlimits"_n.value:case "ramgrants"_n.value:case "raminherit"_n.value:case "archives"_n.value:case "archpos"_n.value:case "ramcards"_n.value:case "ramorders"_n.value:case "ramalloc"_n.value:case "receipts"_n.value:case "evidence"_n.value:case "capreceipts"_n.value:case "createords"_n.value:case "obligations"_n.value:case "budgets"_n.value:case "executions"_n.value:case "grantplans"_n.value:case "agreements"_n.value:case "controls"_n.value:case "entries"_n.value:case "schedules"_n.value:case "terms"_n.value:return 2;
    default:return 1;
  }
}
inline void observe_ram(eosio::name runtime,uint64_t dao_id,eosio::name payer,eosio::name table,uint64_t added,uint64_t removed){
  ram_observer_settings config(runtime,runtime.value);if(!config.exists())return;
  eosio::action(eosio::permission_level{payer,"active"_n},runtime,"ramadjust"_n,std::make_tuple(dao_id,payer,ram_category(table,dao_id),added,removed)).send();
}
}
