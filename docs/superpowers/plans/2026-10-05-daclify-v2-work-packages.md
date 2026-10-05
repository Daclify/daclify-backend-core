# Daclify V2 Work Package Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` for packages in dependency order during one continuous implementation session. Delegation through `superpowers:subagent-driven-development` requires explicit authorization. Completed checkboxes identify only the stated task; repository creation is not a completed V2 application. The user reviews the whole code after implementation, while internal verification continues throughout.

**Goal:** Deliver the entire V2 scope through bounded packages with explicit dependencies, proposed files, and behavioral acceptance evidence.

**Architecture:** Separate frontend, backend core services, and backend modules repositories implement the [architecture specification](../specs/2026-10-05-daclify-v2-architecture.md) and [master plan](2026-10-05-daclify-v2-master-plan.md). Each package freezes its interface, publishes versioned public artifacts and produces a demonstrable capability before another repository consumes it.

**Tech Stack:** Antelope C++, strict TypeScript, Vue 3/Vite, Vue Router, Pinia, versioned generated SDK/schema releases, PostgreSQL migrations for off-chain state, IPFS, VERT/native/EVM/browser tests, and validated provider adapters. V2 removes Quasar.

## How to use these packages

Implementation file paths are qualified by their created private repository: `daclify-frontend/`, `daclify-backend-core/`, or `daclify-backend-modules/`. Each will have independent dependencies, CI and releases. Modules use `modules/<id>/{contracts,server,schemas,sdk,tests,migrations}/` where the module needs those capabilities; C++ sources/headers live under its `contracts/{src,include}/`. Common protocol records and core schemas come from published core artifacts, not copied definitions. Module configuration/ABI producers publish their own generated artifacts for core and frontend consumers.

This file is a scoped backlog and acceptance specification, not fabricated complete implementation code. The next execution plan is [foundation readiness](2026-10-05-daclify-v2-foundation-plan.md). For subsequent packages, write exact commands, concrete failing tests, and full code steps only after the predecessor's actual schemas, toolchain, and APIs exist.

Every package follows: verify its prerequisites; write/freeze its bounded spec; produce the code-level plan; write meaningful failing tests; implement the smallest complete behavior; run its checks; inspect the diff; record evidence and unresolved limitations; and commit a reviewable result. Never import code solely because a repository built or a UI looked functional.

The [versioning/documentation/Pinata/test policy](2026-10-05-daclify-v2-release-docs-test-policy.md) applies to every package. Add generated references and explanatory guidance with each feature, extend the requirement-to-test register and publish compatibility evidence. Package checkpoints are internal; do not stop for user approval after each module. Genuine missing policy/access can block a dependent boundary, while independent work continues. Production actions remain separately authorized after final code review.

## Package dependency map

| Package | Subject | Depends on | Release stage |
| --- | --- | --- | --- |
| WP01 | Evidence and feasibility | Current research | P0 |
| WP02 | Repository setup, versioned interfaces, CI and test infrastructure | WP01 | P1 |
| WP03 | DAO runtime, Hub, modules and deployment isolation | WP02 | P1 |
| WP04 | Internal/native identity, both custody modes and recovery | WP02, WP03, custody feasibility | P2 |
| WP05 | Social and Telegram authentication | WP04 | P2 |
| WP06 | Governance credits and native weight providers | WP03, WP04 | P3 |
| WP07 | Native treasury and payment obligations | WP03, WP04 | P3 |
| WP08 | Decide, proposal executor and committees | WP06, WP07 | P3 |
| WP09 | Works milestone funding | WP08 | P4 |
| WP10 | Payroll and due-payment execution | WP07, WP08 | P4 |
| WP11 | Durable content and IPFS | WP03, WP04 | P3/P4 |
| WP12 | Private content, admission policies and key lifecycle | WP04, WP11 | P4 |
| WP13 | Product UI and configuration presets | WP02 onward, matching API packages | P1-P4 |
| WP14 | EVM identity and wallet validation | WP04, WP08, EVM feasibility | P5 |
| WP15 | Telos EVM assets, vaults and settlement | WP07, WP14, runtime feasibility | P5 |
| WP16 | Hosted Operations and integrations | WP05, WP08-WP12 | P6 |
| WP17 | Entitlements, billing and resource economics | WP16 and measured service costs | P6 |
| WP18 | Migration, independent deployment kit and launch | Required WP01-WP17 capabilities | P7 |
| WP19 | Other-chain adapters | Stable WP14/WP15 interfaces and a selected customer use case | P8 |

## WP01 Evidence and feasibility

**Files:** Create `daclify-backend-core/docs/evidence/baseline.md`, `daclify-backend-core/docs/security/threat-model.md`, `daclify-backend-core/docs/decisions/{toolchain,custody,identity,governance-weights,deployment,privacy,settlement}.md`, `daclify-backend-core/tests/fixtures/reference-deployments/`, and `daclify-backend-core/tools/probes/`. Preserve the six legacy repositories as read-only inputs during the baseline task.

- [ ] Record source revisions, current tool versions, original audit results and their exact limits. Verify deployed account code/permissions separately from local source.
- [ ] Select a stable supported C++ toolchain against the target native runtime. Build a minimal current contract, generate ABI, and run it in both VERT and a real local chain.
- [ ] Inventory VERT's supported/missing intrinsics; document which acceptance tests require native runtime execution.
- [ ] Prototype user-controlled key generation, vault unlock, recovery, and supported Telegram/webview behavior using disposable keys.
- [ ] Prototype managed signing/decryption recovery with a candidate production key provider, including curve support, audit logs, export/exit, expiry handling, and measured cost.
- [ ] Demonstrate native/EVM state reads and calls in a sandbox. Record success versus revert, gas exhaustion, receipt/state persistence, authority and rollback semantics.
- [ ] Estimate RAM/action costs for identity, credits/checkpoints, votes, obligations, documents and encrypted key grants. Set initial byte/batch limits from measured examples.

**Acceptance:** A selected toolchain and custody implementation have evidence; unsupported capabilities are explicitly gated; the threat model names actual key holders, upgrade authorities, attack boundaries and expected failure recovery. A desktop-only passkey test cannot satisfy the Telegram gate. No production transaction or secret material is created by the readiness plan.

## WP02 Repository setup, versioned interfaces, CI and test infrastructure

**Files:** Create `daclify-frontend/{package.json,package-lock.json,vite.config.ts,tsconfig.json,src/app/,tests/}`, `daclify-backend-core/{package.json,package-lock.json,tsconfig.json,services/,protocol/schemas/,sdk/generated/,tools/codegen/,tools/build/,tools/docs/,tests/}`, `daclify-backend-modules/{package.json,package-lock.json,tsconfig.json,modules/,catalog/,tools/codegen/,tools/docs/,tests/compatibility/}`, and each repository's `.github/workflows/`. Core also owns `daclify-backend-core/docs/releases/compatibility.json`, the release-manifest schema, requirement-to-test register and pinned contract toolchain manifest. Each repository owns its changelog and release workflow.

- [x] Create and clone the three private V2 repositories under Daclify, preserving the six legacy repositories. Repository creation only; no application scaffold or CI is implied.
- [ ] Establish independent lockfiles and pinned dependency/toolchain baselines; preserve the old demo as a reference.
- [ ] Enable TypeScript strict mode and Vue template checks. Add lint rules rejecting application `any`, unchecked assertion shortcuts and suppression comments.
- [ ] Generate producer-owned SDK action/table types from built ABI, publish versioned common/module schemas and verify runtime boundary validation. Establish typed error envelopes and redaction rules.
- [ ] Select an immutable package/artifact registry and publish safe core protocol/SDK and module configuration/type artifacts. Pin consumer versions and record the compatible frontend/core/module/ABI set in the release manifest.
- [ ] Add cross-repository consumer/provider compatibility tests and a breaking-change rollout procedure. Reject manually copied model definitions and production builds using local package overrides.
- [ ] Implement immutable semantic releases, prereleases/changelogs and explicit persisted interface/schema versions. Pin code/ABI and documentation hashes in the tested release manifest; verify supported old consumers and fixtures.
- [ ] Generate schema/ABI/configuration/error references and versioned documentation bundles with topic IDs. Validate links/examples and generation consistency; explanatory feature guides remain a separate requirement.
- [ ] Establish synchronously initialized VERT fixtures from the actual C++ WASM/ABI and a local native chain with permission test fixtures.
- [ ] Establish meaningful API, EVM and browser test entry points; test scripts must execute suites and fail when required suites are absent.
- [ ] Build per-repository CI for type checking, lint, C++ build, ABI/codegen consistency, contract tests, integration tests, browser smoke/accessibility checks and dependency review. Frontend explicitly runs `vue-tsc`; a Vite build is not a type-check pass.
- [ ] Publish build hashes, selected runtime/tool versions and check results as artifacts without credentials or raw private payloads.
- [ ] Register acceptance scenarios/invariants and distinguish VERT, native, provider, EVM and browser results. Add reproducible property/state-machine/fuzz infrastructure where it exercises critical behavior; reject required suites with zero tests or silent skips.

**Acceptance:** A deliberate type mismatch, stale generated ABI type, incompatible core/module release, failing native permission check, absent required suite and failing browser journey each fail the relevant CI. A clean checkout of each repository reproduces its selected builds from pinned public artifacts. A supported older consumer remains functional during a compatible producer rollout. Incorrect docs versions/examples and replaced release artifacts are rejected. Exact repository script names/commands are documented after setup rather than assumed in this programme plan.

## WP03 DAO runtime, Hub, modules and deployment isolation

**Files:** Create `daclify-backend-core/contracts/common/include/{identifiers,checked_amounts,errors,capabilities}.hpp`, `daclify-backend-core/contracts/runtime/include/{runtime,dao,roles,module_grants}.hpp`, `daclify-backend-core/contracts/runtime/src/`, `daclify-backend-core/contracts/hub/{include,src}/`, `daclify-backend-core/protocol/schemas/modules/`, `daclify-backend-modules/catalog/`, `daclify-backend-core/tools/deploy/`, and `daclify-backend-core/tests/contracts/{vert,native}/{isolation,modules,permissions,hub}.spec.ts`.

- [ ] Implement stable DAO/deployment/member references and versioned runtime/module interfaces.
- [ ] Create DAO configuration, membership policy, role grants, authority transitions, direct deployment connection and discovery registration.
- [ ] Implement first-party manifests with schema validation, bounded dependencies, grants, configuration revisions and capability discovery.
- [ ] Implement shared scope/ledger isolation and independent deployments using the same interfaces.
- [ ] Verify Hub registration/replacement authorization and signed deployment references. Keep Hub authority separate from DAO execution.
- [ ] Provide upgrade and module removal procedures that preserve pending ballots, liabilities and document access.
- [ ] Implement version discovery and authorized bounded/resumable on-chain migration gates. Test old row/action fixtures, interrupted migrations, retry and rejection of mixed-format writes.

**Acceptance:** Two shared DAOs with identical local IDs/tickers cannot authorize cross-DAO changes; forged callbacks and secondary-index mismatches fail. An independent deployment performs core actions with the Hub unavailable. A module lacking its explicit grant cannot spend, mint, admit members or update roles. Native owner/active/code authorities match the published deployment manifest.

## WP04 Internal and native identity, both custody modes and recovery

**Files:** Create `daclify-backend-core/contracts/runtime/include/{identity,signed_instruction,recovery}.hpp`, `daclify-backend-core/contracts/runtime/src/{identity,authorization,recovery}.cpp`, `daclify-backend-core/sdk/public/signing/`, `daclify-backend-core/services/api/src/{identity,custody}/`, `daclify-backend-core/migrations/`, `daclify-frontend/src/auth/{vault,signing,recovery,custody}/`, and identity/replay/recovery tests in the owning repository's contract/integration/browser suites.

- [ ] Implement internal member identities, native wallet bindings, custody metadata and DAO-specific membership references.
- [ ] Implement canonical signed instructions with full chain/deployment/member/DAO/action binding, nonwrapping nonce policy, expiry and concurrency handling.
- [ ] Implement scoped sessions with explicit action limits, revocation, expiry and step-up requirements; relayer credentials do not count as member approvals.
- [ ] Deliver user-controlled key vault and encrypted recovery flow chosen in WP01. Exclude plaintext keys from storage, ordinary exports, logs and analytics.
- [ ] Deliver managed key custody/recovery, separate key-service authority, privileged operation audit, quotas and orderly export/exit behavior.
- [ ] Implement recovery and custody-mode transitions with new-key proof, revocation, waiting/notification policy and content-key rewrapping hooks.
- [ ] Implement native-to-internal binding without regenerating membership or voting weight.

**Acceptance:** Wrong chain/deployment/DAO/action signatures, expired instructions, replay, parallel nonce reuse, revoked sessions and wallet-link takeover fail. Recovering through social identity alone cannot decrypt a user-controlled vault. Managed recovery works on a lost-device scenario and discloses provider authority. A recovery operation cannot silently retain an old signing key or create another member vote.

## WP05 Social and Telegram authentication

**Files:** Create `daclify-backend-core/services/api/src/auth/{oidc,telegram,linking,sessions}.ts`, `daclify-backend-core/protocol/schemas/auth/`, `daclify-frontend/src/features/{onboarding,telegram}/`, and API/browser tests in the respective repositories. Telegram notification/command modules use `daclify-backend-modules/modules/integrations/telegram/` and the published core identity/host interfaces.

- [ ] Implement the chosen OIDC provider with issuer/audience/signature/expiry/nonce/state verification and stable provider-subject linkage.
- [ ] Implement account linking and unlinking requiring current user intent and existing credential authorization; avoid automatic merging by email.
- [ ] Validate Telegram Mini App `initData` on the server with official verification, a freshness window and a replay policy.
- [ ] Keep Mini App login, bot commands and notification subscriptions separate. Route commands through the same account/DAO capability checks.
- [ ] Exercise both custody flows inside supported browsers and real Telegram clients; publish tested support and fallback behavior.
- [ ] Validate cookies/session controls, logout/revocation, CSRF where applicable, rate limits, generic public errors and redacted logs.

**Acceptance:** Forged/stale Telegram data, wrong OAuth audience, replayed challenges and account-link CSRF fail. Telegram profile objects alone cannot authorize a contract action. A linked social/Telegram credential does not gain new DAO powers or recover user-controlled content keys. Provider removal has a tested account-continuity path.

## WP06 Governance credits and native weight providers

**Files:** Create `daclify-backend-core/contracts/governance/include/{credits,checkpoints,weights,stake}.hpp`, `daclify-backend-core/contracts/governance/src/`, `daclify-backend-core/protocol/schemas/governance/`, `daclify-backend-core/sdk/generated/governance/`, and core credit/staking/checkpoint tests.

- [ ] Implement DAO credit classes, governed issuance/burn, bounded precision, supply reconciliation and default nontransferability.
- [ ] Freeze transfer/expiry policy before ABI implementation; if transfers are enabled, implement checkpoint preservation and conservation.
- [ ] Implement a native token staking/checkpoint provider with full contract/symbol/precision validation, lock/unlock policy and rejected unsupported assets.
- [ ] Bind ballot eligibility and weight evaluation to an explicit pinned policy and evaluation time.
- [ ] Define active-ballot behavior for credit mint/burn, membership removal, recovery, linked-wallet changes and stake transfers.
- [ ] Define a canonical governance source for bridged assets and reject configurations that double-count backing and representations.

**Acceptance:** Unauthorized mint/burn, cross-DAO credit confusion, precision overflow and supply mismatch fail. Transfer-and-revote cannot reuse voting power. New credentials do not duplicate weight. Past ballot weights remain interpretable after configuration changes and cleanup. Native asset balance observations alone are not advertised as snapshots.

## WP07 Native treasury and payment obligations

**Files:** Create `daclify-backend-core/contracts/finance/include/{treasury,obligation,native_settlement}.hpp`, `daclify-backend-core/contracts/finance/src/`, `daclify-backend-core/protocol/schemas/payments/`, `daclify-backend-core/services/api/src/treasury/`, `daclify-backend-core/services/worker/src/reconciliation/`, and core treasury/notification/obligation tests.

- [ ] Implement explicit per-DAO balances, reserved commitments, depositor/member liabilities, fees and actual asset backing.
- [ ] Validate native transfer notifications, including real token contract, recipient, symbol/precision, quantity and DAO deposit reference.
- [ ] Implement authorized transfers, internal backed beneficiary claims, verified withdrawal destinations and duplicate-proof obligation IDs.
- [ ] Implement native settlement from actual successful contract actions with least-privilege inline authority.
- [ ] Provide failure/retry/reconciliation states and an explicit policy for unsupported or malformed deposits.
- [ ] Add explicit DAO-confirmed external-payment evidence records, with authorized acceptance, obligation binding and duplicate-evidence rejection. Label this as DAO confirmation; automated attested/contract-verified adapters belong to WP19.
- [ ] Expose balances and obligation status through validated SDK/API projections; browser displays cannot authorize or fabricate settlement.

**Acceptance:** Forged/forwarded notifications, wrong recipient, same-symbol rogue tokens, cross-DAO spending, negative/overflow quantities and insufficient unreserved backing fail. Deposits/fees/transfers reconcile after success and rollback. Duplicate obligations/retries pay once. An internal governance-credit balance can never be withdrawn as money.

## WP08 Decide, proposal executor and committees

**Files:** Create `daclify-backend-modules/modules/decide/contracts/{include,src}/`, `daclify-backend-modules/modules/decide/{schemas,sdk,tests}/`, `daclify-backend-core/contracts/runtime/include/{proposal,executor,committee}.hpp`, `daclify-backend-core/contracts/runtime/src/executor.cpp`, and module/core ballot/threshold/execution/committee compatibility tests. Core owns role/seat primitives; Decide consumes bounded election/result capabilities.

- [ ] Implement member, credit and supported native-token voting with exact quorum/approval/tie/abstention definitions.
- [ ] Support yes/no/abstain proposals, single-choice and bounded approval elections, optional revoting and frozen options/content/policy.
- [ ] Implement permissionless or narrowly permissioned finalization after the deadline and durable result storage.
- [ ] Consume finalized results through authenticated, retryable execution; validate every proposed action and bound execution targets/deadlines.
- [ ] Implement committee seats, terms, removal and scoped powers through the same authorization model.
- [ ] Provide explicit revocation/tightening rules for dangerous pending proposals without silently relaxing a pinned approval requirement.

**Acceptance:** Boundary-time votes, empty/duplicate/invalid selections, quorum denominators, abstention-only ballots, ties, threshold extremes, weight mutation, forged results, duplicate execution and stale/revoked authority are tested. An unavailable proposer or failing receiver cannot trap ballot finalization indefinitely. Old elections self-initialization/max-vote bugs have semantic regression cases in the new tests.

## WP09 Works milestone funding

**Files:** Create `daclify-backend-modules/modules/works/contracts/include/{grant,milestone,acceptance}.hpp`, `daclify-backend-modules/modules/works/contracts/src/works.cpp`, `daclify-backend-modules/modules/works/{schemas,sdk,tests}/`, `daclify-frontend/src/features/works/`, and module/core milestone/reservation/acceptance compatibility tests.

- [ ] Implement draft, funding approval, funded work, report submission, review/revision, acceptance, pending payment, paid, completed and cancelled transitions.
- [ ] Select grant-level versus milestone-level reservation and define future-funding guarantees, deadlines and cancellation/dispute authority.
- [ ] Freeze approved milestone amounts and content commitments; distribute division remainders explicitly.
- [ ] Require configured acceptance by members/committee before creating a payable obligation; support an advance only as an explicitly approved payment type.
- [ ] Route settlement through WP07/adapter interfaces and retain liabilities when modules/services are disabled.
- [ ] Offer optional anti-spam bonds separately from subscription billing; do not inherit Works' 5% launch fee by default.

**Acceptance:** A report containing `x` does not by itself authorize payment. Zero milestones, allocation remainder, double acceptance, double claim, unauthenticated reviewer, exhausted funds, failed payout and cancellation after partial settlement are tested. Reserved funds reconcile and accepted unpaid obligations survive module removal or subscription expiry.

## WP10 Payroll and due-payment execution

**Files:** Create `daclify-backend-modules/modules/payroll/contracts/include/{payroll,schedule}.hpp`, `daclify-backend-modules/modules/payroll/contracts/src/payroll.cpp`, `daclify-backend-modules/modules/payroll/{server/jobs,schemas,sdk,tests}/`, and `daclify-frontend/src/features/payroll/`. Due-payment jobs use the versioned core worker host; schedule/idempotency tests verify that integration.

- [ ] Implement one-off and bounded recurring schedules with exact count, period, funding, beneficiary, due date and cancellation policy.
- [ ] Freeze missed-period/catch-up policy and accrued-versus-future liability rules.
- [ ] Execute due obligations through WP07 with bounded batches and idempotent keeper submission.
- [ ] Provide manual execution and reconcile retries after downtime, worker restart and insufficient balance.
- [ ] Preserve approved/accrued obligations when future schedule automation or subscription entitlements end.

**Acceptance:** Reject repeat count zero, overflow, invalid periods, malformed receiver, wrong token and insufficient funds. Concurrent workers cannot double-pay. A delayed worker follows the documented catch-up policy. The old `addmany` repeat-zero behavior has a meaningful regression case. Freeze/unfreeze and cancellation never label an unpaid obligation paid.

## WP11 Durable content and IPFS

**Files:** Create `daclify-backend-core/contracts/runtime/include/{document,metadata}.hpp`, `daclify-backend-core/contracts/runtime/src/content.cpp`, `daclify-backend-core/sdk/public/content/{cid,metadata,versioning}/`, `daclify-backend-core/services/api/src/content/providers/pinata/`, `daclify-backend-core/services/worker/src/pinning/`, `daclify-frontend/src/content/`, and core/frontend persistence/CID/provider tests.

- [ ] Implement typed versioned document records, bounded metadata JSON, validated CIDs/commitments and immutable versions/current pointers.
- [ ] Implement Pinata upload/pin/retrieve/publish behavior with backend-only least-privilege credentials, capability/quota checks, constrained short-lived signed URLs where supported, verified completion and orphan cleanup.
- [ ] Fix the CID import profile and verify reconstructed-byte integrity before authoritative publication; distinguish IPFS DAG CIDs from raw file digests.
- [ ] Define supported content formats, size limits, measured Pinata allowances, pin retention/export/re-pinning and safe rendering of untrusted content. Pin encrypted private bytes on public IPFS; do not substitute provider access links for member encryption.
- [ ] Implement public document export, availability reporting and metadata/tombstone behavior for deletion.
- [ ] Ensure the content API does not require historical block scanning to display a published version.

**Acceptance:** Retrieve documents after browser/service restart and with legacy history APIs unavailable. Malformed CIDs, oversized metadata, schema mismatch, wrong commitment, forged upload completion, cross-DAO quota/ticket abuse, signed URL replay/expiry, missing pins, provider rate limits/outage/credential expiry, gateway corruption and malicious content are tested. Verify live sandbox upload/retrieval separately from fault mocks. Pinata credentials/private plaintext never reach the static bundle, ordinary logs or provider metadata. Delete/export UX accurately reflects immutable public history and retained copies.

## WP12 Private content, admission and key lifecycle

**Files:** Create `daclify-backend-core/sdk/public/content/{envelopes,key-grants}/`, `daclify-backend-core/contracts/runtime/include/{key_epoch,key_grant,privacy_policy}.hpp`, `daclify-backend-core/contracts/runtime/src/key_grants.cpp`, `daclify-backend-core/services/api/src/custody/content-keys/`, `daclify-frontend/src/content/encryption/`, `daclify-frontend/src/features/private-content/`, and cross-repository encryption/membership/recovery tests. Client encryption and private managed-custody implementations remain in their respective trust boundaries.

- [ ] Fix a reviewed encryption envelope from the WP01 prototype, with per-version content keys, authenticated encryption and separate signing/encryption purposes.
- [ ] Implement DAO key epochs, authenticated member grants, historic-access policy and future-access rotation on removal.
- [ ] Enforce user-controlled-only versus managed-allowed admission; disclose managed provider decryption authority.
- [ ] Support recovery and custody transitions without assuming social login can restore user-controlled keys.
- [ ] Keep titles/files/private notifications/search/logs consistent with the chosen privacy policy; verify ciphertext precedes IPFS publication.
- [ ] Document offline key-grant availability and trustee recovery policy if a DAO selects one.

**Acceptance:** Tampering, wrong epoch/member/DAO, replayed grants and unauthorized recovery fail. Excluded members and operator-only credentials cannot decrypt user-controlled-only content. Managed service recovery is demonstrable and labelled. Newly admitted/revoked members follow selected history/future policy. Already-disclosed historic content remains readable in the revocation test, accurately documenting the limit.

## WP13 Product UI and configuration presets

**Files:** Create `daclify-frontend/src/{app,components,stores,sdk}/`, `daclify-frontend/src/features/{onboarding,dao-setup,members,modules,governance,treasury,works,payroll,documents,billing,migration,help,upgrades}/`, `daclify-frontend/docs/users/`, `daclify-frontend/tests/{unit,e2e}/`, and producer-owned `daclify-backend-modules/catalog/presets/` consumed through pinned validated artifacts. Module UI screens are reviewed frontend source, not remote executable catalogue content.

- [ ] Deliver the Vue 3/Vite strict TypeScript shell, Vue Router, Pinia stores, pinned generated SDK/schema consumers and direct/Hub deployment connection. Use an accessible consistent component layer without Quasar.
- [ ] Build custody-aware onboarding/recovery, setup presets and capability-aware wallet/token/payment choices.
- [ ] Deliver each feature screen alongside its authoritative package, including pending/failure/retry states and clear authority/upgrade summaries.
- [ ] Display asset precision and verifier mode accurately; show unsupported capabilities explicitly; separate real chain state from labelled fixtures.
- [ ] Replace dynamic remote component loading with reviewed first-party components and a typed module/config registry.
- [ ] Deliver contextual setup/action help, searchable version-aware documentation, custody/privacy/settlement explanations and matched release notes. Use producer-generated references plus tested explanatory user guides.
- [ ] Show connected deployment/module versions and upgrade/migration guidance; reject incompatible transaction encodings. Include the matching documentation bundle in independent deployment kits.
- [ ] Verify keyboard, labels, focus, contrast, zoom, mobile/browser support and real Telegram-client behavior.

**Acceptance:** Complete the journeys in the master plan. No `NaN` progress, unnamed controls, invalid ARIA, nested buttons or disabled zoom regressions. Unsupported EVM wallets/assets cannot produce a success screen. An API/network failure leaves a recoverable state and never leaks an internal exception or key. Contextual help resolves to the connected module's version, examples match schemas, keyboard/focus/search work, and incompatible or missing docs produce an honest visible state. Untrusted help content cannot execute code or expose private DAO data.

## WP14 EVM identity and wallet validation

**Files:** Create `daclify-backend-core/sdk/public/signing/evm/`, `daclify-backend-core/contracts/runtime/include/evm_authorization.hpp`, `daclify-backend-core/contracts/runtime/src/evm_authorization.cpp`, `daclify-frontend/src/auth/evm/`, `daclify-frontend/src/features/wallets/`, and core/frontend signature and cross-runtime wallet-validation tests. Shared instruction encoding belongs to the core public protocol; optional runtime contract-wallet validation uses declared module capabilities.

- [ ] Implement proof-of-control binding for namespaced EVM addresses and existing internal identity authorization.
- [ ] Implement a canonical EIP-712 instruction schema with target/member/DAO/action/nonce/expiry binding and C++ verification.
- [ ] Provide fee-sponsored relaying with rate/resource limits and explicit user intent; classify relayer outage as liveness failure.
- [ ] Add contract-wallet validation only through authenticated ERC-1271/runtime evidence; expose capability gates until verified.
- [ ] Support unlink/recovery/custody transitions and chain switching without changing identity or creating extra votes.

**Acceptance:** Wrong chain/domain/deployment, signature malleability/invalid recovery, replay, duplicated nonce, changed action, wallet takeover, contract-wallet misclassification and revoked bindings fail. EOA and supported contract-wallet flows pass complete browser-to-contract tests. EVM governance membership does not require an asset bridge transfer.

## WP15 Telos EVM assets, vaults and settlement

**Files:** Create `daclify-backend-modules/modules/telos-evm/contracts/{include,src}/`, `daclify-backend-modules/modules/telos-evm/evm/contracts/{DaoVault,SettlementRegistry}.sol` only if the feasibility design selects these contracts, `daclify-backend-modules/modules/telos-evm/{schemas,sdk,server/jobs,tests}/`, and core/module runtime/decimal/reconciliation compatibility tests.

- [ ] Select and document per-DAO EVM vault authority for shared and independent deployments.
- [ ] Pin supported runtime ABI/storage/code versions and replace raw layout assumptions with checked adapters.
- [ ] Implement supported asset registration and checked integer decimal conversion; define rejection policies for incompatible token behavior.
- [ ] Implement obligation-bound execution and explicit durable success/refund/failure evidence; indexers discover jobs while contracts validate authority/state.
- [ ] Add an authenticated checkpoint/locking provider for supported ERC-20 governance. Current storage alone is not historic voting evidence.
- [ ] Implement retry, gas management, outage/revert handling, finality policy, consumed obligation IDs and balance reconciliation.

**Acceptance:** Test native call authorization, successful EVM receiver execution, revert, out-of-gas, failed native delivery after EVM work, refunds, administrative deletion, pruning and duplicate submissions. Deleting an EVM request cannot automatically prove payment. Shared DAO vault isolation and canonical bridged-token voting prevent cross-DAO spend/double weight. Historical compiler/runtime compatibility and the Boid bridge's token-specific assumptions are verified rather than inherited.

## WP16 Hosted Operations and integrations

**Files:** Create `daclify-backend-core/services/worker/src/host/`, `daclify-backend-core/services/api/src/module-host/`, `daclify-backend-core/migrations/`, `daclify-backend-modules/modules/operations/{server,schemas,tests,migrations}/`, `daclify-backend-modules/modules/integrations/{telegram,webhooks}/`, and restart/idempotency/core-host compatibility tests. Core retains basic relay/pinning/reconciliation services; premium automation/integration behavior is supplied by enabled module releases.

- [ ] Implement durable work leases, bounded retry/backoff, idempotency and recovery using the simplest sufficient database-backed job model.
- [ ] Schedule already-authorized native/EVM operations, remind members about ballots/milestones and report actionable failures.
- [ ] Deliver Telegram notifications and a first-party signed webhook interface with subscription validation and explicit private-data policy.
- [ ] Record job states, finality/settlement evidence, costs and reconciliation without plaintext private documents or keys.
- [ ] Provide self-hosted compatible service configuration and manual fallback paths.
- [ ] Add infrastructure only after measured load shows the database-backed design is insufficient.

**Acceptance:** Restart/concurrency/provider outage does not duplicate work or payments. Stale/forged callbacks fail. Automation cannot approve ballots or deliverables. Private notification content follows the selected policy. Manual due-payment and proposal execution work with the hosted scheduler stopped.

## WP17 Entitlements, billing and resource economics

**Files:** Create `daclify-backend-core/protocol/schemas/entitlements/`, `daclify-backend-core/services/api/src/{billing,quotas}/`, `daclify-backend-core/migrations/`, `daclify-backend-core/docs/business/{pricing-evidence,resource-policy}.md`, `daclify-frontend/src/features/billing/`, and core/frontend/module billing/expiry/export compatibility tests.

- [ ] Measure per-DAO relay, RAM, IPFS, managed signing/recovery, worker and support costs; interview operators about willingness to pay.
- [ ] Define free allowances and one paid Operations package with explicit resource/retention limits; treat final prices as a business decision supported by this evidence.
- [ ] Select checkout rails/provider and implement validated, idempotent billing events and DAO-scoped entitlement state.
- [ ] Enforce paid service access on its service boundary; keep billing independent from governance authorization.
- [ ] Define expiry/grace/retention/export/custody exit behavior and portability when a DAO changes deployment mode or service provider.
- [ ] Offer specialist support/deployment services and advanced first-party modules separately only when demand justifies their delivery cost.

**Acceptance:** Forged/replayed billing events, disputed payments and duplicate purchases cannot create governance grants. Expiry preserves withdrawal, export, user-controlled decryption, managed recovery/exit within the published policy and accepted obligations. A self-owned deployment can use compatible alternative services. A free DAO has a viable resource budget rather than an unbounded subsidy.

## WP18 Migration, independent deployment and launch

**Files:** Create `daclify-backend-core/tools/migration/{inventory,export,documents,normalize,import,compare}/`, `daclify-backend-core/tools/deploy/{shared,independent,verify}/`, `daclify-backend-core/docs/{migration,operators,security,releases}/`, `daclify-backend-modules/tools/deploy/`, `daclify-frontend/docs/users/`, and cross-repository migration/deployment conformance fixtures and release manifests.

- [ ] Inventory actual deployed contract code, authorities, assets, members, liabilities and documents at a recorded block reference.
- [ ] Recover legacy documents from real history/original content where available; identify permanently missing content.
- [ ] Map legacy roles/proposals/payroll/module configurations to explicit V2 schemas and report unsupported or changed behavior.
- [ ] Dry-run exports/imports and reconcile assets, credit supply, liabilities, document commitments and identity bindings.
- [ ] Deliver independent deployment/pinning/relayer documentation and conformance verification with the Hub/hosted services unavailable.
- [ ] Complete threat-model review, independent security review, reproducible artifact verification, permission graph review, backup/restore and incident rehearsals.
- [ ] Deliver the complete-code review packet: all repository commits, release/compatibility manifest, generated references and user/operator guides, migrations/deployment tooling and actual passed/failed/unrun test evidence. Obtain the user's final review before any expressly authorized production release.
- [ ] Perform an authorized testnet migration and constrained mainnet pilot; reconcile afterward before general availability.

**Acceptance:** No invented document recovery, implicit identity ownership or paid status. Missing records and unresolved liabilities remain visible. Asset migration uses authorized legacy governance. Cutover has a safe coexistence/abort plan; after real payouts, rollback uses reconciliation rather than blind snapshot restoration. Published deployment authorities and build hashes match the reviewed artifacts.

## WP19 Other-chain adapters

**Files:** Create one named chain package under `daclify-backend-modules/modules/external/<chain>/{contracts,server,schemas,sdk,tests}/`, destination-chain contract code only when required, and `daclify-backend-modules/docs/adapters/<chain>/`. Consume published core identity/asset/obligation interfaces and test against pinned supported core releases.

- [ ] Select a real DAO use case and name the exact capability: account binding, governance weights, asset transport, payment execution or settlement verification.
- [ ] Choose DAO-confirmed, attested or contract-verified settlement and publish its verifier/root/finality trust model.
- [ ] Bind chain, vault, recipient, asset/amount, obligation, event/state identity and verifier version; use authenticated state evidence for contract-verified mode.
- [ ] Implement liveness, reorg/replacement/refund, double consumption, failed destination execution and replay-retention policy.
- [ ] Expose supported features and verification labels through the existing module manifest/UI.
- [ ] Review the adapter independently before expanding the claim to another chain or proof model.

**Acceptance:** A transaction hash alone cannot settle a contract-verified obligation. Fake roots/receipts, wrong assets/recipients, failed/reorged transactions, reused evidence and cross-chain replay fail. Source-chain bridge success without destination delivery remains unsettled. Payments work without forcing assets to bridge into Telos where the selected architecture does not require it.

## Legacy feature mapping

| Existing behavior | V2 destination | Migration policy |
| --- | --- | --- |
| Custodian invitations/removal, thresholds, native account authority | Runtime roles, committees, proposal executor and deployment authority manifests | Preserve intended powers after reviewing actual owner/maintainer graph. No platform-maintainer owner shortcut by default. |
| Proposals, approvals, cancellation and execution | Decide plus executor | Translate supported action sets; open legacy proposals are reviewed and recreated or completed under legacy policy. Do not manufacture approvals. |
| Native balances, internal transfers and withdrawals | Treasury and backed member claims | Reconcile against real tokens and deposit liabilities before import/movement. |
| Elections, candidacy and stake | Decide elections, committees and weight adapters | Import candidates/roles when compatible; active-election migration requires an explicit cutover policy. |
| Payroll and recurrence | Obligation-based payroll | Preserve unpaid/accrued liability; reject invalid recurrence instead of importing wrapping counters. |
| Profiles, terms, avatars and membership | Identity/membership and content metadata | Use stable IDs, privacy-aware fields and proof of legacy account control. |
| `fileupload` / block-trace reconstruction | Durable versioned documents/CIDs | Recover actual available content; report gaps. No history scan as the new storage model. |
| Linked modules and hooks | Versioned module capabilities and authenticated callbacks | Import only reviewed compatible modules; no arbitrary inherited owner/code grants. |
| UI frames and custom components | Typed first-party configuration and component catalogue | Reuse assets/workflows selectively. Do not execute remote code from legacy metadata. |
| Hub listings, code/ABI references and deposits | Discovery Hub and separate service/billing accounting | Verify ownership/artifact references; fix ABI-hash and token-identity semantics in the new model. |

## Review and estimation record

Each package receives an owner, estimate, interface revision, test evidence, security review outcome and release capability label when execution begins. Estimates are produced after feasibility, not inferred from the number of checkboxes. The managed-custody, encrypted-content and cross-runtime packages have the highest uncertainty and must not be left until the end of a UI-first schedule.
