#pragma once
#include <eosio/eosio.hpp>
#include <eosio/serialize.hpp>
#include <limits>
namespace daclify {
// Spring 1.2.2 billable_size_v rounds database object overhead up to 16 bytes.
constexpr uint64_t ram_layout_version=1;
constexpr uint64_t ram_primary_overhead=112;
constexpr uint64_t ram_table_overhead=112;
constexpr uint64_t ram_index_overhead(uint32_t key_bytes){return ((24+key_bytes+96+15)/16)*16;}
template<typename Row,typename... Indices>
uint64_t ram_row_bytes(const Row& row){
  const uint64_t bytes=eosio::pack_size(row);
  constexpr uint64_t overhead=ram_primary_overhead+(uint64_t(0)+...+ram_index_overhead(sizeof(typename Indices::secondary_extractor_type::result_type)));
  eosio::check(bytes<=std::numeric_limits<uint64_t>::max()-overhead,"RAM_SIZE_OVERFLOW");
  return bytes+overhead;
}
template<typename... Indices>
constexpr uint64_t ram_scope_bytes(){return ram_table_overhead*(sizeof...(Indices)>0?sizeof...(Indices):1);}
}
