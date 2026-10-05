# Daclify V2 remaining work

Reconciled 2026-10-05 against `main` at core `27ba179`, modules `b2d6cba`, and frontend `13784ed`. Those commits match the recorded checkpoints and `origin/main`. This file is an execution backlog. A checkbox in the work-package plan is not evidence, and a passing UI build is not a finished package.

Historical counts in `docs/evidence/execution-ledger.json` are prior-session evidence. They are not rerun results for this checkout. This checkout had no `node_modules` or contract artifacts when reconciliation started. The disposable native container `daclify-v2-native` and PostgreSQL `daclify-v2-postgres` were already running. They were not reset.

## Callback authority

`require_source` previously accepted a direct action when `get_sender()` was empty. On the fixture, `works@active` contains both the account key and `works@eosio.code`, so that key could call `reserve` without executing the works contract.

The current runtime requires `get_sender()==source` for `reserve`, `approveob`, module `cancelob`, `govlock`, and an unexpired `govunlock`. DAO-owner cancellation and permissionless `payob` are unchanged. VERT accounting tests call a test-only `modrelay` contract for the inline path. `modrelay` is not a production module.

Privileged `setmodule` and `modconfig` calls now take a `code_hash`. Any non-empty action or grant list must match `get_code_hash` for that account and must not be zero. Callbacks and member-instruction dispatch check the stored hash again. An empty action list and an empty grant list clear the row without a live hash match. The local fixture must activate Spring feature `GET_CODE_HASH` before this wasm can be set. Existing module rows from the previous ABI do not deserialize.

Verified on this checkout after that change: core unit tests include the pin, replacement, and member-instruction cases; module tests passed against the new runtime wasm; native cleos rejected a bad pin, rejected a direct module key, accepted `works::accept`, and rejected a callback after a wasm replacement. OpenBao, the native HTTP suite, PostgreSQL integration, and browser journeys were not rerun for this change. See the execution ledger for the exact counts.

`package:release` still throws until an immutable verification manifest and the held contract checks exist. Do not remove that guard.

## Package reconciliation

| Package   | Code that exists                                                                                                               | Acceptance still open                                                                                          | Status      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------- |
| WP01      | Toolchain record, baseline, custody investigation, Telos service notes                                                         | Threat model, RAM/action measurements, EVM sandbox evidence, production custody qualification                  | in progress |
| WP02      | Three repos, strict TS, generated ABI/schemas, VERT, integration and browser harnesses, docs generation                        | CI, `any`/assertion lint, compatibility suite, immutable release manifest, requirement register                | in progress |
| WP03      | Shared runtime, Hub registration record, module grants, two-DAO ledger tests, direct-key callback rejection, on-chain code pin | Independent deployment with Hub down, migration gates, Telos feature confirmation                              | in progress |
| WP04      | Internal accounts, separate signing/encryption keys, vault recovery, native link action, local OpenBao probe                   | Production custody, key rotation/revocation, scoped authorization, custody transition without duplicate weight | in progress |
| WP05      | Google and Telegram proof verifiers and unit tests                                                                             | Login/linking routes, session binding, live providers, real Telegram clients                                   | in progress |
| WP06      | Credits, one native stake asset, governance lock counter                                                                       | Active-ballot weight policy beyond the lock, transfer policy freeze, no double-count proof for bridged assets  | in progress |
| WP07      | One native asset, reservations, claims, withdrawal, stake exit                                                                 | External-payment evidence records, resource/rate budgets, broader assets, claim-to-stake                       | in progress |
| WP08      | Decide ballots, vote, finalize, governance lock                                                                                | Executor, committee seats/terms, full quorum/tie/abstention matrix                                             | in progress |
| WP09      | Works propose/accept/submit/review/cancel and core reservation                                                                 | Persistent policy, milestones/disputes/deadlines beyond the current state machine, bonds                       | in progress |
| WP10      | Fixed-term payroll commit and permissionless settlement after removal                                                          | Recurring catch-up policy, bounded keeper batches, manual fallback with the worker stopped                     | in progress |
| WP11      | Versioned documents, CID checks, upload reservations, disk fixture, Pinata adapter faults                                      | Live Pinata, retention, shared-reference cleanup, re-pin, measured limits                                      | in progress |
| WP12      | Epochs, grants, browser encryption, admission flag on enroll                                                                   | Historic/future access choices as a complete product policy, custody transition of content keys                | in progress |
| WP13      | Vue shell, CIQ tokens, handbook, main journeys                                                                                 | Presets, independent deployment, billing/migration screens, Telegram-client accessibility                      | in progress |
| WP14–WP19 | Not started as product behavior. Proof helper types exist for Google/Telegram only.                                            | Entire acceptance criteria                                                                                     | pending     |

No package is complete.

## Implementation order

1. Done in this working tree, not a completed package: reject direct module-key callbacks. Evidence is in the execution ledger.
2. Done in this working tree, not a completed package: pin module code in the runtime. `setmodule` and `modconfig` carry `code_hash`. The local fixture activates `GET_CODE_HASH` before setcode. Existing fixture rows from the previous ABI do not deserialize. Telos mainnet activation of that feature was not checked.
3. Add per-repository CI, meaningful lint, a requirement-to-test register, and a release manifest that still refuses publication until the held checks and pinned artifacts pass. Do not publish.
4. Independent deployment: second runtime, direct connection, Hub registration, and a conformance run with the Hub stopped. Preserve pending ballots, liabilities, and document rows across module removal.
5. Identity journeys that do not need new vendor accounts: key rotation, revocation, and native-wallet linking without a second member or a second vote. Leave production OpenBao operations unqualified until backup, audit, authorization, and cost evidence exist.
6. Wire the existing OIDC and Telegram verifiers into session linking with fixture keys. Live Google and Telegram credentials stay outside the repository. Social login must not unwrap a user-controlled vault.
7. Governance and finance gaps that are specified: Decide quorum/tie/abstention cases, proposal executor bounds, payroll catch-up rules, and DAO-confirmed external payment evidence. Do not invent prices, extra treasury assets, or claim-to-stake.
8. Content lifecycle that can be tested without Pinata: privacy admission, grant/rotation behavior, and explicit retention of uncertain pins. Live upload/retrieval waits for local provider configuration.
9. Operations worker scheduling and notifications on the existing PostgreSQL job table. Billing enforcement only after a measured allowance; checkout provider and prices remain an open business decision.
10. Migration tooling against recorded fixtures, not a live cutover. EVM and other-chain adapters wait on primary-source interface checks and a named customer use case.

## Held or external

- The direct module-key callback check passed once on the local fixture. Do not describe that as a full native-suite pass. If a security classifier blocks a later native run, record the hold and do not retry in a loop.
- No Pinata, Google OAuth, or Telegram bot credentials are in the repository. Do not ask for them in chat.
- No production deployment, authority change, asset movement, registry publication, or legacy cutover.
- OpenBao local Transit success is not production custody.
- Theme browser tests do not cover chain, custody, or payments.
- A mobile Chromium viewport is not a Telegram client.
