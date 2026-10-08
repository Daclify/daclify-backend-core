#pragma once
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/binary_extension.hpp>
#include <limits>
namespace daclify {
// Qualified against the pinned public system WASM on the owned Spring fixture.
inline eosio::checksum256 qualified_telos_system_hash(){return eosio::checksum256(std::array<uint8_t,32>{0x48,0xd7,0x4c,0x3d,0xf9,0xf5,0xc9,0x95,0x2c,0x0f,0x87,0xab,0x6c,0x01,0xe1,0xc6,0xdf,0xe6,0x21,0x42,0x9f,0x59,0x93,0x2e,0xcf,0x60,0x9b,0x5d,0x81,0xe6,0x68,0xe4});}
struct telos_user_resources {
  eosio::name owner;eosio::asset net_weight;eosio::asset cpu_weight;int64_t ram_bytes;
  uint64_t primary_key()const{return owner.value;}
  EOSLIB_SERIALIZE(telos_user_resources,(owner)(net_weight)(cpu_weight)(ram_bytes))
};
struct telos_voter_info {
  eosio::name owner;eosio::name proxy;std::vector<eosio::name> producers;int64_t staked;int64_t last_stake;
  double last_vote_weight;double proxied_vote_weight;bool is_proxy;uint32_t flags1;uint32_t reserved2;eosio::asset reserved3;eosio::binary_extension<uint64_t> self_stake_boost;
  uint64_t primary_key()const{return owner.value;}
  EOSLIB_SERIALIZE(telos_voter_info,(owner)(proxy)(producers)(staked)(last_stake)(last_vote_weight)(proxied_vote_weight)(is_proxy)(flags1)(reserved2)(reserved3)(self_stake_boost))
};
inline uint64_t telos_unmanaged_ram(eosio::name owner){
  const auto system="eosio"_n;eosio::check(eosio::get_code_hash(system)==qualified_telos_system_hash(),"RAM_SYSTEM_CODE");
  eosio::multi_index<"voters"_n,telos_voter_info> voters(system,system.value);auto voter=voters.find(owner.value);eosio::check(voter==voters.end()||!(voter->flags1&1),"RAM_MANAGED_ACCOUNT");
  eosio::multi_index<"userres"_n,telos_user_resources> resources(system,owner.value);const auto& value=resources.get(owner.value,"RAM_RESOURCE_UNKNOWN");
  constexpr int64_t gift=1400;eosio::check(value.ram_bytes>=0&&value.ram_bytes<=std::numeric_limits<int64_t>::max()-gift,"RAM_RESOURCE_RANGE");return uint64_t(value.ram_bytes+gift);
}
}
