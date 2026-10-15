#define DACLIFY_MODULE_METERING
#define DACLIFY_RAM_PAYER_CONTRACT "quickauth"
#include "authorization.hpp"
#include "ram_families.hpp"
using namespace eosio;
using namespace daclify;
CONTRACT quickauth:public contract{
public:
 using contract::contract;
 ACTION qconfig(name runtime,name source,checksum256 code_hash,permission_level gateway,uint32_t maximum){configure_quick(get_self(),runtime,source,code_hash,gateway,maximum);}
 ACTION qregister(quick_registration request,std::vector<char> proof){register_quick_account(get_self(),request.runtime,request,proof);}
 ACTION qdefault(quick_default request,std::vector<char> proof,std::vector<char> incoming){set_quick_default(get_self(),request.control.runtime,request,proof,incoming);}
 ACTION qsubmit(quick_instruction request,std::vector<char> proof){submit_quick(get_self(),request.control.runtime,request,proof);}
 ACTION qdeactivate(quick_control request,std::vector<char> proof){deactivate_quick(get_self(),request.runtime,request,proof);}
 ACTION qprune(name runtime,std::vector<uint64_t> ids){prune_quick_accounts(get_self(),runtime,ids);}
 ACTION checkmig(name runtime,uint8_t kind){require_auth(runtime);check_ram_payer_runtime(get_self(),runtime);check(kind==8,"RAM_MIGRATION_SOURCE_KIND");}
 ACTION scanram(name runtime,name table,uint32_t limit){
  require_auth(runtime);check(limit>=1&&limit<=25,"RAM_MIGRATION_BATCH");require_migration_source(runtime,get_self(),8);
  if(table=="rampayer"_n){ram_payer_binding binding(get_self(),get_self().value);check(binding.exists()&&binding.get().runtime==runtime,"RAM_PAYER_RUNTIME");auto progress=migration_cursor(runtime,get_self(),get_self().value,table,false,0,0);if(progress.complete)return;observe_ram(runtime,0,get_self(),table,pack_size(binding.get())+224,0);progress.advanced=true;progress.complete=true;ram_migration_cursors rows(get_self(),get_self().value);rows.modify(rows.get(table.value),same_payer,[&](auto& row){row=progress;});return;}
  if(table=="qcfg"_n){quick_settings(get_self(),runtime.value).backfill(limit);return;}
  if(table=="qaccounts"_n){quick_accounts(get_self(),runtime.value).backfill(limit);return;}
  check(false,"RAM_MIGRATION_TABLE");
 }
};
EOSIO_DISPATCH(quickauth,(qconfig)(qregister)(qdefault)(qsubmit)(qdeactivate)(qprune)(checkmig)(scanram))
