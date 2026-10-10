# Passwordless device access and original-key recovery

Date: 2026-10-10. Status: approved for inline implementation by the user on 2026-10-10. Approval does not qualify a recovery mechanism, independent backup destination, or production deployment.

## User requirements and established decisions

- Existing users must move between devices without uploading a recovery JSON or entering or choosing a vault password.
- Every paired sign-in method must open the same account. The user chooses which paired methods also provide fast, full original-key access on new devices. Each enabled full-access method must work without a kit, vault password, second credential or original device.
- Email/Telegram must be eligible for full access when the user deliberately selects their disclosed recovery model. Show the security implications of each method before enabling it.
- Recovery must preserve the original Daclify signing key and P-256 document-decryption key, including access to surviving historical document grants.
- A paired Telos Zero or Telos EVM wallet should provide a recovery path. The user proposed storing a backup encrypted using a private wallet signature.
- Losing the Daclify application server must not destroy the only key backup or the information needed to find it.
- A user chooses recovery permissions per paired method after seeing who gains recovery power. Do not upload this user's keys to an operator-held wrap or enable it for existing users merely because they requested the feature.

The labels, disabled-by-default assisted recovery, optional existing-device approval, and the storage layout below are engineering proposals. A particular paired method is not mandatory.

## Per-method permissions and disclosed custody

The current provider proofs authenticate a person but do not produce a reproducible client-only vault-unlocking secret. A private wallet-signature wrap or passkey PRF wrap alone cannot provide email/Telegram original-key recovery. Eligibility and full-access consent must be explicit for each method rather than silently treating every login pairing as a key-recovery grant.

The proposed initial model labels full-access methods by their custody mechanism:

| Paired method | Proposed full-access label | Meaning shown before enabling |
| --- | --- | --- |
| Telos Zero or Telos EVM wallet | Wallet-protected | A dedicated private signature unlocks the backup locally. Requires the exact supported wallet/key mechanism; changed authority or incompatible signing can break recovery. |
| Compatible passkey | Passkey-protected | A supported PRF mechanism unlocks the backup locally. Successful ordinary passkey authentication alone does not qualify full-key recovery. |
| Email or Telegram | Daclify-assisted | The qualified recovery service can unlock the backup after login. The operator has the ability to recover signing and private-document keys. |

These are custody explanations, not a universal safety ranking. Also explain method-specific account-takeover risks and actual support. A passkey without PRF can remain a login method; an assisted full-access variant would need the same assisted label and consent, rather than borrowing the passkey-protected claim.

Full-access assisted recovery is off by default. Enabling it requires explicit user acknowledgement of operator recovery power and fresh existing-identity authorization. A future independently operated recovery system is a possible additional model, not a selected or qualified provider and not a substitute for clear custody disclosure.

In the assisted design, the recovery service can recover both signing and document-decryption secrets. Database encryption, HSM/KMS access controls and audit logs reduce exposure but do not make the operator cryptographically unable to recover the vault. Account custody labels and DAO admission/private-content policy must accurately reflect this power. Never enable recoverable operator access for a DAO that requires the operator to be unable to decrypt.

Any enabled recovery route affects the whole shared vault. An account with an assisted route remains operator-recoverable when it is opened through a wallet or passkey. Display this account-wide consequence in the method list, enrollment consent and account summary. Removing an assisted method cannot prove an operator forgot already recovered secrets; never claim retroactive confidentiality.

Pairing grants login under the existing explicit pairing flow. It does not automatically enable original-key recovery. Each row displays its login availability, full-access state, custody label and qualified support. An unavailable recovery mechanism remains visibly unavailable rather than becoming an ineffective toggle. Existing pairings migrate with original-key recovery disabled until enrolled and verified.

## Verified starting point

- Frontend src/auth/vault.ts creates independent signing and encryption secrets. Existing local and recovery envelopes use password/code-based PBKDF2-SHA256 and AES-256-GCM. Original-password recovery now works with existing kits.
- Frontend src/components/SignInMethods.vue offers paired passkey, social, native and EVM login. These open service sessions; they do not recover the original vault keys on a fresh device.
- Frontend src/auth/webauthn.ts implements authentication without a PRF request. An ordinary passkey assertion is sent to the verifier and is not a secret suitable for encrypting the vault.
- Core services/api/src/auth/wallet-recovery.ts preserves existing service accounts when pairings survive. Without the database it can recover supported current on-chain wallet memberships into a wallet-only service profile. Its service UUID can change; DAO/member identity survives.
- Native nativeIntentProof signs a changing, unbroadcast authentication transaction and sends its signature to the server. EVM sign-in sends a fresh SIWE signature to the server. Neither authentication signature may be used as secret backup-unlocking material.
- ops/hetzner/backup.sh creates local PostgreSQL dumps. ops/hetzner/README.md explicitly records that independent off-VM copying remains unconfigured. This is source/runbook evidence, not a new live-host backup audit.
- Existing protected document ciphertext and per-member encrypted grants must also survive. Recovering vault keys cannot recreate a deleted document.

## Product behavior

Normal entry offers every available paired method with equal status: email, Telegram, passkey, Telos Zero and Telos EVM, and any other supported explicitly paired provider. A method with full access enabled opens the existing account and recovers its original vault keys through its approved recovery policy. No original or new vault password, additional paired method or recovery-kit upload is requested. Unsupported or unpaired credentials do not create or merge accounts silently.

A login-only method still opens the same service account without a vault password or kit. Original keys stay locked until the user chooses an enabled full-access method or an optional device-transfer path. Explain this state without presenting a recovery-kit upload as the routine login requirement. It is a user-selected permission boundary, not a claim that login failed.

An assisted recovery service requires a fresh verified proof for the selected paired credential, not merely possession of an old session cookie. Bind key delivery to the intended account and receiving browser's fresh encryption public key, request, audience and expiry. Deliver only encrypted backup material and an encrypted backup-key response to that browser. The browser verifies both original public keys before use. Keep plaintext vault secrets and unlocking keys out of normal API responses, ordinary persistence, logs and analytics. The service still has recovery authority even if normal delivery only rewraps a backup key.

Client-only paths use a compatible passkey PRF or a qualified private wallet signature. Wallet login and private vault-unlock approval remain separate operations even if presented as one guided journey. Email/Telegram full-access eligibility depends on an actually qualified assisted service and permitted custody policy; do not force an additional wallet/passkey after the user enrolled a functioning assisted route.

If a user has an existing unlocked device, the new device can display a one-time QR request. The user scans and approves it on the existing device. The devices exchange the original vault secrets through an encrypted channel whose endpoints are the browsers. The service forwards ciphertext and coordinates the expiring request; it does not receive the secrets or the channel key. The new device verifies a selected qualified full-access method before reporting that persistent access is ready.

Until this new recovery system is qualified, paired email and Telegram only open the existing service session; that is the current implementation limitation. The delivered feature must restore original-key availability through any chosen, enrolled full-access method alone. If recovery storage is temporarily unavailable, show an explicit outage/retry state rather than pretend that full access succeeded or force the user into a kit/password workflow.

If a browser or wallet cannot support its enrolled client-only unlocking mechanism, offer another enrolled full-access method or device transfer. An assisted variant needs a separately qualified mechanism and the same explicit operator-power consent as email/Telegram; do not silently downgrade privacy. Do not save plaintext keys or insert a mandatory vault password into the requested passwordless journey. A session-only device transfer may be offered with its limitation stated; it must not be labelled persistent device enrollment.

The JSON kit remains an optional emergency fallback. Existing accounts need access to the original vault once to enroll a new unlocking method. A locked legacy vault can still require its original password or recovery code for that initial enrollment. Already paired wallets cannot recreate an original vault for which no decryptable copy survives.

## Key design and authority

Retain the original signing and encryption keys. Encrypt their versioned vault payload under a fresh random 256-bit backup key using authenticated encryption. Each selected full-access method wraps that key under its disclosed custody policy. A client-only account does not acquire an operator-assisted wrap merely because assisted recovery exists as a product capability. Different methods open the same secrets; they never generate replacement member identities or rotate contract keys implicitly.

Core owns versioned schemas, account-control rules, bounded ciphertext storage and method revocation. Frontend owns generation, key derivation, wrapping, local unlocking and device transfer. Consumers use released producer-owned protocol artifacts. Modules need no new authority for this feature.

Vault records bind format and algorithm versions, the original public-key identity, the application/network context, backup revision and each approved method's required derivation parameters. AES-GCM nonces are fresh for each encryption. Authenticate the binding metadata. After decryption, verify both original public keys before changing browser state or attaching a vault to a recovered account.

Adding or replacing an unlocking method requires control of the existing identity and proof of the incoming method. A stolen social/session cookie cannot add its own key wrap or approve a new device. Prevent account merging, stale-method resurrection and removal of the last usable recovery path. Current DAO authority and private-document grant policy remain authoritative.

### Passkeys

Use the WebAuthn PRF extension to obtain client-only key material, then derive a wrapping key with HKDF-SHA256 and explicit purpose separation. Keep PRF results out of authentication payloads, logs and analytics. The existing explicit assertion serializer must not be replaced by a whole-credential serialization that includes those results.

Qualification must demonstrate that the supported browser/authenticator can reproduce the required output on the user's actual new-device route. A synced passkey, a hardware key and phone-mediated authentication are separate cases; ordinary successful passkey login proves none of their vault-unlocking behavior.

A replacement host must preserve the relying-party domain to retain passkey usability. A different website/domain is a different recovery situation and needs another surviving approved path. This design does not promise every browser, authenticator or Telegram webview supports PRF.

### Paired wallets

Derive the wrapping key from a dedicated, reproducible private recovery signature using HKDF-SHA256. Preserve the exact signed input and public derivation metadata independently of the app server. The input separates recovery from login, account pairing, governance and payments, and binds the intended application identity, network, signer and vault identity.

The recovery signature and derived key must never be sent to the backend, broadcast, retained in analytics, or reused as login proof. Fresh login and control challenges still expire and have replay protection. The stable recovery input is deliberately separate from those changing challenges.

EVM qualification targets the currently supported externally owned accounts. Verify reproducibility across the selected wallet implementations, versions and devices, including signature normalization. Do not advertise ordinary ECDSA signing as inherently deterministic or claim ERC-1271 wallets are supported.

Telos Zero qualification must establish that the supported wallet can sign a fixed, purpose-bound private input without injecting changing transaction fields or publishing the signature. If a transaction-shaped input is necessary, it must not be a broadcastable governance, account-management or payment authorization. The current authentication helper cannot be reused unchanged. Wallet cancellation, account/permission changes, hardware implementations and multisignature limitations need explicit qualification.

Changing native account authority can preserve the account name while changing the signature-derived wrapping key. Require another surviving wrap or rewrap while the original vault is available. The storage service cannot fix lost key material by accepting a different valid signature. If a wallet cannot reliably reproduce the original secret, do not enable its full-key recovery method.

### Existing-device approval

The QR request commits to the receiving device's ephemeral public key, intended site/account context, request ID, expiry and one-time channel. Bind approval and the encrypted response to that exact request. Confirm the receiving device's verification information on the approving device and require fresh existing-key control.

Reject replay, expired requests, public-key substitution, cross-account transfer, context changes and concurrent consumption. Remove pending ciphertext on expiry or completion; keep only redacted audit metadata. Persistent enrollment succeeds only after the new device proves it can unlock its own stored encrypted copy and use the intended signing identity.

## Server-loss behavior and independent storage

Encryption protects the secrets in a surviving copy; it does not keep the copy available. Keep vault ciphertext, key-wrap metadata and the account-to-backup lookup outside the application VM. Back up service records separately to preserve account UUIDs, provider pairings and revocation history.

Proposed operational minimum: a primary durable ciphertext store plus an independently controlled off-host backup, versioned encrypted PostgreSQL backups, and separately retained operator backup-decryption/configuration material. A different directory or container on the same VM does not meet this requirement. Select and qualify an actual destination before enabling hosted recovery; a source implementation alone is insufficient.

If IPFS is used, verify independent pinning and successful retrieval. A CID without surviving pins is not an availability guarantee. Preserve the lookup and derivation metadata too; retaining an encrypted blob whose address nobody knows does not deliver wallet recovery.

| Failure | Required result |
| --- | --- |
| API host unavailable, independent stores survive | Keys are not destroyed. Hosted entry may wait for a compatible replacement service; failover must be deployed and tested before promising uninterrupted access. |
| VM and local database/dumps destroyed | Restore off-host service records and encrypted vault metadata on a replacement host; retain the same service/RP domain where possible; revoke restored sessions and reconcile credentials before reopening access. |
| Database and every service backup destroyed | Current supported on-chain wallet bindings can recover governance access. Original-key recovery additionally needs a discoverable surviving vault backup and its complete derivation metadata. Ordinary social pairings and original service UUIDs cannot be inferred from chain membership. |
| Original device lost, any enrolled full-access method and its backup/recovery infrastructure survive | Retrieve ciphertext and permitted unlocking material, verify both original keys, and open the existing account without a kit or vault password. |
| All private control paths or every copy of the required ciphertext lost | Full original-key recovery is impossible; do not pretend replacement keys decrypt history. |

Permanent Daclify disappearance needs more than off-host operator backups: users need a compatible client/service and independently discoverable access to their backup. A public on-chain recovery pointer or independently maintained signed catalogue is a possible additional design, with public-metadata, revocation, availability and cost implications. It is not silently included or authorized here. Ordinary hosted recovery covers replacement of the app server, not a claim of permanent operator-independent availability.

For client-only wraps, ciphertext storage and database access alone must not reveal vault secrets. An assisted recovery service additionally has access to a protected recovery key, which must survive independently of the app host and database. This changes the custody boundary; do not present it as the client-only privacy model. Neither design prevents compromised frontend code from stealing secrets while a user unlocks them. Preserve reviewed immutable client releases and ordinary client-delivery protections.

## Migration and compatibility

Keep existing kits and password-based local envelopes readable. Introduce an explicit new record version for passwordless wraps; do not reinterpret a password field as a signature. Enrollment first unlocks the original vault, creates and persists the new wraps, and verifies a recovery round trip. Preserve the existing working kit and current access throughout enrollment and failure handling.

For hosted recovery, report setup complete only after the intended independent copies and lookup metadata have verified receipts, and an enrolled method has successfully decrypted and matched the original public keys. Backup revision and trusted revocation state must prevent an old restored database from silently reenabling a removed method. An immutable old ciphertext copy remains decryptable by someone who retained its former unlocking secret; deleting a database row cannot revoke that historical knowledge.

Changing a passwordless unlock method does not rotate the original signing/encryption keys. Actual key compromise and DAO grant/key rotation remain the existing separate policy and procedure.

## Qualification and delivery order

1. Qualify each proposed custody mechanism before enabling its full-access option. Test email/Telegram assisted release on a fresh device without another key holder present, and passkey PRF/private-wallet signature paths separately on actual clients before freezing their wire formats. Preserve users' independent choices of enrolled methods.
2. Freeze canonical encrypted-vault/wrap schemas, consent and revocation rules; implement preserving migrations and client-only wrapping with regression and adversarial tests.
3. Add the passwordless entry/enrollment and existing-device approval flows, preserving account/DAO identity and document decryption. Exercise fresh devices and legacy migration.
4. Configure independent backup destinations with authorized access, monitored freshness and retention; perform a destructive-loss simulation against disposable infrastructure. Recover service IDs, vault lookup/metadata and original keys without using the source app host.
5. Publish support, recovery limitations and version-compatible guides; integrate released producer artifacts into frontend. Testnet delivery follows verified prerequisites. Production and blockchain changes remain separately authorized.

Acceptance includes both-key identity matching; historical private-document round trips; wrong wallet/key/chain/RP rejection; tampered ciphertext and swapped wrap metadata; replay/account-swap/device-transfer attacks; aborted migration with working legacy access; removed-method and stale-backup behavior; no secret-bearing server payloads/logs; and desktop/mobile keyboard and accessibility flows. Mock wallet proofs or synthetic passkeys do not establish real-client compatibility.

Each supported enrolled full-access method must independently pass the fresh-device journey with no kit, vault password, second credential or original device. Login-only methods must open the same account while failing to release keys. Test default-disabled migration, explicit consent, rejected unauthorized toggles, account-wide assisted-custody disclosure, unsupported method states and disabling a full-access method. Also verify that an old session cannot retrieve recovery material, removed credentials cannot obtain new recovery material from the service, recovery-service outage fails honestly, and DAO custody policy prevents an incompatible operator-recovery configuration. These service controls cannot erase secrets or historical ciphertext already retained by a former key holder.

## Open prerequisites

- A qualified key-management and disaster-recovery setup is required before the optional assisted full-access method can be enabled. End-user consent is per method; there is no blanket permission to expose existing user vaults to an operator.
- Actual supported EVM wallet and Anchor/device combinations need real-client evidence. Installed signing libraries alone do not qualify external wallets.
- Passkey PRF support on the supported new-device and webview routes is unverified.
- The independent storage destination, retention, freshness target and recovery-time target have not been selected or qualified. No provider purchase or credential request is made by this document.
- Permanent operator-independent retrieval would require a further explicit locator/availability design.

## Sources

- [Current disaster-recovery guide](../../disaster-recovery.md) and [hosted backup runbook](../../../ops/hetzner/README.md).
- [WebAuthn PRF specification](https://www.w3.org/TR/webauthn-3/#prf-extension), including client-only encryption use and exclusion of PRF results from server payloads.
- [Ethereum signed-data standard](https://eips.ethereum.org/EIPS/eip-191), for message/transaction separation.
- [RFC 6979](https://www.rfc-editor.org/rfc/rfc6979), for deterministic signing rather than an assumption about all ECDSA wallets.
- [IPFS pinning documentation](https://docs.ipfs.tech/how-to/pin-files/), for retention and remote pinning requirements.

Implementation clarification: assisted consent is permanently committed in a fresh account-control ceremony before any original unlocking material is delivered. Failed storage after consent cannot erase reported operator authority. Restored recovery methods are quarantined until current pairing/revocation history is reconciled or the original vault reenrolls.
