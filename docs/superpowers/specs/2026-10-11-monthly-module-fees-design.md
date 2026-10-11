# Monthly first-party module access

The user authorized the proposed module prices and requested activation on testnet plus live encrypted-document checks. Existing first-party modules are free for a DAO with at most ten active members, including its managers. Above ten, prices are monthly per DAO: Decide $2, Works $3, Payroll $3, Grants $2, Endorsement $1 and Community Activity $1. Hosting and IPFS storage remain separate. Public and private DAOs use the same membership threshold.

## Implementation choices

Each administrator-approved card payment buys one calendar month of access for one installed module. Renewal is manual in this first version; passing the membership threshold does not create a card charge. A zero configured rate makes the module free at every size. Platform governance configures each first-party module's USD-cent rate, revision and bounded list of actions that start new activity. Legacy catalogue TLOS usage prices retain their existing meaning.

The runtime checks the authoritative active member count and paid expiry before executing those actions through any member signing path. Completion, review, cancellation, withdrawal and settlement actions stay usable, including work opened during an earlier paid term. Legacy direct module entry requires privileged runtime authorization and is not an ordinary member bypass. Core accounts, DAO membership, documents and recovery remain available without module access payments.

Initial chargeable actions: Decide `open` and `newelect`; Works `propose` and `offeragr`; Payroll `commit`; Grants `newround` and `applygrant`; Endorsement `applyjoin`; Community Activity `recordact`. Recall and completion actions remain available. Native rejection must roll back the member nonce and all module side effects.

Two native tables suffice: global prices keyed by module account, and per-DAO terms keyed by module account. Prices contain integer USD cents, a monotonic revision and at most sixteen distinct action names. Terms contain fixed-size receipt commitment, expiry and revocation state. No secondary indexes are needed. Expired terms have bounded cleanup. Price rows are restricted to compliant first-party catalogue modules; each DAO needs at most one term per priced module. RAM classification and upgrade/backfill coverage include both tables.

## Payment boundary

The API validates active administrator membership against the exact deployment. Checkout approval binds the DAO, module, price revision/hash and exact monthly amount to a unique request. It creates a Stripe test-mode Checkout session for testnet using the existing operator account; credentials remain server-only. Provider checkout URLs are restricted to Stripe's expected origin.

Payment verification reads the saved checkout and actual PaymentIntent/charge from Stripe. It requires exact amount, USD currency, correct operator account/mode, metadata/order binding, succeeded/captured payment and no refund or unresolved dispute. A webhook alone is insufficient. A database transaction serializes fulfillment for each DAO/module; a saved expiry/receipt survives native acknowledgement failure and replay. A paid term begins at verified payment time or the existing paid expiry, whichever is later, and ends one UTC calendar month later. Renewals are accepted only within seven days of current expiry, bounding prepaid native state. Receipts cannot authorize another DAO/module.

Before fulfillment the API rechecks installed module code and membership. If the DAO is now in the free tier, the provider payment is refunded rather than granting unnecessary paid access. Refunds/disputes after fulfillment revoke only the matching current term; an old refund must not revoke a later month. Worker reconciliation and administrator status reads share this process. Provider errors remain recoverable without another charge or an invented entitlement. Mainnet live payments require separate explicit configuration and authorization.

## Product and verification

Public Pricing displays the configured monthly rates and free threshold separately from legacy usage prices. DAO administrators have a module-access page showing installed modules, paid expiry, exact one-month price, checkout and reconciliation. Platform controls can govern prices. Normal members receive a clear payment-required error and can continue already-approved work. The frontend uses pinned public producer schemas and SDK encoders.

Acceptance covers 10→11→10 active members, all native signing entry points, unauthorized/stale price updates, expired/revoked/cross-DAO terms, duplicate/concurrent checkout and fulfillment, incorrect provider amount/mode/order, refunds/disputes, renewal date boundaries and native acknowledgement loss. Current private-document encryption is exercised live after rollout: client encryption, epoch grant, Pinata upload, member-signed native record, authenticated download/decryption, no plaintext stored in the native metadata/provider object and unauthorized publication rejection. Existing signup, paired identity and connected apps must still work.

Scope is the existing testnet backend/frontend/runtime, with size-optimized pinned CDT builds and immutable new SDK packages. The current checkout contains independent security work; execute in isolated sibling worktrees and preserve that work when integrating into `dev`. No sub-agents, mainnet release, provider upgrade purchase or changes to governance keys are authorized or necessary.
