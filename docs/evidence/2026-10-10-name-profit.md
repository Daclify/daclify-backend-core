# Basic-name minimum profit — testnet qualification

The user's policy is at least $1 after all direct resource and card-processing costs. The package remains 30 KiB RAM, 0.5000 TLOS CPU and 0.5000 TLOS NET. The opted-in contract policy preserves all old serialized layouts and fixes the minimum at 100 USD cents. Card and native prices are calculated separately; actual native spending controls the final settlement guard.

Sources and operating/reconciliation limits are in [Names pricing](../operations/names-pricing.md). No production release or authority change is part of this feature.

## Evidence

- [Real native simulations](2026-10-10-name-profit-native-simulation.json): signed testnet `compute_transaction` includes the actual Names code/ABI upgrade, policy, card and native purchases and real Telos system resources. 105-cent card net meets the 100-cent margin; 104 cents fails after actual spending. Gross-only fulfillment fails. Code, balances and sales stay unchanged after the read-only calls.
- [Actual sandbox fees](2026-10-10-name-profit-stripe-fees.json): a $1.42 sandbox PaymentIntent captured without customer email or Names checkout. Stripe returned EUR 127 gross / 32 fee / 95 net, rate 0.892698. The same production fee verifier conservatively computes USD 106 cents, giving USD 101 cents after estimated resources. This is real fee evidence, not a complete paid Names checkout.
- Compiled legacy ABI comparison: all 20 old structs, 7 tables and 13 actions preserved. Runtime code/raw-ABI pins unchanged. New Names code hash `b5a00d14a69b03b3be3b812b07d57c4ce2d5b0d8ca9acf7d5078e66e65e8b225`.
- Focused core contract/API/pricing/fee/SDK/billing suites: 72 passed. Frontend 179 unit cases, lint, typecheck and staged testnet build passed. Names desktop/mobile browser cases: 12 passed, including backup safeguards and accessible seller flows. Module SDK/docs cases: 7 passed; module lint/typecheck/build and generated-doc checks passed.

Full core suite: 115 files and 695 tests passed with two workers. Core strict typecheck, lint, build and generated-document checks passed. The static deployment-profile test now reads the static JSON directly instead of requiring local-chain runtime metadata. Activation read-back is recorded below once complete. Local Docker native-runtime suites and a broadcast customer account purchase were not run; actual chain behavior was qualified by signed testnet read-only calls. Later chargebacks/refunds and market changes after creation require reconciliation. The existing 100 test TLOS provisioning reserve is preserved at activation.
