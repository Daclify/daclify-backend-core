# Project Audit Remediation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Delegation is not authorized. Track each task and its verification in this plan's execution ledger.

**Goal:** Fix the six confirmed audit findings and accurately inspect, explain and prepare permissions for the Relay and Fees service accounts. Final review also adds circular-authority guards and a Hub hash refresh.

**Architecture:** Preserve the C++/API/SDK/frontend ownership boundaries. Contract rules prevent ordinary-name offer takeover and bound seller-funded storage; API inventory reads use cursors and quotes use keyed reads. Reuse existing rate limits, SQL workers and JOSE verification. Service account proposals remain separate from the immutable managed-contract handover.

**Tech Stack:** Antelope C++, strict TypeScript, PostgreSQL, Fastify, JOSE, Vue 3, VERT and native Spring fixtures.

**Spec:** The six findings and proposed fixes in `/data/daclify-runtime/project-review-20261010/review.txt`, approved by the user's “lets fix all”; existing creator-owner/executive-active design remains binding.

## Global Constraints

- Work inline on the three existing clean `dev` checkouts; preserve legacy repositories.
- No application `any`, unchecked casts, copied producer types, private keys in outputs, production deployment or asset movement.
- Prepare exact authority changes with native test evidence before requesting the separate live permission decision.
- Keep current member/DAO/signature isolation and compatible persisted table layouts.
- Publish new pinned local artifact versions when producer behavior/schema changes; keep intentional old-release fixtures separate.

## Review Focus

- Existing poisoned basic-name listings must stop influencing quotes without deleting legitimate pending sales.
- More than 100 valid seller entries must remain browseable and individually quoteable.
- Untrusted clients must not spoof forwarding headers or bypass challenge admission limits.
- New Google signing keys must work without dropping audience, issuer or nonce validation.
- Relay permission narrowing must preserve every deployed settlement path while Fees cannot spend through the operator key.

### Task 1: Names seller authority and storage

**Files:** `contracts/names/names.cpp`, `sdk/names.ts`, `services/api/src/market/read.ts`, Names regression/native tests; frontend `src/components/NamesManager.vue`.
**Interfaces:** Preserve Names action/table encodings; reject basic-name listings and ignore legacy basic listings when choosing offers. New seller rows bill the authorizing seller.
- [x] Write failing contract/SDK and legacy-offer tests and observe the expected failures.
- [x] Enforce the category and RAM-payer rules, retaining valid namespace/special-name behavior.
- [x] Recompile actual Names WASM and verify unit/native signed behavior.

### Task 2: Proxy trust

**Files:** API deployment configuration, server/startup, `.env.example`, operations guide and `tests/proxy-trust.test.ts`.
**Interfaces:** Explicit validated `TRUSTED_PROXY_IPS` controls exact hops; default loopback remains valid locally.
- [x] Test configured private hop, distinct forwarded clients and untrusted header spoofing (RED).
- [x] Thread validated trust configuration through server startup and document the boundary.
- [x] Verify tests; prepare runtime configuration against observed peer without assuming off-host header sanitization.

### Task 3: Vault challenge admission and expiry

**Files:** `services/api/src/server.ts`, `auth.ts`, auth maintenance/startup, SQL-backed integration tests.
**Interfaces:** Reuse existing window limiter before challenge insertion; bounded expiry cleanup joins the API worker lifecycle.
- [x] Add real handler/SQL tests for admission rejection and bounded cleanup (RED).
- [x] Implement per-client/global limits and expiry maintenance with graceful shutdown.
- [x] Verify active challenges still authenticate and expired storage is reclaimed.

### Task 4: Google signing keys

**Files:** Provider configuration/proofs, startup, environment/docs and signed JWT regression tests.
**Interfaces:** Use installed JOSE resolver for the fixed Google JWKS endpoint; synthetic keys remain explicit test inputs.
- [x] Reproduce signing-key rotation with a controlled HTTP key-set endpoint (RED).
- [x] Replace static production-key import with cached, bounded remote key resolution.
- [x] Verify rotation, malformed/wrong-key failures, issuer, audience and nonce checks.

### Task 5: Names pagination and direct quotes

**Files:** `protocol/service-api.ts`, market readers/routes, chain gateway, frontend API/Names views and regression tests.
**Interfaces:** Producer-owned optional inventory cursors with bounded pages; quote requests load only the relevant listing/suffix.
- [x] Test 100/101 listings, next-page browsing and a quote beyond page one (RED).
- [x] Implement bounded cursors and keyed quote reads; add accessible load-more controls.
- [x] Verify typed API responses, quote parity and catalogue exhaustion/cursor rejection.

### Task 6: Release fixtures and reproducible verification

**Files:** Producer release artifacts/package versions, bootstrap, module fixture loading/tests, Vitest configurations and formatting warnings.
**Interfaces:** Consumers pin the new producer artifact; normal fixtures validate current WASM/ABI hashes, upgrade fixtures retain explicit versions.
- [x] Add a fixture-drift rejection test and observe its failure.
- [x] Refresh matching artifacts, install pinned packages, and enforce normal fixture provenance.
- [x] Set measured worker/test budgets, fix existing formatting and run the suites.

### Task 7: Relay/Fees permissions and UI

**Files:** Producer service-permission SDK/tooling/tests, chain gateway authorization selection, frontend account role/release display and docs.
**Interfaces:** Relay/Fees have zero deployed code; do not manufacture eosio.code grants. Propose owner/active delegation to core active, with a linked operational child only on Relay. Display actual permissions and configured roles.
- [x] Trace all relay-authorized actions and inspect live service account permissions/code.
- [x] Test scoped relay operations, forbidden upgrades/transfers, executive recovery and treasury authorization on dummy accounts (RED).
- [x] Build an unsigned reviewed service-account proposal and compatible relay permission configuration.
- [x] Test UI service-role labels, no-code state, resources, connections and selection.

### Task 8: Documentation review

**Scope:** Current READMEs, operator/user runbooks, producer-owned product guides, release requirements, generated references, UI help bundles and runtime instructions across the three active repositories. Preserve dated evidence, original plans and historical manifests as records; correct current claims and link newer evidence.
- [x] Inventory documentation and compare current versions, migrations, permissions, archive/recovery behavior, local commands and links against source.
- [x] Correct stale current guidance and document the unchanged-HAProxy shared-peer admission choice, service proposals, seller RAM/pagination and immutable updater source.
- [x] Regenerate/repack both guide bundles, verify links/commands/requirements and retain the review evidence.

### Task 9: Final verification and delivery

**Files:** Explanatory/reference docs, release evidence, durable execution ledger and all changed consumers.
- [x] Run all repo lint/type/doc/format/build checks and complete unit/SQL/native/frontend suites.
- [x] Review the cross-repo diff inline, check public desktop/mobile behavior and save exact rollout artifacts. Final verification: 1,547 unit/SQL/native tests plus 104 desktop/mobile browser runs, and the current live UI smoke check passed.
- [x] Commit/push `dev` under the workspace workflow; report tested behavior, remaining external checks and the concrete live authority decision.
