#pragma once
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
namespace daclify {
// Standard Antelope token accounts layout; recipient preparation never authorizes a payout.
struct payout_token_balance {
 eosio::asset balance;
 uint64_t primary_key()const{return balance.symbol.code().raw();}
 EOSLIB_SERIALIZE(payout_token_balance,(balance))
};
inline void require_payout_row(eosio::name token,eosio::name destination,eosio::symbol symbol){
 eosio::multi_index<"accounts"_n,payout_token_balance> rows(token,destination.value);
 auto found=rows.find(symbol.code().raw());
 eosio::check(found!=rows.end()&&found->balance.symbol==symbol,"PAYOUT_TOKEN_ROW_REQUIRED");
}
}
