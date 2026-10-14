#pragma once
#include "governance.hpp"
#include "runtime_domain.hpp"
namespace daclify {
struct arbitration_rules {
 name decide;checksum256 decide_hash;uint64_t backup,representative;uint8_t kind;uint16_t quorum,approval;
 uint32_t review_seconds,challenge_seconds,vote_seconds,backup_seconds;
 EOSLIB_SERIALIZE(arbitration_rules,(decide)(decide_hash)(backup)(representative)(kind)(quorum)(approval)(review_seconds)(challenge_seconds)(vote_seconds)(backup_seconds))
};
struct [[eosio::table("arbpolicies"),eosio::contract("runtime")]] arbitration_policy {
 uint64_t dao_id;name works;uint16_t version=1;uint64_t primary_key()const{return dao_id;}
 EOSLIB_SERIALIZE(arbitration_policy,(dao_id)(works)(version))
};
using arbitration_policies=ram_table<"arbpolicies"_n,arbitration_policy>;
#ifndef DACLIFY_ARBITRATION_SOURCE_CONTRACT
#define DACLIFY_ARBITRATION_SOURCE_CONTRACT "termsource"
#endif
struct [[eosio::table("arbterms"),eosio::contract(DACLIFY_ARBITRATION_SOURCE_CONTRACT)]] arbitration_terms {
 uint64_t id,dao_id,contributor;uint32_t cutoff;uint16_t version=1;arbitration_rules rules;checksum256 base,commitment;bool accepted=false;
 uint64_t primary_key()const{return id;}
 EOSLIB_SERIALIZE(arbitration_terms,(id)(dao_id)(contributor)(cutoff)(version)(rules)(base)(commitment)(accepted))
};
using protected_terms=ram_table<"arbterms"_n,arbitration_terms>;
inline checksum256 arbitration_terms_hash(name runtime,name source,const arbitration_terms& terms){
 const auto chain_id=runtime_chain_id(runtime);const auto bytes=pack(std::tie(terms.version,chain_id,runtime,terms.dao_id,source,terms.id,terms.contributor,terms.cutoff,terms.rules,terms.base));return sha256(bytes.data(),bytes.size());
}
inline bool protection_required(name runtime,uint64_t dao_id,name source){arbitration_policies rows(runtime,runtime.value);auto policy=rows.find(dao_id);return policy!=rows.end()&&policy->works==source;}
inline bool arbitration_document_access(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t document_id,uint32_t version){
 if(!document_id)return true;documents docs(runtime,dao_id);auto versions=docs.get_index<"byversion"_n>();const auto& doc=versions.get((uint128_t(document_id)<<32)|version,"DOCUMENT_UNKNOWN");if(!doc.envelope_version)return true;key_grants grants(runtime,dao_id);auto index=grants.get_index<"bymember"_n>();return index.find((uint128_t(member_id)<<64)|doc.key_epoch)!=index.end();
}
inline void require_arbitration_document_access(name runtime,uint64_t dao_id,const arbitration_rules& rules,uint64_t document_id,uint32_t version){check(arbitration_document_access(runtime,dao_id,rules.backup,document_id,version)&&arbitration_document_access(runtime,dao_id,rules.representative,document_id,version),"ARBITRATION_EVIDENCE_ACCESS");}
inline void validate_arbitration_rules(name runtime,uint64_t dao_id,uint64_t contributor,const arbitration_rules& rules){
 check(rules.kind<=2&&rules.quorum>0&&rules.quorum<=10000&&rules.approval>=5001&&rules.approval<=10000,"ARBITRATION_RULES");
 for(auto duration:{rules.review_seconds,rules.challenge_seconds,rules.vote_seconds,rules.backup_seconds})check(duration>=60&&duration<=2592000,"ARBITRATION_DURATION");
 check(rules.decide.value&&rules.decide_hash!=checksum256{}&&get_code_hash(rules.decide)==rules.decide_hash,"ARBITRATION_DECIDE");
 modules installed(runtime,dao_id);const auto& decide=installed.get(rules.decide.value,"MODULE_DISABLED");check(decide.code_hash==rules.decide_hash&&!decide.actions.empty(),"ARBITRATION_DECIDE");
 members people(runtime,dao_id);const auto& backup=people.get(rules.backup,"MEMBER_UNKNOWN");const auto& representative=people.get(rules.representative,"MEMBER_UNKNOWN");
 check(rules.backup!=contributor&&rules.representative!=contributor&&rules.backup!=rules.representative&&backup.active&&representative.active&&representative.admin,"ARBITRATION_CONFLICT");
 check_agent_authority(runtime,dao_id,rules.backup);check_agent_authority(runtime,dao_id,rules.representative);
}
struct [[eosio::table("protected"),eosio::contract("runtime")]] protected_obligation {
 uint64_t id;name source;uint64_t source_id,project_id,recipient;uint16_t version=1;checksum256 source_hash,terms;arbitration_rules rules;
 uint32_t cutoff;uint64_t reviewer=0;uint8_t state=0;uint32_t deadline=0;uint64_t ballot_id=0;checksum256 decision_hash;uint8_t consent_outcome=2,consent_mask=0;
 std::vector<uint64_t> reviewers;
 uint64_t submission_doc=0,review_doc=0,challenge_doc=0;uint32_t submission_version=0,review_version=0,challenge_version=0;checksum256 submission_commitment,review_commitment,challenge_commitment;
 uint64_t ram_owner(name,uint64_t scope)const{return scope;}uint64_t primary_key()const{return id;}
 EOSLIB_SERIALIZE(protected_obligation,(id)(source)(source_id)(project_id)(recipient)(version)(source_hash)(terms)(rules)(cutoff)(reviewer)(state)(deadline)(ballot_id)(decision_hash)(consent_outcome)(consent_mask)(reviewers)(submission_doc)(submission_version)(submission_commitment)(review_doc)(review_version)(review_commitment)(challenge_doc)(challenge_version)(challenge_commitment))
};
using protected_obligations=ram_table<"protected"_n,protected_obligation>;
inline checksum256 protection_decision_hash(name runtime,uint64_t dao_id,const protected_obligation& p){
 const auto debt=obligations(runtime,dao_id).get(p.id,"OBLIGATION_UNKNOWN");check(debt.source==p.source&&debt.source_id==p.source_id&&debt.recipient==p.recipient,"ARBITRATION_DOMAIN");
 // Reuse the canonical record encoding; mutable adjudication progress cannot change its decision domain.
 auto frozen=p;frozen.state=0;frozen.decision_hash=checksum256{};frozen.consent_outcome=2;frozen.consent_mask=0;
 const auto chain_id=runtime_chain_id(runtime);const auto bytes=pack(std::tie(chain_id,runtime,dao_id,frozen,debt.quantity,debt.due));return sha256(bytes.data(),bytes.size());
}
}
