#include <eosio/eosio.hpp>
#include <eosio/privileged.hpp>
using namespace eosio;
// Disposable native harness bootstrap. Never included in a runtime deployment.
CONTRACT boot : public contract {
public:
 using contract::contract;
 ACTION activate(checksum256 feature_digest) { require_auth(get_self()); preactivate_feature(feature_digest); }
};
EOSIO_DISPATCH(boot,(activate))
