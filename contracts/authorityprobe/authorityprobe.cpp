#include <eosio/eosio.hpp>
using namespace eosio;
// Disposable native authorization fixture. Never deploy or catalogue this contract.
CONTRACT authorityprobe : public contract {
public:
  using contract::contract;
  ACTION call(name actor,name permission,name target,name action_name,std::vector<char> data) {
    require_auth("runner"_n);
    action request;request.account=target;request.name=action_name;
    request.authorization={{actor,permission}};request.data=std::move(data);request.send();
  }
  ACTION touch(uint64_t value) {
    require_auth(get_self());
    marks rows(get_self(),get_self().value);
    auto found=rows.find(0);
    if(found==rows.end())rows.emplace(get_self(),[&](auto& row){row.value=value;});
    else rows.modify(found,same_payer,[&](auto& row){row.value=value;});
  }
  ACTION reject() { check(false,"PROBE_ROLLBACK"); }
  TABLE mark { uint64_t id=0;uint64_t value=0;uint64_t primary_key()const{return id;} };
  using marks=multi_index<"marks"_n,mark>;
};
EOSIO_DISPATCH(authorityprobe,(call)(touch)(reject))
