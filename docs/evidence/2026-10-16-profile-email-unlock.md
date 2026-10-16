# Private profile unlock through paired email — 16 October 2026

Frontend `0.15.0-alpha.49`, commit `5afbfcc03acd48000acc950ba7f336e471401949`, is pushed to `dev` and live on shared testnet. Core32, modules42, API, database, contracts and recovery policy are unchanged. Almaiso is excluded. Exact results are in the [JSON evidence](2026-10-16-profile-email-unlock.json).

## Verified cause

The user was signed in to an email-created account with its browser keys locked. Scoped read-only metadata inspection found one email pairing, one usable assisted-email backup, assisted recovery previously authorized, and no quarantined backups. Public service options reported mail delivery and assisted recovery available. The inspection did not fetch credentials, session tokens, backup payloads, receipts or private keys; real account identifiers and email are omitted.

Keys intentionally live in browser memory. Reloading discards that memory, and ten minutes without a signing action locks it. A signed-in service session does not itself decrypt the private profile. The missing step was in the UI: Profile required an unlocked signer but provided only a vault-unlock instruction, with no paired-email entry on that screen. Existing assisted recovery can restore the same signing/encryption keys after fresh email verification without a vault password.

## Correction

The existing ProfilePanel now accepts its Account owner's unlock controls. Profile offers the enrolled full-access kinds returned by the existing recovery-method API through the existing paired sign-in and Google components. Sign-in-only methods are not offered as unlock methods. Account recovery remains accessible for kit/device alternatives, and a failed options read can be retried. A recovery-only email sign-in retains Profile even if the route has an action return address. Failed verification, a missing grant or failed key delivery keeps private fields locked; recovery errors receive focus.

The same original-key, account, origin, network, grant and context checks remain in the shared recovery path. Restored keys stay in browser memory with the existing timeout. No key rotation, account replacement, custody change, new consent, server signing shortcut or persistent plaintext key storage is added. Profile publishing still encrypts locally and uses its existing native authorization.

Only the active account section renders its sign-in form, avoiding duplicate email/code label IDs between hidden management/setup forms and Profile. This was caught by an additional regression after visiting Sign-in methods. Provider disclosures inside the active management section retain their existing behavior. The [account guide](../../../daclify-frontend/docs/users/account-entry.md) explains email verification, memory-only key lifetime and recovery alternatives.

## Verification and delivery

The initial browser regression failed because signed-in locked Profile had no E-Mail control. The second failed by finding two email fields after a section switch. The final full run passed all 72 desktop/mobile browser cases across fast sign-in, account settings, unified approvals and saved/claimed DAO creation. Coverage includes actual SDK/WebCrypto restoration of fixture signing/encryption keys, editable profile fields, preserved Profile/destination, page reload, timed inactivity lock, missing grant, unavailable key storage, rejected email code, sign-in-only methods, options retry, kit fallback and field-label isolation. The new locked-profile accessibility check passed. Browser transport, inbox and key-broker responses are fixtures; this is not a real email/provider ceremony.

All 414 unit tests in 77 files passed. The final template-only inactive-form change was then checked by the complete 72-case browser rerun, final lint, Vue/TypeScript compilation and testnet build. Session/crypto unit implementations were unchanged after their successful run. Changed-file formatting and diff checks passed; dependencies did not change. Backend/native integration suites were not rerun because their implementations are unchanged.

The immutable release is `/data/daclify-runtime/releases/20261016-profile-unlock`. All 155 public files match its manifest. Previous hashed assets and rollback files remain available; no portal/API restart, proxy edit, database migration or native transaction occurred. Read-only desktop/mobile public portal/document checks passed without page exceptions or API 5xx responses. Native runtime/module hashes, eight ABIs and 54 retained SDK downloads matched their pins. Both user-scoped service units were active after publication. Live public options still report email delivery and assisted recovery available.

No real email verification, key recovery, credential change or profile publication was performed for the user. Actual inbox/provider recovery remains untested by this task; existing qualification and privacy disclosures are unchanged. Private execution evidence is under `/data/daclify-runtime/profile-unlock-20261016/`. JSON timestamps are UTC.
