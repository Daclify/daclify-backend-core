#pragma once
#include "records.hpp"
namespace daclify {
constexpr uint32_t module_free_members=10;
constexpr uint32_t module_term_max_seconds=40*86400;
constexpr uint32_t module_fee_max_plans=32;
struct [[eosio::table("modfees"),eosio::contract("runtime")]] module_fee_price {
 name account;uint32_t monthly_usd=0;uint64_t revision=0;std::vector<name> actions;
 uint64_t primary_key()const{return account.value;}
 EOSLIB_SERIALIZE(module_fee_price,(account)(monthly_usd)(revision)(actions))
};
using module_fee_prices=ram_table<"modfees"_n,module_fee_price>;
struct [[eosio::table("modterms"),eosio::contract("runtime")]] module_fee_term {
 name account;uint32_t expires=0;checksum256 receipt;bool revoked=false;
 uint64_t primary_key()const{return account.value;}
 // Access-payment metadata is funded by the operator, including in a full DAO RAM pool.
 uint64_t ram_owner(name,uint64_t)const{return 0;}
 EOSLIB_SERIALIZE(module_fee_term,(account)(expires)(receipt)(revoked))
};
using module_fee_terms=ram_table<"modterms"_n,module_fee_term>;
inline void require_module_access(name runtime,uint64_t dao_id,name account,name action,uint64_t members){
 // Replacement creation paths inherit the existing subscription without rewriting paid terms.
 if(action=="openpoll"_n)action="open"_n;else if(action=="commitdoc"_n)action="commit"_n;
 if(members<=module_free_members)return;
 module_fee_prices prices(runtime,runtime.value);auto fee=prices.find(account.value);
 if(fee==prices.end()||!fee->monthly_usd||std::find(fee->actions.begin(),fee->actions.end(),action)==fee->actions.end())return;
 module_fee_terms terms(runtime,dao_id);auto term=terms.find(account.value);
 check(term!=terms.end()&&!term->revoked&&term->expires>current_time_point().sec_since_epoch(),"MODULE_FEE_REQUIRED");
}
}
