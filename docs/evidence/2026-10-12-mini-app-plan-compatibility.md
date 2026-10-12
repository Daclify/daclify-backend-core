# Mini-app plan compatibility with the latest pushed changes

Reviewed 12 October 2026, Atlantic/Canary. Result: the existing programme direction remains compatible after the planning corrections below. This is a source/documentation compatibility review, not implementation or production qualification of the proposed features.

## Reviewed pushed baseline

Fetched `origin` in all four repositories; each local branch matched its remote head with no ahead/behind commits before this review's edits.

| Repository                | Branch/head reviewed | Application/package baseline                        |
| ------------------------- | -------------------- | --------------------------------------------------- |
| `daclify-backend-core`    | `dev`, `9de10a8`     | Application source `7d7a8ec`; core `0.14.0-alpha.3` |
| `daclify-backend-modules` | `dev`, `d4e42dc`     | Modules `0.10.0-alpha.3`, exact core alpha.3 peer   |
| `daclify-frontend`        | `dev`, `093d0ac`     | Frontend `0.14.0-alpha.6`; pinned vendor archives   |
| `www-landing-page`        | `main`, `d5c913d`    | Main-app “soon” and explicit test-app links         |

Inspected core reconnection commits `5490d05`/`7d7a8ec`, frontend continuity `c1756e9`/`093d0ac`, module compatibility `d4e42dc`, their connected source and the [account-continuity delivery record](2026-10-12-account-access-continuity.md). The [machine evidence](2026-10-12-account-access-continuity.json) reports testnet development publication, unchanged native contracts and no account reconnection/chain action by deployment. Those prior results are attributed to that delivery, not claimed as fresh checks here.

During this review, a separate registered-account native reconnection continuation appeared as uncommitted core/frontend changes, including proposed `ApiRoutes.accountReconnectNative` and core alpha.4. They reuse the canonical ownership/reconciliation boundary and require a fresh root proof. These are in-progress work, not the fetched pushed baseline or new qualification evidence. They were preserved outside the review commit; B0 rechecks their eventual published schemas/artifacts before execution. Focused baseline checks were repeated from temporary Git archives with the hash-verified alpha.3 packages, preventing those shared-workspace edits from changing the tested baseline.

Verified the frontend vendor archives against that machine evidence:

| Artifact                                   | SHA-256                                                            | Result |
| ------------------------------------------ | ------------------------------------------------------------------ | ------ |
| `daclify-core-protocol-0.14.0-alpha.3.tgz` | `325bf61036bee8a2102c14e165c4fe84dff7e0571873014edaf46edfe3c3129a` | Match  |
| `daclify-modules-0.10.0-alpha.3.tgz`       | `e4fa36fc6901fdb8724ad8a93792806185f5c81d4f9d72d78f36983d0d7e018d` | Match  |

## Findings and planning corrections

### Account continuity is an implemented prerequisite

The original mini-app plan called it concurrent work. It now has source commits, checked artifacts and testnet evidence. Account/Create/Join use one encrypted kit, distinct internal signing/encryption purposes and explicit restore/reconnect choices. Private-access policy is exposed through `ApiRoutes.privateAccessPolicy`; `api.content` retrieves all paginated content. The revised master/spec make this the existing baseline and require reuse, not a second recovery flow or replacement implementation.

### Reconnection preserves identity without merging arbitrary app histories

Migration 041 defines one-level `merged_into`, immutable retired owners and `account_scope`/`account_owns`. `ownsAccount` centralizes historical ownership checks. The reconnect transaction moves sign-ins, memberships and a sole `connected_app_subjects` mapping to the canonical account without changing its subject/native member; it revokes hosted sessions, login intents, app access/refresh families and broker authorization. Same-client subject collisions, conflicting memberships, custody conflicts and passkey limits reject.

F3/P2/M2/X2 now pin those semantics. A subject change cannot trigger database rebinding or an automatic history merge. Historical payment/upload/archive owners stay unchanged. Hosted ownership, native signing, key possession and app/MCP reauthorization remain separate. Future MCP authorization must join the reconnection revocation transaction; SQL reconnection itself is not native grant revocation.

### Account erasure needs a new schema transition

`validate_account_reconnect()` rejects clearing canonical signing/encryption keys while retired owners reference the account. It rejects updates to retired owners. Deferred wallet-control checks and credential-owner triggers also affect cleanup. The current wallet-recovery integration tests explicitly assert the canonical-key and retired-owner guards.

X2 now requires a new migration after 041 with monotonic `none→pending→erased` state and `erased_at`, narrowly revised guards, blocked new sessions/credentials/reconnection, and immutable historical ownership edges. It must clear unnecessary fields without rewriting signed evidence. Capture the verified owner scope before marking it pending; ordinary `account_scope` no longer authorizes pending/erased actors, so erasure workers use an operation-owned frozen scope. Retain only purpose-justified restricted identifiers until their expiry; physical removal depends on remaining historical foreign keys. No broad trigger disable, cascade, indefinite key blacklist or reanimation from an old backup.

This is a required migration design correction. No such erased-state migration has been implemented or tested by this review.

### Private handover is not currently a native recovery proof

The pushed portal uses `planPrivateAccess`, `privateSuccessors`, `grantPrivateEpoch` and `verifyPrivateEpochs`, batches at most 20 grants, refreshes the current policy/epoch, enforces from-join/custody rules and asks for successor decryption/recovery confirmation on another device. Native `setactive`/`setroles` retain last-administrator/controller protection but do not implement this private-history handover check.

The original plan assumed stronger native readiness without specifying it. X1 now defines a proposed fixed-size, expiring native handover record, ≤25-epoch scan actions, successor acceptance and guards across supported administrator departure/demotion paths. X3 extracts/reuses the existing client handover check instead of creating a second inconsistent flow. A newly committed epoch, changed credential/encryption key or changed policy invalidates a prepared snapshot. From-join history is not widened to manufacture a successor.

Native recorded grants/acceptance cannot prove a ciphertext decrypts or that another device can recover keys. Wrong-key/corrupt-envelope checks stay in the trusted client; recovery readiness remains an explicit human confirmation unless separately qualified. The proposed native guard requires actual compiled/native tests before any claim that direct action paths enforce it.

### New write routes must fit the existing proof transport

The frontend request helper chooses GET/POST; account-control proofs match exact literal paths. The API's fresh-proof hook checks enumerated POST route paths. Planned profile PUT/DELETE routes and a dynamic MCP approval route would not work through that helper as written.

P2 uses POST `/v1/profiles/keys/share` and `/v1/profiles/keys/remove`, with context in the validated body, plus a GET key fetch. M2 approval uses POST `/v1/mcp/pairings/approve` with pairing ID/context/scopes in the body. X2 adds POST `/v1/me/exit`. Each adds its producer-owned `AccountControlPaths` entry and body/origin/audience/session proof tests. No permissive method fallback or unchecked dynamic route normalization.

### Artifact, compatibility and recovery gates move together

Current frontend archives match the delivery hashes. Modules pin an exact core peer and an explicit `CORE_RANGE`, checked by `tests/sdk.test.ts`. Earlier tasks cannot add exports and expect the old installed alpha.3 archives to contain them. New producer archives get new immutable versions/hashes before clients use them; module peer/range/tests and frontend vendor/lock pins move as a verified set. Removing plaintext native profile writes is a breaking capability change under the repository's `0.x` version policy.

`readRecoveryConfiguration` validates reports/evidence against the exact core `VERSION`. The prior testnet delivery initially rejected an older report, then qualified a release-specific synthetic TLS restore/wrap/unwrap. Q3 now explicitly requires a fresh candidate report and preserves the previous environment override for rollback. Single-host testnet evidence and its seven-day expiry do not qualify independent-host production recovery or profile-key erasure/backups.

### Website promotion preserves the current deployment boundary

Q1 retains the current main-app “soon” versus test-app distinction and existing recovery copy. New mini-app/MCP availability links depend on the actually deployed/qualified route and capability. All en/es/pl HTML/Markdown exports still move together. This review published no site or service changes.

## Fresh verification

| Command/review                                                               | Fresh result             |
| ---------------------------------------------------------------------------- | ------------------------ |
| Fetch and branch comparisons, four repositories                              | All matched pushed heads |
| Frontend core/modules vendor SHA-256 versus delivery evidence                | Both matched             |
| Core focused mini-app, connected-app and recovery-config suites              | 5 files, 30 tests passed |
| Frontend private-access planner, provider-session and wallet-recovery suites | 3 files, 16 tests passed |
| Modules SDK compatibility suite                                              | 1 file, 6 tests passed   |

The 52 focused tests also passed from temporary archives of the exact pushed refs above, with the two hash-verified public alpha.3 packages extracted into each snapshot. Temporary snapshots were removed afterward. A final remote fetch found those four pushed refs unchanged. Documentation checks covered all nine design/plan/review files, 37 local links and all 21 implementation-task handoffs; formatting and whitespace checks passed.

Commands:

```bash
# Core
npm test -- tests/community-mini-app.test.ts tests/connected-app-client.test.ts tests/connected-apps-protocol.test.ts tests/connected-app-contract.test.ts tests/recovery-config.test.ts
# Frontend
npm test -- tests/unit/private-access-plan.test.ts tests/unit/provider-session.test.ts tests/unit/wallet-recovery.test.ts
# Modules
npm test -- tests/sdk.test.ts
```

PostgreSQL integration was not rerun: this review environment has no configured `DATABASE_URL`, and `psql`/`pg_isready` are unavailable. No production database was used. Browser, native-runtime, independent-host restore and live provider/harness checks were not rerun for this planning-only correction; their existing evidence and limits remain separate. The 52 passing focused tests check the current baseline, not the proposed erasure/profile/MCP/handover implementation.

The [master plan](../superpowers/plans/2026-10-12-self-service-mini-apps-and-account-exit.md), supporting design and affected task plans were revised inline. All 21 implementation tasks remain pending. No product code, SQL migration, contract, live account, authority, funds or deployment changed in this review.
