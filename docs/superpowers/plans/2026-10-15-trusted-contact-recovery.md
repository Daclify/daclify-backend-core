# Trusted-contact Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Work inline; delegation is prohibited. The user approved the design and requested implementation; preserve the existing continuous-execution authorization.

**Goal:** Recover enrolled Daclify memberships with two of three accepted contacts after 48 hours, and recover only the permitted DAO document keys.

**Architecture:** DAO-scoped contract records hold contact policies, bounded pending requests and finalized recovery certificates. Store bounded client-encrypted document packets on-chain, giving contacts portable retrieval without the application database or operator key service. Reuse existing K1 instructions, P-256 encrypted delivery, normal login challenges, Vue account controls and generated public SDKs.

**Tech Stack:** Pinned Antelope CDT 4.1.1 with `-O=s`, strict TypeScript, WebCrypto, `shamir-secret-sharing` 0.0.4, PostgreSQL, Fastify, Vue 3, Vitest/VERT/native tests and Playwright.

**Spec:** [Approved design](../specs/2026-10-15-trusted-contact-recovery-design.md).

## Global Constraints

Execution ruling: keep the existing kit format and add on-chain encrypted `recgrants` instead of a vault-secret extension. Add durable `recretired` evidence and service-session/login checks to prevent stale database resurrection. Native measurement exposed the 1 MiB Spring decoder limit; the current runtime uses pinned Binaryen 108 after CDT `-O=s`, with complete affected behavior checks. Historical fixtures are unchanged. A global `recroots` row with immutable origin key links successive replacements; `recretired` rows and migration 056 service bindings preserve one account across partial DAO recoveries and stale snapshots. The receiving device exports a versioned pending-backup wrapper and never creates a service profile before claim.

- Exactly three distinct contacts, any two approving, and a 48-hour wait beginning at the second approval.
- Existing DAOs/users remain default-off; no production deployment or live authority changes.
- Contact document packets never contain the shared personal decryption private key or a signing private key.
- Respect each DAO's document-recovery policy and preserve membership, rights, accounting and native recovery/upgrade checks.
- Use canonical producer-owned public schemas and pinned public artifacts across repositories.
- No custom secret-sharing algorithm, plaintext secret persistence, unbounded rows/scans, or messages to real contacts.

## Review Focus

Final implementation ruling: contact changes require the original root signing key through `submit`; `submitnat`/`submitevm` reject `setcontacts`. A DAO can supply a wallet binding during membership enrollment, so that binding alone must never authorize global service-account recovery. Bound wallets still cancel pending requests. Contact encryption coordinates require canonical encodings to prevent aliases.

- A stranger must not occupy a victim's only pending recovery slot: require a fresh replacement-key proof plus one accepted contact's approval to create the on-chain request (Task 2).
- Two aliases for the same signing/encryption identity must not satisfy the quorum (Tasks 1–2).
- A last native executive cannot be removed in a way that strands native governance: completion preserves existing checks and supports incoming native consent, otherwise fails honestly (Tasks 2, 5).
- A shared original personal key must not leak another DAO's history through a backup or automatic regrant after recovery (Tasks 1, 2, 5).
- A restored/stale application database must not resurrect old signing sessions or reinterpret an obsolete completion as current control (Tasks 3, 6).

## Engineering choices

- Recovery is enrolled per membership/deployment; one UI can reuse the same three contact identities across memberships. No promise of atomic recovery across deployments.
- A request lasts seven days. The second approval is rejected if fewer than 48 hours remain. One pending request per member; the policy retains a monotonic request counter after bounded cleanup.
- Public contact proofs use a generated `contact_proof` C++ struct containing action, chain/runtime, DAO/member, policy revision, request ID, contact index, data commitment and expiry. `contactRecoveryDigest` encodes this exact ABI structure.
- Document packets contain at most 64 eligible epoch secrets each, a fresh AES-GCM payload and three encrypted Shamir shares. Packets are at most 16 KiB; use a bounded per-member chunk number and paginated reads, never a whole-history action. Contacts acknowledge the exact packet commitment before readiness is reported.
- Ciphertext lives on-chain for operator-independent discovery/retention. The UI also exports portable encrypted packets and encrypted share deliveries. RAM costs and chain availability are disclosed; no new hosted provider is needed.
- Document shares are delivered to the completed recovery's receiving P-256 public key as portable encrypted files. This avoids adding a second mutable relay/mailbox service. Neither the contract nor the API sees a plaintext share.
- Keep original grant rows. Recovered epoch keys are rewrapped to the replacement personal public key in on-chain `recgrants` and used through the shared content-key resolver. Future identity/grant changes are explicit and preserve DAO history rules.

### Task 1: Public recovery types and cryptography

**Files:** Create `protocol/contact-recovery.ts`, `sdk/contact-recovery.ts`, `tests/contact-recovery-crypto.test.ts`; modify public exports, package manifests/lockfile and public-package dependency allowlist.

**Interfaces:** Produce `ContactRecoveryTargetSchema`, `ContactIdentitySchema`, `ContactDocumentPacketSchema`, `ContactDocumentShareSchema`, `ContactRecoveryRoutes`, their inferred types, `createContactDocumentPacket(context, epochs, contacts)`, `openContactDocumentShare(packet, index, privateKey)`, `recoverContactDocumentPacket(packet, shares)`, and encrypted share-delivery helpers. All incoming values are schema-validated; only eligible DAO epoch secrets enter packet creation.

- [x] Write crypto/schema tests: every pair of three restores the same epochs; one share, duplicate contact/share, corrupt ciphertext, wrong DAO/revision and mismatched epoch commitments fail; serialized packets contain neither signing nor personal decryption private keys.
- [x] Run `npm test -- tests/contact-recovery-crypto.test.ts`; observe missing implementation fail.
- [x] Pin/review the audited sharing package, implement schemas and WebCrypto helpers, preserving the existing fixed-size recovery-key-delivery interface.
- [x] Run the focused tests and `npm run typecheck`; commit the working public interfaces.

### Task 2: Authoritative membership recovery and DAO policy

**Files:** Create `contracts/common/contact_recovery.hpp`, `contracts/runtime/contact_recovery.inc`, `tests/contact-recovery-contract.test.ts`, `tests/native/contact-recovery.test.ts`; modify runtime dispatch/credential/doc-grant checks, RAM ownership/family lists, context permissions and affected fixture expectations. Regenerate ABI/schema/release pins.

**Interfaces:** Produce `setcontacts`, `acceptcont`, `startrecover`, `approverec`, `finishrec`, `cancelrec`, `prunerec`, `setrecpolicy`, `putrecpack`, `ackrecpack` actions; DAO-scoped `reccontacts`, `recrequests`, `recresults`, `recdocpkts`; global per-DAO `recdocpols`. Produce generated `contact_proof`, `contact_request`, action and table types. `contactRecoveryDigest(proof)` and `contactRequestCommitment(request)` match C++ `pack`/SHA-256.

- [x] Add contract tests for owner-only enrollment, three distinct contacts, acceptance, signed first-contact creation, duplicate/stale/wrong-domain approvals, 48-hour boundary, expiry/cancellation races, new-key possession and monotonic cleanup.
- [x] Run against current WASM and observe missing action failures.
- [x] Implement bounded records/actions and generated digest helpers. Preserve member IDs/roles/balances, invalidate old credential epochs, reconcile native/EVM bindings and reject last-controller lockout. Keep recovery completion certificates current and scope-bound.
- [x] Add default-off DAO document policy and contact-acknowledged encrypted packets; reject forbidden enrollment, wrong revisions/commitments, unsupported payload sizes and automatic history expansion.
- [x] Build with pinned CDT `-O=s`, regenerate types/pins and run focused VERT plus actual native tests, including native-controller rollback and unchanged rights. Record WASM/RAM/action CPU; commit.

### Task 3: Chain reads, public proof submission and service-account claim

**Files:** Create `services/api/src/auth/contact-recovery.ts`, `services/api/src/auth/contact-recovery-routes.ts`, `tests/integration/contact-recovery.test.ts`; modify chain gateway/native implementation, server registration, canonical routes and restore/quarantine handling as required.

**Interfaces:** Consume generated actions/tables and public target/route schemas. Produce `ChainGateway.contactRecovery(target, after?)`, `submitContactRecovery(input)` and public routes for bounded state, signed action submission and completed recovery claim. Claim consumes an existing fresh origin/audience-bound login challenge and a current on-chain completion certificate, then returns the existing normal login response.

- [x] Test unknown/unsupported deployments, rate/origin rejection, forged proof, changed completion/current key, replayed challenge, conflicting service identity, stale restored sessions and database-loss recovery.
- [x] Observe tests fail before adding endpoints.
- [x] Implement read/submit capability checks, strict action allowlist, verified chain writes and atomic old-key replacement/session revocation/quarantine before normal challenge authentication. Never merge by email or service UUID supplied by a client.
- [x] Run focused integration and existing auth/recovery tests; commit.

### Task 4: Persist recovered DAO epoch keys safely

**Files:** Add `recgrants` in the contract and its public grant lookup; modify frontend `src/auth/session.ts` and content-key callers; create frontend kit compatibility and document-key tests.

**Interfaces:** Keep the existing vault/kit format. Persist recovered epochs as additional per-request encrypted on-chain grants, retaining original rows. Produce one shared `documentEpochKey(dao, epoch, commitment)` resolver that checks the exact DAO and epoch commitment before using a recovered key or original member grant.

- [x] Test old-kit imports, new exports, wrong DAO/epoch/commitment, lock/account switching and recovered document access without the original personal decryption key.
- [x] Observe failures, implement additional encrypted grants and wire every document reader/writer through the shared resolver.
- [x] Run core/frontend affected unit tests and strict type/Vue checks; commit.

### Task 5: Recovery and DAO settings UI

**Files:** Create frontend `src/components/ContactRecovery.vue`, `src/auth/contact-recovery.ts`, relevant unit/e2e tests; modify `src/views/Account.vue`, `src/components/ContentPanel.vue`, API client and existing DAO settings/access planner.

**Interfaces:** Consume only the pinned public protocol/SDK artifacts and existing unlocked-vault/action-signing helpers. Render contact enrollment/acceptance, per-membership status, replacement-device fingerprint, approvals/countdown/cancel/complete, per-DAO packet creation/acknowledgment, portable encrypted share exchange and document restore.

- [x] Add browser tests for enrollment, two-contact recovery, cancellation, unsupported deployment, allowed/forbidden DAO packets and partial historical coverage.
- [x] Observe missing UI behavior, implement using existing components and explicit account/context checks; keep replacement secrets encrypted locally and do not create a service profile before claim.
- [x] Implement fresh native-wallet consent where needed; surface last-controller failures without marking recovery complete. Preserve strict privacy by preventing automatic grant expansion after social recovery.
- [x] Run browser flows, accessibility checks and `npm run typecheck`; commit.

### Task 6: Compatibility, qualification and delivery

**Files:** Update generated/reference docs, `docs/disaster-recovery.md`, product help, supported-release fixtures/manifests and `docs/evidence/2026-10-15-trusted-contact-recovery.md`.

- [ ] Release qualification: join the individually passing native, API/PostgreSQL and browser flows into one original-database-loss drill. This combined drill was not run; no production qualification is claimed.
- [x] Run migration/old-kit/old-contract support tests, affected auth/content/governance/native permissions and cross-repository checks. Record passed, failed and unrun provider/client checks separately.
- [x] Review complete changes inline against the design and Review Focus; fix material defects with regressions. Verify no real-contact messages, production actions or plaintext-secret logs.
- [x] Regenerate development package/release pins and docs, commit and push `dev` in affected repositories. Report implementation, evidence and actual remaining qualification limits; do not deploy.

## Implementation result

Implemented and verified on development branches. The final security review added original-root enrollment proof, canonical encryption-coordinate validation, retired-key enrollment rejection, and completed ordinary-kit resume after service database loss. Final counts, measurements and the remaining release gates are recorded in [development evidence](../../evidence/2026-10-15-trusted-contact-recovery.md). Implementation commits consolidate the six tasks in each repository; no package publication or production deployment is authorized.
