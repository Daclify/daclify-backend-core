# Hosted storage accounting — development branch

The backend counts one verified CID once per DAO, regardless of how many document versions or other hosted roles reference it. Different DAOs each count those bytes against their own capacity. A global ledger within the environment keeps every provider file ID for shared or duplicate pins. Multiple provider IDs do not multiply the DAO's logical usage.

Files count at their final stored size: private files include the encrypted envelope. Provider size, retrieved length and SHA-256 commitment must agree before a reference becomes verified. A CID is not assumed to be the SHA-256 of the original file; DAG imports can produce different CIDs. Only objects from the configured public CID-v1 single-file import profile can be reused, and reused bytes are retrieved and checked again.

An upload whose provider outcome is unknown still holds its expected bytes. Expiration or an empty provider listing cannot release that reservation. Externally supplied on-chain CIDs do not create Pinata ownership or storage charges. Archived content, versions, branding and media share normal storage pricing when they have hosted references; the Archive lifecycle is still being implemented.

`GET /v1/daos/:id/storage` requires an authenticated active member of that exact deployment. It returns configured capacity, unique verified bytes, unresolved held bytes, object/reference counts and the disabled cleanup state. No filenames or provider credentials are returned. Upload capacity is projected from the configured free allowance and immutable verified prepaid storage terms, independently of membership billing.

## Provider ownership

Mainnet and testnet use **separate Pinata accounts**, credentials, gateways, stable `PINATA_ACCOUNT_ID` values and databases. Keep an ownership ID unchanged when rotating credentials for the same account. Use a different ID for a different provider account. This ID is an operator-supplied namespace, not proof that a JWT belongs to that account; live credential/ownership qualification is required before destructive cleanup.

Do not run two independent reference databases against the same Pinata account. Their local reference counts cannot protect each other's pins. Every DAO using one account must participate in that environment's global ledger.

Configure all three `PINATA_JWT`, `PINATA_ACCOUNT_ID` and `CONTENT_GATEWAY`, or none. `CONTENT_FREE_STORAGE_BYTES=100000000` is the approved 100 MB decimal launch allowance per DAO. The examples retain `0` until the operator funds/configures hosting. Files remain bounded to 5 MiB per request.

## Existing uploads

Migration `022_storage_ledger.sql` preserves upload IDs, provider IDs, CIDs, commitments and full unresolved reservations. It does not infer provider ownership or trust old declared bytes. Previously verified receipts remain readable, but ordinary workers place unclaimed rows in manual review. Unversioned rows without a complete intent require manual reconstruction and cannot be claimed by this tool.

After applying the migrations and confirming which Pinata account originally owned an upload, use its private backend API environment:

```sh
DACLIFY_ENV_FILE=/absolute/path/to/private-api.env npm run storage:claim -- --claim-upload <upload-UUID>
```

This is an explicit operator write for one selected upload. It requires exactly one matching provider listing with the original ID/CID when known, retrieves bytes and validates the complete commitment. It then records ownership and the DAO reference atomically, preserving publication state. Wrong ownership, ambiguity or corrupt/unavailable bytes keeps the hold. Retry with the same account is safe. The tool does not change accounts, contract state, payment terms or remove provider files. Back up the database first; the command above is prepared tooling, not a command executed against live providers during development.

## Retention boundary

Automatic unpinning is disabled. Object generations and `removing` state prepare the reference fence: verification rejects a new reference to an object being removed. Billing projects the original thirty-day grace deadline. Staged ciphertext backup, provider leases and compensation are still required before removal can be enabled. No file is deleted because of an expired upload reservation or unpaid membership subscription in this checkpoint.

## Governed resource policy and prepaid period helpers

The separate `resourcecfg` contract table records the Daclify DAO’s revisioned RAM fees, capacity targets and storage pricing. `govresources` uses the existing signed administrator context and requires the expected revision. A stale update or another DAO cannot change the policy. Native `setresources` is an operator bootstrap override, consistent with existing platform authority; a native operator retains upgrade/control authority. Runtime permission plans must link the new `govresources` action to the existing code-only `execctx` permission before its signed route works. This has only been applied to the owned fixture, not any public deployment.

The platform screen signs exact decimal inputs and shows that policies alone do not fund capacity or start billing. Approved monthly units bind the full immutable pricing hash, amount and recurring consent. Calendar/grace helpers are tested with January 31, leap February, month-end recovery, UTC daylight saving boundaries, future prepayment and the exact thirty-day deadline. Migration 023 records immutable approvals and invoice domains. Stripe reconciliation verifies the subscription, agreed product/quantity/price, full calendar period, paid invoice, invoice-payment records, matching succeeded PaymentIntents and paid charges. Checkout completion alone grants nothing. Refunded storage payments revoke funding while retaining the original grace deadline. Upgrades require a still-paid base period; reductions/newly accepted pricing begin next period. These checks have PostgreSQL and synthetic Stripe SDK coverage; they are not live provider certification.


## Storage billing configuration and user flow

Use a dedicated monthly storage Product in the environment’s Stripe account and configure `STRIPE_SECRET_KEY`, `DACLIFY_STORAGE_STRIPE_PRODUCT_ID` and `DACLIFY_STORAGE_WEBHOOK_SECRET` in the private API environment. The API creates immutable monthly USD per-unit Prices from accepted contract policy. Mainnet live charging additionally requires `DACLIFY_STORAGE_LIVE_PAYMENTS=true`; keep it false until sandbox qualification. Testnet accepts test keys only. Content hosting and its separate Pinata ownership scope must be configured first.

Create a separate webhook endpoint at `/v1/storage/stripe/webhook`. Deliver `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`. The adapter verifies HMAC/mode, deduplicates event IDs and retrieves authoritative provider state; webhooks are hints, not payment proofs. Background jobs repeat verification, with bounded retry and explicit review holds. A slow/expired lease can repeat read-only reconciliation; it cannot issue another checkout or charge.

In DAO Settings, open **Storage and blockchain resources**. Active members can read usage; only current administrators can approve units or stop renewal. A fresh root/linked-wallet account-control signature covers the exact approval body in addition to session/CSRF protection. At launch, 100 MB is included and each approved extra 1 GB costs $1 per calendar month. No upload triggers an automatic overage charge. Administrators see the exact total, accepted pricing, payment state, paid-through date and original grace deadline before authorizing recurring billing. Existing subscriptions keep accepted prices unless an administrator explicitly switches. Retained files can exceed the upload allowance during grace; further unfunded growth is blocked.

Cancellation stops renewal at period end and does not revoke the paid term. A renewal failure does not remove membership or reset retention. Provider/network ambiguity never authorizes deletion. The Resources screen explicitly labels automatic cleanup and RAM purchases as unfinished. Database backups must preserve agreements, invoices, pending changes, ownership records and jobs; chain-only recovery does not reconstruct Stripe or Pinata ownership.
