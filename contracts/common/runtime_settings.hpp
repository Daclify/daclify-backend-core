#pragma once
#include "records.hpp"
namespace daclify {
struct [[eosio::table("settings"),eosio::contract("runtime")]] runtime_settings {
 checksum256 chain_id;uint16_t interface_version=1;
 EOSLIB_SERIALIZE(runtime_settings,(chain_id)(interface_version))
};
using runtime_settings_table=ram_singleton<"settings"_n,runtime_settings>;
}
