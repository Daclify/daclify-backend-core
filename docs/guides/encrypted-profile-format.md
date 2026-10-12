# Encrypted profile format and native compatibility

This development candidate supplies a versioned cipher format and native write/removal actions. Profile-key custody, single-kit recovery and the audience editor are described in the companion key-lifecycle guide. Final provider/privacy qualification remains required. It is not a deployed private-profile experience.

Personal fields are encrypted in the trusted client before signing. Format 2 uses AES-256-GCM with a fresh 12-byte IV and an independent random 32-byte profile key. Its authenticated context includes the native chain, runtime, full DAO/member identifiers and a new profile revision UUID. Plaintext is limited to 4,096 bytes; the stored JSON envelope is limited to 8,192 bytes. The ciphertext includes its authentication tag. The public SDK exposes `encryptProfile`, `decryptProfile` and explicit encrypted/legacy readers through `@daclify/core-protocol/profiles`.

The runtime validates the bounded envelope and its declared context against the actual signed actor. It cannot inspect the decrypted personal fields or authenticate the ciphertext without the key; trusted clients must validate those fields and verify decryption. No profile key or recipient envelope is published on chain or added to the permanent account recovery kit.

`setencprof` writes format 2 using the existing profile row and indexes. Its `account_name` remains an explicitly public, globally unique alias. `delprofile` removes the owner's current row, including after membership deactivation, without changing that member's claim or stake. Deletion reclaims current row/index RAM; historical blockchain transactions and independently retained copies remain accessible.

The new runtime rejects plaintext `setprofile` writes with `PROFILE_ENCRYPTION_REQUIRED`. The API reports `encrypted-profiles-v2` only when the installed runtime ABI contains both new actions and rejects old plaintext requests before broadcast. The encrypted editor requires both that capability and the configured profile-key service before staging or signing. Existing plaintext rows remain explicitly readable as historical format 1; upgrading or encrypting a current row does not erase prior public contents.

Deploy the reviewed runtime, regenerated binary pins, permission links and matching API/frontend together. Keep supported historical artifacts unchanged. The combined governing-document upgrade also changes shared RAM classifications and module hashes; preserve pending approved work, adopted-document references and acceptance history under the existing upgrade procedure.

See the [profile implementation plan](../superpowers/plans/2026-10-12-encrypted-on-chain-profiles.md) for the separate key-envelope and UI qualification gates, and the [execution ledger](../evidence/2026-10-12-mini-app-execution-ledger.md) for measured native results.
