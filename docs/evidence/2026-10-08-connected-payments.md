# Connected payments and graduated hosting verification

Development version 0.7.0-alpha.1; contract interface 1. Work was performed in three isolated sibling `codex/connected-payments` worktrees. No existing testnet/mainnet contract or provider account was changed. The new owned Spring fixture is `daclify-payments-native` on loopback 20388; PostgreSQL uses an owned database named `daclify_connect_1007_test`. Private fixture keys and test wrapper configuration remain ignored artifacts.

## Implemented behavior

Shared creation is free with 10 active-member slots. Administrators explicitly approve monthly paid slots: first 40 at $1, next 200 at $0.50, remaining at $0.20. Total capacities 11/50/250/1,000 cost $1/$40/$140/$290 monthly. Daclify DAO governs future prices; existing agreements retain accepted schedules. Expiry gates excess admissions/reactivations and retains existing member rights. Independent contract/server and own-portal choices show Contact for pricing.

Optional Connect onboarding uses the DAO's merchant, direct charges and initially 5% governed commission. Fixed products issue immutable receipts; fulfillment does not automatically install modules, grant membership or mint native token balances. Independent servers hold DAO-scoped broker credentials, with buyer/receipt ownership recorded locally. Hub cards advertise public API or external portal information; current central registration, chain/WASM/binary ABI and issuer checks precede independent API selection. Reads and governance signatures remain limited to that selected DAO.

Migrations 016–021 capture merchant, order, consent, invoice, dependency, return-address and buyer ownership records. Provider retries keep fixed approved parameters. Hosting upgrades depend on their original paid-period invoice; refunds/disputes reconcile dependent receipts. Won disputes explicitly resume verified unexpired native receipts, while ordinary revoked-receipt replay remains forbidden. Settlement is a trusted configured operator attestation, with asynchronous reconciliation delay.

## Actual final checks

| Check                                 | Result                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Core `npm run verify`                 | lint, TypeScript, generated docs and 425 unit/compiled-WASM tests passed                                |
| Modules `npm run verify`              | lint, TypeScript, generated docs and 83 tests passed                                                    |
| Frontend `npm run verify`             | source lint, Vue/TypeScript and 101 tests passed                                                        |
| Core PostgreSQL integration suite     | 119 tests in 17 files passed; upgrade from seven-migration schema through 21                            |
| Owned Spring native payment selection | 2 tests passed against actual deployed WASM, raw ABI and permission graph                               |
| Frontend `npm run test:e2e:payments`  | 4 desktop/mobile cases passed with HTTP fixtures; axe reported no violations and no horizontal overflow |
| Builds and format checks              | all three repositories passed                                                                           |
| CDT build/codegen                     | actual CDT 4.1.1 contracts rebuilt and generated SDK refreshed                                          |
| Final diff whitespace                 | checked before commits                                                                                  |

Aggregate 734 tests describes these executed selections; it does not mean every provider or native fixture suite ran. Local raw logs are in each worktree's ignored `.artifacts/*-07.log`; screenshots cover creation, hosting and merchant pages. The release manifest records exact commits/lockfiles/WASM/JSON-ABI/binary-ABI/document hashes with qualification false and publication refused.

The tests cover role/issuer/session/proof isolation, full DAO identity, invalid webhook boundaries, price/fee snapshots, current-role broker revocation, customer ownership, checkout retries, refunds, pending upgrades, grandfathered prices, decreases/cancellation, dependency revocation and won-dispute restoration. Browser checks use real local vault operations and mocked HTTP responses; they establish UI behavior, not actual Stripe delivery or external wallet-client qualification.

## Remaining qualification

- Activate the intended Stripe sandbox platform and verify actual eligible existing-account OAuth, new merchant KYC/onboarding, regional capabilities, direct charge/application fees and refund/dispute webhooks.
- Exercise actual graduated subscription checkout, payment failure/pending updates, renewal, cancellation, refund and native capacity reconciliation through the real provider.
- Qualify operator HTTPS/CORS/cookies and real Anchor/EOA clients on the selected deployed domains. Cross-site cookies may require an approved API alias or own frontend.
- Review exact runtime upgrade permissions/resources and matching module configuration before any existing testnet/mainnet upgrade. The coding task did not deploy those environments.
- Rehearse off-host PostgreSQL/provider/broker/content restore and disable payment creation/workers during an unresolved total-database-loss incident. On-chain governance recovery alone does not rebuild subscriptions or social pairings.
- Production managed custody and immutable publication retain the pre-existing held checks. Recurring TLOS billing, subscription discounts and module-specific fiat fulfillment are not implemented.

Follow [payment operations](../operations/connected-payments.md) and [upgrade 0.7](../operations/upgrade-0.7.md). This evidence does not authorize live charging or production deployment.
