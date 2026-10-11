# Monthly module fees implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` inline. Workspace instructions forbid delegation and authorize continuous implementation followed by user review.

**Goal:** Activate approved monthly module prices on testnet while keeping modules free through ten active members and qualifying encrypted documents live.

**Architecture:** Native prices and paid terms guard new module activity. PostgreSQL and verified Stripe one-month payments drive idempotent native settlement; existing hosting/storage retain their own billing. The frontend consumes pinned core/module SDKs.

**Tech stack:** Existing CDT 4.1.1 `-O=s`, C++, strict TypeScript, PostgreSQL, Stripe SDK and Vue/Playwright.

**Spec:** [Monthly module access](../specs/2026-10-11-monthly-module-fees-design.md).

## Constraints and review focus

Preserve governance authorities, liabilities, pending work, vault/recovery keys and all current signup/connected-app behavior. Keep private material outside Git/logs. Work in `/data/daclify-runtime/worktrees/module-fees` and integrate into `dev`, preserving concurrent security edits. Publish fresh immutable artifacts; never overwrite alpha.6/alpha.22 releases.

Review and test: free-tier crossings during checkout; Stripe acknowledgement lost after native settlement; old refunds after a later renewal; leap/month-end renewal dates; native module entry/signing paths that could bypass the fee guard. Manual renewal is the selected builder choice and must be labelled accurately.

## Task 1 — authoritative pricing and terms

Files: `contracts/common/module_fees.hpp`, `contracts/common/ram_families.hpp`, `contracts/runtime/runtime.cpp`, `sdk/permissions.ts`, `sdk/service-accounts.ts`, generated SDK output, `tests/module-fees.test.ts`, native permission coverage.

Interfaces: `govmodfee(runtime,dao_id,member_id,account,expected_revision,monthly_usd,actions)`; trusted existing settler `setmodterm(dao_id,account,expected_receipt,expires,receipt)` / `revmodterm(dao_id,account,receipt)`; bounded `clearmterms(dao_id,after,limit)`. Tables `modfees` (global), `modterms` (DAO scope). `validate_instruction` enforces the new-activity guard.

- [x] Run clean baseline suites in isolated worktrees and retain results.
- [x] Add failing compiled-contract tests for governance, member threshold, paid/expired/revoked terms, scope/replay and preserved completion; observe the missing guard/action failures.
- [x] Implement bounded native rows/actions/guard, RAM families and exact action links.
- [ ] Build with pinned CDT `-O=s`, regenerate ABI SDK, run contract/native permission tests, measure WASM/RAM/action CPU and review upgrade behavior.

## Task 2 — verified one-month payments and API

Files: `protocol/module-fees.ts`, `protocol/index.ts`, `protocol/routes.ts`, `migrations/040_module_fees.sql`, `services/api/src/billing/module-fees.ts`, `module-fees-config.ts`, `module-fees-jobs.ts`, `native-chain.ts`, `chain.ts`, `main.ts`, `server.ts`, `tests/module-fee-pricing.test.ts`, `tests/integration/module-fees.test.ts`.

Interfaces: public `ModuleFeePricingSchema`, `ModuleFeeStatusSchema`, `ModuleFeeApprovalSchema`, `ModuleFeeOrderSchema`, `moduleFeePricingHash`; `ModuleFeeRoutes.moduleFeePricing/moduleFeeStatus/moduleFeeCheckout/moduleFeeOrder`; `ModuleFees.status/checkout/order/reconcileDue` and native gateway pricing/term/attest/revoke readers.

- [x] Write and observe failing pricing/date-boundary tests plus real-PostgreSQL payment/authorization/replay/refund/acknowledgement tests using the Stripe SDK boundary.
- [ ] Implement canonical schemas, constrained migration, strict configuration, payment proof, serialized fulfillment and recovery worker.
- [ ] Wire authenticated routes/readers/worker and friendly redacted errors; verify migrations, schema/doc generation and full core checks.

## Task 3 — administrator and pricing UI

Files: frontend `src/views/ModuleAccess.vue`, `src/components/ModuleFeePanel.vue`, `src/views/Pricing.vue`, `src/views/PlatformDao.vue`, `src/components/ModulesPanel.vue`, `src/api/client.ts`, `src/main.ts`, relevant unit/browser tests and package pins. Modules package peer pin/version updates consume the new core SDK without changing module behavior.

- [ ] Observe failing browser/unit checks for free/paid/expired access, configured prices, administrator checkout and governance updates.
- [ ] Implement the page/panels and links with cancellation/network-generation guards and accurate one-month/manual-renewal labels.
- [ ] Generate fresh core/module packages, pin both consumers, run all three repository checks and desktop/mobile accessibility/browser flows.

## Task 4 — testnet activation, encrypted live qualification and delivery

Files: source-bound testnet deployment preparation/tooling, new release/compatibility pins, operational guide, evidence report and this ledger.

- [ ] Prepare backup, exact code/ABI upgrade, required action links and six governed rates; preserve the existing recovery/issuer configuration and record all requested native keys before applying.
- [ ] Requalify single-VM testnet recovery against the new exact core artifact and archive/install matched API/frontend sources.
- [ ] Verify real Stripe test-mode one-month payment/term, the 10/11 threshold and native expiry/continuation behavior using owned fixtures; preserve user DAOs and provider objects.
- [ ] Verify encrypted documents live through client encryption/epoch grants, Pinata, native publication and decryption after download; reject unauthorized publication and inspect stored ciphertext/metadata.
- [ ] Run public browser/signup/apps/regression checks, review the complete diff, record actual results/limits, merge and push `dev` with no unrelated edits.

## Execution ledger

Ruling: use manual calendar-month access payments — the user selected monthly per-DAO prices, but did not authorize automatic future card charges; explicit renewal satisfies that policy without introducing unexpected billing.

Ruling: isolate the three repositories — current core security-audit edits must be preserved; sibling worktrees retain existing cross-repository artifact paths and allow review before integration.

Ruling: native term settlement includes the prior receipt as an optimistic guard — acknowledgement loss can retry the same term, but a delayed old fulfillment cannot overwrite a newer payment. Terms are operator-funded RAM metadata and require no secondary indexes.

Baseline: core 139 files / 872 tests; modules 30 / 179; frontend 42 / 275 passed after restoring exact ignored historical artifacts and building source. Focused native VERT fee tests passed 3; pricing/calendar-month tests passed 6. PostgreSQL + actual Stripe SDK mocked HTTP boundary tests passed 4 (these do not qualify the live provider).

Live encrypted baseline: owned private DAO `11278252133202098176`, epoch 2, document 1, 351 ciphertext bytes, native publication `1e6f972d8f64f5bbefc98190f8a64e7529aadfb114276b6ab1bd41e6274c1fb3`. Frontend crypto, actual API/Pinata and client decryption passed; wrong key/DAO and anonymous upload rejected. This precedes the fee rollout and must be repeated afterward.

Diagnostic correction: an assertion compared equal bytes with different array types and printed the owned fixture epoch-1 key before any document publication. The diagnostic log was redacted and the empty fixture was rotated to epoch 2. Assertions now compare bytes with boolean results and redacted failure messages. No community documents or production keys were involved.

Checkpoint verification: core 142 files / 882 tests passed; frontend 43 / 276 passed, build/type/template checks passed; modules 29 files / 178 tests passed with one outdated next-release rejection, corrected from alpha.7 to alpha.8 and its six SDK tests passed. Core lint/typecheck/docs checks passed. PostgreSQL suite 33 files / 270 tests passed before adding HTTP authorization coverage; the expanded fee suite passed five tests. Browser pricing/access/connected-app flows passed 20 across desktop/mobile, including main-region accessibility and width checks.

Native permission bundle: 136 of 138 passed; two compatibility checks were corrected by adding the explicitly tested alpha.7 to the module SDK range. The complete 41-test native workflow file then passed. Fee permission/readers passed 10 tests; portable deployed-alpha.6 → alpha.7 upgrade and connected-app fixtures passed nine. The older Docker-dependent upgrade command could not start without its fixture; the portable test uses the exact deployed alpha.6 WASM instead. No production qualification is claimed.

Measured local native cost: first price 261 RAM bytes and 3,937 µs CPU; first term 269 RAM bytes and 391 µs CPU. Core WASM 892,310 → 916,075 bytes (+23,765, 2.66%). Rebuilding old module releases with current `-O=s` gives different optimized candidates for five modules. Those candidates are retained only for comparison; this rollout preserves the existing module contract binaries/pins and does not invalidate their pending work.

Stripe operator account verified through the actual test-mode API. A private PostgreSQL backup (261,510 bytes, SHA-256 dc9fa58b1f677a3615698fca46925ba31b67e34cd051bc2f82f0d05ea55ae8a0) and proposed environment additions were prepared. Live activation/payment/post-rollout encrypted verification remains outstanding.
