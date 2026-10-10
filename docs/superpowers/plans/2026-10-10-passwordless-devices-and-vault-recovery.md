# Passwordless devices and vault recovery implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Execution and review remain inline; the workspace forbids delegation. The user approved the linked design and said to implement it on 2026-10-10. Continue through the tasks without another plan-approval checkpoint.

**Goal:** Let users choose which paired credentials restore the original vault on new devices without a JSON kit or vault password, with accurate custody disclosure and independent encrypted backups.

**Architecture:** Core owns bounded versioned recovery records, explicit method permissions, one-time fresh-login grants and encrypted device-transfer transport. Browser clients encrypt, unlock and verify original keys; OpenBao protects optional assisted backup keys and private off-host metadata. Existing login JSON remains compatible: a separate expiring recovery grant is delivered through a response header or fresh OIDC callback cookie.

**Tech stack:** Existing strict TypeScript, Zod, PostgreSQL, Vue, Web Crypto, WharfKit, OpenBao transit, Pinata, Vitest and Playwright. No new cryptographic library is needed.

**Spec:** ../specs/2026-10-10-passwordless-devices-and-vault-recovery.md

## Global constraints

- Every paired sign-in method opens the same account; full-key access is separately selected per method.
- Full access restores both original private keys without requesting a kit, vault password, second credential or original device.
- Assisted recovery is off by default and requires explicit consent, fresh existing-key control and permitted DAO custody policy.
- Never send private wallet recovery signatures, PRF outputs or plaintext vault keys in normal API payloads or logs.
- Preserve existing kits, accounts, service IDs, memberships, permissions and contract keys. No production deployment or blockchain authority change is included.
- Enable a mechanism only with its recorded compatibility and independent backup prerequisites; absent configuration fails closed with a useful explanation.
- Work on dev, preserve unrelated changes, publish producer-owned protocol artifacts before frontend consumption, and record evidence honestly.

## Review focus

- A stolen old session cannot claim a login grant or enroll its own recovery method; tests belong to tasks 2 and 4.
- A removed or replaced credential cannot recover through a retained grant; test against current credential ownership in task 2.
- Native key rotation or varying signatures cannot be mistaken for successful original-key recovery; tests belong to tasks 3 and 5.
- Account/network changes during prompts leave no foreign keys or stale unlocked state; tests belong to tasks 3 and 5.
- A surviving blob with missing lookup, revoked methods or unavailable custody/storage must produce an honest recovery failure; restore and outage tests belong to tasks 4 and 6.

## Implementation decisions

- Public recovery API/schema names live in protocol/recovery.ts and join ApiRoutes through RecoveryRoutes. Authentication session JSON does not gain unconditional fields.
- Each method stores an independently encrypted copy of the same original vault payload and its own randomly generated backup key. This avoids requiring every other credential's secret when enrolling or replacing one method. All copies verify the same original signing/encryption identity. This is a storage refinement of the approved wrapping design; the payload is only a few kilobytes.
- Recovery grants are random 32-byte capabilities, stored only as hashes, bound to a freshly created session, its credential, account, frontend origin and a five-minute expiry. Claim consumes them once transactionally and rechecks current ownership and method permission.
- Recovery settings mutations use the existing account-control proof preHandler, binding consent to the exact body and session. Method enrollment additionally needs incoming secret-based encryption or a qualified assisted ceremony.
- OpenBao-assisted enrollment uses a transient P-256 encrypted key handoff; no ordinary request contains a plaintext backup key. The custody provider stores a wrap binding account, method and backup revision. The browser receives recovery material wrapped to its fresh P-256 public key.
- Private recovery metadata and service database snapshots are encrypted before off-host publication. A pathname/configuration flag is not evidence of independence: acceptance needs a retained restore qualification record.
- Preserve the existing account custody enum for key-operation compatibility. Expose recovery authority separately and enforce private-DAO policy before assisted enrollment; accurately disclose assisted authority in account/profile/join flows.

## Task 1: Canonical bounded records and client cryptography

**Files:** Create protocol/recovery.ts; modify protocol/index.ts, protocol/routes.ts, protocol/sign-in.ts; create shared sdk/recovery.ts; add core tests/recovery-schema.test.ts and tests/recovery-crypto.test.ts. Frontend imports the producer-owned SDK rather than duplicating its cryptography.

**Interfaces:** RecoveryMethodSchema identifies existing credential keys and recovery mode. RecoveryBackupSchema carries version, backup ID, original public identity, method/context and bounded AES-GCM payload/key wrap. RecoveryRoutes owns settings, enrollment, disable, claim and device-transfer schemas. Browser createRecoveryBackup(secrets, identity, method, unlockMaterial) and openRecoveryBackup(record, unlockMaterial) use purpose-separated HKDF/AES-GCM; sealRecoveryDelivery/openRecoveryDelivery use existing P-256 grant primitives for backup-key transport.

- [ ] Write failing schema and cryptographic round-trip tests asserting both original keys, fresh salts/nonces, ciphertext-only exports and rejection of wrong secret, swapped account/method/context, malformed sizes and mismatched public keys.
- [ ] Run targeted tests and record the expected missing-feature failures.
- [x] Implement canonical records and minimal Web Crypto helpers; keep recovery secrets in browser memory.
- [x] Run targeted tests, protocol typecheck and frontend typecheck against the new artifact.
- [x] Commit the tested interfaces and helpers.

## Task 2: Preserving database state and fresh-login claims

**Files:** Create migrations/033_vault_recovery.sql, services/api/src/auth/recovery.ts, services/api/src/auth/recovery-routes.ts; modify server.ts, existing sessionCookie callback users, intent.ts and tools/recovery/revoke-restored-sessions.sql; create tests/integration/vault-recovery.test.ts.

**Interfaces:** RecoveryService.methods(account), enroll(account,input), disable(account,input), issueLoginGrant(sessionToken,origin), validateLoginGrant(sessionToken,grant) and claim(account,sessionToken,input) return producer-owned records. createServer accepts optional recovery dependencies. A login response may expose x-daclify-recovery-grant; only a fresh verified OIDC callback may create its pending grant cookie.

- [ ] Add failing real-PostgreSQL tests for default-disabled pairings, exact-body consent, old-session denial, fresh-login one-time claim, expiry/concurrent use, cross-account/origin rejection and unlink/replacement after grant issuance.
- [ ] Run in a new owned loopback database ending _test; establish the expected failures without touching testnet data.
- [x] Implement migration constraints, bounded method list/lookup, transactional claims and credential-currentness checks; issue grants only after actual login proof verification.
- [x] Verify migration preservation/repeated application, existing paired-login tests and the new adversarial suite.
- [x] Commit the database/API behavior.

## Task 3: Wallet and passkey unlocking mechanisms

**Files:** Modify frontend src/auth/telos-zero.ts, telos-evm.ts, webauthn.ts; create src/auth/fast-sign-in.ts; extend wallet/WebAuthn unit tests and real-client probe tooling.

**Interfaces:** recoveryUnlockMaterial(method,descriptor) returns client-only bytes. Native recovery signing uses an exact fixed expired/nonbroadcastable transaction and validates signed bytes against the request. EVM uses a dedicated purpose-labelled off-chain message. Passkey extraction validates PRF output and never includes it in assertionProof.

- [ ] Add failing tests for changing transaction headers, signature/message normalization, wrong wallet/chain, cancellation, replay-context changes, unsupported PRF and accidental secret serialization.
- [ ] Run tests to confirm the missing paths fail.
- [x] Implement dedicated signing paths and PRF extraction. Require reproducible enrollment and original-key round trips; retain explicit operator/client support gates.
- [x] Run wallet/WebAuthn/crypto unit tests. Prepare actual-client probes that report compatibility without printing signatures or keys; report real-client checks separately from mocks.
- [x] Commit supported mechanisms and honest unavailable states.

## Task 4: Assisted key handoff and independent encrypted persistence

**Files:** Create services/api/src/auth/recovery-config.ts and services/api/src/auth/recovery-storage.ts; reuse services/custody/openbao.ts and content/pinata.ts; modify main.ts; add tests/recovery-config.test.ts, tests/recovery-storage.test.ts and assisted integration cases.

**Interfaces:** RecoveryKeyProvider wraps/unwraps purpose-bound backup keys via OpenBao. RecoveryBackupStore persists and retrieves bounded encrypted snapshots with verified commitments. readRecoveryConfiguration(env) requires explicit endpoint/scope and current qualification evidence; it returns unavailable reasons for missing prerequisites.

- [ ] Write failing tests for encrypted browser-to-service enrollment, browser-only key delivery, substituted recipient/identity, unavailable/unsealed custody, failed or tampered off-host copies, missing consent and strict-private DAO policy.
- [ ] Run tests and identify intended failures.
- [x] Implement P-256 enrollment handoff, OpenBao key wrapping, encrypted metadata persistence and explicit per-method assisted consent; fail closed rather than issue local-only success receipts.
- [ ] Run crypto/provider-boundary tests and real PostgreSQL full-access tests for paired email, Telegram and other verified supported providers.
- [x] Commit assisted recovery with unconfigured deployments visibly unavailable.

## Task 5: Account choices and passwordless new-device flow

**Files:** Create frontend src/components/FastSignInMethods.vue; modify SignInMethods.vue, views/Account.vue, auth/session.ts, api/client.ts and associated account tests.

**Interfaces:** UI consumes RecoveryRoutes and displays sign-in-only versus full-access state, custody description, enrollment and disable actions. restoreFastSignIn(account) consumes the fresh grant, unlocks/validates the original vault and installs only in-memory secrets; selected paired credentials can repeat this on subsequent devices. Persistent storage retains only encrypted recovery records.

- [ ] Add failing browser tests for choosing an eligible paired method, explicit assisted consent, full-access versus login-only entry, same account/both keys, no JSON/password prompt, account-wide assisted disclosure and failed unlock without vault mutation.
- [ ] Run browser cases to establish failures.
- [x] Implement accessible settings and all login completion hooks, context guards and honest storage/custody outage behavior. Preserve legacy password/kit fallback separately.
- [ ] Run frontend verification and selected desktop/mobile browser journeys, including historical private-document access and wrong-key denial.
- [x] Commit the complete user flow and documentation copy.

## Task 6: Encrypted existing-device approval and disaster restore

**Files:** Extend protocol/recovery.ts and recovery-routes/service; add frontend src/components/DeviceApproval.vue; add tests/integration/device-recovery.test.ts and tests/e2e/device-recovery.spec.ts; create ops/recovery/ deployment/backup/restore files and operational tests.

**Interfaces:** Device request binds a transient receiving P-256 public key, fingerprint, opaque request ID, separate polling secret, origin and five-minute expiry. Approval uses fresh current-key consent; the service forwards bounded ciphertext once. Operator tooling encrypts snapshots with separately retained recovery material and restores on disposable infrastructure before producing qualification evidence.

- [ ] Add failing tests for end-to-end key transfer, QR fingerprint substitution, expiry/replay/cross-account attacks, cancelled requests and stale restored credential history.
- [ ] Run intended failures.
- [x] Implement client encryption, bounded server transport and accessible approval/verification UI. Prepare a separately hosted OpenBao runbook/configuration and encrypted off-host snapshot/restore tooling.
- [x] Verify two fresh browser contexts and a source-host-loss simulation using owned disposable services. Actual independent-host credentials and real-client qualification remain required before enabling hosted features.
- [x] Commit transfer and restore tooling/evidence.

## Task 7: Compatibility, complete verification and delivery

Implementation and local/public-testnet evidence: [verification report](../../evidence/2026-10-10-passwordless-recovery.md). All implemented packages were reviewed inline; actual independent-host and hardware-client qualification remains pending with hosted modes disabled.

**Files:** Canonical guides/generated docs, CHANGELOGs, protocol artifacts/consumer pins, docs/evidence/2026-10-10-passwordless-recovery.md and this execution ledger.

- [x] Update producer references and practical enrollment/recovery/permission/security guides; publish pinned compatible artifacts and preserve legacy decoding fixtures.
- [ ] Run core/frontend verify, required PostgreSQL recovery/upgrade/provider tests, focused browser/accessibility journeys and security review of the final diff.
- [x] Record actual passed/failed/skipped/unrun qualification separately. Resolve important review findings with regression tests.
- [x] Commit/push dev and deliver verified testnet source/client changes within existing authorization. Do not activate assisted custody, qualified-wallet claims or independent-backup guarantees without their actual prerequisites.
- [ ] If external prerequisites are missing, provide the concrete setup artifacts and request only the access needed to qualify/activate them; continue all independent implementation first.

## Execution ledger

- Plan established after the user's approval; existing dev worktrees were clean. No delegation is authorized.
- Ruling: keep login-session JSON compatible and carry recovery grants separately — old pinned clients parse strict session schemas — unconditional extra JSON fields would break existing logins.
- Ruling: independent encrypted payload per recovery method — enrollment can operate with the unlocked original vault without prompting every other credential — a few kilobytes of duplicate ciphertext are preferable to retaining a global plaintext backup key.
- Observed prerequisite: the current testnet env has Pinata configuration but no recovery custody configuration. No secrets were printed. Asked whether to prepare an OpenBao setup while independent implementation continues.

Final review: permanent consent precedes DEK delivery; restored methods remain quarantined; foreign local kits remain separate; PRF is requested at registration and accepts BufferSource. Actual-client probes are manual disposable staging journeys described in the OpenBao runbook; no client report is fabricated to bypass production gates.

Delivery completed: core `2225411`, modules `eb9b7a4` and frontend `f015f75` were committed and pushed to `dev`; testnet build/restart and actual public device-transfer browser/API checks passed. Frontend concurrent contract-diagram changes remain unstaged and preserved. Historical RED checklist items retain their original evidence status; implemented mechanisms and current verification are recorded in the verification report. Hosted activation waits for actual separate-host/off-site/client evidence, with the concrete OpenBao setup ready.
