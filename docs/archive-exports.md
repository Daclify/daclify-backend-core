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
