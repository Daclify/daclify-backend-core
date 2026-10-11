# Current repository audit implementation plan

> Use Superpowers executing-plans inline. The workspace forbids delegation. Keep the execution record under `/data/daclify-runtime/audit-all-repos-20261011` and the final evidence in `docs/evidence/2026-10-11-autonomous-repository-audit.json`.

**Goal:** Audit the four current repositories, reproduce important defects, make bounded repairs and verify their consumers.

**Architecture:** Core owns database/authentication/worker and authoritative contract rules; modules publish bounded contract/archive/payment interfaces; frontend consumes pinned public artifacts and owns wallet state; the landing page produces static multilingual content. Preserve those boundaries.

**Tech Stack:** Existing PostgreSQL, TypeScript, Antelope C++, Vue, WharfKit, Vitest, Node tests and Playwright. No new dependencies.

**Spec:** The user's attached Universal Autonomous Engineering Agent instructions, plus the repository engineering rules. The user clarified that the scope is four current repositories. Archived repositories are excluded.

## Global constraints

- Audit core, modules and frontend on `dev`, and `www-landing-page` on `main`.
- Preserve unrelated work, persistent schemas, keys, authorization policies, historical fixtures and public interfaces.
- Commit/push within the established repository workflow. This audit does not authorize new deployment, asset movement or account authority changes.
- Use separate inline investigation and adversarial review passes; do not claim independent agents.
- Capture baseline checks, failing reproductions, final checks and unreviewed areas. Do not claim exhaustive proof of correctness.

## Review focus

- Delayed wallet callbacks must not undo disconnect or replace a newer connection.
- Changed account, network, RPC or API origin must invalidate pending connection intent.
- Database cleanup must preserve the original operation error and discard a client when rollback fails.
- Archive proofs, payments, contract scopes and pinned consumers must retain their existing boundaries.
- Site build/export, accessibility and navigation must continue to work in all supported languages.

### Task 1: Baseline and risk review

**Files:** Repository instructions, manifests, high-risk source paths and existing tests; runtime inventory/check logs.

- [x] Record the four source commits and clean/dirty status; inspect recent audit evidence and architecture.
- [x] Run core/modules/frontend `npm run verify`; landing `npm run typecheck`, `npm test`, `npm run check:export` and `npm run test:e2e`.
- [x] Inspect production dependencies and trace authentication, resource spending, archive verification, workers, contracts and static export boundaries. Separate evidence-backed defects from hypotheses.

### Task 2: Pending native-wallet connection

**Files:** `daclify-frontend/src/auth/telos-zero.ts`; new `daclify-frontend/tests/unit/native-connection.test.ts`.

**Interface:** Preserve `connectNative(): Promise<Session>` and `disconnectNative(): Promise<void>`. A cancelled or stale connection rejects with `WALLET_CONTEXT_CHANGED` and cannot assign `nativeWallet`.

- [x] Reproduce a pending login completing after disconnect, competing connections resolving out of order, and account/network/API-origin changes during approval.
- [x] Use a connection revision and a captured workspace/API scope, checking after asynchronous boundaries. Keep current-chain/active-permission validation.
- [x] Run the new tests with native signing/recovery regressions, then the frontend verification/build and affected browser journeys.

### Task 3: Shared transaction failure cleanup

**Files:** `daclify-backend-core/services/api/src/auth/account-session.ts`; new `daclify-backend-core/tests/account-transaction.test.ts`.

**Interface:** Preserve `withTransaction<T>(pool, callback): Promise<T>`, including its `LAST_CONTROL_CREDENTIAL` mapping.

- [x] Reproduce an operation failure followed by failed rollback hiding the original error. Cover successful commit, ordinary rollback, failed commit and the credential-constraint mapping.
- [x] Preserve the original failure, mark rollback failure for client destruction and release exactly once.
- [x] Run targeted tests, core verification and owned database authentication/recovery integration checks where available.

### Task 4: Review and delivery

- [x] Review the complete diff against failures, permissions, persisted data and downstream public artifacts. Implement any material correction with a failing test first.
- [x] Record severity, evidence, exact commands/results, safe decisions, remaining limitations and paths examined in the final JSON evidence.
- [x] Check changed-file formatting, commit only audit files and push the authorized branches. Leave live services and assets unchanged.
