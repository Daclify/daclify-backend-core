# Telos Governance Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Workspace instructions require inline work and prohibit delegation. The user has authorized continuous implementation and reviews the completed code afterward.

**Goal:** Browse retained Telos Decide history/open ballots, cast native-wallet votes, and provision/reuse a paired Daclify account during voting.

**Architecture:** Modules own a bounded external Decide reader and action/schema adapter. Core hosts its public API and extends native authentication with explicit signup and persistent profile origin, preserving recovery checks. The Vue frontend supplies a separate public Telos entry and uses the existing exact-transaction native signer.

**Tech Stack:** Existing strict TypeScript, Zod, WharfKit, PostgreSQL, Fastify, Vue/Pinia, Vitest and Playwright; no new runtime dependencies or voting contracts.

**Spec:** [Approved design](../specs/2026-10-11-telos-governance-entry-design.md).

## Global Constraints

- Work inline on the three clean `dev` checkouts; preserve unrelated changes. No sub-agent delegation or production deployment.
- External source is the API operator's configured native chain/RPC and `telos.decide`, with `4,VOTE`; no caller-supplied RPC/contract.
- Browsing uses bounded contract-order pagination and states retained-history coverage. Signing needs explicitly configured compatible code/ABI pins; no automatic approval of an upgrade.
- Native account signup uses a separate `signup` proof purpose; ordinary native/EVM recovery continues to require current discovered membership for recovered wallet-only profiles.
- Start with Anchor and supported direct-key `active` authorities. Daclify account/membership and external vote authority remain distinct.
- Native signing validates the exact transaction and live ballot again before broadcast. No backend signature or automatic token transfer.
- No new contract fields/indexes. If contract fixtures are compiled, use pinned CDT `-O=s` and record actual measured artifacts.
- Release public artifacts and docs with coordinated development versions; no immutable/production qualification claims from fixtures.

## Review Focus

- A new wallet-only signup must still log in before joining any Daclify DAO; test both signup and later ordinary login.
- An existing recovered profile whose native membership was revoked must still fail login; preserve the current wallet-recovery regression.
- A ballot deadline can pass while status remains voting; test the awaiting-closure display and refusal to sign.
- A replaced wallet, source, route or ballot during approval must prevent broadcast; test a paused wallet response and changed state.
- Lost broadcast responses must retain transaction identity and reconcile without resubmitting; test the pending confirmation path.

---

### Task 1: External Decide schemas, reader and action encoding

**Files:** Create module `protocol/telos-governance.ts`, `sdk/telos-governance.ts`, `sdk/telos-decide-abi.ts`, `tests/telos-governance.test.ts`; modify `protocol/index.ts`, `sdk/index.ts` and module docs generator.

**Interfaces:** Produce `TelosGovernanceSourceSchema`, `TelosBallotSchema`, `TelosBallotPageSchema`, `TelosVoterStateSchema`, `TelosVoteInputSchema`, `TelosGovernanceRoutes`; `TelosGovernanceClient(source, rpc)` with `ballots(cursor?)`, `ballot(name)`, `voter(name, ballot)` and `prepareVote(input)`; `telosVoteActions(source, ballot, voter, options)` returning wharfkit actions. The reader consumes an explicitly provided typed native RPC capability, not private core code.

- [x] Write tests for bounded pagination/source checking, exact ballot lookup, malformed/oversized records, contract-defined weight/registration, invalid/duplicate selections, deadline/revoting and incompatible pins. Expected payloads bind exact actor/ballot/treasury.
- [x] Run `npm test -- tests/telos-governance.test.ts`; expect missing feature failures before implementation.
- [x] Implement the minimal producer-owned schemas/reader and the ABI-derived registration/casting actions. Limits: 25 rows/page, 256 KiB RPC response, 256 options, 4 KiB description/title and 8 KiB content reference; cursor is a canonical uint64. Verify chain identity and pin compatibility before prepared votes.
- [x] Run targeted tests and module typecheck; expect all targeted cases and types to pass. Record actual commands/results.

### Task 2: Native signup with preserved account/recovery behavior

**Files:** Modify core `protocol/native-wallet.ts`, `protocol/api.ts`, `protocol/service-api.ts`, `services/api/src/auth/native-routes.ts`, `services/api/src/auth/wallet-recovery.ts`, `services/api/src/auth/account-session.ts`; create `migrations/039_native_signup.sql`; extend `tests/integration/wallet-recovery.test.ts` and protocol tests.

**Interfaces:** Add `signup` to native intent/message purpose; `POST /v1/sign-up/native` consumes `NativeFinishSchema` and returns `SessionSchema`. Wallet-only account responses expose optional `walletOrigin: 'signup' | 'recovered'`. The native signup path acquires the existing native-credential lock, reuses an existing pairing and stores signup origin only on a fresh account. Ordinary wallet recovery consumes this marker when determining whether discovered membership is required.

- [x] Add real-signature/PostgreSQL cases: native newcomer signup, return login without membership, concurrent reuse, ordinary login cannot create unknown accounts, revoked recovered membership, replay/purpose/origin/account takeover, existing-vault preservation, migration reapplication.
- [x] Run `npm run test:integration -- tests/integration/wallet-recovery.test.ts` against an owned loopback `_test` database; expect new cases to fail before implementation.
- [x] Add the new constrained persisted origin and signup-purpose migration, atomically provision a fresh native account/link/session, and preserve existing recovery semantics. Existing root profiles keep their response shape.
- [x] Run the integration file, protocol tests and core typecheck; expect meaningful new cases and existing recovery cases to pass.

### Task 3: Hosted read/preparation API

**Files:** Create core `services/api/src/telos-governance.ts`, `tests/telos-governance-routes.test.ts`; modify `services/api/src/server.ts`, `services/api/src/main.ts`, `.env.example`.

**Interfaces:** Host module-owned routes `GET /v1/telos/ballots`, `GET /v1/telos/ballots/:ballot`, `GET /v1/telos/ballots/:ballot/voters/:voter` and `POST /v1/telos/votes/prepare`. Source config uses the operator network and optional `TELOS_DECIDE_CODE_HASH`/`TELOS_DECIDE_ABI_HASH`. Preparation returns validated ballot/voter/source state; it never signs or broadcasts. Reads are public and rate-limited.

- [x] Add route tests showing public reads, source isolation, schema validation, provider outage, bounded cursors, pin mismatch and no broadcast side effect.
- [x] Run the route file and observe missing-route failures.
- [x] Implement module integration with bounded RPC transport and useful redacted errors; expose read-only capability when signing pins are absent or incompatible.
- [x] Run routes, core types/lint and producer docs checks; expect success or explicitly record existing baseline failures.

### Task 4: Public Telos entry and wallet vote journey

**Files:** Create frontend `src/views/TelosGovernance.vue`, `src/auth/telos-governance.ts`, `tests/unit/telos-governance.test.ts`, `tests/e2e/telos-governance.spec.ts` and a disposable browser wallet fixture; modify `src/main.ts`, `src/views/Hub.vue`, `src/api/client.ts`, `src/auth/telos-zero.ts`, `src/views/Account.vue`.

**Interfaces:** Consume module schemas/routes and core signup/session interfaces. Produce `nativeTelosVote(input, checkContext)` returning the transaction ID, with a distinct unconfirmed result retaining that ID. Reuse exact-transaction signing; public browsing creates no account. First Vote authenticates with purpose signup, accepts the paired session, refreshes preparation, then requests the actual vote signature.

- [x] Write unit and browser cases for public history/open ballots, awaiting closure/missing metadata, safe links, first vote notice/signup reuse, vote options/registration, read-only capability, rejection, paused-wallet context changes and unconfirmed broadcast.
- [x] Run targeted tests and observe missing flow failures.
- [x] Add the route/discovery entry, accessible pagination/details/options, signup and actual native action signing. Validate live chain/pins/ballot/voter before broadcast, retain transaction IDs on uncertain outcomes, and route other-DAO key setup to the existing account page.
- [x] Run targeted unit/browser suites on desktop/mobile plus `npm run typecheck` and production build; expect all new cases to pass.

### Task 5: Cross-repository verification and delivery

**Files:** Update public package versions/pins/locks, producer guides/generated references, SDK README/release metadata; add core `docs/telos-governance.md` and `docs/evidence/2026-10-11-telos-governance-entry.md`; update this ledger/approved-design status to actual results.

**Interfaces:** Publish only local development tarballs for matching core/modules/frontend, preserving unchanged C++ code pins. The exact coordinated versions are chosen after current release state is inspected; all consumer integrity pins refer to newly built producer artifacts.

- [x] Build/package core protocol and module SDK, install pinned artifacts in consumers and regenerate both documentation bundles. Verify generated schema references/help match their producer.
- [x] Run complete appropriate unit suites, targeted real-database/signature integration, desktop/mobile browser flow, types/lint/docs/builds and safe live mainnet read probe. Report existing failures by name; provider fixtures are not live Anchor qualification.
- [x] Review the final connected code/diff inline under Ponytail Full; no delegation. Fix substantive findings with reproducing tests.
- [x] Commit scoped changes on each `dev`, push `dev`, and record exact versions/commits/checks/limits in evidence. No live deployment or wallet transaction is authorized.

## Execution record

Plan reviewed against the approved design. Native source selection stays bound to the operator's current network so account-control proofs and votes cannot silently use different chains. The user already specified inline continuous execution through workspace/repository instructions; no additional plan approval checkpoint is introduced.
