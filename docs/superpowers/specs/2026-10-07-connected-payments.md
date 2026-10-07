# Connected DAO payments and independent portals

Approved direction: the user's 2026-10-07 discussion and instruction to implement now. Default Connect commission is 500 basis points (5%); Daclify DAO controls changes. Implement in isolated `codex/connected-payments` worktrees; preserve running services, private configuration and legacy repositories.

## Payment boundary

Every DAO accepting card payments uses its own Stripe merchant account. Hosting and payment integration are separate choices. Daclify Connect is an optional central payment service usable by hosted and self-hosted DAOs. Daclify retains its platform Stripe secret; an independent server receives only a revocable, DAO-scoped broker credential. Fully standalone Stripe integration is supported only with a DAO-operated backend and frontend. Hub-only registration receives public metadata and never financial records.

Connect uses direct charges, full Stripe dashboard access, and Stripe-collected processing fees. Existing eligible Stripe accounts authorize through OAuth; new accounts use Accounts v2 hosted onboarding. Human authorization, bank details, terms and identity verification remain Stripe requirements. DAO creation does not depend on onboarding success. API checks capability readiness; a browser return is not proof of readiness or payment.

## Authority and accounting

Add a separate runtime `paycfg` singleton and `govpayfees` action using existing Daclify DAO administrator authorization. Preserve all existing table layouts and module purchase/creation fee policies. Absence of paycfg on a compatible runtime means 500 bps, revision zero. A runtime without the new action is unavailable for this payment-policy reader. Only this platform's policy determines Connect charges, including independent DAOs. Changes apply to new orders; orders snapshot basis points/revision and use integer USD cents, rounding commission down. Zero commission is allowed; 100% is rejected. This commission covers module checkouts through this service, not unrelated donations, withdrawals, DAO setup fees or purchases outside Connect.

Merchant onboarding, product configuration, broker credential rotation and refunds require a current active DAO administrator and fresh account-control proof. Bind all records to canonical chain/runtime/DAO identity. For independent runtimes, verify listed Hub registration and current reviewed runtime hash through the configured chain RPC before reading membership. Never fetch arbitrary registered API addresses server-side.

Payment products belong to a DAO and module; merchants set fixed USD prices. Buyers select a product, not an amount or commission. Durable request IDs and immutable snapshots make uncertain provider requests resumable without duplicate charges. Connect webhooks use a dedicated secret and verify connected account, environment, order, currency, amount, payment intent and expected application fee before recording settlement. Receipt state comes from Stripe, not redirect parameters. Fiat receipts do not credit native token liabilities. Refunds explicitly refund the application fee; retain separate refund/dispute state and reconcile out-of-order events against authoritative provider objects.

## Operator connection and discovery

An independent server calls Daclify over HTTPS using a scoped broker credential; it can create/read checkouts and retrieve receipts for that DAO only. Credential never enters public status, Hub metadata or browser bundles. Revocation immediately prevents new requests. A first-party module adapter owns those calls and validates published protocol responses.

Hub deployment metadata is versioned public JSON containing per-DAO references and route mode. External portals get registry-only cards and explicit destination links; do not invent member counts or transfer sessions/keys. Shared-frontend API connections require compatible issuer-bound signing challenges, explicit operator selection and isolated session/CSRF/request state. Directory inclusion confers no DAO authority or security certification. Only public HTTPS endpoints are accepted; credentials and executable content are prohibited.

## Acceptance

Test compiled C++ authorization/rate bounds, canonical schemas, PostgreSQL constraints and migration, onboarding/session/role/replay boundaries, exact provider context and fees, webhook signatures/account/mode/amount mismatches, idempotent retries, refunds and deauthorization. Test operator isolation and UI keyboard/mobile flows. Generate reference/help documentation and update example environments and upgrade notes. Provider fixtures establish local behavior only. Actual Connect activation, onboarding and sandbox payments require user-owned Stripe platform configuration; no live account changes or blockchain redeployment are authorized by this coding request.

## Approved hosting and deployment model

1. Shared contracts and hosting: free creation and 10 active governance identities included.
2. Own contracts and server, Daclify frontend: Contact for pricing.
3. Own contracts, server and frontend: Contact for pricing; the Hub links to the external portal.

Monthly paid capacity uses graduated rates: the first 40 paid slots at $1 each; the next 200 at $0.50; further paid slots at $0.20. Examples: 11 total slots=$1/month; 50=$40; 250=$140; 1,000=$290. Administrators explicitly approve the quantity and recurring amount. Membership changes never cause automatic charges. Daclify DAO governs future rates; existing agreements retain their captured schedule and included allowance until an administrator accepts a change. Paired login methods consume no extra slots. Agents count as governance identities. The shared runtime maximum is 5,000 active members per DAO.

Paid invoices grant on-chain capacity until the paid period ends, with durable, once-only references and a configured settler. Unpaid checkout returns grant nothing. Expiry or a fully refunded/disputed receipt blocks excess admissions/reactivations only. Existing members retain votes, withdrawals, recovery and content access. Delayed lower same-period receipts cannot overwrite an upgrade. Refunds affect their specific receipt, with valid older receipts eligible for restoration. Storage, AI and blockchain resources remain separate.

Hosting currently uses USD card subscriptions. No TLOS recurring subscription, setup promo codes, subscription discounts or speculative module entitlements are implemented. Existing captured card/TLOS setup orders remain fulfillable once. Merchant onboarding is optional and separate from hosting.
