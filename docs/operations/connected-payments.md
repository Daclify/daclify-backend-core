# DAO merchant payments and shared hosting

This 0.7 development integration has three deployment options and two separate payment purposes. Shared DAO creation costs $0 and includes 10 active governance identities. Approved extra capacity uses monthly graduated subscriptions. DAO module-product payments go directly to the DAO's own Stripe merchant account, with a governed Daclify Connect commission, initially 5%. Neither payment is a native treasury deposit.

## Graduated capacity

| Total active-member slots | Paid slots | Monthly USD |
| ------------------------- | ---------- | ----------- |
| 10                        | 0          | $0          |
| 11                        | 1          | $1          |
| 50                        | 40         | $40         |
| 250                       | 240        | $140        |
| 1,000                     | 990        | $290        |

The first 40 paid slots cost $1 each, the next 200 cost $0.50, and subsequent paid slots cost $0.20. Lower rates apply only to their band. Administrators approve capacity and the exact recurring amount before checkout. New members never silently increase a bill. People and agents each count once; linked wallets/social logins do not add slots. Maximum shared capacity is 5,000. Storage, AI and chain resources have separate limits/costs. Monthly subscriptions currently use USD cards; recurring TLOS billing and subscription discounts are not implemented.

Native policy governs new subscriptions; each accepted agreement stores its own pricing/free allowance. An existing administrator must explicitly opt into changed pricing. Increases request immediate prorated invoicing and wait for verified payment; decreases reduce future invoices without unused-period credits. Cancellation stops renewal after the paid period. Failed/expired payment blocks new admissions/reactivations above effective allowance, never removes members or blocks votes, withdrawals, recovery or private content. A paid receipt is an auditable settler attestation, not a trustless proof of Stripe payment.

## Configure Daclify's central API

Keep all values in private server environment files, separately for testnet and mainnet. `.env*.example` documents each option; never put keys in frontend environment files or Hub metadata.

- `API_PUBLIC_ORIGIN`: exact browser-visible HTTPS API origin. For the local relative Vite proxy, use the browser origin. All key-control challenges bind this issuer.
- `STRIPE_SECRET_KEY`: environment-specific Daclify platform key. One key can serve both purposes; it never leaves the central backend.
- `STRIPE_CONNECT_CLIENT_ID`: Connect OAuth application ID; configure exact callback `API_PUBLIC_ORIGIN/v1/payments/stripe/callback`.
- `STRIPE_CONNECT_WEBHOOK_SECRET`: connected-account destination signing secret for `API_PUBLIC_ORIGIN/v1/payments/stripe/webhook`.
- `DACLIFY_HOSTING_STRIPE_PRODUCT_ID`: platform product for member capacity. The API creates immutable graduated recurring Prices from native policy.
- `DACLIFY_HOSTING_WEBHOOK_SECRET`: separate platform destination signing secret for `API_PUBLIC_ORIGIN/v1/hosting/stripe/webhook`.
- `DACLIFY_CONNECT_LIVE_PAYMENTS` and `DACLIFY_HOSTING_LIVE_PAYMENTS`: default false. Sandbox mode does not require enabling live flags. Testnet rejects live keys. Setting a live flag does not perform provider qualification.

Legacy `STRIPE_PRICE_ID`/`STRIPE_WEBHOOK_SECRET` apply only to the existing service-billing integration; they are not the new hosting product/destination secrets. Native runtime/relay/settler and reviewed code/ABI pins must match. First configure `govhosted` through the Daclify DAO; retain its established native deployment authority.

For Connect, send snapshot events on connected accounts: checkout.session.completed, checkout.session.async_payment_succeeded/failed, checkout.session.expired, charge.refunded, charge.dispute.created/closed, refund.updated, account.updated and account.application.deauthorized. Accounts v2 capability readiness is retrieved when an administrator refreshes merchant setup; thin account events are not a replacement for that read. For hosting, send platform checkout.session.completed/expired, invoice.paid/payment_failed, customer.subscription.updated/deleted, charge.refunded, charge.dispute.created/closed and refund.updated. Match destination API version to the installed Stripe SDK/API pin; replay actual sandbox deliveries before exposure. Do not assume current dashboard defaults match the pinned API shape.

## Merchant ownership and fees

Creation of a DAO does not require a Stripe account. A current DAO administrator can later authorize an existing eligible full-dashboard merchant via OAuth or open hosted Accounts v2 onboarding. Stripe still requires human consent, business/KYC and bank information. Returning from onboarding does not establish charges/payout readiness. Existing account eligibility, platform capabilities, country/currency availability and Stripe processing/Connect costs require actual sandbox/provider checks.

Daclify Connect uses direct charges in the merchant account's Stripe context. Each immutable order captures its gross USD cents, floor-rounded commission, native fee policy revision and merchant. Stripe processing fees are separate. Governed price changes do not rewrite older orders. Eligible module-product checkouts through this integration incur the captured commission; native withdrawals, hosting, outside payments and unrelated turnover do not. Products issue fiat receipts only: they do not auto-install modules, mint token credit or grant membership. A module needing fulfillment must consume and reconcile its confirmed receipt explicitly.

Buyers must sign in to the relevant operator. Administrators need current chain authority, session/CSRF and a fresh signing proof to edit products, onboard, issue/revoke server tokens or refund. A root key or eligible paired native/EVM wallet can provide the account-control proof. Browser redirect parameters never settle an order. Webhooks and receipt reads reconcile authoritative checkout/intent/charge objects and reject wrong merchant, environment, amount, currency, application fee or metadata.

Refunds remain on the original merchant account; proportional application-fee refunds are requested when the fee is nonzero. Issued/pending refund reservations prevent over-refunds. An uncertain/failed provider refund remains conservatively reserved until an operator reconciles its actual provider state; do not delete records to retry. Stripe may retain processing fees. Refund and dispute history is separate from initial paid state. Fully refunded or unresolved disputed hosting receipts revoke their own capacity and any prorated upgrade depending on that original period payment. Valid unrelated receipts can restore remaining capacity. A won dispute can explicitly resume the same verified, unexpired receipt through settler authority; ordinary replay cannot restore a revoked receipt. Worker processing introduces a reconciliation delay.

## Independent operator

Own-contract/server DAOs may use the Daclify frontend after an explicit operator review. Hub metadata contains the full chain/runtime/DAO reference, reviewed WASM and binary ABI hashes, public API origin, operator label and native module mapping. The app verifies those against the configured chain RPC, current Hub registration and compatible API; selection locks the vault, limits read/signing context to that selected full DAO reference, isolates API/CSRF state and requires an operator-local session. Choosing a different DAO requires another explicit Hub connection. Reload revalidates registration. Directory inclusion is an owner registration, not an audit certification. No central sessions, broker tokens or document keys are sent in Hub discovery.

Register with the existing Hub `regdeploy` action, authorized by both the runtime and owner native accounts. Its positional arguments are runtime, owner, chain_id, interface_version, code_hash, abi_hash, metadata and listed. Obtain hashes from the actual configured chain `get_raw_abi`, and independently match the reviewed WASM/binary-ABI pins; the Hub stores advertised hashes without certifying them. Metadata is a serialized `HubMetadataSchema` JSON object, for example:

```json
{
  "schemaVersion": 1,
  "operator": "Example DAO operator",
  "daos": [
    {
      "daoId": "1",
      "title": "Example community",
      "description": "Our independently operated DAO",
      "purpose": "community",
      "privacy": "public",
      "portal": { "mode": "daclify", "apiOrigin": "https://api.dao.example" }
    }
  ],
  "modules": []
}
```

Use portal `{ "mode":"external", "url":"https://dao.example/portal" }` for an own frontend. Native modules list their exact first-party module id/account mapping when needed. Metadata may advertise up to10 DAOs per registered runtime, within4096 bytes; keep it public and omit secrets. Re-register after an approved hash/endpoint change. The frontend never imports arbitrary code from these endpoints.

The operator's API needs HTTPS, matching `API_PUBLIC_ORIGIN`, allowed `FRONTEND_ORIGIN` and CORS, its own database/provider configuration/backups, and reviewed runtime deployment. Cross-site cookies can be blocked by browsers even with SameSite=None. Qualify the actual domain/browser setup; use an approved API alias under the shared frontend's site or choose an own frontend where needed. Email/Telegram pairings and service UUIDs remain local to that backend.

For optional central Connect, the central DAO administrator issues a DAO-scoped broker token in Payments. Save it once in the operator's private environment:

```env
DACLIFY_CONNECT_OPERATOR={"apiOrigin":"https://api.daclify.com","frontendOrigin":"https://app.daclify.com","daos":[{"dao":{"chainId":"REPLACE_WITH_CHAIN_ID","contract":"ownruntime","daoId":"1","interfaceVersion":1},"token":"REPLACE_WITH_DAO_SCOPED_BROKER_TOKEN"}]}
```

Use the operator network's matching testnet addresses and chain ID when testing. This option is mutually exclusive with central Connect/hosting provider configuration on the operator. The modules package's Node-only `ConnectedPaymentClient` calls the canonical broker API; tokens never enter browser variables. Central merchant administration uses a separate central session/fresh proof. The local operator binds every checkout/receipt to its local buyer and product; other buyers cannot read it. Credential revocation or loss of the issuing administrator's chain role blocks broker calls.

An external-portal DAO owns contracts/server/frontend; its Hub card contains only public registration information and an explicit external link. It may choose central Connect or implement standalone Stripe itself. Standalone Stripe requires its own backend and frontend, and Daclify cannot automatically collect a commission on those outside payments. Both independent deployment options say Contact for pricing; no fixed setup charge is invented.

## Recovery and qualification

Back up merchant mappings, immutable agreement/consent/order/invoice references, webhook/event hashes, jobs, customer ownership and secret operator configuration off-host. Recovered governance keys and on-chain capacity do not reconstruct Stripe subscriptions, invoices, local buyer ownership or social pairings. Disable payment creation and automatic workers after total database loss until a verified backup/provider reconciliation restores these associations. Never create replacement subscriptions as an automatic recovery step. Revoke restored sessions and rotate broker tokens where appropriate.

Local tests cover the real PostgreSQL schema, installed Stripe SDK against HTTP fixtures, compiled WASM, actual Spring authority, browser consent and accessibility. Live/sandbox account activation, real provider delivery, external wallet clients, operator cookie/CORS and production operations remain qualification work. See [upgrade 0.7](upgrade-0.7.md).

Primary references: [Stripe direct charges](https://docs.stripe.com/connect/direct-charges), [Accounts v2 creation](https://docs.stripe.com/api/v2/core/accounts/create), [OAuth reference](https://docs.stripe.com/connect/oauth-reference), [Connect webhooks](https://docs.stripe.com/connect/webhooks), [pending subscription updates](https://docs.stripe.com/billing/subscriptions/pending-updates), [pricing models](https://docs.stripe.com/products-prices/pricing-models).
