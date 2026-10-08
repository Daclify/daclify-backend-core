# Archive exports — development operations

The current host exports eligible ordinary-poll votes; it does not prune source rows. The public format, route schemas, consent calculation, manifest assembly and standalone decoder belong to `@daclify/modules/archive`. Core owns PostgreSQL adapters, authorization, reservations, Pinata I/O and the existing outbox host.

Use separate Pinata accounts, credentials, gateways, stable ownership IDs and databases for mainnet/testnet. Before provider cleanup can be enabled, qualify actual credential ownership and the environment's complete global pin ledger. Export does not enable cleanup.

In Resources, an active administrator previews a finalized poll and approves the displayed maximum byte reservation. It uses existing funded hosting capacity and ordinary storage pricing. It creates no checkout, subscription change or deletion approval. The host rereads qualified immutable source coverage; changed row/source consent is rejected. The snapshot can advance while the selected immutable rows remain identical.

Migration 025 records the complete archive hold, and Archive migration 002 binds transport metadata/request IDs to the frozen export domain. Each chunk or manifest asset transfers its incremental logical bytes from that hold in the same transaction as its immutable reservation/outbox entry. Known CIDs still count once per DAO. Unknown outcomes never give the reservation back. Retries use saved UUIDs and verified pins; each reconciliation advances one chunk or the manifest. Only unused budget is released after complete manifest verification is committed.

Saved exports are listed for authorized administrators after page/server restarts. The original requester must still be an active administrator for worker completion. Revocation or uncertain provider ownership enters review and keeps files/holds. Reassignment, cancellation and orphan release are not implemented. Export completion does not attest an independent backup or authorize pruning. Native anchors, approved pruning and historic browsing remain separate gates.

Download the recovery JSON and store its displayed SHA-256 separately, off the server. Verify locally with the matching module decoder package:

```sh
npm run archive:verify -- /absolute/path/to/bundle.json <expected-manifest-sha256>
```

The command reads no application database and writes no blockchain/provider state. It bounds the input, checks the separately supplied manifest commitment, complete chunk coverage, roots, domains, qualified source schema and original packed rows. Output contains only public summary identifiers/counts. It cannot authenticate a supplied commitment against blockchain provenance until native anchors exist. A hash embedded in an editable file is not an independent trust source.

This export contains ordinary-poll votes and their manifest, not account keys, login pairings, original document files or the complete service database. Continue per-user recovery-kit and PostgreSQL backups. Keep the qualified historical package with the bundle; the current unpublished development decoder supports its own compiled source schemas only. Download failures leave prior backups and all hosted/on-chain data intact.

## Independent encrypted backup

The optional Archive backup action creates an authenticated AES-256-GCM copy of the complete verified recovery bundle. It writes only ciphertext to an owner-only directory, syncs the file and directory, restores and verifies every bundled record, then saves an immutable receipt. A retry reads the original file; it does not overwrite it. File identity, full DAO domain, manifest SHA-256, store/key identifiers and timestamp are authenticated. The receipt additionally commits the exact encrypted file bytes.

Configure all four `ARCHIVE_BACKUP_*` values or leave the feature off. The directory must be owned by the API user with no group/other permissions. Files use mode 0600 and symlinks are rejected. Mount a separate backup failure domain and qualify its durability, available disk space and restore procedures; a second folder on the API disk does not make an independent backup. The service cannot verify physical independence from a pathname. No new cloud backup provider or automatic pruning is implied.

Keep the backup encryption key and its identifier offline, separately from the database/server and encrypted files. Keep older keys after rotation: existing backup files and receipts are immutable. Losing this operator backup key makes this additional copy unreadable. Member document-decryption keys and recovery kits remain separately required to open private document contents; this backup does not contain those keys, social pairings or original document file blobs.

Resources → Archive shows backup configuration and the immutable verification receipt. An active administrator can request creation for the exact displayed manifest commitment. A stale manifest, changed authority, corrupt backup or uncertain filesystem result blocks the receipt. Unknown/lost SQL responses can be recovered from the exact existing encrypted file. Primary IPFS bundle retrieval can fall back to the configured backup only after matching the saved manifest and encrypted-file commitments. Both sources failing is explicit unavailability, never empty history.

To independently verify an encrypted backup with no API or PostgreSQL, put its original key in private local environment configuration as `ARCHIVE_BACKUP_KEY`, then run:

```sh
npm run archive:verify -- --encrypted /path/export.daclify-archive.enc EXPECTED_MANIFEST_SHA256
```

Keep the expected manifest SHA-256 separately from the backup file. Do not put the key in command arguments, chat or source. The same command without `--encrypted` verifies the downloaded JSON bundle. Native approval/anchors and bounded ordinary-poll pruning are implemented in development. Complete history/private-content rebuilding and release qualification remain gates. A backup receipt is evidence of the tested verification event, not a claim of current perpetual availability or pruning authority.

## Manual native archive authorization — development

The development runtime can retain an immutable on-chain ordinary-poll manifest descriptor, manifest CID/SHA-256, encrypted-backup commitment and retention delay. Availability attestation and administrator approval are distinct. `archattest` requires the configured verifier account. `archapprove` and `archrevoke` require the exact DAO administrator's signed instruction through the existing vault/native/EVM governance path. The operator cannot approve on behalf of an administrator.

An operator configures `setarchcfg` only after complete qualified observation exists. Its verifier must match the API relay account for the hosted attestation route. The minimum retention cannot be below 90 days. Keep `pruning_enabled=false` until the remaining source-pruning, allocation/migration and recovery release gates pass. No environment flag enables deletion automatically. Existing deployments lacking safe observation still require backfill before this setup; this branch does not qualify their upgrade.

The hosted attestation action requires current administrator/session/CSRF access and exact displayed manifest, descriptor, backup and delay. The host freshly restores the independent encrypted file, validates released source schemas and maps it through the producer-owned native encoder. Native anchors accept one ordinary-poll family, no original file references, at most 32 chunks and a 16 KiB action. Larger/multiple/protected-family exports remain downloadable exports without native pruning authorization.

Anchors freeze the original payload and retention. Repeated verifier attestations update availability time without duplicating the anchor or completion cursors. Cursors are physically allocated at attestation so later progress updates need no new rows. Native transaction IDs identify attestation and approval; the API retrieves an unchanged irreversible receipt before recovering an ambiguous response. This trusts the configured qualified RPC and operating verifier; it is not independent cryptographic proof of IPFS availability. A timestamp documents a verification event, not perpetual availability.

Approval binds all three commitments and the exact accepted delay. Attestation must be no older than 15 minutes and come from the currently configured verifier. Replacing the verifier invalidates its old attestation until the replacement verifies the identical payload. Another current administrator may approve the same immutable payload. Revocation preserves the anchor and previous receipt and does not require backup access or a current source-code pin; source pruning must subsequently honor it.

Resources separates export reservation, encrypted backup creation, on-chain availability, signed approval and revocation. Longer retention can be chosen when previewing. Approval never calls a pruning action or unpins files. Current source-code changes block new approval; replacing source contracts does not silently rewrite the original commitment. Bounded ordinary-poll pruning and trusted pre-pruning schema reads are implemented in development; remaining migration, broader history/private-content recovery and production qualification remain required.

New availability attestations require fresh retrieval of both the primary manifest/chunks and the independent encrypted backup. Download recovery may use the backup during a primary outage; that does not qualify a new pruning attestation.

## Bounded ordinary-poll pruning and database-independent history

After operator qualification, the runtime pruning switch permits Decide to prune only finalized ordinary-poll votes. Elections, work/award execution plans, document versions and financial records are excluded. Every batch has at most 25 proofs and a 16 KiB encoded action. Decide checks current source pins, current administrator approval, revocation, fresh availability, actual terminal time plus the immutable retention delay, the current packed row and its domain-bound Merkle proof. Erasure, metering and the runtime completion cursor commit or roll back together. Retries do not erase or free bytes twice. A permanent vote high-water mark prevents reusing IDs after the last vote row is erased; ballots, results and tallies remain.

The resource UI makes each batch a separate manual action. It refreshes primary and backup retrieval before submitting a batch. Approval alone never prunes. Keep the global pruning switch off until allocation, migration, complete restoration and target-chain qualification are reviewed.

The owned native fixture restored production WASM after fixture-only aging of a terminal poll. Its real proof deletion freed 401 bytes: 289 row/index bytes and 112 last-row table-header bytes. Ballot/tallies were preserved and replay freed nothing. This qualifies one real native deletion; worst-case 25-row/depth-16 CPU and reviewed public Telos targets remain qualification work.

On-chain archive history uses the native anchors directly and needs no original PostgreSQL export index. Current DAO members can discover anchors, verify manifest/chunks against their commitments, browse stable original vote IDs and download a recovery bundle. Historical schemas are producer-owned retained snapshots; arbitrary downloaded ABIs are never decoder authority. A recovery download has a stable commitment-derived UUID when the old SQL export UUID is unavailable. Surviving pins are required for hosted discovery/retrieval; separately saved encrypted backups still work with the database-free verifier. Missing or corrupt assets are explicit unavailable errors. Billing receipts and social-login pairings are not reconstructed from CIDs. Live/archive merged queries and full private-document index restoration remain unfinished.
