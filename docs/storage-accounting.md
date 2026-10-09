# Hosted storage accounting — development branch

The backend counts one verified CID once per DAO, regardless of how many document versions or other hosted roles reference it. Different DAOs each count those bytes against their own capacity. A global ledger within the environment keeps every provider file ID for shared or duplicate pins. Multiple provider IDs do not multiply the DAO's logical usage.

Files count at their final stored size: private files include the encrypted envelope. Provider size, retrieved length and SHA-256 commitment must agree before a reference becomes verified. A CID is not assumed to be the SHA-256 of the original file; DAG imports can produce different CIDs. Only objects from the configured public CID-v1 single-file import profile can be reused, and reused bytes are retrieved and checked again.

An upload whose provider outcome is unknown still holds its expected bytes. Expiration or an empty provider listing cannot release that reservation. Externally supplied on-chain CIDs do not create Pinata ownership or storage charges. Archived content, versions, branding and media share normal storage pricing when they have hosted references; the Archive lifecycle is still being implemented.

`GET /v1/daos/:id/storage` requires an authenticated active member of that exact deployment. It returns configured capacity, unique verified bytes, unresolved held bytes, object/reference counts and the actual operator cleanup setting. No filenames or provider credentials are returned. Upload capacity is projected from the configured free allowance and immutable verified prepaid storage terms, independently of membership billing.

## Provider ownership

Mainnet and testnet use **separate Pinata accounts**, credentials, gateways, stable `PINATA_STORAGE_SCOPE` values and databases. This is an operator-chosen storage ledger label, not an ID issued by Pinata or a secret. For example, use `daclify-testnet` for the testnet account and `daclify-mainnet` for the separate mainnet account. Keep the label unchanged when rotating credentials for the same account. Use a different label for a different provider account. This label does not prove that a JWT belongs to that account; live credential/ownership qualification is required before destructive cleanup.

`PINATA_ACCOUNT_ID` remains a deprecated compatibility alias for existing deployments and the legacy upload-claim tool. Rename the environment key to `PINATA_STORAGE_SCOPE` while preserving its exact value; existing database ownership and billing records need no migration. Both names may coexist only with identical values. Conflicting values refuse startup/tool execution with `PINATA_STORAGE_SCOPE_CONFLICT`, and invalid values are rejected without printing them. Changing the label itself is a provider-account transition, not part of this rename.

Do not run two independent reference databases against the same Pinata account. Their local reference counts cannot protect each other's pins. Every DAO using one account must participate in that environment's global ledger.

Configure all three `PINATA_JWT`, `PINATA_STORAGE_SCOPE` and `CONTENT_GATEWAY`, or none. `CONTENT_FREE_STORAGE_BYTES=100000000` is the approved 100 MB decimal launch allowance per DAO. The examples retain `0` until the operator funds/configures hosting. Files remain bounded to 5 MiB per request.

## Existing uploads

Migration `022_storage_ledger.sql` preserves upload IDs, provider IDs, CIDs, commitments and full unresolved reservations. It does not infer provider ownership or trust old declared bytes. Previously verified receipts remain readable, but ordinary workers place unclaimed rows in manual review. Unversioned rows without a complete intent require manual reconstruction and cannot be claimed by this tool.

After applying the migrations and confirming which Pinata account originally owned an upload, use its private backend API environment:

```sh
DACLIFY_ENV_FILE=/absolute/path/to/private-api.env npm run storage:claim -- --claim-upload <upload-UUID>
```

This is an explicit operator write for one selected upload. It requires exactly one matching provider listing with the original ID/CID when known, retrieves bytes and validates the complete commitment. It then records ownership and the DAO reference atomically, preserving publication state. Wrong ownership, ambiguity or corrupt/unavailable bytes keeps the hold. Retry with the same account is safe. The tool does not change accounts, contract state, payment terms or remove provider files. Back up the database first; the command above is prepared tooling, not a command executed against live providers during development.

## Retention boundary

Automatic unpinning is disabled. Object generations and `removing` state fence references while guarded staging, leased provider removal and compensation have local regression coverage, described below. Billing projects the original thirty-day grace deadline. Provider qualification and operational enablement are still required. No file is deleted because of an expired upload reservation or unpaid membership subscription in this checkpoint.

## Governed resource policy and prepaid period helpers

The separate `resourcecfg` contract table records the Daclify DAO’s revisioned RAM fees, capacity targets and storage pricing. `govresources` uses the existing signed administrator context and requires the expected revision. A stale update or another DAO cannot change the policy. Native `setresources` is an operator bootstrap override, consistent with existing platform authority; a native operator retains upgrade/control authority. Runtime permission plans must link the new `govresources` action to the existing code-only `execctx` permission before its signed route works. This has only been applied to the owned fixture, not any public deployment.

The platform screen signs exact decimal inputs and shows that policies alone do not fund capacity or start billing. Approved monthly units bind the full immutable pricing hash, amount and recurring consent. Calendar/grace helpers are tested with January 31, leap February, month-end recovery, UTC daylight saving boundaries, future prepayment and the exact thirty-day deadline. Migration 023 records immutable approvals and invoice domains. Stripe reconciliation verifies the subscription, agreed product/quantity/price, full calendar period, paid invoice, invoice-payment records, matching succeeded PaymentIntents and paid charges. Checkout completion alone grants nothing. Refunded storage payments revoke funding while retaining the original grace deadline. Upgrades require a still-paid base period; reductions/newly accepted pricing begin next period. These checks have PostgreSQL and synthetic Stripe SDK coverage; they are not live provider certification.

## Storage billing configuration and user flow

Use a dedicated monthly storage Product in the environment’s Stripe account and configure `STRIPE_SECRET_KEY`, `DACLIFY_STORAGE_STRIPE_PRODUCT_ID` and `DACLIFY_STORAGE_WEBHOOK_SECRET` in the private API environment. The API creates immutable monthly USD per-unit Prices from accepted contract policy. Mainnet live charging additionally requires `DACLIFY_STORAGE_LIVE_PAYMENTS=true`; keep it false until sandbox qualification. Testnet accepts test keys only. Content hosting and its separate Pinata ownership scope must be configured first.

Create a separate webhook endpoint at `/v1/storage/stripe/webhook`. Deliver `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`. The adapter verifies HMAC/mode, deduplicates event IDs and retrieves authoritative provider state; webhooks are hints, not payment proofs. Background jobs repeat verification, with bounded retry and explicit review holds. A slow/expired lease can repeat read-only reconciliation; it cannot issue another checkout or charge.

In DAO Settings, open **Storage and blockchain resources**. Active members can read usage; only current administrators can approve units or stop renewal. A fresh root/linked-wallet account-control signature covers the exact approval body in addition to session/CSRF protection. At launch, 100 MB is included and each approved extra 1 GB costs $1 per calendar month. No upload triggers an automatic overage charge. Administrators see the exact total, accepted pricing, payment state, paid-through date and original grace deadline before authorizing recurring billing. Existing subscriptions keep accepted prices unless an administrator explicitly switches. Retained files can exceed the upload allowance during grace; further unfunded growth is blocked.

Cancellation stops renewal at period end and does not revoke the paid term. A renewal failure does not remove membership or reset retention. Provider/network ambiguity never authorizes deletion. Resources separates implemented purchases/configured cleanup from outstanding production qualification. Database backups must preserve agreements, invoices, pending changes, ownership records and jobs; chain-only recovery does not reconstruct Stripe or Pinata ownership.

## Observer runtime upgrades

An enabled observer rejects callbacks after runtime code changes until its native authority calls `rebindramobs` with both the expected previous observer hash and the exact reviewed newly deployed runtime hash. The action changes only that code pin; it does not reset counters, rewrite DAO/member/document rows, allocate RAM or enable the observer on old untracked state. It is native maintenance authority, outside signed DAO member actions. Plan a reviewed maintenance window: writes to an enabled observer deployment are held between code replacement and successful rebinding. Native code/ABI overhead remains a platform provisioning responsibility.

The owned regression reproduces commit 81afcba with `npm exec -- tsx tools/build/upgrade.ts --observer`, upgrades a disposable initialized observer with existing DAO/member/document state, rejects unauthorized/stale/wrong-code/replayed rebinding, verifies unchanged counters/state and resumes metered writes. This qualifies that tested observer upgrade; legacy backfill, physically funded allocations, all-source upgrade conformance and public deployment remain pending.

## Native acquisition checkpoint

`orderram` binds a permanent request reference to one DAO, its native funding account, current policy revision, at most six ordered current core/installed-module receivers, per-receiver native spend/minimum acquired bytes, payment ceiling and expiry. The payer authorizes the order; an `eosio.token::transfer` with `ram:<64-lowercase-hex-reference>` supplies funds. The TLOS rail snapshots the current native policy, default 5%; no Connect commission or generic conversion premium is added. This development path requires an initialized observer and the pinned qualified ordinary Telos system build. Managed-RAM receivers and changed/unapproved source code are rejected.

Incoming funds pay for real system `buyram` actions. A sender-checked callback runs afterward, verifies every actual quota increase and writes order evidence plus permanent per-DAO/payer purchased-byte credit. Only after every receiver succeeds does the runtime transfer the accepted fee to its separately configured native treasury and return change to the original payer. Purchases never debit DAO available/stake/claim balances. An impossible minimum rolls back all receivers, credits, fees and incoming funds; a used reference cannot buy again.

The [local measurement](evidence/2026-10-08-ram-purchase.json) records quota/balance conservation and rejected payment/receiver/revision boundaries against the pinned system WASM. Fixture market reserves are artificial; its bytes-per-TLOS result is not a public-network price. Native code/ABI, permissions and rows billed by external token/system contracts remain platform provisioning overhead. The [Telos system implementation](https://github.com/telosnetwork/telos.contracts/blob/master/contracts/eosio.system/src/delegate_bandwidth.cpp) applies its system acquisition fee within the base `buyram` amount; Daclify applies its markup once on that complete amount. The owned fixture separately verifies the pinned executable.

This is acquisition groundwork. Included allocations, per-payer pool conservation, quota enforcement and completion reserves, quote API/UI, segregated card reserve and public-chain/provider qualification remain required before hosted purchasing is enabled. Purchased byte credits never expire or sell automatically for hosting arrears.

## Shared verified-reference recording

Document verification and explicit legacy ownership reconciliation now use one internal `recordVerifiedPin` path for object ownership, provider IDs, size/commitment checks, removal fencing and idempotent typed references. It supports the existing document, branding, media and archive ledger roles; no PostgreSQL migration or old receipt rewrite was needed. One CID remains one logical charge per DAO across these roles. Reusing an upload receipt for another role/reference is rejected instead of silently accepting its conflict.

This helper is for trusted verification workers. They must reserve the DAO's funded capacity before uploading, retrieve and verify the provider's actual bytes, then call it within their transaction. It is not a public upload endpoint and does not establish archive source eligibility or provider-account identity. Branding/archive reservation, upload/reconciliation and publication lifecycle handlers remain required before those features are offered; no new pin or deletion is performed by this checkpoint.

## Artifact reservations and transport

Migration 024 adds immutable asset request/ownership domains and durable provider/CID/object verification fields. The internal `HostedAssets` transport supports branding, media and archive references through the same Pinata account, import profile, funded allowance and DAO lock as documents. Asset requests bind their UUID, DAO, role, opaque reference key, actual encoded byte count and commitment. The host must have funded storage; requests do not create a subscription.

Every new artifact reserves bytes before provider upload. A known CID already charged to that DAO can be reused without charging it twice, but its bytes are retrieved and checked again. An unknown upload holds all expected bytes even after expiration or an empty provider listing. Reconciliation can recover a verified provider response; ambiguous/corrupt responses go to retry/review without removal. Asset jobs use a separate namespace in the existing stoppable host polling loop, not a new server or queue fleet.

Archive transport uses this internal API. The narrow authenticated `POST /v1/branding/uploads` route additionally permits current administrators to upload PNG/JPEG/WebP public logos or covers up to 2 MiB with explicit public consent. It validates size, commitment and format before pinning. Uploading is separate from the ordinary signed metadata update and immediately consumes hosting capacity. General document/media files use the existing document upload/publish flow; there is no arbitrary public Archive-asset uploader. No IPFS file or contract row is deleted by the transport.

## Retention selection and guarded cleanup — development

Resources lets administrators prioritize whole verified objects within the free allowance. Selections use a generation check so concurrent administrators cannot silently overwrite each other. Newest whole objects fill remaining capacity; a CID counts once for a DAO across roles. Missing provider results retain their holds and pause removal. A 30-day deadline uses the original verified term, independently of membership invoices; current funded capacity and reduction grace remain protected.

The cleanup engine uses existing SQL jobs, per-DAO/object locks, generation-fenced leases and an immutable removal audit. It verifies the original bytes and stages at most 5 MiB per removal in PostgreSQL before provider deletion. Shared references and unfinished object reservations prevent unpinning. New references are blocked while an object is being removed. Payment is freshly reconciled before removal and afterward. If payment invalidates removal, the worker re-pins and verifies the staged bytes before restoring availability. Uncertain providers, lost leases and failed compensation pause for review; failed jobs back off without resetting the original grace deadline. Terminal staging is cleared, not retained as an undeclared backup service.

There is an external-provider visibility window: PostgreSQL, Stripe and Pinata cannot commit atomically. The operator must qualify compensating re-pin behavior and review monitoring before enabling the worker. Startup leaves cleanup disabled by default and requires an explicit operator setting to start it. No existing user/provider files have been removed.

## Worker enablement

`DACLIFY_STORAGE_CLEANUP_ENABLED=false` is the default. Setting it to `true` explicitly starts the existing bounded, stoppable retention worker and injects the hosted-billing provider's current-payment reconciliation before removal. Startup rejects malformed values and enabled cleanup without both content ownership and storage billing configuration. Resources/Status report this actual operator setting. The setting is permission to execute, not evidence of provider health or qualification.

Keep it false until the intended separate Pinata account and Stripe test/live mode have passed controlled upload/retrieve/unpin/repin and payment-race checks, global pin references and payment receipts are recovered, staged-copy recovery and monitoring are reviewed, and the operator approves execution. A lost database starts with no trustworthy global payment/reference inventory: rebuild it before enabling cleanup. This development work leaves all private env files and live cleanup settings unchanged.


Archive retention groups use host migration 029 and module migration 005. A manifest and its verified chunks fit or leave the allowance together. Overlapping groups count shared CIDs once. Curation shows the complete retention plan, including dependencies, and rejects a selected bundle that exceeds the free allowance. A removed member makes the remaining bundle incomplete; retries can finish eligible removal without retaining a misleading partial archive. Original file blobs remain separately pinned/billed. Recovery groups only verified surviving owned archive objects, and does not infer paid service from any CID.


## Failed uploads and provider absence

A missing entry in a provider listing never releases an upload reservation. For an expired, unverified upload with a recorded provider ID, the worker can check that exact ID on the same configured provider account. Only confirmed absence releases that unfinished reservation. The DAO lock and conditional update fence concurrent verification; the original provider ID/scope and release timestamp remain in SQL audit state. A provider error, an unknown ID, a verified object, a published native reference or an Archive-owned hold stays held for reconciliation. This path does not delete a file or alter a native document.

Pinata removal now requires a direct follow-up read confirming the recorded ID is absent. An acknowledgment with the file still present returns `PINATA_REMOVAL_PENDING`; cleanup retains its staged recovery data and retries. Authentication, throttling, network and malformed responses do not establish absence. These HTTP contract tests are not live Pinata account/absence qualification; credential/account binding remains an operator release gate. Endpoint reference: https://docs.pinata.cloud/api-reference/endpoint/get-file-by-id .


## Storage reminders

Resources shows period-bound renewal, grace and billing-review notices. The original paid-through/grace dates do not change on a retry. Email is an explicit operator opt-in through `DACLIFY_STORAGE_NOTICES_ENABLED`; complete SMTP and storage billing configuration are required. The leased worker queues at most one job per agreement, original period and stage, rechecks fresh billing and current administration before delivery, and uses the current billing administrator’s paired email. Delivery retries stop after 12 attempts for operator review. Missing contact/failure is visible in failed/pending jobs and needs operator review; in-app notices remain readable. Stage reminders are scheduled within seven days of renewal, at grace start, within seven days of the original deadline, after hosting grace ends, or when billing needs review. The worker scans bounded batches with persisted check times.

Renewal and revoked administrator access cancel an obsolete delivery. SMTP can accept a message before a response is lost; retries can send a duplicate even with a stable Message-ID. Notification failure does not reset grace or invent paid capacity. Mail configuration does not certify deliverability, nor does enabling a reminder worker qualify destructive cleanup. Live SMTP/Pinata/payment verification remains required.

## Dedicated gateway access and bandwidth gate

`CONTENT_GATEWAY_KEY` sends the server-only key in `x-pinata-gateway-token` during bounded content retrieval. It never uses a query parameter and never sends the Pinata API JWT to the gateway. Existing unkeyed local/provider setups remain compatible; setting this variable does not configure or qualify the provider account.

Configure a matching gateway-key restriction separately for each mainnet/testnet account. Pinata combines multiple access controls with OR: adding a permissive origin/IP rule can bypass the key restriction. Verify unauthenticated requests to a known owned CID fail, authenticated server retrieval succeeds, redirects are refused, and the API/frontend never expose the key. See [official access-control behavior](https://docs.pinata.cloud/gateways/gateway-access-controls). Public encrypted IPFS remains retrievable through other providers; this protects the paid gateway, not secrecy or deletion of IPFS copies.

A funded, enforceable bandwidth allowance and verified provider spending cap remain launch gates. There is no configured per-DAO bandwidth charge or a claim that application request limits prevent direct gateway billing. Do not advertise unlimited access.

## Operator removal/recovery alerts

`DACLIFY_STORAGE_ALERT_EMAIL` opts a configured operations mailbox into scope-bound removal/recovery incident notifications. Complete SMTP and Pinata content configuration are required. The existing job worker queues one alert per object/generation, checks the current incident before sending, retries at most 12 times and cancels only a terminal removed/canceled incident. A temporary in-flight recovery defers delivery; it does not declare the incident resolved. Status shows whether the worker is configured.

Alerts contain only incident IDs and public operating instructions, never staged file bytes, grants, signing keys or provider credentials. They neither delete the protected staged copy nor acknowledge/clear a removal incident. Delivery can duplicate after an ambiguous SMTP response. Failed delivery remains visible in the private jobs table for operator review; SMTP qualification and monitored operator response are required before enabling destructive cleanup.


## Complete provider inventory

Pinata upload/CID reconciliation follows bounded provider cursors through an empty terminal page. A nonempty cursor on a small result is not proof of truncation. The adapter retains its ten-object reconciliation limit, rejects duplicate IDs/cursor loops/mismatched ownership and never reports partial inventory as complete. This is required for lost-upload-response and chain-reference recovery. The 2026-10-09 live synthetic-object drill found and fixes the previous early refusal; account separation, protected gateway funding and full retention compensation remain separate qualification.
