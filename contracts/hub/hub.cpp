#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>
#define JSON_NOEXCEPTION
#define JSON_HAS_FILESYSTEM 0
#define JSON_HAS_EXPERIMENTAL_FILESYSTEM 0
#include "json.hpp"
using namespace eosio;
CONTRACT hub : public contract {
public:
  using contract::contract;
  TABLE deployment {uint64_t id;name runtime;name owner;checksum256 chain_id;uint16_t interface_version;checksum256 code_hash;checksum256 abi_hash;std::string metadata;bool listed;uint64_t primary_key()const{return id;}uint64_t by_runtime()const{return runtime.value;}};
  using deployments=multi_index<"deployments"_n,deployment,indexed_by<"byruntime"_n,const_mem_fun<deployment,uint64_t,&deployment::by_runtime>>>;
  ACTION regdeploy(name runtime,name owner,checksum256 chain_id,uint16_t interface_version,checksum256 code_hash,checksum256 abi_hash,std::string metadata,bool listed) {
    require_auth(runtime);require_auth(owner);check(is_account(runtime)&&is_account(owner),"ACCOUNT_UNKNOWN");
    check(interface_version==1,"INTERFACE_VERSION");check(metadata.size()<=4096,"METADATA_SIZE");check(nlohmann::json::accept(metadata),"METADATA_JSON");
    deployments rows(get_self(),get_self().value);auto index=rows.get_index<"byruntime"_n>();auto it=index.find(runtime.value);
    if(it==index.end())rows.emplace(get_self(),[&](auto& r){r.id=rows.available_primary_key();r.runtime=runtime;r.owner=owner;r.chain_id=chain_id;r.interface_version=interface_version;r.code_hash=code_hash;r.abi_hash=abi_hash;r.metadata=metadata;r.listed=listed;});
    else index.modify(it,same_payer,[&](auto& r){r.owner=owner;r.chain_id=chain_id;r.interface_version=interface_version;r.code_hash=code_hash;r.abi_hash=abi_hash;r.metadata=metadata;r.listed=listed;});
  }
};
EOSIO_DISPATCH(hub,(regdeploy))
