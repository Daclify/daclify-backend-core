# Wallet disaster recovery implementation and evidence

Goal: an empty service database must not prevent a proven blockchain wallet from using its existing DAO membership and permissions. Preserve the chain, current Mac database, vault and keys.

Design: introduce an explicit wallet-only account with null signing/encryption keys rather than claiming possession of a public key read from the chain. Existing vault accounts retain their schema. A fresh native proof or EVM SIWE signature may establish a wallet-only service account only when the configured deployment has a matching membership. Re-read the chain when resolving access, including binding revocation; never infer other DAO access from matching signing keys. No new member seat, fees, contract deployment, signing-key rotation or custody conversion occurs.

Rejected alternatives: copying an on-chain signing key into a recovered account can incorrectly associate other DAOs sharing that key; requiring a database backup makes on-chain administration dependent on service state. Both are unsuitable recovery mechanisms.

Execution is inline without delegation; the user approved the recovery direction and requested implementation.

- [x] Write and run failing schema/recovery regressions against an owned empty PostgreSQL database and real signature verification with a local RPC fixture.
- [x] Add a preserving SQL migration, typed wallet-only accounts, serialized wallet sign-in recovery, canonical live wallet membership discovery, and dual-proof vault attachment without changing the recovered service ID.
- [x] Preserve root login, make key-dependent operations reject wallet-only profiles before creating orders or enrolling members, and guard revocations/ambiguous bindings.
- [x] Update Vue account/login/create flows and generated documentation; build pinned development SDKs and update consumer lock integrity.
- [x] Verify complete fresh-database wallet session and current permissions, cross-DAO key isolation, unknown/revoked wallets, replay/concurrency, root recovery, and migration preservation.
- [x] Run backend/frontend verification/build/format plus relevant integration and UI checks; inspect the final diff and record actual evidence.

Recovery boundaries: encrypted local vault and downloaded recovery kit contain the user-controlled signing and P-256 decryption private keys; password and recovery credential protect separate AES-GCM envelopes. DAO epoch secrets are stored as encrypted per-member grants in contract tables, with public commitments. PostgreSQL stores public keys and social/wallet/passkey pairings, sessions, jobs and payment metadata. Social provider authentication cannot reconstruct a lost pairing. Re-pair after proven account recovery, or restore an encrypted off-host database backup. Managed custody remains unavailable and unqualified. IPFS ciphertext needs surviving pins or export/re-pinning. This does not promise recovery when every wallet key, recovery credential and independent backup is lost.

Completed verification: core 405, modules 82, frontend 95, integration 97, native wallet contract checks 2, desktop/mobile browser cases 4. Live Telos testnet empty-database recovery also passed for 3boidanimus3 / daclifycore1 / DAO 1 / member 1 with active admin authority and no transaction submission. An actual Mac archive restored into an isolated PostgreSQL database; migration 015 and restored-session invalidation passed, preserving the original administrator service UUID. Operational off-host backups and managed-custody qualification remain separate deployment requirements.
