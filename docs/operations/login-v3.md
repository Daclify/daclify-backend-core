# Vault login v3: signed encryption identity

Core protocol/API and frontend development `0.10.0-alpha.1` require a coordinated vault-login update. The modules SDK consumes the matching core SDK; module contracts remain `0.9.0-alpha.5`. No contract deployment, database migration, key rotation or new environment flag is needed for this change.

## Request and verification

`POST /v1/auth/challenge` now requires both `signingKey` and `encryptionKey` from the current vault's public identity. The encryption key is the public P-256 JWK (`kty`, `crv`, `x`, `y`), never its private `d` field. Core validates its curve point before storing the challenge.

The returned message uses `daclify.login.v3` and binds both keys, frontend origin, API audience, challenge UUID and expiry. The browser validates these fields against its request before signing the exact returned message bytes. Use the canonical `ChallengeRequestSchema` and `LoginMessageSchema` from the pinned public SDK; do not build a parallel identity model.

`POST /v1/auth/login` retains `challengeId`, `signature` and `encryptionKey`. Core requires the finish key to equal the signed key and checks the stored challenge identity/expiry before creating an account or session. It rejects legacy domains even for internal callers without HTTP context. A changed key or invalid proof returns `AUTH_INVALID` and cannot consume the legitimate challenge or create a substituted account. Successful challenges remain one-use, including concurrent submissions.

An existing account's encryption key cannot be replaced through login. Even a correctly signed v3 challenge proposing a new key returns `KEY_CHANGE_REQUIRED`. Key recovery/rotation remains a separate explicit ceremony.

## Preserved state

Existing account IDs, signing/encryption keys, sessions, recovery kits, pairings and on-chain membership state are preserved. Existing kits use their original keys to log in with v3. Existing unexpired sessions keep their normal lifecycle. Unused v2 challenges cannot be completed; restart the login to get a fresh v3 challenge. There is no unsigned-key compatibility fallback.

Native/EVM/provider/passkey ceremonies keep their existing independent protocols. They do not restore private vault keys or acquire new DAO membership powers.

## Coordinated rollout

1. Install the matching core/module SDK packages and verify API/frontend builds and regression suites. This development change is not immutable release qualification.
2. Deliver the updated API and frontend together. Include self-hosted operators using the Daclify frontend; their APIs also need v3 support. Keep their existing database and vault material.
3. Refresh any already-open frontend tabs and restart in-progress vault logins. Older clients omit the required key and receive input validation errors. New clients refuse an old v2 challenge before signing. Mixed versions therefore fail closed for new vault logins.
4. Confirm original-kit login returns the same account ID and keys, and that substituted keys, legacy challenges and replay are rejected. Test normal paired login and private-content access separately in the deployment environment.
5. If rollout fails, correct the coordinated versions and roll forward. Do not restore v2 or add a legacy fallback to regain login availability. Existing sessions and separately configured paired sign-in methods can provide access while the delivery is corrected.

The [implementation evidence](../evidence/2026-10-10-login-key-binding.md) records isolated verification. Public deployments and real wallet/provider clients were not exercised by those fixtures.
