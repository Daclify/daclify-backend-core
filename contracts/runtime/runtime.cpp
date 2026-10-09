#include "admission.hpp"
#include "records.hpp"
#include "governance.hpp"
#include "executives.hpp"
#include "creation.hpp"
#include "evm_authorization.hpp"
#include "telos_resources.hpp"
#include "archive_state.hpp"
#include "ram_capacity.hpp"
#include "ram_completion.hpp"
#include "document_refs.hpp"
#include "ram_families.hpp"
#include "token_payout.hpp"
#include <eosio/transaction.hpp>
#include <eosio/permission.hpp>
#define JSON_NOEXCEPTION
#define JSON_HAS_FILESYSTEM 0
#define JSON_HAS_EXPERIMENTAL_FILESYSTEM 0
#include "json.hpp"
using namespace daclify;
CONTRACT runtime : public contract {
public:
  // Off-chain login signs this inert action. Accidental broadcast grants no rights.
  ACTION authproof(name account,checksum256 intent) { require_auth(account);check(intent!=checksum256{},"AUTH_INTENT"); }
  using contract::contract;
  using ram_orders=ram_table<"ramorders"_n,ram_order,indexed_by<"byreference"_n,const_mem_fun<ram_order,checksum256,&ram_order::by_reference>>>;
  using ram_allocations=ram_table<"ramalloc"_n,ram_allocation>;
  using ram_intent_settings=ram_singleton<"ramintent"_n,ram_payment_intent>;
  ACTION orderram(uint64_t dao_id,name payer,checksum256 reference,uint64_t policy_revision,asset maximum,uint32_t expires,std::vector<ram_purchase> purchases){
    require_auth(payer);check(payer!=get_self(),"RAM_PAYER");
    const auto order=prepare_ram_order(dao_id,payer,reference,policy_revision,maximum,expires,purchases,resource_settings(get_self(),get_self().value).get().native_ram_bps);
    ram_intent_settings(get_self(),get_self().value).set(ram_payment_intent{order,current_transaction_id()},get_self());
  }
  using ram_reserve_settings=ram_singleton<"ramreserve"_n,ram_operator_reserve>;
  using ram_cards=ram_table<"ramcards"_n,ram_card_receipt>;
  ACTION fulfilram(uint64_t dao_id,checksum256 reference,uint64_t policy_revision,asset maximum,uint32_t expires,std::vector<ram_purchase> purchases){
    const auto authority=creation_settings(get_self(),get_self().value).get().settler;require_auth(authority);
    const auto order=prepare_ram_order(dao_id,get_self(),reference,policy_revision,maximum,expires,purchases,0);
    ram_reserve_settings reserve(get_self(),get_self().value);auto funds=reserve.exists()?reserve.get():ram_operator_reserve{};
    check(funds.available.symbol==order.spent.symbol&&funds.available.amount>=order.spent.amount,"RAM_RESERVE_INSUFFICIENT");
    funds.available.amount-=order.spent.amount;reserve.set(funds,get_self());
    ram_orders orders(get_self(),get_self().value);orders.emplace(get_self(),[&](auto& row){row=order;});
    const auto cfg=resource_settings(get_self(),get_self().value).get();
    ram_cards receipts(get_self(),get_self().value);receipts.emplace(get_self(),[&](auto& row){row.id=order.id;row.dao_id=dao_id;row.reference=reference;row.operational_bps=cfg.card_ram_bps;row.fulfiller=authority;});
    buy_ram_order(reference,order.spent);
  }

  ACTION finishram(checksum256 reference){
    check(get_sender()==get_self(),"RAM_PURCHASE_SENDER");require_auth(get_self());
    ram_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byreference"_n>();const auto& order=index.get(reference,"RAM_ORDER_UNKNOWN");check(order.funded&&!order.settled,"RAM_ORDER_SETTLED");
    auto result=order.purchases;
    for(auto& purchase:result){validate_ram_receiver(order.dao_id,purchase.receiver);auto after=telos_unmanaged_ram(purchase.receiver);check(after>=purchase.before_bytes&&after-purchase.before_bytes>=purchase.minimum_bytes,"RAM_ACQUISITION_MINIMUM");purchase.acquired_bytes=after-purchase.before_bytes;}
    ram_allocations allocations(get_self(),order.dao_id);
    for(const auto& purchase:result){auto old=allocations.find(purchase.receiver.value);if(old==allocations.end())allocations.emplace(get_self(),[&](auto& row){row.payer=purchase.receiver;row.purchased_bytes=purchase.acquired_bytes;});else allocations.modify(old,same_payer,[&](auto& row){row.purchased_bytes=add64(row.purchased_bytes,purchase.acquired_bytes);});}
    const auto fee=order.platform_fee;const auto refund=asset(order.received.amount-order.spent.amount-fee.amount,fee.symbol);const auto payer=order.payer,treasury=order.treasury;
    index.modify(order,same_payer,[&](auto& row){row.purchases=result;row.settled=true;});
    pay_share("eosio.token"_n,treasury,fee,"Daclify RAM operational fee");pay_share("eosio.token"_n,payer,refund,"Daclify RAM purchase change");
  }
  ACTION setarchcfg(name verifier,uint32_t minimum_retention_seconds,bool pruning_enabled){
    require_auth(get_self());check(is_account(verifier)&&minimum_retention_seconds>=archive_min_retention&&minimum_retention_seconds<=315360000,"ARCHIVE_POLICY");
    ram_observer_settings observer(get_self(),get_self().value);check(observer.exists()&&observer.get().runtime_hash==get_code_hash(get_self()),"RAM_OBSERVER_REQUIRED");
    archive_settings(get_self(),get_self().value).set(archive_policy{verifier,minimum_retention_seconds,pruning_enabled},get_self());
  }
  ACTION archattest(uint64_t dao_id,archive_manifest_descriptor manifest,std::string manifest_cid,uint32_t manifest_bytes,checksum256 manifest_commitment,checksum256 backup_commitment,uint32_t retention_seconds){
    const auto policy=archive_settings(get_self(),get_self().value).get();require_auth(policy.verifier);dao_rows.get(dao_id,"DAO_UNKNOWN");
    check(action_data_size()<=16384,"ARCHIVE_ACTION_SIZE");validate_archive_manifest(dao_id,manifest);
    validate_cid(manifest_cid);check(manifest_bytes>0&&manifest_bytes<=archive_max_chunk_bytes&&manifest_commitment!=checksum256{}&&backup_commitment!=checksum256{},"ARCHIVE_COMMITMENT");
    check(retention_seconds>=policy.minimum_retention_seconds&&retention_seconds<=315360000,"ARCHIVE_POLICY");
    const auto commitment=archive_descriptor_hash(manifest);const uint32_t now=current_time_point().sec_since_epoch();
    archive_anchors anchors(get_self(),dao_id);auto index=anchors.get_index<"bymanifest"_n>();auto found=index.find(manifest_commitment);
    if(found!=index.end()){
      check(found->retention_seconds==retention_seconds&&found->descriptor_commitment==commitment&&found->backup_commitment==backup_commitment&&found->manifest_cid==manifest_cid&&found->manifest_bytes==manifest_bytes&&pack(found->manifest)==pack(manifest),"ARCHIVE_ANCHOR_IMMUTABLE");
      index.modify(found,same_payer,[&](auto& r){r.attested_at=now;r.verifier=policy.verifier;r.attestation_transaction=current_transaction_id();});return;
    }
    auto id=anchors.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max()/archive_anchor_max_chunks,"ARCHIVE_ANCHOR_LIMIT");
    anchors.emplace(get_self(),[&](auto& r){r.id=id;r.dao_id=dao_id;r.manifest=manifest;r.manifest_cid=manifest_cid;r.manifest_bytes=manifest_bytes;r.manifest_commitment=manifest_commitment;r.descriptor_commitment=commitment;r.backup_commitment=backup_commitment;r.verifier=policy.verifier;r.retention_seconds=retention_seconds;r.attested_at=now;r.attestation_transaction=current_transaction_id();});
    archive_positions positions(get_self(),dao_id);
    for(uint32_t ordinal=0;ordinal<manifest.families.front().chunks.size();ordinal++)positions.emplace(get_self(),[&](auto& r){r.id=id*archive_anchor_max_chunks+ordinal;r.dao_id=dao_id;r.archive_id=id;r.chunk_ordinal=ordinal;});
  }
  ACTION archapprove(name runtime,uint64_t dao_id,uint64_t member_id,checksum256 manifest_commitment,checksum256 descriptor_commitment,checksum256 backup_commitment,uint32_t retention_seconds){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);
    archive_anchors anchors(get_self(),dao_id);auto index=anchors.get_index<"bymanifest"_n>();const auto& anchor=index.get(manifest_commitment,"ARCHIVE_ANCHOR_UNKNOWN");
    check(anchor.retention_seconds==retention_seconds&&anchor.descriptor_commitment==descriptor_commitment&&anchor.backup_commitment==backup_commitment,"ARCHIVE_COMMITMENT");validate_archive_manifest(dao_id,anchor.manifest);
    check(anchor.verifier==archive_settings(get_self(),get_self().value).get().verifier,"ARCHIVE_VERIFIER_CHANGED");
    const uint32_t now=current_time_point().sec_since_epoch();check(anchor.attested_at<=now&&uint64_t(now)-anchor.attested_at<=archive_availability_lifetime,"ARCHIVE_AVAILABILITY_EXPIRED");
    if(anchor.approved_by==member_id&&!anchor.revoked)return;
    index.modify(anchor,same_payer,[&](auto& r){r.approved_by=member_id;r.approved_at=now;r.revoked=false;r.approval_transaction=current_transaction_id();});
  }
  ACTION archrevoke(name runtime,uint64_t dao_id,uint64_t member_id,checksum256 manifest_commitment,checksum256 descriptor_commitment,checksum256 backup_commitment,uint32_t retention_seconds){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);archive_anchors anchors(get_self(),dao_id);auto index=anchors.get_index<"bymanifest"_n>();const auto& anchor=index.get(manifest_commitment,"ARCHIVE_ANCHOR_UNKNOWN");
    check(anchor.retention_seconds==retention_seconds&&anchor.descriptor_commitment==descriptor_commitment&&anchor.backup_commitment==backup_commitment,"ARCHIVE_COMMITMENT");if(!anchor.revoked)index.modify(anchor,same_payer,[](auto& r){r.revoked=true;});
  }
  ACTION archstep(uint64_t dao_id,name source,uint64_t archive_id,uint32_t chunk_ordinal,uint32_t start,uint32_t count){
    check(get_sender()==source,"ARCHIVE_SOURCE_SENDER");require_auth(source);const auto anchor=approved_archive(get_self(),dao_id,archive_id,source);validate_archive_manifest(dao_id,anchor.manifest);
    check(count>0&&count<=25&&chunk_ordinal<anchor.manifest.families.front().chunks.size(),"ARCHIVE_PRUNE_BOUNDS");const auto& chunk=anchor.manifest.families.front().chunks[chunk_ordinal];
    archive_positions positions(get_self(),dao_id);const auto& progress=positions.get(archive_id*archive_anchor_max_chunks+chunk_ordinal,"ARCHIVE_PROGRESS_UNKNOWN");
    check(progress.archive_id==archive_id&&progress.chunk_ordinal==chunk_ordinal&&progress.pruned==start&&uint64_t(start)+count<=chunk.domain.leaf_count,"ARCHIVE_PROGRESS");
    positions.modify(progress,same_payer,[&](auto& r){r.pruned+=count;});
  }
  ACTION docsrc(uint64_t dao_id,name source,std::vector<name> tables){
    check_document_source(dao_id,source);check(tables.size()<=4,"DOCUMENT_SOURCE_TABLE");for(size_t i=0;i<tables.size();i++)check(tables[i].value&&(!i||tables[i].value>tables[i-1].value),"DOCUMENT_SOURCE_TABLE");
    document_sources rows(get_self(),dao_id);auto prior=rows.find(source.value);const auto code=get_code_hash(source);
    if(prior!=rows.end()){if(prior->code_hash==code){check(prior->tables==tables,"DOCUMENT_SOURCE_IMMUTABLE");return;}for(const auto& table:prior->tables)check(std::find(tables.begin(),tables.end(),table)!=tables.end(),"DOCUMENT_SOURCE_TABLE_REMOVED");rows.modify(prior,same_payer,[&](auto& r){r.code_hash=code;r.tables=tables;});}
    else rows.emplace(get_self(),[&](auto& r){r.source=source;r.code_hash=code;r.tables=tables;});
  }
  ACTION docref(uint64_t dao_id,name source,name table,uint64_t source_id,uint8_t slot,uint64_t document_id,uint32_t version){
    check_document_source(dao_id,source);require_document_table(dao_id,source,table);check(table.value&&source_id&&slot<=2,"DOCUMENT_REFERENCE_BOUNDS");check((document_id==0)==(version==0),"DOCUMENT_REFERENCE_BOUNDS");
    document_references rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();auto data=pack(std::make_tuple(source,table,source_id,slot));auto found=index.find(sha256(data.data(),data.size()));
    const bool fixed_slot=table=="milestones"_n&&slot<=1&&ram_observer_settings(get_self(),get_self().value).exists();
    if(!document_id&&!fixed_slot){if(found!=index.end())index.erase(found);return;}
    if(document_id){documents docs(get_self(),dao_id);auto versions=docs.get_index<"byversion"_n>();versions.get((uint128_t(document_id)<<32)|version,"DOCUMENT_UNKNOWN");}
    if(found!=index.end()){if(found->document_id!=document_id||found->version!=version)index.modify(found,same_payer,[&](auto& r){r.document_id=document_id;r.version=version;});return;}
    auto id=rows.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"DOCUMENT_REFERENCE_LIMIT");
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.source=source;r.table=table;r.source_id=source_id;r.slot=slot;r.document_id=document_id;r.version=version;});
  }
  ACTION docscanstep(uint64_t dao_id,name source,name table,uint64_t start,uint64_t next,bool complete,uint32_t scanned){
    check_document_source(dao_id,source);require_document_table(dao_id,source,table);check(table.value&&scanned<=25&&next>=start&&(complete||next>start),"DOCUMENT_SCAN_BOUNDS");
    document_scans rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();auto data=pack(std::make_tuple(source,table));auto found=index.find(sha256(data.data(),data.size()));const auto code=get_code_hash(source);
    const bool current=found!=index.end()&&found->code_hash==code;check(start==(current?found->cursor:0),"DOCUMENT_SCAN_CURSOR");
    if(current&&found->complete){check(complete&&next==start&&scanned==0,"DOCUMENT_SCAN_COMPLETE");return;}
    if(found==index.end()){auto id=rows.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"DOCUMENT_SCAN_LIMIT");rows.emplace(get_self(),[&](auto& r){r.id=id;r.source=source;r.table=table;r.code_hash=code;r.cursor=next;r.complete=complete;});}
    else index.modify(found,same_payer,[&](auto& r){r.code_hash=code;r.cursor=next;r.complete=complete;});
  }
  ACTION prunedocs(uint64_t dao_id,uint64_t archive_id,uint32_t chunk_ordinal,uint32_t start,std::vector<archive_prune_proof> proofs){
    check(action_data_size()<=16384&&!proofs.empty()&&proofs.size()<=25,"ARCHIVE_PRUNE_BOUNDS");check(!dao_paused(get_self(),dao_id),"DAO_PAUSED");require_document_coverage(dao_id);
    const auto anchor=approved_archive(get_self(),dao_id,archive_id,get_self());validate_archive_manifest(dao_id,anchor.manifest);const auto& family=anchor.manifest.families.front();check(family.kind=="document-versions"&&chunk_ordinal<family.chunks.size(),"ARCHIVE_FAMILY_PROTECTED");const auto& chunk=family.chunks[chunk_ordinal];
    archive_positions positions(get_self(),dao_id);const auto& progress=positions.get(archive_id*archive_anchor_max_chunks+chunk_ordinal,"ARCHIVE_PROGRESS_UNKNOWN");check(uint64_t(start)+proofs.size()<=chunk.domain.leaf_count,"ARCHIVE_PRUNE_BOUNDS");if(uint64_t(start)+proofs.size()<=progress.pruned)return;check(start==progress.pruned,"ARCHIVE_PROGRESS");
    documents rows(get_self(),dao_id);document_heads heads(get_self(),dao_id);document_clocks clocks(get_self(),dao_id);document_references refs(get_self(),dao_id);auto referenced=refs.get_index<"byversion"_n>();uint64_t previous=0;
    for(uint32_t i=0;i<proofs.size();i++){const auto& proof=proofs[i];check(proof.primary_key>=chunk.first_key&&proof.primary_key<=chunk.last_key&&(!i||proof.primary_key>previous),"ARCHIVE_ROW_ORDER");auto found=rows.find(proof.primary_key);check(found!=rows.end()&&found->document_id==family.parent_id,"ARCHIVE_ROW_DOMAIN");
      check(found->version<heads.get(found->document_id,"DOCUMENT_HEAD_UNKNOWN").version,"DOCUMENT_LATEST_PROTECTED");check(referenced.find(found->by_version())==referenced.end(),"DOCUMENT_REFERENCED");const auto& clock=clocks.get(found->id,"DOCUMENT_CLOCK_UNKNOWN");check(clock.row_hash==document_row_hash(*found)&&clock.document_id==found->document_id&&clock.version==found->version,"DOCUMENT_ID_REUSED");check(uint64_t(clock.created_at)+anchor.retention_seconds<=current_time_point().sec_since_epoch(),"ARCHIVE_RETENTION");
      if(!found->cid.empty()){auto file=std::find_if(anchor.manifest.files.begin(),anchor.manifest.files.end(),[&](const auto& f){return f.document_id==found->document_id&&f.version==found->version;});check(file!=anchor.manifest.files.end()&&file->cid==found->cid&&file->bytes==found->bytes&&file->commitment==found->commitment&&file->envelope_version==found->envelope_version&&file->key_epoch==found->key_epoch,"ARCHIVE_FILE_COVERAGE");}
      check(verify_archive_proof(chunk.domain,start+i,proof.primary_key,pack(*found),proof.siblings,chunk.root),"ARCHIVE_PROOF");previous=proof.primary_key;rows.erase(found);
    }
    positions.modify(progress,same_payer,[&](auto& r){r.pruned+=proofs.size();});
  }
  ACTION restoredoc(name runtime,uint64_t dao_id,uint64_t member_id,document_record original){
    authorized_actor(runtime,dao_id,member_id,true);check(action_data_size()<=16384,"ARCHIVE_ACTION_SIZE");document_clocks clocks(get_self(),dao_id);const auto& clock=clocks.get(original.id,"DOCUMENT_CLOCK_UNKNOWN");check(clock.document_id==original.document_id&&clock.version==original.version&&clock.row_hash==document_row_hash(original),"DOCUMENT_RESTORE_COMMITMENT");
    const auto head=document_heads(get_self(),dao_id).get(original.document_id,"DOCUMENT_HEAD_UNKNOWN");check(original.version<=head.version,"DOCUMENT_VERSION");documents rows(get_self(),dao_id);auto found=rows.find(original.id);if(found!=rows.end()){check(pack(*found)==pack(original),"DOCUMENT_RESTORE_CONFLICT");return;}auto versions=rows.get_index<"byversion"_n>();check(versions.find(original.by_version())==versions.end(),"DOCUMENT_RESTORE_CONFLICT");rows.emplace(get_self(),[&](auto& r){r=original;});
  }
  ACTION backfilldocs(uint64_t dao_id,uint32_t limit){
    require_auth(get_self());dao_rows.get(dao_id,"DAO_UNKNOWN");check(limit>0&&limit<=25,"DOCUMENT_SCAN_BOUNDS");document_states state(get_self(),dao_id);auto found=state.find(0);auto progress=found==state.end()?document_state{}:*found;if(progress.complete)return;
    documents rows(get_self(),dao_id);uint32_t count=0;auto it=rows.upper_bound(progress.cursor);
    for(;it!=rows.end()&&count<limit;++it,++count){record_document(dao_id,*it,true);progress.cursor=it->id;progress.high_water=std::max(progress.high_water,it->id);}
    progress.complete=it==rows.end();if(found==state.end())state.emplace(get_self(),[&](auto& r){r=progress;});else state.modify(found,same_payer,[&](auto& r){r=progress;});
  }
  ACTION initramobs(){
    require_auth(get_self());check(dao_rows.begin()==dao_rows.end()&&!ram_reserve_settings(get_self(),get_self().value).exists(),"RAM_BACKFILL_REQUIRED");
    check(!fee_settings(get_self(),get_self().value).exists()&&!payment_settings(get_self(),get_self().value).exists()&&!market_settings(get_self(),get_self().value).exists()&&!creation_settings(get_self(),get_self().value).exists()&&!hosted_settings(get_self(),get_self().value).exists()&&!seat_settings(get_self(),get_self().value).exists()&&!resource_settings(get_self(),get_self().value).exists(),"RAM_BACKFILL_REQUIRED");
    catalogue listed(get_self(),get_self().value);modpays payments(get_self(),get_self().value);modcopy copies(get_self(),get_self().value);creation_orders orders(get_self(),get_self().value);check(listed.begin()==listed.end()&&payments.begin()==payments.end()&&copies.begin()==copies.end()&&orders.begin()==orders.end()&&!ram_auto_settings(get_self(),get_self().value).exists(),"RAM_BACKFILL_REQUIRED");
    ram_observer_settings saved(get_self(),get_self().value);check(!saved.exists(),"ALREADY_INITIALIZED");ram_observer_config cfg;cfg.runtime_hash=get_code_hash(get_self());cfg.meter_bytes=pack_size(cfg)+224;saved.set(cfg,get_self());
  }
  ACTION setramauto(bool enabled,std::vector<ram_offer> offers){
    require_auth(get_self());check(offers.size()<=6&&(enabled||offers.empty()),"RAM_OFFER_BOUNDS");ram_auto_policy value;value.enabled=enabled;value.offers=offers;
    if(enabled){
      const auto policy=resource_settings(get_self(),get_self().value).get();value.policy_revision=policy.revision;uint64_t activity=0;bool core=false;
      ram_pools pools(get_self(),get_self().value);
      for(size_t i=0;i<offers.size();i++){const auto& offer=offers[i];check(offer.payer.value&&offer.completion>=32768,"RAM_OFFER_BOUNDS");for(size_t j=0;j<i;j++)check(offers[j].payer!=offer.payer,"RAM_OFFER_DUPLICATE");if(offer.payer!=get_self())check_ram_source(offer.payer,get_code_hash(offer.payer));check_ram_pool(get_self(),pools.get(offer.payer.value,"RAM_POOL_UNKNOWN"));activity=add64(activity,offer.activity);core|=offer.payer==get_self();}
      check(core&&activity==policy.included_activity_bytes,"RAM_OFFER_POLICY");
    }
    ram_auto_settings(get_self(),get_self().value).set(value,get_self());
    for(const auto& offer:offers)action(permission_level{get_self(),"active"_n},get_self(),"checkrampool"_n,std::make_tuple(offer.payer)).send();
  }
  ACTION setrampool(name payer,uint64_t expected_quota,uint64_t baseline_bytes,uint64_t platform_headroom){
    require_auth(get_self());ram_observer_settings observer(get_self(),get_self().value);check(observer.exists()&&observer.get().runtime_hash==get_code_hash(get_self()),"RAM_OBSERVER_REQUIRED");
    if(payer!=get_self()){ram_sources sources(get_self(),get_self().value);check(sources.get(payer.value,"RAM_SOURCE_UNKNOWN").code_hash==get_code_hash(payer),"RAM_SOURCE_CODE");}
    check(telos_unmanaged_ram(payer)==expected_quota&&platform_headroom>=32768,"RAM_POOL_BACKING");ram_payer_pool value{payer,expected_quota,baseline_bytes,platform_headroom,get_code_hash(payer)};check_ram_pool(get_self(),value);
    ram_pools rows(get_self(),get_self().value);auto found=rows.find(payer.value);if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r=value;});else rows.modify(found,same_payer,[&](auto& r){r=value;});
    action(permission_level{get_self(),"active"_n},get_self(),"checkrampool"_n,std::make_tuple(payer)).send();
  }
  ACTION grantdaoram(uint64_t dao_id,name payer,uint64_t reference,uint64_t activity,uint64_t identity,uint64_t completion){
    require_auth(get_self());dao_rows.get(dao_id,"DAO_UNKNOWN");ram_pools pools(get_self(),get_self().value);const auto& pool=pools.get(payer.value,"RAM_POOL_UNKNOWN");check(reference&&completion>=32768,"RAM_GRANT_BOUNDS");
    ram_grants receipts(get_self(),dao_id);auto index=receipts.get_index<"byreference"_n>();auto packed=pack(std::make_tuple(payer,reference));auto prior=index.find(sha256(packed.data(),packed.size()));
    if(prior!=index.end()){check(prior->activity==activity&&prior->identity==identity&&prior->completion==completion,"RAM_GRANT_IMMUTABLE");return;}
    const auto total=add64(add64(activity,identity),completion);check_ram_pool(get_self(),pool,dao_id,total);
    ram_limits limits(get_self(),dao_id);auto found=limits.find(payer.value);ram_dao_limit value;if(found!=limits.end())value=*found;value.payer=payer;value.activity=add64(value.activity,activity);value.identity=add64(value.identity,identity);value.completion=add64(value.completion,completion);
    if(found==limits.end())limits.emplace(get_self(),[&](auto& r){r=value;});else limits.modify(found,same_payer,[&](auto& r){r=value;});
    auto id=receipts.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"RAM_GRANT_LIMIT");receipts.emplace(get_self(),[&](auto& r){r.id=id;r.dao_id=dao_id;r.payer=payer;r.reference=reference;r.activity=activity;r.identity=identity;r.completion=completion;});
    // Meter callbacks precede this final check, including the grant's own permanent metadata.
    action(permission_level{get_self(),"active"_n},get_self(),"checkrampool"_n,std::make_tuple(payer)).send();
  }
  ACTION inheritram(uint64_t dao_id,name payer,uint64_t activity_headroom,uint64_t identity_headroom,uint64_t completion_headroom){
    require_auth(get_self());ram_migration_settings migration(get_self(),get_self().value);
    if(migration.exists())check(!migration.get().active,"RAM_MIGRATION_INCOMPLETE");else{require_migration_family(get_self(),dao_id,"oldobs"_n);require_migration_family(get_self(),dao_id,"oldclaims"_n);}
    dao_rows.get(dao_id,"DAO_UNKNOWN");
    ram_inherited inherited(get_self(),dao_id);auto prior=inherited.find(payer.value);
    if(prior!=inherited.end()){check(prior->activity_headroom==activity_headroom&&prior->identity_headroom==identity_headroom&&prior->completion_headroom==completion_headroom,"RAM_GRANT_IMMUTABLE");return;}
    ram_limits prior_limits(get_self(),dao_id);check(prior_limits.find(payer.value)==prior_limits.end(),"RAM_INHERITED_ALLOCATION");
    ram_counters counters(get_self(),dao_id);auto used=counters.find(payer.value);ram_counter baseline;if(used!=counters.end())baseline=*used;
    const auto activity=add64(add64(add64(baseline.activity,baseline.retained),baseline.platform),activity_headroom);
    const auto identity=add64(baseline.identity,identity_headroom);check(completion_headroom>=32768,"RAM_GRANT_BOUNDS");
    inherited.emplace(get_self(),[&](auto& r){r={payer,activity,identity,completion_headroom,activity_headroom,identity_headroom,completion_headroom};});
    action(permission_level{get_self(),"active"_n},get_self(),"grantdaoram"_n,std::make_tuple(dao_id,payer,uint64_t(0x696e6865726974),activity,identity,completion_headroom)).send();
  }
  ACTION checkrampool(name payer){
    check(get_sender()==get_self(),"RAM_POOL_SENDER");require_auth(get_self());
    ram_pools pools(get_self(),get_self().value);check_ram_pool(get_self(),pools.get(payer.value,"RAM_POOL_UNKNOWN"));
  }
  ACTION setdaoquota(uint64_t dao_id,bool enabled){
    require_auth(get_self());dao_rows.get(dao_id,"DAO_UNKNOWN");check(!ram_backfill_active(get_self()),"RAM_MIGRATION_ACTIVE");
    ram_observer_settings observer(get_self(),get_self().value);auto cfg=observer.get();check(cfg.runtime_hash==get_code_hash(get_self()),"RAM_SOURCE_CODE");
    ram_quota_settings saved(get_self(),dao_id);const bool existed=saved.exists();if(existed&&saved.get().enabled==enabled)return;
    ram_pools pools(get_self(),get_self().value);
    if(enabled){
      members people(get_self(),dao_id);participants identities(get_self(),dao_id);ram_holds holds(get_self(),dao_id);ram_claim_holds legacy(get_self(),dao_id);
      auto ready=holds.get_index<"byrecipient"_n>();auto inherited=legacy.get_index<"byrecipient"_n>();uint32_t count=0;
      for(const auto& person:people){check(++count<=5000,"RAM_COMPLETION_SCAN_LIMIT");check(identities.find(person.id)!=identities.end(),"RAM_CREDENTIAL_REQUIRED");
        if(person.claim>0){auto current=ready.find(person.id);auto old=inherited.find(person.id);check((current!=ready.end()&&current->ready&&current->padding.size()>=512)||(old!=inherited.end()&&old->ready&&old->padding.size()>=512),"RAM_CLAIM_HOLD_REQUIRED");}}
      obligations pending(get_self(),dao_id);count=0;for(const auto& debt:pending){check(++count<=5000,"RAM_COMPLETION_SCAN_LIMIT");if(debt.status<=1){auto held=holds.find(debt.id);check(held!=holds.end()&&!held->ready&&held->recipient==debt.recipient&&held->padding.size()>=1024,"RAM_OBLIGATION_HOLD_REQUIRED");}}
      check_ram_pool(get_self(),pools.get(get_self().value,"RAM_POOL_UNKNOWN"));modules installed(get_self(),dao_id);
      uint32_t module_count=0;for(const auto& grant:installed){check(++module_count<=5,"RAM_MIGRATION_SOURCE_LIMIT");check(get_code_hash(grant.account)==grant.code_hash,"MODULE_CODE");
        action(permission_level{get_self(),"active"_n},grant.account,"checkquota"_n,std::make_tuple(get_self(),dao_id)).send();check_ram_pool(get_self(),pools.get(grant.account.value,"RAM_POOL_UNKNOWN"));}
      ram_counters used(get_self(),dao_id);
      for(const auto& row:used)check_ram_pool(get_self(),pools.get(row.payer.value,"RAM_POOL_UNKNOWN"));
    }
    saved.set(ram_quota_state{enabled},get_self());if(!existed){cfg.meter_bytes=add64(cfg.meter_bytes,pack_size(ram_quota_state{})+224);observer.set(cfg,get_self());}
    if(enabled){ram_counters used(get_self(),dao_id);for(const auto& row:used)check_dao_ram(get_self(),dao_id,row.payer,false);
      check_ram_pool(get_self(),pools.get(get_self().value));}
  }
  ACTION checkdaoram(uint64_t dao_id,name payer,name table){
    check(get_sender()==payer,"RAM_SOURCE_SENDER");require_auth(payer);
    const auto cfg=ram_observer_settings(get_self(),get_self().value).get();if(payer==get_self())check(get_code_hash(payer)==cfg.runtime_hash,"RAM_SOURCE_CODE");
    else check(ram_sources(get_self(),get_self().value).get(payer.value,"RAM_SOURCE_UNKNOWN").code_hash==get_code_hash(payer),"RAM_SOURCE_CODE");
    check_dao_ram(get_self(),dao_id,payer,ram_completion_table(table));
  }
  ACTION setresources(uint16_t native_ram_bps,uint16_t card_ram_bps,uint64_t included_activity_bytes,uint64_t identity_bytes_per_slot,uint32_t quote_lifetime_seconds,uint64_t storage_free_bytes,uint64_t storage_unit_bytes,uint32_t storage_monthly_usd){
    require_auth(get_self());save_resources(native_ram_bps,card_ram_bps,included_activity_bytes,identity_bytes_per_slot,quote_lifetime_seconds,storage_free_bytes,storage_unit_bytes,storage_monthly_usd);
  }
  ACTION rebindramobs(checksum256 expected_old_hash,checksum256 expected_new_hash){
    require_auth(get_self());check(!ram_backfill_active(get_self()),"RAM_MIGRATION_ACTIVE");ram_observer_settings saved(get_self(),get_self().value);auto cfg=saved.get();
    check(cfg.runtime_hash==expected_old_hash,"RAM_OBSERVER_CHANGED");check(expected_new_hash!=checksum256{}&&expected_new_hash!=expected_old_hash&&get_code_hash(get_self())==expected_new_hash,"RAM_SOURCE_CODE");
    cfg.runtime_hash=expected_new_hash;saved.set(cfg,get_self());
  }
  ACTION govresources(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t expected_revision,uint16_t native_ram_bps,uint16_t card_ram_bps,uint64_t included_activity_bytes,uint64_t identity_bytes_per_slot,uint32_t quote_lifetime_seconds,uint64_t storage_free_bytes,uint64_t storage_unit_bytes,uint32_t storage_monthly_usd){
    platform_actor(runtime,dao_id,member_id);resource_settings saved(get_self(),get_self().value);check((saved.exists()?saved.get().revision:0)==expected_revision,"RESOURCE_POLICY_CHANGED");save_resources(native_ram_bps,card_ram_bps,included_activity_bytes,identity_bytes_per_slot,quote_lifetime_seconds,storage_free_bytes,storage_unit_bytes,storage_monthly_usd);
  }
  ACTION setramcode(name account,checksum256 code_hash){
    require_auth(get_self());check(!ram_backfill_active(get_self()),"RAM_MIGRATION_ACTIVE");check(account!=get_self()&&code_hash!=checksum256{}&&get_code_hash(account)==code_hash,"RAM_SOURCE_CODE");ram_observer_settings saved(get_self(),get_self().value);auto cfg=saved.get();ram_sources sources(get_self(),get_self().value);auto found=sources.find(account.value);
    if(found==sources.end()){bool empty=sources.begin()==sources.end();ram_source r{account,code_hash};cfg.meter_bytes=add64(cfg.meter_bytes,pack_size(r)+112+(empty?112:0));sources.emplace(get_self(),[&](auto& row){row=r;});saved.set(cfg,get_self());}else sources.modify(found,same_payer,[&](auto& row){row.code_hash=code_hash;});
  }
  ACTION ramadjust(uint64_t dao_id,name payer,uint8_t category,uint64_t added,uint64_t removed){
    check(get_sender()==payer,"RAM_SOURCE_SENDER");require_auth(payer);check(category<=3&&(dao_id||category==3),"RAM_CATEGORY");if(dao_id)dao_rows.get(dao_id,"DAO_UNKNOWN");ram_observer_settings saved(get_self(),get_self().value);auto cfg=saved.get();
    if(payer==get_self())check(get_code_hash(payer)==cfg.runtime_hash,"RAM_SOURCE_CODE");else{ram_sources sources(get_self(),get_self().value);const auto& source=sources.get(payer.value,"RAM_SOURCE_UNKNOWN");check(get_code_hash(payer)==source.code_hash,"RAM_SOURCE_CODE");}
    ram_counters counters(get_self(),dao_id);auto found=counters.find(payer.value);ram_counter value;if(found!=counters.end())value=*found;else{value.payer=payer;cfg.meter_bytes=add64(cfg.meter_bytes,pack_size(value)+112+(counters.begin()==counters.end()?112:0));saved.set(cfg,get_self());}
    auto& bytes=category==0?value.identity:category==1?value.activity:category==2?value.retained:value.platform;check(removed<=bytes,"RAM_COUNTER_UNDERFLOW");bytes=add64(bytes-removed,added);
    if(found==counters.end())counters.emplace(get_self(),[&](auto& r){r=value;});else counters.modify(found,same_payer,[&](auto& r){r=value;});
    if(added>removed)check_dao_ram(get_self(),dao_id,payer,true);
  }
  TABLE settings { checksum256 chain_id; uint16_t interface_version=1; EOSLIB_SERIALIZE(settings,(chain_id)(interface_version)) };
  using config = ram_singleton<"settings"_n,settings>;
  ACTION beginram(std::vector<ram_migration_source> sources){
    require_auth(get_self());check(sources.size()<=5,"RAM_MIGRATION_SOURCE_LIMIT");
    ram_observer_settings observer(get_self(),get_self().value);check(!observer.exists(),"ALREADY_INITIALIZED");
    ram_migration_settings migration(get_self(),get_self().value);check(!migration.exists(),"ALREADY_INITIALIZED");
    ram_migration_sources snapshots(get_self(),get_self().value);ram_sources allowed(get_self(),get_self().value);
    ram_observer_config cfg;cfg.runtime_hash=get_code_hash(get_self());cfg.meter_bytes=pack_size(cfg)+224+pack_size(ram_migration_state{})+224;
    for(size_t i=0;i<sources.size();i++){
      const auto& source=sources[i];module_ram_families(source.kind);
      check(source.account!=get_self()&&source.code_hash!=checksum256{}&&source.code_hash==get_code_hash(source.account),"RAM_MIGRATION_SOURCE");
      for(size_t j=0;j<i;j++)check(source.account!=sources[j].account,"RAM_MIGRATION_SOURCE");
      action(permission_level{get_self(),"active"_n},source.account,"checkmig"_n,std::make_tuple(get_self(),source.kind)).send();
      ram_payer_binding binding(source.account,source.account.value);check(binding.exists()&&binding.get().runtime==get_self(),"RAM_PAYER_RUNTIME");
      snapshots.emplace(get_self(),[&](auto& r){r=source;});ram_source value{source.account,source.code_hash};allowed.emplace(get_self(),[&](auto& r){r=value;});
      cfg.meter_bytes=add64(cfg.meter_bytes,pack_size(source)+112+pack_size(value)+112+(i?0:224));
    }
    uint32_t communities=0;for(const auto& dao:dao_rows){
      check(++communities<=5000,"RAM_POOL_SCAN_LIMIT");modules installed(get_self(),dao.id);uint32_t module_count=0;
      for(const auto& grant:installed){check(++module_count<=5,"RAM_MIGRATION_SOURCE_LIMIT");const auto& source=snapshots.get(grant.account.value,"RAM_MIGRATION_SOURCE");check(source.code_hash==grant.code_hash,"MODULE_CODE");}
    }
    observer.set(cfg,get_self());migration.set(ram_migration_state{},get_self());
  }
  ACTION scanram(uint64_t dao_id,name table,uint32_t limit){
    require_auth(get_self());check(ram_backfill_active(get_self()),"RAM_MIGRATION_INACTIVE");check(limit>=1&&limit<=25,"RAM_MIGRATION_BATCH");
    if(dao_id){dao_rows.get(dao_id,"DAO_UNKNOWN");
#define SCAN_FAMILY(label,type) if(table==name{label}){type(get_self(),dao_id).backfill(limit);return;}
      DACLIFY_RAM_SCOPED(SCAN_FAMILY)
#undef SCAN_FAMILY
    }else{
#define SCAN_FAMILY(label,type) if(table==name{label}){type(get_self(),get_self().value).backfill(limit);return;}
      DACLIFY_RAM_GLOBALS(SCAN_FAMILY)
#undef SCAN_FAMILY
    }
    check(false,"RAM_MIGRATION_TABLE");
  }
  ACTION adoptram(uint64_t dao_id,bool claims,uint32_t limit){
    require_auth(get_self());dao_rows.get(dao_id,"DAO_UNKNOWN");check(limit>=1&&limit<=25,"RAM_MIGRATION_BATCH");
    const bool backfill=ram_backfill_active(get_self());if(!backfill){check(!ram_quota_enabled(get_self(),dao_id),"RAM_QUOTA_ACTIVE");check(ram_observer_settings(get_self(),get_self().value).get().runtime_hash==get_code_hash(get_self()),"RAM_SOURCE_CODE");}
    const auto debts_stage=backfill?"adoptobs"_n:"oldobs"_n;const auto claims_stage=backfill?"adoptclaims"_n:"oldclaims"_n;
    if(claims)require_migration_family(get_self(),dao_id,debts_stage);
    const auto table=claims?claims_stage:debts_stage;auto progress=migration_cursor(get_self(),get_self(),dao_id,table,false,0,0);if(progress.complete)return;
    uint32_t count=0;bool complete=false;
    if(claims){
      members people(get_self(),dao_id);auto it=progress.advanced?people.upper_bound(progress.cursor):people.begin();
      for(;it!=people.end()&&count<limit;++it,++count){
        participants identities(get_self(),dao_id);if(identities.find(it->id)==identities.end())identities.emplace(get_self(),[&](auto& r){r.id=it->id;});
        if(it->claim>0){ram_holds held(get_self(),dao_id);auto index=held.get_index<"byrecipient"_n>();ram_claim_holds legacy(get_self(),dao_id);
          if(index.find(it->id)==index.end()&&legacy.find(it->id)==legacy.end())legacy.emplace(get_self(),[&](auto& r){r.id=it->id;r.recipient=it->id;r.ready=true;r.padding.resize(512);});
        }
        progress.cursor=it->id;progress.advanced=true;
      }complete=it==people.end();
    }else{
      obligations debts(get_self(),dao_id);auto it=progress.advanced?debts.upper_bound(progress.cursor):debts.begin();
      for(;it!=debts.end()&&count<limit;++it,++count){
        if(it->status<=1){ram_holds held(get_self(),dao_id);auto prior=held.find(it->id);if(prior==held.end())hold_obligation_receipts(get_self(),dao_id,it->id,it->recipient);else check(!prior->ready&&prior->recipient==it->recipient,"RAM_HOLD_STATE");}
        progress.cursor=it->id;progress.advanced=true;
      }complete=it==debts.end();
    }
    progress.complete=complete;ram_migration_cursors rows(get_self(),dao_id);rows.modify(rows.get(table.value),same_payer,[&](auto& r){r=progress;});
  }
  ACTION sealram(uint32_t limit){
    require_auth(get_self());check(limit>=1&&limit<=5,"RAM_MIGRATION_BATCH");ram_migration_settings saved(get_self(),get_self().value);auto state=saved.get();if(!state.active)return;
    check(ram_observer_settings(get_self(),get_self().value).get().runtime_hash==get_code_hash(get_self()),"RAM_SOURCE_CODE");
    ram_migration_sources current_sources(get_self(),get_self().value);for(const auto& source:current_sources)require_migration_source(get_self(),source.account,source.kind);
    if(!state.globals_complete){
#define REQUIRE_FAMILY(label,type) require_migration_family(get_self(),get_self().value,name{label});
      DACLIFY_RAM_GLOBALS(REQUIRE_FAMILY)
#undef REQUIRE_FAMILY
      ram_migration_sources sources(get_self(),get_self().value);for(const auto& source:sources){
        require_migration_source(get_self(),source.account,source.kind);
        require_migration_family(source.account,source.account.value,"rampayer"_n);
        for(const auto& table:module_ram_families(source.kind))require_migration_family(source.account,get_self().value,table);
      }
      state.globals_complete=true;
    }
    uint32_t count=0;auto it=state.advanced?dao_rows.upper_bound(state.dao_cursor):dao_rows.begin();
    for(;it!=dao_rows.end()&&count<limit;++it,++count){
#define REQUIRE_FAMILY(label,type) require_migration_family(get_self(),it->id,name{label});
      DACLIFY_RAM_SCOPED(REQUIRE_FAMILY)
      require_migration_family(get_self(),it->id,"adoptobs"_n);require_migration_family(get_self(),it->id,"adoptclaims"_n);
#undef REQUIRE_FAMILY
      modules installed(get_self(),it->id);ram_migration_sources sources(get_self(),get_self().value);
      for(const auto& grant:installed){const auto& source=sources.get(grant.account.value,"RAM_MIGRATION_SOURCE");check(source.code_hash==grant.code_hash&&source.code_hash==get_code_hash(grant.account),"MODULE_CODE");}
      state.dao_cursor=it->id;state.advanced=true;
    }
    if(it==dao_rows.end())state.active=false;saved.set(state,get_self());
  }

  ACTION init(checksum256 chain_id) {
    require_auth(get_self()); config c(get_self(),get_self().value);
    check(!c.exists(),"ALREADY_INITIALIZED"); c.set(settings{chain_id,1},get_self());
  }
  ACTION createdao(uint64_t dao_id,name owner,std::string metadata,uint8_t privacy,name token_contract,symbol token_symbol) {
    check(!creation_settings(get_self(),get_self().value).exists(),"CREATION_PAYMENT_REQUIRED");
    create_dao(dao_id,owner,metadata,privacy,token_contract,token_symbol);
  }
  ACTION createpaid(uint64_t dao_id,name owner,std::string metadata,uint8_t privacy,name token_contract,symbol token_symbol,checksum256 reference,public_key creator) {
    auto cfg=creation_settings(get_self(),get_self().value).get();require_auth(cfg.settler);
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();const auto& order=index.get(reference,"CREATION_UNKNOWN");
    check(order.creator==creator&&order.deployment==0,"CREATION_OWNER");check(order.paid,"CREATION_UNPAID");check(!order.used,"CREATION_USED");
    create_dao(dao_id,owner,metadata,privacy,token_contract,token_symbol);
    index.modify(order,same_payer,[&](auto& r){r.used=true;r.dao_id=dao_id;});
  }
private:
  void create_dao(uint64_t dao_id,name owner,const std::string& metadata,uint8_t privacy,name token_contract,symbol token_symbol) {
    require_auth(owner); configuration(); check(dao_id>0,"DAO_ID"); check(privacy<=2,"PRIVACY_POLICY");
    check(is_account(owner),"OWNER_ACCOUNT"); check(token_contract.value>0&&token_symbol.is_valid(),"ASSET_IDENTITY");
    check(dao_rows.find(dao_id)==dao_rows.end(),"DAO_EXISTS"); validate_dao_metadata(metadata);
    dao_rows.emplace(get_self(),[&](auto& d){ d.id=dao_id; d.owner=owner; d.metadata=metadata; d.privacy=privacy; d.token_contract=token_contract; d.token_symbol=token_symbol; });
    allocate_included_ram(dao_id);
  }
public:
  ACTION setcreate(uint32_t shared_usd,uint32_t independent_usd,uint16_t premium_bps,name settler) {
    require_auth(get_self());save_creation(shared_usd,independent_usd,premium_bps,settler);
  }
  ACTION govcreate(name runtime,uint64_t dao_id,uint64_t member_id,uint32_t shared_usd,uint32_t independent_usd,uint16_t premium_bps,name settler) {
    platform_actor(runtime,dao_id,member_id);save_creation(shared_usd,independent_usd,premium_bps,settler);
  }
  ACTION setcrrate(uint64_t median,uint8_t precision,uint32_t observed_at) {
    require_auth(get_self());auto now=current_time_point().sec_since_epoch();check(median>0&&precision<=18&&observed_at<=now&&now-observed_at<=900,"CREATION_RATE");
    creation_settings saved(get_self(),get_self().value);auto cfg=saved.get();cfg.median=median;cfg.precision=precision;cfg.observed_at=observed_at;saved.set(cfg,get_self());
  }
  ACTION ordercreate(checksum256 reference,public_key creator,uint8_t deployment,uint8_t method) {
    auto cfg=creation_settings(get_self(),get_self().value).get();require_auth(cfg.settler);check(reference!=checksum256()&&deployment<=1&&method<=1,"CREATION_ORDER");
    const auto fees=fee_configuration();check(fees.token_symbol==symbol("TLOS",4),"CREATION_ASSET");
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();check(index.find(reference)==index.end(),"CREATION_EXISTS");
    uint32_t usd=deployment==0?cfg.shared_usd:cfg.independent_usd;check(usd>0,"CREATION_FREE_PATH");auto now=current_time_point().sec_since_epoch();uint64_t expiry=uint64_t(now)+(method==0?900:3600);check(expiry<=std::numeric_limits<uint32_t>::max(),"TIME_RANGE");
    int64_t amount=0;if(method==0){check(cfg.median>0&&cfg.observed_at<=now&&now-cfg.observed_at<=900,"CREATION_RATE");__int128 scale=1;for(uint8_t i=0;i<cfg.precision;i++)scale*=10;__int128 numerator=__int128(usd)*scale*(10000+cfg.premium_bps)*10000;__int128 denominator=__int128(100)*cfg.median*10000;auto units=(numerator+denominator-1)/denominator;check(units>0&&units<=asset::max_amount,"CREATION_AMOUNT");amount=int64_t(units);}
    auto id=orders.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"CREATION_LIMIT");
    orders.emplace(get_self(),[&](auto& r){r.id=id;r.reference=reference;r.creator=creator;r.deployment=deployment;r.method=method;r.usd_cents=usd;r.tlos_due=asset(amount,fees.token_symbol);r.created_at=now;r.expires=expiry;});
  }
  ACTION sethosted(uint32_t free_members,name settler) {require_auth(get_self());save_hosted(free_members,settler);}
  ACTION govhosted(name runtime,uint64_t dao_id,uint64_t member_id,uint32_t free_members,name settler) {platform_actor(runtime,dao_id,member_id);save_hosted(free_members,settler);}
  ACTION govseatfee(name runtime,uint64_t dao_id,uint64_t member_id,uint32_t first_usd,uint32_t next_usd,uint32_t rest_usd) {
    platform_actor(runtime,dao_id,member_id);check(first_usd>=50&&first_usd<=99999&&next_usd>0&&next_usd<=first_usd&&rest_usd>0&&rest_usd<=next_usd,"HOSTED_PRICE");
    seat_settings saved(get_self(),get_self().value);auto cfg=saved.exists()?saved.get():seat_policy{};cfg.first_usd=first_usd;cfg.next_usd=next_usd;cfg.rest_usd=rest_usd;cfg.revision=add64(cfg.revision,1);saved.set(cfg,get_self());
  }
  ACTION orderfree(checksum256 reference,public_key creator) {
    auto cfg=creation_settings(get_self(),get_self().value).get();auto hosted=hosted_settings(get_self(),get_self().value).get();require_auth(cfg.settler);check(hosted.settler==cfg.settler&&cfg.shared_usd==0&&reference!=checksum256(),"CREATION_FREE_PATH");
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();check(index.find(reference)==index.end(),"CREATION_EXISTS");const auto fees=fee_configuration();
    auto id=orders.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"CREATION_LIMIT");auto now=current_time_point().sec_since_epoch();check(uint64_t(now)+3600<=std::numeric_limits<uint32_t>::max(),"TIME_RANGE");
    orders.emplace(get_self(),[&](auto& r){r.id=id;r.reference=reference;r.creator=creator;r.deployment=0;r.method=2;r.usd_cents=0;r.tlos_due=asset(0,fees.token_symbol);r.created_at=now;r.expires=now+3600;r.paid=true;});
  }
  ACTION setcapacity(uint64_t dao_id,uint32_t member_limit,uint32_t expires,checksum256 receipt) {
    auto cfg=hosted_settings(get_self(),get_self().value).get();require_auth(cfg.settler);dao_rows.get(dao_id,"DAO_UNKNOWN");check(receipt!=checksum256(),"CAPACITY_RECEIPT");
    capacity_receipts receipts(get_self(),get_self().value);auto index=receipts.get_index<"byreceipt"_n>();auto seen=index.find(receipt);
    if(seen!=index.end()){check(seen->dao_id==dao_id&&seen->members==member_limit&&seen->expires==expires&&!seen->revoked,"CAPACITY_RECEIPT");}
    auto now=current_time_point().sec_since_epoch();if(seen!=index.end()&&expires<=now)return;
    check(member_limit>0&&member_limit<=5000&&expires>now&&uint64_t(expires)<=uint64_t(now)+31622400,"CAPACITY_RANGE");
    if(seen==index.end()){auto id=receipts.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"CAPACITY_LIMIT");receipts.emplace(get_self(),[&](auto& r){r.id=id;r.receipt=receipt;r.dao_id=dao_id;r.members=member_limit;r.expires=expires;});}
    dao_capacities rows(get_self(),get_self().value);auto it=rows.find(dao_id);
    if(it==rows.end())rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.members=member_limit;r.expires=expires;r.receipt=receipt;});
    else if(expires>it->expires||(expires==it->expires&&member_limit>it->members))rows.modify(it,same_payer,[&](auto& r){r.members=member_limit;r.expires=expires;r.receipt=receipt;});
    allocate_member_ram(dao_id,member_limit);
  }
  ACTION revokecap(uint64_t dao_id,checksum256 receipt) {
    auto cfg=hosted_settings(get_self(),get_self().value).get();require_auth(cfg.settler);capacity_receipts receipts(get_self(),get_self().value);auto index=receipts.get_index<"byreceipt"_n>();const auto& issued=index.get(receipt,"CAPACITY_RECEIPT");check(issued.dao_id==dao_id,"CAPACITY_RECEIPT");index.modify(issued,same_payer,[](auto& r){r.revoked=true;});dao_capacities rows(get_self(),get_self().value);auto cap=rows.find(dao_id);if(cap!=rows.end()&&cap->receipt==receipt)rows.modify(cap,same_payer,[](auto& r){r.expires=current_time_point().sec_since_epoch();});
  }
  ACTION resumecap(uint64_t dao_id,checksum256 receipt) {
    auto cfg=hosted_settings(get_self(),get_self().value).get();require_auth(cfg.settler);
    capacity_receipts receipts(get_self(),get_self().value);auto index=receipts.get_index<"byreceipt"_n>();const auto issued=index.get(receipt,"CAPACITY_RECEIPT");check(issued.dao_id==dao_id&&issued.expires>current_time_point().sec_since_epoch(),"CAPACITY_RECEIPT");
    index.modify(index.find(receipt),same_payer,[](auto& r){r.revoked=false;});setcapacity(dao_id,issued.members,issued.expires,receipt);
  }
  ACTION cardcreate(checksum256 reference,uint32_t usd_cents,checksum256 checkout_reference,uint32_t paid_at) {
    auto cfg=creation_settings(get_self(),get_self().value).get();require_auth(cfg.settler);check(checkout_reference!=checksum256(),"CREATION_CARD");
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();const auto& order=index.get(reference,"CREATION_UNKNOWN");
    check(order.method==1&&order.usd_cents==usd_cents,"CREATION_AMOUNT");check(paid_at>=order.created_at&&paid_at<=order.expires&&paid_at<=current_time_point().sec_since_epoch(),"CREATION_EXPIRED");
    if(order.paid){check(order.card_reference==checkout_reference,"CREATION_CARD");return;}
    auto cards=orders.get_index<"bycard"_n>();check(cards.find(checkout_reference)==cards.end(),"CREATION_CARD");
    index.modify(order,same_payer,[&](auto& r){r.paid=true;r.card_reference=checkout_reference;});
  }
  ACTION enroll(uint64_t dao_id,uint64_t member_id,name native_account,public_key signing_key,std::string encryption_key,uint8_t custody) {
    enroll_member(dao_id,member_id,native_account,signing_key,encryption_key,custody,0,"");
  }
  ACTION enrollagent(uint64_t dao_id,uint64_t member_id,name native_account,public_key signing_key,std::string encryption_key,uint8_t custody,std::string operator_label) {
    enroll_member(dao_id,member_id,native_account,signing_key,encryption_key,custody,1,operator_label);
  }
  ACTION addmember(name runtime,uint64_t dao_id,uint64_t member_id,public_key signing_key,std::string encryption_key,uint8_t custody,uint8_t kind,std::string operator_label) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);check(kind<=1,"PARTICIPANT_MODE");
    const auto& d=dao_rows.get(dao_id);check(d.max_member<std::numeric_limits<uint64_t>::max(),"MEMBER_LIMIT");
    enroll_member(dao_id,d.max_member+1,name{},signing_key,encryption_key,custody,kind,operator_label,false);
  }
  ACTION appoint(uint64_t dao_id,std::vector<uint64_t> member_ids,uint32_t inactivity_seconds,uint16_t quorum_bps){
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");native_governance_settings native(get_self(),get_self().value);
    if(native.exists()&&native.get().dao_id==dao_id)require_auth(permission_level{get_self(),native.get().handed_over?"govern"_n:"owner"_n});else require_auth(d.owner);
    replace_executives(dao_id,member_ids,inactivity_seconds,quorum_bps);cancel_executive_handover(dao_id);refresh_native_governance(dao_id);
  }
  ACTION setexecs(name runtime,uint64_t dao_id,uint64_t member_id,std::vector<uint64_t> member_ids,uint32_t inactivity_seconds,uint16_t quorum_bps){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);native_governance_settings native(get_self(),get_self().value);
    check(!native.exists()||native.get().dao_id!=dao_id,"NATIVE_GOVERNANCE_REQUIRED");replace_executives(dao_id,member_ids,inactivity_seconds,quorum_bps);cancel_executive_handover(dao_id);
  }
  ACTION setnativegov(uint64_t dao_id,std::vector<name> contracts,public_key service_key){
    require_auth(permission_level{get_self(),"owner"_n});dao_rows.get(dao_id,"DAO_UNKNOWN");native_governance_settings native(get_self(),get_self().value);check(!native.exists(),"NATIVE_GOVERNANCE_IMMUTABLE");
    check(contracts.size()<=16,"NATIVE_CONTRACT_LIMIT");std::sort(contracts.begin(),contracts.end());check(std::adjacent_find(contracts.begin(),contracts.end())==contracts.end(),"NATIVE_CONTRACT_DUPLICATE");for(auto account:contracts)check(account!=get_self()&&is_account(account),"NATIVE_CONTRACT");
    native.set(native_governance{dao_id,contracts,service_key,false,{},0},get_self());
  }
  ACTION handover(uint64_t dao_id,std::vector<name> expected_signers,uint32_t expected_threshold,uint64_t expected_revision){
    require_auth(permission_level{get_self(),"owner"_n});native_governance_settings native(get_self(),get_self().value);auto cfg=native.get();check(cfg.dao_id==dao_id&&!cfg.handed_over,"NATIVE_HANDOVER");for(auto account:cfg.contracts)require_auth(permission_level{account,"owner"_n});
    auto effective=effective_native_executives(dao_id);check(!effective.first.empty(),"NATIVE_EXECUTIVE_REQUIRED");std::vector<name> actual;for(auto signer:effective.first)actual.push_back(signer.actor);check(actual==expected_signers&&effective.second==expected_threshold&&executive_policies(get_self(),get_self().value).get(dao_id).revision==expected_revision,"NATIVE_HANDOVER_CHANGED");
    permission_level elected{get_self(),"govern"_n},code{get_self(),"eosio.code"_n};
    update_native_authority(get_self(),"govern"_n,"owner"_n,delegated_authority(effective.first,effective.second));
    update_native_authority(get_self(),"service"_n,"active"_n,native_authority{1,{{cfg.service_key,1}},{},{}});
    for(auto action_name:{"createdao"_n,"createpaid"_n,"initgov"_n,"enroll"_n,"enrollagent"_n,"setmodule"_n})action(permission_level{get_self(),"owner"_n},"eosio"_n,"linkauth"_n,std::make_tuple(get_self(),get_self(),action_name,"service"_n)).send();
    action(permission_level{get_self(),"owner"_n},"eosio"_n,"linkauth"_n,std::make_tuple(get_self(),get_self(),"appoint"_n,"govern"_n)).send();
    update_native_authority(get_self(),"active"_n,"owner"_n,delegated_authority({elected,code}));
    for(auto account:cfg.contracts){update_native_authority(account,"active"_n,"owner"_n,delegated_authority({elected,{account,"eosio.code"_n}}));update_native_authority(account,"owner"_n,name{},delegated_authority({elected}));}
    update_native_authority(get_self(),"owner"_n,name{},delegated_authority({elected,code}));
    members admins(get_self(),dao_id);for(auto it=admins.begin();it!=admins.end();++it)if(it->admin)admins.modify(it,same_payer,[](auto& r){r.admin=false;});
    dao_rows.modify(dao_rows.get(dao_id),same_payer,[&](auto& r){r.owner=get_self();r.admin_count=0;});
    cfg.handed_over=true;cfg.signers.clear();for(const auto& signer:effective.first)cfg.signers.push_back(signer.actor);cfg.threshold=effective.second;native.set(cfg,get_self());synchronize_executive_admins(dao_id,cfg.signers);
  }
  ACTION heartbeat(name runtime,uint64_t dao_id,uint64_t member_id){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);executives rows(get_self(),dao_id);auto it=rows.find(member_id);check(it!=rows.end(),"EXECUTIVE_REQUIRED");rows.modify(it,same_payer,[](auto& r){r.last_active=current_time_point().sec_since_epoch();});refresh_native_governance(dao_id);
  }
  ACTION refreshgov(name runtime,uint64_t dao_id,uint64_t member_id){check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);activate_executive_handover(dao_id);refresh_native_governance(dao_id);}
  ACTION syncexec(uint64_t dao_id){dao_rows.get(dao_id,"DAO_UNKNOWN");activate_executive_handover(dao_id);refresh_native_governance(dao_id);}
  ACTION electexec(name source,uint64_t dao_id,uint64_t election_id,std::vector<uint64_t> member_ids,uint32_t starts,uint32_t ends){
    require_source(dao_id,source,"electexec"_n);const auto policy=gov_policies(get_self(),get_self().value).get(dao_id,"POLICY_UNKNOWN");check(policy.config.decide==source,"POLICY_DECIDE");executive_policies policies(get_self(),get_self().value);check(policies.find(dao_id)!=policies.end(),"EXECUTIVE_POLICY_UNKNOWN");
    check(starts<ends&&current_time_point().sec_since_epoch()<ends&&starts>policies.get(dao_id).last_election_start,"EXECUTIVE_TERM");validate_executive_roster(dao_id,member_ids,false);executive_handovers rows(get_self(),get_self().value);auto old=rows.find(dao_id);check(old==rows.end(),"EXECUTIVE_HANDOVER_PENDING");rows.emplace(get_self(),[&](auto& r){r={dao_id,election_id,starts,ends,member_ids};});
    activate_executive_handover(dao_id);refresh_native_governance(dao_id);
  }
  ACTION recallexec(name source,uint64_t dao_id,uint64_t election_id,uint64_t member_id){
    require_source(dao_id,source,"electexec"_n);const auto policy=gov_policies(get_self(),get_self().value).get(dao_id,"POLICY_UNKNOWN");check(policy.config.decide==source,"POLICY_DECIDE");
    executive_handovers pending(get_self(),get_self().value);auto next=pending.find(dao_id);if(next!=pending.end()&&next->election_id==election_id)cancel_executive_handover(dao_id);
    executives offices(get_self(),dao_id);auto office=offices.find(member_id);if(office==offices.end()||office->election_id!=election_id)return;check(std::next(offices.begin())!=offices.end(),"LAST_EXECUTIVE");offices.erase(office);check_native_controller(dao_id);refresh_native_governance(dao_id);
  }
  ACTION setvoter(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t target,bool can_vote){
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");members(get_self(),dao_id).get(target,"MEMBER_UNKNOWN");nonvoters rows(get_self(),dao_id);auto old=rows.find(target);check(can_vote==(old!=rows.end()),"ALREADY_IN_STATE");if(can_vote)rows.erase(old);else rows.emplace(get_self(),[&](auto& r){r.member_id=target;});
  }
  ACTION initgov(uint64_t dao_id,gov_settings settings) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");require_auth(d.owner);check(d.max_member==0,"BOOTSTRAP_ONLY");
    gov_policies rows(get_self(),get_self().value);check(rows.find(dao_id)==rows.end(),"POLICY_EXISTS");validate_policy(settings);
    rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.config=settings;});
  }
  ACTION setdaogov(name runtime,uint64_t dao_id,uint64_t member_id,gov_settings settings) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);validate_policy(settings);
    const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");
    gov_policies rows(get_self(),get_self().value);auto found=rows.find(dao_id);
    if(found==rows.end()){check(settings.participant_mode!=2,"PARTICIPANT_MODE");rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.config=settings;});}
    else{check(settings.participant_mode==found->config.participant_mode&&settings.guardian==found->config.guardian&&settings.decide==found->config.decide,"POLICY_IDENTITY_IMMUTABLE");rows.modify(found,same_payer,[&](auto& r){r.revision=add64(r.revision,1);r.config=settings;});}
  }
  ACTION addsession(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t session_id,public_key signing_key,uint32_t expires,std::vector<session_permission> permissions) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    auto now=current_time_point().sec_since_epoch();check(session_id>0&&expires>now&&uint64_t(expires)<=uint64_t(now)+604800,"SESSION_EXPIRY");
    check(!permissions.empty()&&permissions.size()<=16,"SESSION_SCOPE");check_unique_key(dao_id,signing_key);
    scoped_sessions rows(get_self(),dao_id);check(rows.find(session_id)==rows.end(),"SESSION_EXISTS");auto index=rows.get_index<"bymember"_n>();uint32_t count=0;
    for(auto it=index.lower_bound(member_id);it!=index.end()&&it->member_id==member_id;++it)++count;
    check(count<16,"SESSION_LIMIT");
    for(size_t i=0;i<permissions.size();i++){
      const auto& permission=permissions[i];
      for(size_t j=0;j<i;j++)check(permission.target!=permissions[j].target||permission.action!=permissions[j].action,"SESSION_SCOPE");
      if(permission.target==get_self()){check((permission.action=="putjson"_n||permission.action=="putdoc"_n)&&permission.code_hash==checksum256(),"SESSION_SCOPE");}
      else{check(permission.action=="open"_n||permission.action=="vote"_n||permission.action=="openwork"_n||permission.action=="propose"_n||permission.action=="submitwork"_n||permission.action=="review"_n,"SESSION_SCOPE");modules installed(get_self(),dao_id);const auto& grant=installed.get(permission.target.value,"MODULE_DISABLED");check_pinned(grant,permission.target);check(permission.code_hash==grant.code_hash&&std::find(grant.actions.begin(),grant.actions.end(),permission.action)!=grant.actions.end(),"SESSION_SCOPE");}
    }
    rows.emplace(get_self(),[&](auto& r){r.id=session_id;r.member_id=member_id;r.signing_key=signing_key;r.expires=expires;r.credential_epoch=credential_epoch(get_self(),dao_id,member_id);r.permissions=permissions;});
  }
  ACTION delsession(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t session_id) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    scoped_sessions rows(get_self(),dao_id);const auto& r=rows.get(session_id,"SESSION_UNKNOWN");check(r.member_id==member_id,"SESSION_MEMBER");rows.erase(r);
  }
  ACTION guardpause(uint64_t dao_id,uint32_t until,checksum256 reason) {
    require_guardian(dao_id);auto now=current_time_point().sec_since_epoch();check(until>now&&uint64_t(until)<=uint64_t(now)+86400,"PAUSE_DURATION");check(reason!=checksum256(),"PAUSE_REASON");
    guardian_states rows(get_self(),get_self().value);auto found=rows.find(dao_id);
    if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.paused_until=until;r.reason=reason;});
    else{check(until>=found->paused_until,"PAUSE_DURATION");rows.modify(found,same_payer,[&](auto& r){r.paused_until=until;r.reason=reason;});}
  }
  ACTION guardrevoke(uint64_t dao_id,uint64_t member_id) {
    require_guardian(dao_id);participants rows(get_self(),dao_id);const auto& p=rows.get(member_id,"AGENT_UNKNOWN");check(p.kind==1,"AGENT_REQUIRED");
    rows.modify(p,same_payer,[&](auto& r){r.revoked=true;r.credential_epoch=add64(r.credential_epoch,1);});check_native_controller(dao_id);refresh_native_governance(dao_id);
  }
  ACTION guardrecover(uint64_t dao_id,uint64_t member_id,public_key signing_key) {
    require_guardian(dao_id);participants rows(get_self(),dao_id);const auto& p=rows.get(member_id,"AGENT_UNKNOWN");check(p.kind==1&&p.revoked,"AGENT_RECOVERY");
    check_unique_key(dao_id,signing_key);members people(get_self(),dao_id);const auto& m=people.get(member_id,"MEMBER_UNKNOWN");
    people.modify(m,same_payer,[&](auto& r){r.signing_key=signing_key;r.native_account=name{};});check_native_controller(dao_id);refresh_native_governance(dao_id);
    evm_bindings bindings(get_self(),dao_id);auto binding=bindings.find(member_id);if(binding!=bindings.end())bindings.modify(binding,same_payer,[](auto& r){r.active=false;r.epoch=add64(r.epoch,1);});
    rows.modify(p,same_payer,[&](auto& r){r.revoked=false;r.credential_epoch=add64(r.credential_epoch,1);});
  }
  ACTION setadmit(name runtime,uint64_t dao_id,uint64_t member_id,bool enabled,name source,uint8_t threshold,bool allow_agents,bool admin_override){
    authorized_actor(runtime,dao_id,member_id,true);check(threshold>=1&&threshold<=20,"ENDORSEMENT_THRESHOLD");if(enabled){modules installed(get_self(),dao_id);const auto& grant=installed.get(source.value,"MODULE_DISABLED");check_pinned(grant,source);check(std::find(grant.grants.begin(),grant.grants.end(),"admit"_n)!=grant.grants.end(),"MODULE_GRANT");}
    admission_policies rows(get_self(),get_self().value);auto found=rows.find(dao_id);auto update=[&](auto& r){r.mode=enabled?1:0;r.source=enabled?source:name{};r.threshold=threshold;r.allow_agents=allow_agents;r.admin_override=enabled&&admin_override;};if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;update(r);});else rows.modify(found,same_payer,[&](auto& r){r.revision=add64(r.revision,1);update(r);});
  }
  ACTION admitfrom(uint64_t dao_id,name source,uint64_t application_id,uint64_t revision){
    require_source(dao_id,source,"admit"_n);admission_policies policies(get_self(),get_self().value);const auto& policy=policies.get(dao_id,"ADMISSION_POLICY_UNKNOWN");check(policy.mode==1&&policy.source==source,"ADMISSION_POLICY_CHANGED");admission_applications apps(source,get_self().value);const auto& app=apps.get(application_id,"APPLICATION_UNKNOWN");check(app.dao_id==dao_id&&app.admitted&&app.revision==revision&&app.policy_revision==policy.revision,"APPLICATION_DOMAIN");check(current_time_point().sec_since_epoch()<app.expires,"APPLICATION_EXPIRED");
    enroll_member(dao_id,app.member_id,name{},app.signing_key,app.encryption_key,app.custody,app.kind,app.operator_label,false,true);
  }
private:
  void enroll_member(uint64_t dao_id,uint64_t member_id,name native_account,public_key signing_key,const std::string& encryption_key,uint8_t custody,uint8_t kind,const std::string& operator_label,bool owner_auth=true,bool endorsed=false) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN"); if(owner_auth){require_auth(d.owner);native_governance_settings native(get_self(),get_self().value);if(native.exists()&&native.get().handed_over&&native.get().dao_id==dao_id)require_auth(permission_level{get_self(),"active"_n});}
    check_member_capacity(d);
    admission_policies admission(get_self(),get_self().value);auto rule=admission.find(dao_id);check(endorsed||rule==admission.end()||rule->mode==0||rule->admin_override,"ADMISSION_REQUIRED");
    gov_policies policies(get_self(),get_self().value);auto policy=policies.find(dao_id);
    check(kind==0||(policy!=policies.end()&&policy->config.participant_mode>0),"PARTICIPANT_MODE");
    check(kind==1||policy==policies.end()||policy->config.participant_mode!=2,"PARTICIPANT_MODE");
    if(kind==1){check(!operator_label.empty()&&operator_label.size()<=64,"AGENT_OPERATOR");for(unsigned char c:operator_label)check(c>=0x20&&c<=0x7e,"AGENT_OPERATOR");}
    check(member_id>d.max_member&&member_id>0,"MEMBER_ID"); check(d.member_count<5000,"MEMBER_LIMIT");
    check(custody<=1&&!(d.privacy==2&&custody==1),"CUSTODY_POLICY");
    check(!encryption_key.empty()&&encryption_key.size()<=1024,"ENCRYPTION_KEY");
    check(!native_account.value||is_account(native_account),"NATIVE_ACCOUNT");
    members rows(get_self(),dao_id);
    if(native_account.value) { auto index=rows.get_index<"bynative"_n>(); check(index.find(native_account.value)==index.end(),"CREDENTIAL_EXISTS"); }
    auto key_index=rows.get_index<"bykey"_n>(); auto packed=pack(signing_key);
    check(key_index.find(sha256(packed.data(),packed.size()))==key_index.end(),"CREDENTIAL_EXISTS");
    if(native_account.value) require_auth(native_account);
    check_unique_key(dao_id,signing_key);
    const bool first=d.max_member==0;
    rows.emplace(get_self(),[&](auto& m){m.id=member_id;m.native_account=native_account;m.signing_key=signing_key;m.encryption_key=encryption_key;m.custody=custody;m.admin=first;m.join_epoch=d.key_epoch;});
    dao_rows.modify(d,same_payer,[&](auto& r){r.member_count++;r.max_member=member_id;if(first)r.admin_count++;});
    participants actors(get_self(),dao_id);actors.emplace(get_self(),[&](auto& r){r.id=member_id;r.kind=kind;if(kind==1)r.operator_label=operator_label;});
  }
public:
  ACTION submit(instruction request,signature sig) {
    validate_instruction(request);
    members rows(get_self(),request.dao_id); const auto& m=rows.get(request.member_id,"MEMBER_UNKNOWN");
    auto packed=pack(request); auto digest=sha256(packed.data(),packed.size());
    assert_recover_key(digest,sig,m.signing_key);
    dispatch(request);
  }
  ACTION submitsess(instruction request,uint64_t session_id,signature sig) {
    validate_instruction(request);scoped_sessions sessions(get_self(),request.dao_id);const auto& credential=sessions.get(session_id,"SESSION_UNKNOWN");
    check(credential.member_id==request.member_id,"SESSION_MEMBER");check(credential.expires>current_time_point().sec_since_epoch(),"SESSION_EXPIRED");
    check(credential.credential_epoch==credential_epoch(get_self(),request.dao_id,request.member_id),"SESSION_REVOKED");
    bool permitted=false;for(const auto& permission:credential.permissions)if(permission.target==request.target&&permission.action==request.action){permitted=true;if(permission.target!=get_self())check(permission.code_hash==get_code_hash(permission.target),"SESSION_REVOKED");}
    check(permitted,"SESSION_SCOPE");auto packed=pack(request);assert_recover_key(sha256(packed.data(),packed.size()),sig,credential.signing_key);
    dispatch(request);
  }
  ACTION submitnat(instruction request) {
    validate_instruction(request); members rows(get_self(),request.dao_id);
    const auto& m=rows.get(request.member_id,"MEMBER_UNKNOWN"); check(m.native_account.value,"NATIVE_UNLINKED");
    require_auth(m.native_account); dispatch(request);
  }
  ACTION submitevm(instruction request,uint64_t evm_chain_id,checksum160 address,uint64_t binding_epoch,std::vector<char> proof) {
    validate_instruction(request);evm_bindings bindings(get_self(),request.dao_id);const auto& binding=bindings.get(request.member_id,"EVM_UNLINKED");
    check(binding.active&&binding.chain_id==evm_chain_id&&binding.address==address&&binding.epoch==binding_epoch,"EVM_BINDING");
    const auto data_hash=sha256(request.data.data(),request.data.size()).extract_as_byte_array();
    const auto body=evm_hash_words({evm_text("DaclifyInstruction(uint16 version,bytes32 nativeChain,uint64 runtime,uint64 daoId,uint64 memberId,uint64 evmChainId,address wallet,uint64 bindingEpoch,uint64 nonce,uint32 expires,uint64 target,uint64 action,bytes32 dataHash,uint16 signatureVersion)"),evm_uint(request.version),request.chain_id.extract_as_byte_array(),evm_uint(request.deployment.value),evm_uint(request.dao_id),evm_uint(request.member_id),evm_uint(evm_chain_id),evm_address_word(address),evm_uint(binding_epoch),evm_uint(request.nonce),evm_uint(request.expires),evm_uint(request.target.value),evm_uint(request.action.value),data_hash,evm_uint(1)});
    check(recover_evm_address(evm_typed_digest(request.chain_id,get_self(),evm_chain_id,body),proof)==address,"EVM_ADDRESS");dispatch(request);
  }
  ACTION setmeta(name runtime,uint64_t dao_id,uint64_t member_id,std::string metadata) {
    authorized_actor(runtime,dao_id,member_id,true); validate_dao_metadata(metadata);
    const auto& d=dao_rows.get(dao_id);
    const auto before=nlohmann::json::parse(d.metadata);const auto after=nlohmann::json::parse(metadata);
    if(before.is_object()&&before.contains("schemaVersion")&&(before["schemaVersion"]==2||before["schemaVersion"]==3)&&before.contains("setup")){
      check(after.is_object()&&after.contains("schemaVersion")&&(after["schemaVersion"]==2||after["schemaVersion"]==3)&&after.contains("setup")&&after["setup"]==before["setup"]&&after.contains("purpose")&&before.contains("purpose")&&after["purpose"]==before["purpose"],"PRESET_IDENTITY_IMMUTABLE");
      if(before["schemaVersion"]==3)check(after["schemaVersion"]==3,"METADATA_VERSION");
    }else if(after.is_object()&&after.contains("schemaVersion")){
      if(after["schemaVersion"]==3)check(after["setup"].is_null()&&after["purpose"]=="custom","PRESET_IDENTITY_IMMUTABLE");
    }
    dao_rows.modify(d,same_payer,[&](auto& r){r.metadata=metadata;});
  }
  ACTION setprofile(name runtime,uint64_t dao_id,uint64_t member_id,name account_name,std::string profile) {
    authorized_actor(runtime,dao_id,member_id);validate_profile(profile,account_name);
    profiles rows(get_self(),get_self().value);auto members_index=rows.get_index<"bymember"_n>();auto names=rows.get_index<"byname"_n>();
    auto mine=members_index.find((uint128_t(dao_id)<<64)|member_id);auto taken=names.find(account_name.value);
    if(mine==members_index.end()){check(taken==names.end(),"NAME_TAKEN");rows.emplace(get_self(),[&](auto& r){r.id=rows.available_primary_key();r.dao_id=dao_id;r.member_id=member_id;r.account_name=account_name;r.profile=profile;});}
    else{check(mine->account_name==account_name,"NAME_IMMUTABLE");check(taken==names.end()||taken->id==mine->id,"NAME_TAKEN");members_index.modify(mine,same_payer,[&](auto& r){r.profile=profile;});}
  }
  ACTION grantcredit(uint64_t dao_id,uint64_t member_id,uint64_t quantity) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN"); require_auth(d.owner); check(quantity>0,"QUANTITY"); check(d.active_ballots==0,"GOVERNANCE_LOCKED");
    members rows(get_self(),dao_id); const auto& m=rows.get(member_id,"MEMBER_UNKNOWN"); check(m.active,"MEMBER_INACTIVE");
    rows.modify(m,same_payer,[&](auto& r){r.credits=add64(r.credits,quantity);});
    dao_rows.modify(d,same_payer,[&](auto& r){r.credit_supply=add64(r.credit_supply,quantity);r.eligible_credits=add64(r.eligible_credits,quantity);});
  }
  ACTION setmodule(uint64_t dao_id,name account,uint16_t version,std::vector<name> actions,std::vector<name> grants,checksum256 code_hash) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");require_auth(d.owner);native_governance_settings native(get_self(),get_self().value);if(native.exists()&&native.get().handed_over&&native.get().dao_id==dao_id)require_auth(permission_level{get_self(),"active"_n});install_module(dao_id,account,version,actions,grants,code_hash);
  }
  ACTION modconfig(name runtime,uint64_t dao_id,uint64_t member_id,name account,uint16_t version,std::vector<name> actions,std::vector<name> grants,checksum256 code_hash) {
    authorized_actor(runtime,dao_id,member_id,true);install_module(dao_id,account,version,actions,grants,code_hash);
  }
  // Platform shares are basis points of a module charge. 10000 keeps the whole charge.
  // Governance of this contract can raise or lower either share later.
  ACTION setfees(uint16_t third_party_bps,uint16_t first_party_bps,name treasury,name token_contract,symbol token_symbol,name names) {
    require_auth(get_self());
    check(third_party_bps<=10000&&first_party_bps<=10000,"FEE_BPS");
    check(is_account(treasury)&&treasury!=get_self()&&is_account(token_contract),"FEE_ACCOUNT");
    check(token_symbol.is_valid(),"FEE_SYMBOL");
    check(!names.value||is_account(names),"FEE_ACCOUNT");
    fee_settings saved(get_self(),get_self().value);
    if(saved.exists()){
      const auto previous=saved.get();
      if(previous.token_contract!=token_contract||previous.token_symbol!=token_symbol){
        check(!creation_settings(get_self(),get_self().value).exists(),"CREATION_ASSET_IMMUTABLE");
        catalogue listed(get_self(),get_self().value);check(listed.begin()==listed.end(),"FEE_SYMBOL");
      }
    }
    saved.set(fee_config{third_party_bps,first_party_bps,treasury,token_contract,token_symbol,names},get_self());
    if(names.value)action(permission_level{get_self(),"active"_n},names,"setrates"_n,std::make_tuple(get_self(),third_party_bps,first_party_bps,treasury,token_contract,token_symbol)).send();
  }
  // party 0 is a Daclify module. party 1 is a module someone else listed.
  // accepts_fee_rule must be 1. A refused rule is not stored.
  ACTION listmod(name account,name publisher,uint8_t party,uint8_t accepts_fee_rule,asset price,checksum256 code_hash,std::string title) {
    const auto cfg=fee_configuration();
    check(accepts_fee_rule==1,"FEE_RULE");
    check(party<=1,"FEE_PARTY");
    check(is_account(account)&&account!=get_self(),"MODULE_ACCOUNT");
    check(is_account(publisher),"FEE_ACCOUNT");
    if(party==0){require_auth(get_self());check(publisher==cfg.treasury,"FEE_ACCOUNT");}
    else{require_auth(publisher);check(publisher!=cfg.treasury,"FEE_PARTY");}
    save_listing(account,publisher,party,accepts_fee_rule,price,code_hash,title);
  }
  ACTION unlistmod(name account) {
    catalogue rows(get_self(),get_self().value);const auto& item=rows.get(account.value,"MODULE_UNLISTED");
    if(has_auth(get_self()))require_auth(get_self());else require_auth(item.publisher);
    remove_listing(account);
  }
  ACTION setmodcopy(name account,std::string summary,std::string detail) {
    catalogue listed(get_self(),get_self().value);const auto& item=listed.get(account.value,"MODULE_UNLISTED");
    if(item.party==0)require_auth(get_self());else require_auth(item.publisher);
    save_copy(account,summary,detail);
  }
  // Contract authority until setgov links a DAO. Admins then use govfees.
  ACTION setpolicy(uint16_t bump_bps,uint16_t quote_premium_bps) {
    require_auth(get_self());
    market_settings saved(get_self(),get_self().value);
    publish_policy(bump_bps,quote_premium_bps,saved.exists()?saved.get().dao_id:0);
  }
  ACTION setgov(uint64_t dao_id) {
    require_auth(get_self());
    if(dao_id)dao_rows.get(dao_id,"DAO_UNKNOWN");
    market_settings saved(get_self(),get_self().value);
    const uint16_t bump=saved.exists()?saved.get().bump_bps:2000;
    const uint16_t premium=saved.exists()?saved.get().quote_premium_bps:2000;
    publish_policy(bump,premium,dao_id);
  }
  ACTION setoracle(uint64_t median,uint8_t quoted_precision,uint32_t observed_at) {
    require_auth(get_self());
    const auto cfg=fee_configuration();
    check(cfg.names.value,"FEE_ACCOUNT");
    action(permission_level{get_self(),"active"_n},cfg.names,"setoracle"_n,std::make_tuple(get_self(),median,quoted_precision,observed_at)).send();
  }
  ACTION govfees(name runtime,uint64_t dao_id,uint64_t member_id,uint16_t third_party_bps,uint16_t first_party_bps,uint16_t bump_bps,uint16_t quote_premium_bps) {
    authorized_actor(runtime,dao_id,member_id,true);
    market_settings saved(get_self(),get_self().value);
    check(saved.exists()&&saved.get().dao_id==dao_id&&dao_id!=0,"DAO_UNKNOWN");
    check(third_party_bps<=10000&&first_party_bps<=10000,"FEE_BPS");
    auto cfg=fee_configuration();
    cfg.third_party_bps=third_party_bps;cfg.first_party_bps=first_party_bps;
    fee_settings(get_self(),get_self().value).set(cfg,get_self());
    if(cfg.names.value)action(permission_level{get_self(),"active"_n},cfg.names,"setrates"_n,std::make_tuple(get_self(),third_party_bps,first_party_bps,cfg.treasury,cfg.token_contract,cfg.token_symbol)).send();
    publish_policy(bump_bps,quote_premium_bps,dao_id);
  }
  ACTION govlist(name runtime,uint64_t dao_id,uint64_t member_id,name account,asset price,checksum256 code_hash,std::string title) {
    platform_actor(runtime,dao_id,member_id);auto cfg=fee_configuration();save_listing(account,cfg.treasury,0,1,price,code_hash,title);
  }
  ACTION govpayfees(name runtime,uint64_t dao_id,uint64_t member_id,uint16_t bps) {
    platform_actor(runtime,dao_id,member_id);check(bps<10000,"FEE_BPS");
    payment_settings saved(get_self(),get_self().value);auto cfg=saved.exists()?saved.get():payment_policy{};
    cfg.bps=bps;cfg.revision=add64(cfg.revision,1);saved.set(cfg,get_self());
  }
  ACTION govunlist(name runtime,uint64_t dao_id,uint64_t member_id,name account) {
    platform_actor(runtime,dao_id,member_id);remove_listing(account);
  }
  ACTION govmodcopy(name runtime,uint64_t dao_id,uint64_t member_id,name account,std::string summary,std::string detail) {
    platform_actor(runtime,dao_id,member_id);catalogue listed(get_self(),get_self().value);check(listed.get(account.value,"MODULE_UNLISTED").party==0,"FEE_PARTY");save_copy(account,summary,detail);
  }
  ACTION setcredits(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t target,uint64_t quantity) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");members rows(get_self(),dao_id);const auto& m=rows.get(target,"MEMBER_UNKNOWN");
    dao_rows.modify(d,same_payer,[&](auto& r){if(quantity>=m.credits){r.credit_supply=add64(r.credit_supply,quantity-m.credits);if(m.active)r.eligible_credits=add64(r.eligible_credits,quantity-m.credits);}else{r.credit_supply-=m.credits-quantity;if(m.active)r.eligible_credits-=m.credits-quantity;}});rows.modify(m,same_payer,[&](auto& r){r.credits=quantity;});
  }
  ACTION reserve(uint64_t dao_id,name source,uint64_t source_id,uint64_t recipient,asset quantity,uint32_t due) {
    require_source(dao_id,source,"reserve"_n);const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");
    check(source_id>0,"OBLIGATION_ID");check(quantity.symbol==d.token_symbol&&quantity.amount>0,"ASSET_QUANTITY");
    members people(get_self(),dao_id);check(people.get(recipient,"MEMBER_UNKNOWN").active,"MEMBER_INACTIVE");
    check(quantity.amount<=d.available,"INSUFFICIENT_AVAILABLE");
    check(!dao_paused(get_self(),dao_id),"DAO_PAUSED");charge_commitment(dao_id,quantity.amount);
    obligations rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();check(index.find(source_hash(source,source_id))==index.end(),"OBLIGATION_EXISTS");
    auto next=rows.available_primary_key();check(next<std::numeric_limits<uint64_t>::max(),"OBLIGATION_LIMIT");if(next==0)next=1;
    rows.emplace(get_self(),[&](auto& r){r.id=next;r.source=source;r.source_id=source_id;r.recipient=recipient;r.quantity=quantity;r.due=due;r.status=0;});
    hold_obligation_receipts(get_self(),dao_id,next,recipient);
    dao_rows.modify(d,same_payer,[&](auto& r){r.available=add_amount(r.available,-quantity.amount);r.reserved=add_amount(r.reserved,quantity.amount);});
  }
  ACTION approveob(uint64_t dao_id,name source,uint64_t source_id) {
    check(!dao_paused(get_self(),dao_id),"DAO_PAUSED");
    require_source(dao_id,source,"approve"_n);obligations rows(get_self(),dao_id);auto id=obligation_id(rows,source,source_id);const auto& o=rows.get(id);
    check(o.status==0,"NOT_APPROVABLE");rows.modify(o,same_payer,[](auto& r){r.status=1;});
  }
  ACTION cancelob(uint64_t dao_id,name source,uint64_t source_id) {
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");if(!has_auth(d.owner))require_source(dao_id,source,"cancel"_n);else require_auth(d.owner);
    obligations rows(get_self(),dao_id);const auto& o=rows.get(obligation_id(rows,source,source_id));check(o.status==0,"NOT_CANCELLABLE");
    dao_rows.modify(d,same_payer,[&](auto& r){r.reserved=add_amount(r.reserved,-o.quantity.amount);r.available=add_amount(r.available,o.quantity.amount);});
    rows.modify(o,same_payer,[](auto& r){r.status=3;});settle_receipt_hold(get_self(),dao_id,o.id,false);
  }
  ACTION confirmext(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t obligation_id,std::string chain,std::string payer,uint64_t recipient,asset quantity,checksum256 reference) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);
    auto text=[](const std::string& value,size_t max,const char* error){check(value.size()>=1&&value.size()<=max,error);for(unsigned char c:value)check(c>=0x21&&c<=0x7e,error);};
    text(chain,64,"EVIDENCE_CHAIN");text(payer,128,"EVIDENCE_PAYER");check(reference!=checksum256(),"EVIDENCE_REFERENCE");
    obligations debts(get_self(),dao_id);const auto& obligation=debts.get(obligation_id,"OBLIGATION_UNKNOWN");
    check(obligation.status==1,"EVIDENCE_STATE");check(obligation.recipient==recipient,"EVIDENCE_RECIPIENT");check(obligation.quantity==quantity,"EVIDENCE_AMOUNT");
    evidence rows(get_self(),get_self().value);auto index=rows.get_index<"byref"_n>();check(index.find(reference)==index.end(),"EVIDENCE_REUSED");
    auto id=rows.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"EVIDENCE_LIMIT");
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.dao_id=dao_id;r.obligation_id=obligation_id;r.recipient=recipient;r.quantity=quantity;r.chain=chain;r.payer=payer;r.reference=reference;r.mode=1;});
  }
  ACTION payob(uint64_t dao_id,name source,uint64_t source_id) {
    check(!dao_paused(get_self(),dao_id),"DAO_PAUSED");
    const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");obligations rows(get_self(),dao_id);const auto& o=rows.get(obligation_id(rows,source,source_id));
    check(o.status==1&&o.due<=current_time_point().sec_since_epoch(),"NOT_PAYABLE");
    members people(get_self(),dao_id);const auto& m=people.get(o.recipient,"MEMBER_UNKNOWN");
    auto quantity=o.quantity;auto destination=m.native_account;
    rows.modify(o,same_payer,[](auto& r){r.status=2;});
    dao_rows.modify(d,same_payer,[&](auto& r){r.reserved=add_amount(r.reserved,-quantity.amount);if(!destination.value)r.claims=add_amount(r.claims,quantity.amount);});
    if(destination.value)send_payout(d.token_contract,destination,quantity,"Daclify approved obligation");
    else people.modify(m,same_payer,[&](auto& r){r.claim=add_amount(r.claim,quantity.amount);});
    settle_receipt_hold(get_self(),dao_id,o.id,!destination.value);
    receipt(dao_id,destination.value?1:0,o.id,o.recipient,destination,d.token_contract,quantity);
  }
  ACTION putdoc(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t document_id,uint32_t version,std::string cid,std::string metadata,checksum256 commitment,uint32_t bytes,uint16_t envelope_version,uint64_t key_epoch) {
    authorized_actor(runtime,dao_id,member_id);const auto& d=dao_rows.get(dao_id);check(document_id>0&&version>0,"DOCUMENT_ID");validate_cid(cid);validate_metadata(metadata);check(bytes<=100000000,"CONTENT_SIZE");
    check(envelope_version<=1,"ENVELOPE_VERSION");
    if(d.privacy){check(envelope_version==1,"PRIVACY_ENVELOPE");check(metadata=="{}","PRIVATE_METADATA");check(key_epoch==d.key_epoch,"KEY_EPOCH");require_epoch(dao_id,key_epoch);}else check(envelope_version==0&&key_epoch==0,"PUBLIC_ENVELOPE");
    append_document(dao_id,member_id,document_id,version,cid,metadata,commitment,bytes,envelope_version,key_epoch);
  }
  ACTION putjson(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t document_id,uint32_t version,std::string value,uint16_t envelope_version,uint64_t key_epoch) {
    authorized_actor(runtime,dao_id,member_id);const auto& d=dao_rows.get(dao_id);check(document_id>0&&version>0,"DOCUMENT_ID");validate_metadata(value);
    if(d.privacy){check(envelope_version==1&&key_epoch==d.key_epoch,"PRIVACY_ENVELOPE");require_epoch(dao_id,key_epoch);validate_envelope(value);}else check(envelope_version==0&&key_epoch==0,"PUBLIC_ENVELOPE");
    append_document(dao_id,member_id,document_id,version,"",value,sha256(value.data(),value.size()),value.size(),envelope_version,key_epoch);
  }
  ACTION commitepoch(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t epoch,checksum256 commitment,std::string self_grant) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.privacy>0,"DAO_PUBLIC");check(epoch==d.key_epoch,"KEY_EPOCH");check(commitment!=checksum256{},"EPOCH_COMMITMENT");epochs rows(get_self(),dao_id);check(rows.find(epoch)==rows.end(),"EPOCH_COMMITTED");rows.emplace(get_self(),[&](auto& r){r.epoch=epoch;r.commitment=commitment;r.creator=member_id;});
    // Commit and the founder's encrypted grant are atomic, so a lost client cannot strand a key between transactions.
    grantkey(runtime,dao_id,member_id,member_id,epoch,self_grant);
  }
  ACTION rotateepoch(name runtime,uint64_t dao_id,uint64_t member_id) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.privacy>0,"DAO_PUBLIC");dao_rows.modify(d,same_payer,[](auto& r){r.key_epoch=add64(r.key_epoch,1);});
  }
  ACTION rotatekey(name runtime,uint64_t dao_id,uint64_t member_id,public_key signing_key) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    members rows(get_self(),dao_id);const auto& m=rows.get(member_id,"MEMBER_UNKNOWN");
    auto packed=pack(signing_key);auto digest=sha256(packed.data(),packed.size());check(digest!=m.by_key(),"SIGNING_KEY");
    auto index=rows.get_index<"bykey"_n>();check(index.find(digest)==index.end(),"CREDENTIAL_EXISTS");
    check_unique_key(dao_id,signing_key);bump_credentials(dao_id,member_id);
    rows.modify(m,same_payer,[&](auto& r){r.signing_key=signing_key;});
  }
  ACTION linknative(name runtime,uint64_t dao_id,uint64_t member_id,name account) {
    check(get_sender()==get_self(),"ACTOR_SENDER");
    authorized_actor(runtime,dao_id,member_id);require_auth(account);check(is_account(account),"NATIVE_ACCOUNT");members rows(get_self(),dao_id);
    auto index=rows.get_index<"bynative"_n>();auto linked=index.find(account.value);check(linked==index.end()||linked->id==member_id,"CREDENTIAL_EXISTS");
    const auto& m=rows.get(member_id);check(m.native_account!=account,"ALREADY_IN_STATE");bump_credentials(dao_id,member_id);rows.modify(m,same_payer,[&](auto& r){r.native_account=account;});activate_executive_handover(dao_id);check_native_controller(dao_id);refresh_native_governance(dao_id);
  }
  ACTION unlinknat(name runtime,uint64_t dao_id,uint64_t member_id) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);
    members rows(get_self(),dao_id);const auto& m=rows.get(member_id);check(m.native_account.value,"NATIVE_UNLINKED");bump_credentials(dao_id,member_id);rows.modify(m,same_payer,[](auto& r){r.native_account=name{};});check_native_controller(dao_id);refresh_native_governance(dao_id);
  }
  ACTION linkevm(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t evm_chain_id,checksum160 address,uint64_t epoch,uint64_t nonce,uint32_t expires,std::vector<char> proof) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);check((evm_chain_id==40||evm_chain_id==41)&&address!=checksum160{},"EVM_CHAIN_ADDRESS");
    members people(get_self(),dao_id);const auto& member=people.get(member_id);check(member.nonce>0&&nonce==member.nonce-1,"NONCE");
    const auto now=current_time_point().sec_since_epoch();check(expires>now&&uint64_t(expires)<=uint64_t(now)+900,"EXPIRED_OR_TOO_LONG");
    evm_bindings bindings(get_self(),dao_id);const auto previous=bindings.find(member_id);check(epoch==(previous==bindings.end()?1:add64(previous->epoch,1)),"EVM_BINDING_EPOCH");
    const auto lookup=pack(std::make_tuple(evm_chain_id,address));const auto wallet=bindings.get_index<"bywallet"_n>();const auto owner=wallet.find(sha256(lookup.data(),lookup.size()));check(owner==wallet.end()||owner->member_id==member_id,"CREDENTIAL_EXISTS");
    const auto chain=configuration().chain_id;
    const auto body=evm_hash_words({evm_text("DaclifyBinding(bytes32 nativeChain,uint64 runtime,uint64 daoId,uint64 memberId,uint64 evmChainId,address wallet,uint64 epoch,uint64 nonce,uint32 expires,uint16 signatureVersion)"),chain.extract_as_byte_array(),evm_uint(get_self().value),evm_uint(dao_id),evm_uint(member_id),evm_uint(evm_chain_id),evm_address_word(address),evm_uint(epoch),evm_uint(nonce),evm_uint(expires),evm_uint(1)});
    check(recover_evm_address(evm_typed_digest(chain,get_self(),evm_chain_id,body),proof)==address,"EVM_ADDRESS");
    bump_credentials(dao_id,member_id);
    if(previous==bindings.end())bindings.emplace(get_self(),[&](auto& r){r.member_id=member_id;r.chain_id=evm_chain_id;r.address=address;r.epoch=epoch;});else bindings.modify(previous,same_payer,[&](auto& r){r.chain_id=evm_chain_id;r.address=address;r.epoch=epoch;r.active=true;});
  }
  ACTION unlinkevm(name runtime,uint64_t dao_id,uint64_t member_id) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id);evm_bindings bindings(get_self(),dao_id);const auto& binding=bindings.get(member_id,"EVM_UNLINKED");check(binding.active,"EVM_UNLINKED");bump_credentials(dao_id,member_id);bindings.modify(binding,same_payer,[](auto& r){r.active=false;r.epoch=add64(r.epoch,1);});
  }
  ACTION setactive(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t target,bool active) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);members rows(get_self(),dao_id);const auto& m=rows.get(target,"MEMBER_UNKNOWN");check(m.active!=active,"ALREADY_IN_STATE");
    if(active)check_member_capacity(d);
    if(active)check(d.active_ballots==0,"GOVERNANCE_LOCKED");if(!active&&m.admin)check(d.admin_count>1,"LAST_ADMIN");
    dao_rows.modify(d,same_payer,[&](auto& r){if(active){r.member_count++;if(m.admin)r.admin_count++;r.eligible_credits=add64(r.eligible_credits,m.credits);r.eligible_stake=add_amount(r.eligible_stake,m.stake);}else{r.member_count--;if(m.admin)r.admin_count--;r.eligible_credits-=m.credits;r.eligible_stake=add_amount(r.eligible_stake,-m.stake);if(r.privacy)r.key_epoch=add64(r.key_epoch,1);}});
    rows.modify(m,same_payer,[&](auto& r){r.active=active;});check_native_controller(dao_id);refresh_native_governance(dao_id);
  }
  ACTION setroles(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t target,bool admin,bool reviewer) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);members rows(get_self(),dao_id);const auto& m=rows.get(target,"MEMBER_UNKNOWN");check(m.active,"MEMBER_INACTIVE");native_governance_settings native(get_self(),get_self().value);if(native.exists()&&native.get().handed_over&&native.get().dao_id==dao_id)check(admin==m.admin,"NATIVE_EXECUTIVE_ROLES");
    if(m.admin&&!admin)check(d.admin_count>1,"LAST_ADMIN");
    if(m.admin!=admin)dao_rows.modify(d,same_payer,[&](auto& r){if(admin)r.admin_count++;else r.admin_count--;});
    rows.modify(m,same_payer,[&](auto& r){r.admin=admin;r.reviewer=reviewer;});
  }
  ACTION grantkey(name runtime,uint64_t dao_id,uint64_t member_id,uint64_t recipient,uint64_t epoch,std::string envelope) {
    authorized_actor(runtime,dao_id,member_id,true);const auto& d=dao_rows.get(dao_id);check(d.privacy>0,"DAO_PUBLIC");
    members people(get_self(),dao_id);const auto& m=people.get(recipient,"MEMBER_UNKNOWN");check(m.active,"MEMBER_INACTIVE");check(!(d.privacy==2&&m.custody==1),"CUSTODY_POLICY");
    check(epoch>0&&epoch<=d.key_epoch&&(d.history_policy==0||epoch>=m.join_epoch),"KEY_EPOCH");require_epoch(dao_id,epoch);check(envelope.size()>0&&envelope.size()<=8192,"KEY_GRANT_SIZE");check(nlohmann::json::accept(envelope),"KEY_GRANT_JSON");
    key_grants rows(get_self(),dao_id);auto index=rows.get_index<"bymember"_n>();check(index.find((uint128_t(recipient)<<64)|epoch)==index.end(),"KEY_GRANT_EXISTS");auto id=rows.available_primary_key();if(!id)id=1;
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.epoch=epoch;r.recipient=recipient;r.grantor=member_id;r.envelope=envelope;});
  }
  ACTION govlock(uint64_t dao_id,name source,uint64_t source_id,uint32_t expires) {
    require_source(dao_id,source,"govlock"_n);const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");auto now=current_time_point().sec_since_epoch();check(expires>now&&uint64_t(expires)<=uint64_t(now)+2678400,"LOCK_EXPIRY");check(source_id>0&&d.active_ballots<64,"LOCK_LIMIT");
    governance_locks rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();check(index.find(source_hash(source,source_id))==index.end(),"LOCK_EXISTS");auto id=rows.available_primary_key();if(!id)id=1;
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.source=source;r.source_id=source_id;r.expires=expires;r.active=true;});dao_rows.modify(d,same_payer,[](auto& r){r.active_ballots++;});
  }
  ACTION govunlock(uint64_t dao_id,name source,uint64_t source_id) {
    governance_locks rows(get_self(),dao_id);auto index=rows.get_index<"bysource"_n>();const auto& lock=index.get(source_hash(source,source_id),"LOCK_UNKNOWN");check(lock.source==source&&lock.source_id==source_id,"LOCK_DOMAIN");check(lock.active,"LOCK_INACTIVE");
    if(lock.expires>current_time_point().sec_since_epoch())require_source(dao_id,source,"govlock"_n);
    rows.modify(rows.get(lock.id),same_payer,[](auto& r){r.active=false;});const auto& d=dao_rows.get(dao_id);check(d.active_ballots>0,"LOCK_COUNTER");dao_rows.modify(d,same_payer,[](auto& r){r.active_ballots--;});
  }
  ACTION clearholds(uint64_t dao_id,uint64_t recipient,uint32_t limit){
    check(limit>=1&&limit<=25,"RAM_HOLD_BATCH");members people(get_self(),dao_id);check(people.get(recipient,"MEMBER_UNKNOWN").claim==0,"CLAIM_OUTSTANDING");
    ram_holds holds(get_self(),dao_id);auto index=holds.get_index<"byrecipient"_n>();auto found=index.find(recipient);uint32_t removed=0;
    while(found!=index.end()&&found->ready&&found->recipient==recipient&&removed++<limit)found=index.erase(found);
    ram_claim_holds legacy(get_self(),dao_id);auto old_index=legacy.get_index<"byrecipient"_n>();auto old=old_index.find(recipient);
    while(old!=old_index.end()&&old->ready&&old->recipient==recipient&&removed++<limit)old=old_index.erase(old);
  }
  ACTION withdraw(name runtime,uint64_t dao_id,uint64_t member_id,name destination,asset quantity) {
    authorized_actor(runtime,dao_id,member_id,false,true);const auto& d=dao_rows.get(dao_id);check(quantity.symbol==d.token_symbol&&quantity.amount>0,"ASSET_QUANTITY");check(destination!=get_self()&&is_account(destination),"PAYOUT_DESTINATION");members people(get_self(),dao_id);const auto& m=people.get(member_id);check(quantity.amount<=m.claim,"INSUFFICIENT_CLAIM");
    if(quantity.amount==m.claim)consume_claim_hold(get_self(),dao_id,member_id);
    else{finance_receipt sample{};finance_receipts history(get_self(),dao_id);check_dao_ram(get_self(),dao_id,get_self(),false,ram_row_bytes(sample)+(history.begin()==history.end()?ram_scope_bytes<>():0));}
    people.modify(m,same_payer,[&](auto& r){r.claim=add_amount(r.claim,-quantity.amount);});dao_rows.modify(d,same_payer,[&](auto& r){r.claims=add_amount(r.claims,-quantity.amount);});
    send_payout(d.token_contract,destination,quantity,"Daclify claim withdrawal");
    receipt(dao_id,2,0,member_id,destination,d.token_contract,quantity);
  }
  ACTION unstake(name runtime,uint64_t dao_id,uint64_t member_id,name destination,asset quantity) {
    authorized_actor(runtime,dao_id,member_id,false,true);const auto& d=dao_rows.get(dao_id);check(d.active_ballots==0,"GOVERNANCE_LOCKED");check(quantity.symbol==d.token_symbol&&quantity.amount>0,"ASSET_QUANTITY");check(destination!=get_self()&&is_account(destination),"PAYOUT_DESTINATION");members people(get_self(),dao_id);const auto& m=people.get(member_id);check(quantity.amount<=m.stake,"INSUFFICIENT_STAKE");
    dao_rows.modify(d,same_payer,[&](auto& r){r.staked=add_amount(r.staked,-quantity.amount);if(m.active)r.eligible_stake=add_amount(r.eligible_stake,-quantity.amount);});people.modify(m,same_payer,[&](auto& r){r.stake=add_amount(r.stake,-quantity.amount);});
    send_payout(d.token_contract,destination,quantity,"Daclify governance unstake");
  }
  [[eosio::on_notify("*::transfer")]] void deposit(name from,name to,asset quantity,std::string memo) {
    if(to!=get_self()||from==get_self())return;
    check(quantity.is_valid()&&quantity.amount>0,"ASSET_QUANTITY");
    if(memo.rfind("create:",0)==0){creation_payment(quantity,memo);return;}
    if(memo=="ramreserve"){
      check(get_first_receiver()=="eosio.token"_n&&quantity.symbol==symbol("TLOS",4),"RAM_TOKEN_IDENTITY");
      check(ram_observer_settings(get_self(),get_self().value).exists(),"RAM_OBSERVER_REQUIRED");
      ram_reserve_settings reserve(get_self(),get_self().value);auto funds=reserve.exists()?reserve.get():ram_operator_reserve{};
      funds.available.amount=add_amount(funds.available.amount,quantity.amount);reserve.set(funds,get_self());return;
    }
    if(memo.rfind("ram:",0)==0){ram_payment(from,quantity,memo);return;}
    if(memo.rfind("mod:",0)==0){settle_module(from,quantity,memo);return;}
    check(memo.size()<=64,"DEPOSIT_REFERENCE");
    std::vector<std::string> parts;size_t start=0;
    for(size_t i=0;i<=memo.size();i++)if(i==memo.size()||memo[i]==':'){parts.push_back(memo.substr(start,i-start));start=i+1;}
    check(parts.size()==2||parts.size()==3,"DEPOSIT_REFERENCE");bool stake=parts[0]=="stake";check((stake&&parts.size()==3)||(!stake&&parts[0]=="dao"&&parts.size()==2),"DEPOSIT_REFERENCE");
    auto dao_id=parse_id(parts[1]);const auto& d=dao_rows.get(dao_id,"DAO_UNKNOWN");
    check(get_first_receiver()==d.token_contract&&quantity.symbol==d.token_symbol,"TOKEN_IDENTITY");
    if(stake){check(d.active_ballots==0,"GOVERNANCE_LOCKED");members people(get_self(),dao_id);const auto& m=people.get(parse_id(parts[2]),"MEMBER_UNKNOWN");check(m.active&&m.native_account==from,"STAKE_OWNER");people.modify(m,same_payer,[&](auto& r){r.stake=add_amount(r.stake,quantity.amount);});}
    dao_rows.modify(d,same_payer,[&](auto& r){if(stake){r.staked=add_amount(r.staked,quantity.amount);r.eligible_stake=add_amount(r.eligible_stake,quantity.amount);}else r.available=add_amount(r.available,quantity.amount);});
  }
private:
  daos dao_rows{get_self(),get_self().value};
  checksum256 current_transaction_id(){std::vector<char> bytes(transaction_size());check(read_transaction(bytes.data(),bytes.size())==bytes.size(),"TRANSACTION_BYTES");return sha256(bytes.data(),bytes.size());}
  void validate_archive_manifest(uint64_t dao_id,const archive_manifest_descriptor& manifest){
    check(manifest.format_version==1&&manifest.chain_id==configuration().chain_id&&manifest.runtime==get_self()&&manifest.dao_id==dao_id&&manifest.source.value,"ARCHIVE_DOMAIN");
    check(manifest.families.size()==1&&manifest.files.size()<=archive_max_leaves,"ARCHIVE_FAMILY_PROTECTED");
    ram_observer_settings observer(get_self(),get_self().value);check(observer.exists()&&observer.get().runtime_hash==get_code_hash(get_self()),"RAM_OBSERVER_REQUIRED");
    if(manifest.source==get_self()){check(manifest.code_hash==get_code_hash(get_self()),"ARCHIVE_SOURCE_CODE");require_document_coverage(dao_id);}else{modules installed(get_self(),dao_id);const auto& source=installed.get(manifest.source.value,"MODULE_DISABLED");check_pinned(source,manifest.source);check(manifest.code_hash==source.code_hash,"ARCHIVE_SOURCE_CODE");}check(manifest.abi_hash!=checksum256{},"ARCHIVE_SOURCE_CODE");
    const auto block=manifest.block_id.extract_as_byte_array();const uint32_t number=(uint32_t(block[0])<<24)|(uint32_t(block[1])<<16)|(uint32_t(block[2])<<8)|uint32_t(block[3]);
    check(number==manifest.block_number&&number>0&&manifest.timestamp.size()>=20&&manifest.timestamp.size()<=32,"ARCHIVE_SNAPSHOT");
    const auto& family=manifest.families.front();check(family.parent_id>0&&family.schema_hash!=checksum256{},"ARCHIVE_FAMILY_PROTECTED");
    if(manifest.source==get_self())check(family.kind=="document-versions"&&family.table=="documents"_n&&family.scope==dao_id,"ARCHIVE_FAMILY_PROTECTED");else check(family.kind=="ordinary-poll-votes"&&family.table=="votes"_n&&family.scope==get_self().value&&manifest.files.empty(),"ARCHIVE_FAMILY_PROTECTED");
    check(family.chunks.size()<=archive_anchor_max_chunks&&family.records<=archive_max_leaves,"ARCHIVE_CHUNK_COUNT");uint64_t count=0,last=0;bool first=true;
    for(uint32_t ordinal=0;ordinal<family.chunks.size();ordinal++){
      const auto& chunk=family.chunks[ordinal];const auto& d=chunk.domain;archive_domain_hash(d);
      check(d.chain_id==manifest.chain_id&&d.runtime==get_self()&&d.dao_id==dao_id&&d.source==manifest.source&&d.code_hash==manifest.code_hash&&d.abi_hash==manifest.abi_hash&&d.schema_hash==family.schema_hash&&d.table==family.table&&d.scope==family.scope&&d.chunk_ordinal==ordinal,"ARCHIVE_DOMAIN");
      check(chunk.root!=checksum256{}&&chunk.commitment!=checksum256{}&&chunk.bytes>=188&&chunk.bytes<=archive_max_chunk_bytes&&chunk.first_key<=chunk.last_key&&(first||chunk.first_key>last),"ARCHIVE_CHUNK_BOUNDS");
      validate_cid(chunk.cid);count=add64(count,d.leaf_count);first=false;last=chunk.last_key;
    }
    check(count==family.records,"ARCHIVE_COVERAGE_INCOMPLETE");
  }
  ram_order prepare_ram_order(uint64_t dao_id,name payer,checksum256 reference,uint64_t policy_revision,asset maximum,uint32_t expires,const std::vector<ram_purchase>& purchases,uint16_t fee_bps){
    dao_rows.get(dao_id,"DAO_UNKNOWN");
    check(ram_observer_settings(get_self(),get_self().value).exists(),"RAM_OBSERVER_REQUIRED");
    auto cfg=resource_settings(get_self(),get_self().value).get();check(cfg.revision==policy_revision,"RESOURCE_POLICY_CHANGED");
    auto fees=fee_configuration();check(fees.token_contract=="eosio.token"_n&&fees.token_symbol==symbol("TLOS",4),"RAM_TOKEN_IDENTITY");
    const auto now=current_time_point().sec_since_epoch();check(expires>now&&uint64_t(expires)<=uint64_t(now)+cfg.quote_lifetime_seconds,"RAM_QUOTE_EXPIRED");
    check(reference!=checksum256{}&&maximum.is_valid()&&maximum.symbol==fees.token_symbol&&maximum.amount>0&&purchases.size()>0&&purchases.size()<=6,"RAM_PURCHASE_RANGE");
    ram_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byreference"_n>();check(index.find(reference)==index.end(),"RAM_ORDER_EXISTS");
    ram_order value;value.dao_id=dao_id;value.reference=reference;value.payer=payer;value.treasury=fees.treasury;value.policy_revision=policy_revision;value.fee_bps=fee_bps;value.expires=expires;value.maximum=maximum;
    int64_t total=0;name previous;
    for(const auto& purchase:purchases){
      check(purchase.receiver.value>previous.value,"RAM_RECEIVER_ORDER");previous=purchase.receiver;validate_ram_receiver(dao_id,purchase.receiver);
      check(purchase.quantity.is_valid()&&purchase.quantity.symbol==fees.token_symbol&&purchase.quantity.amount>0&&purchase.minimum_bytes>0,"RAM_PURCHASE_RANGE");
      total=add_amount(total,purchase.quantity.amount);value.purchases.push_back(ram_acquisition{purchase.receiver,purchase.quantity,purchase.minimum_bytes,0,0});
    }
    const __int128 markup=(__int128(total)*fee_bps+9999)/10000;check(markup<=asset::max_amount,"RAM_PURCHASE_RANGE");
    value.spent=asset(total,fees.token_symbol);value.platform_fee=asset(int64_t(markup),fees.token_symbol);value.received=asset(0,fees.token_symbol);check(add_amount(total,int64_t(markup))<=maximum.amount,"RAM_PAYMENT_RANGE");
    auto id=orders.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"RAM_ORDER_LIMIT");value.id=id;return value;
  }
  void validate_ram_receiver(uint64_t dao_id,name receiver){
    ram_observer_settings saved(get_self(),get_self().value);const auto cfg=saved.get();
    if(receiver==get_self())check(get_code_hash(receiver)==cfg.runtime_hash,"RAM_SOURCE_CODE");
    else{ram_sources sources(get_self(),get_self().value);const auto& source=sources.get(receiver.value,"RAM_SOURCE_UNKNOWN");check(get_code_hash(receiver)==source.code_hash,"RAM_SOURCE_CODE");modules rows(get_self(),dao_id);const auto& installed=rows.get(receiver.value,"RAM_RECEIVER_UNINSTALLED");check(installed.code_hash==source.code_hash,"RAM_SOURCE_CODE");}
    telos_unmanaged_ram(receiver);
  }
  void ram_payment(name from,asset quantity,const std::string& memo){
    check(get_first_receiver()=="eosio.token"_n&&quantity.symbol==symbol("TLOS",4),"RAM_TOKEN_IDENTITY");check(memo.size()==68,"RAM_PAYMENT_REFERENCE");
    std::array<uint8_t,32> bytes{};auto nibble=[](char c)->uint8_t{check((c>='0'&&c<='9')||(c>='a'&&c<='f'),"RAM_PAYMENT_REFERENCE");return c<='9'?c-'0':c-'a'+10;};
    for(size_t i=0;i<32;i++)bytes[i]=(nibble(memo[4+i*2])<<4)|nibble(memo[5+i*2]);
    const auto reference=checksum256(bytes);ram_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byreference"_n>();check(index.find(reference)==index.end(),"RAM_ORDER_SETTLED");
    ram_intent_settings intents(get_self(),get_self().value);check(intents.exists(),"RAM_ORDER_UNKNOWN");const auto intent=intents.get();check(intent.order.reference==reference,"RAM_ORDER_UNKNOWN");check(intent.transaction_id==current_transaction_id(),"RAM_PURCHASE_TRANSACTION");const auto order=intent.order;
    check(!order.funded&&!order.settled,"RAM_ORDER_SETTLED");check(order.payer==from,"RAM_PAYER");check(order.expires>current_time_point().sec_since_epoch(),"RAM_QUOTE_EXPIRED");
    auto cfg=resource_settings(get_self(),get_self().value).get();check(cfg.revision==order.policy_revision&&cfg.native_ram_bps==order.fee_bps,"RESOURCE_POLICY_CHANGED");const auto fees=fee_configuration();check(fees.treasury==order.treasury&&fees.token_contract==get_first_receiver()&&fees.token_symbol==quantity.symbol,"RAM_TOKEN_IDENTITY");
    check(quantity.amount>=add_amount(order.spent.amount,order.platform_fee.amount)&&quantity.amount<=order.maximum.amount,"RAM_PAYMENT_RANGE");
    intents.remove();orders.emplace(get_self(),[&](auto& row){row=order;});buy_ram_order(reference,quantity);
  }
  void buy_ram_order(checksum256 reference,asset quantity){
    ram_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byreference"_n>();const auto& order=index.get(reference,"RAM_ORDER_UNKNOWN");check(!order.funded&&!order.settled,"RAM_ORDER_SETTLED");
    auto purchases=order.purchases;
    for(auto& purchase:purchases){validate_ram_receiver(order.dao_id,purchase.receiver);purchase.before_bytes=telos_unmanaged_ram(purchase.receiver);}
    index.modify(order,same_payer,[&](auto& row){row.funded=true;row.received=quantity;row.purchases=purchases;});
    for(const auto& purchase:purchases)action(permission_level{get_self(),"active"_n},"eosio"_n,"buyram"_n,std::make_tuple(get_self(),purchase.receiver,purchase.quantity)).send();
    action(permission_level{get_self(),"active"_n},get_self(),"finishram"_n,std::make_tuple(reference)).send();
  }
  void allocate_ram(uint64_t dao_id,name payer,uint64_t activity,uint64_t identity,uint64_t completion){
    ram_pools pools(get_self(),get_self().value);check_ram_pool(get_self(),pools.get(payer.value,"RAM_POOL_UNKNOWN"),dao_id,add64(add64(activity,identity),completion));
    ram_limits rows(get_self(),dao_id);auto found=rows.find(payer.value);auto value=found==rows.end()?ram_dao_limit{}:*found;value.payer=payer;value.activity=add64(value.activity,activity);value.identity=add64(value.identity,identity);value.completion=add64(value.completion,completion);
    if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r=value;});else rows.modify(found,same_payer,[&](auto& r){r=value;});
    action(permission_level{get_self(),"active"_n},get_self(),"checkrampool"_n,std::make_tuple(payer)).send();
  }
  void allocate_included_ram(uint64_t dao_id){
    ram_auto_settings saved(get_self(),get_self().value);if(!saved.exists()||!saved.get().enabled)return;const auto cfg=saved.get();const auto policy=resource_settings(get_self(),get_self().value).get();check(cfg.policy_revision==policy.revision,"RAM_OFFER_POLICY_CHANGED");
    ram_entitlements receipts(get_self(),dao_id);check(receipts.begin()==receipts.end(),"RAM_INCLUDED_EXISTS");hosted_settings hosted(get_self(),get_self().value);uint32_t slots=hosted.exists()?hosted.get().free_members:10;
    for(const auto& offer:cfg.offers){const auto rate=offer.payer==get_self()?policy.identity_bytes_per_slot:0;check(!rate||slots<=std::numeric_limits<uint64_t>::max()/rate,"RAM_SIZE_OVERFLOW");
      receipts.emplace(get_self(),[&](auto& r){r.payer=offer.payer;r.policy_revision=policy.revision;r.identity_per_slot=rate;r.slots=slots;});allocate_ram(dao_id,offer.payer,offer.activity,rate*slots,offer.completion);
    }
  }
  void allocate_member_ram(uint64_t dao_id,uint32_t slots){
    ram_entitlements receipts(get_self(),dao_id);auto found=receipts.find(get_self().value);if(found==receipts.end()||slots<=found->slots)return;const uint64_t added=slots-found->slots;check(!found->identity_per_slot||added<=std::numeric_limits<uint64_t>::max()/found->identity_per_slot,"RAM_SIZE_OVERFLOW");
    allocate_ram(dao_id,get_self(),0,added*found->identity_per_slot,0);receipts.modify(found,same_payer,[&](auto& r){r.slots=slots;});
  }
  void save_resources(uint16_t native_ram_bps,uint16_t card_ram_bps,uint64_t included_activity_bytes,uint64_t identity_bytes_per_slot,uint32_t quote_lifetime_seconds,uint64_t storage_free_bytes,uint64_t storage_unit_bytes,uint32_t storage_monthly_usd){
    check(native_ram_bps<=10000&&card_ram_bps<=10000&&quote_lifetime_seconds>0&&quote_lifetime_seconds<=3600&&storage_unit_bytes>0&&storage_monthly_usd>0&&storage_monthly_usd<=99999999,"RESOURCE_POLICY");
    resource_settings saved(get_self(),get_self().value);auto cfg=saved.exists()?saved.get():resource_policy{};
    cfg.revision=add64(cfg.revision,1);cfg.native_ram_bps=native_ram_bps;cfg.card_ram_bps=card_ram_bps;cfg.included_activity_bytes=included_activity_bytes;cfg.identity_bytes_per_slot=identity_bytes_per_slot;
    cfg.quote_lifetime_seconds=quote_lifetime_seconds;cfg.storage_free_bytes=storage_free_bytes;cfg.storage_unit_bytes=storage_unit_bytes;cfg.storage_monthly_usd=storage_monthly_usd;saved.set(cfg,get_self());
  }
  void save_hosted(uint32_t free_members,name settler) {
    check(free_members>=1&&free_members<=5000&&is_account(settler),"HOSTED_POLICY");hosted_settings(get_self(),get_self().value).set(hosted_policy{free_members,settler},get_self());
    creation_settings saved(get_self(),get_self().value);auto cfg=saved.exists()?saved.get():creation_policy{};save_creation(0,cfg.independent_usd,cfg.premium_bps,settler);
  }
  void check_member_capacity(const dao_record& dao) {
    hosted_settings saved(get_self(),get_self().value);if(!saved.exists())return;
    market_settings platform(get_self(),get_self().value);if(platform.exists()&&platform.get().dao_id==dao.id)return;
    uint32_t limit=saved.get().free_members;dao_capacities caps(get_self(),get_self().value);auto cap=caps.find(dao.id);if(cap!=caps.end()&&cap->expires>current_time_point().sec_since_epoch())limit=std::max(limit,cap->members);
    check(dao.member_count<limit,"MEMBERSHIP_CAPACITY");
  }
  void platform_actor(name runtime,uint64_t dao_id,uint64_t member_id) {
    check(get_sender()==get_self(),"ACTOR_SENDER");authorized_actor(runtime,dao_id,member_id,true);market_settings saved(get_self(),get_self().value);check(saved.exists()&&saved.get().dao_id==dao_id&&dao_id!=0,"PLATFORM_DAO");
  }
  void save_creation(uint32_t shared_usd,uint32_t independent_usd,uint16_t premium_bps,name settler) {
    check(shared_usd<=100000000&&independent_usd>0&&independent_usd<=100000000&&premium_bps<=10000,"CREATION_PRICE");check(is_account(settler),"CREATION_SETTLER");
    creation_settings saved(get_self(),get_self().value);auto cfg=saved.exists()?saved.get():creation_policy{};cfg.shared_usd=shared_usd;cfg.independent_usd=independent_usd;cfg.premium_bps=premium_bps;cfg.settler=settler;saved.set(cfg,get_self());
  }
  void save_listing(name account,name publisher,uint8_t party,uint8_t accepts_fee_rule,asset price,checksum256 code_hash,const std::string& title) {
    const auto cfg=fee_configuration();check(accepts_fee_rule==1&&party<=1,"FEE_RULE");check(is_account(account)&&account!=get_self()&&is_account(publisher),"MODULE_ACCOUNT");
    check(price.is_valid()&&price.amount>=0&&price.symbol==cfg.token_symbol,"MODULE_PRICE");
    check(code_hash!=checksum256()&&get_code_hash(account)==code_hash,"MODULE_CODE");
    check(title.size()>=1&&title.size()<=64,"MODULE_TITLE");
    for(unsigned char c:title)check(c>=0x20&&c<=0x7e,"MODULE_TITLE");
    catalogue rows(get_self(),get_self().value);auto it=rows.find(account.value);
    if(it!=rows.end()){check(it->party==party,"FEE_PARTY");if(party==1)check(it->publisher==publisher,"FEE_ACCOUNT");}
    auto write=[&](auto& r){r.account=account;r.publisher=publisher;r.party=party;r.complies=1;r.price=price;r.code_hash=code_hash;r.title=title;};
    if(it==rows.end())rows.emplace(get_self(),write);else rows.modify(it,same_payer,write);
  }
  void remove_listing(name account) {
    catalogue rows(get_self(),get_self().value);const auto& item=rows.get(account.value,"MODULE_UNLISTED");
    rows.erase(item);
    modcopy copy(get_self(),get_self().value);auto text=copy.find(account.value);if(text!=copy.end())copy.erase(text);
  }
  void save_copy(name account,const std::string& summary,const std::string& detail) {
    check(summary.size()>=1&&summary.size()<=160,"MODULE_SUMMARY");
    for(unsigned char c:summary)check(c>=0x20&&c<=0x7e,"MODULE_SUMMARY");
    check(detail.size()<=2000,"MODULE_DETAIL");
    for(unsigned char c:detail)check(c=='\n'||(c>=0x20&&c<=0x7e),"MODULE_DETAIL");
    modcopy copy(get_self(),get_self().value);auto it=copy.find(account.value);
    auto write=[&](auto& r){r.account=account;r.summary=summary;r.detail=detail;};
    if(it==copy.end())copy.emplace(get_self(),write);else copy.modify(it,same_payer,write);
  }
  void creation_payment(asset quantity,const std::string& memo) {
    check(memo.size()==71,"CREATION_REFERENCE");std::array<uint8_t,32> bytes{};
    auto nibble=[](char c)->uint8_t{check((c>='0'&&c<='9')||(c>='a'&&c<='f'),"CREATION_REFERENCE");return c<='9'?c-'0':c-'a'+10;};
    for(size_t i=0;i<32;i++)bytes[i]=(nibble(memo[7+i*2])<<4)|nibble(memo[8+i*2]);
    creation_orders orders(get_self(),get_self().value);auto index=orders.get_index<"byref"_n>();const auto& order=index.get(checksum256(bytes),"CREATION_UNKNOWN");
    const auto cfg=fee_configuration();check(get_first_receiver()==cfg.token_contract&&quantity.symbol==cfg.token_symbol,"TOKEN_IDENTITY");check(order.method==0&&quantity==order.tlos_due,"CREATION_AMOUNT");check(!order.paid,"CREATION_PAID");check(order.expires>=current_time_point().sec_since_epoch(),"CREATION_EXPIRED");
    index.modify(order,same_payer,[](auto& r){r.paid=true;});pay_share(cfg.token_contract,cfg.treasury,quantity,"Daclify DAO creation");
  }

  void validate_policy(const gov_settings& settings){
    check(settings.participant_mode<=2&&settings.kind<=2,"POLICY_KIND");check(is_account(settings.decide)&&settings.decide!=get_self(),"POLICY_DECIDE");
    check(settings.duration>=60&&settings.duration<=2592000,"POLICY_DURATION");check(settings.quorum>0&&settings.quorum<=10000&&settings.approval>=5001&&settings.approval<=10000,"POLICY_THRESHOLD");
    check(settings.max_commitment>=0&&settings.max_commitment<=asset::max_amount&&settings.daily_commitment>=0&&settings.daily_commitment<=asset::max_amount,"POLICY_BUDGET");
    check(!settings.daily_commitment||(settings.max_commitment>0&&settings.daily_commitment>=settings.max_commitment),"POLICY_BUDGET");
    check(!settings.guardian.value||is_account(settings.guardian),"POLICY_GUARDIAN");
    if(settings.participant_mode==2)check(settings.guardian.value&&settings.max_commitment>0&&settings.daily_commitment>0&&settings.governed_works,"AGENT_POLICY");
  }
  void require_guardian(uint64_t dao_id){
    gov_policies rows(get_self(),get_self().value);const auto& policy=rows.get(dao_id,"POLICY_UNKNOWN");check(policy.config.guardian.value,"GUARDIAN_UNCONFIGURED");require_auth(policy.config.guardian);
  }
  void check_unique_key(uint64_t dao_id,const public_key& key){
    auto bytes=pack(key);auto hash=sha256(bytes.data(),bytes.size());
    members people(get_self(),dao_id);auto roots=people.get_index<"bykey"_n>();check(roots.find(hash)==roots.end(),"CREDENTIAL_EXISTS");
    scoped_sessions sessions(get_self(),dao_id);auto delegated=sessions.get_index<"bykey"_n>();check(delegated.find(hash)==delegated.end(),"CREDENTIAL_EXISTS");
  }
  void bump_credentials(uint64_t dao_id,uint64_t member_id){
    participants rows(get_self(),dao_id);auto found=rows.find(member_id);
    if(found==rows.end())rows.emplace(get_self(),[&](auto& r){r.id=member_id;r.credential_epoch=2;});
    else rows.modify(found,same_payer,[&](auto& r){r.credential_epoch=add64(r.credential_epoch,1);});
  }
  void charge_commitment(uint64_t dao_id,int64_t quantity){
    gov_policies rows(get_self(),get_self().value);auto policy=rows.find(dao_id);if(policy==rows.end())return;
    const auto& config=policy->config;check(!config.max_commitment||quantity<=config.max_commitment,"COMMITMENT_LIMIT");
    if(!config.daily_commitment)return;
    const uint32_t day=current_time_point().sec_since_epoch()/86400;
    commitment_budgets budgets(get_self(),get_self().value);auto saved=budgets.find(dao_id);
    int64_t before=saved!=budgets.end()&&saved->day==day?saved->committed:0;const auto committed=add_amount(before,quantity);check(committed<=config.daily_commitment,"DAILY_LIMIT");
    if(saved==budgets.end())budgets.emplace(get_self(),[&](auto& r){r.dao_id=dao_id;r.day=day;r.committed=committed;});
    else budgets.modify(saved,same_payer,[&](auto& r){r.day=day;r.committed=committed;});
  }
  settings configuration() { config c(get_self(),get_self().value); check(c.exists(),"NOT_INITIALIZED"); return c.get(); }
  fee_config fee_configuration() { fee_settings saved(get_self(),get_self().value); check(saved.exists(),"FEE_UNSET"); return saved.get(); }
  void publish_policy(uint16_t bump_bps,uint16_t quote_premium_bps,uint64_t dao_id) {
    check(bump_bps<=10000&&quote_premium_bps<=10000,"FEE_BPS");
    market_settings(get_self(),get_self().value).set(market_policy{bump_bps,quote_premium_bps,dao_id},get_self());
    const auto cfg=fee_configuration();
    if(cfg.names.value)action(permission_level{get_self(),"active"_n},cfg.names,"setpolicy"_n,std::make_tuple(get_self(),bump_bps,quote_premium_bps)).send();
  }
  void send_payout(name token,name to,asset quantity,const std::string& memo) {
    require_payout_row(token,to,quantity.symbol);
    action(permission_level{get_self(),"active"_n},token,"transfer"_n,std::make_tuple(get_self(),to,quantity,memo)).send();
  }
  void pay_share(name token,name to,asset quantity,const std::string& memo) {
    if(quantity.amount==0)return;
    check(to!=get_self()&&is_account(to),"FEE_ACCOUNT");
    send_payout(token,to,quantity,memo);
  }
  void settle_module(name from,asset quantity,const std::string& memo) {
    check(memo.size()>4&&memo.size()<=16,"MODULE_PAYMENT");
    const name modaccount(memo.substr(4));
    check(memo==std::string("mod:")+modaccount.to_string(),"MODULE_PAYMENT");
    const auto cfg=fee_configuration();
    check(get_first_receiver()==cfg.token_contract&&quantity.symbol==cfg.token_symbol,"TOKEN_IDENTITY");
    catalogue listed(get_self(),get_self().value);const auto& item=listed.get(modaccount.value,"MODULE_UNLISTED");
    check(item.complies==1,"FEE_RULE");
    check(item.price.amount>0&&quantity==item.price,"MODULE_PRICE");
    const uint16_t bps=item.party==0?cfg.first_party_bps:cfg.third_party_bps;
    const __int128 fee=(__int128)quantity.amount*bps/10000;
    check(fee>=0&&fee<=quantity.amount,"FEE_SPLIT");
    const asset platform((int64_t)fee,quantity.symbol);
    const asset publisher_share(quantity.amount-(int64_t)fee,quantity.symbol);
    modpays payments(get_self(),get_self().value);
    auto id=payments.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"PAYMENT_LIMIT");
    payments.emplace(get_self(),[&](auto& r){r.id=id;r.modaccount=modaccount;r.payer=from;r.publisher=item.publisher;r.gross=quantity;r.platform_fee=platform;r.publisher_share=publisher_share;r.party=item.party;r.bps=bps;});
    pay_share(cfg.token_contract,cfg.treasury,platform,"Daclify platform fee");
    pay_share(cfg.token_contract,item.publisher,publisher_share,"Daclify module payment");
  }
  void require_epoch(uint64_t dao_id,uint64_t epoch){epochs rows(get_self(),dao_id);check(rows.find(epoch)!=rows.end(),"EPOCH_UNCOMMITTED");}
  void require_document_table(uint64_t dao_id,name source,name table){const auto value=document_sources(get_self(),dao_id).get(source.value,"DOCUMENT_SOURCE_UNKNOWN");check(value.code_hash==get_code_hash(source)&&std::find(value.tables.begin(),value.tables.end(),table)!=value.tables.end(),"DOCUMENT_SOURCE_TABLE");}
  void require_document_coverage(uint64_t dao_id){
    document_states states(get_self(),dao_id);check(states.get(0,"DOCUMENT_BACKFILL_REQUIRED").complete,"DOCUMENT_BACKFILL_REQUIRED");document_sources sources(get_self(),dao_id);modules installed(get_self(),dao_id);uint32_t count=0;
    for(const auto& grant:installed){check(++count<=64,"DOCUMENT_SOURCE_LIMIT");if(!grant.actions.empty()){const auto& source=sources.get(grant.account.value,"DOCUMENT_SOURCE_UNKNOWN");check(source.code_hash==grant.code_hash&&source.code_hash==get_code_hash(grant.account),"DOCUMENT_SOURCE_CODE");}}
    document_scans scans(get_self(),dao_id);auto index=scans.get_index<"bysource"_n>();count=0;for(const auto& source:sources){check(++count<=64,"DOCUMENT_SOURCE_LIMIT");check(source.code_hash==get_code_hash(source.source),"DOCUMENT_SOURCE_CODE");for(const auto& table:source.tables){auto data=pack(std::make_tuple(source.source,table));auto found=index.find(sha256(data.data(),data.size()));check(found!=index.end()&&found->complete&&found->code_hash==source.code_hash,"DOCUMENT_BACKFILL_REQUIRED");}}
  }
  void check_document_source(uint64_t dao_id,name source){
    check(get_sender()==source,"DOCUMENT_SOURCE_SENDER");require_auth(source);dao_rows.get(dao_id,"DAO_UNKNOWN");modules installed(get_self(),dao_id);const auto& grant=installed.get(source.value,"MODULE_DISABLED");check(!grant.actions.empty(),"MODULE_DISABLED");check_pinned(grant,source);
  }
  void record_document(uint64_t dao_id,const document_record& value,bool legacy){
    document_heads heads(get_self(),dao_id);auto head=heads.find(value.document_id);if(head==heads.end())heads.emplace(get_self(),[&](auto& r){r={value.document_id,value.version,value.author};});else if(value.version>head->version)heads.modify(head,same_payer,[&](auto& r){r.version=value.version;r.author=value.author;});
    document_clocks clocks(get_self(),dao_id);auto prior=clocks.find(value.id);if(prior!=clocks.end()){check(prior->document_id==value.document_id&&prior->version==value.version&&prior->row_hash==document_row_hash(value),"DOCUMENT_ID_REUSED");return;}
    clocks.emplace(get_self(),[&](auto& r){r={value.id,value.document_id,value.version,current_time_point().sec_since_epoch(),legacy,document_row_hash(value)};});
  }
  void append_document(uint64_t dao_id,uint64_t member_id,uint64_t document_id,uint32_t version,const std::string& cid,const std::string& metadata,checksum256 commitment,uint32_t bytes,uint16_t envelope_version,uint64_t key_epoch) {
    documents rows(get_self(),dao_id);auto index=rows.get_index<"byversion"_n>();auto upper=index.upper_bound((uint128_t(document_id)<<32)|std::numeric_limits<uint32_t>::max());
    bool found=false;if(upper!=index.begin()){--upper;found=upper->document_id==document_id;}
    if(found){check(upper->version<std::numeric_limits<uint32_t>::max()&&version==upper->version+1,"DOCUMENT_VERSION");members people(get_self(),dao_id);check(upper->author==member_id||people.get(member_id).admin,"DOCUMENT_AUTHOR");}
    else check(version==1,"DOCUMENT_VERSION");
    document_heads heads(get_self(),dao_id);auto head=heads.find(document_id);if(head!=heads.end()){check(head->version<std::numeric_limits<uint32_t>::max()&&version==head->version+1,"DOCUMENT_VERSION");members people(get_self(),dao_id);check(head->author==member_id||people.get(member_id).admin,"DOCUMENT_AUTHOR");}
    document_states state(get_self(),dao_id);auto progress=state.find(0);const auto high=std::max(progress==state.end()?0:progress->high_water,rows.available_primary_key()?rows.available_primary_key()-1:0);check(high<std::numeric_limits<uint64_t>::max()-1,"DOCUMENT_ID_LIMIT");const auto id=high+1;
    const auto inserted=rows.emplace(get_self(),[&](auto& r){r.id=id;r.document_id=document_id;r.version=version;r.author=member_id;r.cid=cid;r.metadata=metadata;r.commitment=commitment;r.bytes=bytes;r.envelope_version=envelope_version;r.key_epoch=key_epoch;});record_document(dao_id,*inserted,false);
    if(progress==state.end())state.emplace(get_self(),[&](auto& r){r.high_water=id;});else state.modify(progress,same_payer,[&](auto& r){r.high_water=id;});
  }
  void validate_envelope(const std::string& value) {
    const auto envelope=nlohmann::json::parse(value);
    check(envelope.is_object()&&envelope.size()==4&&envelope.contains("version")&&envelope["version"].is_number_integer()&&envelope["version"]==1&&envelope.contains("algorithm")&&envelope["algorithm"]=="AES-256-GCM"&&envelope.contains("iv")&&envelope["iv"].is_string()&&envelope.contains("ciphertext")&&envelope["ciphertext"].is_string(),"PRIVACY_ENVELOPE");
    const auto iv=envelope["iv"].get<std::string>();const auto ciphertext=envelope["ciphertext"].get<std::string>();const std::string alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    check(iv.size()==16&&ciphertext.size()>=24&&ciphertext.size()%4==0,"PRIVACY_ENVELOPE");for(auto c:iv)check(alphabet.find(c)!=std::string::npos,"PRIVACY_ENVELOPE");
    size_t padding=0;for(size_t i=0;i<ciphertext.size();i++){if(ciphertext[i]=='='){padding++;check(i>=ciphertext.size()-2&&padding<=2,"PRIVACY_ENVELOPE");}else check(!padding&&alphabet.find(ciphertext[i])!=std::string::npos,"PRIVACY_ENVELOPE");}
  }
  void validate_metadata(const std::string& metadata) { check(metadata.size()>0&&metadata.size()<=4096,"METADATA_SIZE"); check(nlohmann::json::accept(metadata),"METADATA_JSON"); }
  void receipt(uint64_t dao_id,uint8_t kind,uint64_t obligation,uint64_t recipient,name destination,name token_contract,asset quantity){
    finance_receipts rows(get_self(),dao_id);auto id=rows.available_primary_key();if(!id)id=1;check(id<std::numeric_limits<uint64_t>::max(),"RECEIPT_LIMIT");
    const auto tx=current_transaction_id();
    rows.emplace(get_self(),[&](auto& r){r.id=id;r.kind=kind;r.obligation_id=obligation;r.recipient=recipient;r.destination=destination;r.token_contract=token_contract;r.quantity=quantity;r.at=current_time_point().sec_since_epoch();r.transaction_id=tx;});
  }
  void validate_dao_metadata(const std::string& metadata){
    validate_metadata(metadata);const auto value=nlohmann::json::parse(metadata);
    if(!value.is_object()||!value.contains("schemaVersion")||value["schemaVersion"]!=3)return;
    check(value.size()==6&&value.contains("title")&&value["title"].is_string()&&value.contains("description")&&value["description"].is_string()&&value.contains("purpose")&&value["purpose"].is_string()&&value.contains("setup")&&value.contains("branding")&&value["branding"].is_object(),"METADATA_FIELDS");
    const auto title=value["title"].get<std::string>();check(!title.empty()&&title.size()<=640,"METADATA_FIELDS");
    for(auto it=value["branding"].begin();it!=value["branding"].end();++it){
      if(it.key()=="summary"){check(it.value().is_string()&&it.value().get<std::string>().size()<=1120,"BRANDING_IMAGE");continue;}
      check(it.key()=="logo"||it.key()=="cover","BRANDING_IMAGE");const auto& image=it.value();
      check(image.is_object()&&image.size()==4&&image.contains("cid")&&image["cid"].is_string()&&image.contains("bytes")&&image["bytes"].is_number_unsigned()&&image["bytes"].get<uint64_t>()>0&&image["bytes"].get<uint64_t>()<=2097152&&image.contains("mediaType")&&image["mediaType"].is_string()&&image.contains("commitment")&&image["commitment"].is_string(),"BRANDING_IMAGE");
      validate_cid(image["cid"].get<std::string>());const auto mime=image["mediaType"].get<std::string>();check(mime=="image/png"||mime=="image/jpeg"||mime=="image/webp","BRANDING_IMAGE");
      const auto hash=image["commitment"].get<std::string>();check(hash.size()==64,"BRANDING_IMAGE");for(auto c:hash)check((c>='0'&&c<='9')||(c>='a'&&c<='f'),"BRANDING_IMAGE");
    }
  }
  void validate_profile(const std::string& profile,name account_name) {
    const std::string written=account_name.to_string();
    check(account_name.value&&written.size()<=12&&written.front()!='.'&&written.back()!='.'&&written.find("..")==std::string::npos,"PROFILE_NAME");
    check(profile.size()>0&&profile.size()<=4096,"METADATA_SIZE");check(nlohmann::json::accept(profile),"METADATA_JSON");
    const auto value=nlohmann::json::parse(profile);check(value.is_object(),"METADATA_JSON");
    const std::vector<std::string> keys={"name","fullName","location","email","telegram","introduction","motto","facebook","instagram","youtube","linkedin","website","avatar","background"};
    for(auto it=value.begin();it!=value.end();++it){bool known=false;for(const auto& key:keys)if(it.key()==key)known=true;check(known&&it.value().is_string(),"PROFILE_FIELD");}
    check(value.contains("name")&&value["name"].get<std::string>()==written,"PROFILE_NAME");
    auto limited=[&](const char* key,size_t max){if(value.contains(key))check(value[key].get<std::string>().size()<=max,"PROFILE_FIELD");};
    limited("fullName",80);limited("location",80);limited("email",254);limited("telegram",32);limited("introduction",2000);limited("motto",140);
    limited("facebook",300);limited("instagram",300);limited("youtube",300);limited("linkedin",300);limited("website",300);limited("avatar",300);limited("background",300);
    if(value.contains("email")){const auto email=value["email"].get<std::string>();check(email.empty()||(email.find(' ')==std::string::npos&&email.find('@')!=std::string::npos),"PROFILE_FIELD");}
    if(value.contains("telegram")){const auto handle=value["telegram"].get<std::string>();if(!handle.empty()){check(handle.size()>=5,"PROFILE_FIELD");for(auto c:handle)check((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_',"PROFILE_FIELD");}}
    auto link=[&](const char* key){if(!value.contains(key))return;const auto ref=value[key].get<std::string>();if(ref.empty())return;check(ref.rfind("https://",0)==0&&ref.find(' ')==std::string::npos,"PROFILE_FIELD");};
    auto image=[&](const char* key){if(!value.contains(key))return;const auto ref=value[key].get<std::string>();if(!ref.empty())validate_cid(ref);};
    link("facebook");link("instagram");link("youtube");link("linkedin");link("website");image("avatar");image("background");
  }
  void validate_cid(const std::string& cid) {
    check(cid.size()==59&&cid[0]=='b',"CID_FORMAT");std::vector<uint8_t> raw;uint32_t bits=0;uint8_t count=0;
    const std::string alphabet="abcdefghijklmnopqrstuvwxyz234567";
    for(size_t i=1;i<cid.size();i++){auto position=alphabet.find(cid[i]);check(position!=std::string::npos,"CID_FORMAT");bits=(bits<<5)|position;count+=5;if(count>=8){count-=8;raw.push_back((bits>>count)&255);bits&=(1u<<count)-1;}}
    check(bits==0&&raw.size()==36&&raw[0]==1&&(raw[1]==0x55||raw[1]==0x70||raw[1]==0x71)&&raw[2]==0x12&&raw[3]==32,"CID_FORMAT");
  }
  void authorized_actor(name runtime,uint64_t dao_id,uint64_t member_id,bool admin=false,bool exit=false) {
    gov_policies policies(get_self(),get_self().value);if(policies.find(dao_id)!=policies.end())check(get_sender()==get_self(),"ACTOR_SENDER");
    check_agent_authority(get_self(),dao_id,member_id,exit);
    check(runtime==get_self(),"RUNTIME_DOMAIN");if(get_sender().value){check(get_sender()==get_self(),"ACTOR_SENDER");require_auth(permission_level{get_self(),"execctx"_n});}else require_auth(get_self());members rows(get_self(),dao_id);
    const auto& m=rows.get(member_id,"MEMBER_UNKNOWN");check(m.active||exit,"MEMBER_INACTIVE");check(!admin||m.admin,"ADMIN_REQUIRED");
  }
  uint64_t parse_id(const std::string& value) {check(!value.empty()&&value.size()<=20&&value[0]!='0',"DEPOSIT_REFERENCE");uint64_t out=0;for(auto c:value){check(c>='0'&&c<='9',"DEPOSIT_REFERENCE");check(out<=(std::numeric_limits<uint64_t>::max()-(c-'0'))/10,"DEPOSIT_REFERENCE");out=out*10+(c-'0');}return out;}
  checksum256 source_hash(name source,uint64_t id){auto packed=pack(std::make_tuple(source,id));return sha256(packed.data(),packed.size());}
  uint64_t obligation_id(obligations& rows,name source,uint64_t id){auto index=rows.get_index<"bysource"_n>();const auto& o=index.get(source_hash(source,id),"OBLIGATION_UNKNOWN");check(o.source==source&&o.source_id==id,"OBLIGATION_DOMAIN");return o.id;}
  void install_module(uint64_t dao_id,name account,uint16_t version,const std::vector<name>& actions,const std::vector<name>& grants,checksum256 code_hash) {
    check(is_account(account)&&account!=get_self(),"MODULE_ACCOUNT");check(version==1&&actions.size()<=16&&grants.size()<=16,"MODULE_VERSION_OR_LIMIT");
    for(auto grant:grants)check(grant=="reserve"_n||grant=="approve"_n||grant=="cancel"_n||grant=="govlock"_n||grant=="awardwork"_n||grant=="admit"_n||grant=="electexec"_n,"MODULE_GRANT_UNKNOWN");
    auto unique=[](const auto& list){for(size_t i=0;i<list.size();i++){check(list[i].value>0,"MODULE_ACTION");for(size_t j=i+1;j<list.size();j++)check(list[i]!=list[j],"DUPLICATE_GRANT");}};unique(actions);unique(grants);
    // Clearing both lists removes a module after its code has changed. Any remaining
    // action or grant must pin the hash of the code loaded at that account.
    checksum256 pinned{};
    if(!actions.empty()||!grants.empty()){
      check(code_hash!=checksum256(),"MODULE_CODE");check(get_code_hash(account)==code_hash,"MODULE_CODE");pinned=code_hash;
      catalogue listed(get_self(),get_self().value);const auto& item=listed.get(account.value,"MODULE_UNLISTED");
      check(item.complies==1,"FEE_RULE");check(item.code_hash==code_hash,"MODULE_CODE");
      check_ram_source(account,code_hash);
    }
    modules rows(get_self(),dao_id);auto it=rows.find(account.value);
    if(it==rows.end())rows.emplace(get_self(),[&](auto& r){r.account=account;r.version=version;r.actions=actions;r.grants=grants;r.code_hash=pinned;});else rows.modify(it,same_payer,[&](auto& r){r.version=version;r.actions=actions;r.grants=grants;r.code_hash=pinned;});
  }
  void check_ram_source(name account,checksum256 code_hash){ram_observer_settings observer(get_self(),get_self().value);if(observer.exists()){ram_sources sources(get_self(),get_self().value);const auto& source=sources.get(account.value,"RAM_SOURCE_UNKNOWN");check(source.code_hash==code_hash,"RAM_SOURCE_CODE");}}
  void check_pinned(const module_record& installed,name account){check(installed.code_hash!=checksum256()&&get_code_hash(account)==installed.code_hash,"MODULE_CODE");check_ram_source(account,installed.code_hash);}
  // The module account key satisfies require_auth on a direct action. Only that
  // account's executing contract sets get_sender, so the key cannot skip the module.
  // The stored hash must still match that contract, so replacing its code drops the grant.
  void require_source(uint64_t dao_id,name source,name grant){check(get_sender()==source,"SOURCE_SENDER");require_auth(source);modules rows(get_self(),dao_id);const auto& installed=rows.get(source.value,"MODULE_DISABLED");check(std::find(installed.grants.begin(),installed.grants.end(),grant)!=installed.grants.end(),"MODULE_GRANT");check_pinned(installed,source);}
  void validate_executive_roster(uint64_t dao_id,const std::vector<uint64_t>& ids,bool require_paired=true){
    check(!ids.empty()&&ids.size()<=8,"EXECUTIVE_LIMIT");std::set<uint64_t> unique;members people(get_self(),dao_id);bool paired=false;for(auto id:ids){check(unique.insert(id).second,"EXECUTIVE_DUPLICATE");const auto& m=people.get(id,"MEMBER_UNKNOWN");check(m.active,"MEMBER_INACTIVE");check_agent_authority(get_self(),dao_id,id);paired|=m.native_account.value!=0;}
    native_governance_settings native(get_self(),get_self().value);if(native.exists()){auto cfg=native.get();if(require_paired&&cfg.dao_id==dao_id&&cfg.handed_over)check(paired,"LAST_NATIVE_EXECUTIVE");}
  }
  void replace_executives(uint64_t dao_id,const std::vector<uint64_t>& ids,uint32_t timeout,uint16_t quorum){
    validate_executive_roster(dao_id,ids);check((timeout==0||(timeout>=60&&timeout<=31536000))&&quorum>=1&&quorum<=10000,"EXECUTIVE_POLICY");
    executive_policies policies(get_self(),get_self().value);auto old=policies.find(dao_id);uint64_t epoch=old==policies.end()?1:add64(old->revision,1);if(old==policies.end())policies.emplace(get_self(),[&](auto& r){r={dao_id,timeout,quorum,epoch};});else policies.modify(old,same_payer,[&](auto& r){r.inactivity_seconds=timeout;r.quorum_bps=quorum;r.revision=epoch;});
    executives rows(get_self(),dao_id);std::vector<executive_record> roster;for(auto id:ids){auto existing=rows.find(id);roster.push_back({id,existing==rows.end()?uint32_t(current_time_point().sec_since_epoch()):existing->last_active,epoch,0});}for(auto it=rows.begin();it!=rows.end();)it=rows.erase(it);for(const auto& e:roster)rows.emplace(get_self(),[&](auto& r){r=e;});
  }
  std::pair<std::vector<permission_level>,uint32_t> effective_native_executives(uint64_t dao_id){
    executive_policies policies(get_self(),get_self().value);const auto& policy=policies.get(dao_id,"EXECUTIVE_POLICY_UNKNOWN");executives offices(get_self(),dao_id);members people(get_self(),dao_id);participants actors(get_self(),dao_id);std::vector<permission_level> live,all;
    for(const auto& office:offices){const auto& m=people.get(office.member_id);auto actor=actors.find(office.member_id);if(!m.active||!m.native_account.value||(actor!=actors.end()&&actor->revoked))continue;native_governance_settings native(get_self(),get_self().value);if(native.exists())check(!check_permission_authorization(m.native_account,"active"_n,std::set<public_key>{native.get().service_key},std::set<permission_level>{},microseconds{0}),"SERVICE_KEY_EXECUTIVE");permission_level signer{m.native_account,"active"_n};all.push_back(signer);if(executive_active(office,policy))live.push_back(signer);}
    auto selected=live.empty()?all:live;std::sort(selected.begin(),selected.end(),[](const auto& a,const auto& b){return a.actor<b.actor;});return {selected,uint32_t((selected.size()*policy.quorum_bps+9999)/10000)};
  }
  void check_native_controller(uint64_t dao_id){native_governance_settings native(get_self(),get_self().value);if(!native.exists())return;auto cfg=native.get();if(cfg.dao_id==dao_id&&cfg.handed_over)check(!effective_native_executives(dao_id).first.empty(),"LAST_NATIVE_EXECUTIVE");}
  void update_native_authority(name account,name permission,name parent,const native_authority& authority){action(permission_level{account,"owner"_n},"eosio"_n,"updateauth"_n,std::make_tuple(account,permission,parent,authority)).send();}
  void synchronize_executive_admins(uint64_t dao_id,const std::vector<name>& signers){
    native_governance_settings native(get_self(),get_self().value);auto cfg=native.get();if(!cfg.handed_over||cfg.dao_id!=dao_id)return;executives offices(get_self(),dao_id);members people(get_self(),dao_id);std::vector<uint64_t> selected;
    for(const auto& office:offices){const auto& m=people.get(office.member_id);if(m.active&&std::find(signers.begin(),signers.end(),m.native_account)!=signers.end())selected.push_back(m.id);}
    for(auto id:cfg.admin_members)if(std::find(selected.begin(),selected.end(),id)==selected.end()){const auto& m=people.get(id);if(m.admin)people.modify(m,same_payer,[](auto& r){r.admin=false;});}
    for(auto id:selected){const auto& m=people.get(id);if(!m.admin)people.modify(m,same_payer,[](auto& r){r.admin=true;});}
    if(cfg.admin_members!=selected){dao_rows.modify(dao_rows.get(dao_id),same_payer,[&](auto& r){r.admin_count=selected.size();});cfg.admin_members=selected;native.set(cfg,get_self());}
  }
  void refresh_native_governance(uint64_t dao_id){
    native_governance_settings native(get_self(),get_self().value);if(!native.exists())return;auto cfg=native.get();if(cfg.dao_id!=dao_id||!cfg.handed_over)return;auto effective=effective_native_executives(dao_id);check(!effective.first.empty(),"LAST_NATIVE_EXECUTIVE");std::vector<name> signers;for(auto signer:effective.first)signers.push_back(signer.actor);synchronize_executive_admins(dao_id,signers);cfg=native.get();if(signers==cfg.signers&&effective.second==cfg.threshold)return;
    update_native_authority(get_self(),"govern"_n,"owner"_n,delegated_authority(effective.first,effective.second));cfg.signers=signers;cfg.threshold=effective.second;native.set(cfg,get_self());
  }
  void cancel_executive_handover(uint64_t dao_id){executive_handovers rows(get_self(),get_self().value);auto found=rows.find(dao_id);if(found==rows.end())return;executive_policies policies(get_self(),get_self().value);const auto& p=policies.get(dao_id);policies.modify(p,same_payer,[&](auto& r){r.last_election_start=std::max(r.last_election_start,found->starts);});rows.erase(found);}
  void activate_executive_handover(uint64_t dao_id){
    executive_handovers rows(get_self(),get_self().value);auto found=rows.find(dao_id);if(found==rows.end()||current_time_point().sec_since_epoch()<found->starts)return;
    if(current_time_point().sec_since_epoch()>=found->ends){cancel_executive_handover(dao_id);return;}
    auto next=*found;members people(get_self(),dao_id);participants actors(get_self(),dao_id);bool paired=false;
    for(auto id:next.members){auto m=people.find(id);auto a=actors.find(id);if(m==people.end()||!m->active||(a!=actors.end()&&a->revoked))return;paired|=m->native_account.value!=0;}
    native_governance_settings native(get_self(),get_self().value);if(native.exists()&&native.get().dao_id==dao_id&&native.get().handed_over&&!paired)return;
    executive_policies policies(get_self(),get_self().value);auto policy=policies.get(dao_id);replace_executives(dao_id,next.members,policy.inactivity_seconds,policy.quorum_bps);policies.modify(policies.get(dao_id),same_payer,[&](auto& r){r.last_election_start=next.starts;});
    executives offices(get_self(),dao_id);for(auto it=offices.begin();it!=offices.end();++it)offices.modify(it,same_payer,[&](auto& r){r.election_id=next.election_id;});rows.erase(found);
  }
  void validate_instruction(const instruction& r) {
    activate_executive_handover(r.dao_id);refresh_native_governance(r.dao_id);
    auto c=configuration();check(r.version==c.interface_version&&r.chain_id==c.chain_id&&r.deployment==get_self(),"INSTRUCTION_DOMAIN");
    const auto& d=dao_rows.get(r.dao_id,"DAO_UNKNOWN");(void)d;
    check_agent_authority(get_self(),r.dao_id,r.member_id,r.target==get_self()&&(r.action=="withdraw"_n||r.action=="unstake"_n));
    members rows(get_self(),r.dao_id);const auto& m=rows.get(r.member_id,"MEMBER_UNKNOWN");check(m.active||(r.target==get_self()&&(r.action=="withdraw"_n||r.action=="unstake"_n)),"MEMBER_INACTIVE");
    check(r.nonce==m.nonce&&m.nonce<std::numeric_limits<uint64_t>::max(),"NONCE");
    auto now=current_time_point().sec_since_epoch();check(r.expires>now&&uint64_t(r.expires)<=uint64_t(now)+900,"EXPIRED_OR_TOO_LONG");
    check(r.data.size()>=24&&r.data.size()<=16384,"PAYLOAD_SIZE");auto context=unpack<actor_context>(r.data);
    check(context.runtime==get_self()&&context.dao_id==r.dao_id&&context.member_id==r.member_id,"PAYLOAD_DOMAIN");
    if(r.target==get_self())check(r.action=="refreshgov"_n||r.action=="setexecs"_n||r.action=="heartbeat"_n||r.action=="setvoter"_n||r.action=="archapprove"_n||r.action=="archrevoke"_n||r.action=="govresources"_n||r.action=="govhosted"_n||r.action=="govseatfee"_n||r.action=="govpayfees"_n||r.action=="govcreate"_n||r.action=="govlist"_n||r.action=="govunlist"_n||r.action=="govmodcopy"_n||r.action=="addmember"_n||r.action=="setadmit"_n||r.action=="setdaogov"_n||r.action=="addsession"_n||r.action=="delsession"_n||r.action=="setmeta"_n||r.action=="setprofile"_n||r.action=="restoredoc"_n||r.action=="putdoc"_n||r.action=="putjson"_n||r.action=="rotateepoch"_n||r.action=="rotatekey"_n||r.action=="commitepoch"_n||r.action=="linknative"_n||r.action=="unlinknat"_n||r.action=="linkevm"_n||r.action=="unlinkevm"_n||r.action=="setactive"_n||r.action=="setroles"_n||r.action=="grantkey"_n||r.action=="withdraw"_n||r.action=="unstake"_n||r.action=="modconfig"_n||r.action=="setcredits"_n||r.action=="confirmext"_n||r.action=="govfees"_n,"ACTION_UNSUPPORTED");
    else { modules rows(get_self(),r.dao_id);const auto& installed=rows.get(r.target.value,"MODULE_DISABLED");check(std::find(installed.actions.begin(),installed.actions.end(),r.action)!=installed.actions.end(),"ACTION_UNSUPPORTED");check_pinned(installed,r.target); }
  }
  void dispatch(const instruction& r) {
    members rows(get_self(),r.dao_id);const auto& m=rows.get(r.member_id);rows.modify(m,same_payer,[](auto& row){row.nonce++;});
    action outgoing;outgoing.account=r.target;outgoing.name=r.action;outgoing.authorization={{get_self(),"execctx"_n}};outgoing.data=r.data;
    if(r.target==get_self()&&r.action=="linknative"_n){auto data=unpack<std::tuple<name,uint64_t,uint64_t,name>>(r.data);auto incoming=std::get<3>(data);require_auth(incoming);outgoing.authorization.push_back(permission_level{incoming,"active"_n});}
    executives offices(get_self(),r.dao_id);auto office=offices.find(r.member_id);if(office!=offices.end())offices.modify(office,same_payer,[](auto& e){e.last_active=current_time_point().sec_since_epoch();});
    refresh_native_governance(r.dao_id);
    outgoing.send();
  }
};
extern "C" void apply(uint64_t receiver,uint64_t code,uint64_t action_name) {
  if(code==receiver){switch(action_name){
    EOSIO_DISPATCH_HELPER(runtime,(appoint)(setexecs)(setnativegov)(handover)(heartbeat)(refreshgov)(syncexec)(electexec)(recallexec)(setvoter))
    EOSIO_DISPATCH_HELPER(runtime,(authproof)(unlinknat)(linkevm)(unlinkevm)(submitevm)(setadmit)(admitfrom))
    EOSIO_DISPATCH_HELPER(runtime,(docsrc)(docref)(docscanstep)(backfilldocs)(prunedocs)(restoredoc))
    EOSIO_DISPATCH_HELPER(runtime,(beginram)(scanram)(adoptram)(sealram)(setarchcfg)(archattest)(archapprove)(archrevoke)(archstep)(clearholds)(initramobs)(rebindramobs)(setramauto)(setrampool)(grantdaoram)(inheritram)(setdaoquota)(checkdaoram)(checkrampool)(setresources)(govresources)(setramcode)(ramadjust)(orderram)(finishram)(fulfilram))
    EOSIO_DISPATCH_HELPER(runtime,(init)(createdao)(enroll)(submit)(submitnat)(setmeta)(setprofile)(grantcredit)(setmodule)(reserve)(approveob)(cancelob)(confirmext)(payob)(putdoc)(putjson)(commitepoch)(rotateepoch)(rotatekey)(linknative)(setactive)(setroles)(grantkey)(govlock)(govunlock)(withdraw)(unstake)(modconfig)(setcredits))
    EOSIO_DISPATCH_HELPER(runtime,(sethosted)(govhosted)(govseatfee)(orderfree)(setcapacity)(revokecap)(resumecap))
    EOSIO_DISPATCH_HELPER(runtime,(enrollagent)(addmember)(initgov)(setdaogov)(addsession)(delsession)(guardpause)(guardrevoke)(guardrecover)(submitsess)(setfees)(listmod)(unlistmod)(setmodcopy)(setpolicy)(setgov)(setoracle)(govfees)(govpayfees)(setcreate)(govcreate)(setcrrate)(ordercreate)(cardcreate)(createpaid)(govlist)(govunlist)(govmodcopy))
  }}
  else if(action_name=="transfer"_n.value) execute_action(name(receiver),name(code),&runtime::deposit);
}
