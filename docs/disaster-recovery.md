# Recovering Daclify after service or device loss

This guide describes current0.7 user recovery, retaining0.6 key behavior. Read [upgrade 0.7](operations/upgrade-0.7.md) for runtime/payment changes. Use the [upgrade guide](operations/upgrade-0.6.md) when moving an existing 0.5 service to this account model. The [verification record](evidence/2026-10-07-wallet-recovery.md) separates tested behavior from remaining deployment work.

## A ten-member DAO loses its server

If the blockchain and its deployed contracts survive, the DAO still exists. If one administrator retains their valid recovery kit **and separate recovery credential**, or a currently bound supported wallet, that administrator can recover their own access and manage the existing DAO again. An ordinary member's kit restores only ordinary membership. Each of the other nine users must recover independently; one kit does not contain everybody's keys.

Server loss does not automatically mean database loss. A verified off-host database backup preserves account UUIDs and recorded login pairings. If the database and all backups are gone, Telegram, Google, email and passkey pairings must be established again after each user recovers control. A fresh service UUID does not change that user's on-chain DAO/member identity. Restoring the service does not require paying the DAO creation fee again.

For private documents, the recovered user also needs the original private decryption key, matching surviving encrypted epoch grant and document ciphertext. A wallet alone recovers governance access, not historical decryption. Possessing a key does not guarantee that IPFS still hosts its file. If all of a user's control keys and recovery paths are lost, another member's kit cannot recreate them.

## Each user needs a current control path

Keep the encrypted recovery kit and its recovery credential separately, and test import on a second device. A surviving local vault can instead be unlocked with its password. Check any signing-key rotation: `rotatekey` changes the member's on-chain signing key, not their document-encryption key. An old kit can retain useful decryption keys while its old signing key no longer authorizes governance. A surviving currently bound wallet or another valid current control path is then required.

Ordinary human-member key rotation is authorized by that member; an administrator cannot reset another human member's keys merely because they are an administrator. Agent emergency controls are a separate explicitly configured policy. Creating a replacement vault does not update an existing member's encryption key or recover their old grants. Trustee-assisted recovery and changes to historical document access require a separate reviewed design.

## Storage and authority

| Record                                                                 | Storage                                                                                     | Recovery dependency                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| User signing and P-256 decryption private keys                         | AES-GCM encrypted browser vault and downloaded recovery kit                                 | Original vault password/local envelope, or recovery envelope and separate recovery credential |
| Signing and encryption public keys                                     | PostgreSQL account and contract membership records                                          | Public chain state; possession of a public key is not authentication                          |
| DAO epoch secrets                                                      | Per-member encrypted grants in runtime contract tables; public commitments in epoch records | Original member decryption key plus the surviving grant                                       |
| Private document bytes                                                 | Ciphertext in inline contract JSON or Pinata/IPFS, with immutable commitments/CIDs          | Surviving ciphertext/pins/export and corresponding epoch key                                  |
| Membership IDs, wallet governance bindings, roles, balances and nonces | Deployed Antelope contract tables                                                           | Correct native chain/runtime, current wallet authority or current internal signing key        |
| Google, Telegram, email and passkey pairings                           | PostgreSQL `credentials`/`passkeys`; wallet sign-in links in `native_links`/`evm_links`     | A verified database backup, or explicit fresh pairing after control recovery                  |
| Sessions and pending authentication proofs                             | PostgreSQL                                                                                  | Invalidate after restoring a database; sign in freshly                                        |

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

Users with their original current Daclify signing/encryption identity can instead import their encrypted kit and sign in with Daclify keys. An empty database creates a service profile and resolves memberships through the current on-chain signing key. A lost historical service-to-member mapping cannot make a rotated-out signing key current again. Choose the wallet-first path above if the original signing key no longer controls that membership, then attach the restored vault to the wallet profile with explicit wallet approval.

A wallet-only profile cannot create a new DAO until it has a proved signing/encryption identity. It cannot remove its last blockchain account-control credential. Concurrent recovery creates one profile for the same wallet. Cryptographic login intents are short-lived, browser/session-bound and consumed once.

## Restore a database backup

Keep the replacement API, provider integrations and workers stopped while restoring. Restore into a new database first; preserve any existing database and archive. Use the same PostgreSQL major version as the backup tool/server until an explicitly tested upgrade is planned. The current Mac archive was created with PostgreSQL 17.

Apply pending migrations, then run [`revoke-restored-sessions.sql`](../tools/recovery/revoke-restored-sessions.sql) on the restored database to revoke restored sessions and consume outstanding `challenges`, `signin_challenges`, `account_control_intents`, `native_login_intents`, `evm_signin_intents`, `evm_challenges`, `vault_attach_intents` and Telegram/OIDC attempts using their current schema. Do not expose a service with old live sessions merely because the archive restored successfully.

After `npm run build`, the following runs the actual migration coordinator and reviewed SQL **without starting the API or workers**. Run from the core repository, with `DACLIFY_ENV_FILE` pointing to a private API configuration whose `DATABASE_URL` selects the isolated restored database. This intentionally invalidates every session and pending proof in that database; verify the selected configuration before running. Do not source the env file as shell code or print its values.

```sh
DACLIFY_ENV_FILE=/private/path/restored-api.env node --input-type=module <<'JS'
import './dist/services/api/src/load-local-env.js';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { migrate } from './dist/services/api/src/store.js';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(pool);
  await pool.query(await readFile('tools/recovery/revoke-restored-sessions.sql', 'utf8'));
} finally {
  await pool.end();
}
JS
```

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

## Hosted capacity and merchant recovery

The chain retains paid capacity/receipt expiry, governance and member rights. It does not contain complete Stripe subscriptions, merchant mappings, immutable pricing consent, invoices, local customer ownership or social pairings. Back up those PostgreSQL records and private operator/provider configuration off-host. After complete database loss, disable new checkouts/subscriptions and automatic billing workers until backup restoration or explicit provider reconciliation is complete. Never create duplicate subscriptions automatically from surviving chain capacity. See [payment recovery](operations/connected-payments.md).

## Reconstruct verified hosted references

After recovering current administrator access, Resources → Hosted storage → Recover hosted records can check bounded document, branding or Archive batches. `POST /v1/storage/recover` reads the exact deployment's surviving native references and matches CIDs to Daclify-tagged files in the configured provider account. It verifies provider size and retrieves the SHA-256-committed bytes before importing ownership and references. Archive recovery additionally verifies anchored manifests/chunks using the retained trusted source schemas. The [Pinata file-list API](https://docs.pinata.cloud/api-reference/endpoint/list-files) supports CID-filtered authenticated inventory; a gateway download alone does not prove that the operator owns a pin.

Each recovered CID counts once per DAO across roles. Retries preserve existing references and released-hosting tombstones. External means no Daclify-tagged pin was found in this account; unavailable means ownership/content verification failed. Neither is silently adopted. Unknown or corrupt provider results need review. Original ciphertext is never decrypted by this route, and it uploads/deletes no file. Lost unpublished/orphan transport records cannot be attributed to a DAO from a CID alone; those still need the original database or explicit operator reconstruction.

The response explicitly sets `billingRestored=false`. It creates no invoice, subscription, social pairing or payment proof. Existing files can remain readable without upload receipts when chain references and ciphertext survive. New uploads remain subject to the rebuilt verified-byte ledger and genuinely restored/approved capacity. Keep paid workers disabled until their separate provider/backup reconciliation is complete. A genuinely empty local database drill verifies file retrieval, inventory/usage reconstruction, repeated recovery and absent invoice records; it does not qualify live provider durability or a complete server restore.
