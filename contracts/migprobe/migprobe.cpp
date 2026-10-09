#define DACLIFY_RAM_PAYER_CONTRACT "migprobe"
#include "ram_migration.hpp"
#include "ram_table.hpp"
using namespace eosio;
using namespace daclify;
// Disposable migration calibration fixture; not a production maintenance interface.
CONTRACT migprobe:public contract {
public:
 using contract::contract;
 TABLE sample {uint64_t id,dao_id;std::string payload;uint64_t primary_key()const{return id;}EOSLIB_SERIALIZE(sample,(id)(dao_id)(payload))};
 using samples=multi_index<"samples"_n,sample>;
 using protected_rows=ram_table<"actors"_n,sample>;
 using ordinary_rows=ram_table<"profiles"_n,sample>;
 struct config_value {uint64_t fixed=0;std::string label;EOSLIB_SERIALIZE(config_value,(fixed)(label))};
 using probe_config=ram_singleton<"probeconfig"_n,config_value>;
 TABLE total {uint64_t dao_id,bytes=0;uint64_t primary_key()const{return dao_id;}EOSLIB_SERIALIZE(total,(dao_id)(bytes))};
 using totals=multi_index<"totals"_n,total>;
 ACTION seed(uint64_t id,uint64_t dao_id,std::string payload){require_auth(get_self());check(!ram_observer_settings(get_self(),get_self().value).exists(),"MIGRATION_STARTED");samples rows(get_self(),get_self().value);rows.emplace(get_self(),[&](auto& r){r={id,dao_id,payload};});}
 ACTION begin(){require_auth(get_self());ram_observer_settings rows(get_self(),get_self().value);check(!rows.exists(),"MIGRATION_STARTED");rows.set(ram_observer_config{},get_self());}
 ACTION ramadjust(uint64_t dao_id,name payer,uint8_t category,uint64_t added,uint64_t removed){
  check(get_sender()==get_self()&&payer==get_self(),"RAM_SOURCE_SENDER");require_auth(get_self());totals rows(get_self(),get_self().value);auto found=rows.find(dao_id);total value{dao_id,0};if(found!=rows.end())value=*found;check(removed<=value.bytes&&added<=std::numeric_limits<uint64_t>::max()-(value.bytes-removed),"RAM_COUNTER_RANGE");value.bytes=value.bytes-removed+added;
  if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r=value;});else rows.modify(found,same_payer,[&](auto& r){r=value;});
 }
 ACTION backfill(uint32_t limit){require_auth(get_self());samples rows(get_self(),get_self().value);migration_scan(get_self(),get_self(),get_self().value,"samples"_n,rows,0,ram_scope_bytes<>(),limit,[](const auto& r){return r.dao_id;},[](const auto& r){return ram_row_bytes(r);});}
 ACTION edit(uint64_t id,std::string payload){require_auth(get_self());samples rows(get_self(),get_self().value);const auto& old=rows.get(id);auto progress=migration_cursor(get_self(),get_self(),get_self().value,"samples"_n,false,0,ram_scope_bytes<>());migration_capture(get_self(),get_self(),get_self().value,progress,id,old.dao_id,ram_row_bytes(old));auto before=ram_row_bytes(old),dao=old.dao_id;rows.modify(old,same_payer,[&](auto& r){r.payload=payload;});auto after=ram_row_bytes(rows.get(id));observe_ram(get_self(),dao,get_self(),"samples"_n,after>before?after-before:0,before>after?before-after:0);}
 ACTION remove(uint64_t id){require_auth(get_self());samples rows(get_self(),get_self().value);const auto& old=rows.get(id);auto progress=migration_cursor(get_self(),get_self(),get_self().value,"samples"_n,false,0,ram_scope_bytes<>());migration_capture(get_self(),get_self(),get_self().value,progress,id,old.dao_id,ram_row_bytes(old));auto dao=old.dao_id,bytes=ram_row_bytes(old);rows.erase(old);observe_ram(get_self(),dao,get_self(),"samples"_n,0,bytes);if(rows.begin()==rows.end())observe_ram(get_self(),0,get_self(),"samples"_n,0,ram_scope_bytes<>());migration_unmark(get_self(),get_self(),get_self().value,"samples"_n,id);}
 ACTION wseed(){
  require_auth(get_self());check(!ram_observer_settings(get_self(),get_self().value).exists(),"MIGRATION_STARTED");
  protected_rows rows(get_self(),1);rows.emplace(get_self(),[](auto& r){r={0,1,"old"};});rows.emplace(get_self(),[](auto& r){r={7,1,"middle"};});
  ordinary_rows ordinary(get_self(),get_self().value);ordinary.emplace(get_self(),[](auto& r){r={1,1,"ordinary"};});
  probe_config config(get_self(),get_self().value);config.set(config_value{0,"old-label"},get_self());
 }
 ACTION wbegin(){require_auth(get_self());ram_migration_settings(get_self(),get_self().value).set(ram_migration_state{},get_self());begin();}
 ACTION wedit(uint64_t id,std::string label){require_auth(get_self());protected_rows rows(get_self(),1);rows.modify(rows.get(id),same_payer,[&](auto& r){r.payload=label;});}
 ACTION wnew(uint64_t id){require_auth(get_self());protected_rows rows(get_self(),1);rows.emplace(get_self(),[&](auto& r){r={id,1,"new-protected"};});}
 ACTION wremove(uint64_t id){require_auth(get_self());protected_rows rows(get_self(),1);rows.erase(rows.find(id));}
 ACTION wordinary(uint8_t kind){require_auth(get_self());ordinary_rows rows(get_self(),get_self().value);if(kind==0)rows.emplace(get_self(),[](auto& r){r={2,1,"new"};});else if(kind==1)rows.modify(rows.get(1),same_payer,[](auto& r){r.payload="ordinary growth";});else rows.erase(rows.find(1));}
 ACTION wbackfill(uint32_t limit){require_auth(get_self());protected_rows(get_self(),1).backfill(limit);}
 ACTION wconfig(std::string label){require_auth(get_self());probe_config config(get_self(),get_self().value);auto value=config.get();value.label=label;config.set(value,same_payer);}
 ACTION wcfgfill(){require_auth(get_self());probe_config(get_self(),get_self().value).backfill(1);}
 ACTION wotherfill(){require_auth(get_self());ordinary_rows(get_self(),get_self().value).backfill(25);}
};
EOSIO_DISPATCH(migprobe,(seed)(begin)(ramadjust)(backfill)(edit)(remove)(wseed)(wbegin)(wedit)(wnew)(wremove)(wordinary)(wbackfill)(wconfig)(wcfgfill)(wotherfill))
