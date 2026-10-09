#pragma once
#include "ram_migration.hpp"
namespace daclify {
// Canonical aliases retain their row/index recipes; these lists define required scan coverage.
#define DACLIFY_RAM_GLOBALS(X) \
 X("settings",config) X("daos",daos) X("profiles",profiles) X("evidence",evidence) \
 X("feecfg",fee_settings) X("paycfg",payment_settings) X("catalogue",catalogue) \
 X("modpays",modpays) X("modcopy",modcopy) X("mktcfg",market_settings) \
 X("createcfg",creation_settings) X("createords",creation_orders) \
 X("capcfg",hosted_settings) X("seatcfg",seat_settings) X("daocaps",dao_capacities) \
 X("capreceipts",capacity_receipts) X("govpolicies",gov_policies) X("guards",guardian_states) \
 X("budgets",commitment_budgets) X("admpolicies",admission_policies) \
 X("resourcecfg",resource_settings) X("archcfg",archive_settings) X("rampools",ram_pools) \
 X("ramauto",ram_auto_settings) X("ramorders",ram_orders) X("ramintent",ram_intent_settings) \
 X("ramreserve",ram_reserve_settings) X("ramcards",ram_cards) \
 X("execpols",executive_policies) X("nativegov",native_governance_settings) X("execpending",executive_handovers)
#define DACLIFY_RAM_SCOPED(X) \
 X("executives",executives) X("nonvoters",nonvoters) X("members",members) X("actors",participants) X("sessions",scoped_sessions) \
 X("evmbindings",evm_bindings) X("modules",modules) X("obligations",obligations) \
 X("receipts",finance_receipts) X("documents",documents) X("epochs",epochs) \
 X("keygrants",key_grants) X("govlocks",governance_locks) X("docrefs",document_references) \
 X("docheads",document_heads) X("docclocks",document_clocks) X("docstate",document_states) \
 X("docscan",document_scans) X("docsrcs",document_sources) X("archives",archive_anchors) \
 X("archpos",archive_positions) X("ramalloc",ram_allocations) X("ramholds",ram_holds) \
 X("ramlimits",ram_limits) X("ramgrants",ram_grants) X("ramentitle",ram_entitlements) X("ramclmholds",ram_claim_holds) X("raminherit",ram_inherited)
inline std::vector<eosio::name> module_ram_families(uint8_t kind){
 switch(kind){
 case 1:return {"ballots"_n,"votes"_n,"pollends"_n,"voteids"_n,"elections"_n,"nominations"_n,"terms"_n,"termholds"_n,"executions"_n,"grantplans"_n,"adoptelect"_n,"adoptpolls"_n};
 case 2:return {"projects"_n,"milestones"_n,"agreements"_n,"adoptwork"_n};
 case 3:return {"schedules"_n,"entries"_n,"controls"_n,"adoptpay"_n};
 case 4:return {"rounds"_n,"applications"_n};
 case 5:return {"joinapps"_n};
 default:eosio::check(false,"RAM_MIGRATION_SOURCE_KIND");return {};
 }
}
inline void require_migration_family(eosio::name payer,uint64_t scope,eosio::name table){
 ram_migration_cursors rows(payer,scope);auto found=rows.find(table.value);
 eosio::check(found!=rows.end()&&found->complete,"RAM_MIGRATION_INCOMPLETE");
}
inline void require_migration_source(eosio::name runtime,eosio::name source,uint8_t kind){
 eosio::check(ram_backfill_active(runtime),"RAM_MIGRATION_INACTIVE");
 ram_migration_sources rows(runtime,runtime.value);const auto& saved=rows.get(source.value,"RAM_MIGRATION_SOURCE");
 eosio::check(saved.kind==kind&&saved.code_hash==eosio::get_code_hash(source),"RAM_MIGRATION_SOURCE");
 check_ram_payer_runtime(source,runtime);
}
}
