# Password-free devices and independent recovery keys

This prepared deployment is **disabled by default**. It adds no live custody service, hosted key or off-site backup. Local verification used OpenBao 2.7.1 with its official checksum, a real disposable Raft snapshot restore and restricted API tokens. That test does not qualify an independent host or a real wallet/passkey.

Users choose each paired method in Account → Sign-in → Full access on another device. Pairing alone signs into the same service account; it does not enable key recovery. Full access restores the **original signing and P-256 document keys** into browser memory, without a vault password. An idle lock requires a new sign-in or device approval. The existing encrypted JSON kit remains an independent fallback.

| Method | Unlocking authority | Requirements |
| --- | --- | --- |
| Telos Zero / Telos EVM, wallet-protected | Wallet holder, through a separate private, reproducible unlock signature | Qualify the actual wallet/browser/chain. Never broadcast or send this signature to the API. Public login signatures are different and cannot unlock the backup. |
| Passkey-protected | Authenticator with reproducible PRF output | Qualify real authenticators and a new-device restore. An ordinary passkey without PRF signs in but cannot unlock original keys. |
| Any paired method, Daclify-assisted | Paired account **and Daclify recovery operator** | Explicit consent, independent key service and verified off-site recovery. The operator can recover signing and private-document keys. |
| Another unlocked device | Existing device and approved recipient | Five-minute, single-use encrypted transfer; compare the code on both devices. No hosted recovery configuration required. |

Google's complete browser sign-in remains unavailable; this feature does not make an unfinished provider usable. Unsupported wallet authority models and PRF clients remain sign-in-only unless another permitted mode is selected.

Assisted consent is committed before the browser can deliver a spare unlocking key. `assisted_ever` is permanent and appears in the account, public join identity and DAO-creation policy. Disabling methods cannot recall a key already obtained. Accounts that authorized assisted recovery cannot found or enroll as user-controlled identities in strict private DAOs. Existing strict-private memberships, including retained historical mappings and inactive membership, block assisted setup; unresolved policy reads fail closed.

## Required topology

1. API/database host: existing Daclify services and a dedicated least-privilege API OS user.
2. **Separate** OpenBao host: TLS, Raft data, audit logs, controlled firewall and restricted API access. A second container/directory on the API host is not independent.
3. Independent backup destination: encrypted PostgreSQL dumps, encrypted Raft snapshots, recovery configuration/evidence and retained ciphertext blobs. Retain point-in-time history/WAL or another complete account/pairing/revocation history through the required recovery point. A stale snapshot alone cannot prove that a pairing remains allowed.
4. Offline holders: OpenBao unseal shares and the RSA backup decryption key, outside both hosts and their backups. Losing all unseal material or this decryption key prevents recovery.

Choose a recovery point and recovery time target, retention and monitoring before enablement. IPFS content addressing alone does not retain bytes: verify an independent pin or encrypted blob export and retrieval. Losing every independent copy cannot be repaired by a wallet signature. See [OpenBao Raft recovery](https://openbao.org/docs/concepts/integrated-storage/) and [transit keys](https://openbao.org/docs/secrets/transit/).

## Provision the separate key host

Install an official OpenBao binary with checksum verification. This prepared configuration was exercised with **2.7.1**. Use a dedicated `openbao` OS user, mode 0700 state/log directories, and TLS certificates for the real key-service hostname. No secrets belong in Git or chat.

Copy `openbao.hcl` to `/etc/openbao/openbao.hcl` and `openbao.service` to the system unit directory. Replace `keys.example.invalid` in both API and cluster addresses. Install readable certificates at the configured paths; private keys remain mode 0600 for `openbao`. Limit port 8200 to approved API/operator/backup hosts, and port 8201 to cluster peers. Disable swap or configure encrypted swap; core dumps are disabled. Start the service using the reviewed unit.

Initialize **once** on the new host with at least five unseal shares and a threshold of three, using separate custodians' PGP keys and an encrypted root-token recipient:

```sh
bao operator init -key-shares=5 -key-threshold=3 -pgp-keys=/secure/custodian1.asc,/secure/custodian2.asc,/secure/custodian3.asc,/secure/custodian4.asc,/secure/custodian5.asc -root-token-pgp-key=/secure/operator.asc
```

Retain encrypted initialization output off-host. Unseal interactively with the required separate shares (`bao operator unseal` prompts; do not put shares in command arguments or service env). Authenticate the temporary setup operator using an interactive, reviewed credential process. Keep `BAO_ADDR` at the TLS endpoint; do not disable certificate verification. Revoke the temporary root token after establishing controlled administration and recovery access.

Provision a nonexportable transit key and two separate policies:

```sh
bao secrets enable transit
bao write transit/keys/content-recovery-v1 type=aes256-gcm exportable=false allow_plaintext_backup=false deletion_allowed=false
bao policy write daclify-recovery-api /reviewed/api-policy.hcl
bao policy write daclify-recovery-snapshot /reviewed/snapshot-policy.hcl
bao auth enable approle
bao write auth/approle/role/daclify-recovery token_policies=daclify-recovery-api token_period=30m secret_id_num_uses=1 secret_id_ttl=10m
```

Use the real file paths for policies. The API can only encrypt/decrypt with this pre-created key and renew/inspect its own token. It cannot export, create, rotate or delete keys, change policies or obtain a snapshot. Give the snapshot job its separate policy, with a renewable credential and restricted source host. Review any AppRole source-CIDR restrictions for the actual network. See [AppRole](https://openbao.org/docs/auth/approle/) and [Agent AppRole](https://openbao.org/docs/agent-and-proxy/autoauth/methods/approle/).

The declared audit device writes `/var/log/openbao/audit.jsonl`, with secret fields HMAC-redacted. Preserve this **same absolute path and writable directory on replacement hosts**. Our source-deletion drill showed that a restored audit device pointing at a removed directory prevents successful unseal. Restrict and back up logs; never enable `log_raw`. See [audit configuration](https://openbao.org/docs/configuration/audit/).

## API credential renewal

On the API host, copy `agent.hcl` to `/etc/daclify-recovery/agent.hcl`, substitute the real TLS origin, and install `agent.service`. Use the same dedicated OS account as the API so the mode-0600 token sink is readable only by that account. Role ID is not a private key; the wrapped one-use SecretID bootstrap token is secret. Deliver both directly into the configured protected files, rather than chat or an env committed to source.

The operator can generate those files using JSON output redirected through a local parser:

```sh
bao read -format=json auth/approle/role/daclify-recovery/role-id | jq -r '.data.role_id' > /secure/role-id
bao write -wrap-ttl=10m -format=json -f auth/approle/role/daclify-recovery/secret-id | jq -r '.wrap_info.token' > /secure/wrapped-secret-id
```

Transport to the API host with mode 0600 and correct ownership, then start the Agent. It unwraps the bootstrap SecretID, removes its file and renews the periodic token at `/run/daclify-recovery/token`. A restart requiring a new login needs a new one-use bootstrap SecretID; never reuse an expired bootstrap. The API rereads the sink on every key-service request. Recovery failures return redacted typed errors.

Copy the path-only `recovery.env.example` into private service configuration; keep `RECOVERY_ENABLED=0`. Reuse existing `FRONTEND_ORIGIN`, `PINATA_JWT`, `PINATA_STORAGE_SCOPE`, `CONTENT_GATEWAY` and optional `CONTENT_GATEWAY_KEY`. Testnet and mainnet require separate scopes, accounts and evidence. Do not place root tokens, unseal shares or the offline backup private key in this env.

## Encrypted independent backups

`backup.mjs` streams an authenticated RSA-OAEP-SHA256/AES-256-GCM file. Generate an RSA key of at least 3072 bits **offline**, retain its private key independently, and put only the public PEM on source hosts. Output files are created mode 0600 and never overwrite an existing path. Authentication failure removes partially decrypted output. All input/output/key paths must be absolute. The `kind` is authenticated: database, openbao or config.

With API/workers paused or an explicitly consistent PostgreSQL backup procedure:

1. Produce a custom-format `pg_dump` using the existing secret connection configuration, not a DSN in a logged command argument. Include all account IDs/public keys, credential/passkey/wallet links, `vault_recovery_*` records/receipts/state, membership history, audit events, replay state and module/creation/payment data.
2. Under the separate snapshot credential, produce `bao operator raft snapshot save /secure/recovery/openbao.snap` on a functioning unsealed leader.
3. Archive required private operator configuration, evidence and TLS/Agent bootstrap procedures. Exclude root tokens, offline RSA private keys and unseal shares; custodians preserve those separately.
4. Encrypt each file, upload the encrypted output to the independent destination, verify its digest there, and remove temporary plaintext under the reviewed retention procedure.

```sh
node ops/recovery/backup.mjs encrypt database /secure/recovery/database.dump /secure/recovery/database.dump.enc /secure/backup-public.pem
node ops/recovery/backup.mjs encrypt openbao /secure/recovery/openbao.snap /secure/recovery/openbao.snap.enc /secure/backup-public.pem
node ops/recovery/backup.mjs encrypt config /secure/recovery/config.tar /secure/recovery/config.tar.enc /secure/backup-public.pem
```

Do not treat backup creation as successful until the remote copy has been read and independently restored. Automate the above with the chosen destination's supported tool only after its credentials/host are supplied; no destination has been configured by this change. Retain encrypted recovery ciphertext independently of the API, with its lookup receipts in the database backup. Metadata inside publicly pinned backups is encrypted under a separate transit-wrapped key; email, Telegram identifiers and account IDs are not Pinata names/tags.

## Source-loss restore drill and enablement

Keep the source API and OpenBao unavailable during the drill. On an isolated replacement:

1. Verify digests and decrypt retained files with the offline RSA key, into fresh protected paths. For example, `node ops/recovery/backup.mjs decrypt openbao /secure/recovery/openbao.snap.enc /secure/restored/openbao.snap /offline/backup-private.pem`.
2. Start OpenBao with the reviewed configuration, persistent node identity and **same audit path**; restore the Raft snapshot with operator-authorized `bao operator raft snapshot restore -force /secure/restored/openbao.snap`. Use original retained unseal shares, follow the official recovery procedure and prove the original transit key decrypts an old backup. A fresh key with the same name is not the original key.
3. Restore the database into a new isolated database using the correct reviewed release's migrations, then run `tools/recovery/revoke-restored-sessions.sql` while API/workers remain stopped. This revokes every restored session/pending proof and quarantines every restored full-access method.
4. Reconcile accounts, credential ownership, pairings, removals, key rotations, method enable/disable and permanent assisted authority against **current independently retained history through the accepted recovery point**. Keep unresolved records quarantined. After service identity and permanent assisted-authority history are reconciled, reenrollment from an unlocked original vault can replace an uncertain method grant; it does not invent new keys or prove that no operator ever held a spare. Keep the replacement API stopped if permanent authority history is incomplete. Original-key possession alone cannot reconstruct that history. Lift quarantine only for individually verified current records using a reviewed operator process.
5. With the source unavailable, sign in freshly through an explicitly enabled paired method on a clean browser. Preserve the service UUID and both original public keys; decrypt a document written before the source was lost. Verify changed origins/accounts, stale sessions, revoked pairings and quarantined records cannot obtain key grants. Check billing/jobs separately before restarting workers.
6. Record measured recovery point/time and actual independent hosts. Keep hosted recovery disabled if source-loss retrieval, original-key restore, current revocation reconciliation or strict-privacy enforcement fails. Existing-device transfer and JSON fallback remain available when their originals survive.

Qualification is an operator-reviewed JSON file at `RECOVERY_QUALIFICATION_FILE`, mode 0600/0644 without group/world write. It expires within 90 days and binds exact core version, frontend origin, TLS key origin, storage scope and different source/replacement hosts. Evidence files are sibling basenames (no symlink escape), SHA-256 committed, bounded, not group/world writable. Minimal report shape:

```json
{
  "version": 1,
  "coreVersion": "0.12.0-alpha.1",
  "origin": "https://REPLACE-FRONTEND.example",
  "keyServiceOrigin": "https://REPLACE-KEYS.example:8200",
  "storeScope": "REPLACE-STORAGE-SCOPE",
  "issuedAt": "REPLACE-UTC",
  "expiresAt": "REPLACE-UTC",
  "sourceHost": "REPLACE-SOURCE",
  "restoreHost": "REPLACE-INDEPENDENT-RESTORE",
  "reviewedBy": "REPLACE-REVIEWER",
  "assisted": false,
  "checks": [
    {"kind":"database-restore","file":"database-restore.json","sha256":"REPLACE-SHA256"},
    {"kind":"key-service-restore","file":"key-service-restore.json","sha256":"REPLACE-SHA256"},
    {"kind":"offsite-blob","file":"offsite-blob.json","sha256":"REPLACE-SHA256"}
  ],
  "clients": []
}
```

Each evidence file includes `status:"passed"`, its matching `kind`, exact `origin`, exact `coreVersion` and substantive results from the actual drill. Database evidence records identity preservation, old-document decrypt, session revocation and current pairing/revocation reconciliation. Key-service evidence records source outage, original-key recovery, unseal/audit restore and least-privilege denial checks. Blob evidence records the real independent destination, digest, source-unavailable retrieval and retention. The local `isolated-openbao-restore` lab report is deliberately a different kind and cannot stand in for these three reports.

A `clients` entry additionally has `kind:"evm"|"native"|"passkey"`, `browser`, `wallet`, evidence `file` and `sha256`. Record actual provider/chain/browser/authenticator versions, reproducible private approvals/PRF, a clean new-device restore, original document decryption and cancellation. Never include signatures, PRF bytes or keys. These reports authorize the tested provider kind on this deployment; qualify all wallet/client configurations advertised to users. Requalify if an update changes reproducibility. Unsupported clients fail closed rather than returning replacement keys.

Only after all required reports pass, set `RECOVERY_ENABLED=1`; `assisted:true` enables the consented operator path, and qualified client entries enable their respective private modes. Startup rejects absent, stale, modified or mismatched evidence. Runtime expiry stops new enrollment/grants/claims. Existing paired login stays available.

## Reproducible local checks

```sh
node ops/recovery/test-backup.mjs
node_modules/.bin/tsx tools/recovery/openbao-lab.ts /absolute/path/to/verified/bao
```

The lab uses temporary loopback storage, test-only one-share initialization, actual API permission denials, redacted audit records, deletion of source data/audit files, a fresh Raft restore and comparison of an original encryption key. It writes a private lab report under `.superpowers/sdd/2026-10-10-passwordless-devices-and-vault-recovery/` and cleans temporary secret material. Never reuse test-only shares/tokens or describe a same-machine drill as independent-host qualification.
