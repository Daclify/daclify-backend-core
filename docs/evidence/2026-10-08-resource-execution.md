# Resource billing and Archive execution ledger

Implementation branch: `codex/resource-billing-archives` in isolated sibling worktrees under `/Users/seth/.config/superpowers/worktrees/daclify-ram-history`. Main checkouts are not implementation targets. No sub-agents, deployment, external spending or live data cleanup is authorized by this ledger.

Plan: [RAM, prepaid storage and archives](../superpowers/plans/2026-10-08-resource-billing-and-archives.md). Ponytail 5.0.0, full mode. Test-first implementation proceeds inline; independent format work can advance while enforcement qualification remains pending.

## Verification already run

- Core baseline: `npm test`, 66 files / 425 tests passed.
- Module baseline: 14 files / 83 tests passed after restoring missing ignored compiled core-release fixtures. The first run failed because `.artifacts/core-release/runtime.abi` was absent; it was not a product regression.
- Frontend baseline: 24 files / 101 tests passed; `npm run typecheck` passed.
- Task 1 red run: missing resource module and storage pricing functions caused the expected failures.
- Task 1 green run: `npx vitest run tests/resource-policy.test.ts tests/storage-pricing.test.ts tests/hosting-pricing.test.ts`, 3 files / 9 tests passed.
- Task 1: `npm run typecheck`, focused ESLint, `npm run docs:check` and `git diff --check` passed.

## Task status

| Task                                 | State       | Evidence / boundary                                                                                    |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------ |
| 1 Policy definitions                 | Complete    | Checked integer fees, approved storage units and pricing snapshot hashes; unchanged membership pricing |
| 2 Native write inventory/calibration | In progress | Enforcement unavailable until payer reconciliation is demonstrated                                     |
| 3 Backed allowances/metering         | In progress | Opt-in counters implemented; no funded allocation or enforcement                                       |
| 4 Existing-state migration           | In progress | Observer code rebind preserves rows/counters; legacy backfill pending                                                           |
| 5 Atomic TLOS RAM purchases          | In progress | Native funded-purchase/minimum proof; DAO settlement/API still pending                                 |
| 6 Card RAM provisioning              | Pending     | Segregated operator reserve; no simulated funding                                                      |
| 7 Hosted-object ledger               | In progress | Verified unique-CID accounting and legacy ownership checks; cleanup/lifecycle integrations pending                                                                |
| 8 Monthly storage                    | In progress | Immutable agreements, verified invoice projection, jobs/API/Resources UI; live provider and retention gates pending                                                                      |
| 9 Grace/retention                    | Pending     | No destructive cleanup enabled                                                                         |
| 10 Archive format/package            | In progress | Bounded formats, compiled-schema decoder and installed namespaced migration; service/planner pending                                 |
| 11 Export/verification/approval      | Pending     | Live records remain until verification                                                                 |
| 12 Source pruning/references         | Pending     | Financial/key state excluded                                                                           |
| 13 History/recovery                  | Pending     | Empty-database and original-key restore drill                                                          |
| 14 Resources/Archive UI              | In progress | Storage counters and platform policy controls; funded purchase/Archive journeys pending                                                         |
| 15 Documentation                     | Pending     | Qualified feature descriptions only                                                                    |
| 16 Release/qualification             | Pending     | Native/provider/browser results recorded separately                                                    |

This is a progress ledger, not a release certification. Live Stripe, Pinata and Telos testnet qualification has not been performed for these features.

## Native findings

- Spring 1.2.2 aligns database object overhead to 16 bytes: primary row 112; uint64/uint128/checksum256 indexes 128/144/160; table header 112. The first secondary index shares the primary table ID. Packed row bytes remain additional.
- A real native probe reconciled insert/grow/shrink and primary/secondary last-row erasure, including the 127→128 varuint boundary and UTF-8 bytes.
- A foreign-payer insert charged Alice's RAM when Alice authorized the action. Approved module code is therefore part of the shared RAM boundary.
- `get_resource_limits` is unavailable to an ordinary application contract: native error `3050007 unaccessible_api`. The initial exploratory quota-reader test failed on that real restriction. The regression now asserts the restriction; production must use the qualified system table/code adapter instead of elevating the Daclify runtime to privileged status.

Source: [Spring billing definitions](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/include/eosio/chain/contract_table_objects.hpp), [alignment](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/include/eosio/chain/config.hpp). The USD Stripe maximum is verified from the [PaymentIntent amount contract](https://docs.stripe.com/api/payment_intents/create).

## Real RAM-market fixture and execution-result fix

- Added the owned `daclify-resources-native` fixture on loopback port 20588. The earlier stopped RAM-population fixture and its disposable key files were preserved separately.
- Retrieved public Telos testnet system WASM and binary ABI read-only, verified hashes, and installed them only on the owned local fixture. WASM hash: `48d74c3df9f5c9952c0f87ab6c01e1c6dfe621429f59932ecf609b5d81e668e4`; raw ABI hash: `fccb1a515b98d2232a1227279666d9a3fcd41f67fafa0d75212cc0a282564361`.
- The current system WASM requires additional host features, including Savanna and its advertised dependencies. `tools/native/system.ts` verifies pins and activates dependencies only on this explicit local fixture. It does not sign or spend on the public source endpoint.
- A native `buyrambytes` increased actual account quota. In this artificially small token-market fixture, requesting 16,777,216 bytes initially acquired 15,443,350 bytes. This confirms that receipts must verify actual acquisition and enforce the accepted minimum, rather than blindly credit the request.
- Native system `userres.ram_bytes` reconciled to actual unmanaged quota plus this system's 1,400-byte gift. A later deliberately failed action rolled back receiver acquisition and resource rows.
- Failed transactions can return an HTTP-success envelope containing `processed.except` and no executed receipt. Added a strict, redacted execution validator and bound replies to the actual transaction ID in both API write paths and deployment/funding/enrollment/analysis tools.
- `npm test`: 69 files / 435 tests passed. Focused native RAM geometry/market suites: 2 files / 5 tests passed. Typecheck, lint, generated-doc check and changed-file formatting passed.
- [Write inventory](2026-10-08-ram-write-inventory.json) records 47 compiled owned tables and 137 source write candidates, with DAO bindings and aligned cost recipes. This is the instrumentation inventory, not proof that per-DAO counters already exist or every callback is reconciled.

Remaining Task 2/3 gate: implement all write hooks and prove per-DAO/payer conservation on the actual native runtime before enabling quota enforcement. Native purchases above are standalone market qualification, not implemented Daclify RAM-order settlement.

## Observer checkpoint

- Added opt-in native counters by DAO, RAM payer and identity/activity/retained/platform category. Existing serialized rows, member IDs, nonce domains and interface version remain unchanged. Shared table headers belong to platform; DAO-scoped headers belong to that DAO. Observer metadata is recorded separately and included in conservation.
- Core and all five module table aliases use the metered writes, including secondary-index modification and erasure. Platform singleton writes also participate. Modules resolve legacy vote/control ownership through their existing parent rows rather than changing serialization.
- Counter callbacks require the executing source as native sender, its authority and its currently deployed approved code hash. A directly signed account-key callback is rejected. Module installation/dispatch requires the registered code pin when observation is enabled.
- Observation must start before any tracked state exists. Existing DAO or platform settings require the pending backfill; this checkpoint does not enable observation on an old deployment. Core-code rebinding/migration is not implemented, so do not enable the observer in a production upgrade.
- The initial real-system account-creation setup failed because a separate newaccount transaction had no allocated RAM. The owned fixture now creates, buys RAM and stakes CPU/NET atomically. No public-chain transaction was sent.
- Native conservation passed after each selected transition for core and each module payer: DAO/member creation, platform settings, UTF-8 profile insert/grow/shrink through a secondary index, nonce changes, session insert/last-row deletion, private epoch/key-grant records, documents, Works proposals/milestones, Grants rounds, Payroll entries/reserves/controls, endorsement applications, Decide ballots/votes and core governance locks. A DAO ID equal to the runtime's encoded account name also reconciled. Code/ABI/permission overhead was measured as platform baseline; it was not charged to a DAO.
- The first singleton conservation regression failed by 260 bytes before metering that write; the corrected native sequence passed. The pre-existing-settings regression also failed before the initialization guard and passed after it.
- [ABI compatibility evidence](2026-10-08-observer-abi-compatibility.json): all existing ABI structures and table definitions unchanged against each repository's baseline HEAD. This is layout evidence, not the pending supported-release migration/recovery drill.
- Fresh checks after rebuilding and installing local development artifacts: core 70 files / 440 tests; modules 14 files / 83 tests; frontend 24 files / 101 tests; focused native RAM suites 3 files / 6 tests. All passed. Core typecheck/lint/docs check, module verify and frontend typecheck also passed.
- npm audit still reports the existing VERT development-tool dependency advisories (elliptic and lodash.set; no fix offered). They are not new runtime dependencies. The harness remains a local disposable-fixture tool, and its results do not replace native authorization or cryptography qualification.

Task 2/3 remain in progress: not every lifecycle/table has a native transition vector yet. Physically backed allocations, completion reserves, purchase settlement, legacy backfill, storage billing and Archive are not enabled or release-certified by this checkpoint. No main checkout, external provider data or live funds were changed.

## Archive format and native funding checkpoint

- Added the public `@daclify/modules/archive` subpath and package files for the bounded development format library. An installed tarball, rather than a source import, exposed its encoder/decoder/schema API successfully.
- The original independent Python vector matches TypeScript and compiled C++ on the native fixture for packed domain bytes/hash, all leaves, an odd-tree root and proofs. The wire format is domain plus a bounded ordered row vector; decoding preserves original packed bytes and rejects wrong domains/roots, trailing bytes, malformed/noncanonical length prefixes and counts before allocating records.
- Eight formatter tests pass, including deterministic property cases (seed 20261008), the exact 5 MiB encoded boundary and 65,536 leaves / sixteen proof levels. Native C++ positive/negative format checks pass. This does not establish source eligibility, approval, availability or a restore service.
- Added the pinned-system ordinary-contract quota reader for `userres` and the RAM-managed voter flag. Native checks match the receiver's actual unmanaged quota and reject managed RAM. Missing rows, unsupported code and invalid numeric ranges are rejected; the reader is not a privileged contract and does not infer support for another system build.
- The first inline purchase prototype correctly failed because a contract cannot spend Alice's wallet through its own code authority. The qualified fixture transfers incoming tokens to the contract, buys with that contract's own code authority, and verifies real acquired quota in the next inline callback. It grants no authority over Alice's wallet.
- A deliberately impossible acquisition minimum rolls back the incoming funding, token balances, market resource row and actual receiver quota. A directly signed verification callback is rejected for its native sender. The prototype belongs to the disposable probe, not the DAO purchase/fee ledger.
- Duplicate-transaction caching initially masked the intended managed-RAM rejection. Native market test pushes now use the CLI's supported unique-transaction option and assert the actual contract error; all four market cases pass.
- Latest fresh checks: core 70 files / 440 tests, modules 15 files / 91 tests, frontend 24 files / 101 tests, native focus 4 files / 10 tests. All passed, with core typecheck/lint/docs, module verify/build and frontend typecheck. Source/package files remain local development artifacts; no publishing or external deployment occurred.
- README and generated Archive help explicitly describe unfinished service behavior and changed development-branch module WASM. The original 0.7 upgrade guide does not qualify this branch. A new release/version packet is still required.

Confirmed storage architecture: the user selected **separate Pinata accounts for mainnet and testnet**. Each database maintains a global reference/pin ledger for all DAOs using its own provider account. `PINATA_ACCOUNT_ID` is a stable operator-supplied ownership ID; credential-to-account binding still needs live qualification before cleanup can be enabled.

## Hosted-object ledger checkpoint

- Confirmed separate Pinata accounts for mainnet and testnet. Backend startup now requires a stable `PINATA_ACCOUNT_ID` with JWT/gateway; examples explain the ownership namespace and decimal 100 MB allowance. No private environment file was changed.
- Migration 022 preserves legacy uploads and holds instead of guessing provider ownership. Explicit `storage:claim -- --claim-upload <UUID>` tooling lists the original upload, verifies provider identity, retrieves bytes and checks the commitment before adopting one selected row. Ambiguity, corrupt bytes or another ownership scope leaves the hold; no provider deletion is called.
- Per-environment objects are unique by ownership/import profile/CID, retaining every provider file ID. DAO references count distinct objects once across roles; pending unknown uploads retain separate holds. Reused bytes are verified again. An object being removed cannot receive a new verified reference. Generations exist, but cleanup/leases/staging/compensation remain disabled and unimplemented.
- Added member-authorized producer-typed storage usage API and Documents UI showing capacity, verified/held bytes and object/reference counts. The API/UI bind responses to the full deployment and clear old context. Actual billing still uses the existing configured allowance; prepaid storage agreement provisioning is pending.
- Fresh PostgreSQL integration run: **17 files / 127 tests passed**, including duplicate CID reuse, duplicate provider pins, cross-DAO charges, cross-account isolation, uncertain uploads, corrupt reuse, removal fences and explicit legacy claims. The real seven-migration upgrade test now proves that old provider IDs and unverified holds survive migration 022.
- Owned database fixture: `daclify-resources-postgres`, PostgreSQL 17 on loopback 18532, isolated `daclify_resources_test`. No existing research or testnet database was modified. The owned API used loopback 3058 and UI 5208, then stopped after browser tests.
- Browser fixture initially blocked creation because its runtime hash did not match the newly generated SDK, and subsequently required the registered module catalogue. `configure-resources.ts` is explicitly restricted to the owned chain at 20588; it deploys the local reviewed runtime and configures free creation/catalogue with disposable authorities. All five module hashes were verified by the API. Native CLI deployment replies require a 4 MiB output bound; large code/ABI traces can exceed Node's default buffer even after a transaction executes. No public-chain deployment occurred.
- **Six desktop/mobile browser flows passed**: lost-response/reload completion, private ciphertext publication/decryption/download, and two published references using one storage object. The new flow passed axe accessibility checks. Provider storage is the labelled local disk fixture, not live Pinata evidence.
- Fresh core unit tests: 70 files / 440 tests; modules verify: 15 files / 91 tests; frontend verify: 25 files / 103 tests. Typecheck/lint/generated docs and frontend production build passed. Public artifacts were rebuilt and consumed locally; the version remains an unpublished development packet, not a new immutable release.

Task 7 remains in progress for full branded-media/archive lifecycle integration and safe orphan release. Monthly storage payments, thirty-day retention cleanup, funded RAM allocations/purchase settlement and archive pruning/recovery still remain required. No main branch merge, push, live charge or unpin was performed.

## Governed policy and prepaid-period checkpoint

- Added additive `resourcecfg`, native bootstrap `setresources` and signed administrator `govresources`. The latter is restricted to the linked Daclify DAO and requires the expected revision; stale edits, another DAO and invalid fees/unit prices roll back. Revisioned settings do not grant RAM or start a subscription.
- The canonical producer maps the compiled table into `ResourcePolicySchema`. API status and the Daclify DAO screen expose that validated policy. Existing serialized ABI structures, tables and actions remain unchanged against baseline commit 1954ebf; [compatibility evidence](2026-10-08-observer-abi-compatibility.json) records the current runtime hash.
- Resource settings use the platform RAM observer hooks. Initialization rejects a pre-existing resource policy until backfill. The native core/all-module conservation case now includes the resource singleton and passed. Existing observer deployments still require the pending code-rebinding/backfill qualification; no public upgrade was attempted.
- Paid storage approval binds exact units, amount, full pricing hash and recurring consent. UTC calendar helpers preserve January 31 anniversaries through leap/non-leap February, refuse invalid periods/clocks, keep future prepaid terms pending until their start, and mark overdue at exactly original term end plus 2,592,000 seconds. No retries or membership state enter that calculation.
- Browser regression first caught Vue's implicit number coercion in the new decimal inputs, then the missing native action link. The UI now uses exact decimal text inputs and clears previous success before validation. `govresources` is in the shared execution permission plan; the owned fixture setup applies its code-only `execctx` link. This is native permission evidence, not a public authority change.
- Fresh core unit result: **71 files / 448 tests passed**. The focused four native files / ten tests passed. Module verify remains 15 files / 91 tests; frontend verify is 25 files / 103 tests, with production build/typecheck/format checks passed. Core typecheck/lint/generated-doc checks passed.
- After those fixes, **all ten desktop/mobile resource/file/platform browser cases passed**, including signing the real governed policy and reading it back from the actual local chain/API. Accessibility checks passed in those flows. The owned API was stopped afterward.

Task 8 is in progress: SQL agreements/invoices, Stripe provider verification, capacity provisioning, recurring changes and payment/retention race handling are still pending. The calendar/consent helpers are not payment qualification. The new runtime remains an unpublished local development artifact; no main merge, push, live provider write, charge or deletion occurred.


## Prepaid storage billing checkpoint

- Migration 023 adds immutable administrator approvals and invoice identity/period/dependency domains, separate storage subscriptions/prices/changes and signed-event deduplication. A cross-subscription base dependency regression failed before the composite foreign key fix. The unpublished migration was applied only to a recreated disposable resource database; no supported or live database was reset.
- The new Stripe adapter requires the configured environment/product, monthly licensed quantities, immutable accepted pricing and authoritative invoice-payment/PaymentIntent/charge proof. Checkout links/completion grant nothing. Testnet live keys are rejected; mainnet charging requires its separate explicit flag. Provider objects were synthetic responses through the installed Stripe SDK, not live payment evidence.
- Regressions caught missing licensed-unit/PaymentIntent identity checks and a retried original approval being interpreted as a change. Exact retries now retain their agreement. Pending authentication retains funded base capacity. Upgrades require a verified paid base; reductions/pricing changes use the next period; cancellation preserves already-paid capacity. Partial storage refunds revoke funding without resetting deadlines. Hosted member billing reuses the verifier while retaining its previous partial-refund semantics.
- Active-member content budgets project independent storage funding under the same DAO lock as uploads. Future prepayments do not fill earlier gaps. A paid capacity reduction preserves the larger old term through its original grace deadline; the regression first failed before the projection fix. Unknown holds remain retained and no deletion is authorized by this projection.
- API boundaries require session/CSRF plus a fresh root/linked-wallet control signature and current on-chain administrator status. A valid login does not authorize a subscription. Queued verification has lease ownership checks, bounded retries, redacted failures and review outcomes. Refresh performs no checkout/update mutation; a lost lease can repeat read-only reconciliation.
- Resources is reachable from Documents/DAO Settings and shows verified/held usage, original deadlines, immutable accepted pricing, exact recurring approval and separate RAM status. Changing units/pricing clears consent. Paid-state browser responses are explicitly HTTP fixtures; public upload usage and account-control challenges use the actual owned API/native fixture.
- Fresh core results: **72 unit files / 450 tests** and **20 PostgreSQL integration files / 147 tests** passed. Modules verify: **15 files / 91 tests**; frontend verify: **25 files / 105 tests**. Typecheck/lint/docs/build checks passed before the final documentation rebuild. Four changed desktop/mobile Resources cases passed with axe after a heading-level regression was fixed. The full resource browser rerun and final SDK checks are recorded below when completed.

Live Stripe/Pinata qualification, merchant/account identity checks, full legacy migration/restore, safe retention cleanup, funded RAM settlement and full Archive remain required. This checkpoint adds no external charge, public deployment, unpin or main push.

- Final storage checkpoint checks: core lint/docs and the repeated PostgreSQL suite passed (20 files / 147 tests). The rebuilt public protocol artifact was installed in all three consumers; frontend production build/typecheck passed. The full twelve-case browser run passed eleven cases; the remaining recovery-navigation case passed the focused desktop rerun after waiting for hub navigation. Both desktop/mobile recovery follow-up cases then passed. Fixture unlocking uses the existing redacting helper after exact chain/container checks. These fixture failures were not silently counted as a green full run.


## Archive manifest integrity checkpoint

- Added canonical, bounded manifest schemas and codec through the public Archive subpath. Manifests bind the full DAO/source/code/raw-ABI/schema domain, snapshot identity, ordered families/chunks/counts/roots/CIDs/actual bytes/commitments/key boundaries and retained file-version references. They contain no self hash/CID. Uploaded-byte commitment and packed descriptor commitment are separate and both must reach future approval/availability records.
- Descriptor packing now includes empty-family/source metadata as well as chunks. Duplicate coverage, incorrect ordinals/counts/domains, invalid block-number prefixes, invalid file versions/envelopes and noncanonical JSON fail before use. Per-chunk verification preserves the original bytes, verifying size/hash/root/range. The full-memory helper is explicitly capped at 64 MiB; larger imports need per-chunk processing and an index coordinator.
- A reproducible Python standard-library vector matches TypeScript manifest bytes/descriptor hash and compiled C++ on the actual owned native fixture. The C++ commitment helper and probe do not claim source eligibility, irreversibility, availability or pruning authority. Existing runtime/module row layouts/code are not changed by this helper-only checkpoint; only the disposable probe adds an action.
- Fresh modules verification passed **16 files / 99 tests**. Focused native RAM/market/ledger/archive verification passed **4 files / 11 tests**, including the new C++ manifest vector and changed-coverage rejection. Module/core development packets were rebuilt and installed in consumers. The installed Archive subpath verified the independent manifest commitment and round trip.
- npm’s explicit tarball install rewrote the module peer range into a filesystem URL; it was restored to the exact public 0.7.0-alpha.1 version before packing. The local development artifacts remain unpublished and mutable; a new immutable version/release/upgrade packet is still required.

Archive migration/coordinator, released-schema decoding, terminal eligibility markers, export/backup/approval, source pruning, history/empty-database recovery and UI remain required. No archive prune, unpin, public deployment or main push was performed.

- The installed producer now supplies Archive-owned SQL through a Node-only migration subpath. Core's coordinator applies it under `archive` after core, preserving old migration bytes/locks/hashes. The PostgreSQL red run proved the namespace/table was missing before wiring. Fresh upgrade/domain/namespace tests passed, then the complete **21 files / 149 integration tests** passed. Existing seven-migration upgrade records and provider holds remain preserved. Changing a recorded Archive migration hash refuses startup and rolls back.
- Added a bounded compiled-schema decoder for this development packet's ordinary votes/documents. It rejects unknown code/raw-ABI/schema hashes, wrong DAO scope/parent/primary key and trailing/noncanonical bytes, preserving original ciphertext/epoch metadata. A test fixture initially used a string for the producer's uint32 document byte count; it was corrected to the actual generated model. This helper is not a historic-release catalogue or a completed recovery service.

- Final decoder/manifest module verification: **17 files / 104 tests passed** after correcting the byte-count fixture. Core typecheck/lint and the complete 21-file / 149-test integration suite passed. Only installed producer SQL is consumed; no source-checkout-only migration path or dynamic third-party SQL loader was added. Archive workers, native approvals/pruning and historical recovery are still unavailable.


## Observer code-rebinding checkpoint

- Added native-only `rebindramobs`, requiring current runtime authority plus exact expected previous/current reviewed hashes. Stale, wrong-code, unauthorized and replayed calls reject. The code pin changes without resetting counters or existing DAO/member/native-account/signing/encryption/nonce/document fields. This does not initialize observation over untracked legacy state or create funded capacity.
- The first fixture setup correctly failed because its own active permission lacked `eosio.code`; the owned fixture now explicitly configures the same code authority used by the observer tests. The missing-action/unchanged-code regression then failed before implementation. The real native upgrade sequence passed after adding the action, and passed again against a reproduced commit-81afcba binary with existing DAO/member/document rows.
- The existing upgrade builder gained a bounded observer-baseline mode, preserving its original pre-research upgrade mode. All original runtime structs/tables/actions still compare equal against 1954ebf; compatibility evidence records the new current code hash. New native maintenance actions are additive and are not in the user/relayer instruction allowlist.

Legacy backfill, new funded allocations/reserves, native/card purchase settlement and complete Archive/cleanup/recovery remain pending. No public contract or main checkout was upgraded.

- Final observer checkpoint: native focus **5 files / 12 tests**, core **72 unit files / 450 tests**, PostgreSQL **21 files / 149 tests**, modules **17 files / 104 tests**, generated docs and consumer typechecks passed. The focused upgrade was repeated with both platform and DAO counter scopes. Fixture configuration refuses implicit code replacement when an observer exists; an explicit maintenance upgrade is required.
