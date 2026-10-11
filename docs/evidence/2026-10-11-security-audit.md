# Security audit: core, modules and frontend

Date: 2026-10-11. Scope: current `dev` source in `daclify-backend-core`, `daclify-backend-modules` and `daclify-frontend`. Mode: source review, local adversarial reproduction and safe remediation. Ponytail Full and the security audit workflow were applied inline, as the workspace requires. The adversarial review was a separate pass by the same implementer, not an independent specialist review.

## Executive summary

Four confirmed **Medium** availability/resource-abuse vulnerabilities were reproduced and repaired in the core API. Existing limits did not cover connected-app sponsored relays, public document downloads, direct authentication, or document uploads/reconciliation. Valid authorization and storage quotas did not substitute for admission control on those operations.

No Critical or High application vulnerability was confirmed in the reviewed boundaries. No account takeover, plaintext disclosure, unauthorized treasury movement or contract authorization bypass was demonstrated. This is a statement about this review's evidence, not a guarantee that those classes are absent.

Core and modules retain development-only dependency advisories through `@proton/vert`; production dependency audits and the frontend dependency audit reported zero advisories. The fixes are development changes and have **not** been deployed. Provider, production infrastructure and release qualification remain separate work.

## Source and execution scope

| Repository | Initial revision | Package |
| --- | --- | --- |
| Core | `c61e3a5b0f4420a587c89c1e43c990a5f642649b` | `0.13.0-alpha.6` |
| Modules | `6962c884cf57a00546edeaf5d1361f4438d02736` | `0.9.0-alpha.22` |
| Frontend | `7a4a198e11cb440000d174cc08780147cfda6cdd` | `0.13.0-alpha.8` |

An unrelated IPFS documentation change landed in core during the audit; the remediation parent is `53f20285f5790e24c644b4c7b852f51a2ab30813`. It was preserved. Modules and frontend required no source changes for the confirmed findings.

The review followed browser → API → database/provider → native contract boundaries, including root/provider/passkey/wallet authentication, quick signup, assisted recovery and opt-out, connected-app delegation, content/archive/storage, Stripe billing/refunds, native permissions, treasury obligations, governance/module execution, browser key handling, workflows and deployment templates. It was a targeted security review of those boundaries, not an exhaustive line-by-line review of every file or historical release.

Tests used a new disposable loopback PostgreSQL database with synthetic data and an ephemeral role. Restore tests also created and removed owned databases. Native checks used pinned Spring 1.2.2 processes with disposable genesis keys and random loopback ports. No existing/public chain was selected, no real payment/provider operation was performed, and no deployment or live authority change was made. Current and historical source secret scans recorded only paths and classifications, never secret values.

## Attack surface and threat model

Assets include member signing/encryption keys, account and recovery credentials, DAO-private plaintext, treasury liabilities, paid gateway capacity, sponsored chain CPU, retained archive evidence and operator/provider secrets.

| Boundary | Attacker assumptions and scenarios | Enforcement reviewed |
| --- | --- | --- |
| Browser → authentication API | Anonymous caller; replayed proof; forged origin/forwarding headers; provider login for the wrong identity | Typed input, proof verification, challenge context, session/credential ownership, expiry, one-use proofs and CSRF |
| Account → DAO/app | Valid low-privilege member; wrong DAO/app, stale grant, refreshed token, revoked member | Live membership, scoped permissions, issuer/origin/PKCE, app revision and credential epoch, canonical signed payload |
| Recovery → private keys | Stolen login method; reused service grant; opt-out/claim race; incompatible private-DAO policy | Account locks, method/session binding, original public-key commitments, history and admission policy checks |
| API → paid resources | Anonymous downloader or authenticated abusive member; repeated bytes and new request IDs | Shared admission budgets, funded provider allowance, unique-byte storage accounting and job ownership |
| Service/module → contracts/money | Forged module sender/code, cross-DAO operation, duplicate settlement, insufficient reserve | Runtime-only execution context, pinned code/grants, consent, integer accounting, backed obligations and atomic settlement |
| Provider/CI/operator → system | Malformed remote response, malicious callback, leaked credential, untrusted dependency input | Fixed/validated endpoints, bounded responses, signed webhooks, pinned artifacts/actions, redacted errors and private credential files |

Operator/root authority and a compromised user's browser remain trusted capabilities. CORS is not authentication; the authoritative checks are session/proof/contract controls. Provider mocks qualify local handling, not the provider's actual behavior.

## Confirmed vulnerabilities and fixes

All four findings have high confidence from failing pre-fix HTTP regressions and passing post-fix tests. Severity is Medium because the demonstrated impact is exhaustion/denial of shared resources; authorization and financial backing controls still apply.

### SEC-01 — Connected-app relay bypassed sponsored-write admission

- **Location:** `services/api/src/connected-apps/routes.ts:197`; registration in `services/api/src/server.ts`. CWE-770.
- **Root cause:** Portal writes used the account-wide `spend()` admission function, but `/v1/connected-apps/relay` did not. An authorized member/app grant could bypass the normal sponsored CPU budget.
- **Evidence:** A real database-backed app authorization and canonical signed Activity payload were accepted. After that request and 59 portal writes exhausted the account's 60/minute budget, a freshly refreshed app token still received HTTP 200 before the fix; HTTP 429 was expected. Chain submission was simulated in this HTTP reproduction; separate native connected-app tests exercised real signatures and contract permissions.
- **Impact:** A valid scoped app/member could consume sponsored chain resources outside the shared limit. The finding does not grant elevated app actions or authorize treasury theft.
- **Remediation:** Pass the existing `spend(accountId)` function into connected-app routes and call it before the relay database/submission section. Both entry paths and refreshed tokens now share **60 writes/minute/account and 600/minute/process**.
- **Regression:** `tests/integration/connected-apps.test.ts:514` proves the shared budget across app and portal writes, refresh-token issuance and subsequent requests. **Fixed in source.**

### SEC-02 — Public document reads bypassed gateway-download admission

- **Location:** `services/api/src/server.ts:725` and `:985`. CWE-770.
- **Root cause:** Public branding downloads had admission control; public document ciphertext downloads did not, despite using the funded provider gateway.
- **Evidence:** One IP made 100 successful document reads that reserved actual fixture gateway allowance. The next request returned HTTP 200 before the fix. After the fix it returns HTTP 429 without consuming an additional allowance request; changing untrusted `X-Forwarded-For` does not evade admission.
- **Impact:** An anonymous caller could consume remaining paid gateway capacity and deny legitimate content retrieval. Existing funded allowance still bounds total expenditure. Public access to encrypted bytes is intentional; no plaintext leak was demonstrated.
- **Remediation:** Share the existing branding budget with document retrieval, before chain/provider reads: **100 downloads/minute/IP and 4,000/minute/process**. Configured shared proxies retain the existing aggregate-capacity policy.
- **Regression:** `tests/integration/public-download-limits.test.ts:27` checks stored-byte delivery, allowance accounting, document/branding budget sharing, another IP, forged headers and window expiry. The external provider is a fixture. **Fixed in source.**

### SEC-03 — Direct authentication routes bypassed sign-in verification admission

- **Location:** `services/api/src/auth/sign-in-routes.ts:65`. CWE-770; authentication resource-abuse exposure.
- **Root cause:** The hook only covered POST routes beginning `/v1/sign-in/`. Canonical `/v1/auth/login` and `/v1/auth/providers/login` were outside it.
- **Evidence:** Repeated well-formed invalid vault challenges and Telegram HMAC proofs continued to receive HTTP 401 after 60 attempts; the expected admission rejection was HTTP 429. Cryptographic authentication was not mocked into success.
- **Impact:** Anonymous callers could repeat database/proof processing outside the configured verification budget. No proof bypass or account takeover was demonstrated.
- **Remediation:** Include the two canonical authentication routes in the existing hook. They share **60 confirmations/10 minutes/IP and 6,000/10 minutes/process** with other sign-in confirmations.
- **Regression:** Two parameterized cases in `tests/integration/auth-challenge-limits.test.ts:34` cover both direct routes, cross-route sharing, forged forwarding headers and expiry. Existing valid authentication/provider flows pass in the full integration suite. **Fixed in source.**

### SEC-04 — Repeated-byte uploads could allocate work outside asset-write admission

- **Location:** `services/api/src/server.ts:964` and `:978`. CWE-770.
- **Root cause:** Storage quotas account for unique stored bytes. Reusing an already charged object with new request UUIDs can allocate upload/job records without increasing unique-byte usage. Upload and reconciliation routes omitted the account-wide asset-write limiter already used by branding and storage recovery.
- **Evidence:** Twenty identical-byte uploads with distinct request IDs succeeded; the 21st also returned HTTP 200 before the fix. The repaired route returns HTTP 429 and keeps upload/reconciliation-job counts at 20. Reconciliation is also rejected once that shared budget is exhausted; status GET remains available.
- **Impact:** A valid member could amplify database/worker/provider work within a byte quota. Existing object ownership and content commitments do not address operation count.
- **Remediation:** Apply the existing **20 writes/minute/account and 2,000/minute/process** asset-write budget after session/CSRF verification and before upload or reconciliation work. Storage recovery and branding retain that same budget.
- **Regression:** `tests/integration/content.test.ts:296`, plus the complete content/integration suite. **Fixed in source.**

## Unresolved dependency finding

### SEC-05 — Advisories in development-only contract emulator dependencies

**Contextual risk: Low; confidence: high for installed advisory presence, unproven application exploitability.** Core and modules pin `@proton/vert@0.3.24` as a development dependency. Each full `npm audit --json` reported four package entries arising from two underlying advisories, not four independent application vulnerabilities:

- `lodash.set@4.3.2`: upstream High prototype-pollution advisory, CWE-1321. [GitHub advisory](https://github.com/advisories/GHSA-p6mc-m468-83gw).
- `elliptic@6.6.1`: upstream Low risky cryptographic implementation advisory, CWE-1240. [GitHub advisory](https://github.com/advisories/GHSA-848j-6mx2-7j84).

The other flagged entries are `@greymass/eosio` and the enclosing emulator. Production `--omit=dev` audits reported zero advisories in core and modules, and the full frontend audit reported zero. Application service/SDK source does not import this emulator. This supports a development/test-tool exposure assessment; it does not prove that malicious test inputs cannot reach an affected function.

**Unresolved.** npm reported no automatic compatible fix. Do not apply a blind dependency override or remove real-WASM security coverage to hide scanner output. Evaluate an emulator update/replacement against the contract suites, keep CI permissions minimal, and avoid running attacker-supplied contract fixtures alongside sensitive credentials. Upstream severity and development-context risk are recorded separately.

## Challenged hypotheses and architecture observations

- **Cross-DAO/app escalation and stale grants:** Live DAO/member/app checks, exact app revision/scopes, native credential epochs and module sender/code checks constrain signed requests. Existing negative tests and native connected-app checks passed. This eliminated an assumed stale-token bypass from the finding list.
- **Provider sign-in alone unlocking arbitrary keys:** Recovery handoffs/grants bind credential, session, origin and original-key commitments. Account locks serialize opt-out and claims. Private-DAO admission rejects incompatible assisted custody, including relevant history. Review did not demonstrate key substitution or an opt-out race bypass; browser possession and provider/operator compromise remain material threat assumptions.
- **Public content as plaintext leakage:** Public content routes return committed stored bytes; protected content is encrypted before publication. Public access itself is intentional. SEC-02 concerns shared retrieval capacity.
- **Duplicate refunds/payouts:** Database locks, pending-refund totals, provider idempotency and exact Stripe object/account/amount metadata checks constrain service retries. Native treasury obligations preserve backed liabilities and once-only settlement. Local/provider-fixture and contract tests do not establish live payment success.
- **Documentation-renderer XSS:** The HTML rendering boundary uses Markdown with raw HTML disabled, restricted HTTPS links, escaped images and safe link attributes. Browser keys stay in memory while the vault persists encrypted data. No source-based XSS exploit was demonstrated; a browser compromise would expose unlocked key material.
- **Secret leakage:** Limited format-pattern scans found only two synthetic Stripe fixture strings. Current tracked text coverage: 849 core, 124 modules, 290 frontend files. Reachable-history coverage: 2,715 core, 718 modules, 1,133 frontend unique text blobs. The built frontend scan covered 98 text files and found no matching credentials. Binary files, files/blobs over 2 MB, ignored private environment files, arbitrary secret formats and production stores were not covered; these are not comprehensive secret-detection guarantees.

The architectural improvement is consistent admission at existing resource boundaries. Canonical payload verification, account identity, CSRF, provider allowance and contract authorization remain separate required controls. No contracts, storage schema, key ownership, recovery policy or public API payloads were changed.

## Alternatives and decisions

Reusing existing account/IP/global budgets gives equivalent operations one budget and avoids per-token reset opportunities. A separate connected-app limiter would still allow the same member to multiply capacity across paths. Byte quotas cannot replace upload-operation admission because deduplicated bytes can still allocate work. Requiring login for public ciphertext would change the intended access model and would not solve authenticated resource abuse. Redis or new database admission tables would add infrastructure/schema obligations beyond these safe repairs; distributed admission should be considered when the deployment topology requires it.

## Verification

Runtime: pinned Node 24.21.0/npm from `/data/daclify-runtime/node-v24.21.0-linux-x64/bin`; owned PostgreSQL 17; pinned Spring 1.2.2. Existing versioned WASM/ABI artifacts were used and native helpers checked runtime/module release hashes. No C++ source changed, so no contract rebuild or compiler-flag change was required.

| Check | Result |
| --- | --- |
| Baseline core `npm run verify` | 139 files / 872 tests passed; lint, types and generated docs passed |
| Baseline modules `npm run verify` | 30 files / 179 tests passed; lint, types and generated docs passed |
| Baseline frontend `npm run verify` | 42 files / 275 tests passed; lint policy 5 cases and types passed |
| Connected-app/download pre-fix regressions | 2 expected failures, 16 existing cases passed |
| Direct-login pre-fix regressions | 2 expected failures, 3 existing cases passed |
| Upload pre-fix regression | 1 expected failure, 42 intentionally unselected cases |
| First three repaired regression suites | 3 files / 23 tests passed |
| Focused repaired upload regression | 1 passed, 42 intentionally unselected cases |
| Complete repaired core PostgreSQL integration suite | **33 files / 271 tests passed; 0 failed, 0 skipped** |
| Post-review full content integration suite | **43 tests passed**, after adding assertions that rejected uploads/reconciliation make no extra provider reads |
| Native connected-app suite | **1 file / 8 tests passed; 0 failed, 0 skipped** |
| Final core `npm run verify` and build | **139 files / 872 tests passed; 0 failed, 0 skipped**; lint, types, generated docs and build passed; publication remains refused/unqualified |
| Native permission/workflow suite | **9 files / 137 tests passed; 0 failed, 0 skipped** |
| Modules and frontend `npm run build` | Passed; frontend reports the existing chunk-size warning |
| Changed TypeScript formatting and `git diff --check` | Passed |
| Dependency audits | Core/modules production 0; frontend full 0; core/modules development advisories retained |
| Redacted current/history/bundle pattern scans | No confirmed real credential matches within stated coverage |

The final integration run includes actual database constraints, migrations, transaction/replay behavior, valid and invalid auth/recovery paths, signup/opt-out, connected-app scope changes, storage/archive accounting, payment/refund handling and reconciliation. External chain/provider fixtures are explicitly distinct from the native checks.

Setup failures were retained as evidence: an initial TCP connection lacked the required test password; a reused gateway funding scope conflicted until the fixture was made unique; the first broad integration run lacked temporary-role `CREATEDB` permission. That broad attempt reported 3 failed files, 2 failed tests, 257 passed and 12 skipped. After correcting only the owned fixture permissions and recreating its empty database, all 271 integration cases passed. An intermediate strict TypeScript tuple-index error was corrected before the successful type check. None of these failed setup attempts is counted as passing verification.

Raw logs and redacted scan receipts are retained locally in `/data/daclify-runtime/security-audit-20261011/`. The [machine-readable receipt](2026-10-11-security-audit.json) records source hashes, commands, results and evidence-log hashes. The owned database, ephemeral role and temporary credential file were removed after verification; secret values are excluded from report artifacts.

## Remaining risks and next work

1. **Release/cutover:** Review and expressly authorize deployment through the existing qualification process. This audit does not change the unqualified publication status or prove live Telos permissions, gateway availability, Stripe/SMTP/Telegram interoperability, external wallet behavior, production backup restoration or recovery-operator procedures.
2. **Development dependencies:** Resolve SEC-05 with an evidenced compatible emulator update/replacement; preserve native and real-WASM regression coverage.
3. **Process-local admission:** Existing rolling-window budgets reset on restart and multiply across API replicas. They reduce the reproduced bypasses on the present process boundary; they are not a distributed DDoS guarantee. Before scaling, define/enforce a deployment-wide resource policy and test legitimate high-volume usage.
4. **Independent/live assurance:** A separate specialist review and authorized external testing would provide additional assurance for cryptography, recovery custody, deployed infrastructure and third-party integrations. This review did not perform formal cryptanalysis, a complete supply-chain/artifact provenance audit, a full browser end-to-end run, production infrastructure assessment or invasive fuzzing/load tests.

No additional approval is required to retain these local repairs. Deployment, live authority/key/custody changes and real asset/provider operations require the user's express authorization under the repository workflow; none was performed here.
