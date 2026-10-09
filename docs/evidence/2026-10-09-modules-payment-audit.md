> Historical evidence from the source commits and live read window identified below. The numeric Hub Boolean issue in finding 1 is fixed in [workspace consolidation](2026-10-09-workspace-consolidation.md); other findings are not declared resolved by that change. This snapshot predates the executive-authority and contract-integration changes; it is not a current deployment audit. See [current development integration evidence](2026-10-09-contract-integration.md).

What this repo does: Daclify core owns DAO identities, authorization, native treasury accounting and hosted billing. Five contract modules provide voting, milestone work, payroll, grants and endorsement admission; the Vue app exposes those flows. Archive, hosting, RAM provisioning, storage and merchant payments are supporting facilities, not five more interchangeable contract plugins.

Reviewed on 9 October 2026 with Ponytail full. Expected deployment size: the previously discussed 200 DAOs averaging 200 members. This review verifies rules and integration boundaries; it does not benchmark that load.

Source reviewed: core `13b9a63`, modules `ac14a7c`, frontend `ee4e21e`, on `dev`. Live account snapshot: **16:17:06–16:17:12 UTC**, blocks **449319446–449319455**, chain `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`. RPC responses are sequential reads, not an atomic snapshot. Public API observations are deployment evidence, not evidence that its application source equals these commits.

## Must fix

1. **Real Hub rows break the directory and independent merchant authorization** ([directory.ts](../../protocol/directory.ts), line 59; [native-chain.ts](../../services/api/src/native-chain.ts), lines 301 and 316).
   - **What this is:** Both the Hub directory and independent DAO payment authorization parse the native deployment registry.
   - **Problem:** The live Telos RPC returns `listed: 1`, but `HubDeploymentRowSchema` accepts only a Boolean. Calling the actual gateway against testnet reproduces the error at `[0, listed]`; `GET https://testnet.api.daclify.com/v1/hub/directory` returned HTTP 400, `INPUT_INVALID`, at 16:22:58 UTC. Existing tests cover numeric IDs, but use `listed: true`.
   - **Fix:** Reuse the producer's strict native Boolean transport handling: accept Boolean or exact 0/1, reject other values. Add a regression using the actual public row through the directory and independent payment paths; refresh distributed frontend/core packages where this schema is bundled.
   - **If we skip it:** Registered independent DAOs cannot reliably appear or connect, and central Connect authorization for those DAOs also fails.

2. **Seven execution permission links are missing on live testnet** ([permissions.ts](../../sdk/permissions.ts), lines 2–33; [runtime.cpp](../../contracts/runtime/runtime.cpp), line 1153).
   - **What this is:** Valid member instructions dispatch inline actions as `daclifycore1@execctx`, a child of `active`.
   - **Problem:** Live links omit `archapprove`, `archrevoke`, `restoredoc`, `govpayfees`, `govhosted`, `govseatfee` and `govresources`. The actions exist in the deployed runtime, but unlinked actions require `active`; the declared child permission does not satisfy that minimum. The current UI checks the runtime hash, so it can offer these controls despite missing links.
   - **Fix:** Reconcile the existing generated `contextPermissionPlan` with live links and verify it after deployment. Include link readiness in operational/UI readiness instead of treating a matching WASM hash as sufficient.
   - **If we skip it:** Daclify DAO administrators cannot use the normal signed flow to configure the new billing policies; archive approval/revocation and document restoration have the same gap. This conclusion comes from live authorities plus Antelope authorization rules; no public transaction was submitted to reproduce a rejection.

3. **Live billing configuration still implements the old commercial setup** ([creation.ts](../../services/api/src/creation.ts), line 85; [runtime.cpp](../../contracts/runtime/runtime.cpp), lines 915–923; [native-quote.ts](../../services/api/src/resources/native-quote.ts), line 30).
   - **What this is:** Shared creation, paid member capacity, resource allowances and hosted storage depend on initialized chain policies and separately configured API services.
   - **Problem:** `createcfg.shared_usd` is still **2000 cents**, `capcfg` and `seatcfg` are absent, and the oracle quote is stale. With no hosting policy, the native membership-cap check returns without enforcing the approved ten-member allowance. `resourcecfg`, `ramobs`, `ramlimits`, `rampools` and `ramreserve` are absent, so observed DAO RAM enforcement and paid RAM provisioning are not active. The API reports Connect, hosting, card RAM, storage billing and retention unconfigured.
   - **Fix:** After resolving finding 2, initialize free shared hosting, governed rates and the resource policy; perform the existing RAM binding/migration/allocation process before enabling enforcement. Configure each provider service and rehearse its actual sandbox events. Read policies back and validate usable flows before marking the deployment ready.
   - **If we skip it:** The live setup does not deliver free creation plus ten free members, graduated monthly billing, or the promised separately billed RAM/storage. New TLOS price-dependent purchases cannot use the stale quote. Merely adding env flags cannot replace on-chain initialization.

4. **The Hub still advertises the previous runtime release and old metadata** ([directory.ts](../../protocol/directory.ts), line 102; [native-chain.ts](../../services/api/src/native-chain.ts), line 327; [upgrade-testnet.ts](../../tools/deploy/upgrade-testnet.ts)).
   - **What this is:** Hub registrations advertise reviewed code/ABI hashes, DAO references and public operator endpoints.
   - **Problem:** The only registered runtime is `daclifycore1`. Its advertised code hash starts `35b70188`, while deployed code starts `f40c696e`; the ABI hashes differ too. Its metadata contains only a title/description, so after correcting the Boolean transport the current directory parser still returns `entries: [], skipped: 1`. The upgrade script updates code/ABI/module pins but does not refresh registry metadata or execution links.
   - **Fix:** Re-register the reviewed current hashes and valid operator/DAO/portal metadata. Add post-upgrade verification for registration and links, using the existing deployment helpers.
   - **If we skip it:** Registration alone does not establish a usable independent portal connection. Own-runtime DAO listing is separate, so this does not imply the existing shared DAOs disappeared.

## Should fix before paid-module or broader launch claims

5. **A module price is not enforced access, and merchant receipts do not fulfill module services** ([runtime.cpp](../../contracts/runtime/runtime.cpp), lines 1014 and 1117; [service.ts](../../services/api/src/payments/service.ts), line 597).
   - **What this is:** Native `mod:` transfers split a module charge; Stripe Connect records a DAO product payment.
   - **Problem:** Compiled-WASM reproduction enabled a module listed at **2.0000 TLOS with zero payment receipts**. Installation does not check its price or a license. Native module-charge receipts have a payer/module but no DAO/member entitlement, and Connect reconciliation stops at the verified order/refund/dispute record. No first-party module consumes these receipts to deliver a paid feature automatically. All five current first-party prices are zero, so their free use is expected; the gap matters when selling paid access or automated fulfillment.
   - **Fix:** Define the charge unit for the first actual paid feature, then bind its receipt to the exact DAO, customer, feature and operation or accepted term, with once-only fulfillment and explicit refund/dispute behavior. Keep ordinary free governance usable. Avoid inventing a generic billing framework before that feature exists.
   - **If we skip it:** A nonzero catalogue price does not create enforceable monetization, and successful checkout does not deliver a paid module feature. The existing docs/UI disclose receipt-only behavior; this is an incomplete commercial capability, not a newly discovered secret payout path.

6. **The five built-ins are integrated, but installation is not dependency-complete or an arbitrary plugin system** ([ModulesPanel.vue](../../../daclify-frontend/src/components/ModulesPanel.vue), line 309; [native-chain.ts](../../services/api/src/native-chain.ts), line 2427; [module.hpp](../../../daclify-backend-modules/contracts/common/module.hpp), line 12).
   - **What this is:** The UI enables reviewed contracts using fixed action/grant sets. Backend readers and Vue panels support the five known module IDs.
   - **Problem:** Enabling a module does not install or configure its dependencies. Governed Works requires Decide; grants require Works, Decide and a DAO governance policy; endorsement admission also needs an admission policy. Custom Works/payroll settings are not persisted at installation. An arbitrary third-party catalogue listing gains neither a reader nor UI panel. Once a module's RAM payer is bound, another independent runtime cannot reuse that physical module account.
   - **Fix:** Add dependency/readiness guidance to the existing enable flow, with explicit consent for any additional grants. Document independent deployment as runtime plus its own bound module accounts and operator services. Describe new third-party integrations as reviewed SDK/backend/UI additions, not automatic code loading.
   - **If we skip it:** An administrator can enable a module and still have no usable end-to-end workflow. Fixed limits and manual independent deployment remain legitimate current constraints, but should be visible before setup.

7. **One owner key controls all ten native Daclify accounts** ([keys.ts](../../tools/deploy/keys.ts), lines 38–42; [permission snapshot](2026-10-09-testnet-account-permissions.json)).
   - **What this is:** Native owner/active authorities control contract upgrades, permissions and native account funds, independently of internal DAO administrator roles.
   - **Problem:** Every owned account has threshold-one owner authority with the same key. That key also satisfies `3boidanimus3@active`. Each deployed contract has a distinct active key; runtime/modules/names additionally allow their own `eosio.code` as an alternative. Therefore the shared deployment is operator-controlled, not a native multisig governed by a Decide vote.
   - **Fix:** Before mainnet funds, separate deployment/recovery authority from funded-wallet use and keep owner control cold or under an explicitly approved multisig. Review service signing permissions and attestations independently. Do not rotate authorities during a read-only audit.
   - **If we skip it:** Compromise of the common owner credential can replace all contracts and permissions. This is a clear testnet trust boundary, not evidence that any key is compromised. The Mac's configured bootstrap key matches only runtime active, not the shared owner; server secret custody was not inspected.

## Module rules and usability

| Module/facility | Money and access rules reviewed | Setup needed / current limit |
| --- | --- | --- |
| Decide, including elections | Member, internal credit or escrowed native stake weighting; domain/nonce checks; frozen voting weight; funding execution pins policy, code and exact project/application. Ordinary polls and representative titles move no money. | Enable Decide and configure the DAO policy. Native payouts use the DAO asset, not virtual governance credits. |
| Works, agreements, service catalogue | Full milestone reservation before acceptance, designated contributor consent for agreements, independent reviewer, no self-review, cancellation preserves approved liabilities, once-only native payment/internal claim. Public service listings do not hold funds. | Governed funding needs Decide and funds; maximum sixteen milestones. A reviewer other than the contributor is needed. |
| Payroll | Administrator creates a fully funded term; one to twelve bounded installments; due-date and duplicate-payment checks; disabling preserves approved liabilities. | Fund the whole term. Pause affects the schedule helper; direct Treasury payment of approved due debt remains possible. Only the separate guardian pause blocks that payment. This is documented behavior. |
| Grants rounds | Eligibility review is not funding authorization; contributor submission freezes consent; Decide authorizes awards; round cap and Works reservation execute atomically; no donor pool or matching implementation. | Enable Grants, Works and Decide, configure policy, publish rules, and fund the DAO. Native asset rail only. |
| Endorsement admission | Distinct current eligible endorsements, revision/deadline checks, one-time admission, no treasury/credit/role grant; ordinary admission checks capacity when hosting policy exists. | Enable the module and opt into its admission policy. Sponsorship is not proof of unique personhood. |
| Archive | Exact signed approval, source pins and bounded supported-family pruning; original encrypted content still needs its keys. Archived pinned objects use the same storage ledger. | Supporting archive service/contract actions, not a sixth catalogue plugin. Independent backup/provider qualification and explicit destructive cleanup gates remain required. |
| Names marketplace | Separate native account provisioning and governed marketplace fees; token identity, exact amounts, sale references and receiving token rows checked. | `daclifynames` has a contract but is not a DAO-installed module. Stale oracle affects converted price availability. Real card fulfillment is not newly qualified by this audit. |
| DAO merchant payments | Current admin + fresh proof for controls; DAO-scoped server credentials; immutable gross/merchant/fee revision; authoritative provider reads; idempotency; bounded refunds; dispute records. | Connect service currently unconfigured. USD card receipts only; each paid feature must implement fulfillment. Native treasury transfers have no Connect commission. |
| Hosting, RAM and pinned storage | Explicit subscription/capacity consent; accepted pricing snapshots; invoice verification; admission gating preserves existing rights; RAM actually acquired before crediting; prepaid storage/grace and archive accounting. | Core implementation and fixtures exist; policies, workers and provider qualification are incomplete on the public deployment. |

## Payment policy comparison

| Purpose | Approved/current implementation rule | Live testnet observation |
| --- | --- | --- |
| Shared DAO creation | Free; ten free active governance identities. | Old $20 setup config, no hosting policy. |
| Extra shared member capacity | First forty extra slots $1/month each, next two hundred $0.50, later $0.20; agreed prices preserved until explicit acceptance. Fifty total slots = $40/month. | No seat policy, hosting service disabled. |
| Independent deployments | Contact for pricing; own-server and external-portal choices. | No independently registered deployment; internal legacy `independent_usd: 5000` does not establish a self-service $50 offer. |
| Native marketplace module charge | Default third-party platform share 5%; first-party charge goes 100% to Daclify. Split applies to the charge, not every DAO treasury payment. | Rates 500/10000 basis points; all five listed prices zero; enforced paid access absent. |
| Connect module-product checkout | Default 5% platform commission, governed for new orders; original merchant/order snapshot and separate Stripe processing costs. | `paycfg` absent; code has a 5% fallback when reviewed platform governance exists. Connect provider unconfigured, so there is no merchant payment readiness. |
| RAM paid in TLOS | Native acquisition cost plus 5% Daclify fee; actual acquired bytes credited to selected payer/DAO allocation. | No active observer/pools/resource policy. |
| RAM paid by card | USD conversion of acquisition cost plus 20% operational charge; uses segregated TLOS reserve. It does not also add the native 5% charge or ordinary conversion premium. | Card RAM disabled, reserve absent, price quote stale. |
| Pinned storage, including archives | 100,000,000 bytes free; $1 per approved additional 1,000,000,000 bytes/month; monthly prepayment; maximum thirty-day unpaid grace before qualified over-capacity cleanup. | Pinata configured, billing/retention/notices disabled; configuration does not prove provider availability. |
| Virtual governance credits | Voting weight only; no implied redeemable asset or payout. | Existing DAO credit supplies zero. |
| Other-chain payment statements | Admin-attested evidence; recording does not settle native debt or verify another chain. | No trustless cross-chain settlement module found among the created modules. |

Stripe's current documentation confirms that `Stripe-Context` can scope requests to a platform's connected accounts, including v2 merchant/recipient accounts. The installed SDK sends that header as intended; older examples using only `Stripe-Account` are not evidence that our header is wrong. Direct charges and explicit application-fee refunds match the intended integration, but actual account/country/capability activation still requires sandbox qualification. [Stripe context](https://docs.stripe.com/context), [direct charges and refunds](https://docs.stripe.com/connect/direct-charges).

Antelope's default unlinked minimum is active; a linked child authority and parent hierarchy have distinct roles. This is why the seven missing links matter even though the runtime's executing code can satisfy its own authority. [Accounts and permissions](https://docs.antelope.io/docs/latest/protocol/accounts_and_permissions/), [custom permission links](https://docs.antelope.io/docs/latest/getting-started/smart-contract-development/linking-custom-permission/).

## Actual verification

| Check | Result | Boundary |
| --- | --- | --- |
| Core test suite | 101 files, 593 tests passed. | Includes compiled VERT cases; excludes native/provider/PostgreSQL suites. |
| Modules test suite | 27 files, 144 tests passed on serial repository rerun. | Initial concurrent run timed out in completion-upgrade at its 5-second default; 143 passed then. No code/timeout changes were made. |
| Frontend test suite | 31 files, 151 tests passed. | Component/logic tests; not an actual hosted wallet checkout journey. |
| PostgreSQL integration suite | 27 files, 193 tests passed. | New disposable local database, removed afterward. Real schema/SDK, fixture Stripe HTTP responses and fixture chain responses. |
| Live inventory | Ten Daclify-owned accounts, funded deployer, four external chain dependencies, one Hub registration and three existing shared DAOs. | Read-only RPC and public status/directory endpoint queries. |
| Directory reproduction | Actual gateway and live endpoint reject real native Boolean representation. | No synthetic-only claim. |
| Paid module installation reproduction | Listed 2 TLOS module enabled with zero receipts using compiled current runtime. | VERT fixture; no real funds moved. [Reproduction](2026-10-09-module-payment-reproduction.json). |

Test command logs remain locally in `/tmp/daclify-core-module-audit-tests.log`, `/tmp/daclify-modules-payment-audit-tests.log`, `/tmp/daclify-modules-payment-audit-retest.log`, `/tmp/daclify-frontend-module-audit-tests.log` and `/tmp/daclify-module-audit-postgres.log`. The [account map](2026-10-09-testnet-account-map.md) and [public JSON snapshot](2026-10-09-testnet-account-permissions.json) contain every observed permission, key, wait and action link.

Verdict: the free built-in module treasury rules have meaningful enforcement and test coverage. The public deployment and independent Hub flow need fixes before claiming complete billing or plug-and-play paid modules.

Not checked: no fresh actual Spring-native test run, mainnet, real Stripe Connect onboarding/charge/refund, bank payouts, Pinata availability/removal, hosted browser/wallet journey, or 40,000-member load benchmark. The current Mac native manifest points to a stopped fixture; it was not rewritten. No live assets, authorities, provider configuration or implementation code were changed.
