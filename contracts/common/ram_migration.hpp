#pragma once
#include "resources.hpp"
namespace daclify {
struct [[eosio::table("ramcursors"),eosio::contract(DACLIFY_RAM_PAYER_CONTRACT)]] ram_migration_cursor {
 eosio::name table;uint64_t cursor=0;bool advanced=false,complete=false;
 uint64_t primary_key()const{return table.value;}
 EOSLIB_SERIALIZE(ram_migration_cursor,(table)(cursor)(advanced)(complete))
};
using ram_migration_cursors=eosio::multi_index<"ramcursors"_n,ram_migration_cursor>;
struct [[eosio::table("ramoverlays"),eosio::contract(DACLIFY_RAM_PAYER_CONTRACT)]] ram_migration_overlay {
 uint64_t id;eosio::name table;uint64_t row;
 uint64_t primary_key()const{return id;}
 uint128_t by_row()const{return (uint128_t(table.value)<<64)|row;}
 EOSLIB_SERIALIZE(ram_migration_overlay,(id)(table)(row))
};
using ram_overlay_index=eosio::indexed_by<"byrow"_n,eosio::const_mem_fun<ram_migration_overlay,uint128_t,&ram_migration_overlay::by_row>>;
using ram_migration_overlays=eosio::multi_index<"ramoverlays"_n,ram_migration_overlay,ram_overlay_index>;
inline ram_migration_cursor migration_cursor(eosio::name runtime,eosio::name payer,uint64_t scope,eosio::name table,bool empty,uint64_t header_dao,uint64_t header_bytes){
 ram_migration_cursors rows(payer,scope);auto found=rows.find(table.value);if(found!=rows.end())return *found;
 const bool first=rows.begin()==rows.end();ram_migration_cursor value;value.table=table;value.complete=empty;
 rows.emplace(payer,[&](auto& r){r=value;});observe_ram(runtime,0,payer,"ramcursors"_n,ram_row_bytes(value)+(first?ram_scope_bytes<>():0),0);
 if(!empty)observe_ram(runtime,header_dao,payer,table,header_bytes,0);return value;
}
inline bool migration_overlay_exists(eosio::name payer,uint64_t scope,eosio::name table,uint64_t row){
 ram_migration_overlays rows(payer,scope);auto index=rows.get_index<"byrow"_n>();return index.find((uint128_t(table.value)<<64)|row)!=index.end();
}
inline void migration_mark(eosio::name runtime,eosio::name payer,uint64_t scope,eosio::name table,uint64_t row){
 ram_migration_overlays rows(payer,scope);auto index=rows.get_index<"byrow"_n>();eosio::check(index.find((uint128_t(table.value)<<64)|row)==index.end(),"RAM_MIGRATION_OVERLAY");
 const bool first=rows.begin()==rows.end();auto id=rows.available_primary_key();eosio::check(id<std::numeric_limits<uint64_t>::max(),"RAM_MIGRATION_LIMIT");ram_migration_overlay value{id,table,row};rows.emplace(payer,[&](auto& r){r=value;});
 observe_ram(runtime,0,payer,"ramoverlays"_n,ram_row_bytes<ram_migration_overlay,ram_overlay_index>(value)+(first?ram_scope_bytes<ram_overlay_index>():0),0);
}
inline void migration_unmark(eosio::name runtime,eosio::name payer,uint64_t scope,eosio::name table,uint64_t row){
 ram_migration_overlays rows(payer,scope);auto index=rows.get_index<"byrow"_n>();auto found=index.find((uint128_t(table.value)<<64)|row);if(found==index.end())return;
 const auto bytes=ram_row_bytes<ram_migration_overlay,ram_overlay_index>(*found);index.erase(found);observe_ram(runtime,0,payer,"ramoverlays"_n,0,bytes+(rows.begin()==rows.end()?ram_scope_bytes<ram_overlay_index>():0));
}
inline void migration_capture(eosio::name runtime,eosio::name payer,uint64_t scope,const ram_migration_cursor& cursor,uint64_t primary,uint64_t dao,uint64_t bytes){
 if(cursor.complete||(cursor.advanced&&primary<=cursor.cursor)||migration_overlay_exists(payer,scope,cursor.table,primary))return;
 observe_ram(runtime,dao,payer,cursor.table,bytes,0);migration_mark(runtime,payer,scope,cursor.table,primary);
}
template<typename Table,typename Owner,typename Size>
void migration_scan(eosio::name runtime,eosio::name payer,uint64_t scope,eosio::name table,Table& rows,uint64_t header_dao,uint64_t header_bytes,uint32_t limit,Owner owner,Size size){
 eosio::check(limit>=1&&limit<=25,"RAM_MIGRATION_BATCH");auto progress=migration_cursor(runtime,payer,scope,table,rows.begin()==rows.end(),header_dao,header_bytes);if(progress.complete)return;
 auto it=progress.advanced?rows.upper_bound(progress.cursor):rows.begin();uint32_t count=0;
 for(;it!=rows.end()&&count<limit;++it,++count){auto key=it->primary_key();if(migration_overlay_exists(payer,scope,table,key))migration_unmark(runtime,payer,scope,table,key);else observe_ram(runtime,owner(*it),payer,table,size(*it),0);progress.cursor=key;progress.advanced=true;}
 progress.complete=it==rows.end();ram_migration_cursors cursors(payer,scope);cursors.modify(cursors.get(table.value),eosio::same_payer,[&](auto& r){r=progress;});
}
}
