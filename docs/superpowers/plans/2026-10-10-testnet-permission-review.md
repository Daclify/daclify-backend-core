# Testnet smart-contract permission review plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. Delegation is prohibited by the workspace instructions. Track this review here and in its evidence report.

**Goal:** Compare actual testnet authorities with contract authorization, deployment tooling and UI signing, implement safe diagnostics, and prepare concrete permission repairs for review.

**Architecture:** Core owns deployment permission expectations and the read-only audit. Reuse the existing context plan and canonical WharfKit account types. Review runtime/module/native-account authority separately from internal DAO roles and browser login. No live signing, transaction broadcast, authority change or handover.

**Tech Stack:** Antelope C++, strict TypeScript, WharfKit, VERT, Vue and Playwright.

**Spec:** The user's attached autonomous audit brief, narrowed by their request to smart contracts, permission setup and UI interaction; the approved executive-authority specification and repository engineering policy govern intended behavior.

## Global constraints

- Work inline on dev; preserve other work and legacy repositories.
- Implement behavior-preserving checks and unsigned plans. Authorization-policy decisions and deployed owner/active changes require a concrete review first.
- No private environment/key reads, live signing, asset movement or production deployment.
- Existing contract binaries, interface versions and public package artifacts remain unchanged unless a separately justified fix requires them.

## Review focus

- Missing or incorrectly assigned action links must be reported individually, without replacing unrelated links.
- An execctx signing key, delegated external authority, altered threshold or parent must block automatic repair proposals.
- Permission inspection must reject the wrong account or chain before presenting usable transactions.
- Explicit action links override wildcard links; unlinked contract upgrades default to active and must not be described as owner-protected.
- Bootstrap ownership and configured service roles must not be confused with executive handover or ordinary member signing.

## Task 1: Discovery and actual-chain evidence

- [x] Read repository instructions, architecture, release policy, executive model and audit brief; record clean dev baselines.
- [x] Capture public API/RPC accounts and code hashes; compare all eight deployed WASM hashes against available local artifacts.
- [x] Compare the expected context plan against actual links; read governance tables and trace contract/UI signing paths.
- [x] Query get_required_keys with unsigned upgrade probes; record that active keys authorize setcode/setabi on all eight contracts.
- [x] Finish action/callback, handover, service, names/treasury and deployment/UI review; classify verified findings and limits.

## Task 2: Read-only drift detection and unsigned repair

**Files:** tools/deploy/permissions.ts, tools/deploy/deploy.ts, new tools/deploy/audit-permissions.ts, new tests/permission-audit.test.ts, operator guide and changelog.

**Interfaces:** Existing contextPermissionPlan defines expected member links. New deploymentContextPermissionPlan consumes DeployEnvironment and reuses it. auditContextPermission consumes its plan and a canonical API.v1.AccountObject; reports authority/parent mismatch, missing or differently assigned links and unexpected context links. upgradePermissionLinks reports the effective minimum permission for eosio setcode/setabi. The CLI uses the public deployment profile and bounded read-only RPC calls, verifies chain identity, and emits JSON including unsigned missing-link actions only when the existing execution authority matches.

- [x] Write regressions for missing/wrongly assigned links, unexpected broad links, execctx authority/parent drift, wrong account, and exact/wildcard upgrade link precedence; observe RED.
- [x] Implement the small shared inspector and reuse deployment account mapping in the existing deploy planner.
- [x] Add a read-only CLI without private-key, signing or broadcast capabilities; run it against testnet and compare the 11 missing links with the captured snapshot.
- [x] Add consistency coverage between the C++ member-action allowlist and the exported context actions so future additions cannot silently omit setup links.
- [x] Run focused and full relevant checks; update operator instructions with the unsigned-only workflow.

## Task 3: Correct pinned module compatibility metadata

**Files:** modules protocol/index.ts, tests/sdk.test.ts, package/lock/changelog/generated documentation; core and frontend pinned module artifacts and locks.

- [x] Reproduce production moduleState against actual RPC: installed, code-verified accounts are incompatible because their catalogue range omits the SDK's pinned core 0.12.0-alpha.1.
- [x] Add a regression accepting the pinned producer release and rejecting unqualified later prereleases/minor releases; observe RED.
- [x] Add exact reviewed 0.12.0-alpha.1 and wallet-consent-fix 0.12.0-alpha.2 compatibility, issue an SDK-only prerelease, regenerate module docs and pin it in consumers. Contract version, WASM/ABI hashes and authorization policy remain unchanged.
- [x] Run module checks and consumer checks, then repeat the actual RPC read path to verify compatibility is restored without bypassing code pins.

## Task 4: Final review, evidence and delivery

- [x] Run core/module compiled-WASM authorization/state suites, UI signing/executive checks, strict types/lint and changed-file formatting.
- [x] Record fresh pinned C++ rebuild and owned portable native results; separate unrun Docker resource/provider/live-wallet suites.
- [x] Review the complete diff inline and retain the selected active core upgrades/configurable quorum and the proposed managed owner upgrade links, service isolation and executive handover.
- [x] Save final results; commit/push only this audit's files to dev after final verification.

## Task 5: Expanded dummy DAO and native authority qualification

The user requested extensive smart-contract functionality, permission and interaction tests during the review. Extend meaningful adversarial cases rather than repeating equivalent unit assertions. Keep all transactions on a fresh owned localhost chain with generated disposable signers; no live authority changes.

- [x] Run pinned Spring 1.2.2 as a disposable process, using verified local archives and a private fixture directory; no Docker/host service installation. Reuse canonical producer ABI/SDK types and fail if required artifacts are absent.
- [x] Test actual creator-owner / executive-active quorum, parent/child minimums, code weights, self-update versus owner update, managed upgrade links, service isolation and atomic rollback with a test-only authority probe.
- [x] Simulate multiple dummy DAOs/users using actual runtime and all five module binaries; exercise signed dispatch, cross-DAO/actor substitution, missing links, callback grants/code pins and once-only accounting through complete workflows.
- [x] Record which tests establish native authority semantics and which simulate the proposed tree without implementing the pending production handover migration.
- [x] Finish final module/native reruns and record all failures/results before delivery.

## Execution ledger

- Baselines: core 773c2a1, modules eb9b7a4, frontend 2df0eb5; clean at discovery.
- Public snapshot: 2026-10-10T18:36:41.595015Z, block 449508942, expected Telos testnet chain. All eight deployed WASM hashes match available artifacts. Later all eleven core/fixture binaries were freshly compiled with verified CDT 4.1.1. The initial deployed runtime remains unchanged.
- Confirmed drift: 57 actual versus 68 required execctx links; 11 missing runtime actions. All ten accounts share one bootstrap owner public key. nativegov and execpols have no rows.
- Actual unsigned get_required_keys: active alone satisfies code/ABI authority on all eight deployed contracts (16 checks). No execution, signing or broadcasting.
- Authorization-only execctx probes are inconclusive: both an existing link and a missing link return unsatisfied_authorization because code-only execctx cannot be satisfied by an external active-key signature. Do not present those probes as proof of action execution or a permission bypass.
- Initial focused core suite: 106/106 across 13 existing files; initial frontend signing/executive/map suite: 43/43 across four files.
- Initial full module run: 160/162; completion-upgrade and document-reference-pruning each time out at the existing five-second limit under shared VM load. Rerun with an explicit larger budget without changing assertions or configuration.
- Ruling: keep all work inline and preserve native authority policy during safe implementation, as required by the workspace and the user's audit decision gate. A mistaken authority change could transfer deployment control, so the reviewable plan is the boundary.
- Added scope after source tracing: NativeChainGateway.moduleState uses compatible(VERSION, manifest.coreRange), while all five module ranges omit the SDK's own pinned core 0.12.0-alpha.1. Frontend ModulesPanel and related panels correctly disable incompatible modules. Correct the producer metadata rather than weakening those guards; retain exact future-release rejection.

- Scope extension: strict testnet features reproduced a real incoming-wallet link failure. Preserve intended dual consent by requiring incoming@active in outer dispatch and forwarding execctx only inline; remove the VERT wallet-code workaround. The raw ABI, persisted tables and signing domains remain unchanged. Intermediate actor-only consent failed a weak-child native regression and was tightened before the final compiled build.
- Pinned tools are extracted into /data/daclify-runtime/toolchain-review from SHA256-verified official Spring 1.2.2/CDT 4.1.1 packages. No host service/install or live transaction was used for native verification.
- Correct governance scope: global govpolicies has four rows. Earlier govpols/DAO-scope reads do not establish absence. Nativegovernance tables remain empty; ordinary ballot quorum is separate.
- Development artifacts: core/SDK/frontend 0.12.0-alpha.2; module SDK 0.9.0-alpha.16, unchanged module contract version 0.9.0-alpha.5. Final runtime hash and rollout dependency are recorded in the evidence report. No registry release or deployment.
- Final results, original timeout failures and limitations are recorded in docs/evidence/2026-10-10-testnet-permission-review.md. Production creator-owner/executive-active handover remains a concrete proposal under the user's authorization-policy decision gate.

- Final broad/native results: core 751/751; modules 163/163; frontend 209/209; new portable native 89/89. Added 108 tests. Lint/types/build and generated docs checks passed; changed core formatting and full module/frontend formatting passed. Unchanged OpenBao and ignored database-fixture formatting failures remain outside this change. Exact original/rerun results and artifact hashes are in the evidence report.
