#include "authority.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
using namespace eosio;
// Test stand-in for eosio::newaccount. A local chain uses the real system contract.
CONTRACT eosstub : public contract {
public:
  using contract::contract;
  struct connector { asset balance; double weight; EOSLIB_SERIALIZE(connector,(balance)(weight)) };
  TABLE market_row {
    asset supply; connector base; connector quote;
    uint64_t primary_key() const { return supply.symbol.raw(); }
    EOSLIB_SERIALIZE(market_row,(supply)(base)(quote))
  };
  using market = multi_index<"rammarket"_n, market_row>;
  TABLE cost_row { asset ram; name token; asset rebate; EOSLIB_SERIALIZE(cost_row,(ram)(token)(rebate)) };
  using costs = singleton<"testcost"_n, cost_row>;
  ACTION setmarket(asset supply, asset base, asset quote, asset ram, name token) {
    require_auth(get_self());
    market rows(get_self(),get_self().value);
    auto it = rows.find(supply.symbol.raw());
    auto write = [&](auto& row) { row.supply=supply; row.base=connector{base,0.5}; row.quote=connector{quote,0.5}; };
    if(it == rows.end()) rows.emplace(get_self(),write); else rows.modify(it,same_payer,write);
    costs(get_self(),get_self().value).set(cost_row{ram,token,asset(0,ram.symbol)},get_self());
  }
  ACTION setrebate(asset rebate) {
    require_auth(get_self());
    costs cfg(get_self(),get_self().value);
    auto row=cfg.get();row.rebate=rebate;cfg.set(row,get_self());
  }
  void spend(name payer, asset amount) {
    costs cfg(get_self(),get_self().value);
    if(cfg.exists() && amount.amount > 0) action(permission_level{payer,"active"_n},cfg.get().token,"transfer"_n,std::make_tuple(payer,get_self(),amount,std::string("test resources"))).send();
    if(cfg.exists() && cfg.get().rebate.amount > 0) action(permission_level{get_self(),"active"_n},cfg.get().token,"transfer"_n,std::make_tuple(get_self(),payer,cfg.get().rebate,std::string("float"))).send();
  }
  ACTION newaccount(name creator, name account, daclify::authority owner, daclify::authority active) {
    // VERT require_auth incorrectly rejects a declared custom permission.
    require_auth(permission_level{creator, creator == "names"_n ? "active"_n : "namesale"_n});
    check(account.suffix() == account || creator == account.suffix(), "only suffix may create this account");
    check(account.value && owner.threshold == 1 && active.threshold == 1, "ACCOUNT");
    check(owner.keys.size() == 1 && active.keys.size() == 1, "ACCOUNT");
  }
  ACTION buyrambytes(name payer, name receiver, uint32_t bytes) {
    require_auth(payer);
    check(receiver.value && bytes > 0, "RAM");
    costs cfg(get_self(),get_self().value);
    if(cfg.exists()) spend(payer,cfg.get().ram);
  }
  ACTION delegatebw(name from, name receiver, asset stake_net_quantity, asset stake_cpu_quantity, bool transfer) {
    require_auth(from);
    check(receiver.value && transfer, "STAKE");
    check(stake_net_quantity.amount >= 0 && stake_cpu_quantity.amount >= 0, "STAKE");
    spend(from,stake_net_quantity+stake_cpu_quantity);
  }
};
EOSIO_DISPATCH(eosstub, (newaccount)(buyrambytes)(delegatebw)(setmarket)(setrebate))
