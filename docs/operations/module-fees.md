# Monthly module access

Every existing first-party module is free for a DAO with at most **10 active members**, including managers. Above ten, enabled modules have separate governed USD monthly prices per DAO. Membership capacity, storage, RAM and the DAO's own merchant products have separate accounting.

The testnet activation schedule is Decide **$2**, Works **$3**, Payroll **$3**, Grants **$2**, Endorsement **$1**, Community Activity **$1** per DAO per month; all six total **$12**. Read `/v1/modules/pricing` or Pricing for the current native configuration. Catalogue TLOS usage prices are a different policy.

Administrators open **DAO Settings → Hosting and payments → Manage module access**. Each approval purchases one calendar month through Stripe Checkout. **Renewal is manual**; no subscription or automatic future charge is created. Renewal opens seven days before expiry and preserves already-paid time. Calendar months clamp month-end dates, including leap years. A drop to ten members restores free access without automatically refunding a used paid interval.

Only new activity is gated: ordinary polls/elections, new work/agreements, payroll commitments, grant rounds/applications, admission applications and Community Activity records. Existing votes, grant award processing, reviews, work completion, edits, cancellations, withdrawals and payouts remain available. Login, recovery, membership identities, encrypted documents and signing keys do not depend on paid module access. Disabled installations still follow their original completion rules.

## Authority and receipts

The linked platform DAO's active administrator signs `govmodfee` through the existing native, vault or activated EVM governance path. The action binds a prior revision, integer USD cents and bounded creation-action names. Prices can be zero; paid card prices must be at least 50 cents. Completion actions cannot be added to its fee policy. The native `modfees` table has at most 32 plans, no secondary index and at most 16 distinct action names per plan.

The runtime checks its authoritative active member count and the DAO-scoped `modterms` expiry/revocation before dispatching priced member instructions. This includes restricted connected-app sessions. Module records contain an account, expiry, opaque receipt and revocation flag; no task detail or card data is stored. Terms use operator-funded RAM, have no secondary index and are bounded by the plan count. `clearmterms(dao_id,after,limit)` safely scans at most 25 rows and removes only expired terms; use the last scanned native account-name integer as the next cursor. Renewals re-use a fixed row.

The existing hosted-capacity settler alone can attest, revoke or restore module terms through restricted Relay `operator` links. A prior-receipt guard rejects delayed fulfillment replacing a newer term; same-receipt retries cannot extend expiry. Revocation and restoration affect only the matching current receipt. Native settlement trusts this issuer to verify off-chain USD payments; it does not verify Stripe itself.

## Service configuration and recovery

Set `DACLIFY_MODULE_FEES_ENABLED=true`, the existing `STRIPE_SECRET_KEY`, and `DACLIFY_MODULE_FEES_STRIPE_ACCOUNT_ID` to the verified operator account. Testnet requires a test-mode key. Mainnet additionally requires a live key and explicit `DACLIFY_MODULE_FEES_LIVE_PAYMENTS=true`; this testnet rollout does not enable mainnet. Inline Checkout price data avoids an additional product or webhook. Never expose provider credentials to the frontend.

The service verifies the actual Stripe account, saved Checkout session, approved metadata/DAO/module/price hash, USD amount, successful payment intent, captured charge, refunds and disputes. PostgreSQL uniqueness prevents reusing a payment intent or creating competing unfinished purchases for a DAO/module. A checkout return is not proof. The exact paid interval and prior native receipt are committed before publication, so an API crash or lost chain acknowledgement can resume without extending access or charging again.

The bounded recovery poll processes up to 25 due orders, rechecking active payments every five minutes. Refunds, unresolved disputes and invalid receipts revoke only their matching native term. A won dispute can restore an unexpired matching term. A payment becoming unnecessary before first fulfillment because the DAO is free, the module changed/disabled, or the approver lost administrator rights is refunded. Provider/network failures remain pending; they do not grant access. An unknown expired Checkout or invalid proof enters review and blocks a competing purchase. Operator review must check the actual provider receipt before resolving an order; never delete it to force another charge.

Back up migration `039_module_fees.sql`, orders and existing payment/provider mappings with PostgreSQL. Database loss can preserve the current native access interval, but loses provider reconciliation history until restored. Keep the current native settler and action links; replacing its keys is outside this feature. Deploy matched core API/SDK/frontend artifacts and requalify recovery against the new exact core version.

See [the implementation ledger](../superpowers/plans/2026-10-11-monthly-module-fees.md) for measured checks and [testnet IPFS](testnet-ipfs.md) for provider limits. Development/testnet evidence does not qualify a mainnet release.
