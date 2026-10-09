#include "authority.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
using namespace eosio;
// Test stand-in for eosio::newaccount. A local chain uses the real system contract.
CONTRACT eosstub : public contract {
public:
  using contract::contract;
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
  }
  ACTION delegatebw(name from, name receiver, asset stake_net_quantity, asset stake_cpu_quantity, bool transfer) {
    require_auth(from);
    check(receiver.value && transfer, "STAKE");
    check(stake_net_quantity.amount >= 0 && stake_cpu_quantity.amount >= 0, "STAKE");
  }
};
EOSIO_DISPATCH(eosstub, (newaccount)(buyrambytes)(delegatebw))
