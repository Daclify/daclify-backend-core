# Platform administration, creation fees and status

Execute inline with the planning/execution skills. No delegation. Work in three sibling daclify-platform worktrees on codex/platform-fees-status; preserve existing servers, keys and chain state.

User policy: shared creation $20 USD; independent setup $50 USD with blockchain resources paid separately. TLOS uses the existing 20% conversion premium. Existing independent deployment is a kit, so the application must show the fee and resource boundary but refuse checkout until an independent provisioning path is available.

Core owns canonical platform/status/order schemas and the native fee ledger. Add creation policy/order tables without changing old persisted rows. USD prices are on-chain, editable by the linked Daclify DAO's signed administrator. Existing native upgrade authority remains disclosed. TLOS quotes use bounded, fresh on-chain rate observations and integer arithmetic; no browser-supplied prices. Each order binds a creator public key, deployment type, fee, expiry and stable DAO id. Native token transfers record payment and forward only a valid fee to the platform treasury. A verified Stripe webhook can attest the captured USD fee through the configured settlement account. Returning from checkout cannot mark an order paid. Shared creation consumes a paid order atomically with DAO initialization/module installation; retries return the same DAO. When fees are configured, ordinary createdao cannot bypass the fee. Independent orders/checkout are refused while provisioning is unavailable.

Use a PostgreSQL migration for immutable creation requests and checkout binding; owner-scoped reads, request idempotency, row locks and reconciliation protect retries. Drafts contain public metadata/public keys only. Existing free hosted-service receipts must not satisfy creation fees. Reuse Stripe and price helpers; no new dependency or custody provider.

Daclify DAO goes immediately below DAO hub. Its page reads the configured governance DAO, links its normal workspace and treasury, and lets its administrator sign platform fee and first-party module registration/removal/copy changes through the existing instruction path. Publisher authority remains separate for third-party pricing. Unlisting blocks discovery/new installation; it does not cancel funded liabilities. Module guide remains in Documentation, not the Resources navigation.

Status replaces that resource link. Show API/package/interface versions, live chain identity/head/irreversible height, runtime/hub/module deployments and code pins, the platform governance DAO, fee policy and rate age, treasury and name service configuration, database migration state, storage/account/social/card/docs provider configuration and service limits. Public status never returns secrets, DSNs, credentials, user records or raw errors. Configured, reachable, missing and unknown are separate states; configuration is not live provider qualification.

- [x] Bootstrapped the three worktrees; C++ baseline build/codegen completed before the red tests. Full pre-change baseline unit suites were not rerun.
- [x] Added fee tests; six initial cases failed on the missing setcreate ABI as expected. Added native administration and canonical boundary checks.
- [x] Implement additive native fee policy/orders, paid creation and DAO administration actions; build/codegen.
- [x] Implement producer-owned status/payment types, native gateway, PostgreSQL order service, Stripe routing and API enforcement; verify amount/currency/ownership/replay/error paths.
- [x] Add navigation, Daclify DAO, Status and resumable card/TLOS creation UI using the existing design system and canonical types.
- [x] Generate contextual docs, update versions/artifacts and add browser/native/integration regression flows.
- [x] Ran the applicable checks and reviewed the diff; commit this verified feature branch. External qualification and independent provisioning limits are recorded below.

Native fixtures must use owned containers and ports; never reset the existing default fixture. Production deployment and live funds movement are not authorised by this code task.

## Implementation and verification

Branch: `codex/platform-fees-status` in the three sibling repositories under the isolated `daclify-platform` worktree. This is local review code; it does not authorize production deployment or funds movement.

Policy: initial shared creation 2000 USD cents, independent setup 5000 USD cents plus separate blockchain resources, TLOS conversion premium 2000 basis points. The linked platform DAO administrators may change these on-chain values. First-party/third-party usage fees remain separate.

Core adds `createcfg` and `createords` without changing supported old persisted rows. Public API creation requires an immutable paid order; configured runtimes reject the old native free action. Orders capture a creator key, deployment, amount and expiry. TLOS transfers validate token identity, exact amount, memo and freshness and forward the valid fee to the treasury. Stripe attestation binds a verified event to the stored account, checkout and captured USD amount. The relayer/settler remains trusted for card settlement. PostgreSQL row locks and stable IDs permit retries after uncertain responses. DAO creation, enrollment, policy and initial modules form one native transaction. Refunds/chargebacks are operator procedures.

The Daclify DAO route uses the native `setgov` link and existing signed instructions. It exposes fee/settler policy, module commissions/names policy, first-party registration/descriptions and catalogue moderation. A catalogue removal does not remove existing installations or liabilities. The platform page uses active administrator authority; it does not pretend member ballots automatically execute these changes. Native upgrade, fee treasury and oracle authority remain with the operator.

Status reads actual chain identity/head, runtime/hub/module hashes and public native permissions/resources, fee/creation/catalogue/governance configuration, migrations, public service limits and provider configuration flags. Pinned module hashes are verified; runtime/hub hashes have no release pin and are labelled unverified. Configuration does not prove live provider availability or production qualification. Credential-bearing RPC URLs are refused because the network endpoint is public. No secrets, connection strings or account records enter status.

Creation displays the captured price and full payment network, retains the order ID in the URL, and resumes verified orders. A chain switch clears stale quote display. Independent checkout is refused until self-service provisioning and resource quotation exist; displaying $50 is not a claim that independent provisioning is implemented. Card checkout remains unconfigured until Stripe credentials and a webhook are supplied. Pinata/Google/Telegram credentials are still absent. No live provider test or production deployment was performed.

Owned fixture: `daclify-platform-native`, RPC 19988, synthetic keys in ignored artifacts. PostgreSQL uses a new `daclify_platform_test` database on the previously owned test container, port 16432. Browser/API ports 5279/3109. The default 18888 chain, 15432 database, 5178 frontend and 3008 API were not reset or restarted.

Tests and verification results will be finalized after the last checks. Initial missing-ABI fee tests failed as expected; the compiled C++ tests subsequently passed. One browser test initially failed because it reloaded and correctly locked the vault; the test now unlocks before asserting signing controls.

Verification recorded 2026-10-07:

- Pinned CDT/Spring C++ contract build and ABI generation succeeded. The 10 new compiled-WASM creation tests pass, including failed-creation retention, duplicate payment/card references, expiry, exact amounts, independent policy and attestor/owner checks.
- Core: lint and TypeScript passed; 347 unit/compiled-WASM tests passed; generated docs check and build passed. The release requirement register now covers the new fee, card, PostgreSQL, native and browser paths. One initial register check failed because a frontend test path lacked its sibling-repository prefix; it was corrected and the 347-test run passed.
- PostgreSQL: 67 integration tests passed in the owned database, including immutable orders, owner isolation, concurrent once-only fulfillment, verified webhook binding, chain switch refusal and API/CSRF/price boundaries.
- Modules: lint/types/docs verification and all 60 tests passed; public SDK/help version metadata is 0.3.0-alpha.1. Contract WASM did not change.
- Frontend: lint/types and all 53 unit tests passed; Vue/Vite build passed. New platform routes pass desktop/mobile accessibility and paid signing flows.
- Native: the targeted two comprehensive preset/governance journeys passed on port 19988, including paid creation, idempotent receipt retries, signed fee/catalogue controls, unlisting rights preservation, cross-DAO refusal, scoped credentials, guarded funding and emergency controls. Other native suites that target the shared default fixture were not run or reset.
- Browser: all 60 cases have passed across a full run with 56 passes and targeted reruns of the four corrected marketplace/passkey fixture cases. No case was skipped. The earlier full run's four failures are retained in this record; they were not product authority failures. The old free-creation journeys now quote/pay an order; custom-policy tests choose their policy before creation and assert preinstalled Decide rather than enabling it again.

Reproduce the owned browser fixture: start daclify-platform-native on port 19988, run install-modules.ts, then configure-platform.ts (owned container only) to seed synthetic prices, catalogue/copy and name tiers. Run dev:local with DACLIFY_TEST_DATABASE_URL ending in _test on localhost, DACLIFY_TEST_API_PORT=3109 and DACLIFY_TEST_UI_PORT=5279. Run frontend browser tests with the same API/UI port overrides. The fixture publishes a synthetic $1/TLOS observation; refresh it before 15 minutes elapse. Native preset tests seed their own catalogue and fee policy; configure the browser fixture after running them.

Unpaid creation orders and permanent payment receipts use runtime RAM; the relayer's existing sponsored-write limits are the current protection. Capacity, expired unpaid-order cleanup, operational rate publication, refund/chargeback procedures and live provider qualification remain production release work. There is no independently verified runtime/hub release pin, and production publication remains refused.

Final review also checked live native status for eight configured authority/contract accounts (including the fee treasury, relayer and names account). Existing orders now resume their captured terms when current rate/availability changes; a PostgreSQL regression verifies this. The retired free-creation route documents its actual 409 response. No runtime/hub production release pin or live provider qualification was invented.
