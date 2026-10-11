# Quick signup and user-controlled account entry

Date: 2026-10-11. Status: draft. The user requested two account-creation paths. The quick path's immediate key-access policy remains to be confirmed; the recommendation below is an engineering proposal. This document records design work, not an implemented feature or a live provider qualification.

## User requirements

- A new visitor can create a Daclify account quickly using Telegram or email.
- A new visitor can also use the existing vault-password and recovery-kit flow.
- Account creation and returning-user login must both accommodate these paths.

Build on the existing Vue/TypeScript frontend, core API, provider verifiers and encrypted recovery service. No new authentication platform, module authority or contract change is proposed.

## Verified starting point

- Frontend `src/views/Account.vue` offers returning-user sign-in and new user-controlled vault creation. Its managed-signup disclosure is disabled.
- `src/components/SignInMethods.vue` and core `services/api/src/auth/sign-in-routes.ts` support paired Telegram/email login. An unknown provider identity currently fails rather than creating an account.
- The existing vault creates separate signing and document-encryption keys. Finishing user-controlled creation requires saving the encrypted recovery kit.
- `src/auth/fast-sign-in.ts` and core `services/api/src/auth/recovery.ts` support original-key recovery for explicitly enrolled methods. An ordinary paired login alone does not guarantee key access.
- Core `services/api/src/auth/recovery-config.ts` requires configured storage, a protected key service and current qualification evidence before assisted recovery can be offered. Configuration presence alone does not establish qualification.
- The existing approved passwordless-recovery design distinguishes login-only methods from full-access methods and records operator recovery power permanently. Existing users' pairings do not acquire assisted key access automatically.

## Recommended product behavior

### Quick signup

The new-account area presents **Continue with Telegram** and **Continue with email** before the vault form. Explain the proposed full-access option in plain language: “Sign in without a vault password. Daclify's recovery service can recover your signing and private-document keys.” Require an explicit choice of this recovery model before creating an assisted account.

Telegram uses the existing verified OIDC, widget or Mini App mechanism appropriate to the configured deployment. Email uses the existing short-lived email-code journey. Do not ask for a vault password, a recovery-kit download, a blockchain account or a second login method as routine quick-signup steps.

After verification, an already paired credential opens its existing account. Preserve that account's identity and selected recovery policy. If it is login-only, explain that its keys remain locked and offer its existing full-access methods or device transfer. Never silently enroll assisted recovery for that account.

An unpaired credential, used through the explicit quick-signup choice, proceeds to new-account creation under the disclosed model. After successful recovery enrollment and verification, open the account and return to the intended portal/community destination. DAO membership, admission, voting power and document grants remain separate authorized actions.

The recommendation is a complete account with keys available immediately, and repeat passwordless access through the selected provider on a fresh device. It reuses Daclify-assisted recovery rather than introducing a server that signs all actions without browser approval.

### User-controlled signup

Present **Create with your own keys** as the second choice. Selecting it reveals the existing vault-password, password generation/copy and required recovery-kit acknowledgment steps. Preserve existing envelopes and kit readers.

The user may later pair Telegram or email with this account through the existing account-control flow. Pairing does not automatically grant those methods access to keys. Full-access enrollment remains an explicit per-method choice with the existing custody disclosure.

### Returning users

Keep vault unlock, paired Telegram/email, passkey and supported wallet sign-in available. All paired methods return to the same account and memberships. Preserve `returnTo` across provider redirects and creation.

The ordinary login route continues resolving paired accounts only. When verification establishes that a credential is unpaired, offer the explicit quick-signup choice rather than a dead-end error. Fresh proof must be bound to that creation choice; do not turn a failed login into silent account creation.

## Availability and trust boundaries

Advertise quick signup per provider only when both that provider and the proposed full-access recovery mechanism are usable. Report unavailable setup and temporary outages clearly, with retry and the user-controlled option. Existing paired login must remain available according to its own provider configuration even when new assisted signup is unavailable.

Generate independent signing/encryption secrets in the browser. Persist only authenticated encrypted backup material and the approved assisted wrap through the existing recovery boundary. Keep plaintext secrets and unlocking material out of local/session storage, ordinary API persistence, logs and analytics. Never derive a secret from an email address, Telegram identifier or public provider proof.

Assisted recovery gives the operator power to recover both key purposes. Report this account-wide consequence consistently in recovery settings, join identity and DAO creation/admission. Accounts with this recovery authority cannot enter DAOs requiring the operator to be unable to recover private-content keys. Adding a password later does not erase earlier operator authority.

An existing local vault belonging to another account must survive quick signup and login. Creating another account from a browser with a saved vault requires a deliberate choice, not replacement of that vault.

## Backend and recovery sequence

Core owns canonical request/result/capability schemas; frontend consumes a pinned producer artifact. Reuse existing provider verification, code guess budgets, origin/session controls and recovery primitives.

1. Start a bounded browser-bound provider ceremony with explicit login or signup intent. Preserve destination and bind purpose, expiry and browser context.
2. Verify a fresh Telegram proof or consume the email code atomically. Reveal no account-existence information before verification.
3. Resolve the uniquely owned provider credential. If paired, open its existing account. Never merge accounts by email equality or Telegram profile data.
4. For a new assisted account, bind the verified credential, proposed public keys, proof of signing-key possession and custody consent to the same expiring creation attempt. The existing legacy key-login endpoint cannot substitute for a signup-bound ceremony.
5. Store the encrypted recovery backup through the qualified service and verify its receipt and a round trip matching both original public keys before declaring setup complete.
6. Finalize the account, credential ownership and recovery state with database uniqueness and transactional checks. Concurrent attempts for the same provider must converge safely on one account or return a recoverable conflict; never overwrite another account's keys.
7. Issue the normal account session and fresh method-bound recovery grant only after completion. Reuse normal original-key restoration on subsequent provider login.

Provider/storage operations are not one database transaction. The implementation plan must define a small pending-creation state with expiry, resumable retries, bounded cleanup and safe orphan-ciphertext handling. An interrupted attempt cannot leave a supposedly ready account with its only keys lost, or create a second identity on retry. Recovery authority history must remain truthful whenever assisted unlocking material has been disclosed.

## Acceptance

- New Telegram and email users complete the selected quick path without a password, kit upload/download or blockchain account.
- A fresh browser recovers the same account and both original keys using that provider alone; use those keys to sign an authorized operation and decrypt a surviving authorized document.
- Existing paired login preserves identity, memberships and per-method recovery permissions. An unpaired ordinary login creates nothing.
- The vault-password path and historical kits retain their working creation, unlock and recovery behavior.
- Cross-browser/origin/account/purpose proof substitution, stale/replayed proofs, guessed/reused email codes and session-only credential enrollment fail.
- Concurrent creation and retries cannot produce duplicate credential ownership or identities. Provider cancellation, storage failure and expired attempts have a working continuation or cleanup path.
- Quick creation cannot overwrite another account's saved local vault or persist plaintext keys. Strict private DAO policy rejects incompatible recovery authority.
- Unsupported recovery configuration never produces a working-looking signup button or a false success message. Temporary recovery outage does not downgrade existing account privacy.
- Desktop/mobile keyboard, focus, busy-state and accessible errors work; destinations survive Telegram redirects. Browser provider mocks and service fixtures are reported separately from real email/Telegram and independent recovery qualification.

## Scope and remaining decision

Frontend account entry, provider controls, vault/session helpers, core provider ceremonies, canonical protocol, pending-creation persistence, recovery integration, tests and account help are in scope. Contract/module changes, production rollout, provider purchases and automatic changes to existing accounts' recovery permissions are outside this design.

Confirm whether quick signup should immediately include signing and private-document key access through explicitly chosen Daclify-assisted recovery, as recommended. A login-only account with key setup deferred is a materially different product and must not be labeled full access. Existing recovery/provider operational prerequisites still need their own evidence before live enablement.

Related design: [Passwordless device access and original-key recovery](2026-10-10-passwordless-devices-and-vault-recovery.md).
