#pragma once
#include "archive.hpp"
#include "ram_table.hpp"
namespace daclify {
constexpr uint32_t archive_min_retention=90*86400;
constexpr uint32_t archive_availability_lifetime=900;
constexpr uint32_t archive_anchor_max_chunks=32;
struct [[eosio::table("archcfg"),eosio::contract("runtime")]] archive_policy {
  eosio::name verifier;uint32_t minimum_retention_seconds=archive_min_retention;bool pruning_enabled=false;
  EOSLIB_SERIALIZE(archive_policy,(verifier)(minimum_retention_seconds)(pruning_enabled))
};
using archive_settings=ram_singleton<"archcfg"_n,archive_policy>;
struct [[eosio::table("archives"),eosio::contract("runtime")]] archive_anchor {
  uint64_t id,dao_id;archive_manifest_descriptor manifest;std::string manifest_cid;uint32_t manifest_bytes;
  eosio::checksum256 manifest_commitment,descriptor_commitment,backup_commitment;eosio::name verifier;
  eosio::checksum256 attestation_transaction,approval_transaction;
  uint32_t retention_seconds,attested_at;uint64_t approved_by=0;uint32_t approved_at=0;bool revoked=false;
  uint64_t primary_key()const{return id;}
  eosio::checksum256 by_manifest()const{return manifest_commitment;}
  EOSLIB_SERIALIZE(archive_anchor,(id)(dao_id)(manifest)(manifest_cid)(manifest_bytes)(manifest_commitment)(descriptor_commitment)(backup_commitment)(verifier)(attestation_transaction)(approval_transaction)(retention_seconds)(attested_at)(approved_by)(approved_at)(revoked))
};
using archive_anchors=ram_table<"archives"_n,archive_anchor,eosio::indexed_by<"bymanifest"_n,eosio::const_mem_fun<archive_anchor,eosio::checksum256,&archive_anchor::by_manifest>>>;
struct [[eosio::table("archpos"),eosio::contract("runtime")]] archive_position {
  uint64_t id,dao_id,archive_id;uint32_t chunk_ordinal,pruned=0;
  uint64_t primary_key()const{return id;}
  EOSLIB_SERIALIZE(archive_position,(id)(dao_id)(archive_id)(chunk_ordinal)(pruned))
};
using archive_positions=ram_table<"archpos"_n,archive_position>;
}
