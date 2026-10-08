# DAO RAM, prepaid storage and archives implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement the checked tasks in dependency order, inline in one continuous session. No sub-agent delegation is authorized. Keep an execution ledger and local verification evidence. The user requested a plan first; this document does not authorize implementation, production deployment, destructive cleanup of existing data, owner/active authority changes, or mainnet spending.

**Goal:** Give every DAO a backed, visible RAM allowance across core and all supported modules, immediate atomic TLOS RAM purchases, card-funded RAM provisioning, prepaid IPFS hosting and a recoverable archive module with safe pruning and a 30-day nonpayment policy.

**Architecture:** Core owns the C++ resource ledger, payment/resource policies, protected state, archive commitments and constrained core pruning. Backend modules owns the Archive service module's public schemas, bundle codecs, eligibility planning and restore logic; existing C++ modules prune only their own eligible records. The current API/worker host runs the services, PostgreSQL holds hosting and pinning state, and Vue consumes released producer-owned types and documentation.

**Tech stack:** Existing Antelope C++/CDT 4.1.1, Spring 1.2.2, strict TypeScript, Zod, WharfKit, PostgreSQL, Stripe, Pinata/public IPFS, Vue/Pinia/Vue Router, Vitest/VERT, fast-check and Playwright. No new service fleet, Redis, generic plugin framework, cryptocurrency exchange, or cryptographic dependency.

---

## 1. Status, evidence and scope

Planning date: 2026-10-08. This is an implementation sequence and acceptance contract, not implemented functionality or passing test evidence. New paths, API routes, actions and fields below are explicitly proposed. Existing paths were inspected; detailed C++ cost recipes must be produced from compiled schemas and qualified against native billing before enforcement.

Baseline repositories:

| Repository              | Baseline                                 |
| ----------------------- | ---------------------------------------- |
| daclify-backend-core    | 9f843904bd8ed68fb0cfbcbd7aac496760935974 |
| daclify-backend-modules | 62582331a1c9eea69a3867561527d05e71ce8d35 |
| daclify-frontend        | 520b7650493d39e783919a1dc492e8f7fb00c0e6 |

The plan is saved in the existing isolated codex/ram-history-simulation worktree. Preserve its uncommitted simulation runner/evidence and all running applications. Future implementation needs actual sibling worktrees for all three repositories; the current modules/frontend sibling links point to their main checkouts and must not be used for edits.

Current verified facts:

- [Native simulation](../../evidence/2026-10-08-ram-history-simulation.md): 200 shared DAOs and 40,000 active memberships used 33.046 MiB, including shared contract binaries. Members alone added 23.732 MiB. Finalizing 200 votes reclaimed no RAM.
- Core document records already contain bytes, CID, commitment, envelope version and key epoch. Do not add a duplicate file-size column to that record.
- ContentService already reserves expected upload bytes by DAO and verifies provider size, retrieved content and commitment. It does not yet provide the complete commercial lifecycle described here.
- HostedSubscriptions already validates Stripe invoice payments and attests member capacity. Preserve its invoice dependency protections.
- Native RAM is charged to contract accounts. DAO-scoped accounting must include all relevant rows/indexes across payer accounts; contract scope alone is not a separate native RAM account.
- Most historic rows are retained. history_policy is a private-content entitlement policy, not a retention policy.
- Module package source currently has no service-handler directory. Add a small explicitly exported Archive module; do not assume a generic dynamic module host already exists.
- Existing service migrations are recorded by core's coordinator. Archive-owned migrations need an explicit namespace and packaged, hash-checked discovery.

This plan continues the [master plan](2026-10-05-daclify-v2-master-plan.md), [architecture](../specs/2026-10-05-daclify-v2-architecture.md), WP11/WP12/WP17 in the [work packages](2026-10-05-daclify-v2-work-packages.md), and [release/documentation/test policy](2026-10-05-daclify-v2-release-docs-test-policy.md). Their dated historical status statements do not describe today's implementation.

## 2. Commercial and operating decisions

### Confirmed requirements

| Area                  | Required policy                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Membership            | Preserve free creation, 10 free active-member slots and approved graduated pricing for additional slots.                                                                  |
| Native RAM purchase   | Actual system RAM cost plus 500 basis points, paid in TLOS. Actual quota and DAO capacity must increase atomically.                                                       |
| Card RAM purchase     | USD equivalent of actual system RAM cost plus 2,000 basis points operational markup. Provision with operator-funded TLOS.                                                 |
| Fee stacking          | The RAM rails have alternative 5%/20% markups. Do not add Connect commission or the older generic 20% TLOS conversion premium to RAM purchases.                           |
| Purchased RAM         | One-time, reusable capacity; no monthly expiry or automatic sale for hosting arrears.                                                                                     |
| Free hosted storage   | 100 MB per DAO, defined as 100,000,000 verified stored bytes. Correctly label MB versus MiB in the UI.                                                                    |
| Paid hosted storage   | USD 1 per administrator-approved additional 1 GB per calendar month; 1 GB means 1,000,000,000 bytes. User confirmed this price on 2026-10-08.                             |
| Storage billing       | Active files, old versions, archived files and archive bundles share one allowance and rate. No extra archive-storage tariff.                                             |
| Pin persistence       | Archiving itself never unpins a referenced file. Count a retained CID once per DAO; count new archive bundles' own bytes.                                                 |
| Advance payment       | Recurring membership/storage services are paid at the start of the coming month. Capacity increases need explicit administrator consent and confirmed payment.            |
| Nonpayment            | No immediate deletion. Preserve reading/export for 30 days after the paid term ends; then end eligible unfunded hosted retention. Retry events do not reset the deadline. |
| Rights                | Hosting expiry must not erase identities, memberships, balances, claims, signing nonces, payment replay guards, current recovery material, or purchased RAM.              |
| Free fallback         | Keep the free 100 MB allowance. An unpaid membership invoice does not invalidate separately funded file hosting.                                                          |
| Archive governance    | Manual administrator approval for initial pruning. No automatic retention execution without a later explicit DAO policy.                                                  |
| Independent operators | Daclify's billing/retention applies only to services Daclify supplies. Self-hosted operators control their providers and directly owned RAM.                              |

Rates/allowances are governed by the Daclify DAO. Every quote and recurring agreement snapshots its accepted policy revision. Changes apply to new agreements or an explicitly accepted change; they do not silently shrink an existing paid allowance.

### Recommended implementation defaults

These are engineering recommendations for review, distinct from the confirmed prices:

- Included activity RAM: 256 KiB per DAO, plus a separately accounted identity allowance initially budgeted at 2 KiB per approved member slot. Qualify the identity budget with actual native rows, including wallet bindings/credential state. If insufficient, increase the provisioned budget before offering that capacity.
- Identity allowance is backed and granted once for a funded capacity increase, not recreated every renewal or every replacement member. Inactive historical rows still consume it. New identity/session growth is bounded; essential existing rights remain protected.
- Initial archive eligibility: at least 90 days after terminal completion; DAO may select longer retention.
- Existing finalized ballots lacking a completion timestamp get a parallel migration marker and wait 90 days from that marker. Do not pretend closes is the finalization timestamp.
- Initial archive chunk limit: existing 5 MiB hosted-content limit, applied to final stored bytes. Do not lift upload limits merely to fit an enormous bundle.
- Initial prune bounds: at most 25 records, proof depth at most 16, encoded action at most 16 KiB; reduce the batch bound if native CPU/NET results require it.
- RAM card orders: minimum total charge USD 5. This minimum does not force a five-unit monthly storage subscription.
- Quote lifetime: 300 seconds. Native purchase fails if the accepted price ceiling or minimum acquired bytes cannot be honored.
- Gateway usage is measured and bounded separately. The storage price includes disclosed fair-use access, not unlimited bandwidth; no unapproved bandwidth overage charges. A funded, enforceable gateway allowance is a launch gate.

Physical backing is mandatory for free and paid capacity. A configuration value is not evidence that the operator bought the RAM or funded the Pinata plan.

### Pricing arithmetic

Use checked integer arithmetic. Public large byte counts and native units are decimal strings through existing Uint64Schema; SQL uses constrained bigint/numeric; C++ uses checked uint64/int64 and sufficiently wide intermediates.

```ts
// Pure arithmetic to implement in protocol/resources.ts and protocol/storage.ts.
const ceilDiv = (value: bigint, divisor: bigint): bigint =>
  value / divisor + (value % divisor === 0n ? 0n : 1n);
const feeUnits = (baseUnits: bigint, basisPoints: bigint): bigint =>
  ceilDiv(baseUnits * basisPoints, 10_000n);
const storageLimit = (approvedUnits: bigint): bigint =>
  100_000_000n + approvedUnits * 1_000_000_000n;
const monthlyStorageUsdCents = (approvedUnits: bigint): bigint => approvedUnits * 100n;
```

Validate nonnegative quantities, positive divisors, bounds and final native/Stripe representability before invoking these functions. Full multiplication must not overflow before division.

The native base cost includes the system contract's RAM-market fees. The 5% or 20% Daclify markup is applied once to that complete acquisition cost. Show both costs separately in the quote.

Examples: zero paid storage units = 100 MB/$0; one = 1.1 GB/$1; five = 5.1 GB/$5 monthly. Crossing a usage threshold does not itself charge the administrator.

The USD 1 storage price includes Daclify's hosting service price; do not add the RAM card markup. Initial monthly storage checkout uses Stripe. A manual TLOS prepaid-storage rail is a separately bounded extension using an explicitly approved USD/TLOS pricing policy; it is not required to qualify the native RAM purchase rail.

## 3. Invariants that the implementation must enforce

1. Per-DAO counters include core and every supported module, but never another DAO's data. Native shared code/ABI/permission infrastructure is platform overhead.
2. Used bytes, reserved completion bytes and allocated capacity reconcile by payer account. No allowance can be spent twice across contracts.
3. Insert/modify/erase account for canonical serialized bytes, secondary indexes and table/scope overhead. Metadata-only JSON length is not total RAM.
4. Meter adjustments and the corresponding mutation succeed or roll back together. Module keys, arbitrary code and other DAOs cannot forge credits or decrements.
5. On shared deployments, only code-hash-approved, calibrated modules may execute with Daclify's runtime context. Test attempts to charge foreign-payer RAM directly; a voluntary callback alone is not a security boundary.
6. New obligations/ballots reserve the bounded RAM needed to finish, produce receipts and release locks. Protected reserve is not an unlimited free-write category.
7. A TLOS RAM order credits only verified native quota increases for allowlisted current payer accounts. Counter credit without resource acquisition is forbidden.
8. Operator card-provisioning funds and RAM-payment escrow are separate from DAO treasury/stake/claim backing. Neither can spend member liabilities.
9. Payment callbacks, operator restarts, retries and forks cannot provision the same order twice.
10. A file is billable only from verified actual stored bytes. Contract-declared bytes on an externally pinned CID do not create a Daclify pinning bill.
11. Unique retained CIDs are charged once per DAO; global provider pin ownership may be shared. One DAO cannot remove another DAO's funded reference.
12. Archive commit/proof verifies source record bytes and domain. Off-chain availability is verified operationally; a CID is not a permanent availability guarantee.
13. Pruning never removes current authority, unresolved financial state, required replay protection or the sole current key-recovery path.
14. Pruning reduces used RAM, not purchased capacity. No automatic sellram or TLOS refund occurs.
15. Only confirmed service nonpayment makes hosted references eligible for scheduled removal. Unknown provider state fails closed and is reported.
16. Public blockchain history, third-party IPFS copies and plaintext already held by members cannot be erased by Daclify cleanup.

## 4. Delivery sequence and boundaries

| Delivery               | Contents                                                                                            | Exit condition                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| R1 Resource accounting | Core/all-module metering, backed allowances, native TLOS and card RAM purchases, resource dashboard | Native billing reconciliation and real system-contract purchase proof; no pruning     |
| R2 Hosted storage      | Verified unique-CID ledger, approved monthly capacity, grace/curation/export, guarded unpinning     | Concurrent/recovery/payment tests and controlled live Pinata/Stripe sandbox checks    |
| R3 Archive             | Module packaging, commitments, export/read/restore, manual proof-checked pruning                    | Empty-database recovery and private-content tests; pruning qualified family by family |

R1/R2 can ship with archival/pruning disabled. R3 initially prunes finalized ordinary-poll votes, then old document versions with completed reference protection. Financial module history is exportable, but its records are not pruned in this release. Key grants and epoch commitments remain on chain.

## 5. Repository/file ownership map

Paths are relative to the named repository. Create only these bounded responsibilities, reusing existing helpers.

| Repository        | Existing files to extend                                                                                                                                                                                                     | Proposed additions                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Core C++          | contracts/runtime/runtime.cpp; contracts/common/records.hpp; contracts/common/governance.hpp; contracts/common/creation.hpp                                                                                                  | contracts/common/resources.hpp; contracts/common/ram.hpp; contracts/common/archive.hpp                                                          |
| Core protocol/SDK | protocol/index.ts; protocol/base.ts; protocol/storage.ts; protocol/service-api.ts; sdk/index.ts; sdk/permissions.ts                                                                                                          | protocol/resources.ts; generated additions through existing codegen                                                                             |
| Core services     | services/api/src/native-chain.ts; chain.ts; server.ts; main.ts; billing/stripe.ts; billing/hosting.ts; content/service.ts; content/provider.ts; content/pinata.ts; content/jobs.ts; jobs.ts; store.ts                        | services/api/src/resources/{service,routes,jobs}.ts; billing/{storage,storage-jobs}.ts; content/ledger.ts; archive/{routes,store,jobs}.ts       |
| Core SQL          | Preserve migrations/001–020 unchanged                                                                                                                                                                                        | migrations/021_resources.sql; 022_storage_ledger.sql; 023_storage_billing.sql                                                                   |
| Module contracts  | contracts/common/module.hpp; contracts/decide/decide.cpp; contracts/works/works.cpp; contracts/payroll/payroll.cpp; contracts/grants/grants.cpp; contracts/endorse/endorse.cpp                                               | Source-owned parallel archive metadata as needed; no extra Archive contract account                                                             |
| Module package    | protocol/index.ts; protocol/api.ts; sdk/index.ts; package.json; tools/build.ts; tools/codegen.ts; tools/docs/generate.ts; docs/releases/requirements.json                                                                    | archive/{index,format,planner,restore}.ts; protocol/archive.ts; migrations/archive/001_archive.sql                                              |
| Frontend          | src/main.ts; state/workspace.ts; api/client.ts; views/Hosting.vue; PlatformDao.vue; Status.vue; Workspace.vue; components/FilePanel.vue; ContentPanel.vue; ModulesPanel.vue; GovernancePanel.vue                             | src/views/Resources.vue; src/components/ArchivePanel.vue; src/api/resources.ts; src/content/archive.ts                                          |
| Docs/tooling      | All three README.md/docs/README.md/CHANGELOG.md; core docs/guides/topics.json/disaster-recovery.md/development.md/operations.md; module docs/guides/topics.json; frontend src/help/catalog.ts; release/build/bootstrap tools | Core docs/operations/resources-and-retention.md; modules docs/archive.md; dated evidence/release manifest; new owned test fixture/configuration |

The Archive package exports pure/domain logic and a validated service manifest through a public ./archive subpath. Core owns its private SQL/provider adapters. Mount routes/jobs explicitly in the existing host. Keep native ModuleDeployment/Catalog semantics intact; render Archive as a service module instead of inventing a fake blockchain account.

Release communication also touches www-landing-page/src/content/{en,es,pl}.ts and README.md, followed by its existing generated exports and site checks. Keep this separate from application logic and preserve its Apache-2.0 license. Update promotional claims only for features actually available in the released deployment.

## 6. Proposed protocol and state

### C++ state

Keep existing serialized row layouts and signed/content domains intact. Prefer parallel versioned tables over appending ordinary fields to populated tables.

- Resource policy: revision, native/card RAM basis points, included RAM budgets, supported native asset, platform DAO and account registry, storage free bytes/unit bytes/unit USD cents, grace seconds and policy version.
- Per-DAO/payer ledger: identity/activity/retained usage, completion reservations, backed grants/purchased bytes, metering layout version, migration cursor/state.
- RAM receipts: request ID, rail, DAO, accepted policy revision, allocations, acquired bytes, actual native spend, charged fee, source payment reference and settled state.
- Operator RAM reserve and transient purchase context: native asset backing, approved order ceiling, current receiver list, before-balances/quota snapshots; callback context cannot be manufactured by a direct caller.
- Archive policy/anchors: DAO, source contract/table family, policy/version, source ABI/code hash, irreversible snapshot reference, manifest CID/bytes/hash, ordered chunk roots/counts, approval and verification state.
- Parallel record lifecycle/reference metadata: completion marker, monotonic identity allocation where erasure would permit reuse, and references blocking document deletion.

Proposed action responsibilities; generate exact ABI/types from C++ rather than manually duplicating models:

| Action      | Actor and purpose                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------- |
| govresource | Existing platform-governance authorization updates bounded policy; no user funds moved              |
| ramadjust   | Current pinned source contract updates its DAO/payer/category delta atomically                      |
| buydaoram   | Native payer authorizes one bounded TLOS-funded purchase plan                                       |
| fulfilram   | Restricted billing authority submits a verified card order within the funded operator reserve       |
| ramfinish   | Only the executing runtime completes native purchase verification, credit and change handling       |
| setarchive  | DAO administrator signs enabled/manual retention policy                                             |
| archapprove | DAO administrator approves exact immutable export domain/root/coverage                              |
| archattest  | Restricted archive verifier records successful retrieval and independent-backup verification        |
| prunedocs   | Core verifies approved record proofs, reference/retention eligibility and advances bounded progress |
| prunevotes  | Decide verifies the approved core anchor and prunes its own eligible vote rows                      |

Payment receipt uniqueness and signed instruction nonce/domain protection remain separate. Native payer/sponsor payment grants no membership/admin rights. Keep actual crypto/ABI schemas for existing account modes.

### PostgreSQL state

Core migrations create constrained resources/orders/events/reserves, unique storage objects/references/reservations, and monthly storage agreement/invoice state. Archive-owned migration creates archive jobs/chunks/query-index/restore reports in its own namespace.

Use the full chain/runtime/DAO domain, with the stable existing interface identity. Keep unique request/provider-event/receipt keys; immutable accepted price snapshots; UTC paid-through/deadline timestamps; checked nonnegative counters; and indexes for due jobs, per-DAO usage, CID references and provider reconciliation.

A global storage object binds provider tenant, import profile, CID, verified bytes/commitment and provider pin state. A per-DAO object/reference binds document version, branding/media or archive role. Logical per-DAO bytes are not multiplied by reference count. Unknown upload results retain their reservation until reconciled.

Removal intents carry object/reference generation numbers and a lease token. Releasing a reference and authorizing provider removal are separate transitions; acquiring a new reference to an object being removed requires cancellation or verified re-pinning before the API reports it available. Preserve a verified ciphertext copy during an in-flight unpin for immediate compensation if payment/reference reconciliation invalidates the intent. This is bounded worker staging, not a promise of permanent backups. Stripe and Pinata cannot share a PostgreSQL transaction: document the remaining provider visibility window, reconcile after removal and raise an incident if compensation fails.

Do not purge account/provider pairing rows, payment audit evidence or authoritative financial records when an IPFS subscription ends.

### Archive commitment format v1

Use the existing SHA256 implementation and Antelope serialization. All fixed integers are unsigned little-endian; names are packed Antelope uint64 values; checksums are exactly 32 raw bytes. Define a producer-owned packed domain tuple in this exact order:

1. uint16 format version (=1), chain ID, runtime name, uint64 DAO ID;
2. source contract name, source code hash, raw ABI hash, source schema hash;
3. table name, uint64 scope, uint32 chunk ordinal, uint32 leaf count.

Let D = SHA256(pack(domain)). For each chunk, order rows by numeric primary key, reject duplicate keys and compute leaf i = SHA256(0x00 || D || uint32(i) || uint64(primary_key) || varuint32(row_byte_length) || original_packed_row_bytes). Compute each parent as SHA256(0x01 || left_hash || right_hash); duplicate the last hash at odd levels. A one-leaf root is its leaf hash. An empty family has no chunk and no pruning proof; an empty chunk is invalid. Derive proof direction from the checked leaf index at each level, verify the path length against leaf count and require the duplicated sibling to match at odd boundaries.

The administrator-approved manifest commitment binds the full ordered chunk descriptor list, per-chunk domain/root/CID/byte count, source snapshot and coverage. Use the same canonical packed descriptor schema on both sides, hash the final uploaded manifest bytes, and reject an altered descriptor list. Before implementation approval, record fixed byte/leaf/root/proof vectors in both C++ and TypeScript tests; neither side's output alone is the expected value. Source row packing stays tied to its retained released ABI/schema; never accept an arbitrary downloaded ABI as a decoder authority.

### Public APIs

Proposed additions, registered in canonical producer route descriptors with typed errors:

| Route                            | Access                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| GET /v1/daos/:id/resources       | Current membership; safe DAO totals, payer/category detail and supported capabilities |
| POST /v1/resources/ram/quote     | DAO-scoped bounded quote, payer allocation, fee/expiry/price ceiling                  |
| POST /v1/resources/ram/checkout  | Administrator consent; card order with signed resource intent where required          |
| GET /v1/resources/ram/orders/:id | Authorized order status; provisioning failures are recoverable states                 |
| GET /v1/daos/:id/storage         | Administrator billing/retention detail; safe usage summary for members                |
| POST /v1/storage/capacity        | Administrator approves monthly units, accepted price and any proration                |
| POST /v1/storage/retain          | Administrator selects whole files/archives to keep within the funded allowance        |
| POST /v1/archive/preview         | Authorized preview of eligible families/counts/estimated savings                      |
| POST /v1/archive/export          | Creates resumable export; no pruning implied                                          |
| GET /v1/archive/jobs/:id         | Authorized phase/progress/integrity/deadline status                                   |
| GET /v1/archive/history          | Scoped pagination over verified archive references                                    |
| POST /v1/archive/restore         | Verified index rebuild/export or selective on-chain document restoration              |

Archive schema/API descriptors belong to the module producer; common resource/domain records belong to core. Frontend imports packed public schemas. Error codes distinguish insufficient RAM, storage quota, payment pending, capacity provisioning, archive incomplete/corrupt/unavailable, reference blocked, incompatible schema and billing review. Never return raw provider/SQL errors.

## 7. Task-by-task execution

Every task follows: create the listed meaningful failing cases; run the focused test command and record the failure; implement the bounded change; rerun to pass; inspect the diff; commit only that task's files on its isolated branch. Test names/new paths below are planned outputs, not current passing suites.

### Task 1 — Freeze policy and canonical resource definitions

**Files:** core protocol/resources.ts, protocol/storage.ts, protocol/service-api.ts, protocol/index.ts; module protocol/archive.ts; tests/resource-policy.test.ts, tests/storage-pricing.test.ts.

- [x] Encode the confirmed prices, distinct rail markups, decimal units, monthly terms and 30-day grace as versioned policy schemas.
- [x] Implement the integer functions in section 2 with boundary validation and derive API/schema types; retain existing hosting pricing.
- [x] Add tests: base 100 native units produces fee 5/total 105; base USD 100 cents produces card markup 20; no compound 5% plus 20%; one storage unit produces 1,100,000,000 bytes/$1 monthly.
- [x] Add zero/maximum/overflow/bad-divisor/negative/Unicode payload-size tests; a pending checkout cannot grant capacity.
- [x] Run: npx vitest run tests/resource-policy.test.ts tests/storage-pricing.test.ts tests/hosting-pricing.test.ts.
- [x] Commit the schema/pricing task after the actual green result.

### Task 2 — Inventory native billable writes and qualify metering recipes

**Files:** core contracts/common/ram.hpp, tools/analysis/ram.ts; module contracts/common/module.hpp and all five C++ contracts; core tests/native/ram-accounting.test.ts; module tests/ram-accounting.test.ts.

- [ ] Enumerate every emplace/modify/erase, including profiles, credentials, sessions, admission, branding, documents, grants, locks, receipts, elections, agreements and execution plans. Record payer/scope/index/lifecycle and growth path.
- [x] Derive row size from producer-owned packed types and native billing constants; assign shared headers once under a declared allocation policy.
- [x] Measure insert/grow/shrink/delete/last-row scope effects against native get_account deltas, including 127→128-byte serialization boundaries and multi-byte UTF-8.
- [ ] Include identity/nonce changes, inactive members, all module tables and meter rows themselves. Platform permissions/code/ABI overhead remains separately visible.
- [ ] Add negative conformance cases for skipped hooks, double charges, forged negative deltas and a malicious module charging a foreign payer.
- [x] Run native accounting on an explicitly owned fixture; emulator results do not establish billable RAM.
- [x] Keep enforcement disabled until the ledger/native conservation equation holds. A mismatch blocks release, not just a dashboard warning.

### Task 3 — Backed allowances, all-module counters and completion reserves

**Files:** core contracts/common/resources.hpp, contracts/runtime/runtime.cpp, sdk/permissions.ts; all five module contracts/common/module.hpp; core tests/resource-ledger.test.ts; module tests/resource-ledger.test.ts; core native accounting tests.

- [ ] Add resource policy, per-DAO/payer/category counters, calibrated module registry and bounded source-authenticated adjustment actions.
- [ ] Instrument every Task 2 write. Require current deployed source hash and native sender identity; module account keys alone cannot forge a callback.
- [ ] Reject unqualified module code on shared runtime dispatch/installation. Test that restricted runtime authority is not incorrectly treated as a barrier against arbitrary RAM payer choices.
- [ ] Provision included capacity only against available operator resources; repeated renewal does not manufacture another included grant.
- [ ] Back each ledger against actual free quota in its payer account, including completion/platform headroom. A core-account surplus cannot fund Decide writes without buying quota for Decide; show transferable administrative allocations separately from physical backing.
- [ ] Reserve bounded finalization/payment/receipt/cleanup RAM when accepting new work; prevent unbounded protected-category growth.
- [ ] Test: full activity quota blocks a new proposal/document but permits a reserved settlement, withdrawal, key recovery and cleanup; another DAO continues.
- [ ] Test two independent runtimes with the same DAO/member IDs, partial rollback, changed code pins and no Hub dependency.
- [ ] Run focused VERT tests plus native accounting/permission tests; commit after measured reconciliation.

### Task 4 — Safe existing-state migration

**Files:** core contracts/common/resources.hpp, runtime.cpp, tools/build/upgrade.ts; tests/native/upgrade.test.ts; module tests/deployment-conformance.test.ts.

- [ ] Add bounded/resumable meter backfill with progress and once-only crediting. Existing used state is grandfathered; do not invoice old rows retroactively.
- [ ] Preserve row layouts, credential nonces, content/encryption domains, member IDs and receipt references. Do not change interfaceVersion merely to update package versions.
- [ ] During backfill, block untracked growth and pruning. Protected mutations need an explicit delta/cursor overlay so they remain available and cannot be counted twice.
- [ ] Add parallel terminal/reference markers and permanent allocation guards only where required by later pruning.
- [ ] Test interruption/restart/retry, last-row erasure/high-ID reuse, old grants decrypting with the original kit and preserved liabilities.
- [ ] Drain or explicitly migrate old code-pinned executable work under DAO authorization before module replacement; never silently rewrite approvals to new hashes.
- [ ] Run the native supported-old-version upgrade suite and independent-deployment conformance before enabling quotas for migrated DAOs.

### Task 5 — Atomic TLOS RAM purchase

**Files:** core runtime.cpp/resources.hpp; services/api/src/resources/service.ts and routes.ts; protocol/resources.ts; tests/ram-purchase.test.ts; tests/native/ram-purchase.test.ts.

- [ ] Implement a native payer-authorized purchase plan with bounded current receiver accounts, desired bytes, maximum payment, minimum acquired capacity, accepted fee revision, expiry and unique request reference.
- [ ] Transfer/escrow funding, invoke the real system RAM actions for core/modules, and queue a sender-checked completion callback. Inline calls execute after their caller; do not read an after-quota immediately after send() in the parent action.
- [ ] Verify actual receiver resource increments in the callback; credit only acquired capacity, debit actual spending and route the 5% fee. Refund native change to the original payer atomically.
- [ ] Inspect the deployed system ABI/code and canonical receiver resource table before choosing the quota reader. Prove its before/after values match native get_account.ram_quota for every supported resource-management mode; reject unsupported modes instead of assuming privileged resource intrinsics are available to the runtime.
- [ ] Credit native fees to the platform's configured treasury accounting without an invalid self-transfer or fake balance; retain backing and audit references.
- [ ] Reject wrong token/precision, inactive/unapproved receivers, expired quotes, changed policy, slippage, resource-management modes that cannot prove actual quota growth, direct callback calls and receipt replay.
- [ ] Test atomic rollback of payment, fees, counter credit and every receiver if any purchase/verification fails.
- [ ] Use real system-contract resource accounting in native qualification. The existing eosstub cannot qualify resource acquisition.
- [ ] Preserve payer/pool/DAO asset conservation before and after every success/failure; commit with measured account quota evidence.

### Task 6 — Card RAM provisioning and funded operator reserve

**Files:** core migrations/021_resources.sql; resources/{service,routes,jobs}.ts; billing/stripe.ts; native-chain.ts; server.ts/main.ts; tests/integration/ram-orders.test.ts; tests/native/ram-card-settlement.test.ts.

- [ ] Persist administrator-approved resource intent, immutable price/fee snapshot and once-only provider/order references. Enforce the USD 5 total minimum.
- [ ] Reuse verified Stripe event/payment logic and typed checkout URL validation; checkout completion by itself is not proof of paid funds.
- [ ] Define paid→provisioning→settled or retry/review states; late/duplicate/out-of-order callbacks and worker crashes cannot repeat purchase.
- [ ] Fund a segregated on-chain operator reserve. Restricted fulfilment authority cannot spend DAO available balances, stakes or claims, or fulfil another deployment's order.
- [ ] Provision through the same native acquisition verification as Task 5; no second 5% fee on card orders. Keep fiat operational revenue distinct from native-token treasury balances.
- [ ] Test FX/market movement inside the quote ceiling, insufficient operator reserve, pending card authentication, wrong Stripe account/mode, refund/dispute and delayed on-chain confirmation.
- [ ] A dispute prevents further unfunded orders and opens review; it does not automatically erase state or sell occupied RAM.
- [ ] Run database/API/native tests. Live sandbox payment proof is a later qualification gate, not a mocked-test claim.

### Task 7 — Verified per-DAO IPFS object/reference ledger

**Files:** core migrations/022_storage_ledger.sql; content/{ledger,service,provider,pinata,jobs}.ts; tests/integration/storage-ledger.test.ts, content.test.ts, content-jobs.test.ts; tests/pinata.test.ts.

- [ ] Migrate existing uploads into verified object/reference/reservation records without losing provider IDs or orphan holds. Verify actual provider size/commitment before marking a migrated object billable.
- [ ] Reserve under DAO locks before upload; reconcile unique CID objects under additional object locks after provider completion.
- [ ] Deduplicate logical bytes for multiple versions/roles referencing the same CID within a DAO; separate per-DAO logical billing from global provider pin sharing.
- [ ] Include public/encrypted documents, logos/covers, hosted media and archives; count final ciphertext/envelope bytes.
- [ ] Keep externally supplied/unhosted CIDs visible as externally managed; never invent a Pinata pin or bill from their declared bytes.
- [ ] Release orphan budget only after provider absence/removal is established. A missing listing row is not enough.
- [ ] Test simultaneous final-byte uploads, repeated retries, duplicate provider objects, cross-DAO references, changed size, corrupted retrieval and uncertain pin state.
- [ ] Keep the current 5 MiB transport limit and CID import profile checks; no CID-to-SHA256 shortcut for DAG imports.

### Task 8 — Prepaid monthly storage agreements

**Files:** core migrations/023_storage_billing.sql; billing/{storage,storage-jobs}.ts; hosting.ts; protocol/storage.ts; server.ts/main.ts; tests/storage-pricing.test.ts; tests/integration/storage-billing.test.ts.

- [ ] Add a storage subscription distinct from membership: 100 MB free plus approved GB units at USD 1/unit/calendar month.
- [ ] Store accepted pricing revision, units, recurring consent, invoice payment/dependency references, funded term and pending changes.
- [ ] Provision increased capacity only from verified payment; reuse paid-period/proration dependency safeguards so an upgrade cannot bypass an unpaid base invoice.
- [ ] Schedule reductions at period end, with curation/export if current bytes exceed the new funded allowance.
- [ ] Set UTC paid-through and overdue deadline from the verified paid period, not webhook arrival. Preserve anniversary/month-end behavior.
- [ ] Test Jan 31/Feb/leap-year anchors, prepayment, failed first payment, pending authentication, late payment, repeated invoice events and retained accepted pricing after policy changes.
- [ ] Ensure membership expiry does not revoke a funded storage agreement; no surprise automatic overage subscription.
- [ ] Surface the funded gateway allowance and measured usage; no unsupported per-DAO bandwidth invoice.

### Task 9 — Thirty-day grace, free curation and guarded unpinning

**Files:** core billing/storage-jobs.ts; content/ledger.ts; jobs.ts; services/api/src/resources/routes.ts; tests/integration/storage-retention.test.ts.

- [ ] Implement active→grace→removal-eligible states, paid-period-end + 30×86,400 seconds deadline, reminders and export access.
- [ ] During grace, retain existing paid files. Stop unfunded growth; allow normal operations still covered by funded/free capacity.
- [ ] Let administrators mark whole files/archive bundles to retain within free/funded capacity. Report dependencies and exact bytes; never truncate a file.
- [ ] Recommended default if no selection is made: current documents/branding first, then older versions, then archives, ordered by verified publication time and stable ID. Publish this rule in the accepted retention terms; skip objects that do not fit rather than truncate a whole object.
- [ ] At deadline, recheck actual invoices and pending verified payment attempts before releasing the unpaid DAO's unretained references.
- [ ] Serialize curation/payment/reference removal with row locks, generation-fenced removal intents and a worker lease. Recheck provider payment state immediately before unpin; keep a verified staged ciphertext copy until post-removal reconciliation completes. A provider outage or indeterminate payment/pin state pauses deletion and raises review; it does not reset the original deadline.
- [ ] Unpin a provider object only when no funded/free retained references remain globally. Retry failed provider removals; retain a removal audit/tombstone.
- [ ] Fence new references while removal is in flight. If late payment/new references invalidate an intent, cancel it or re-pin the verified copy before reporting availability; alert on failed compensation. Do not claim cross-provider atomicity from SQL locks.
- [ ] Do not change on-chain identities/rights, paid RAM, separately funded services or another DAO's objects.
- [ ] Test the exact deadline boundary, payment/curation arriving during cleanup, a second DAO acquiring a CID during unpin, shared CIDs, already-removed provider objects, lost leases, compensation failure and a worker restart after external deletion but before SQL completion.
- [ ] State clearly that eligible hosting can end even though an on-chain CID remains. Current recovery keys/grants stay on chain; unavailable historic content is not silently presented as an empty history.

### Task 10 — Archive module packaging and deterministic bundle format

**Files:** modules archive/{index,format,planner,restore}.ts, protocol/archive.ts, package.json, docs/archive.md; tests/archive-format.test.ts; core contracts/common/archive.hpp; core store.ts.

- [x] Export ArchiveManifest/config/format/planner/restore through @daclify/modules/archive. Use existing dependencies and core's public SDK; no imports from private core services.
- [x] Add dist/archive and migrations/archive to the producer package files list, plus the ./archive types/import exports. Verify the packed tarball contains the migration bytes and consumers can import the public subpath; source-checkout success alone is insufficient.
- [x] Register it as a service module explicitly in core/UI, without adding a fake native module deployment or another contract account.
- [x] Add archive-owned, namespace/hash-tracked SQL migration discovery to core's existing coordinator; do not rename or rewrite old core migrations.
- [ ] Define manifest schema version 1: full domain; source code/ABI/schema hashes; irreversible block number/ID; eligible families; chunks/CIDs/byte counts/commitments; ordered record counts/roots; existing file references.
- [x] Implement the exact domain, canonical row encoding, leaf/node prefixes, ordering and odd-leaf rules in section 6; implement independent fixed C++/TypeScript vectors using existing SHA256/WharfKit.
- [x] The manifest contains chunk descriptors, not its own CID/hash. Hash its final uploaded bytes; approval/anchor binds that hash and CID plus the canonical descriptor commitment. Both administrator approval and retrieval/backup attestation must bind the same immutable payload before pruning becomes eligible.
- [x] Bound final chunk bytes to 5 MiB, leaves to 65,536, depth to 16 and decoded structures to known released schemas. Reject duplicates, missing ordinals, malformed encodings and unsupported historical ABI.
- [x] Test zero/one/odd/even/boundary-size bundles, wrong domain/source, modified row bytes, excessive proof depth, bad manifest and tampered imported ABI.
- [ ] Archive original private ciphertext and encrypted grants without plaintext transformation. Keep private titles/filenames/provider identities out of provider labels and public manifests.

### Task 11 — Resumable export, integrity/backup verification and manual approval

**Files:** core archive/{routes,store,jobs}.ts; modules archive/planner.ts; modules migrations/archive/001_archive.sql; core runtime.cpp/archive.hpp; tests/integration/archive-export.test.ts.

- [ ] Preview only supported families from irreversible state; report blocked references and gross/net estimated savings.
- [ ] Persist export phases: planned, exporting, pinned, verified, approved, pruning, completed; failed/review states retain resumable progress.
- [ ] Keep byte-bounded chunks and deterministic coverage checkpoints. Original document CIDs remain pinned; bundles reference files rather than copy their contents.
- [ ] Retrieve and verify every chunk/manifest; create and restore-check an independent encrypted backup before an availability attestation.
- [ ] Administrator approval binds the exact domain, source schema, manifest/root, coverage and eligible record families. Relayers/workers cannot approve pruning.
- [ ] Separate archive-storage reservation from ordinary uploads; maintain a bounded, funded migration reserve so a full ordinary quota does not deadlock a cleanup preview/export.
- [ ] Test crash after each phase, duplicate uploads, provider outage, corrupted backup, mutable source rows, revoked approval and an archive with incomplete coverage.
- [ ] Keep financial-record/grant exports as backup/query copies only; no pruning entitlement is implied.

### Task 12 — Source-owned pruning and document reference protection

**Files:** core contracts/runtime/runtime.cpp, contracts/common/archive.hpp, contracts/common/resources.hpp; modules contracts/decide/decide.cpp and source reference hooks in contracts/{works,payroll,grants,endorse} and contracts/common/module.hpp; tests/archive-pruning.test.ts, tests/document-archive.test.ts; core tests/native/archive-pruning.test.ts.

- [x] First qualify ordinary finalized-poll vote pruning. Retain ballot identity/result/tallies and execution/election protections; exclude elections/award/work execution plans initially.
- [x] Verify leaf proofs against actual current packed rows and approved anchor/source/retention markers. Prune only the next bounded ordinal batch; repeat calls are harmless.
- [x] Apply the RAM decrement and archive progress in the same transaction; retain permanent ballot identity so old IDs cannot be reused.
- [ ] Add document reference tracking for every authoritative first-party document/version consumer, including amendments, elections/terms/recalls, agreements and grants. Legacy references are backfilled before document pruning is enabled.
- [ ] Retain latest versions and required author/version high-water information. Prune an old version only when supported reference protection establishes it is not required on chain.
- [ ] Archived old documents can be restored on chain from verified original bytes/commitment under ordinary RAM limits before they are referenced by new governance. Do not fabricate a missing old row from unverified indexer JSON.
- [x] Keep member records, epoch commitments, key grants, outstanding obligations and once-only financial receipts/proofs on chain.
- [ ] Test nonterminal/too-young/referenced records, incorrect source/current hash, forged approval/availability attestation, stale row proofs, last-row/ID reuse, partial batches, replay and atomic failure mid-batch.
- [ ] No generic erase-table action. Each source owns eligibility. If a family cannot satisfy these tests, keep its pruning disabled and offer export/read support.
- [ ] Run real native permission/pruning tests and compare measured freed bytes against the ledger.

### Task 13 — History browsing, private recovery and empty-database restore

**Files:** modules archive/restore.ts; core archive routes/store; core content/service.ts and native-chain.ts; frontend src/content/archive.ts; tests/integration/archive-recovery.test.ts; frontend tests/unit/archive.test.ts.

- [x] Merge live and verified archive history with stable IDs, coverage markers, cursor pagination and deduplication. Unknown/missing coverage returns an explicit unavailable state.
- [x] Rebuild an empty history index from on-chain archive anchors, retained schema releases and surviving pins/backups; no original PostgreSQL archive index required.
- [ ] Preserve the existing encrypted document/key-grant domain and client decryption path. Recovered original keys decrypt archived private JSON/files through retained epoch grants.
- [ ] Test newly joined future-only members, former members retaining old keys, replacement keys failing old decryption, tampered ciphertext and absent archive providers.
- [x] Reconstruct pin/reference billing only from verified chain references, provider inventory and restored receipts; never infer a Stripe payment from a document CID.
- [x] Keep service/social pairing recovery in the separate PostgreSQL backup runbook.
- [ ] Restore indexes/history without repopulating every pruned row into RAM. Only explicit selective document restoration does so.
- [x] Run a full drill: export→verify→approve→prune→drop owned test index/database→rebuild→browse/decrypt→compare with the original verified dataset.

### Task 14 — Resources/Archive UI, clear consent and access

**Files:** frontend views/Resources.vue, components/ArchivePanel.vue, api/resources.ts, api/client.ts, main.ts; existing Hosting/PlatformDao/Status/Workspace/FilePanel/ContentPanel/ModulesPanel/GovernancePanel; tests/unit/resources.test.ts; tests/e2e/resources-and-archive.spec.ts.

- [ ] Add DAO Resources and Archive navigation using the existing shell/components/styles and ActionSigner. Resolve operator/DAO context before every request.
- [ ] Show identity/activity/module RAM, used/reserved/available capacity, actual resource acquisition, MB/MiB distinction, storage active/archive split, funded term and exact grace deadline.
- [ ] RAM checkout shows base cost, one selected rail fee, total, expiry/minimum capacity and correct payer accounts. Native payment uses the linked wallet; internal users can choose card/sponsor.
- [ ] Monthly storage shows approved units, monthly price, combined storage, accepted price revision and renewal/proration consent. A regular member cannot create a charge.
- [ ] Archive preview shows eligible/blocked counts, estimated net RAM savings, added IPFS bytes and files remaining pinned; signed approval is distinct from export.
- [ ] Grace UI provides payment, whole-file keep selection, downloadable bundles and re-pinning/export instructions. Missing data after hosting removal is explicit; late payment does not promise lost-content restoration.
- [ ] Platform DAO controls policy; Status shows safe reserve/provider/worker health and provenance, without secrets or another DAO's private data.
- [ ] Test member/admin/guardian roles; wrong DAO/runtime; account switches during checkout/signing; provider failures/reloads; virtual/native/EVM governance approvals; keyboard/mobile/screen-reader flow; no private plaintext in server/analytics requests.
- [ ] Add a separate local Playwright resource configuration; reuse existing test fixtures, not running user services.

### Task 15 — Generated help, pricing terms and operational runbooks

**Files:** all three README/docs/CHANGELOG; core docs/guides/topics.json, protocol/generated/help.ts via generation, docs/operations/resources-and-retention.md, docs/disaster-recovery.md, .env*.example; module docs/guides/topics.json, docs/archive.md; frontend src/help/catalog.ts.

- [ ] Generate resource/archive references from canonical schemas/actions/manifests. Keep stable help topics for resources, storage-billing, archive, retention and recovery.
- [ ] Explain native shared capacity versus independently owned RAM, the distinct 5%/20% fees, USD 1/GB/month after free 100 MB, consent and accepted pricing.
- [ ] Explain monthly advance billing, the original-period grace clock, separately funded services, deterministic free selection, provider removal and remaining public/backup copies.
- [ ] Document Archive source families, preserved records, trust in availability attestation, schema support, manual approval, re-pinning and selective restoration.
- [ ] Update env examples with exact implemented variable names, roles/products/webhook settings, funded reserve checks and provider readiness; correct the current storage allowance comment that says per-account although code keys by DAO.
- [ ] Publish gateway and backup retention limits after actual provider configuration is verified; do not advertise unlimited or perpetual hosting.
- [ ] Run docs generation/checks and frontend documentation journeys after installing the new public bundles.
- [ ] Once the corresponding features are qualified and available, update English/Spanish/Polish website explanations and app documentation links. In an isolated website worktree run npm run typecheck, npm test, npm run test:e2e, npm run export and npm run check:export; review the generated exports before committing. Do not promote this plan as a deployed service.

### Task 16 — Release qualification, provider proof and rollout packet

**Files:** version/package/lock/generated hash/release files in all three repositories; core tools/bootstrap.ts/deploy tooling; docs/evidence and requirements register; tests/native/upgrade.test.ts; analysis runner.

- [ ] Target a new independent 0.8.0-alpha.1 development checkpoint unless another unpublished version has been consumed meanwhile. Never replace a published 0.7 package under the same version.
- [ ] Keep stable v1 instruction/content identities when additive schemas allow it. If a true wire break is necessary, define/test old readers/domains and migration rather than globally changing DaoRef.
- [ ] Rebuild/pin every modified contract, regenerate public SDK/docs, install exact producer artifacts in consumers and create a dated immutable tested manifest.
- [ ] Re-run the 200-DAO/40,000-member scenario with metering, backed capacity, all five module mutation coverage and archival samples. Report measured versus projected values and counter overhead.
- [ ] Qualify real system-contract RAM purchases, receiver increases, rollback and payer conservation on an owned native fixture and reviewed Telos testnet targets.
- [ ] Qualify Stripe test orders/renewals/refunds and controlled synthetic Pinata upload/retrieve/export/unpin on the intended accounts. Mocks remain separately labelled.
- [ ] Prove upgrade/backfill/private recovery and database-loss restore; demonstrate unavailable/corrupt archives and payment/provider outage handling.
- [ ] Collect compatibility/migration/pricing/retention docs, actual test commands/results, hashes and outstanding provider gates for user review.
- [ ] Do not launch destructive retention or pruning until the restore/eligibility gates pass. Mainnet deployment, existing live authority changes, production purchases and cutover require separate authorization.

## 8. Local verification commands and evidence

These commands are instructions for implementation, not checks run by creating this plan. Use isolated sibling worktrees, the repository's pinned Node/npm and build artifacts. No automatic GitHub builds/tests are introduced.

```sh
# Core, after publishing local development producer artifacts and installing consumers.
npm run lint
npm run typecheck
npm run docs:check
npm test
npm run build
npm run format:check
npm run test:integration
npm run test:native

# Modules, in its actual implementation worktree.
npm run verify
npm run build
npm run format:check

# Frontend, in its actual implementation worktree.
npm run verify
npm run build
npm run format:check
npm run test:e2e:resources
```

The new frontend test:e2e:resources script/config is created in Task 14. Required native suites need matching owned fixtures; the current paid/research fixtures have different initialization. Add a resources fixture/profile rather than pointing all suites at one arbitrary running container. PostgreSQL DATABASE_URL must point at an owned loopback database ending in _test. No command should silently skip missing suites.

Focused commands use the exact new test paths named in each task, e.g.:

```sh
npx vitest run tests/resource-policy.test.ts tests/storage-pricing.test.ts
npx vitest run --config vitest.integration.config.ts tests/integration/storage-retention.test.ts
npx vitest run --config vitest.native.config.ts tests/native/ram-purchase.test.ts
npx tsx tools/analysis/ram.ts
```

Record native billed bytes and quota separately. VERT cannot qualify the real RAM market. Measure provider calls and application traffic; do not infer a universal margin from Pinata's advertised storage price.

Minimum evidence matrix:

| Concern           | Required independent evidence                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Metering          | Complete write inventory and native payer reconciliation for every first-party module                   |
| Atomic purchases  | Real system RAM acquisition plus deliberately failed multi-receiver rollback                            |
| Financial safety  | Conservation of DAO liabilities, operator reserve and payment escrow; no duplicate settlement           |
| Capacity          | Concurrent final-byte uploads; same-CID deduplication; funded limits; inactive history consumption      |
| Billing           | Advance/proration/late renewal, immutable pricing, wrong account/mode, duplicate events, dispute review |
| Retention         | Boundary clock, pending payment/provider outage, curation race, another DAO's funded references         |
| Archive           | C++/TS commitments, exact source coverage, no premature pruning, bounded replay-safe batches            |
| Recovery          | Empty database/history rebuild and original-key private decryption after actual pruning                 |
| Upgrade           | Old serialized rows/domains and pending obligations preserved; interrupted backfill resumes             |
| User flow         | Admin consent, accessible resource/retention UI, wrong-context rejection, explicit unavailable history  |
| Live integrations | Actual Stripe test payments, intended Pinata account and reviewed Telos testnet receiver proof          |

Use existing fast-check for bounded randomized action sequences against an independent ledger/retention model, with reproducible seeds. Selected mutation checks remove a source-auth guard, duplicate receipt protection or a reference check to prove the tests detect the violation. No universal cosmetic coverage percentage substitutes for these invariants.

## 9. Authority, failure and rollout controls

- Policy authority: Daclify DAO governs platform pricing/allowances. A DAO administrator approves its recurring capacity and initial archive/pruning policy. Billing purchases grant no governance rights.
- Native spender: bounded resource actions backed by actual incoming funding or a segregated operator reserve. Worker fulfilment and availability-verifier roles are restricted; no frontend private keys or provider secrets.
- Shared module safety: current source code hashes and metering compatibility are enforced before execution. Independently owned/unmetered modules cannot consume an operator-subsidized allocation through an optimistic callback.
- Archive data integrity: contract checks recorded commitments/proofs; availability is a disclosed operator attestation plus measured backup/retrieval checks, not a trustless promise.
- Failure during export/verification: keep live rows and pins. Failure during pruning: preserve completed progress and remaining rows. Failure after archive hosting removal: report missing history; retain compact on-chain outcomes and rights.
- Provider outage near day 30: fail closed, preserve the deadline and raise an operational review. Document delayed cleanup; do not delete a potentially paid customer's only copy.
- Payment after removal: new service can resume, but missing archives/files are restored only from verified surviving copies.
- Independent DAOs: same format/SDK and source eligibility, their own providers/backups and operator settings. Daclify cannot sell their resources or unpin their privately managed objects.
- Do not automatically migrate key grants or financial anti-replay state into deletable archives. Those require a separate proven protocol, not an extra checkbox.

Launch blockers are concrete: a meter mismatch, inability to prove a real receiver RAM increase, insufficient funded reserves, missing global pin-reference reconciliation, untested paid-period/cleanup races, unsupported old schema, missing private restore proof or unqualified module eligibility. Other features can remain enabled while the blocked destructive feature stays unavailable.

## 10. Source references and acceptance checklist

Primary references checked during the preceding analysis:

- [Antelope transaction atomicity](https://docs.antelope.io/docs/latest/protocol/transactions_protocol/).
- [Telos RAM operations](https://docs.telos.net/zero/resource-management/ram/).
- [Telos system RAM implementation](https://github.com/telosnetwork/telos.contracts/blob/master/contracts/eosio.system/src/delegate_bandwidth.cpp): receiver resources and market fees; qualify the actual deployed target code/ABI instead of assuming master is deployed.
- [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks) and [lifecycle](https://docs.stripe.com/billing/subscriptions/overview).
- [Pinata pricing](https://pinata.cloud/pricing), [limits](https://docs.pinata.cloud/account-management/limits) and [unpin semantics](https://knowledge.pinata.cloud/en/articles/5506024-what-does-unpinning-a-file-mean).
- [Hyperion indexing configuration](https://hyperion.docs.eosrio.io/providers/setup/chain/): auxiliary history recovery, not authoritative state or the sole archive.
- [Existing recovery runbook](../../disaster-recovery.md).

Before implementation delivery:

- [ ] Confirmed commercial rules are represented in source-owned schemas, UI and documentation.
- [ ] Every first-party RAM write is metered and natively reconciled; legacy backfill preserves rights.
- [ ] TLOS payments acquire actual RAM atomically; card provisioning is funded and idempotent.
- [ ] Storage is verified, deduplicated, prepaid and independently entitled from membership.
- [ ] Thirty-day cleanup preserves free/funded/shared references and survives payment/provider races.
- [ ] Archive files remain pinned and normally charged; no hidden archive-storage tariff.
- [ ] Eligible source pruning releases accounted usage without changing purchased capacity or essential state.
- [ ] History/index recovery and original-key private decryption work without the lost database.
- [ ] Generated public types/help and independent operator instructions match the exact release.
- [ ] Local full checks, native/provider/browser evidence and remaining gates are reported truthfully.
- [ ] No mainnet deployment, production deletion, authority change or asset movement was inferred from approval of this plan.

Current implementation and all open gates are tracked in the [execution ledger](../../evidence/2026-10-08-resource-execution.md). A checked supported-family requirement does not enable protected document pruning, production cleanup or immutable release qualification.


## Execution refinement: automatic included allocations

The user approved continuing the full plan. Implement included grants without a second billing service: an opt-in native `setramauto` policy declares at most six core/module payer offers. Their activity bytes must sum to the current governed included activity allowance; identity growth is billed to the core payer. Every offered payer must have a current, qualified, exclusive backed pool. New DAO creation atomically issues these allocations or rolls back; configuration alone cannot grant capacity. Each DAO retains its accepted identity rate and a permanent maximum funded slot count. Verified member-capacity increases allocate only the newly funded slots; renewals, decreases and revocations neither mint bytes nor reclaim occupied/purchased capacity. A changed global policy requires an operator-reviewed offer update for new DAOs and leaves existing accepted rates unchanged. Legacy adoption, obligation-specific holds, quota enforcement and emergency withdrawal policy are not inferred from this step.

## Confirmed emergency withdrawal policy — 2026-10-09

The user selected full-claim emergency withdrawals when ordinary DAO RAM is exhausted. Partial withdrawals remain supported only with sufficient ordinary RAM. Each accepted future claim must reserve enough bounded completion capacity for its payout/receipt and the full-claim exit path. Do not enable quotas until native tests prove settlement, full-claim exit, recovery and cleanup still work at exhaustion and that another DAO retains its own capacity. Existing serialized rows and approved liabilities retain their rights; legacy work must be backfilled/drained before enforcement. A full-balance UI shortcut is not proof of contract emergency enforcement.
