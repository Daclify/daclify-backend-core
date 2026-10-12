#include <eosio/eosio.hpp>
#include <eosio/privileged.hpp>
using namespace eosio;
// Disposable native harness bootstrap. Never included in a runtime deployment.
CONTRACT boot : public contract {
public:
 using contract::contract;
 ACTION activate(checksum256 feature_digest) { require_auth(get_self()); preactivate_feature(feature_digest); }
 ACTION limits(name account,int64_t ram) { require_auth(get_self()); check(ram>=-1,"FIXTURE_RAM_LIMIT"); set_resource_limits(account,ram,-1,-1); }
};
EOSIO_DISPATCH(boot,(activate)(limits))
