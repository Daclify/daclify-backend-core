# Connected Community Apps Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` inline, task by task. The workspace prohibits subagent delegation. The user approved the design and requested implementation and testnet backend/frontend rollout on 11 October 2026; continue without repeated implementation approval. Production rollout remains unauthorised.

**Goal:** Let multiple apps use a DAO's verified Daclify members and record member-authorised completions, independent reviews and linked decisions, with protected evidence and a qualified testnet installation.

**Architecture:** Core registers external clients and issues app-specific OIDC identity, and enforces app-bound credentials in the native runtime. A shared Community Activity module records compact references and app encryption grants. The frontend owns native registration/consent, review, evidence and revocation; the public developer client and synthetic example own app-side login, signing and durable delivery.

**Tech Stack:** Existing strict TypeScript, PostgreSQL, Fastify, jose, WharfKit, Vue/Vite, Antelope C++ with pinned CDT 4.1.1 `-O=s`, VERT and native Spring fixtures. Use existing dependencies and pinning/crypto facilities.

**Spec:** [Approved platform design](../specs/2026-10-11-connected-community-apps-design.md), [project example](../../examples/community-mini-app-design.md).

## Global constraints

- Several apps per DAO; no duplicate membership or voting weight. Only active members may use protected app capabilities.
- Existing serialized member/session/document rows and historical fixture compiler settings remain unchanged.
- Sixteen active native sessions per member, seven-day maximum expiry, one active app grant per member/app; cleanup is bounded to twenty-five records.
- App registration retains only native authorisation fields; descriptions, callbacks and credentials belong in the service database. Start with sixty-four registrations per DAO and explicit metered receipt/grant capacity.
- App/source/event references are opaque and bounded. No private descriptions, pictures, pairings or source API secrets in native activity records.
- Public and encrypted private DAOs are supported, including protected evidence within a public DAO. Signing and decryption grants remain separate.
- Code/ABI pins, compatible producer packages, database migrations, actual compiled-WASM/native checks, measured RAM/CPU and source-bound testnet evidence precede rollout.
- Work in the current clean `dev` checkouts, inline as requested. Commit/push `dev`; preserve unrelated edits and all legacy repositories. No production activity or friend-repository changes.

## Review focus

1. A client changes its callback/configuration after consent: native configuration commitment and revision must invalidate stale login/grants.
2. An ordinary session calls a new activity action: runtime must reject app-scope bypass, cross-app payloads and stale app revisions.
3. Two apps race the same member nonce or lose a broadcast reply: reconcile event identity before replacement signing; never duplicate receipts.
4. A protected snapshot is published for a public DAO: app envelopes/key grants must preserve confidentiality without changing existing public document rules.
5. Deployment changes code under live RAM observers/oracle pins: freeze service writes, preserve state and accounting, refresh exact pins before resuming.

---

### Task 1: Native app registration and constrained credentials

**Files:** Create `contracts/common/connected_apps.hpp`, `tests/connected-app-contract.test.ts`. Modify `contracts/runtime/runtime.cpp`, `contracts/common/ram_table.hpp`, `contracts/common/ram_families.hpp`, generated runtime schemas/SDK and permission plans.

**Interfaces:** Native actions `setapp(runtime, dao_id, member_id, app_id, target, revision, config_hash, enabled)`, `addappses(runtime, dao_id, member_id, app_id, app_revision, session_id, signing_key, expires)`, `pruneappses(dao_id, after, limit)`. Tables `appregs` and `appscopes` are additive; activity action payloads begin with actor context followed by `app_id`.

- [x] Add compiled-WASM tests: member consent creates only a scoped grant; non-admin registration, generic grant creation, cross-app payloads, disabled/revised app, deactivated member and expired keys fail. Expired cleanup frees slots and preserves active sessions.
- [x] Run the tests against the old ABI and record the missing-action failure.
- [x] Implement native checks, unchanged base session serialization, metered tables and bounded cleanup. Add new actor-context permission links.
- [x] Compile with pinned CDT `-O=s`, regenerate producer types, run the new tests and existing scoped-session regressions. Commit.

### Task 2: Community Activity module

**Files:** Create module `contracts/activity/activity.cpp`, `contracts/common/activity_records.hpp`, `tests/activity.test.ts`. Extend module catalogue, schemas, build/codegen, SDK exports, help, RAM family inventory and source readers.

**Interfaces:** Actions `recordact` and `askreview` accept app/source/version/event/evidence commitments; `reviewact` uses an independent reviewer and exact receipt; app epoch/key grants use separate administrative signing. Receipts are unique per DAO/app/event and expose pagination by DAO/app. Decision links bind the exact Decide ballot and source revision; they remain advisory.

- [x] Add tests for duplicate event replay, event-content conflicts, actor/DAO/app isolation, self-review, wrong reviewer, encrypted evidence/key epochs, bounded capacity and exact-version decision links.
- [x] Observe missing-module failure, then implement compact records, separate encryption grants and fixed policy checks using existing metering.
- [x] Compile/codegen, measure row/index RAM and action CPU, run module/native integration and existing modules. Commit.

### Task 3: External client identity and consent

**Files:** Create core `protocol/connected-apps.ts`, `services/api/src/connected-apps/{service,oidc,routes,config}.ts`, additive migration and integration tests. Extend `ChainGateway`, native reads, canonical routes/server configuration and SDK package exports.

**Interfaces:** Versioned registration/list/request/consent routes plus OIDC discovery, JWKS, authorisation code/token/userinfo. Registration binds native app config/revision; identity returns app-specific subject and only DAO/member/needed-role claims. Persistent ES256 issuer key is server-only. Codes/access tokens are hashed, short-lived and atomically single-use.

- [x] Add tests for exact HTTPS callbacks, PKCE S256, state/nonce, issuer/audience, one-use code races, app suspension/configuration changes, removed/nonmembers, token scope and consent CSRF.
- [x] Implement native-backed registration and membership checks, app-specific subjects, stable issuer backups and bounded expired-record cleanup. Do not add external apps to full-frontend CORS trust.
- [x] Run actual PostgreSQL/API integrations and route/schema compatibility checks. Commit.

### Task 4: Public developer client and signing flow

**Files:** Create `sdk/connected-apps.ts`, browser/server developer-client tests and package entry points. Extend frontend auth/consent handling.

**Interfaces:** Client-owned PKCE/login state, app key generation in memory, registered redirect processing, issuer/JWKS verification, narrow membership refresh and canonical activity signing/relay. The native delegate public key is approved through the trusted Daclify signer; root/decryption keys never reach app backends.

- [x] Test altered callbacks, wrong issuer/audience/nonce, missing browser keys, expired/revoked grants, forged member IDs, concurrent nonces and lost-response reconciliation.
- [x] Implement the client using released producer schemas and exact native envelopes; keep backend and browser key responsibilities distinct.
- [x] Verify fresh install/package consumers, then commit.

### Task 5: Frontend app management, consent and activity

**Files:** Create `src/views/ConnectedApps.vue`, `src/views/AppConsent.vue`, app state/helpers and browser/unit tests. Modify workspace routes, module catalogue/screens, API client and contextual documentation.

**Interfaces:** Member-only per-DAO app list, administrator registration/suspension, explicit login and grant consent, native grant revocation/renewal, activity pagination and independent review/ballot links. Local-only state never authorises native actions.

- [x] Add browser checks for two apps/seven members, nonmember denial, email/Telegram session versus signing approval, logout, keyboard/mobile use and honest pending/confirmed states.
- [x] Implement accessible controls using current components and supported signing paths. Show the exact app, DAO, scopes and expiry before consent.
- [x] Run Vue/type/unit/browser checks and build. Commit.

### Task 6: Evidence and a working synthetic mini-app example

**Files:** Extend app evidence protocol/service and frontend trusted evidence viewer; create `examples/community-mini-app/` with SQLite/outbox backend and browser client, plus integration/browser tests and its README.

**Interfaces:** Current app API details are authenticated and audience-bound. Immutable selected snapshots preserve actual bytes/files and source revision. App-specific encryption envelopes and member key grants handle both DAO privacy modes. The example reuses one seven-member DAO for garden and equipment app namespaces.

- [x] Test private plaintext exclusion, public-DAO protected evidence, cross-app key isolation, snapshot tampering, member/key removal, pinning failures, database restart, repeated clicks and stale result application.
- [x] Implement durable local saving/outbox and exact-event signing/reconciliation; use current pinning, verification and recovery facilities. Do not create the friend's DAO or alter their repository.
- [x] Verify the complete local/native/API/browser flow and restore/missing-data cases. Commit.

### Task 7: Compatibility, review and release documentation

**Files:** Versions/manifests/package locks, generated ABI/reference/help, execution evidence, developer guide/example and deployment preparer.

- [x] Regenerate new semantic development versions, hashes and consumer archives. Run full repository checks, native permission/migration/resource tests and complete two-app fixtures.
- [x] Review all changed authorization, accounting, recovery and upgrade boundaries inline; fix each material finding with a failing regression first.
- [x] Update documentation to the tested implemented behaviour and record remaining provider/client qualifications honestly. Commit and push all three `dev` branches.

### Task 8: Authorised testnet rollout and live verification

**Files:** Testnet deployment config/preparer, private review packet/backups under `/data/daclify-runtime`, public redacted rollout evidence and operations runbook.

- [ ] Prepare exact testnet-only code/ABI, account, registration, resource and pin changes; compare current state/authority and ensure adequate existing/funded capacity. Keep mainnet and unrelated authorities untouched.
- [ ] Back up service/database and native state, freeze API writes and oracle updater, simulate/review the concrete packet, then execute the testnet rollout already requested by the user.
- [ ] Confirm irreversible receipts, preserved pre-existing state, correct code/ABI/RAM/oracle pins and matching archived updater before resuming.
- [ ] Install migrations/configured issuer secret and matching testnet API/frontend builds; verify actual public HTTPS, consent, app registration and owned synthetic signed activity. Record exactly which provider ceremonies were qualified.

## Execution ledger

- 11 October 2026: user approved implementation and testnet backend/frontend installation. All three checkouts were clean on `dev`; baseline tests started. Public testnet reports core `0.13.0-alpha.4` and the expected Telos testnet runtime.
- Ruling: work inline in the existing clean checkouts, without subagents or another permission round — standing workspace/user workflow — preserve concurrent changes if they appear.
- Ruling: optional direct mini-app decryption stays behind separately qualified app key access; the first supported evidence viewer uses the trusted Daclify client — approved spec — do not export root/DAO-wide keys.
- Baseline: core 134 files/841 tests, modules 28 files/164 tests and frontend 41 files/272 tests passed. Native app registration/session tests observed the missing ABI, then 23 new/existing scoped-authority cases passed with compiled WASM.
- Ruling: renewal atomically replaces the same member/app grant, preserving one active grant and avoiding slots stranded by lost browser keys — explicit new consent authorises replacement — old session IDs become invalid.
- Regression: consent could race a changed registration revision. A test demonstrated acceptance of stale consent; `addappses` now signs and checks `app_revision` before allocating authority.
- Native module: ten compiled-WASM cases pass for attribution, same-event retries/conflicts, app isolation, independent review, ciphertext-only snapshots, epoch generation and key commitments. A zero key commitment was initially accepted; the regression is now rejected.
- Service: twelve actual PostgreSQL/API cases pass, including two apps/seven members, exact callbacks, immutable native-backed configuration selection, PKCE/concurrent one-use codes, real ES256 verification, member removal, app suspension, revocation, Origin/CSRF and scoped credential-free CORS.
- Developer client: six SDK/protocol cases pass, including real WebCrypto ES256 verification, callback/state/issuer binding, live membership and browser key clearing. No browser signing key is persisted.
- Regression: native app suspension failed after module removal, and credential rotation did not advance app encryption generation. Both failures were reproduced; fixes are being rebuilt with pinned CDT.
- Implementation scope: initial optional snapshots may be pinned by the project's own IPFS service. Daclify retains encrypted snapshot commitments and provides the trusted evidence viewer; external pins do not create Daclify storage billing or ownership claims. Existing Daclify document/provider rules remain unchanged.
- Concurrent workspace: a separate session is implementing quick signup/assisted recovery and has selected core/frontend `0.13.0-alpha.5` and modules `0.9.0-alpha.21`. Preserve those changes and coordinate shared rollout/package publication; never stage or discard the unrelated signup implementation. Its migrations reserve 036/037. The connected-app refresh migration will use 038.
- Service refresh: thirteen real PostgreSQL/API tests pass, including refresh rotation, audience binding and replay-family revocation. Browser credentials remain in memory, with refresh capped by the native signing grant (or one day for identity-only sessions).
- Epoch recovery: a failing test exposed orphan epochs after losing the creator's unpublished key. Epoch creation now atomically stores the creator's wrapped key grant. A second failing test exposed old epochs remaining eligible after manual rotation; a fixed-size current-epoch counter now gates future snapshots.
- Native Spring fixture has been written for two apps/seven members across public/private DAOs, real app signatures, direct-service denial, exact review/ballot links and measured RAM/CPU. It has not run yet; consumer pins must match the final module binary first.

- 2026-10-11: User confirmed a combined rollout: quick signup/recovery opt-out and connected apps must both pass and work together. Preserve concurrent edits; migrations 035/038 are connected apps and 036/037 are signup/recovery.

- Task 2: Native Spring passed 5/5 connected-app integration cases. Runtime hash 4235158cdd149a4bebf1006a69b5f3943a842a9b437db14abf823acbd6cc277b; activity hash 225b7070235779ccc6f001d21209f243cdfd6fc0619e8a334405d30d7e6f6866, 187031 WASM bytes. First app receipt/table headers 1225 RAM bytes, second app receipt/count 889 bytes; measured native actions 4265/2223 microseconds. These are isolated fixture measurements, not public testnet timings.
- Task 1: Two additional meaningful reds caught expired app sessions blocking key reuse and unchanged credential epochs on offboarding; fixes passed with SDK/protocol/example regression suite 24/24.
- Tasks 3/4: Combined PostgreSQL connected-app/signup/recovery integration passed 52/52; source API access has no recording grant and gets fresh native membership checks. Native delegate grants invalidate on code/config/credential change.
- Ruling: Registry and audit receipts use existing metered activity capacity; app scopes remain additive to native sessions and get explicit expiry cleanup. Permanent receipts, review links and key grants cannot be pruned in this version; capacity is capped at 10000 receipts and 128 epochs per app. This avoids changing billing semantics of existing records; operators must fund capacity before growing an app.

- Task 7: Rebuilding unchanged five modules with -O=s reproduced the RAM audit's optimization candidate hashes exactly. Their historical alpha.5 release used default optimization. Ruling: preserve their verified historical WASM/ABI and native pins; build and release only new Activity with -O=s. Existing grants remain compatible and no unrelated module redeployment is needed. Current five -O=s candidates are retained in .artifacts/size-candidates for a separately versioned optimization rollout. The selected `build:contracts -- activity` path supports this additive release.

- Native qualification: six owned Spring cases now pass, including keyless Activity ownership delegated to the runtime and native code metering. The additional authority test caught unsorted native account permission weights; deployment account weights now use canonical ordering. Existing native permission-tree tests also passed (32 cases).
- Browser: six desktop/mobile checks passed for two protected apps, no administrator/self-review controls for an ordinary member, paired sign-in without silent recording authority, and nonmember denial. UI fixtures use the actual producer consent schema.
- Combined PostgreSQL suites passed 53/53 after correcting a hard-coded recovery test URL to its canonical producer route. Signup added `assistedEnabled` while packages were being built; the final producer archive refresh must include that field.
- Tests: module lint/type/docs/full suite 30 files/179 tests passed; frontend full suite 42 files/275 tests and build passed. Core full suite caught four old family/link-count assertions; updated to cover appregs/appscopes and new action links, focused regression 20/20 passed, full rerun in progress.
- Rollout preparation: native RAM observer is currently disabled, so preserve that state; bind the new payer without introducing observer/quota policy. The testnet quote for 4 MiB is about 240.1443 TLOS plus 3 TLOS CPU/NET stake, with creator balance 102999.3118 TLOS. Combined compressed simulation exceeded Spring's decompressed transaction bound; use three dependent batches (account/resources, Activity code/ABI, runtime/permissions/catalogue/Hub), freshly simulate each immediately before signing. No transaction has been sent.

- Final verification so far: core 139 files/870 tests pass, modules lint/type/docs and 30 files/179 tests pass, frontend 42 files/275 tests plus build pass, combined PostgreSQL 53/53 and desktop/mobile app browser 6/6 pass. Native owned app/authority suite 6/6 and permission-tree 32/32 passed. The research module-integration suite needs its separate Docker research chain and did not run; do not describe that attempted run as passing.
- Testnet review packet prepared read-only under /data/daclify-runtime/connected-apps-rollout-20261011-review4. Native backup/layout round-trip succeeded, first account/resource batch simulation passed. Three action batches have counts 3/2/13. Nothing broadcast, no service restart or environment mutation yet. Prepare a fresh frozen packet after final source/package checks.

- Final native API review caught a real lower-bound bug: scoped session lookup passed an account name to a uint64 primary reader. An actual owned-chain API test failed, conversion to the canonical native account value fixed it. Seven native cases now pass, covering actual gateway sessions, by-event/by-app activity lookup, app key/grant lookup and member-delegated API relay as well as code/control isolation.
- Final combined UI run passed 22/22 on its own loopback fixture (ports 5208/3038), including quick email signup, recovery opt-out and storage-outage retry, real Telegram HMAC/JWT verification and connected app member/consent controls. Parameterised test fixture ports prevent interference with the separately running signup check. These are owned provider fixtures, not live email/Telegram ceremonies.
- Final trusted evidence flow includes immutable draft/file encryption, provider pinning adapter, pending status on pin failure, conditional exact-commitment confirmation and local ciphertext integrity/decryption. Example SQLite restart, member binding and selected-snapshot freeze checks pass. Project-owned pinning can leave an orphan upload after a lost response before database persistence; reconciliation belongs to the project's retention policy and is documented.
- Final review: self-review inline (workspace forbids subagents). Reviewed current authorization/code pins, native grants, membership revocation, exact-event retries, independent review, key domains, cleanup, private data boundaries and deployment preservation; significant native reader and authority ordering findings are fixed with regressions.

- Final source check: core 139 files/871 tests passed after reader/review changes; all previous module/frontend/PostgreSQL/native/browser checks remain green. Signup source was committed concurrently as core 5860289, frontend 5d17c10 and modules c97f9e6; connected-apps changes remain additive on those commits. The separate signup browser run also passed 16/16 in its isolated checkout. Public testnet process has no RECOVERY_* environment configuration, confirmed without printing secrets; asked for the separate recovery/restore hosts while continuing the authorised connected-app installation.

- Release preparation: combined source qualification is complete; release commits and consumer archive SHA-256 are bound into the testnet packet. The prepared packet has a retained checksum, and apply requires unchanged clean dev checkouts. Five connected-app acceptance requirements now point to the native, PostgreSQL, SDK/example, module and browser suites.

- Frozen preparation found legacy Hub metadata (`schemaVersion/title/description`) without the newer directory fields. Nothing was broadcast. Services were resumed while correcting the preparer to preserve metadata verbatim and update only reviewed code/ABI pins; Activity discovery uses the existing native catalogue plus the six-entry API deployment configuration. Database backup was taken with services paused.
