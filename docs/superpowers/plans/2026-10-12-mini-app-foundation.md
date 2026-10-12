# Mini-App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` inline. No delegation. Track each checkbox and the master execution ledger.

**Goal:** Make the current mini-app instructions executable and provide verified database/identity integration examples.

**Architecture:** Repair the existing example rather than building a new application platform. Core owns binding/actor schemas; SQLite and PostgreSQL stores implement the same observable invariants. The agent example authenticates its root identity and uses a separately authorized delegate.

**Tech Stack:** Strict TypeScript, public core/modules packages, Node SQLite, PostgreSQL, Vitest and existing native fixtures.

**Spec:** [Design](../specs/2026-10-12-self-service-mini-apps-and-account-exit-design.md); [master constraints and dependencies](2026-10-12-self-service-mini-apps-and-account-exit.md).

## Global Constraints

Honor all master constraints. IDs are lossless decimal strings. Database credentials/signing keys never enter browser/model output. Bind chain/runtime/DAO/app/issuer/client before accessing records. Retain the existing one-task completion behavior; do not turn its source uniqueness into a universal activity schema. Preserve the implemented account-continuity guides/package behavior and never replace its versioned artifacts in place.

## Review Focus

1. Older qualified artifacts versus newer unqualified source pins — F1 documents availability by evidence.
2. Reopening a SQLite file with another DAO/app — F2 rejects before any read/write.
3. Same member number or subject on another tenant — F3 isolation tests.
4. Source edits, concurrency, uint64 maxima and uncertain submission — F2/F3 exact-intent tests.
5. A delegate mistaken for an account authentication key — F4 full API/native test.

### F1: Repair availability, artifact and account explanations

**Files (core):** Modify `docs/connected-community-apps.md`, `docs/examples/community-mini-app-design.md`, `examples/community-mini-app/README.md`, `docs/guides/topics.json`. Regenerate `protocol/generated/help.ts` and `docs/generated/reference.md`/`.json` through existing tools. Create `docs/guides/mini-app-database-contract.md`. Frontend: modify `src/help/catalog.ts` to put builder guidance where users can find it.

**Interfaces:** Consumes qualified release manifests/rollout evidence and current `ConnectedAppsRoutes`. Produces a guide with availability labels, exact downloadable artifact references, current flow diagrams and a normative database contract consumed by F2/F3/C1. No new API.

- [x] Write the documentation acceptance table: implemented connected-app sign-in/Activity versus planned MCP/private-profile/erasure; each implemented claim must cite a qualification record. Include root account, pairwise app subject, full native membership and separate login/recording/review/decryption permissions.
- [x] Replace stale “all proposed” wording and mismatched examples using one evidence-matched artifact set. Current testnet-development baseline is core `0.14.0-alpha.4`, modules `0.10.0-alpha.4`, frontend `0.14.0-alpha.7`; cite the initial/restored-account continuity deliveries and connected-app evidence rather than calling these production-qualified. Document prerequisites, exact callbacks, consent, first confirmed event, revoke/renew, restart, troubleshooting and storage/retention limits.
- [x] Write the database contract: bound namespaces, verified actors, transactional outbox, revision-aware logical events, explicit subject relinking, migration/restore, per-purpose cleanup and engine-specific maintenance. Say that deleting a link alone does not anonymize surviving records.
- [x] Run `npm run docs:generate` and `npm run docs:check`; inspect only generated changes belonging to this task. Verify handbook text through the public help export and frontend guide links. Do not use generated consistency as proof of availability.
- [x] Commit only the listed documentation/help changes as `docs: clarify qualified mini-app connection and database requirements`; preserve others' edits and record the precise pins/evidence in the ledger.

### F2: Persist SQLite binding and verify actors before state changes

**Files (core):** Create `protocol/mini-app-database.ts`. Modify `protocol/connected-apps.ts`, `protocol/index.ts`, `sdk/public-package.json`, `examples/community-mini-app/store.ts`, `examples/community-mini-app/server.ts`, `tests/community-mini-app.test.ts`. Create `tests/mini-app-database-protocol.test.ts`. Use producer export/codegen conventions rather than private imports in the example.

**Interfaces:** Produces `AppBindingSchema`, `AppActorSchema`, their inferred types and `appBindingHash(binding: AppBinding): string`; exactly the master fields. Export `AppClaims` inferred from existing `AppClaimsSchema`. Change the example constructor to `new Store(path: string, binding: AppBinding)`. Add `actorFromVerifiedClaims(binding: AppBinding, claims: AppClaims, verified: {issuer: string; clientId: string}): AppActor` in `protocol/mini-app-database.ts`; compare issuer/client/native membership against the authenticated login context. Existing `AppClaimsSchema` contains no issuer/client fields: obtain those from verified token/client configuration, never request input.

- [x] Add regressions named `rejects_rebound_database_before_reads`, `rejects_actor_from_other_dao`, `preserves_max_uint64_ids`, `reconciles_original_intent_after_source_edit` and `does_not_duplicate_after_restart`. Pin the main assertion: `expect(() => new Store(databasePath, otherBinding)).toThrow('APP_DATABASE_BINDING')`. The mismatch leaves prior rows unchanged and returns no previous pending event. Use the reproduced same-member-number case.
- [x] Run `npm test -- tests/mini-app-database-protocol.test.ts tests/community-mini-app.test.ts`. Expect red because persisted binding and new schemas are absent; record the specific assertion, not an unrelated setup failure.
- [x] Implement the schema and ordered hash. Persist one metadata binding row before task/outbox initialization; compare on every open. Add an explicit one-time adoption command requiring a backup, supplied original binding and matching existing records; an unbound nonempty database never adopts implicitly. Validate actor before queries/changes, and maintain transactionally frozen outbox payload/event IDs. Keep multi-revision examples separate from the one-completion task.
- [x] Run the same tests green plus `npm run typecheck`. Include concurrent `BEGIN IMMEDIATE`, rollback after outbox failure, legacy adoption rejection, exact-revision review and malformed binding tests. Verify server `/userinfo` handling rejects inactive/mismatched membership without caching authority indefinitely.
- [x] Commit owned files as `fix: bind mini-app database and actor to verified community context`. Record the example schema version and migration/adoption steps; do not reset other builders' databases.

### F3: Add PostgreSQL recipe and shared behavioral conformance

**Files (core):** Create `examples/community-mini-app/postgres-store.ts`, `examples/community-mini-app/postgres-schema.sql`, `examples/community-mini-app/database.ts`, `tests/helpers/mini-app-store.ts`, `tests/integration/mini-app-postgres.test.ts`. Modify the SQLite example/server/README and `tests/community-mini-app.test.ts` for the shared interface. Modify `docs/guides/mini-app-database-contract.md`.

**Interfaces:** `MiniAppStore` in `database.ts` exposes asynchronous `tasks(actor: AppActor): Promise<Task[]>`, `complete(taskId: string, actor: AppActor, options: CompletionOptions): Promise<ActivityIntent>`, `pending(actor: AppActor): Promise<ActivityIntent[]>` and `close(): Promise<void>`. Export `Task` inferred from the existing task schema and `CompletionOptions = {requireEvidence?: boolean; review?: boolean}`; do not duplicate producer `ActivityIntent`. `createPostgresStore(pool: Pool, binding: AppBinding): Promise<MiniAppStore>` implements the interface; an SQLite adapter preserves `Store` behavior. Existing evidence/review methods stay available and follow the same actor/binding rules.

- [x] Write one conformance test runner in `tests/helpers/mini-app-store.ts` used by both engines. Assert `(binding hash, source ID, logical operation/revision)` uniqueness, two different tenants/member-1 separation, forged subject rejection, atomic rollback, concurrent completion yielding one event, stable retries after source edits and restore. Test both implemented reconnection directions: wallet-only `/v1/account/reconnect` and restored-account `ApiRoutes.accountReconnectNative`. A sole client subject moves unchanged and retains its native membership anchor, but requires fresh app authorization; two existing subjects for the same client reject transactionally. The restored direction requires its original root proof even when another DAO signer is selected. A new subject without proof cannot inherit history. Never rebind the database or merge two registered root-key identities to bypass that conflict.
- [x] Run the SQLite tests and `npm run test:integration -- tests/integration/mini-app-postgres.test.ts` against a disposable local `_test` database. Expect the new PostgreSQL implementation/conformance failures before code. The suite must refuse production/nonlocal destinations and must not pass by skipping both engines.
- [x] Implement PostgreSQL composite foreign keys and tenant-qualified uniqueness; every query includes the namespace. Make task/outbox changes one transaction with row locking and retry only defined transient conflicts. Use unique-event deduplication rather than a universal `UNIQUE(source_id)` rule for revision examples. App profile mapping stores optional subject+issuer/client and full membership; roles stay projections, not authority. Document app restore, explicit client/issuer migration and pinned release upgrades.
- [x] Run both engine suites green and `npm run typecheck`. Exercise finite cleanup of disposable personal rows, then SQLite checkpoint/`VACUUM` with operational coordination and PostgreSQL normal vacuum behavior. Record logical deletion versus disk reclamation; do not promise shrinking PostgreSQL files on each deletion or SQLite on shared network storage.
- [x] Commit owned files as `feat: add PostgreSQL mini-app recipe and database conformance`. Save measured synthetic disk usage and engine/release versions in evidence; this qualifies these recipes, not every SQL/NoSQL engine.

### F4: Fix and qualify the root/delegate agent example

**Files (core):** Modify `examples/agent-publish.ts`. Create `examples/agent-publish-config.ts`, `docs/examples/agent-publishing.md`, `tests/agent-publish.test.ts`, `tests/integration/agent-publish.test.ts`. Link the guide from `docs/connected-community-apps.md`. Existing producer auth/sign-in interfaces remain authoritative; never weaken authentication to accommodate the example.

**Interfaces:** Consumes `ApiRoutes.challenge`, current canonical account session/recovery APIs and `RuntimeActionSchemas.submit`. Extract `publishAgent(input: AgentPublishInput): Promise<AgentPublishResult>` for testability, with distinct `accountAuthentication` and `scopedSigner` inputs. Define both input/result schemas in the example's adjacent `examples/agent-publish-config.ts` (Create); keys come from protected local configuration, never tool text/logs. Account authentication includes the required signing **and** encryption public keys.

- [ ] Write a regression asserting `expect(ChallengeRequestSchema.safeParse(exampleChallenge).success).toBe(true)`; run an integration case with different root/delegate signing keys and assert the resulting member remains the enrolled member, not a newly created delegate account. Revoke/pause/expire the native session and assert publication is denied; reject private payloads in this public JSON example.
- [ ] Run `npm test -- tests/agent-publish.test.ts` and `npm run test:integration -- tests/integration/agent-publish.test.ts`. Expect the current missing encryption key and/or root/delegate path to fail.
- [ ] Implement the supported complete sign-in and delegated submission flow; validate configuration and outputs, redact errors and avoid exposing seed/root keys. If authentication cannot safely use the delegate, authenticate the root separately rather than creating a delegate identity or widening its scope. Preserve expiry, nonce, DAO/deployment binding and guardian controls.
- [ ] Run those tests green plus `npm run typecheck` and the affected native submission/permission suite. Run the example from a temporary clean directory against disposable qualification fixtures; record the exact install/config commands without secret values.
- [ ] Commit owned files as `fix: qualify agent publishing with separate identity and delegate keys`. F4's evidence is a prerequisite for MCP signing, not MCP compatibility evidence itself.
