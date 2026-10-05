#include <eosio/eosio.hpp>
#include <eosio/permission.hpp>
using namespace eosio;
// Native integration fixture. Never included in production deployment manifests.
CONTRACT permprobe : public contract {
public:
  using contract::contract;
  ACTION checkauth(name account,name permission,public_key key,bool expected) {
    const auto allowed=check_permission_authorization(account,permission,std::set<public_key>{key},std::set<permission_level>{},microseconds{0});
    check(allowed==expected,"PERMISSION_RESULT");
  }
};
EOSIO_DISPATCH(permprobe,(checkauth))
