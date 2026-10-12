# Account access and DAO continuity implementation plan

**Goal:** One account and one recovery experience across paired sign-ins, Create/Join, and private DAO membership.

**Architecture:** Preserve registered identities and reconcile only a proved wallet-only profile into the registered account. Keep immutable historical ownership through a verified account relationship. Reuse the existing client vault and per-DAO encrypted grants.

**Spec:** [Account access design](../specs/2026-10-12-account-access-continuity-design.md).

**Execution:** Inline, continuous implementation; no delegation or per-task approval. The user reviews the completed code. No live account changes or contract deployment are authorized by this plan.

## Ledger

- [x] Recovery collision: explicit continuation using the recovered account; retain cancellation and stale-context guards.
- [x] Dual-proof reconciliation: transaction, historical ownership, revoked stale access, typed public interface, adversarial database tests.
- [x] Frontend recovery/reconciliation: one account flow, exact consent, error/pending/cancel handling, mobile and desktop tests.
- [x] Create/Join full-access setup: shared recovery controls, no duplicate identity, destination preservation.
- [x] Private DAO grants and continuity: permitted member access preparation and honest successor readiness checks.
- [x] Review, generated/user documentation, relevant verification, commits, push, and authorized testnet publication.

## Review focus

1. A signed-in account changes while key recovery or reconnection is pending: do not install keys or overwrite the new account's CSRF state.
2. Same DAO, different members: reject reconciliation rather than combining votes or rights.
3. Immutable records refer to the retired account: retain hashes/metadata and enforce equivalent ownership without changing the record.
4. A paired method has sign-in access only: do not silently enable key recovery or assisted custody.
5. A successor has a grant but cannot decrypt: report the missing verification; never promise continuity from role count alone.

## Work packages

### 1. Restore registered accounts

Files: frontend `src/auth/session.ts`, `src/views/Account.vue`, API error copy; unit and browser recovery tests.

Write a failing regression for a correct kit colliding with a registered account. Offer explicit normal vault login without requiring sign-out and keep the current account until successful completion. Check restored public fields and account/network/location/generation after every asynchronous boundary. Preserve destination and focus.

### 2. Reconnect paired sign-ins

Files: core protocol API/routes/account-control schemas; additive database migration; `services/api/src/auth/account-reconnect.ts`; ownership queries; integration tests; frontend API/session/account UI; pinned protocol artifact.

Write actual-signature/database tests first. Resolve the target from matching signing and encryption public keys, issue a bounded intent, require fresh current-account control and recovered-root proof, and lock both account rows in deterministic order. Verify member/link conflicts. Transfer credential/membership ownership, record the retired profile, revoke stale access, and issue the canonical session atomically. Test preserved receipts/uploads/archives and rollback/concurrency. Generate and pin the public package rather than copying API types.

### 3. Full access during Create/Join

Files: shared account setup/recovery component and Create/Join consumers; account destination helpers; browser tests.

Expose one account capability and one kit. Reuse existing setup and qualified recovery methods. Require an existing recovered wallet member to restore its original identity before private-history access; newly created keys apply only to a genuinely new account. Resume the originating journey after completion.

### 4. Private access and continuity

Files: admission/content controls, client epoch helpers and tests; any required core contract/protocol changes get their own compiled/native checks.

Prepare the permitted missing grants for active recipients and initialize new epochs through explicit user actions. Present pending grants, recorded grants, client verification, and recovery status honestly. Prepare successor history access before removal/demotion; preserve contract last-admin and history-policy invariants. Evaluate contract enforcement separately from UI checks and document deployment state.

### 5. Delivery

Run relevant security/database/browser tests, strict TypeScript and Vue builds, lint, formatting, generated documentation checks, and final connected-code review. Record actual results and remaining deployment requirements. Commit and push `dev`; publish authorized testnet frontend/API changes only with immutable artifacts and rollback checks.


## Verified implementation

- Core lint, strict TypeScript, generated docs, build and all 887 unit/WASM tests passed. All 287 database integration tests passed on the owned PostgreSQL fixture, including 23 wallet recovery/reconnection tests. The stale development-only migration copy in the disposable database was reset; published migrations and live data were not rewritten.
- Frontend lint, strict Vue TypeScript, build and 286 unit tests passed. After the final recovery retry, the affected 21 unit checks and 44 desktop/mobile browser tests passed, including Axe checks, inline Create/Join, full recovery and successor continuity with actual local encryption and real root signatures.
- Module compatibility recognizes the new pinned core package and rejects the next unqualified version. Final module verification and testnet delivery are recorded in the evidence report.
- Review completed inline across the proof/session handlers, migration constraints, historical ownership callers, pinned packages, Create/Join and private access controls. An unrelated mini-app/account-exit design file is outside this change.
- Continuity uses existing on-chain grants and contract last-admin protection. The new handover check is in the portal; successor decryption/recovery on another device is a human confirmation, not a protocol attestation. Under from-join history, a later member cannot be granted older epochs; retain an administrator who already has that history. No new contract safeguard or deployment is claimed.

Delivery completed on testnet; see [verification and publication evidence](../../evidence/2026-10-12-account-access-continuity.md).

## Restored-account pairing regression

Verified read-only testnet state on 2026-10-12: the registered original account now has a passkey and verified EVM link; its wallet-only profile retains email, Telegram, a passkey and native pairing. Native pair attempts from the registered account conflict. Existing reconnection only starts from the wallet-only session.

Continue the approved reconciliation design from the registered account. Reuse the native pairing challenge to prove the incoming wallet, require a separate restored-root signature over `/v1/account/reconnect/native` and the exact proof body, then execute the existing reconciliation transaction with the wallet-only profile as source. Explicit consent moves all source sign-ins; keep current target methods and immutable ownership. Do not merge registered roots or silently transfer a credential during ordinary pairing. Recheck the incoming wallet owner under the transaction's account locks. No new database fields or migration are needed.

- [x] Failing integration regression: restored root reconnects native/email/Telegram/passkey ownership while retaining target methods and counters; no mutation on ordinary pairing, forged/missing proofs, registered source, conflicting identity or replay.
- [x] Extract the existing transaction and add the root-controlled native continuation with canonical route schema.
- [x] Add readable pairing conflicts and an explicit native reconnect action; guard stale account/network/route responses before installing CSRF or refreshing methods. Explain unlock and consent; refresh all method counts.
- [ ] Verify strict types, unit/database/browser behavior, generated docs and pinned package compatibility; review inline; commit/push only task files and publish authorized testnet artifacts with recovery qualification and rollback checks.
