# Basic-name resource pricing and minimum profit

The user requires at least **$1 profit per completed basic account creation after all direct costs**, including payment fees. $1 is the starting floor, not a fixed selling price. The approved account package remains **30 KiB RAM, 0.5 TLOS CPU and 0.5 TLOS NET**. The user selected Stripe Spain's published standard card fee model for estimates. Existing native conversion premium and seller/treasury/settler settings remain unchanged.

## Prices and authority

Only unlisted, first-party, 12-character basic accounts opt into this policy. Listed, suffix and premium offers retain their existing rules. Add a versioned Names pricing singleton; preserve every existing serialized table and action. Existing deployments without the singleton retain fixed-tier behavior.

For a basic account, read the real Telos RAM market, include its purchase fee and the tier's CPU/NET stakes, and convert the provisioning estimate to USD using a fresh trusted Delphi observation. Native pricing covers those costs plus the $1 margin, then applies the existing conversion premium. Card pricing grosses up the resource cost plus margin to cover a conservative standard-card fee allowance. Round monetary bounds upward using integer arithmetic.

The card allowance uses the highest published standard-card percentage in Spain, 3.15%, plus the 2% conversion charge for USD charges/EUR settlement, and the €0.25 fixed fee. Convert that fixed fee using a fresh ECB EUR/USD **reference estimate**; this is not a transaction-rate guarantee. The actual Stripe balance transaction and its recorded settlement rate control the fee/net-proceeds evidence at fulfillment. Quotes and settlement reject missing, future, malformed or stale required observations.

The native contract verifies the completed provisioning spend, not just its RAM estimate: stage a transient guard before outgoing fee/resource actions, reject intervening inbound transfers, and run a self-authorized final action after account creation/RAM/staking. It reads the actual token-balance difference, removes the sale payout, and requires net sale proceeds minus actual provisioning cost to meet the USD margin at the pinned fresh observation. Failure rolls back the whole native transaction, including account creation. Guard state is consumed on success.

Card fulfillment verifies the Stripe Checkout Session, succeeded PaymentIntent, captured charge and balance transaction, including amounts, currency, mode, source, refunds and fees. Net USD proceeds are rounded down; supported EUR settlement uses the provider-recorded conversion rate and bounded rounding checks. A new net-attested fulfillment action receives those proceeds. The old gross-only fulfillment action cannot bypass profit protection when the policy is enabled. Native reference idempotency remains authoritative. Missing asynchronous fee evidence retries; a paid order that cannot cover the current margin remains unfulfilled for review/reconciliation rather than spending the reserve at a loss.

## Product and deployment

Public v1 quote/service response fields remain compatible: the USD amount is the card quote and the TLOS amount is the native quote, with different fee costs. The frontend explains that resources and payment-method fees determine current prices; it does not present the operator's internal profit rule as checkout instructions. Existing quote/context checks, key backup and explicit payment consent remain.

Keep implementation isolated from the running checkouts. Build actual C++ using the pinned CDT 4.1.1 artifact; do not invent WASM/ABI fixtures. Regenerate producer-owned Names ABI/types/schemas/code hash, publish a new development protocol artifact, and pin its frontend consumer. Verify relevant contract/unit/API/browser tests and actual testnet read-only transactions before the testnet upgrade. Preserve authorities, balances, current offers and sale rows during activation. No main/production release or extra reserve funding is part of this change.

The existing five-minute observation service is replaced with a documented, typed operator command that updates trusted Names observations and the fixed-fee allowance. It cannot transfer funds or change account authorities. Keep the $1 margin, configured resources and any later operator policy changes intact.

## Evidence and boundaries

Meaningful tests cover resource/TLOS changes in both directions, exact margin boundaries, fee rounding, high costs/overflow, stale/future observations, old records, absent fee evidence, EUR conversion, capture/refund/mode/source mismatch, duplicate fulfillment, and final actual-spend rollback. Provider fixtures do not establish live fees; native emulation does not establish real system resource costs. Separate actual sandbox/provider and native read-only evidence is required and recorded honestly.

Sources: [Stripe Spain standard pricing](https://stripe.com/es/pricing), [actual processing-fee retrieval](https://docs.stripe.com/expand/use-cases), [balance transaction semantics](https://docs.stripe.com/api/balance_transactions/object), [ECB reference-rate scope](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).
