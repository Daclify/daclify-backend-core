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
struct archive_prune_proof {
  uint64_t primary_key;std::vector<eosio::checksum256> siblings;
  EOSLIB_SERIALIZE(archive_prune_proof,(primary_key)(siblings))
};
inline archive_anchor approved_archive(eosio::name runtime,uint64_t dao_id,uint64_t id,eosio::name source){
  const auto policy=archive_settings(runtime,runtime.value).get();eosio::check(policy.pruning_enabled,"ARCHIVE_PRUNING_DISABLED");
  const auto anchor=archive_anchors(runtime,dao_id).get(id,"ARCHIVE_ANCHOR_UNKNOWN");
  eosio::check(anchor.dao_id==dao_id&&anchor.manifest.runtime==runtime&&anchor.manifest.dao_id==dao_id&&anchor.manifest.source==source,"ARCHIVE_DOMAIN");
  eosio::check(anchor.approved_by&&!anchor.revoked,"ARCHIVE_APPROVAL");
  members people(runtime,dao_id);const auto& approver=people.get(anchor.approved_by,"ARCHIVE_APPROVER_UNKNOWN");eosio::check(approver.active&&approver.admin,"ARCHIVE_APPROVAL");
  eosio::check(anchor.verifier==policy.verifier,"ARCHIVE_VERIFIER_CHANGED");const uint32_t now=eosio::current_time_point().sec_since_epoch();
  eosio::check(anchor.attested_at<=now&&uint64_t(now)-anchor.attested_at<=archive_availability_lifetime,"ARCHIVE_AVAILABILITY_EXPIRED");
  eosio::check(anchor.manifest.code_hash==get_code_hash(source),"ARCHIVE_SOURCE_CODE");
  ram_observer_settings observer(runtime,runtime.value);eosio::check(observer.exists()&&observer.get().runtime_hash==get_code_hash(runtime),"RAM_OBSERVER_REQUIRED");
  ram_sources sources(runtime,runtime.value);eosio::check(sources.get(source.value,"RAM_SOURCE_UNKNOWN").code_hash==anchor.manifest.code_hash,"RAM_SOURCE_CODE");
  return anchor;
}
}
