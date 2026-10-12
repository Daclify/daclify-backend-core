# Governing Documents Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Delegation is unauthorized. Follow the repository's continuous implementation and completed-code review workflow.

**Goal:** Manage constitutions and legal documents in Documents with explicit version adoption and stable-member acceptance records.

**Architecture:** Decide owns authoritative register/proposal/acceptance state, while core retains generic documents, encryption and version references. A module-owned paginated read API and generated ABI feed the existing Vue Documents screen.

**Tech Stack:** C++ CDT 4.1.1 `-O=s`, strict TypeScript/Zod, Vue 3, VERT, Spring 1.2.2, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-governing-documents-design.md`

## Global Constraints

- Administrator or member-vote approval is chosen per registration and immutable.
- At most 64 registered documents per DAO; one Constitution; one pending amendment per registration.
- Exact version/hash and current adoption revision bind approval. Vote policy revision and source hash remain pinned.
- Proposal expiry is 7 days after vote close or administrator proposal submission; cleanup batches are at most 25 IDs.
- No table-layout changes, privacy/grant-policy changes, new dependencies or live authority/deployment changes.
- Develop, verify, commit and push `dev`, preserving other work. Work inline.

## Review Focus

- An amendment published while a vote is open must not replace either the candidate or adopted version (Task 1).
- A passing ballot cannot be swapped, replayed or cancelled by an administrator (Task 1).
- An old module installation/API must leave generic Documents usable and refuse formal adoption (Task 2).
- An adoption changing after a member opens it must reset review and prevent signing stale acceptance (Task 3).
- Private content unavailable under from-join rules must not offer acceptance based on unread ciphertext (Task 3).

### Task 1: Authoritative document lifecycle and public SDK

**Files:** modules `contracts/decide/decide.cpp`, `contracts/common/governing_documents.hpp`, `protocol/index.ts`, generated Decide SDK; core `contracts/common/ram_families.hpp`, `resources.hpp`; modules `tests/governing-documents.test.ts`.

**Interfaces:** Produce `regdoc(runtime,dao_id,member_id,document_id,category,approval,track_acceptance)`, `proposedoc(runtime,dao_id,member_id,register_id,document_version,expected_revision,ballot_id)`, `adoptdoc(runtime,dao_id,member_id,proposal_id)`, `canceldoc(runtime,dao_id,member_id,proposal_id)`, `ackdoc(runtime,dao_id,member_id,adoption_id)`, `cleardocs(runtime,dao_id,proposal_ids)`; generated fixed-size `docregs`, `docchanges`, `docaccepts` schemas.

- [ ] Write compiled-WASM lifecycle/adversarial tests first; run `npm test -- tests/governing-documents.test.ts` in modules. Expected: missing new ABI action fails before implementation.
- [ ] Implement bounded register/history/acceptance state, matching document refs, source/policy/DAO/member checks and RAM recipes. Expected: candidate remains v1 when v2 is uploaded; one Constitution; once-only adoption/acceptance; no administrator vote bypass.
- [ ] Compile/release core protocol 0.14.0-alpha.5, module SDK 0.10.0-alpha.5 (new contract version 0.10.0-alpha.1), regenerate action/table types and release pins. Expected: actual fixture hashes match generated pins.
- [ ] Run module WASM suite and core RAM/document regression suites. Expected: all pass, historical fixtures unmodified. Commit the coherent producer changes.

### Task 2: Paginated verified document register API

**Files:** modules `protocol/api.ts`; core `services/api/src/chain.ts`, `native-chain.ts`, `server.ts`; focused gateway/API tests; generated docs and pinned packages.

**Interfaces:** Produce `ModuleApiRoutes.documents` GET `/v1/daos/:id/governing-documents`, query `{ registerId?, adoptionId?, after?, memberId? }`, response includes `dao`, verified `module|null`, `available`, bounded arrays and `next`. Default enumerates at most 64 register entries; registerId selects up to 25 history rows; adoptionId selects up to 25 acceptance rows. Gateway method is optional for compatible old test/adapters; server returns unavailable when absent.

- [ ] Write isolation, pagination and unsupported-module tests before implementation. Expected: missing route/method/schema fails.
- [ ] Implement typed endpoint backed by actual module tables and fail-closed pins/actions, bounds and response validation. Expected: no cross-DAO/adoption results and no unbounded reads.
- [ ] Generate reference/help and repack artifacts before consumer tests. Expected: typecheck/docs checks pass and schemas are producer owned. Commit.

### Task 3: Documents management and member review

**Files:** frontend `src/components/GoverningDocumentsPanel.vue`, `ContentPanel.vue`, `src/api/client.ts`, document helper/unit/browser tests, help link and vendor pins.

**Interfaces:** Consume Tasks 1/2 actions and schema. Panel props use existing `DaoSummary`, `UserMembership`, `DaoContent`; emits a content refresh after mutations. Reuse content read/decrypt/download and existing signing/ballot-finalization APIs.

- [ ] Write API boundary tests and a browser flow expecting register/adopt, draft distinction, review and once-only acceptance, unsupported/private states. Expected: new UI/API absent.
- [ ] Implement registration, proposal, administrator/member-vote approval, adopted-version view, history and paginated acknowledgement list. Clear context/review state on account/DAO/version changes and cancel stale asynchronous updates. Expected: protected content requires actual successful opening before review/acceptance.
- [ ] Run typecheck, unit tests and desktop/mobile browser/a11y checks. Expected: pass with no horizontal overflow and existing Documents workflows preserved. Commit.

### Task 4: Native verification and delivery

**Files:** core `tests/native/governing-documents.test.ts`, feature guide/evidence/release compatibility, ledger.

**Interfaces:** Consume compiled versioned core/module binary pins and generated SDK; use owned disposable native process helpers.

- [ ] Exercise real permission dispatch, rejection/replay, persisted upgrade state, exact references and native CPU/RAM measurements. Expected: permission boundaries hold and records survive replacement.
- [ ] Run required repository checks and focused native/browser regressions after final changes. Expected: green actual output; record skips/unrun honestly.
- [ ] Review all three diffs inline, update docs/evidence/compatibility and commit/push `dev`. Expected: clean committed worktrees and remote dev heads match. Report new live contract activation as remaining unless expressly authorized.
