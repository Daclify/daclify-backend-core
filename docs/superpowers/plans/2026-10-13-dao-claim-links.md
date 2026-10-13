# DAO Claim Links Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task, inline. Delegation is prohibited by workspace instructions. The user approved the design and requested execution; continue without repeated internal approvals.

**Goal:** Let a Daclify governing-DAO executive issue a seven-day claim link whose first eligible recipient creates a shared DAO and becomes its sole founding member, administrator and executive.

**Architecture:** Store bounded invitation drafts and reservations in PostgreSQL. Reuse account approval, canonical identity, immutable creation orders and payment flows. A trailing optional founder extension on `createpaid` initializes membership, governance and executive office atomically without a new service permission or persistent contract field.

**Tech Stack:** Existing strict TypeScript/Zod/PostgreSQL, Antelope C++ with CDT 4.1.1 `-O=s`, Spring 1.2.2, Vue/Vite and Playwright. No new dependency or daemon.

**Spec:** [Approved design](../specs/2026-10-13-dao-claim-links-design.md). The user said “ok execute” after reviewing the flow; proposed shared human/mixed scope, seven-day expiry, revocation and existing-account entry are the first-version defaults.

## Global Constraints

- First eligible authenticated confirmation wins; opening/previewing/signing in does not reserve or consume the link.
- Only the claimant joins initially; the issuer receives no new-DAO role. Create the DAO on-chain only on claim.
- Human/mixed shared DAOs first; refuse agent-only drafts and founding-agent substitution.
- Seven-day expiry; revoke only before reservation; an in-flight claim never becomes reusable through expiration or cleanup.
- Stable canonical identity, existing custody/payment/resource checks, once-only native reference and retry recovery remain authoritative.
- Fresh operation/body/account/session/origin/audience-bound issuer approval and current native executive status are mandatory.
- No general `appoint` service permission, shared runtime authority replacement, native draft table, private-key disclosure, production rollout or real account deletion.
- Preserve previous artifacts; publish immutable core20/module28/frontend27/MCP11 artifacts after verification. Update the active starter cohort while retaining earlier downloads.

## Review Focus

- A link shared in a messenger is previewed automatically: preview cannot allocate or consume anything (Task 2/4).
- Account/network changes during async approval or claim: refuse substituted context and preserve resumable ownership (Task 2/4).
- A lost response after native commit: return the same DAO with real executive status (Task 1/2/3).
- The issuer loses office, reconnects accounts or requests erasure: unclaimed drafts cannot outlive authority or leak their setup (Task 2/3).
- A paid claim returns after expiry or restart: preserve its reserved account/order and verify payment without giving the link to another recipient (Task 2/4).

### Task 1: Atomic native founder executive

**Files:** Modify `contracts/common/creation.hpp`, `contracts/runtime/runtime.cpp`, `services/api/src/native-chain.ts`; regenerate `sdk/generated/*`; create `tests/dao-claim-founder.test.ts`, `tests/native/dao-claim-founder-portable.test.ts`.

**Interfaces:** `createpaid` keeps its existing serialized prefix and appends `binary_extension<claim_founder> founder`. The transient struct has `encryption_key:string`, `custody:uint8`, `settings:gov_settings`. It enrolls member 1 with the order's `creator` public key and initializes the sole executive with inactivity 0/quorum 10000. `NativeChainGateway.createDao(account,input,paid?:{reference:string;daoId:string;founderExecutive?:boolean})` consumes this extension only for claim orders, omitting separate initialization/enrollment actions.

- [x] Write VERT regression asserting one active admin/human member with the receipt creator's key and an actual executive row/policy; existing DAO, unpaid/wrong creator, invalid custody/key/policy and agent-only founder fail atomically without consuming receipt. Legacy action bytes still work without appointing anyone.
- [x] Run `npx vitest run tests/dao-claim-founder.test.ts`; observe the missing extension/office failure before implementation.
- [x] Add the extension and native gateway payload; use existing validation/enrollment/policy helpers. Existing rows, authorities and service links remain unchanged.
- [x] Build with pinned CDT, regenerate SDK/releases, run founder plus existing fee/preflight/executive suites. Record WASM/ABI growth, native RAM delta and action CPU from the portable test; verify legacy serialized action prefix.
- [x] Commit the independently tested native change.

### Task 2: Drafts, reservations and canonical creation integration

**Files:** Create `protocol/dao-claims.ts`, `services/api/src/dao-claims.ts`, `migrations/050_dao_claim_links.sql`, `tests/dao-claims-protocol.test.ts`, `tests/integration/dao-claims.test.ts`; modify protocol exports/routes, `services/api/src/creation.ts`, account-exit inventory/service and auth reconnection.

**Interfaces:** `DaoClaimLinks(pool,chain,creation)` exposes `eligibility(account)`, `issue(account,{request})`, `list(account)`, `preview(token)`, `revoke(account,id)`, `claim(account,{token,method})`, `cleanup()`. Producer routes: GET `/v1/dao-claims/eligibility`, GET `/v1/dao-claims`; POST `/v1/dao-claims/issue`, `/v1/dao-claims/revoke`, `/v1/dao-claims/preview`, `/v1/dao-claims/claim`. Issue returns a one-time secret; public/list previews never return it. Claim returns the existing creation-order view with explicit founding-executive status.

**Persistence:** A draft has UUID, issuer account, bounded immutable setup, chain/runtime, unique SHA-256 token hash, expiration/revocation and optional claimant/method/completion. The draft UUID is also its durable order reservation that can precede native/SQL order publication; unique association determines founding-executive creation inside `CreationService`, even through ordinary order resume. Do not trust a public boolean to authorize it. A reserved order's request must match the draft. Serialize reservations/revocation and validate canonical account ownership with existing `account_owns`. Index only token lookup, issuer bounded listing and expiry cleanup; the primary key provides reservation uniqueness. Stable native references are derived from chain/runtime/draft UUID rather than claimant, protecting once-only native ownership after SQL rollback. Restored unclaimed invitations must be revoked before re-exposure, then bounded maintenance reconciles native receipts while retaining the immutable setup needed by their original claimant.

- [x] Write protocol and actual PostgreSQL tests: preview allocates no order; non-executive/wrong-DAO/stale-office issue rejected; seven-day expiration/revocation; first confirmer under concurrency; same-account resume and other-account refusal; failed preflight leaves unclaimed; substituted setup/network/method rejected; lost response/native completion reconciled; reserved paid claim survives draft expiration.
- [x] Run RED with `npx vitest run tests/dao-claims-protocol.test.ts` and `npx vitest run --config vitest.integration.config.ts tests/integration/dao-claims.test.ts` against owned loopback `_test` SQL.
- [x] Implement producer schemas, migration and service. Extract/reuse creation preflight without weakening existing resumed-order behavior. Persist reservation before remote effects. Derive founder extension from the unique draft/order association and verify native membership/executive readback before declaring a claim created.
- [x] Add bounded unused-draft cleanup, account-erasure coverage and reconnection revocation/resumption rules. Retain only necessary completed reservation associations while removing invitation text/secret hash according to lifecycle.
- [x] Run protocol/SQL creation, erasure/inventory and reconnection regression suites; commit.

### Task 3: HTTP authority and real native qualification

**Files:** Modify `services/api/src/server.ts`, `services/api/src/main.ts`, `services/api/src/auth/intent.ts`, `protocol/sign-in.ts`; create `tests/integration/dao-claims-native.test.ts`; extend existing owned browser fixture.

**Interfaces:** Issuance/revocation are fixed account-control paths with fresh Root/native/EVM or recent paired-sign-in proof, bound to the exact request. The paired-proof allowlist expands only to these two new draft operations, leaving recovery/profile/native authority requirements intact. Claim is session/CSRF-protected under existing sponsored-write limits; anonymous preview uses a bounded limiter. Service installation uses the existing creation service and polling worker; shutdown stops its worker.

- [x] Write failing HTTP/native tests for missing/consumed/body-swapped/wrong-session proofs, stale paired login, CSRF, anonymous preview abuse, issuer eligibility, genuine free creation and simultaneous claim attempts.
- [x] Implement routes, typed public errors, lifecycle wiring and the exact proof allowlist. Do not use login merely as a native member signature.
- [x] Run real native/SQL/HTTP tests through a disposable Spring process and owned database. Check only claimant membership, native office and unchanged issuer/global authorities; verify wrong-context and response-loss retries.
- [x] Run type/lint/docs and existing account-control/creation regressions; commit.

### Task 4: Executive issuance and compact recipient account entry

**Files:** Modify frontend `src/views/CreateDao.vue`, `src/api/client.ts`, `src/main.ts`, account approval component/helpers as found in source; create `src/views/ClaimDao.vue`, `tests/e2e/dao-claims.spec.ts`; update unit account-destination/approval guards and user help.

**Interfaces:** The existing setup shows **Create claim link** only to eligible governing-DAO executives and a bounded list with revoke controls. Copy `/claim-dao#<secret>` links; keep secrets out of queries, local storage, analytics and referrers. Claim page uses producer schemas and the existing account entry/return destination, public identity setup and payment/order controls. Creation is an explicit confirmation; passive return/status reads never create anything.

- [x] Write failing desktop/mobile browser journey: issuer creates/copies/revokes; recipient preview, new account entry and existing passkey sign-in, locked-vault confirmation, sole admin/executive result; preview/cancel/second claimant and immutable resume behave correctly. Add context-change and late payment return checks.
- [x] Implement the compact card with setup/privacy/roles/fee/expiry summary, account entry, explicit claim and pending/payment recovery. Reuse existing controls and maintain accessible focus/errors.
- [x] Run relevant unit/types/lint and actual desktop/mobile browser/native/SQL checks, plus existing creation-session/resume/preset suites. Record real boundaries and any controlled hardware/provider doubles; commit.

### Task 5: Immutable cohort, final review and delivery

**Files:** Version/lock/changelog and generated help updates across core/modules/frontend; published SDK/starter manifests, requirements/evidence and deployment packet.

- [ ] Publish core20/module28/frontend27/MCP11 as new immutable artifacts after strict/generated/full core/modules/frontend checks. Preserve older SDK/companion/starter archives and qualify their supported paths; release new active starter if the exact cohort requires it.
- [ ] Review the complete change inline for authorization, isolation, retry/erasure/cleanup, legacy ABI compatibility and user journey; fix material findings with regression evidence.
- [ ] Prepare clean source-bound testnet candidate and rollback. Requalify version-bound recovery before enabling a new API version; measure native deployment RAM correctly and preserve existing rows, balances, authorities, pins and paused operations. Deploy only within existing testnet authorization; no production/real erasure/asset movement.
- [ ] Verify final public API/artifacts/form at desktop/mobile widths with owned identities, clean temporary sessions and disposable fixtures. Commit/push `dev`, synchronize clean IDE checkouts, record exact passed/failed/unrun checks and final feature limits.

## Inline plan review

Tasks share the transient founder extension, draft/order association, typed routes, exact proof allowlist and frozen SDK cohort. The association is authoritative in the creation service rather than accepted from the claimant. Legacy `createpaid` bytes and all existing table layouts are preserved. Default executive policy is fixed for the sole initial office and can later be changed through normal DAO governance. A prefix reservation can resume after SQL/native failure without releasing the link. User authorization and the repository's continuous inline workflow replace the skill's repeated plan-handoff checkpoint; no delegation is used.
