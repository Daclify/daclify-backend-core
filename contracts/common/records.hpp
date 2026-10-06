#pragma once
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>
#include <limits>
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
using daos = multi_index<"daos"_n,dao_record>;
struct [[eosio::table("members"), eosio::contract("runtime")]] member_record {
  uint64_t id; name native_account; public_key signing_key; std::string encryption_key; uint8_t custody;
  uint64_t nonce=0; uint64_t credits=0; bool active=true; bool admin=false; bool reviewer=false; int64_t stake=0; int64_t claim=0; uint64_t join_epoch=1;
  uint64_t primary_key() const { return id; }
  uint64_t by_native() const { return native_account.value; }
  checksum256 by_key() const { auto bytes=pack(signing_key); return sha256(bytes.data(),bytes.size()); }
  EOSLIB_SERIALIZE(member_record,(id)(native_account)(signing_key)(encryption_key)(custody)(nonce)(credits)(active)(admin)(reviewer)(stake)(claim)(join_epoch))
};
using members = multi_index<"members"_n,member_record,indexed_by<"bynative"_n,const_mem_fun<member_record,uint64_t,&member_record::by_native>>,indexed_by<"bykey"_n,const_mem_fun<member_record,checksum256,&member_record::by_key>>>;
struct [[eosio::table("profiles"), eosio::contract("runtime")]] profile_record {
  uint64_t id; uint64_t dao_id; uint64_t member_id; name account_name; std::string profile;
  uint64_t primary_key() const { return id; }
  uint128_t by_member() const { return (uint128_t(dao_id)<<64)|member_id; }
  uint64_t by_name() const { return account_name.value; }
  EOSLIB_SERIALIZE(profile_record,(id)(dao_id)(member_id)(account_name)(profile))
};
using profiles = multi_index<"profiles"_n,profile_record,indexed_by<"bymember"_n,const_mem_fun<profile_record,uint128_t,&profile_record::by_member>>,indexed_by<"byname"_n,const_mem_fun<profile_record,uint64_t,&profile_record::by_name>>>;
struct [[eosio::table("modules"), eosio::contract("runtime")]] module_record {
  name account; uint16_t version; std::vector<name> actions; std::vector<name> grants; checksum256 code_hash;
  uint64_t primary_key() const { return account.value; }
  EOSLIB_SERIALIZE(module_record,(account)(version)(actions)(grants)(code_hash))
};
using modules = multi_index<"modules"_n,module_record>;
struct [[eosio::table("obligations"), eosio::contract("runtime")]] obligation_record {
  uint64_t id; name source; uint64_t source_id; uint64_t recipient; asset quantity; uint32_t due; uint8_t status;
  uint64_t primary_key() const { return id; }
  checksum256 by_source() const { auto data=pack(std::make_tuple(source,source_id)); return sha256(data.data(),data.size()); }
  EOSLIB_SERIALIZE(obligation_record,(id)(source)(source_id)(recipient)(quantity)(due)(status))
};
using obligations = multi_index<"obligations"_n,obligation_record,indexed_by<"bysource"_n,const_mem_fun<obligation_record,checksum256,&obligation_record::by_source>>>;
struct [[eosio::table("evidence"), eosio::contract("runtime")]] evidence_record {
  uint64_t id; uint64_t dao_id; uint64_t obligation_id; uint64_t recipient; asset quantity; std::string chain; std::string payer; checksum256 reference; uint8_t mode;
  uint64_t primary_key() const { return id; }
  checksum256 by_reference() const { return reference; }
  EOSLIB_SERIALIZE(evidence_record,(id)(dao_id)(obligation_id)(recipient)(quantity)(chain)(payer)(reference)(mode))
};
using evidence = multi_index<"evidence"_n,evidence_record,indexed_by<"byref"_n,const_mem_fun<evidence_record,checksum256,&evidence_record::by_reference>>>;
struct [[eosio::table("documents"), eosio::contract("runtime")]] document_record {
  uint64_t id; uint64_t document_id; uint32_t version; uint64_t author; std::string cid; std::string metadata;
  checksum256 commitment; uint32_t bytes; uint16_t envelope_version; uint64_t key_epoch;
  uint64_t primary_key() const { return id; }
  uint128_t by_version() const { return (uint128_t(document_id)<<32)|version; }
  EOSLIB_SERIALIZE(document_record,(id)(document_id)(version)(author)(cid)(metadata)(commitment)(bytes)(envelope_version)(key_epoch))
};
using documents = multi_index<"documents"_n,document_record,indexed_by<"byversion"_n,const_mem_fun<document_record,uint128_t,&document_record::by_version>>>;
struct [[eosio::table("epochs"), eosio::contract("runtime")]] epoch_record {
 uint64_t epoch;checksum256 commitment;uint64_t creator;
 uint64_t primary_key()const{return epoch;}
 EOSLIB_SERIALIZE(epoch_record,(epoch)(commitment)(creator))
};
using epochs=multi_index<"epochs"_n,epoch_record>;
struct [[eosio::table("keygrants"), eosio::contract("runtime")]] key_grant_record {
  uint64_t id;uint64_t epoch;uint64_t recipient;uint64_t grantor;std::string envelope;
  uint64_t primary_key()const{return id;}uint128_t by_member()const{return (uint128_t(recipient)<<64)|epoch;}
  EOSLIB_SERIALIZE(key_grant_record,(id)(epoch)(recipient)(grantor)(envelope))
};
using key_grants=multi_index<"keygrants"_n,key_grant_record,indexed_by<"bymember"_n,const_mem_fun<key_grant_record,uint128_t,&key_grant_record::by_member>>>;
struct [[eosio::table("govlocks"), eosio::contract("runtime")]] governance_lock {
 uint64_t id;name source;uint64_t source_id;uint32_t expires;bool active;
 uint64_t primary_key()const{return id;}checksum256 by_source()const{auto value=pack(std::make_tuple(source,source_id));return sha256(value.data(),value.size());}
 EOSLIB_SERIALIZE(governance_lock,(id)(source)(source_id)(expires)(active))
};
using governance_locks=multi_index<"govlocks"_n,governance_lock,indexed_by<"bysource"_n,const_mem_fun<governance_lock,checksum256,&governance_lock::by_source>>>;
struct actor_context { name runtime; uint64_t dao_id; uint64_t member_id; EOSLIB_SERIALIZE(actor_context,(runtime)(dao_id)(member_id)) };
inline uint64_t add64(uint64_t a,uint64_t b) { check(b<=std::numeric_limits<uint64_t>::max()-a,"OVERFLOW"); return a+b; }
inline int64_t add_amount(int64_t a,int64_t b) { auto sum=(__int128)a+b; check(sum>=0&&sum<=asset::max_amount,"AMOUNT_RANGE"); return (int64_t)sum; }
}
