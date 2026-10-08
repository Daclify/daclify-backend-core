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
struct archive_chunk_descriptor {
  archive_domain domain;eosio::checksum256 root;std::string cid;uint32_t bytes;eosio::checksum256 commitment;uint64_t first_key,last_key;
  EOSLIB_SERIALIZE(archive_chunk_descriptor,(domain)(root)(cid)(bytes)(commitment)(first_key)(last_key))
};
struct archive_family_descriptor {
  std::string kind;uint64_t parent_id;eosio::name table;uint64_t scope;eosio::checksum256 schema_hash;uint64_t records;std::vector<archive_chunk_descriptor> chunks;
  EOSLIB_SERIALIZE(archive_family_descriptor,(kind)(parent_id)(table)(scope)(schema_hash)(records)(chunks))
};
struct archive_file_reference {
  uint64_t document_id;uint32_t version;std::string cid;uint64_t bytes;eosio::checksum256 commitment;uint8_t envelope_version;uint64_t key_epoch;
  EOSLIB_SERIALIZE(archive_file_reference,(document_id)(version)(cid)(bytes)(commitment)(envelope_version)(key_epoch))
};
struct archive_manifest_descriptor {
  uint16_t format_version=1;eosio::checksum256 chain_id;eosio::name runtime;uint64_t dao_id;eosio::name source;eosio::checksum256 code_hash,abi_hash;
  uint32_t block_number;eosio::checksum256 block_id;std::string timestamp;std::vector<archive_family_descriptor> families;std::vector<archive_file_reference> files;
  EOSLIB_SERIALIZE(archive_manifest_descriptor,(format_version)(chain_id)(runtime)(dao_id)(source)(code_hash)(abi_hash)(block_number)(block_id)(timestamp)(families)(files))
};
// This commitment is not source eligibility, irreversible-state proof or pruning authority.
inline eosio::checksum256 archive_descriptor_hash(const archive_manifest_descriptor& value){
  eosio::check(value.format_version==1&&value.dao_id&&value.runtime.value&&value.source.value&&value.block_number&&value.families.size()>0&&value.families.size()<=64&&value.files.size()<=65536,"ARCHIVE_MANIFEST_BOUNDS");
  uint32_t chunks=0;for(const auto& family:value.families){eosio::check(family.chunks.size()<=1024,"ARCHIVE_CHUNK_COUNT");chunks+=family.chunks.size();}eosio::check(chunks<=1024,"ARCHIVE_CHUNK_COUNT");
  auto bytes=eosio::pack(value);eosio::check(bytes.size()<=archive_max_chunk_bytes,"ARCHIVE_MANIFEST_SIZE");return eosio::sha256(bytes.data(),bytes.size());
}
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
