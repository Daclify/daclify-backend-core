#include <eosio/eosio.hpp>
#include <eosio/permission.hpp>
#include "evm_authorization.hpp"
using namespace eosio;
// Native integration fixture. Never included in production deployment manifests.
CONTRACT permprobe : public contract {
public:
  using contract::contract;
  ACTION evmproof(checksum256 digest,std::vector<char> signature,checksum160 expected) {
    check(daclify::recover_evm_address(digest,signature)==expected,"EVM_ADDRESS");
  }
  ACTION checkauth(name account,name permission,public_key key,bool expected) {
    const auto allowed=check_permission_authorization(account,permission,std::set<public_key>{key},std::set<permission_level>{},microseconds{0});
    check(allowed==expected,"PERMISSION_RESULT");
  }
};
EOSIO_DISPATCH(permprobe,(checkauth)(evmproof))
