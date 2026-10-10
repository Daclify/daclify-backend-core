# Three-repository audit — 2026-10-10

## Summary and scope

Reviewed current `dev` of core, modules and frontend using Ponytail 5.1.0 full and the supplied audit/implementation prompt. Starting commits were core `3aa83e4`, modules `82c3621`, frontend `6300044`; all matched their remotes and were clean. Work stayed on `dev`, with no delegated agents, production deployment, provider configuration changes, asset movement or authority changes.

The boundaries are sound enough to preserve: Antelope C++ owns governance/permissions/accounting; core services own PostgreSQL, sessions, commercial rules and provider integration; modules publish canonical capabilities/ABIs/configuration/archive decoders; Vue owns presentation and local vault/signing/decryption. A passing suite is evidence for its scenarios, not a security certification or production release qualification.

## Flows inspected

| Area | Execution path and evidence |
| --- | --- |
| Identity and access | Login challenge/signature → account/session transaction; CSRF and one-use action-bound proofs; native current permission thresholds; EVM proof/binding checks; social pairing/removal; vault/domain guards. Concurrent login, expiry, recovery, wallet and provider linking are covered by PostgreSQL/unit tests. The first-registration binding defect was initially decision-gated; its approved follow-up is recorded below. |
| DAO/module governance | Hub registration → runtime DAO/member identity → pinned module/actions → `execctx` → treasury obligations. Read core dispatch/authority helpers and module actor, document reference, payroll and governance logic. Actual native permission/module tests exercise owner/active handover, isolation and the five first-party modules. |
| Money and resources | Connect merchant/admin/broker checks → immutable order snapshots → Stripe idempotency/reconciliation/refund reservation; hosting/storage calendar periods and invoice evidence; RAM quote/consent and workers. Integer amounts, database uniqueness/locks and once-only transitions remain authoritative. No commercial rules were changed. |
| Documents and history | Client encryption/domain guards → bounded document/upload validation → SQL reservations/leases → Pinata → on-chain references; Archive verification and retained schemas; retention reference/lease locks and paid grace windows. Recovery decoders and applied migrations are required data-compatibility inputs. |
| UI | Workspace/account refresh generations, private-document/vault invalidation, public member/profile display, wallet pairing, help history/plain-text rendering, homepage/Status/docs and failure navigation. Browser tests include mobile, accessibility, unavailable API and malicious model text. |
| Tooling/deployment | Strict compiler/lint/schema ownership; source/artifact release gates; manual-only CI; public Netlify environment settings; private API/deploy profiles; vendored dependency integrity and a fresh standalone install/build. |

## Verified findings and repairs

| ID | Severity | Location | Problem/evidence | Repair and risk |
| --- | --- | --- | --- | --- |
| A1 | Low | `services/api/src/jobs.ts` / `startPollingWorker` | `work()` ran outside `try`; a synchronous throw produced an unhandled rejection and no scheduled retry. Reproduced before repair. Current production callbacks return async promises; this was a reusable-helper defect, not proof that current workers had failed. | Move invocation inside the existing catch boundary. Regression covers retry, redacted logging and draining in-flight work at stop. No scheduling-policy change. |
| A2 | Low | `services/api/src/http.ts` / `readBoundedResponse` | Content-length rejection left the response body unread/uncancelled. Tests demonstrated no cancellation for excessive or malformed declared length. | Cancel before rejecting. Preserve actual streamed-byte enforcement and exact-limit behavior. Provider cancellation failure cannot replace the original error. |
| A3 | Medium | modules `sdk/connected-payments.ts` | `response.text()` buffered everything before a character-count limit. A streamed Unicode response consumed both oversized chunks. JSON parser errors could reflect provider text; schema errors could be misclassified as bad client input by core. | Stream a maximum of 64 KiB of bytes, cancel rejected/error bodies, preserve split UTF-8 sequences and normalize malformed JSON/schema output to `PAYMENT_OPERATOR_RESPONSE`. Valid request/response shapes and DAO/order isolation are unchanged. A response whose bytes exceed the existing intended boundary is now rejected earlier. |
| A4 | Medium | `native-chain.ts`, `auth/intent.ts`, `auth/native-routes.ts`; `rpc.ts` | Service-owned WharfKit clients supplied no abort deadline. A local server accepting requests without replying reproduced the stall. Transport errors could also become `CHAIN_ACTION_REJECTED`. | Reuse one narrow client factory with a 10-second deadline and rejected redirects; transport failure remains redacted `CHAIN_UNAVAILABLE` (503), distinct from contract rejection. Deadline failure does not establish that a broadcast was never executed; reconcile before retry. CLI/test clients and aggregate operation deadlines are separate. |
| A5 | Low | `services/api/src/server.ts` / error handler | Unexpected exceptions returned a safe 500 but produced no diagnostic with logging disabled. Regression reproduced the missing log. | Log only fixed `API_REQUEST_FAILED` and the registered route. No exception text, headers, query strings, bodies or credentials are logged. Expected validation/auth failures are unchanged. |
| A6 | Medium | three `.github/workflows/verify.yml` files | Frontend manual verification unnecessarily cloned/rebuilt private backends, replacing its pinned vendored dependencies. Backend sibling clones silently used default branches while the target could be `dev`. | Frontend installs committed archives with `npm ci --ignore-scripts`; remove obsolete token/Docker/bootstrap steps. Backends use the same named branch/tag and fail if missing. All triggers remain manual. Hosted runners themselves were not invoked. |
| A7 | Low | frontend `src/main.ts` | Unknown URLs matched no route and left an empty workspace. Browser regression failed before repair. | Lazy recovery page with existing components/styles and Home/Hub links. Desktop/mobile accessibility and overflow checks pass. Existing named routes and filtered Hub bookmarks remain intact. |

## Refactoring and cleanup

The RPC factory consolidates the three actual service call sites without creating a transport framework or changing public schemas. Remove the unused frontend module alpha.6 archive after all references moved to alpha.7. Preserve historical Archive decoders, migrations and upgrade fixtures; they are recovery data, not dead code. No dependency was replaced merely because an advisory existed.

Existing formatter failures in two test files were repaired without changing semantics. Machine-written JSON evidence is now outside Prettier, like generated code and lockfiles, so formatting does not rewrite original evidence bytes; its schema/integrity tests remain enabled.

Module SDK/help and frontend are `0.9.0-alpha.7`; the unchanged core protocol is `0.9.0-alpha.6`, and module contracts remain `0.9.0-alpha.5`. Rebuilt development archives and consumer lockfiles are integrity-pinned. No contract redeployment is required. Publication remains refused until source-bound release qualification passes.

## Verification

| Command/check actually executed | Result |
| --- | --- |
| `npm run verify` — core | 111 files / 658 unit tests; lint, TypeScript and generated docs checks passed. Release publication refusal is the expected qualification gate. |
| `npm run verify` — modules | 27 files / 161 unit/VERT tests; lint, TypeScript and generated docs checks passed. Actual unchanged compiled WASM/ABI fixtures used. |
| `npm run verify` — frontend | 33 files / 163 unit tests and Vue template/type checks passed. |
| `npm run format:check`, `npm run build` — all three | Passed. Frontend still reports its lazy Docs chunk at roughly 508 KB minified / 73 KB gzip. No warning threshold was increased. |
| `npm run test:integration` with owned loopback PostgreSQL 17 | 27 files / 195 tests passed, including migration, authorization, money/retry, worker, storage and Archive flows. Database: `daclify_audit_test` on port 5459. |
| `npm run test:providers` with owned local OpenBao 2.7.1 and Mailpit | 2 files / 6 tests passed: real nonexportable R1 signing/wrapping and SMTP delivery/TLS-downgrade rejection. The initial no-fixture invocation correctly failed rather than skipping; rerun passed with configured disposable fixtures. |
| `npm run test:native:modules` | 2 files / 22 tests passed on a fresh owned Spring 1.2.2 chain at loopback 20739. Snapshot used unchanged compiled contracts/SDK hashes; only fixture-name validators were rebound to `daclify-audit-native` so existing fixture containers/bundles remained untouched. This covered permission/module success paths; the later transport-failure classification has its own HTTP/unit regressions. |
| Playwright: `not-found`, `status-tabs`, `homepage`, `docs-assistant` | 20 desktop/mobile checks passed. Inspected recovery screenshots at both sizes. Assistant responses were HTTP fixtures, not new paid model calls. |
| Fresh frontend `npm ci --ignore-scripts`, `npm run verify`, testnet `npm run build` | Passed outside the workspace with no backend checkout, private env or registry token. Core alpha.6 / module alpha.7 archives and peer/integrity checks passed. Testnet origin was a public build value; building does not qualify endpoint availability. |
| `npm audit --json` | Frontend: zero reported advisories. Core/modules: two underlying VERT-development advisories propagated to four npm nodes (two high/two low). Core `npm audit --omit=dev`: zero reported advisories. |
| Source-secret pattern scan / environment tracking / diff review | No matching long credential literals in scanned non-test current tracked source; only example env files tracked. This was a targeted current-source scan, not a complete historical secret audit. `git diff --check` passed. |

## Remaining issues

- VERT's development tree retains unpatched `lodash.set` prototype-pollution and `elliptic` cryptographic-implementation advisories. See [GitHub lodash.set advisory](https://github.com/advisories/GHSA-p6mc-m468-83gw) and [elliptic advisory](https://github.com/advisories/GHSA-848j-6mx2-7j84). Do not feed hostile downloaded fixtures to this trusted local test harness. No safe patch was advertised by npm; replacing/forking the emulator needs separate compatibility work.
- The large handbook/reference chunk is lazy and approximately 73 KB gzip; there is no measured user-performance regression justifying a wholesale documentation split. No 40,000-member load benchmark or full supported-release native migration/recovery matrix was run in this audit.
- RPC deadlines bound each service SDK fetch, not total multi-page operations or all possible RPC response bytes. A universal response cap needs qualification against valid large table/ABI payloads; no guessed limit was introduced.
- Live Stripe/Pinata, real social/wallet clients, public callbacks, production OpenBao durability, destructive retention and immutable production release qualification remain separate gates. No private bot messages, public group replies, real charges or production pruning were performed.

## Impact & Decision — first-login identity binding

**Severity:** Medium. **Location:** `protocol/api.ts`, `services/api/src/auth.ts`, auth challenge/session handlers and frontend vault login.

**Discovery/evidence:** The signed v2 login message includes the signing key but not the submitted encryption key. An isolated SQL probe signed a challenge once, authenticated with a substituted valid P-256 public key, then retried with the intended key. Result: `signedMessageBindsEncryptionKey=false`, `substitutionAccepted=true`, intended-key retry `KEY_CHANGE_REQUIRED`.

**Why it matters:** Someone who captures an unused valid login proof can substitute the first persisted encryption identity and deny the original account's subsequent login. This requires proof capture; it is not an unauthenticated key-change primitive. Existing-account key changes remain rejected. The probe changed no public-chain keys and demonstrated no private-document decryption or treasury access.

**Affected areas:** Canonical challenge input/signed-message schemas, challenge persistence/validation, backend registration/session flow, frontend vault login and all challenge fixtures/consumers. Existing accounts, encryption keys and on-chain memberships must be preserved.

**Option A — recommended:** Bind the encryption public key (or canonical hash) into a versioned signed challenge, with coordinated protocol/API/frontend updates, downgrade/replay/substitution tests and a documented rollout. Strong identity binding, but older clients need updating and compatibility must be deliberately managed.

**Option B:** Preserve the current protocol and document proof-capture assumptions. Avoids rollout work but leaves a verified registration-integrity weakness. Not recommended before production.

The supplied audit prompt, section 15, requires a decision before breaking a public API or changing authentication behavior. Approval was requested asynchronously; no answer was received during the safe-work phase. The user subsequently approved Option A. The coordinated v3 fix, preserved-state tests and rollout instructions are recorded in [login-key-binding evidence](2026-10-10-login-key-binding.md) and the [operator runbook](../operations/login-v3.md). The verification/version table above remains the original audit checkpoint.

## Recommended next work

The approved binding follow-up is implemented separately, with no database migration or contract redeployment. Continue existing live-provider and source-bound release qualification before any production/destructive deployment. Evaluate emulator replacement and larger-dataset performance using their own reproducible compatibility/load evidence.
