#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
using namespace eosio;
// Minimal native-token fixture; not a production token implementation.
CONTRACT testtoken : public contract {
public:
  using contract::contract;
  TABLE balance { asset balance; uint64_t primary_key() const { return balance.symbol.code().raw(); } };
  TABLE stats { asset supply; asset maximum; name issuer; uint64_t primary_key() const { return supply.symbol.code().raw(); } };
  using accounts=multi_index<"accounts"_n,balance>;
  using stat=multi_index<"stat"_n,stats>;
  ACTION create(name issuer,asset maximum) { require_auth(get_self());check(maximum.is_valid()&&maximum.amount>0,"MAXIMUM");stat rows(get_self(),maximum.symbol.code().raw());check(rows.find(maximum.symbol.code().raw())==rows.end(),"EXISTS");rows.emplace(get_self(),[&](auto& r){r.supply=asset(0,maximum.symbol);r.maximum=maximum;r.issuer=issuer;}); }
  ACTION issue(name to,asset quantity,std::string memo) {stat rows(get_self(),quantity.symbol.code().raw());const auto& s=rows.get(quantity.symbol.code().raw());require_auth(s.issuer);check(quantity.symbol==s.supply.symbol&&quantity.amount>0&&quantity.amount<=s.maximum.amount-s.supply.amount,"QUANTITY");rows.modify(s,same_payer,[&](auto& r){r.supply+=quantity;});add(to,quantity);}
  ACTION transfer(name from,name to,asset quantity,std::string memo) {require_auth(from);check(from!=to&&is_account(to)&&quantity.is_valid()&&quantity.amount>0&&memo.size()<=256,"TRANSFER");accounts rows(get_self(),from.value);const auto& r=rows.get(quantity.symbol.code().raw());check(r.balance.symbol==quantity.symbol&&r.balance.amount>=quantity.amount,"BALANCE");rows.modify(r,same_payer,[&](auto& a){a.balance-=quantity;});add(to,quantity);require_recipient(from);require_recipient(to);}
private:
  void add(name to,asset quantity){accounts rows(get_self(),to.value);auto it=rows.find(quantity.symbol.code().raw());if(it==rows.end())rows.emplace(get_self(),[&](auto& r){r.balance=quantity;});else rows.modify(it,same_payer,[&](auto& r){r.balance+=quantity;});}
};
EOSIO_DISPATCH(testtoken,(create)(issue)(transfer))
