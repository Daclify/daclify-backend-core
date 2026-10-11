# Two-path account entry implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Sub-agent delegation is unauthorized. The user approved implementation on 2026-10-11; proceed through the tasks without further checkpoints.

**Goal:** Deliver explicit Telegram/email signup with original-key assisted recovery, preserve user-controlled vault signup, and allow account-wide assisted-recovery opt-out.

**Architecture:** Core owns browser-bound provider verification, pending signup ceremonies and atomic credential/recovery activation. Frontend generates the original keys, encrypts the backup and verifies recovery before navigation. Reuse existing recovery storage, key service, account-control authorization and provider verifiers.

**Tech Stack:** Existing strict TypeScript, PostgreSQL, Fastify, Vue 3, Web Crypto and producer-owned protocol/SDK. No new dependency or contract change.

**Spec:** [Approved design](../specs/2026-10-11-two-path-account-entry-design.md).

## Global constraints

- Live assisted signup requires current independent-storage/key-service qualification and a configured login provider.
- Existing accounts never acquire assisted recovery merely by using a signup button.
- Signup completion requires verified original signing and encryption keys and retrievable encrypted backup bytes.
- Preserve existing kits, account/DAO identity, strict DAO privacy policy and permanent assisted-authority history.
- Keep plaintext keys out of ordinary persistence, responses and logs; preserve any other account's local vault.
- Work inline on `dev`, preserving the pre-existing connected-app changes. Snapshot touched source before editing and stage only this task's changes.

## Review focus

- OIDC redirects must not require saving new plaintext keys across navigation: verify the provider before generating keys.
- Interrupted setup and repeated completion must preserve one usable credential ownership and never expose a ready session prematurely.
- A public-key login cannot bypass pending assisted signup or erase its authority history.
- Expired qualification, replay, another browser and another account must fail before key delivery.
- Opt-out racing a recovery claim or enrollment must leave no usable assisted grant; fallback failures must preserve access.

### Task 1: Canonical ceremonies and persistence

**Files:** Create `protocol/signup.ts`, `migrations/036_quick_signup.sql`, `tests/signup-schema.test.ts`. Modify `protocol/index.ts`, `protocol/routes.ts`, `protocol/recovery.ts`, `protocol/sign-in.ts`, `protocol/service-api.ts`.

**Interfaces:** Export `SignupRoutes`, `SignupMessageSchema`, `SignupVerificationSchema` and account-wide `RecoveryRoutes.recoveryOptOut`. Signup verification returns an existing session or a five-minute browser-bound pending ticket. Prepare binds the ticket to new public keys; authorization signs a purpose-separated message before a recovery recipient is returned; finish supplies encrypted backup/grant material. Opt-out accepts an optional encrypted `RecoveryKit` fallback, never a password.

- [x] Write schema tests rejecting unknown fields, false consent, malformed public keys, oversized encrypted data and a login message reused as signup authorization; watch them fail.
- [x] Implement strict producer schemas, five-minute ceremonies, bounded database fields/indexes and OIDC signup purpose migration.
- [x] Run `npm test -- tests/signup-schema.test.ts tests/recovery-schema.test.ts`; require all passing. Record preserving migration acceptance in Task 2.

### Task 2: Verified provider signup and original-key activation

**Files:** Create `services/api/src/auth/signup.ts`, `services/api/src/auth/signup-routes.ts`, `tests/integration/quick-signup.test.ts`. Modify `auth/email.ts`, `auth/linking.ts`, `auth/telegram-oidc.ts`, `auth.ts`, `auth/account-session.ts`, `server.ts`.

**Interfaces:** `SignupService` uses `Pool`, the existing `RecoveryConfiguration`, frontend origin and API audience. Provider routes call its browser-bound verification, prepare, authorize and finish methods. Email signup has its own code purpose; OIDC preserves the signup intent/destination. Sessions remain unavailable for staged accounts until activation.

- [x] Write actual PostgreSQL/API tests for new email/Telegram signup, paired-account reuse, rejected session-only creation, browser/purpose/replay substitution, storage failure/retry, concurrent credential ownership and pending-account login denial; watch the new behavior fail.
- [x] Reuse real code/proof verification and encrypted recovery primitives. Commit authority history before unlocking material can be delivered. Validate both original keys, persist/read verified backup bytes, then activate credential/recovery/session atomically.
- [x] Add bounded expiry cleanup without erasing assisted authority history; retry a completed attempt only within its original browser/purpose/expiry binding.
- [x] Run `npm run test:integration -- tests/integration/quick-signup.test.ts tests/integration/sign-in-methods.test.ts tests/integration/vault-recovery.test.ts` against an owned loopback `_test` database. Require all passing; provider fixtures do not qualify live transport.

### Task 3: Account-wide assisted recovery opt-out

**Files:** Modify `services/api/src/auth/recovery.ts`, `auth/recovery-routes.ts`, `tests/integration/vault-recovery.test.ts`.

**Interfaces:** Recovery methods expose current assisted authority (including paused/pending setup) and the consent revision shown before the user opts in. `RecoveryService.optOut(account, input)` returns `RecoveryMethods`. It uses existing account-control authorization, retains all client-protected methods, credential pairings and assisted history, and requires a matching encrypted-kit fallback when no independent enrolled route remains.

- [x] Write tests for all-assisted-route removal, preserving client wraps/login credentials, missing/wrong-account fallback refusal, pre-change grants/handoffs, concurrent claim/enrollment and retained history; watch them fail.
- [x] Serialize opt-out, enrollment and claim on the account lock; remove assisted methods and pending assisted grants/handoffs atomically. Preserve independent methods and current identity.
- [x] Run the recovery integration suite and verify cancellation/failed fallback changes nothing.

### Task 4: Frontend quick signup and vault choice

**Files:** Create `src/components/QuickSignup.vue`, `src/auth/signup.ts`, `tests/e2e/quick-signup.spec.ts` in frontend. Modify `Account.vue`, `auth/vault.ts`, `auth/session.ts`, `api/client.ts` and affected account-entry tests.

**Interfaces:** Vault helpers generate secrets without a password and create encrypted kits from existing secrets. Signup helper consumes producer ceremonies and installs only identity-verified keys. `QuickSignup` emits authenticated account and busy state; Account preserves destination and the existing vault path.

- [x] Write browser tests for both providers, signup consent/decline, existing account reuse, OIDC resumption, recovery outage and another saved vault; write vault tests for same-key kit creation; watch them fail.
- [x] Generate keys after verification, keep them in memory, sign the exact validated signup message and use encrypted recovery delivery. Restore both keys before reporting success. Keep incomplete setup retryable and explain expired attempts.
- [x] Present the two clear signup choices with accessible email-code/pending/error controls and shared busy state.
- [x] Run focused browser/unit tests, strict Vue/TypeScript checks and the production build.

### Task 5: Frontend opt-out with verified fallback

**Files:** Create `src/components/AssistedRecoveryOptOut.vue`, `tests/e2e/assisted-recovery-opt-out.spec.ts`. Modify `Account.vue`, `auth/vault.ts`, `api/client.ts` and recovery tests.

**Interfaces:** The opt-out component reads `RecoveryMethods`, verifies a new same-key kit locally with both unlock credentials, obtains download/save acknowledgment and sends account-control-authorized opt-out. It emits updated recovery methods without replacing another account's local vault.

- [x] Write tests for cancel, wrong/tampered kit, successful same-key fallback, all-assisted methods being off, retained login and authority-history disclosure; watch them fail.
- [x] Add **Turn off Daclify-assisted recovery** under Access & recovery. Preserve enrollment until fallback verification and server opt-out succeed. Show current off state and permanent history distinctly.
- [x] Run browser/accessibility tests and the affected recovery/vault unit suites.

### Task 6: Producer artifacts, documentation and delivery

**Files:** Update the account/recovery guides, producer generated references, versioned package artifacts/pins and consumer lockfiles. Add `docs/evidence/2026-10-11-two-path-account-entry.md`.

- [x] Build a new development protocol artifact with an explicit version; do not replace an immutable published release or duplicate producer schemas in frontend. Preserve concurrent connected-app support in the final consumer combination.
- [x] Run relevant schema/provider/database/browser suites, core/frontend unit suites, lint/types/generated docs and frontend build; report unrelated baseline failures separately.
- [x] Review all changes inline against the spec and security boundaries. Record actual checks and held live-provider/independent-restore qualification.
- [x] Commit only this task's changes on `dev` and push `dev`. Do not deploy services, enable recovery, publish packages or change chain authority.

## Execution record

Implementation started 2026-10-11. Current connected-app work is outside this task and must survive unchanged. Detailed commands/results and rulings are recorded in this plan's ignored execution workspace and the final evidence document.
