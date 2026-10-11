# Unified Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. The workspace prohibits sub-agent delegation. Track steps in a task-owned durable ledger.

**Goal:** Present unified public people with profiles, DAO links and authoritative DAO activity.

**Architecture:** Add an independent metered activity table to the runtime, enrich the bounded public member API with public key fingerprints and activity, and consume a producer-owned grouping function in Vue cards and profile details. Keep private account pairings out of public identity aggregation.

**Tech Stack:** Antelope C++, strict TypeScript/Zod, Vue 3, VERT, Spring native tests, Vitest and Playwright.

**Spec:** [Unified public Users directory](../specs/2026-10-11-unified-users-design.md).

## Global Constraints

- Inline continuous implementation on `dev`; no delegation, no live broadcasts or service cutover.
- Preserve existing serialized membership records, credentials, profile ownership, DAO isolation and liabilities.
- Group only matching public credentials in the same chain/runtime; ambiguous shared keys do not merge distinct native accounts.
- Latest activity means a successful authenticated member instruction, never sign-in or enrollment.
- API pages contain at most 50 members; UI loading batches contain at most 20 pages.
- `initactivity` initializes at most 50 members per call and never overwrites an existing timestamp.
- Generated ABI/schema and public SDK are producer-owned; all consumers use pinned packages.

## Review Focus

- Key rotation and shared keys must not merge distinct native accounts or infer private pairings.
- Duplicate memberships, uint64 IDs and later-page profiles must give deterministic results.
- Failed, replayed, wrong-signer and cross-DAO actions must not advance activity.
- Missing legacy activity rows must not block existing member actions or fabricate history.
- Partial loading, retries, deployment changes and missing images must remain usable and truthful on mobile.

### Task 1: Authoritative member activity

**Files:** `contracts/common/records.hpp`, `ram_families.hpp`, `ram_table.hpp`, `contracts/runtime/runtime.cpp`, `tests/member-activity.test.ts`, `tests/native/member-activity.test.ts`, generated runtime SDK.

**Interfaces:** `memberacts` rows `{member_id:uint64,last_active:uint32}`; governance action `initactivity(dao_id:uint64,after:uint64,limit:uint32)`.

- [x] Write actual WASM tests for zero enrollment, successful signing/native actions, failed inline execution, replay, wrong signer, DAO isolation and bounded/idempotent legacy initialization. Observe missing-table/action failures before implementation.
- [x] Add the constant-size scoped activity record, metering family and bounded initializer; preallocate on enrollment and update only existing records in dispatch.
- [x] Compile with pinned CDT, regenerate SDK, run activity/runtime/RAM tests, then native signed activity tests and permission workflows.

### Task 2: Public projection and identity aggregation

**Files:** `protocol/people.ts`, `services/api/src/native-chain.ts`, `tests/people.test.ts`, `tests/public-users.test.ts`.

**Interfaces:** Add nullable `identityKey` (public key SHA-256) and `lastActive` (chain seconds) to `PublicMember`; defaults preserve old response decoding. Add exact member lookup to the existing query. Export `unifyPublicMembers(members:PublicMember[]):PublicUser[]` with representative profile, all memberships and max activity.

- [x] Write and observe failing API tests for scoped activity lookup, fingerprint-only identity, exact member lookup and safe legacy nulls.
- [x] Write grouping tests for repeated native accounts, unpaired shared signing keys, distinct native accounts sharing a key, deployments, uint64 order, duplicate pages, multiple profiles and maximum activity.
- [x] Implement producer-owned types/projection/grouping and run all people/API/schema tests plus strict checks.

### Task 3: Unified cards and profile connections

**Files:** frontend `src/views/Users.vue`, `UserDetail.vue`, `src/components/PeopleGrid.vue`, `PersonCard.vue`, activity/contact helpers, `tests/unit/public-users.test.ts`, `tests/e2e/people-workspace.spec.ts`.

**Interfaces:** Shared directory loading state holds validated `PublicMember[]`, next cursor and error; cards accept DAO links and nullable activity. Details reuse exact lookup plus public membership grouping.

- [x] Write failing tests for automatic multi-DAO loading, one person/all DAO links, avatar and published contacts, latest action/unknown activity, retry, safe links and no nested anchors.
- [x] Implement 20-page bounded progressive loading with cursor checks and stale-response guards; preserve operator scope and prior results on errors.
- [x] Render distinct profile/DAO/contact links, activity and aggregated memberships; keep own editing limited to the addressed membership.
- [x] Run Vue checks, unit tests and people browser journeys on desktop/mobile with accessibility checks and screenshots.

### Task 4: Integration, documentation and delivery

**Files:** package manifests/locks/pinned vendors in all three repos; generated reference docs, people/account guide, upgrade review evidence and plan ledger.

- [x] Bump independent SDK/consumer versions and install pinned development artifacts through the existing bootstrap workflow. Verify modules against the compatible additive core table.
- [x] Update guides/reference generation, preserve live oracle/runtime pins until approved cutover, and prepare the concrete testnet activity initialization/upgrade packet.
- [x] Run required affected suites, inspect the final diff for identity/privacy/authorization/RAM and accessible presentation, record exact evidence and limitations.
- [x] Commit/push `dev` in all affected repositories. Request live rollout approval only after the new packet is concrete and tested.
