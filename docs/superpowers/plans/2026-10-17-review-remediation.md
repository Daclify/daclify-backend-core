# Repository review remediation implementation plan

> Execute inline with `superpowers:executing-plans`. No delegation. The user authorized all four repairs in the [review](/data/daclify-runtime/review-all-20261017/review.md).

**Goal:** Remove the four reproduced defects without changing voting identity, payment ownership, custody or historical content rights.

**Architecture:** Reuse the transaction's connection; use authoritative native recovery continuity to resolve current approval/receipt authority; enforce current content epochs only for newly changed references. Preserve existing serialized records and signature domains where possible, and release matched producer artifacts for every changed consumer.

**Tech stack:** PostgreSQL, strict TypeScript, Vue, Antelope C++ (pinned CDT 4.1.1, `-O=s`), VERT and native Spring fixtures.

## Constraints and review focus

- Work on the clean `dev` checkouts, preserving existing worktrees. Almaiso is excluded. No live deployment, authority changes or asset movement in this repair session.
- Old SQL snapshots cannot revive retired keys; recovery must resolve to the current native root, including repeated recovery and conflicting keys.
- Original Quick identity/votes stay fixed; old signatures, wrong domains, nonces and unauthorized replacement keys fail.
- Original paid receipt remains evidence and can create at most one DAO; current founder identity and claim-link executive initialization stay correct.
- Concurrent requests must finish with a pool smaller than request concurrency; archive advisory locks must not reserve all connections and borrow more.
- Unchanged historical private assets remain valid after rotation; newly changed stale references fail with a resumable reprepare path.

## Task 1 — Reuse checked-out database connections

Files: `services/api/src/creation.ts`, `services/api/src/quick-ballots/archives.ts`, `tests/integration/{creation,quick-archives}.test.ts`.

- [x] Add small-pool concurrent order status/prepare/fulfillment and archive discovery/export regression coverage; run and record the expected connection-acquisition failure.
- [x] Thread the existing `PoolClient` into nested reads and policy checks. Reuse it for export transactions while retaining session advisory locking and rollback/discard behavior.
- [x] Run affected PostgreSQL integrations and type checks. Audit connected-app nested reads and fix any equivalent confirmed path within this task.

## Task 2 — Preserve Quick ballot control through contact recovery

Files: `contracts/common/{contact_recovery,quick_accounts}.hpp`, `contracts/quickauth/authorization.hpp`, `protocol/quick-accounts.ts`, `sdk/quick-accounts.ts`, `services/api/src/quick-ballots/{accounts,service,chain}.ts`, frontend `src/{auth/session,quick-ballots/approval}.ts`, relevant unit/PG/native tests.

- [x] Read all root/default/signature callers and existing recovery evidence. Record the exact minimal interface decision below before editing it.
- [x] Add failing recovery tests: stable identity and prior vote, replacement approval/default/deactivation/re-registration, retired key rejection and repeated recovery.
- [x] Resolve current key authority using native `recroots`/`recretired` evidence. Preserve immutable anchors, replay protection and default-wallet consent. Update typed API/SDK/browser consumers where needed.
- [x] Run API/browser/real-WASM/native authorization tests, including supported upgrade behavior.

## Task 3 — Fulfill paid setup after contact recovery

Files: `contracts/runtime/runtime.cpp`, `services/api/src/{creation,native-chain,dao-claims}.ts`, related SDK/native/PG tests and generated ABI.

- [x] Add failing tests for normal and claim-link receipts after recovery, retries, already-consumed receipts and unauthorized/superseded keys.
- [x] Use the same native key-family continuity at the receipt consumption boundary. Keep immutable payment evidence and exactly-once DAO creation; enroll the current key and preserve original request policy.
- [x] Exercise free/card/TLOS receipt semantics, recovery and DB restore/reconciliation through real compiled contracts and service integration.

## Task 4 — Reject newly published stale private references

Files: `contracts/runtime/runtime.cpp`, frontend `src/content/dao-identity.ts`, existing private identity/native/browser tests.

- [x] Add failing epoch-rotation tests for changed identity/assets and unchanged historical references.
- [x] Require current epoch only on newly changed nonempty references. Make browser publication retain the pending draft and expose existing Reprepare behavior on epoch drift.
- [x] Run actual-WASM/native tests and frontend interrupted-publication/reprepare tests.

## Completion

- [x] Generate ABI/docs and matched versioned protocol/module/frontend dependencies if interfaces change; retain exact historical fixture pins.
- [x] Run appropriate complete default suites, type checks, relevant PostgreSQL/native upgrade/security tests, and inspect final diffs inline.
- [x] Record tests, failures, limits, WASM size and release status. Update review evidence to link the repairs; do not claim rollout qualification from mocks.

## Execution ledger

- Start: core `ab8b52c`, modules `a918281`, frontend `3ce8644`; all clean on `dev`.
- Ruling: repair in the existing clean dev checkouts — avoids duplicating scarce disk/dependencies and follows the workspace's continuous inline workflow; existing feature worktrees stay untouched.
- Baseline: all four failures already reproduced in `/data/daclify-runtime/review-all-20261017/`; new durable regressions will be run red before source edits.

- Task 1: regression runs recorded expected timeouts with one connection; DAO/Quick archive 7/7 and connected-app 26/26 now pass. Equivalent nested reads in connected-app approval, token exchange and relay are included; caller-owned transaction clients are threaded through access/claims/config reads.
- Ruling: use existing native `recroots`/`recretired` reads at proof and receipt consumption, keeping original Quick identity transcripts and paid receipts immutable. Add an optional typed current approval key to API contexts; no new on-chain rows, indexes, action formats or signature domains. New Quick registrations after recovery use the original root anchor to avoid duplicate identity. Existing frozen anchors remain unchanged.
- Tasks 2/3 baseline: actual-WASM tests exercised the full 48-hour/two-contact recovery and showed old-key acceptance; PG tests reproduced missing current approval and `CREATION_OWNER`. API regressions now pass (23/23 across creation, Quick submissions and anchor constraints). Native guards implemented; real native authorization, receipt and upgrade checks passed.
- Task 4 baseline: real compiled runtime accepted newly changed epoch-1 metadata after rotation; browser test linked it after a last-moment epoch change. Native guard distinguishes unchanged retained assets; browser now checks again before linking. Rebuild and targeted native/browser verification passed; complete suite results belong in the remediation evidence.

- Ruling: preserve the MCP package's independent core46/modules57/MCP23 cohort. It does not consume Quick approval contexts, contract ABI encodings did not change, and the clean-bootstrap regression deliberately pins this independent cohort. Only core50/modules62/frontend69 and the mini-app bundle require new producer artifacts. Intermediate local development archives remain ignored, unpublished and immutable.
- Final review correction: preserve the archive export's session advisory lock and autocommitted manifest request before provider I/O, while using that same connection for its short transactions. A new lost-manifest-response test first reproduced a duplicate upload under an overly broad transaction; the final implementation reconciles it without another pin or charge.
- Additional recovery regression: a native claim committed under the original key before recovery/response loss now reconciles through the same verified key family, without changing an already-created DAO member key or creating a second DAO.
- Verification checkpoint: actual native full 48-hour recovery/current Quick approval/deactivation and once-only recovered receipt creation passed. Existing private metadata references remain usable; newly changed stale references fail on a real native process.

- Final package correction: match both module peer dependency and runtime coreRange to core50. Final cohort: core50/modules62/frontend69. Intermediate local development archives were not overwritten or published. Restore the owned module current-runtime fixture to the exact core50 WASM/ABI hashes before its suite; historical fixtures are unchanged.
- Test isolation: the email-recovery fixture reused one globally unique native DAO/member identity across repeated disposable-database runs. Use an independent synthetic DAO ID per run. Keep the uniqueness constraint and production ownership logic unchanged. All 26 recovery tests pass.
- Packaging/install operations must finish before tests consume their package trees. Partial or mismatched cohort runs are retained as failed/aborted evidence; only completed matching-cohort runs count as final verification.
- No SQL migration, contract layout change, new dependency or live operation was required. Final resource results and deployment limits belong in docs/evidence/2026-10-17-review-remediation.md.

- Final verification: core 1,158/197 files, modules 309/48, portal 467/83, PostgreSQL 104/8 and native 21/5 all passed. Strict builds, lint, generated docs and matching archive integrity checks passed. No live rollout occurred.
