# Approved login-key binding — 2026-10-10

## Change and scope

The user approved the coordinated authentication/API change from the [three-repository audit](2026-10-10-three-repository-audit.md). Starting `dev` revisions: core `1b8899f`, modules `e4f2427`, frontend `0eee397`. Work stayed inline on `dev` under Ponytail 5.1.0 full and repository instructions.

The first-registration defect was reproduced before production edits: the SQL regression authenticated a substituted encryption key, and unused v2 challenges authenticated both with and without optional HTTP context. All three rejection assertions failed. The frontend legacy-challenge assertion also failed before the coordinated change. These isolated fixtures used disposable keys and an owned loopback database.

Core now requires a public encryption key in challenge input, validates the P-256 curve point before insertion, and signs both public keys in `daclify.login.v3`. Authentication always parses v3, verifies stored signing key/UUID/expiry and the exact submitted encryption identity before any account/session insertion. The existing atomic one-use challenge transaction remains intact. No unsigned-key legacy fallback exists.

The frontend sends the original validated vault public identity through the canonical SDK request schema and checks both keys, API audience, browser origin, challenge UUID and expiry before signing. Real client/vault tests verify the actual K1 signature over the returned bytes. Legacy or substituted responses never reach the login endpoint or unlock the vault/store CSRF state.

Existing account IDs/keys, sessions, encrypted kits, service pairings and chain state are preserved. A pre-upgrade account/session fixture logs in with the same ID/keys and retains the prior session. Deliberately signing a new encryption identity for an existing account still returns `KEY_CHANGE_REQUIRED`; login is not key rotation.

## Versions and compatibility

The release policy requires a minor increase for an incompatible 0.x API. Core protocol/API and frontend are **0.10.0-alpha.1**. Modules SDK/help is **0.9.0-alpha.8**, with an exact core 0.10 peer. Contract versions/binaries/code/ABI hashes remain unchanged; module contracts stay **0.9.0-alpha.5**. The module catalog retains the existing 0.9 range and additionally supports exactly core 0.10.0-alpha.1, not unspecified future minor releases. Its regression failed before the compatibility declaration was updated.

Generated API/help references, in-app account guidance, README/indexes, development archives and lock integrities are refreshed. Frontend vendor archives are self-contained; obsolete unreferenced archives were removed. Archives are unpublished development artifacts, not immutable release qualification. No migration, contract redeployment, production key/authority change, provider configuration or financial policy change occurred.

## Verification actually executed

| Check | Result |
| --- | --- |
| Focused core authentication SQL | 18 tests passed: substitution, downgrade with/without context, signed/stored identity mismatch, curve validation, existing identity/session preservation, wrong signer, context, expiry, replay/concurrency and signed key replacement refusal. |
| Full PostgreSQL integration | **27 files / 206 tests passed**, owned PostgreSQL 17 `daclify_login_test` at loopback 5460. Includes HTTP substitution rejection with no cookie/account insertion, missing-key rejection, wallet recovery/pairing, payments, storage and Archive callers. |
| Core `npm run verify`, `format:check`, `build` | **111 files / 658 unit/property tests**, lint, TypeScript, generated docs, format and build passed. Publication remains refused/qualification false as required. |
| Modules `npm run verify`, `format:check`, `build` | **27 files / 162 unit/VERT tests**, lint, TypeScript, generated docs, format and build passed with unchanged compiled fixtures. |
| Frontend `npm run verify`, `format:check`, testnet build | **33 files / 168 unit tests**, plus Vue template/type, lint and format checks passed. |
| Native API/runtime and paired-wallet suites | **2 files / 7 tests passed** on fresh owned Spring 1.2.2 `daclify-login-native`, loopback 20740, with actual unchanged compiled contracts. The private source snapshot rebound only fixture-container validators; existing nodes/fixture files were preserved. |
| Playwright connected payments | **4 desktop/mobile tests passed**, including real vault unlock/sign-in/client validation through synthetic HTTP responses and explicit payment consent. |
| Playwright module cards/activation | **18 desktop/mobile tests passed**. The initial run had 16 passes/2 failures: the fixture wrongly used the core package version for the deployed module contract. Corrected it to producer `CONTRACT_VERSION`; retained the production compatibility guard. |
| Fresh standalone frontend | `npm ci --ignore-scripts`, `npm run verify` (168 unit tests) and testnet build passed outside the workspace, without sibling checkouts, private environment files or a registry token. Vendored package integrity, allowed contents and exact peer versions passed. |
| Final review | Production auth/client logic, all callers/fixtures, version/lock changes and generated references reviewed inline; `git diff --check` passed in all three repos. |

One broad SQL run initially failed the newly added session-preservation fixture because it reused a deterministic session token across repeated runs (205 passed/1 failed). The fixture now generates a unique token; the complete rerun passed. An initial native staging attempt used the wrong working directory, was stopped, and its owned temporary copy removed before native startup. The final fixture used an explicit tracked-source snapshot with no private environments.

## Rollout and remaining boundaries

Follow [the coordinated v3 runbook](../operations/login-v3.md). Old clients/in-progress v2 login attempts must refresh/restart. Self-hosted APIs serving the Daclify frontend must also upgrade. Mixed versions reject new vault logins; existing sessions and separately configured paired-login methods retain their lifecycle. Roll forward rather than restoring v2.

No public testnet/mainnet API/frontend delivery, real wallet/provider ceremony, cloud deploy, paid model call, Stripe/Pinata action or destructive retention was performed. Local native checks do not establish a full supported-release migration matrix. Existing VERT development dependency advisories and the lazy Docs chunk warning (approximately 509 KB minified / 73 KB gzip) remain from the earlier audit. No warning threshold or permission check was weakened.
