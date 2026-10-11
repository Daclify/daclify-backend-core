#pragma once
#include "governance.hpp"
namespace daclify {
struct [[eosio::table("appregs"), eosio::contract("runtime")]] connected_app_record {
 uint64_t id; name target; uint64_t revision; checksum256 config_hash; bool enabled; uint64_t security_epoch=1;
 uint64_t primary_key()const{return id;}
 EOSLIB_SERIALIZE(connected_app_record,(id)(target)(revision)(config_hash)(enabled)(security_epoch))
};
// The bounded DAO registry needs only a primary app lookup.
using connected_apps=ram_table<"appregs"_n,connected_app_record>;
struct [[eosio::table("appscopes"), eosio::contract("runtime")]] app_scope_record {
 uint64_t id; uint64_t app_id; uint64_t revision;
 uint64_t primary_key()const{return id;}
 EOSLIB_SERIALIZE(app_scope_record,(id)(app_id)(revision))
};
// Shares the session identifier; existing session indexes locate the key/member.
using app_scopes=ram_table<"appscopes"_n,app_scope_record>;
struct app_actor_context {
 name runtime; uint64_t dao_id; uint64_t member_id; uint64_t app_id;
 EOSLIB_SERIALIZE(app_actor_context,(runtime)(dao_id)(member_id)(app_id))
};
inline connected_app_record active_app(name runtime,uint64_t dao_id,uint64_t app_id,name target){
 connected_apps rows(runtime,dao_id);const auto& app=rows.get(app_id,"APP_UNKNOWN");
 check(app.enabled,"APP_DISABLED");check(app.target==target,"APP_SCOPE");return app;
}
// Fixed-size updates across the bounded registry invalidate future keys without allocating RAM.
inline void bump_app_security(name runtime,uint64_t dao_id){
 connected_apps rows(runtime,dao_id);for(auto it=rows.begin();it!=rows.end();++it)rows.modify(it,same_payer,[](auto& r){r.security_epoch=add64(r.security_epoch,1);});
}
}
