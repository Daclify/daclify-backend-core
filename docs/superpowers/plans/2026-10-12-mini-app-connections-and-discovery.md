# Mini-App Connections and Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` inline. No delegation. Track checkboxes in the master ledger.

**Goal:** Give builders/community administrators a self-service connection journey and give members a clear Mini apps destination and directory.

**Architecture:** Extend existing native app registration and DAO Connected apps UI. The API distributes public release-bound configuration and performs bounded diagnostics. A PostgreSQL directory is independent of native app authority and uses existing account/platform moderation controls.

**Tech Stack:** Core TypeScript/Fastify/PostgreSQL/public SDK; frontend Vue/Pinia/Vue Router; Vitest and Playwright.

**Spec:** [Design](../specs/2026-10-12-self-service-mini-apps-and-account-exit-design.md); [master](2026-10-12-self-service-mini-apps-and-account-exit.md).

## Global Constraints

Honor master constraints. No owner-issued setup secrets or packages. Exact approved HTTPS origins/callbacks and native permissions remain authoritative. Listing, login, recording, review and private access are separate. No arbitrary fetched JavaScript, HTML help or remote schema execution. Existing connected-app tokens retain their current semantics.

## Review Focus

1. An administrator copies another DAO's config — C1 binding/source tests.
2. A readiness URL targets localhost, metadata services or a DNS-rebound address — C1 SSRF tests.
3. Registration succeeds but no scoped native event can be confirmed — C2 distinguishes stages.
4. A public listing changes owner/origin or abuses untrusted text — C3 ownership/XSS/moderation tests.
5. A small-screen/keyboard user cannot understand or complete consent — C2/C3 browser tests.

### C1: Produce connection bundles, artifacts and bounded diagnostics

**Files (core):** Create `protocol/mini-apps.ts`, `services/api/src/mini-apps/connections.ts`, `services/api/src/mini-apps/routes.ts`, `tools/release/mini-app-starter.ts`, `tests/mini-app-connections.test.ts`, `tests/integration/mini-app-connections.test.ts`. Modify `protocol/index.ts`, `protocol/routes.ts`, `sdk/public-package.json`, `services/api/src/server.ts`, `tools/release/package.ts` and `docs/connected-community-apps.md`. Reuse `services/api/src/connected-apps/service.ts` and `services/api/src/connected-apps/chain.ts`; extract their shared registered-client lookup only where required.

**Interfaces:** `MiniAppConnectionSchema` contains `{version:1,binding:AppBinding,callbackUrl,releaseId,coreVersion,modulesVersion,manifestHash,starterUrl,diagnostics}`. `buildConnection(daoId: string, appId: string, accountId: string): Promise<MiniAppConnection>` validates account authority and registered config. `checkConnection(binding: AppBinding): Promise<ConnectionDiagnostics>` returns stage/status/redacted codes, not tokens. Proposed routes: `GET /v1/mini-apps/connections/:daoId/:appId`, `POST /v1/mini-apps/connections/:daoId/:appId/check`, `GET /v1/mini-apps/releases/:releaseId`. Produce `MiniAppsRoutes`, spread into producer `ApiRoutes`.

- [ ] Write tests asserting foreign/nonadmin config access is denied, bundle IDs match the registered app, a tampered manifest/starter hash is refused and installed dependencies match the selected release. Diagnostics must reject loopback/private/link-local IPv4/IPv6, DNS rebinding and redirects leaving the approved origin; abort after 5 seconds or 64 KiB. `expect(bundle.binding.daoId).toBe(registeredDaoId)` and `expect(bundle).not.toHaveProperty('signingKey')` pin the output boundary.
- [ ] Run `npm test -- tests/mini-app-connections.test.ts` and `npm run test:integration -- tests/integration/mini-app-connections.test.ts`; expect absent bundle/diagnostic behavior to fail.
- [ ] Implement config derived from registered native app plus selected API client/release, no hand-entered runtime/account copying. Build a pinned starter archive with manifest and hashes; serve through the existing public artifact boundary with immutable/cache-safe identifiers. Prefer public tarballs with integrity checks until a registry release actually exists. Probe only declared supported source/readiness endpoints; no arbitrary paths, ambient credentials or injected headers. Pin validated network addresses during the fetch, disable unsafe redirects and bound both successful/error bodies.
- [ ] Run tests green, `npm run typecheck` and release-artifact tests. Install the generated starter in a clean temporary directory using its README; `npm ci` must resolve its public dependencies without sibling checkouts or owner contact. Separate config-valid, identity-verified and event-confirmed diagnostics; network failure is not authorization failure.
- [ ] Commit owned files as `feat: provide release-bound mini-app connection bundles`. Record artifact retrieval/installation evidence. This builds distribution tooling; Q3 qualifies/publishes only after the appropriate instruction.

### C2: Add the global Mini apps page and guided connection flow

**Files (frontend):** Create `src/views/MiniApps.vue`, `src/components/MiniAppConnection.vue`, `tests/unit/mini-app-connection.test.ts`, `tests/e2e/mini-apps.spec.ts`. Modify `src/App.vue`, `src/main.ts`, `src/views/ConnectedApps.vue`, `src/help/catalog.ts`, `src/api/client.ts`, `tests/e2e/connected-apps.spec.ts`. Update only the frontend package/lock pins needed to consume C1's public artifacts.

**Interfaces:** New route `/mini-apps` and sidebar label `Mini apps`. Tabs/sections: Learn, Connect/build, Discover, AI connections. Consume `MiniAppsRoutes` and schemas from the public core package. `MiniAppConnection.vue` accepts `daoId: string` and `appId?: string`; registration/grant controls are extracted/reused from `ConnectedApps.vue`, with that existing DAO route preserved. No second registration mechanism.

- [ ] Write tests covering signed-out learning, choosing a DAO, administrator registration, member consent, downloaded config, correct callback, first confirmed receipt and revoke/renew. A nonadmin sees an explanation/action to contact their community administrator rather than an unauthorized submit button. `expect(page.getByRole('link', {name:'Mini apps', exact:true})).toBeVisible()` pins navigation.
- [ ] Run `npm test -- tests/unit/mini-app-connection.test.ts` and `npm run test:e2e:paid -- tests/e2e/mini-apps.spec.ts tests/e2e/connected-apps.spec.ts`; expect the missing global route/journey to fail. Use the paid native fixture, not a fabricated browser-only permission model.
- [ ] Implement short builder/member paths, release-aware help, copy/download JSON and distinct config/login/event states. Show concrete recoverable errors for callbacks, consent expiry, inactive membership, unavailable source and funded capacity. Root/delegate/key-envelope details belong in builder help; ordinary members see requested permissions and data sharing. Preserve exact-origin/PKCE behavior, selected DAO context and existing signed confirmations.
- [ ] Run tests green plus `npm run typecheck`, `npm run lint`, `npm run build`. Browser cases cover mobile width, keyboard/focus, cancellation before signing, expired consent, duplicate click and unavailable API. MCP controls link to implemented transport help or explicitly labelled planned availability until M4 passes.
- [ ] Commit owned files as `feat: add self-service Mini apps navigation and connection guide`. Record a complete fixture journey and UI screenshots as evidence, without production identifiers/secrets.

### C3: Add self-service listings and community moderation

**Files (core):** Create `services/api/src/mini-apps/directory.ts`, `tests/mini-app-directory.test.ts`, `tests/integration/mini-app-directory.test.ts` and the next unused migration `migrations/NNN_mini_app_directory.sql` (replace `NNN` in ledger with the reserved actual number before editing). Modify `protocol/mini-apps.ts`, `services/api/src/mini-apps/routes.ts`. **Frontend:** Create `src/components/MiniAppListingForm.vue`, `tests/e2e/mini-app-directory.spec.ts`; modify `src/views/MiniApps.vue`. **Docs:** Create `docs/guides/mini-app-directory.md`; update canonical help.

**Interfaces:** Producer `MiniAppListingSchema` fields: UUID `id`, HTTPS `origin`, title≤120 UTF-8 bytes, description≤2,000 bytes, optional documentation/source HTTPS URLs≤2,048 bytes, supported release IDs≤8, `status: 'unverified'|'published'|'hidden'`, timestamps. `DirectoryService.submit(accountId,input)`, `.verify(accountId,id)`, `.update(accountId,id,input)`, `.report(accountId,id,reason)`, `.moderate(actorAccountId,id,decision)` return schema-validated results. Proposed `/v1/mini-apps/directory` list/submit, `/:id` update, `/:id/verify`, `/:id/reports`, `/:id/moderate`; add exact method/input/output schemas in `MiniAppsRoutes` before clients use them.

- [ ] Add tests for signed-out bounded browsing; owner-only updates/transfer; challenge-bound proof at the listing HTTPS origin; duplicate/expired proof; plain-text rendering; throttled submissions/reports; account erasure removing unnecessary maintainer data; existing governed moderator authorization. Listing a tool must never create a native app/grant. `expect(nativeAppCountAfterListing).toBe(nativeAppCountBeforeListing)` pins separation.
- [ ] Run `npm test -- tests/mini-app-directory.test.ts`, `npm run test:integration -- tests/integration/mini-app-directory.test.ts` and frontend `npm run test:e2e:paid -- tests/e2e/mini-app-directory.spec.ts`; expect missing directory/ownership controls to fail.
- [ ] Implement recommended policy: publish after authenticated maintainer and origin verification, allow bounded community reports and authorized moderation, provide owner-controlled update/withdrawal and verified transfer. Reuse C1 network safety. Store proofs/report data with explicit expiry; index only pagination/status/origin ownership paths. No founder approval queue, app ratings, financial permissions or arbitrary remote assets/scripts. A missing governed moderation role keeps publication disabled until that policy is configured.
- [ ] Run tests green, core/frontend typechecks and migration upgrade/restore tests. Exercise X2 erasure integration: remove/hide orphaned listings unless a verified successor owns them; retain only justified moderation evidence with expiry. Browser tests distinguish advertised capability, maintainer verification and actual DAO permission.
- [ ] Commit each repository's owned files as `feat: add community mini-app listings and moderation`. Record the chosen role policy, retention configuration and the public “maintainer verified” wording. No “Daclify certified” claim.
