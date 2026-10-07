# Recovering Daclify after service or device loss

## Storage and authority

| Record | Storage | Recovery dependency |
| --- | --- | --- |
| User signing and P-256 decryption private keys | AES-GCM encrypted browser vault and downloaded recovery kit | Original vault password/local envelope, or recovery envelope and separate recovery credential |
| Signing and encryption public keys | PostgreSQL account and contract membership records | Public chain state; possession of a public key is not authentication |
| DAO epoch secrets | Per-member encrypted grants in runtime contract tables; public commitments in epoch records | Original member decryption key plus the surviving grant |
| Private document bytes | Ciphertext in inline contract JSON or Pinata/IPFS, with immutable commitments/CIDs | Surviving ciphertext/pins/export and corresponding epoch key |
| Membership IDs, wallet governance bindings, roles, balances and nonces | Deployed Antelope contract tables | Correct native chain/runtime, current wallet authority or current internal signing key |
| Google, Telegram, email and passkey pairings | PostgreSQL `credentials`/`passkeys`; wallet sign-in links in `native_links`/`evm_links` | A verified database backup, or explicit fresh pairing after control recovery |
| Sessions and pending authentication proofs | PostgreSQL | Invalidate after restoring a database; sign in freshly |

Pairing records contain provider identifiers, including email subjects where used. They are not application-encrypted database columns. Restrict database/backup access and encrypt off-host backups; do not put this metadata on the public chain. A provider identifier alone is not sufficient to reconstruct its original pairing.

The local vault uses PBKDF2-SHA256 (600,000 iterations), independent random salts/nonces and AES-256-GCM. The recovery kit has both local and recovery ciphertext envelopes and public keys. The app does not upload the kit, password, recovery credential or user-controlled decryption private key. Plaintext keys are used in client memory while unlocked. The recovery credential must survive independently of the device and downloaded kit.

Managed custody is not qualified or enabled. The `custody.managed_keys` schema is not a claim that production OpenBao recovery is deployed.

## No service database survives

1. Restore reviewed source/configuration on an isolated replacement service. Initialize its PostgreSQL schema. Point it to the existing chain ID, runtime and Hub; never deploy replacement contracts or reset the DAO merely to restore service access.
2. Connect the existing native wallet or supported Telos EVM EOA and sign a new login challenge. Native verification checks current direct-key `active` authority and threshold. Delegated native accounts/waits and ERC-1271 EVM contract wallets remain unsupported.
3. A currently bound wallet receives a wallet-only service profile. This profile explicitly has no vault keys. Its new service UUID is not the DAO member identity: the chain DAO/member IDs, roles, credits, claims and treasury remain unchanged. Recovery has no creation fee.
4. Each membership read rechecks the current on-chain wallet binding. Cross-DAO signing-key reuse cannot authorize another DAO. Inactive membership does not gain governance powers; contract-permitted exit rights remain available. Unknown/unlinked wallets do not receive a recovered account. RPC failure or chain mismatch fails closed.
5. Restore the original encrypted kit and approve attachment with the wallet to add the proved vault identity to that recovered profile. Alternatively generate a new encrypted vault for new DAOs/content; it does not decrypt previous documents or rotate existing contract keys. Attachment requires separate fresh wallet-control and incoming-key proofs, is session/domain bound, and preserves the recovered profile UUID. Already registered vault identities are not automatically merged.
6. Re-pair social credentials using both current account control and a fresh provider proof. A blockchain binding does not reveal which email/Telegram/Google ID was previously paired.

A wallet-only profile cannot create a new DAO until it has a proved signing/encryption identity. It cannot remove its last blockchain account-control credential. Concurrent recovery creates one profile for the same wallet. Cryptographic login intents are short-lived, browser/session-bound and consumed once.

## Restore a database backup

Keep the replacement API, provider integrations and workers stopped while restoring. Restore into a new database first; preserve any existing database and archive. Use the same PostgreSQL major version as the backup tool/server until an explicitly tested upgrade is planned. The current Mac archive was created with PostgreSQL 17.

Apply pending migrations, then run [`revoke-restored-sessions.sql`](../tools/recovery/revoke-restored-sessions.sql) on the restored database to revoke restored sessions and consume outstanding `challenges`, `signin_challenges`, `account_control_intents`, `native_login_intents`, `evm_signin_intents`, `evm_challenges`, `vault_attach_intents` and Telegram/OIDC attempts using their current schema. Do not expose a service with old live sessions merely because the archive restored successfully.

A stale backup can resurrect removed sign-in methods or provider pairings. When the revocation history is uncertain, keep provider entry points disabled and require fresh control-based re-pairing; restoring an old backup does not prove that every saved credential remains authorized. Do not infer current chain permissions from archived `memberships` or job payloads.

Check the chain ID, deployed code/ABI compatibility, DAO/member ID, current roles and wallet bindings. Check row counts and stable account IDs without logging provider IDs, tokens, private environment values or custody material. Reconcile pending jobs, uploads, Stripe receipts/orders and financial obligations with their provider and chain state before resuming automation. Existing on-chain settlement/replay guards remain authoritative.

## Operational acceptance

Source recovery and local tests do not substitute for configured off-host backups. Before calling the hosted deployment resilient, its operator must verify:

- Automated encrypted PostgreSQL backups stored outside the VM, with a retention policy and monitored freshness/failure alerts. A second copy on the same disk is not an off-host backup.
- Independently retained backup-decryption keys and protected environment/provider configuration. Losing the backup encryption key loses the backup.
- A measured recovery point/time and an actual restore drill into an isolated database/host, including fresh sign-in and provider/job reconciliation.
- Durable IPFS pinning and a portable encrypted content export or independently pinned copy; a CID identifies content but does not keep it available.
- Vault-kit recovery on another device, and wallet recovery against an empty database without contract redeployment.

No process can restore a private secret after every private key, recovery credential and independent backup has been destroyed. DAO trustees or operator-assisted decryption recovery would be a separate, explicitly disclosed privacy policy; this change does not add one silently.
