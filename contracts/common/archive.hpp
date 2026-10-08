#pragma once
#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>
#include <eosio/serialize.hpp>
namespace daclify {
constexpr uint32_t archive_max_leaves=65536;
constexpr uint32_t archive_max_chunk_bytes=5*1024*1024;
struct archive_domain {
  uint16_t format_version=1;eosio::checksum256 chain_id;eosio::name runtime;uint64_t dao_id;
  eosio::name source;eosio::checksum256 code_hash;eosio::checksum256 abi_hash;eosio::checksum256 schema_hash;
  eosio::name table;uint64_t scope;uint32_t chunk_ordinal;uint32_t leaf_count;
  EOSLIB_SERIALIZE(archive_domain,(format_version)(chain_id)(runtime)(dao_id)(source)(code_hash)(abi_hash)(schema_hash)(table)(scope)(chunk_ordinal)(leaf_count))
};
inline eosio::checksum256 archive_domain_hash(const archive_domain& domain){
  eosio::check(domain.format_version==1&&domain.leaf_count>0&&domain.leaf_count<=archive_max_leaves&&domain.dao_id>0&&domain.runtime.value&&domain.source.value&&domain.table.value&&domain.table.to_string().size()<=12,"ARCHIVE_DOMAIN");
  auto bytes=eosio::pack(domain);return eosio::sha256(bytes.data(),bytes.size());
}
inline eosio::checksum256 archive_leaf(const archive_domain& domain,uint32_t index,uint64_t primary,const std::vector<char>& row){
  eosio::check(index<domain.leaf_count,"ARCHIVE_PROOF_INDEX");eosio::check(row.size()<=archive_max_chunk_bytes,"ARCHIVE_ROW_SIZE");auto digest=archive_domain_hash(domain);
  auto bytes=eosio::pack(std::make_tuple(uint8_t(0),digest,index,primary,row));return eosio::sha256(bytes.data(),bytes.size());
}
inline eosio::checksum256 archive_parent(const eosio::checksum256& left,const eosio::checksum256& right){
  auto bytes=eosio::pack(std::make_tuple(uint8_t(1),left,right));return eosio::sha256(bytes.data(),bytes.size());
}
inline bool verify_archive_proof(const archive_domain& domain,uint32_t index,uint64_t primary,const std::vector<char>& row,const std::vector<eosio::checksum256>& proof,const eosio::checksum256& root){
  auto current=archive_leaf(domain,index,primary,row);uint32_t depth=0;for(auto width=domain.leaf_count;width>1;width=(width+1)/2)++depth;eosio::check(proof.size()==depth&&depth<=16,"ARCHIVE_PROOF_DEPTH");
  auto width=domain.leaf_count;auto cursor=index;
  for(const auto& sibling:proof){eosio::check(!(width%2&&cursor==width-1)||sibling==current,"ARCHIVE_PROOF_DUPLICATE");current=cursor%2?archive_parent(sibling,current):archive_parent(current,sibling);cursor/=2;width=(width+1)/2;}
  return current==root;
}
}
