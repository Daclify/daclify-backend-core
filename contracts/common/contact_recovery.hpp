#pragma once
#include "records.hpp"
namespace daclify {
constexpr uint32_t contact_recovery_wait=172800;
struct recovery_contact {
 public_key signing_key; std::string encryption_key;
 EOSLIB_SERIALIZE(recovery_contact,(signing_key)(encryption_key))
};
struct contact_proof {
 name action;checksum256 chain_id;name runtime;uint64_t dao_id;uint64_t member_id;uint64_t revision;uint64_t request_id;uint8_t contact;checksum256 data_hash;uint32_t expires;
 EOSLIB_SERIALIZE(contact_proof,(action)(chain_id)(runtime)(dao_id)(member_id)(revision)(request_id)(contact)(data_hash)(expires))
};
struct contact_request {
 name action;checksum256 chain_id;name runtime;uint64_t dao_id;uint64_t member_id;uint64_t revision;uint64_t request_id;public_key signing_key;std::string encryption_key;name native_account;uint32_t expires;
 EOSLIB_SERIALIZE(contact_request,(action)(chain_id)(runtime)(dao_id)(member_id)(revision)(request_id)(signing_key)(encryption_key)(native_account)(expires))
};
// One policy/tombstone per membership retains counters after request cleanup; no secondary index.
struct [[eosio::table("reccontacts"),eosio::contract("runtime")]] contact_policy {
 uint64_t member_id;uint64_t revision=1;uint64_t next_request=0;public_key owner_key;std::vector<recovery_contact> contacts;uint8_t accepted=0;bool documents=false;
 uint64_t primary_key()const{return member_id;}
 EOSLIB_SERIALIZE(contact_policy,(member_id)(revision)(next_request)(owner_key)(contacts)(accepted)(documents))
};
using contact_policies=ram_table<"reccontacts"_n,contact_policy>;
// A single pending request per member bounds unsolicited state and permits O(1) expiry cleanup.
struct [[eosio::table("recrequests"),eosio::contract("runtime")]] contact_pending {
 uint64_t member_id;contact_request request;public_key old_signing_key;uint8_t approvals=0;uint32_t execute_after=0;
 uint64_t primary_key()const{return member_id;}
 EOSLIB_SERIALIZE(contact_pending,(member_id)(request)(old_signing_key)(approvals)(execute_after))
};
using contact_requests=ram_table<"recrequests"_n,contact_pending>;
// Durable completion/current-control evidence also records the future-grant privacy boundary.
struct [[eosio::table("recresults"),eosio::contract("runtime")]] contact_result {
 uint64_t member_id;contact_request request;public_key old_signing_key;uint32_t completed;uint64_t document_epoch;bool documents_approved=false;bool future_grants=false;uint64_t identity_id=0;
 uint64_t primary_key()const{return member_id;}
 EOSLIB_SERIALIZE(contact_result,(member_id)(request)(old_signing_key)(completed)(document_epoch)(documents_approved)(future_grants)(identity_id))
};
using contact_results=ram_table<"recresults"_n,contact_result>;
struct [[eosio::table("recdocpols"),eosio::contract("runtime")]] contact_document_policy {
 uint64_t dao_id;bool allowed=false;uint64_t revision=1;uint64_t next_packet=0;
 uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(contact_document_policy,(dao_id)(allowed)(revision)(next_packet))
};
using contact_document_policies=ram_table<"recdocpols"_n,contact_document_policy>;
// Opaque authenticated ciphertext, capped at 16 KiB; one index supports bounded member paging.
struct [[eosio::table("recdocpkts"),eosio::contract("runtime")]] contact_document_packet {
 uint64_t id;uint64_t member_id;uint64_t revision;std::string packet;checksum256 commitment;uint8_t acknowledged=0;
 uint64_t primary_key()const{return id;}uint128_t by_member()const{return (uint128_t(member_id)<<64)|id;}
 EOSLIB_SERIALIZE(contact_document_packet,(id)(member_id)(revision)(packet)(commitment)(acknowledged))
};
using contact_document_packets=ram_table<"recdocpkts"_n,contact_document_packet,indexed_by<"bymember"_n,const_mem_fun<contact_document_packet,uint128_t,&contact_document_packet::by_member>>>;
// Preserve original grants; the context index permits one bounded lookup for an epoch/generation.
struct [[eosio::table("recgrants"),eosio::contract("runtime")]] contact_epoch_grant {
 uint64_t id;uint64_t member_id;uint64_t request_id;uint64_t epoch;std::string envelope;
 uint64_t primary_key()const{return id;}
 checksum256 by_context()const{const auto bytes=pack(std::make_tuple(member_id,request_id,epoch));return sha256(bytes.data(),bytes.size());}
 EOSLIB_SERIALIZE(contact_epoch_grant,(id)(member_id)(request_id)(epoch)(envelope))
};
using contact_epoch_grants=ram_table<"recgrants"_n,contact_epoch_grant,indexed_by<"bycontext"_n,const_mem_fun<contact_epoch_grant,checksum256,&contact_epoch_grant::by_context>>>;
// Permanent retired signing keys stop stale service databases reviving old account control.
struct [[eosio::table("recretired"),eosio::contract("runtime")]] retired_contact_key {
 uint64_t id;uint64_t dao_id;public_key signing_key;uint64_t identity_id;
 uint64_t primary_key()const{return id;}
 checksum256 by_key()const{auto bytes=pack(signing_key);return sha256(bytes.data(),bytes.size());}
 EOSLIB_SERIALIZE(retired_contact_key,(id)(dao_id)(signing_key)(identity_id))
};
using retired_contact_keys=ram_table<"recretired"_n,retired_contact_key,indexed_by<"bykey"_n,const_mem_fun<retired_contact_key,checksum256,&retired_contact_key::by_key>>>;
// One stable service identity per recovered key family; its index finds a current key in O(1).
struct [[eosio::table("recroots"),eosio::contract("runtime")]] contact_root {
 uint64_t id;uint64_t dao_id;public_key signing_key;public_key origin_key;
 uint64_t primary_key()const{return id;}
 checksum256 by_key()const{auto bytes=pack(signing_key);return sha256(bytes.data(),bytes.size());}
 EOSLIB_SERIALIZE(contact_root,(id)(dao_id)(signing_key)(origin_key))
};
using contact_roots=ram_table<"recroots"_n,contact_root,indexed_by<"bykey"_n,const_mem_fun<contact_root,checksum256,&contact_root::by_key>>>;
inline bool contact_key_retired(name runtime,const public_key& key){retired_contact_keys rows(runtime,runtime.value);auto index=rows.get_index<"bykey"_n>();auto bytes=pack(key);return index.find(sha256(bytes.data(),bytes.size()))!=index.end();}
inline bool contact_documents_allowed(name runtime,uint64_t dao_id){contact_document_policies rows(runtime,runtime.value);auto p=rows.find(dao_id);return p!=rows.end()&&p->allowed;}
inline bool contact_grant_allowed(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t epoch){
 contact_results rows(runtime,dao_id);auto r=rows.find(member_id);if(r==rows.end())return true;
 if(contact_documents_allowed(runtime,dao_id)&&r->documents_approved)return true;
 return r->future_grants&&epoch>r->document_epoch;
}
}
