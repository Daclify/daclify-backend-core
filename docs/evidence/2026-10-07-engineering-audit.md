# Engineering audit and Ponytail refactor

Scope: the active backend core, backend modules, frontend and landing page. The six legacy repositories and third-party research clones are preserved as historical inputs. Baselines pushed to `main`: core `7763454`, modules `218435f`, frontend `1d32add`; landing `1ca48d6` already matched its remote. Audit changes are isolated on `codex/engineering-audit`.

## Discovery and safety net

Read repository instructions, master plan, architecture, release/test policy, manifests, compiler/test/build configuration, CI, migrations, source-owned API schemas, ABI-generated SDKs and operational evidence. Trace login/pair/removal, browser vault and wallet dispatch, deployment/creation billing, content upload/reconciliation, directory branding, grant execution, admission and elections. Core owns authoritative API/DB/session rules; Antelope C++ owns authorization, DAO isolation and money. Frontend consumes generated producer artifacts. Landing is a static three-language generator with no account/backend state.

Fresh baseline verification: core `npm run verify` (57 files / 383 tests), modules (13 / 82), frontend (20 / 78), all successful. Production publication remains refused. No live deployment or asset transfer is authorized by this audit.

## Findings and ordered implementation plan

| Priority | Evidence and impact | Narrow fix and verification |
| --- | --- | --- |
| Medium | Sign-in, native and EVM browser attempt cookies use `SameSite=Strict` under HTTPS, while the documented frontend supports APIs on other sites. Browser-bound email/passkey/wallet ceremonies fail when the attempt cookie is omitted. Session and Telegram OIDC cookies already support this topology. | Match secure session cookies (`None; Secure; HttpOnly`), retain local Strict, exact Origin/CSRF/proof/browser binding. Regression-test all attempt routes in secure and local modes, including rejected origins and absent cookies. [Browser semantics](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value). |
| Medium | EVM authorization cache accepts late binding responses without checking wallet/account/network or newer refreshes. Old active data can re-enable a misleading signing choice; authoritative relay/contract checks still reject invalid authorization. | Scope cached readiness to the account/API/member and ignore stale wallet/context/request responses. Deferred-response regressions. |
| Medium | Branding save shares a revision counter with content reads. A refresh while a signed save is pending invalidates its `finally`, leaving the submit button busy forever. The handler also lacks a duplicate-submit guard. | Keep one pending save, always release its own busy state, continue suppressing old-domain errors/events. Real Vue regression using the existing in-memory renderer. |
| Low | Fastify parser/size errors fall through the generic internal-error handler, returning 500 for malformed or oversized client bodies. | Preserve redacted responses with correct 400/413/415 classifications; HTTP injection regressions. |
| Low | Provider linking duplicates transaction, SQL uniqueness classification, account mapping and session insertion already owned by `auth/account-session.ts`. | Reuse existing transaction/session functions while preserving credential row locks and consumed replay tombstones; run real PostgreSQL provider/removal concurrency tests. |
| Low | `store.consumeChallenge`, `AuthChallenge` and frontend `signingAvailable` have no application callers. Store tests exercise the obsolete consume helper rather than the real authentication transaction. | Delete verified dead paths; move concurrent and expired challenge tests onto real signed `authenticate` calls. Do not delete migrations or supported compatibility routes. |
| Low | Modules README still says committee seats/terms are unchosen despite the implemented representative elections. | Correct existing guidance to bounded representative terms without administrative/spending powers. |
| Medium | A pending workspace `me` read can restore the old account after sign-out; a pending API read can return data from the previously selected endpoint. | Track account revisions through workspace refresh and pin/check the API context at each request boundary. Deferred-response tests reproduced both failures before fixes. |
| Medium | Provider session acceptance compares the incoming account with a mutable saved vault record instead of the unlocked key. Removing/replacing that record can leave a different account's keys unlocked. | Compare the incoming signing identity directly with the actual unlocked key. Regressions cover both removed and replaced records. |
| Medium | OpenBao requests follow redirects by default with their custom credential header. Misrouting a custody request can forward it outside the intended service. | Reject redirects in the shared provider request. A real loopback 307 regression reproduced forwarding before the fix; the same test and actual OpenBao provider suite pass afterward. |
| Medium | The default browser glob mixes paid setup with native evidence from a different fixture chain. It produces missing-record failures and misleading qualification attempts. | Explicit paid (68 cases) and research (8 cases) selections with fixture/API chain preflight. Default browser command is labelled paid; both phases are required for qualification. |
| Low | The in-memory component harness shares Vite's dependency cache with a live development server. Its different compiler configuration can invalidate browser dependencies during another check. | Give the harness its own ignored cache directory. Run the same actual component checks without touching the development server's cache. |
| Low | CI uses floating action tags, implicit token permissions, persisted checkout credentials and no job deadline; it does not build the verified repository. All three actual runs stop because the sibling token is unset. | Pin existing v4 action commits verified against their upstream repositories, require read-only contents, disable credential persistence, set the job deadline, pin npm and check formatting/build. The missing narrowly scoped sibling credential remains an external prerequisite. |
| Low | Development guidance incorrectly describes three migrations and only the original three modules. | Document all fourteen immutable migrations and all five supported deployments. |

The large chain gateway is a cohesive RPC/ABI boundary, and module panels already delegate distinct workflows to focused components. Neither was split merely to change line counts. No new runtime dependencies, alternate authorization stack, schema migration, public SDK/ABI change or C++ contract change was introduced. Supported legacy readers and routes, historical release manifests and applied migrations remain intact.

## Verification and remaining limits

Safe fixes above are implemented. Verification performed in the owned sibling worktrees:

| Checks actually run | Result |
| --- | --- |
| Core `npm run verify`, build, formatting, generated docs | 57 files / 384 tests passed; TypeScript/lint/build/format/docs passed; publication refused. |
| Modules `npm run verify`, build, formatting | 13 files / 82 compiled-WASM/schema tests passed; typecheck/build/format/docs passed. |
| Frontend `npm run verify`, build, formatting | 20 files / 84 tests passed, including real in-memory Vue regressions; template/type/build/format checks passed. |
| Actual PostgreSQL `npm run test:integration` | 11 files / 84 cases passed, including migration upgrade, credential removal, replay, expiry and real concurrent authentication. |
| Actual local OpenBao and Mailpit `npm run test:providers` | 2 files / 6 cases passed. Dev fixtures qualify neither production custody nor live mail delivery. |
| Native paired-wallet regression | 1 file / 2 cases passed on owned Spring; actual proof/link/login/key rotation keeps stable account and membership. |
| Browser paid phase | 68 desktop/mobile cases passed on its matching paid chain. |
| Browser native-evidence phase | 8 desktop/mobile cases passed on the research chain; real grant/admission/election records and complete spending exports checked. |
| Landing typecheck/build/export/format/tests/browser | 43 Node checks and 46 desktop/mobile browser cases passed; source/export unchanged. |
| Dependency advisories | Zero known production dependency advisories in all three application lockfiles at audit time. |
| Workflow files / diff | YAML parsed successfully, current v4 action hashes checked against upstream repositories, all final diffs checked for whitespace/type escape hatches and unintended contract/schema changes. |

The initial raw browser diagnostic had 66 passes / 10 failures: 8 from mixing chain fixtures and 2 mobile cases during a development reload. Paid selection then passed all 68; research selection passed all 8. The component harness now has an isolated cache, and wrong-phase preflight was exercised and rejected before cases ran. The final actual-key check adds two passing provider-session regressions; the 20 affected desktop/mobile account/recovery browser cases passed again after that fix. These reruns are not counted as additional unique browser cases. No known failed product test is being treated as a pass.

### Remaining operational limits

All three pushed baseline CI runs stop before testing because `DACLIFY_CHECKOUT_TOKEN` is unset: [core](https://github.com/Daclify/daclify-backend-core/actions/runs/37620024830), [modules](https://github.com/Daclify/daclify-backend-modules/actions/runs/37620031514), [frontend](https://github.com/Daclify/daclify-frontend/actions/runs/37620035862). Workflow hardening cannot supply this external credential. Configure a fine-grained Contents-read credential restricted to these private repositories and rerun CI; local checks do not substitute for a hosted green run.

Live provider credentials, supported Anchor/EOA clients, third-party-cookie browser restrictions, durable production custody isolation/recovery, selected production permission/resource checks and immutable package publication remain unqualified. Contracts/SDKs/schemas/applied migrations are unchanged in this audit; existing compiled-WASM suites ran, and the affected native paired-wallet cases ran, rather than claiming a fresh run of every historical native case. Public ingress abuse limits, trusted client-IP handling and challenge/audit retention must be established for the actual production topology before public exposure; existing process-local limiters are not a distributed abuse-control service. The largest frontend chunk remains about 515 kB (151 kB gzip); profiling real network/load is the next step before changing chunking or adding infrastructure.

No product policy, destructive migration or production deployment decision was made. The new development review snapshot pins the audited commits and preserves the original historical manifest; both remain explicitly unqualified. No passing local suite establishes production readiness.
