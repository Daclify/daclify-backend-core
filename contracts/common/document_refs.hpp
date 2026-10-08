#pragma once
#include "records.hpp"
namespace daclify {
struct [[eosio::table("docrefs"),eosio::contract("runtime")]] document_reference {
 uint64_t id;name source,table;uint64_t source_id;uint8_t slot;uint64_t document_id;uint32_t version;
 uint64_t primary_key()const{return id;}
 checksum256 by_source()const{auto data=pack(std::make_tuple(source,table,source_id,slot));return sha256(data.data(),data.size());}
 uint128_t by_version()const{return(uint128_t(document_id)<<32)|version;}
 EOSLIB_SERIALIZE(document_reference,(id)(source)(table)(source_id)(slot)(document_id)(version))
};
using document_references=ram_table<"docrefs"_n,document_reference,indexed_by<"bysource"_n,const_mem_fun<document_reference,checksum256,&document_reference::by_source>>,indexed_by<"byversion"_n,const_mem_fun<document_reference,uint128_t,&document_reference::by_version>>>;
struct [[eosio::table("docheads"),eosio::contract("runtime")]] document_head {
 uint64_t document_id;uint32_t version;uint64_t author;
 uint64_t primary_key()const{return document_id;}
 EOSLIB_SERIALIZE(document_head,(document_id)(version)(author))
};
using document_heads=ram_table<"docheads"_n,document_head>;
struct [[eosio::table("docclocks"),eosio::contract("runtime")]] document_clock {
 uint64_t id,document_id;uint32_t version,created_at;bool legacy;checksum256 row_hash;
 uint64_t primary_key()const{return id;}
 EOSLIB_SERIALIZE(document_clock,(id)(document_id)(version)(created_at)(legacy)(row_hash))
};
using document_clocks=ram_table<"docclocks"_n,document_clock>;
struct [[eosio::table("docstate"),eosio::contract("runtime")]] document_state {
 uint64_t id=0,high_water=0,cursor=0;bool complete=false;
 uint64_t primary_key()const{return id;}
 EOSLIB_SERIALIZE(document_state,(id)(high_water)(cursor)(complete))
};
using document_states=ram_table<"docstate"_n,document_state>;
struct [[eosio::table("docscan"),eosio::contract("runtime")]] document_scan {
 uint64_t id;name source,table;checksum256 code_hash;uint64_t cursor=0;bool complete=false;
 uint64_t primary_key()const{return id;}
 checksum256 by_source()const{auto data=pack(std::make_tuple(source,table));return sha256(data.data(),data.size());}
 EOSLIB_SERIALIZE(document_scan,(id)(source)(table)(code_hash)(cursor)(complete))
};
using document_scans=ram_table<"docscan"_n,document_scan,indexed_by<"bysource"_n,const_mem_fun<document_scan,checksum256,&document_scan::by_source>>>;
struct [[eosio::table("docsrcs"),eosio::contract("runtime")]] document_source {
 name source;checksum256 code_hash;std::vector<name> tables;
 uint64_t primary_key()const{return source.value;}
 EOSLIB_SERIALIZE(document_source,(source)(code_hash)(tables))
};
using document_sources=ram_table<"docsrcs"_n,document_source>;
inline checksum256 document_row_hash(const document_record& row){auto data=pack(row);return sha256(data.data(),data.size());}
}
