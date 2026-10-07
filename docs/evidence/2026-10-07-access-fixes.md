# Access-flow fixes and verification — 2026-10-07

This follow-up implements the eight findings from the focused access review. It is a development correction, not a formal security audit or a production-qualified release. Comparative module research is a proposal only: [full report](2026-10-07-module-research.md).

## Scope and versions

Three sibling checkouts under `/Users/seth/.config/superpowers/worktrees/daclify-access-fixes`, branch `codex/access-flow-fixes`. Core starts at `8f6c9349d780b2791cdd9fca2c0708f88a77a090`, modules at `08781fa6ae2176b49964667f65cf3e21ad59ab62`, frontend at `42fa56771f0504c548b448169c5b6b76c828fc47`. These are the reviewed platform-fee heads, including work inherited from main.

All development packages move from 0.3.0-alpha.1 to **0.4.0-alpha.1**, with exact producer/consumer pins and refreshed local tarball integrity. This version adds paged reads and saved-order fields, so clients must update together. No package is published. The native serialized interface stays at 1: this fix does not change existing DAO/member/module table layouts. PostgreSQL migration `007_signin_attempts.sql` is additive; published migration files are unchanged. Existing account keys are immutable in the HTTP account model; adding account-level rotation later must also freeze or explicitly migrate pending-order creator snapshots.

## Finding closure and acceptance

| Finding | Correction | Evidence |
| --- | --- | --- |
| P1: private drafts and late responses cross DAO contexts | Workspace panels keyed by full chain/runtime/DAO, account, member and privacy. Content/module reads discard old generations, wrong DAO references and unmounted results. Private views/drafts clear on lock or deactivation. File preparation stops after context change/unmount; retrieval checks its context before downloading. | Real Vue component renderer covers delayed content/module responses, private-to-public drafts and delayed file preparation after unmount; existing crypto tests cover vault generation; native-backed private JSON/file browser journeys. |
| P1: concurrent challenge reuse | Email/passkey consumption uses outer atomic unconsumed/unexpired guards. Email guesses have a persistent five-attempt budget. Sign-in issuance and confirmations have caller/global limits with bounded in-memory keys; canonical route paths prevent query strings selecting another limit bucket. Production startup requires an explicit network environment. | PostgreSQL row-lock synchronization with simultaneous email and zero-counter passkey proofs, five-wrong-code rejection and per-IP query-variant limit regression. |
| P1: payable invalid setup | Preflight validates native guardian existence, actual token symbol/precision and canonical commitment bounds before a native payable order. A configured creation asset cannot be changed underneath existing quotes. Paid failures retain immutable state and can be retried. | Preflight RPC tests, compiled-WASM creation-fee asset-change regression, PostgreSQL paid failure/retry and native-backed creation browser preflight. See [incident guide](../operations/paid-creation-incidents.md). |
| P1: unrelated shared-table history denies reads | First parent pages use DAO secondary indexes; continuations use bounded primary pages and filter the DAO. Votes use ballot/member bounds; milestones, installments and execution/control rows use their parent bounds. Hub and scoped content reads support advancing cursors. Disabled installations retain history. | Gateway tests cover shared overflow, foreign rows between pages, member vote bounds, malformed cursors and 1,001 epoch rows. Native/browser flows exercise actual installed-module reads. This is not a 1,001-vote native load test. |
| P2: UI authority differs from contracts | Active membership, vault state, administrator-or-reviewer, self-review exclusion, verified code and exact installed action grants control actions. Financial exits/finalization retain their existing authority. | Component checks for inactive administrators, administrators without reviewer flags and narrowed action grants; native permission tests and contributor/admin browser review journeys. |
| P2: payroll pause copy overpromises | UI and generated guide call it schedule-settlement pause and explicitly allow direct Treasury payment of approved due obligations. Guardian pause is separate. | Existing compiled-WASM direct-payment behavior remains unchanged; payroll/treasury and disabled-module browser journey. |
| P2: admission is not a coherent journey | Strict public join identity in Account; admission moved to Members. Roles/credits and encryption grants remain separate. Managed admission is unavailable here. Contextual sign-in/unlock preserves a validated local destination. Works offers member/document choices and explicit steps. Module tabs refresh when installations change and retain disabled history. Pending upload recovery stays available with locked keys. | Native-backed two-account browser journey now admits through the actual UI, rejects recovery-kit JSON and completes independent review/payment. Return-to-creation/DAO and lost-upload-reload browser regressions. |
| P2: resumed order does not disclose its setup | Owner-only view returns immutable setup, founding public identity and explicit expiry/paid/created state. Payment status never silently fulfills. Explicit paid execution, old order links, stale account/domain response guards and frozen saved-request fields prevent misleading edits. | PostgreSQL original terms, ownership, expiry and paid retry; browser reload review, nonexistent guardian, explicit execution and destination flow. |

Further corrections remove frontend-owned response DTO definitions: core exports canonical service schemas and validates producer responses. Safe allowlisted native assertion codes provide useful recovery instructions without exposing raw internal details. Generated API references include query schemas. Module cards show actual installed grants rather than presenting default grants as current authority, and explain narrowed actions. Status starts with usable capabilities, keeps operator detail expandable and labels unqualified providers. Hub copy no longer claims automatic independent-runtime discovery.

## Verification record

Node 24.21.0; pinned Antelope CDT 4.1.1 and Spring 1.2.2. Actual commands were run from these worktrees with their pinned local SDK artifacts:

| Command/check | Result |
| --- | --- |
| Core `npm run build:contracts`, `npm run codegen` | Passed; all eight core/helper contract artifacts built. Core runtime WASM SHA-256 `886a2057c1765be8c7139ae0eddcdfc645c7bb7c98663fc266615215a70c524a`; source ABI JSON SHA-256 `3a68bd2f500e84f7662487a9e452ef408c60ccef392f33239e5252c4673c4b14`. |
| Core `npm run verify` | Passed lint, typecheck, generated-doc check and **359 tests / 49 files**, including actual compiled-WASM VERT checks. Publication remains refused. |
| Modules `npm run verify` | Passed lint, typecheck, generated-doc check and **60 tests / 8 files**. |
| Frontend `npm run verify` | Passed lint, typecheck and **58 tests / 16 files**. |
| All three `npm run build` | Passed; frontend runs `vue-tsc` and Vite production build. |
| Core `npm run test:integration` with isolated `DATABASE_URL` | **71 tests / 10 files passed**; new `daclify_access_integration_test` at localhost:16432. |
| Frontend `npx playwright test` with API 3110 / UI 5280 | **62 / 62 passed**, desktop Chromium and Pixel 7 mobile Chromium, 3.3 minutes. Includes native-backed synthetic creation, admission, review, settlements, withdrawals, encrypted JSON/files, recovery and accessibility. |
| Sign-in browser journeys after final route-limit correction and API reload | **2 / 2 passed**. The full run preceded this small route-limit correction; its new query-variant behavior was additionally verified by PostgreSQL integration. |
| Works browser journeys after final permission-copy correction | **2 / 2 passed**; contributor/reviewer and native settlement flows on desktop and mobile. |
| Core isolated native `tests/native/dao-presets.test.ts` | **2 / 2 comprehensive native/API scenarios passed again**, 66.41 seconds on the pinned runtime; no full native-suite claim. |
| Final diff/format/source review | Source/diff review, `git diff --check` in all three repositories and changed TypeScript/Vue/JSON source format checks passed. |

Red-before-green evidence includes original private/stale-state reproductions, the email race/budget regression, intentionally removing the passkey outer guard (two successes), shared-read overflow, fee-asset guard, pending workspace refresh, delayed file preparation, and query-variant issuance (21st request incorrectly accepted before correction). Initial test-fixture errors are not counted as bug reproduction. Subsequent passing checks confirm restored fixes.

The first full browser pass attempt was **56 passed / 4 failed**, revealing hidden pending-upload recovery, duplicate accessibility landmarks and disabled-module navigation. All were corrected before the final **62 / 62** result. An earlier native preflight failure came from unnecessarily requiring `max_supply` in a test-token stat row; symbol/precision verification uses the actual supply and issuer instead. No initial failing run is represented as passing evidence.

Logs are retained outside Git at `/tmp/daclify-access-*.log`; local contract/package/browser artifacts are under each worktree's ignored `.artifacts` and `dist`. The [coordinated development manifest](../releases/development-2026-10-07-0.4.0-alpha.1.json) records committed sources, lockfile/artifact hashes and local passes while refusing production qualification/publication. The manifest generator retains its conservative qualification holds; recorded local passes do not automatically remove production/full-suite requirements. Its pinned core commit precedes the documentation-only manifest/ledger commit.

## Isolation and one fixture configuration mistake

The new native chain is `daclify-access-native` on port 20088. API 3110, UI 5280 and the `_test` databases are disposable synthetic fixtures. No production chain deployment, live provider payment or real funds were used. Other branches/worktrees and legacy repositories were not edited.

One API restart mistakenly supplied `PORT`/`DATABASE_URL` instead of the fixture script's `DACLIFY_TEST_*` variables. Its own process briefly used default port 3008 and the existing local `daclify` database on port 15432. It was stopped after checking process ownership and restarted on the intended isolated fixture. Database migration metadata shows **006_creation_orders.sql and 007_signin_attempts.sql** applied at `2026-10-07T00:37:05.673Z`; they add creation-order storage and the attempt column/check. They were not rolled back or concealed. No content reconciliation jobs had a `due_at` in the restart window; there is no observed content-job reschedule, although this is not a before/after snapshot of every row. No rollback/destructive cleanup was attempted. Other running API/native services were not stopped.

## Remaining limits and launch gates

- Managed production signing/recovery and live Pinata, Stripe/card, Google and Telegram qualification remain pending. Mock/local provider tests do not establish them.
- Independent self-service deployment and multi-runtime discovery/routing remain open. The $50 independent setup price plus separately charged blockchain resources is policy, not an enabled checkout. Shared setup is $20; TLOS retains the 20% premium.
- Refund/cancellation has no authoritative paid-order transition yet. A manual refund must not leave a fulfillable paid order; production refund/chargeback handling requires a reviewed coordinated transition, not a spreadsheet convention.
- Paged shared-module continuation can scan other DAOs' primary rows; membership discovery still scans DAOs and paged members. Comments mark these measured-scaling upgrade points. No indexer/cache service was added speculatively. Treasury/evidence projections can still require separate pagination/indexing as scale grows; this change does not promise bounded total memory for every aggregate read.
- Public metadata, membership, votes, balances and transaction traces remain visible for encrypted DAOs. Old keys/plaintext cannot be revoked retroactively.
- Native account ownership/upgrade authority and trusted bootstrap/relayer/card/oracle roles remain disclosed trust boundaries. Internal/social identities do not prove unique humans or independent agent operators.
- No GitHub Actions run, immutable registry publication, production custody qualification, real Telegram client or live Hypha browser audit is claimed. Hypha visuals were inspected from the official documentation image and current source.
- Proposed grants/matching, endorsements/delegates, marketplaces/circles/NFT/bridge features are not implemented or represented as working capabilities.
