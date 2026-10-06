#pragma once
#include "records.hpp"
namespace daclify {
struct [[eosio::table("createcfg"), eosio::contract("runtime")]] creation_policy {
 uint32_t shared_usd=2000;uint32_t independent_usd=5000;uint16_t premium_bps=2000;name settler;
 uint64_t median=0;uint8_t precision=0;uint32_t observed_at=0;
 EOSLIB_SERIALIZE(creation_policy,(shared_usd)(independent_usd)(premium_bps)(settler)(median)(precision)(observed_at))
};
using creation_settings=singleton<"createcfg"_n,creation_policy>;
struct [[eosio::table("createords"), eosio::contract("runtime")]] creation_order {
 uint64_t id;checksum256 reference;public_key creator;uint8_t deployment;uint8_t method;uint32_t usd_cents;asset tlos_due;uint32_t created_at;uint32_t expires;bool paid=false;bool used=false;uint64_t dao_id=0;checksum256 card_reference;
 uint64_t primary_key()const{return id;}checksum256 by_ref()const{return reference;}checksum256 by_card()const{return card_reference;}
 EOSLIB_SERIALIZE(creation_order,(id)(reference)(creator)(deployment)(method)(usd_cents)(tlos_due)(created_at)(expires)(paid)(used)(dao_id)(card_reference))
};
using creation_orders=multi_index<"createords"_n,creation_order,indexed_by<"byref"_n,const_mem_fun<creation_order,checksum256,&creation_order::by_ref>>,indexed_by<"bycard"_n,const_mem_fun<creation_order,checksum256,&creation_order::by_card>>>;
}
