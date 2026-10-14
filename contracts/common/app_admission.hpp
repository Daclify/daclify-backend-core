#pragma once
#include "connected_apps.hpp"
namespace daclify {
struct [[eosio::table("appjoins"),eosio::contract("appjoin")]] app_join_policy {
 uint64_t id;uint64_t dao_id;uint64_t app_id;uint64_t app_revision;uint64_t revision=1;name gateway;name gateway_permission;bool public_join=false;bool enabled=false;
 uint64_t primary_key()const{return id;}uint128_t by_app()const{return (uint128_t(dao_id)<<64)|app_id;}
 EOSLIB_SERIALIZE(app_join_policy,(id)(dao_id)(app_id)(app_revision)(revision)(gateway)(gateway_permission)(public_join)(enabled))
};
// One policy per registered app. The DAO/app index isolates each namespace.
using app_join_policies=ram_table<"appjoins"_n,app_join_policy,indexed_by<"byapp"_n,const_mem_fun<app_join_policy,uint128_t,&app_join_policy::by_app>>>;
struct [[eosio::table("appinvites"),eosio::contract("appjoin")]] app_invitation {
 uint64_t id;uint64_t dao_id;uint64_t app_id;uint64_t app_revision;uint64_t policy_revision;uint64_t inviter;checksum256 token_hash;public_key invitation_key;bool admin;uint32_t expires;bool revoked=false;uint64_t member_id=0;
 uint64_t primary_key()const{return id;}uint64_t by_dao()const{return dao_id;}
 EOSLIB_SERIALIZE(app_invitation,(id)(dao_id)(app_id)(app_revision)(policy_revision)(inviter)(token_hash)(invitation_key)(admin)(expires)(revoked)(member_id))
};
struct app_join_proof {
 uint16_t version;name action;name source;checksum256 chain_id;name runtime;uint64_t dao_id;uint64_t app_id;uint64_t app_revision;uint64_t invitation_id;checksum256 token_hash;public_key signing_key;std::string encryption_key;uint8_t custody;uint32_t expires;
 EOSLIB_SERIALIZE(app_join_proof,(version)(action)(source)(chain_id)(runtime)(dao_id)(app_id)(app_revision)(invitation_id)(token_hash)(signing_key)(encryption_key)(custody)(expires))
};
// The DAO index bounds invitation counts and cleanup to its 256 retained rows.
using app_invitations=ram_table<"appinvites"_n,app_invitation,indexed_by<"bydao"_n,const_mem_fun<app_invitation,uint64_t,&app_invitation::by_dao>>>;
inline void prune_app_invitations(name payer,name runtime,uint64_t dao_id){
 app_invitations rows(payer,runtime.value);auto index=rows.get_index<"bydao"_n>();uint32_t erased=0;const auto now=current_time_point().sec_since_epoch();
 for(auto it=index.lower_bound(dao_id);it!=index.end()&&it->dao_id==dao_id&&erased<25;){if(uint64_t(it->expires)+30*86400<now){it=index.erase(it);++erased;}else ++it;}
}
}
