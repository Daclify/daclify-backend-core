#include "quick_accounts.hpp"
using namespace eosio;
using namespace daclify;
// Disposable authorization qualification only; no vote or proof verifier.
CONTRACT quickprobe:public contract{
public:
 using contract::contract;
 TABLE accepted_record{uint64_t account_id,value;uint64_t primary_key()const{return account_id;}EOSLIB_SERIALIZE(accepted_record,(account_id)(value))};
 using accepted=multi_index<"accepted"_n,accepted_record>;
 ACTION respond(quick_actor_context context,uint64_t value){
  check(context.authority=="quickauth"_n&&context.runtime=="daclifycore1"_n&&get_sender()==context.authority,"QUICK_SENDER");require_auth(permission_level{context.authority,"execctx"_n});accepted rows(get_self(),context.runtime.value);auto found=rows.find(context.account_id);
  if(found==rows.end())rows.emplace(get_self(),[&](auto& row){row.account_id=context.account_id;row.value=value;});else rows.modify(found,same_payer,[&](auto& row){row.value=value;});
 }
};
EOSIO_DISPATCH(quickprobe,(respond))
