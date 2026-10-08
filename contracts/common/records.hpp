#pragma once
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>
#include <limits>
#include "ram_table.hpp"
using namespace eosio;
namespace daclify {
struct instruction {
  uint16_t version;
  checksum256 chain_id;
  name deployment;
  uint64_t dao_id;
  uint64_t member_id;
  uint64_t nonce;
  uint32_t expires;
  name target;
  name action;
  std::vector<char> data;
  EOSLIB_SERIALIZE(instruction,(version)(chain_id)(deployment)(dao_id)(member_id)(nonce)(expires)(target)(action)(data))
};
struct [[eosio::table("daos"), eosio::contract("runtime")]] dao_record {
  uint64_t id; name owner; std::string metadata; uint8_t privacy;
  name token_contract; symbol token_symbol;
  uint64_t credit_supply=0; uint64_t member_count=0; uint64_t max_member=0;
  uint32_t active_ballots=0; int64_t available=0; int64_t reserved=0; int64_t claims=0; int64_t staked=0;
  uint64_t eligible_credits=0; int64_t eligible_stake=0; uint32_t admin_count=0; uint64_t key_epoch=1; uint8_t history_policy=0;
  uint64_t primary_key() const { return id; }
  EOSLIB_SERIALIZE(dao_record,(id)(owner)(metadata)(privacy)(token_contract)(token_symbol)(credit_supply)(member_count)(max_member)(active_ballots)(available)(reserved)(claims)(staked)(eligible_credits)(eligible_stake)(admin_count)(key_epoch)(history_policy))
};
using daos = ram_table<"daos"_n,dao_record>;
struct [[eosio::table("members"), eosio::contract("runtime")]] member_record {
  uint64_t id; name native_account; public_key signing_key; std::string encryption_key; uint8_t custody;
  uint64_t nonce=0; uint64_t credits=0; bool active=true; bool admin=false; bool reviewer=false; int64_t stake=0; int64_t claim=0; uint64_t join_epoch=1;
  uint64_t primary_key() const { return id; }
  uint64_t by_native() const { return native_account.value; }
  checksum256 by_key() const { auto bytes=pack(signing_key); return sha256(bytes.data(),bytes.size()); }
  EOSLIB_SERIALIZE(member_record,(id)(native_account)(signing_key)(encryption_key)(custody)(nonce)(credits)(active)(admin)(reviewer)(stake)(claim)(join_epoch))
};
using members = ram_table<"members"_n,member_record,indexed_by<"bynative"_n,const_mem_fun<member_record,uint64_t,&member_record::by_native>>,indexed_by<"bykey"_n,const_mem_fun<member_record,checksum256,&member_record::by_key>>>;
struct [[eosio::table("evmbindings"), eosio::contract("runtime")]] evm_binding_record {
  uint64_t member_id;uint64_t chain_id;checksum160 address;uint64_t epoch=1;bool active=true;
  uint64_t primary_key()const{return member_id;}
  checksum256 by_wallet()const{if(!active)return checksum256{};const auto value=pack(std::make_tuple(chain_id,address));return sha256(value.data(),value.size());}
  EOSLIB_SERIALIZE(evm_binding_record,(member_id)(chain_id)(address)(epoch)(active))
};
using evm_bindings=ram_table<"evmbindings"_n,evm_binding_record,indexed_by<"bywallet"_n,const_mem_fun<evm_binding_record,checksum256,&evm_binding_record::by_wallet>>>;
struct [[eosio::table("profiles"), eosio::contract("runtime")]] profile_record {
  uint64_t id; uint64_t dao_id; uint64_t member_id; name account_name; std::string profile;
  uint64_t primary_key() const { return id; }
  uint128_t by_member() const { return (uint128_t(dao_id)<<64)|member_id; }
  uint64_t by_name() const { return account_name.value; }
  EOSLIB_SERIALIZE(profile_record,(id)(dao_id)(member_id)(account_name)(profile))
};
using profiles = ram_table<"profiles"_n,profile_record,indexed_by<"bymember"_n,const_mem_fun<profile_record,uint128_t,&profile_record::by_member>>,indexed_by<"byname"_n,const_mem_fun<profile_record,uint64_t,&profile_record::by_name>>>;
struct [[eosio::table("modules"), eosio::contract("runtime")]] module_record {
  name account; uint16_t version; std::vector<name> actions; std::vector<name> grants; checksum256 code_hash;
  uint64_t primary_key() const { return account.value; }
  EOSLIB_SERIALIZE(module_record,(account)(version)(actions)(grants)(code_hash))
};
using modules = ram_table<"modules"_n,module_record>;
struct [[eosio::table("obligations"), eosio::contract("runtime")]] obligation_record {
  uint64_t id; name source; uint64_t source_id; uint64_t recipient; asset quantity; uint32_t due; uint8_t status;
  uint64_t primary_key() const { return id; }
  checksum256 by_source() const { auto data=pack(std::make_tuple(source,source_id)); return sha256(data.data(),data.size()); }
  EOSLIB_SERIALIZE(obligation_record,(id)(source)(source_id)(recipient)(quantity)(due)(status))
};
using obligations = ram_table<"obligations"_n,obligation_record,indexed_by<"bysource"_n,const_mem_fun<obligation_record,checksum256,&obligation_record::by_source>>>;
struct [[eosio::table("receipts"), eosio::contract("runtime")]] finance_receipt {
 uint64_t id;uint8_t kind;uint64_t obligation_id;uint64_t recipient;name destination;name token_contract;asset quantity;uint32_t at;checksum256 transaction_id;
 uint64_t primary_key()const{return id;}
 EOSLIB_SERIALIZE(finance_receipt,(id)(kind)(obligation_id)(recipient)(destination)(token_contract)(quantity)(at)(transaction_id))
};
using finance_receipts=ram_table<"receipts"_n,finance_receipt>;
struct [[eosio::table("evidence"), eosio::contract("runtime")]] evidence_record {
  uint64_t id; uint64_t dao_id; uint64_t obligation_id; uint64_t recipient; asset quantity; std::string chain; std::string payer; checksum256 reference; uint8_t mode;
  uint64_t primary_key() const { return id; }
  checksum256 by_reference() const { return reference; }
  EOSLIB_SERIALIZE(evidence_record,(id)(dao_id)(obligation_id)(recipient)(quantity)(chain)(payer)(reference)(mode))
};
using evidence = ram_table<"evidence"_n,evidence_record,indexed_by<"byref"_n,const_mem_fun<evidence_record,checksum256,&evidence_record::by_reference>>>;
struct [[eosio::table("documents"), eosio::contract("runtime")]] document_record {
  uint64_t id; uint64_t document_id; uint32_t version; uint64_t author; std::string cid; std::string metadata;
  checksum256 commitment; uint32_t bytes; uint16_t envelope_version; uint64_t key_epoch;
  uint64_t primary_key() const { return id; }
  uint128_t by_version() const { return (uint128_t(document_id)<<32)|version; }
  EOSLIB_SERIALIZE(document_record,(id)(document_id)(version)(author)(cid)(metadata)(commitment)(bytes)(envelope_version)(key_epoch))
};
using documents = ram_table<"documents"_n,document_record,indexed_by<"byversion"_n,const_mem_fun<document_record,uint128_t,&document_record::by_version>>>;
struct [[eosio::table("epochs"), eosio::contract("runtime")]] epoch_record {
 uint64_t epoch;checksum256 commitment;uint64_t creator;
 uint64_t primary_key()const{return epoch;}
 EOSLIB_SERIALIZE(epoch_record,(epoch)(commitment)(creator))
};
using epochs=ram_table<"epochs"_n,epoch_record>;
struct [[eosio::table("keygrants"), eosio::contract("runtime")]] key_grant_record {
  uint64_t id;uint64_t epoch;uint64_t recipient;uint64_t grantor;std::string envelope;
  uint64_t primary_key()const{return id;}uint128_t by_member()const{return (uint128_t(recipient)<<64)|epoch;}
  EOSLIB_SERIALIZE(key_grant_record,(id)(epoch)(recipient)(grantor)(envelope))
};
using key_grants=ram_table<"keygrants"_n,key_grant_record,indexed_by<"bymember"_n,const_mem_fun<key_grant_record,uint128_t,&key_grant_record::by_member>>>;
struct [[eosio::table("govlocks"), eosio::contract("runtime")]] governance_lock {
 uint64_t id;name source;uint64_t source_id;uint32_t expires;bool active;
 uint64_t primary_key()const{return id;}checksum256 by_source()const{auto value=pack(std::make_tuple(source,source_id));return sha256(value.data(),value.size());}
 EOSLIB_SERIALIZE(governance_lock,(id)(source)(source_id)(expires)(active))
};
using governance_locks=ram_table<"govlocks"_n,governance_lock,indexed_by<"bysource"_n,const_mem_fun<governance_lock,checksum256,&governance_lock::by_source>>>;
struct [[eosio::table("feecfg"), eosio::contract("runtime")]] fee_config {
  uint16_t third_party_bps; uint16_t first_party_bps; name treasury; name token_contract; symbol token_symbol; name names;
  EOSLIB_SERIALIZE(fee_config,(third_party_bps)(first_party_bps)(treasury)(token_contract)(token_symbol)(names))
};
using fee_settings=ram_singleton<"feecfg"_n,fee_config>;
// Connect commission is separate from native module purchase revenue.
struct [[eosio::table("paycfg"), eosio::contract("runtime")]] payment_policy {
  uint16_t bps=500; uint64_t revision=0;
  EOSLIB_SERIALIZE(payment_policy,(bps)(revision))
};
using payment_settings=ram_singleton<"paycfg"_n,payment_policy>;
struct [[eosio::table("catalogue"), eosio::contract("runtime")]] catalogue_record {
  name account; name publisher; uint8_t party; uint8_t complies; asset price; checksum256 code_hash; std::string title;
  uint64_t primary_key() const { return account.value; }
  EOSLIB_SERIALIZE(catalogue_record,(account)(publisher)(party)(complies)(price)(code_hash)(title))
};
using catalogue=ram_table<"catalogue"_n,catalogue_record>;
struct [[eosio::table("modpays"), eosio::contract("runtime")]] modpay_record {
  uint64_t id; name modaccount; name payer; name publisher; asset gross; asset platform_fee; asset publisher_share; uint8_t party; uint16_t bps;
  uint64_t primary_key() const { return id; }
  EOSLIB_SERIALIZE(modpay_record,(id)(modaccount)(payer)(publisher)(gross)(platform_fee)(publisher_share)(party)(bps))
};
using modpays=ram_table<"modpays"_n,modpay_record>;
// Copy lives beside the catalogue so an existing catalogue row stays readable.
struct [[eosio::table("modcopy"), eosio::contract("runtime")]] modcopy_record {
  name account; std::string summary; std::string detail;
  uint64_t primary_key() const { return account.value; }
  EOSLIB_SERIALIZE(modcopy_record,(account)(summary)(detail))
};
using modcopy=ram_table<"modcopy"_n,modcopy_record>;
// Rates the governing DAO can change without rewriting feecfg.
struct [[eosio::table("mktcfg"), eosio::contract("runtime")]] market_policy {
  uint16_t bump_bps; uint16_t quote_premium_bps; uint64_t dao_id;
  EOSLIB_SERIALIZE(market_policy,(bump_bps)(quote_premium_bps)(dao_id))
};
using market_settings=ram_singleton<"mktcfg"_n,market_policy>;
struct actor_context { name runtime; uint64_t dao_id; uint64_t member_id; EOSLIB_SERIALIZE(actor_context,(runtime)(dao_id)(member_id)) };
inline uint64_t add64(uint64_t a,uint64_t b) { check(b<=std::numeric_limits<uint64_t>::max()-a,"OVERFLOW"); return a+b; }
inline int64_t add_amount(int64_t a,int64_t b) { auto sum=(__int128)a+b; check(sum>=0&&sum<=asset::max_amount,"AMOUNT_RANGE"); return (int64_t)sum; }
}
