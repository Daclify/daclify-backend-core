# Upgrade to the 0.8.0-alpha.1 development candidate

This candidate adds RAM accounting/acquisition, prepaid pinned storage and the Archive service. Contract interface, member IDs, signed instruction domains and document-encryption domains remain at version 1. Current C++ artifacts are the previously qualified resource packet; the 0.8 metadata bump itself does not change their bytes. Earlier 0.7 production/development deployments can have different binaries: compare exact code and raw ABI hashes, not package labels.

## Preserve the existing deployment

Inventory the chain/runtime/Hub identities, native permissions, every installed source pin, DAO/member IDs, open claims/obligations/stakes and pending executable proposals. Keep the original artifacts needed to finish already-approved work. Never rewrite an approval's saved Works/Grants/Decide hash to make an upgrade pass. Drain it under its approved code or use a separately reviewed DAO-authorized migration. Read [RAM migration](ram-migration.md) for unobserved backfill and completion-only adoption on already-observed deployments.

Back up PostgreSQL, provider ownership/billing/gateway ledgers, original archive bytes and private configuration off-host; test restore before cutover. Retain original user recovery kits and document-decryption keys. Social pairings, payment receipts and provider funding are service records and are not reconstructed from chain documents. [Disaster recovery](../disaster-recovery.md) explains the boundaries.

## Build and migrate locally first

1. Check out all three matching revisions as siblings. Generate producer docs, then run `node tools/bootstrap.ts --contracts` in core. Build and verify all three consumers using the pinned tools. Module package/core peer versions and frontend help must match 0.8; keep stable wire identities.
2. Apply reviewed PostgreSQL migrations through the existing coordinator. Core migrations 022–031 and hash-tracked Archive migrations 001–005 preserve existing records. Use the packed Archive migration export; do not rename or rewrite previously applied migration bytes.
3. Update configured module release versions to the exact 0.8 package, preserving reviewed deployed code pins. Review the production permission builder and source-specific callbacks. Relayer keys must not become native owners, runtime code or pruning approvers.
4. For an actual contract replacement, follow the migration runbook's bounded scans, original-code drain, source rebind, completion adoption and exact payer reconciliation. Fund each physical payer separately. Activate each DAO guard only after required credentials, references, allocation backing and finite completion holds qualify. Do not reset counters or silently grant unlimited resources.
5. Prepare the runtime's supported token balance row before first funding; receiving wallets pay for their own token rows. Existing legacy token row payers remain unchanged by `open`. Track external runtime-paid token overhead separately from DAO rows. Partial claims need ordinary RAM; full-claim emergency exits have the finite reserved path.

## Configure services explicitly

Native RAM buys charge one 5% fee, card provisioning one 20% operational markup; card money does not magically supply TLOS. Fund the segregated native provisioning reserve and verify actual receiver quota increments before crediting orders. Storage is billed monthly in advance: 100 MB included, $1 per additional decimal GB, independent of member capacity and RAM. Archives and their original files remain pinned and count toward the same storage bill. An unpaid original term has a maximum 30-day grace; later payment does not reset that clock or restore already unavailable provider bytes.

Mainnet and testnet require separate Pinata accounts. Configure stable ownership scope, protected dedicated gateway and a genuinely funded [gateway allowance](gateway-allowance.md). Keep `DACLIFY_STORAGE_CLEANUP_ENABLED=false` through configuration and recovery testing. Archive export/backup does not authorize pruning; exact native availability attestation and administrator approval are separate.

Testnet HTTPS frontend/API addresses are not yet deployed as of 2026-10-09. The planned `https://testnet.app.daclify.com` and `https://testnet.api.daclify.com` are plans, not working callbacks. Register Telegram OIDC and Stripe Connect only after the selected addresses are reachable. A bot token is not an OIDC client. External SMTP, provider products/webhooks and production OpenBao custody require their own tested setup; local Mailpit/OpenBao do not certify production operations.

## Acceptance and cutover

Use the [0.8 acceptance record](../evidence/2026-10-09-resource-completion.md) and [evidence-bound packaging procedure](release-qualification.md). Rehearse native conservation, actual old-release adoption/drain, full-claim exits, private original-kit restore from an empty database, corrupt/unavailable archive handling, payment/provider outage and desktop/mobile access. Keep unverified gates open.

Review the immutable candidate and target authorities before separately authorized public deployment. Start with non-destructive observation, reconcile all payers and liabilities, then explicitly enable eligible DAO guards. Production pruning/retention and mainnet spending need their own reviewed release/configuration. A successfully built 0.8 package is not permission to delete data.
