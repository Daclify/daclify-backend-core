# Restored-account sign-in reconnection

The reported 409 errors were caused by two service profiles for the same recovered DAO identity. Read-only testnet diagnosis found the original registered account holding its signing/encryption identity plus a newly paired passkey and EVM wallet. A separate wallet-only profile retained email, Telegram, a passkey and the native wallet. Ordinary pairing correctly rejected ownership conflicts; the portal omitted a readable native conflict message. The previous reconnection journey only started from the wallet-only session.

The registered account now has an explicit **Sign-in methods > Telos Zero > Reconnect existing sign-ins** action. It requires locally unlocked original keys, explicit consent, a fresh incoming native-wallet proof and a separate root account-control signature over the exact reconnection body. The existing reconciliation transaction moves all wallet-only sign-ins together, keeps target methods and counters, preserves historical ownership, revokes old sessions and pending work, and opens the canonical account. Current native ownership is checked again while the account rows are locked. Ordinary pairing does not merge accounts. Separate registered identities and conflicting DAO members remain rejected.

The client forces this operation to use the recovered root even when a native/EVM signer is selected for DAO actions. Changed account, network, route, key or response identity is rejected before installing session material. The native panel and all method counts refresh after success. Email, Telegram and native ownership conflicts explain this continuation.

## Verification

- Watched the restored-account regression fail because the new protected route was absent, then pass with real K1 root signatures, native transaction proof verification and PostgreSQL transactions against the isolated test database.
- Core lint, strict TypeScript, generated documentation and build passed; all 887 unit/WASM tests and all 295 integration tests passed. The final affected integration suite passed 32 tests after adding the wallet-owner race and preservation of both passkey counters and the restored account's EVM link.
- Modules lint, strict TypeScript, generated documentation and all 192 tests passed. Compatibility accepts core 0.14.0-alpha.4 and rejects the next unqualified version.
- Frontend lint, strict Vue TypeScript, build and all 291 unit tests passed. Session checks cover real root signing despite EVM selection and rejection of late/substituted responses before CSRF installation.
- The account entry/recovery/settings browser run passed 45 of 46 desktop/mobile tests. The new panel's heading-order accessibility failure was corrected; both desktop/mobile account-settings tests then passed, including keyboard consent cancellation, locked-vault rejection with zero mutation requests, Axe checks and enlarged/mobile layouts. The other 44 checks passed unchanged.
- Final connected-code review was inline, as required by workspace instructions: proof/session binding, registered-root exclusion, account locks and wallet-owner recheck, immutable ownership, retained methods/counters, revoked intents, stale client state and exact pinned package compatibility. No contract source or deployed contract was changed.
- Core 0.14.0-alpha.4, modules 0.10.0-alpha.4 and frontend 0.14.0-alpha.7 use pinned development SDK artifacts. Core artifact SHA256: `0ba84f4f10ad4e5bffaecc759a8d11a28989743579780c548366cc10ea204121`; module artifact SHA256: `c4da68084454a709e3d8246c824eca42942240a5d04d9494d552c6fe62b4ce5a`.
- A fresh disposable TLS/OpenBao snapshot restore recovered synthetic keys after removing the source, excluded plaintext from audit output and denied all four privileged operations. The existing testnet-only qualification was reissued for core alpha.4 and passed the actual recovery configuration validator; expiry and independent-host limitations were retained.

## Publication

Pending snapshot publication and public verification. Development and test tools have not reconnected a live user account, transferred any live credential, rotated keys or submitted a DAO action. Actual Anchor approval and live user reconnection require the user's wallet and are not claimed by fixture or public-page checks.
