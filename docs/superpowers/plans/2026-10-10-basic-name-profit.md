# Basic-name minimum-profit pricing implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Workspace AGENTS.md prohibits delegation; the established continuous implementation workflow supplies execution authorization and final code review afterward.

**Goal:** Complete basic account creation only when net proceeds cover actual resources and at least $1 profit.

**Architecture:** Opt-in additive Names contract policy and atomic final spend check; matching typed API quote calculation and verified Stripe net proceeds. Existing quote response shapes remain compatible, and existing table layouts remain unchanged.

**Tech Stack:** Antelope C++/CDT 4.1.1, strict TypeScript, existing WharfKit/Stripe/Zod/Vitest/VERT, Vue and Playwright.

**Spec:** [Basic-name profit policy](../specs/2026-10-10-basic-name-profit.md).

## Global constraints

- Minimum profit 100 USD cents; package 30720 RAM bytes, 0.5000 TLOS CPU and NET.
- Stripe Spain standard-card allowance: 515 basis points plus €0.25 converted conservatively for the quote.
- Preserve the existing native conversion premium, configured parties/authorities and old serialized rows.
- Integer money, canonical generated schema/ABI types, no secret exposure or arbitrary producer imports.
- Testnet only; preserve running checkouts until the verified upgrade is ready.

## Review focus

- Actual provisioning exceeds the RAM estimate: atomic final guard must reject the entire sale.
- Fee evidence appears asynchronously: retry without creating an account or consuming the receipt.
- EUR settlement rounding: never overstate net USD revenue.
- Prices move between checkout and capture: accept sufficient verified net proceeds, reject insufficient margin.
- Old fixed-price records and third-party offers: stay readable and retain their existing behavior.

## Task 1 — Checked pricing and fee evidence

Files: create `services/api/src/market/pricing.ts`, `services/api/src/billing/name-payment.ts`, `services/api/src/market/eur-reference.ts`; add corresponding unit tests.

Interfaces: `basicNamePrice` calculates native/card amounts from integer resource units and fee/oracle policy; `verifiedNamePayment` validates Stripe net proceeds; EUR reference reader provides a bounded, dated USD-per-EUR ratio for fee estimates.

- [x] Write hand-derived boundary/regression cases and observe failures before implementation.
- [x] Implement checked integer calculations, freshness/shape checks and provider verification.
- [x] Verify targeted tests; record commands/results and commit the tested task.

## Task 2 — Native profit enforcement and canonical generation

Files: modify `contracts/names/names.cpp`; extend real fixture setup/tests in `tests/marketplace.test.ts` and a focused Names profit contract suite; regenerate `sdk/generated/names*` from actual compiled artifacts.

Interfaces: add `setprofit`, `fulfillnet`, `checkprofit`, versioned `profitcfg` and transient `profitcheck`. Preserve all legacy action/table formats.

- [x] Restore the pinned compiler and establish the existing contract-test baseline.
- [x] Write failing cases for dynamic prices, actual-spend rollback, missing net attestation, reentrancy, stale observations, legacy offers and idempotency.
- [x] Implement the opted-in cost calculation and self-authorized final balance check.
- [x] Build actual WASM/ABI, regenerate canonical output, and verify contract/adversarial cases.

## Task 3 — Quotes, checkout and recurring operator updates

Files: modify `services/api/src/market/{read,routes}.ts`, `services/api/src/native-chain.ts`, `services/api/src/billing/{name,service}.ts`; create `tools/deploy/names-rate.ts`; add route/provider/command tests.

Interfaces: existing quote/service shapes expose rail-specific live prices; native card fulfillment consumes verified `netUsdCents`; the update command emits only supported Names observation/fee-policy actions.

- [x] Write failing route/settlement cases for live resources, EUR fees, pending fee data, stale checkout prices and replay.
- [x] Wire producer schemas and checked helpers into quotes and the new fulfillment action.
- [x] Implement the narrowly scoped testnet observation updater, preserving configured margin and resources.
- [x] Verify targeted and full available suites, lint/typecheck/build, and actual read-only native checks.

## Task 4 — Consumer, documentation and testnet delivery

Files: frontend `src/views/Names.vue`, relevant browser cases, version/dependency metadata; core/ frontend guides/evidence and version/release metadata.

- [x] Test and update the pricing explanation and unchanged consent/backup safeguards.
- [x] Package and pin the development producer artifact; verify frontend type/templates/browser/accessibility checks.
- [x] Review the connected implementation inline, verify pre-upgrade state and simulate the checked Names upgrade and resource purchases.
- [x] Apply the authorized testnet feature without authority changes; deploy API/frontend and replace the observation command only after their checks pass.
- [x] Verify live quotes and provider/net-margin evidence, commit/integrate to dev, attempt publication and record exact limits.

## Execution ledger

- Initial live behavior: basic tier fixed at $1; trusted TLOS observation already refreshes. RAM/CPU/NET cost is funded by the operator float but not added to the selling price. Card fulfillment trusts gross paid amount without actual Stripe fees.
- User decisions: $1 after all direct costs; Stripe Spain standard-card estimate. Work proceeds inline without new review/permission checkpoints under the existing repository workflow.
- Ruling: separate native/card quotes preserve their differing costs while retaining the existing public response shape; changing persisted sales/tier layouts is unnecessary.
- Toolchain precondition: Docker/CDT absent; restore the verified CDT package in the private runtime directory without changing host privileges.

- Implemented checked integer resource/native/card prices; 28 initial pricing/fee tests passed after observed failures. Stripe net verification was extended to support its actual EUR settlement data.
- Pinned CDT restored privately; untouched baseline Names and runtime hashes reproduced exactly. Built actual current, old-release, observer and official pinned token fixtures.
- Opt-in contract policy/atomic final spend guard compiled; generated producer ABI/schema/hash updated. All 20 legacy structs, 7 tables and 13 actions retain their layouts.
- Focused integration/contract/payment suites: 72 passed. Added deposit/reentrancy rollback and paid-quote recovery cases.
- Actual testnet signed compute_transaction: upgrade plus card and native account/resource provisioning passed; 104-cent net rejected while 105-cent net passed with 100-cent profit. No code, balances or sale state changed in simulations.
- Actual Stripe sandbox $1.42 capture: EUR 127 gross, 32 fee, 95 net at rate 0.892698; conservatively verified USD 106 cents, leaving 101 cents after current resources. No Names checkout or chain purchase was broadcast by this provider test.
- Producer/consumer pins: core 0.10.0-alpha.2, module SDK 0.9.0-alpha.9 (peer alignment only, contract version unchanged), frontend 0.10.0-alpha.8. Generated docs updated.
- Frontend unit/lint/type checks and staged testnet build passed; 179 unit and 12 desktop/mobile Names browser cases passed. Initial parallel runs exceeded existing crypto/contract test timeouts; stable two-worker runs remove contention.
- Final core run initially passed 694/695; static deploy-profile test incorrectly required a generated local-chain file. It now validates the static profile directly; signed real-chain permission/resource qualification remains separate. Full rerun passed: 115 files, 695 tests.

- Inline connected-code review checked actual-spend ordering, inbound-transfer guards, integer ranges, captured-fee source/mode/refund binding, legacy layouts and code pins. No production authority/asset changes or unreviewed provider automation were added.

- Testnet activated irreversibly at block 449478991; code, policy and unchanged authority/legacy rows/100 TLOS reserve verified. API and frontend deployed and public quotes verified. Typed five-minute updater completed a real irreversible observation refresh.
- Post-deployment real API → released SDK → signed native simulation passed; deployed public desktop/mobile pages passed accessibility and overflow checks. Customer account/payment broadcasts remain outside this qualification.
- All three implementations integrated into dev. Remote publication pending the push result; no main/production release.
