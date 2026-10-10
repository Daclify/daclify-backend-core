# Names pricing and payment review

Names profit policy version 1 adds current provisioning costs to a minimum net margin. Existing fixed tiers, suffix/listed offers and their serialized records remain compatible. The testnet basic package is 30720 RAM bytes, 0.5000 TLOS CPU and 0.5000 TLOS NET; the minimum margin is 100 USD cents.

The API and native contract calculate RAM from the current system market, including RAM fees and conservative integer rounding. CPU and NET stakes are added in TLOS base units. A fresh Delphi TLOS/USD observation converts the resource cost upward to USD cents. Native payment adds the configured conversion premium to resource cost plus margin. Card payment grosses that subtotal up for its fee allowance. USD and native amounts are separate totals, not equivalent conversions of a single card total.

The initial Spain standard-card allowance is 515 basis points (3.15% international plus 2% currency conversion) and €0.25 converted upward using a dated ECB USD reference. This estimates a price; it does not prove the fees actually charged. Sources: [Stripe Spain pricing](https://stripe.com/es/pricing), [fee retrieval](https://docs.stripe.com/expand/use-cases), [balance transactions](https://docs.stripe.com/api/balance_transactions/object), [ECB references](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).

Checkout is restricted to cards and USD with Adaptive Pricing disabled. Fulfillment retrieves the paid Checkout Session, succeeded PaymentIntent, captured charge and its balance transaction. It verifies mode, metadata, identities, paid amounts, currency, fee/net conservation, source and absence of refunds/disputes. EUR proceeds use Stripe's recorded exchange rate; all conversions round net income down and fee costs up. USD and EUR balance currencies are supported. Missing asynchronous fee data returns a retryable 503 without creating an account.

`fulfillnet` requires the configured settler's verified gross and net USD amounts. Gross-only `fulfill` cannot create an opted-in basic account. Native purchases must match the current exact TLOS price. Both rails stage a transient balance guard, pay the configured parties, create the account and provision its resources, then run self-authorized `checkprofit`. The guard deducts actual token spending, using the fresh observation taken at settlement. Deposits during this sequence cannot conceal costs. A margin below the policy rolls the entire transaction back, including payouts, receipt and account creation.

## Observation command

Run `DACLIFY_ENV_FILE=<private testnet env> npm run price:names -- testnet` to print unsigned supported actions. Add `--apply` for the narrow testnet operator update. It verifies chain identity, runtime ABI/code, Names code and operator authority. It can refresh TLOS observations and the fixed-fee allowance; it preserves the margin, fee basis points, tiers, parties and all account authorities. It does not deploy code or transfer tokens.

The user service runs this every five minutes. TLOS observations expire after 900 seconds. ECB references may span weekends/holidays and expire after seven days. ECB failure preserves the previous allowance while continuing native updates; once the allowance expires, card quotes disappear while native checkout remains available. Previously paid card orders still use actual net proceeds and current resource costs.

## Paid order on hold

A checkout receipt means payment was captured; it does not mean the native account exists. Stripe retries temporary webhook failures. If verified proceeds cannot cover the required margin, creation stays unfulfilled and requires operator review through the original Stripe receipt. There is no automatic extra charge or automatic refund in this change. A support operator must reconcile the Checkout Session, captured charge, balance transaction and `sha256(checkout_id)` native sale reference before any refund or retry. Contract sales are authoritative for once-only fulfillment. Confirm the account and its recorded owner/active keys before telling the buyer creation completed.

The guard measures margin at provisioning using the observed TLOS/USD value and captured processing fees. Later chargebacks, refunds or asset price changes require separate reconciliation; they cannot be guaranteed by an atomic creation transaction. Reserve liquidity must still cover the resources. No Names reserve was moved or refilled during activation.
