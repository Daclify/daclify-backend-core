#pragma once
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
namespace daclify {
// Same binary layout as eosio::newaccount authority. The names contract sends that action.
struct key_weight {
  eosio::public_key key;
  uint16_t weight;
  EOSLIB_SERIALIZE(key_weight, (key)(weight))
};
struct permission_level_weight {
  eosio::permission_level permission;
  uint16_t weight;
  EOSLIB_SERIALIZE(permission_level_weight, (permission)(weight))
};
struct wait_weight {
  uint32_t wait_sec;
  uint16_t weight;
  EOSLIB_SERIALIZE(wait_weight, (wait_sec)(weight))
};
struct authority {
  uint32_t threshold;
  std::vector<key_weight> keys;
  std::vector<permission_level_weight> accounts;
  std::vector<wait_weight> waits;
  EOSLIB_SERIALIZE(authority, (threshold)(keys)(accounts)(waits))
};
}