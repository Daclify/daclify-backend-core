# Creator recovery and executive active implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Workspace instructions prohibit delegation. Track checks here and in the dated evidence report.

**Goal:** Implement the approved creator-owner/executive-active policy, using 3boidanimus3@active for testnet recovery, and qualify a complete atomic handover on owned native nodes.

**Architecture:** Runtime owns authorization and synchronization. Append explicit policy metadata as a binary extension to the existing nativegov row; preserve existing fields and reject unsupported native policies. The public SDK owns validated setup, final authority descriptions and atomic handover plans; API/UI consume its generated types and pin the matching runtime. A read-only operator command prepares unsigned deployment/setup artifacts and refuses to invent an executive roster.

**Tech Stack:** Antelope C++, Spring 1.2.2, CDT 4.1.1, strict TypeScript, WharfKit, VERT, Vue and Playwright.

**Spec:** ../specs/2026-10-10-creator-owner-executive-active-design.md, approved by the user with creator 3boidanimus3 on 2026-10-10.

## Global constraints

- Work inline on dev and preserve unrelated work. No private environment/key reads, live signing, broadcasts, asset movement, registry publication or production release.
- Creator-only runtime owner; configurable executive quorum in active, own code weighted to that quorum; creator retains full owner recovery override.
- Managed owner/active delegate to runtime active; own code only for configured inline senders; managed code/ABI upgrades owner-linked and core upgrades active-linked after handover.
- Preserve member signing domains, existing table field interpretation, service scopes, governing DAO restriction, eligibility/inactivity fallback, stale-state checks, delayed elections and last-controller safeguards.
- Legacy native policy is never silently reinterpreted. New proposals verify the reviewed runtime hash/ABI and complete account snapshots.

## Review focus

- Creator/managed/executive account cycles, absent code, duplicate names or inline roles outside the managed set must reject.
- Stale creator, policy version, roster, quorum or revision must roll back all staged grants.
- Quorum greater than one must synchronize active without creator signatures and leave owner unchanged.
- Service credentials and module code must remain unable to upgrade/change root ownership; creator recovery remains an explicit override.
- Legacy deployment, missing code/ABI pins and unpaired executives must block unsafe proposals rather than produce a plausible-looking handover.

## Task 1: Versioned contract policy and real handover

**Files:** contracts/common/executives.hpp, contracts/runtime/runtime.cpp, tests/native/executive-handover-portable.test.ts, tests/helpers/native-contracts.ts, generated ABI/schema/release files.

**Interfaces:** setnativegov adds creator:name and inline_code:name[]; handover adds expected_creator:name and expected_policy_version:uint16. nativegov appends optional ownership metadata {policy_version:2, creator, inline_code}. Existing native fields retain their serialization order. Refresh updates existing active with active authorization.

- [x] Record a real-node RED showing the old handover removes creator recovery; preserve the previous binary as an ignored upgrade fixture.
- [x] Implement policy metadata, input/legacy guards, weighted active authority, owner/active links and active-authorized synchronization.
- [x] Compile with pinned CDT, regenerate canonical artifacts and update fixture callers. Verify complete atomic handover, insufficient signatures, owner recovery, stale-state rollback, quorum/roster changes and incoming-wallet replacement.
- [x] Add actual native inactivity/heartbeat and delayed-election synchronization coverage, including all-inactive fallback and owner preservation.

## Task 2: Producer-owned SDK, API and compatibility

**Files:** sdk/executives.ts, protocol/service-api.ts, protocol/base.ts, services/api/src/native-chain.ts, tests/executive-authority.test.ts, tests/executive-gateway.test.ts, module compatibility metadata/tests and generated docs.

**Interfaces:** nativeHandoverActions returns staging plus final handover together; nativeOwnershipAuthorities describes final owner/active authorities; assertNativeOwnershipRuntime validates the observed WASM/raw ABI against producer pins. New capability creator-owner-executive-active requires the corresponding ABI fields. Unsupported/legacy metadata remains distinguishable.

- [x] Add failing SDK tests for atomic plans, snapshot validation, creator/version mismatch, wrong release, code roles and quorum code weights.
- [x] Replace the old exported staging-only planner, add strict policy/release guards and final authority descriptions; retain temporary owner protection during setup.
- [x] Update API capability/disclosure and typed errors. Issue core/SDK 0.13.0-alpha.1 and compatible module SDK 0.9.0-alpha.17; module contract binaries remain unchanged.
- [x] Update all consumer/fixture imports and run producer/API/module compatibility checks.

## Task 3: Reviewable UI and operator proposal

**Files:** frontend ExecutivePanel.vue, executive unit/browser fixtures, pinned artifacts/locks; tools/deploy/prepare-native-ownership.ts, operator guide, design and generated executive help.

- [x] Show creator recovery, managed inline roles, executive q/n, service scope and upgrade policy before download; use active appointments and the canonical atomic SDK plan.
- [x] Refuse unsupported releases/legacy policy and refresh chain identity/account state before preparing proposals. Keep Status rendering actual reported permissions.
- [x] Prepare an unsigned testnet upgrade/link/setup bundle from public profiles and account reads. Verify creator 3boidanimus3, exclude no-code Relay/Fees, expose missing pairing/roster preconditions and produce no invented handover.
- [x] Test desktop/mobile disclosures and stale/wrong release rejection; link public operator/help instructions.

## Task 4: Verification and delivery

- [x] Run complete native permission/module flows against the new actual handover, broad core/module/frontend suites, strict types/lint/docs/build and changed-file formatting.
- [x] Verify preservation/refusal across old-native policy upgrade; record exact artifact hashes, passed/failed/unrun results and live proposal preconditions.
- [x] Review the complete diff inline, commit and push dev in affected repositories. No live rollout follows from these commits.

## Execution ledger

- Clean baselines: core 8a2c5f9, modules 7fe1756, frontend 324176e. User approved the written design and confirmed 3boidanimus3.
- Existing nativegov layout has no policy metadata; current C++ writes govern and runtime-code owner. All new policy/data changes are explicit and versioned.

- Actual creator-recovery regression: old handover failed with code/govern owner; new policy handover passed on Spring 1.2.2.
- SDK preflight additionally requires code-only execctx and every core action link. Ownership staging is only exported together with final handover. Raw eosio.any metadata is checked before WharfKit decoding.
- Core 769/769, modules 163/163 and frontend 209/209 broad tests passed; final browser 16/16 passed. New policy adds 18 core unit/API cases and 19 native cases over the audit baseline.
- Timed actual inactivity/election tests passed. The first combined native run exposed a legacy payroll test settling before its due time (107 passed, 1 failed); the fixture now waits for the actual chain deadline and its three legacy upgrade cases pass. Final complete native rerun passed: 108/108 across all six files, no skips.
- Testnet unsigned proposal reads creator 3boidanimus3, seven deployed managed accounts, eleven missing context links and no executive policy/roster. No live signing or writes. API bootstrap signer must match the separate service public key before handover.
- Rebuilt policy-1 runtime from immutable preceding core source 8a2c5f94622c219814d2bbd0689f49ac6ea12d65 with CDT 4.1.1; hash matches the preserved preceding binary. No fabricated legacy table bytes.
- Review is inline, as required by workspace instructions; no reviewer delegation was authorized.

- Complete final native rerun: 108/108, six files, no failures/skips; 256.70 seconds. Native temporary nodes stopped by fixtures.

- Final disclosure review added a failing browser check for proposed ownership before handover. Corrected configured-creator/effective-quorum wording; final 16/16 desktop/mobile browser checks passed after the change.

- Delivery verified: core ce6725e, modules 24c2f87 and frontend f014bd8 pushed to origin/dev; remote refs matched local HEAD and all three worktrees were clean. No main/tag/registry or live deployment actions. This final ledger update is documentation only.
