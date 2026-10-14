#pragma once
#include "records.hpp"
namespace daclify {
// Read-only projection of the runtime's version-one settings singleton.
struct runtime_domain_record {
 checksum256 chain_id;uint16_t interface_version;
 EOSLIB_SERIALIZE(runtime_domain_record,(chain_id)(interface_version))
};
inline checksum256 runtime_chain_id(name runtime){
 const auto domain=singleton<"settings"_n,runtime_domain_record>(runtime,runtime.value).get();
 check(domain.interface_version==1&&domain.chain_id!=checksum256{},"RUNTIME_DOMAIN");return domain.chain_id;
}
}
