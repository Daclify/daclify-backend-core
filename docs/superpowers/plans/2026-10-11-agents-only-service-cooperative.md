# Agents Only Service Cooperative Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan inline, task by task, after review of the proposed design. No sub-agent delegation is authorised. Steps use checkboxes for tracking. This is a proposed implementation plan, not permission to execute it or deploy live changes.

**Goal:** Deliver a five-member agents-only cooperative that performs bounded public-source monitoring, governs funded work, independently reviews evidence, reconciles costs and settles authorised native obligations.

**Architecture:** Reuse current agent membership, scoped signatures, Decide, Works, documents, native Treasury and PostgreSQL jobs. Core owns the client, authentication, host/SQL/provider adapters and release coordination; modules own cooperative schemas, business logic and migrations; frontend consumes pinned producer artifacts. Begin with deterministic providers/synthetic receipts on an owned native fixture, then an explicitly approved testnet and commercial pilot.

**Tech Stack:** Antelope C++; existing strict TypeScript, Node 24/npm 11, Zod, WharfKit, Fastify, PostgreSQL, Vue 3/Vite/Pinia and Vitest/native/Playwright tooling. No new model framework, Redis, queue broker or chain is needed. An optional MCP dependency is qualified against official documentation at its own task.

**Spec:** [Proposed agents-only design](../specs/2026-10-11-agents-only-service-cooperative-design.md).

**Analysis:** [Product, costs and economic viability](../../research/2026-10-11-agent-service-cooperative-analysis.md).

## Global constraints

- `participantMode = agents-guarded`; every cooperative member actor is an agent. Human sponsor/guardian/customer accounts receive no membership implicitly. Platform DAO 1 is unchanged.
- Initial roles: coordinator, collector, producer, evaluator A, evaluator B. Administrator roots and provider secrets remain outside all LLM/CLI/MCP routine tool arguments.
- Proposed pilot policy: member weight, duration 900 seconds, quorum 8,000 bps, approval 7,500 bps, governed Works, per-milestone cap 100,000 and UTC-day cap 500,000 base units of four-decimal testnet TLOS. Fast local native funding fixtures explicitly select the already-supported 60-second duration; profile/schema tests verify the 900-second pilot default, and live qualification observes the actual selected deadline. Commercial limits require separate review; no USD/TLOS conversion is assumed.
- Existing maximums remain: 16 milestones/project, 16 credentials/member, 16 scopes/credential and seven-day credential expiry. Agreements requiring `offeragr`/`acceptagr` use explicit root ceremonies or are omitted in favour of ordinary Works projects initially.
- Order bounds: 25 HTTPS source URLs, 256 KiB decompressed text/source, 20 model calls, 200,000 total input/24,000 output tokens, two revision rounds. Initial operating ceilings are $2.50/run and $25/cooperative UTC day, in integer USD micro-units.
- Current native permissions and exact released code/ABI pins are authoritative. No schema/HTTP label can authorise spending, review or upgrades.
- Preserve user modifications and current remediation work. All implementation is on `dev`, with only task-owned files committed. Release to `main`, live deployment, authority updates and real asset operations require express authorisation.
- Module schemas/migrations remain module-owned; public API/SDK and SQL/auth/provider boundaries remain core-owned. No private core imports or raw SQL/signing capability is passed into module business code.
- Fixture receipts, estimated costs, unknown provider outcomes, actual native claims and actual payouts must be distinguishable in API/UI/reporting.
- Paid operation stays disabled until merchant, provider, release, payment, refund, treasury-backing and commercial-policy gates pass. Confidential orders stay disabled until a separate private-delivery design is qualified.
- Prices in the economic model are illustrative, not existing product policy or approved new fees. No testnet token valuation or internal-transfer revenue is allowed.

## Review focus

- A timed-out submission with an advanced nonce may have succeeded or may be a different action; do not retry into duplicate work/payment. Task 2 and Task 5 must test semantic reconciliation.
- An agent can be revoked, paused or have its code/policy pin changed after producing evidence; reject stale approval/submission while preserving completed evidence and liabilities. Tasks 3, 5 and 6 own these cases.
- A customer may be a valid Daclify account without cooperative membership; enforce per-order customer ACL and do not grant a vote. Tasks 4 and 9 own these cases.
- A fiat paid receipt is not native treasury backing; a native claim is not an external payout. Tasks 7 and 8 must show these separately and reject fabricated settlement evidence.
- A worker can lose its lease while a provider request is in flight; fence stale writes and retain uncertain charges without minting free budget. Tasks 4 and 5 own these cases.

## Baseline and dependency gates

Core `cdc482a`, modules `d93ffea` and frontend `4d6df73` are the reviewed committed snapshots; current dirty source adds audit-remediation alpha.3/alpha.19 changes. Re-read source and generated pins at execution time. The ready-review ownership JSON in the IDE is pre-rollout and must not be executed. Live testnet source reported alpha.2 during the investigation; Relay/Fees operator migration and alpha.3 cutover were still prepared.

Record the baseline commit plus current source/artifact hashes in a new task evidence file. Verify existing remediation changes have been integrated/qualified through their own plan. Do not silently claim their release or production completion. A native fixture can exercise new cooperative work independently of live cutover; public deployment waits for matching reviewed releases.

Planning envelope: 250–420 engineering hours, plus commercial/provider qualification. The first 40–70 hours should produce a runnable example, safe client/scopes and deterministic native demonstration suitable for a go/no-go decision. Estimates are opportunity-cost assumptions, not fixed delivery promises.

## Repository file map

| Owner             | Existing files to reuse/extend                                                                                                          | Proposed additions                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Core SDK/protocol | `examples/agent-publish.ts`, `sdk/index.ts`, `sdk/public-package.json`, `protocol/index.ts`                                             | `sdk/agent.ts`, `protocol/agent-host.ts`, `examples/agent-cooperative.ts`                                                       |
| Core API/host     | `services/api/src/store.ts`, `jobs.ts`, `server.ts`, `main.ts`, `payments/service.ts`                                                   | `services/api/src/cooperative/{host,store,routes,worker,report}.ts`                                                             |
| Modules           | `protocol/agreements.ts`, `protocol/index.ts`, `package.json`, existing generated Works/Decide SDK and Archive migration-export pattern | `protocol/cooperative.ts`, `cooperative/{index,service,runner,evidence,migrations}.ts`, `migrations/cooperative/001_orders.sql` |
| Frontend          | `src/components/ServiceCatalogue.vue`, `GovernancePanel.vue`, `TreasuryPanel.vue`, `src/views/Workspace.vue`, `src/api/client.ts`       | `src/components/CooperativePanel.vue`, `src/views/CooperativeOrder.vue`                                                         |
| Tests/docs        | Existing agent, Works/funding, payment, integration and e2e suites                                                                      | Named tests below, producer guides and task evidence                                                                            |

These are planned paths, not claims those files/APIs exist. Confirm no concurrent work has created them before execution; adjust a migration's number only to the next unused version, preserving applied hashes.

## Task 1: Repair and exercise the existing agent quickstart

**Files:** modify core `examples/agent-publish.ts`, `docs/dao-presets.md`, `tests/native/dao-presets.test.ts`; create `docs/evidence/2026-10-11-agent-quickstart.md` at execution.

**Interfaces:** consumes current `ApiRoutes.challenge.input`, `VaultAccountSchema` and native agent fixture; produces a runnable publishing journey and explicit matching protocol/version instructions.

- [ ] Reproduce the existing script through the native test named `runs guarded agent funding and scoped API signatures under actual native permissions`. Its current challenge sends only `signingKey`; the expected pre-fix failure is the missing `encryptionKey` boundary, not a skipped suite.
- [ ] Parse the member encryption public key once before requesting the challenge, include the same validated key in challenge and login, and preserve public-only/origin/key-handling restrictions. Do not broaden scopes.
- [ ] Run the same script/native fixture and verify document version plus transaction receipt, not just the two-key schema. Add an assertion that a substituted encryption key fails and no member/document state changes.
- [ ] Run relevant auth/login tests and `npm run typecheck`; update stale agent-guide versions against the qualified source. Record exact native fixture and generated hashes.
- [ ] Review and commit only these task-owned changes on `dev`, with message `fix(agent): bind the complete identity in the publishing quickstart`.

**Verification command:** `npm run test:native:paid -- -t 'runs guarded agent funding and scoped API signatures under actual native permissions'`, on the configured owned fixture; affected login tests plus typecheck. Expected: selected native journey executes and passes with no secret-bearing output. Missing fixture means unrun, not success.

## Task 2: Publish a safe Node agent client

**Files:** create core `sdk/agent.ts`, `protocol/agent-host.ts`, `tests/agent-client.test.ts`; modify `sdk/public-package.json`, `protocol/index.ts`, `tools/release/package.ts` if the export builder requires it; add agent client guide.

**Interfaces:** export `AgentSigner` with `signLoginMessage(message: string): Promise<string>` and `signInstruction(request: instruction): Promise<string>`; `AgentConnectionSchema` binds API/origin/DAO/member/session/public keys/code pins; `createAgentClient(connection: AgentConnection, signer: AgentSigner): AgentClient`. Client methods are `login()`, `readAuthority()` and `submit(build: (nonce: string) => instruction): Promise<AgentSubmitResult>`. `AgentSubmitResult` is `submitted` with transaction ID, `rejected` with typed code, or `reconcile-required` with original instruction commitment/nonce. `AgentAuthoritySnapshot` is core-owned and contains canonical validated authority fields from the design.

- [ ] Write `agent-client.test.ts` cases `binds_v3_login_identity`, `refuses_changed_origin_or_runtime`, `checks_member_scope_and_module_pin`, `serializes_shared_member_nonce`, `returns_reconcile_required_after_unknown_submission` and `never_automatically_resigns_unknown_effect`. Assert no root/admin/withdraw request reaches the signer through the routine client.
- [ ] Run `npm test -- tests/agent-client.test.ts` and confirm failures are missing client behaviour.
- [ ] Implement the Node client with existing fetch, Zod and codecs. Validate every response before use, bound HTTP time/bytes, handle host-only session/CSRF and keep credentials out of errors. Serialise routine requests in the process; persistent multi-process ownership is Task 5.
- [ ] Rerun tests and `npm run typecheck`; exercise the quickstart against the exported SDK subpath and verify package contents contain no private API implementation.
- [ ] Commit task-owned changes: `feat(agent): add a scoped Node client with explicit reconciliation`.

**Constraint:** `submit` never grants root policy authority. A nonce conflict permits fresh preparation only for a known rejected instruction; an unknown accepted effect requires semantic reconciliation in the calling workflow.

## Task 3: Demonstrate agents-only roles and safe credential lifecycle

**Files:** create core `examples/agent-cooperative.ts`, `tests/native/agent-cooperative.test.ts`; extend `tests/guarded-agents.test.ts`; modify frontend `src/components/GovernancePanel.vue` and create `tests/unit/agent-scopes.test.ts` for explicit role scopes; add core guide topic.

**Interfaces:** consumes Task 2 client and existing `CreateDaoSchema`, actor/session/role actions. Produces the five-member fixture, reviewed session scopes and current authority snapshots. No new C++ action or scope is required for ordinary Works proposals.

- [ ] Add native tests `creates_five_agent_members_without_sponsor_vote`, `rejects_human_enrollment`, `cannot_administer_or_withdraw_with_routine_keys`, `renews_credential_then_revokes_old_entry`, `keeps_member_identity_and_balances_after_recovery` and `revocation_or_pause_rejects_stale_work`.
- [ ] Run `npm run test:native -- tests/native/agent-cooperative.test.ts` on an owned native chain and confirm missing-flow failures.
- [ ] Prepare free creation through existing creation orders, admit four agents using the isolated founding root, install reviewed modules and grant only role table scopes. Set the exact policy and funded test amounts from Global Constraints, using the explicitly labelled 60-second local fixture duration. Wait on its authoritative closing time and give only the selected deadline-observing test a justified timeout; do not raise unrelated test budgets.
- [ ] Implement credential renewal before day six with new-key possession and a successful scoped round trip before old deletion. Test the 16-entry limit and expired key rejection. UI describes consequential voting/review scopes rather than treating all credentials as publishing-only.
- [ ] Verify guardian authority has no implied membership; recover signing identity without claiming old encryption recovery. Run affected VERT and native role/session suites.
- [ ] Commit task-owned changes: `feat(agent): demonstrate guarded cooperative roles and credential renewal`.

**Commercial gate:** actual guardian/root operators and compensation are reviewed choices, not inferred from the fixture's disposable identities.

## Task 4: Define service orders and install a narrow persistence boundary

**Files:** create modules `protocol/cooperative.ts`, `cooperative/service.ts`, `cooperative/migrations.ts`, `cooperative/index.ts`, `migrations/cooperative/001_orders.sql`, `tests/cooperative-orders.test.ts`; modify modules `protocol/index.ts`, `package.json`; create core `services/api/src/cooperative/store.ts`, `host.ts`, `tests/integration/cooperative-orders.test.ts`; modify core `store.ts` migration export registration.

**Interfaces:** module exports the design's `CooperativeProfile`, `ServiceOrder`, `FundingReference`, `DeliveryEvidence`, `UsageEntry`, `CooperativeReport` schemas/types and `CooperativeMigrations`. `CooperativeStore` methods are `createOrder(input: ServiceOrderInput): Promise<ServiceOrder>`, `getOrder(dao: DaoRef, orderId: string): Promise<ServiceOrder | undefined>`, `transitionOrder(input: OrderTransition): Promise<ServiceOrder>`, `reserveUsage(input: UsageReservation): Promise<UsageEntry>`, `reconcileUsage(input: UsageReconciliation): Promise<UsageEntry>`, `appendEvidence(input: DeliveryEvidence): Promise<void>`. All write inputs contain full DAO reference, expected revision and unique operation ID. `createServiceOrder(store: CooperativeStore, input: ServiceOrderInput): Promise<ServiceOrder>` validates business rules.

- [ ] Write module tests `freezes_offer_and_source_commitment`, `rejects_more_than_25_sources`, `rejects_missing_public_output_consent`, `same_request_same_payload_returns_same_order`, `same_request_changed_payload_conflicts` and `rejects_human_role_binding`.
- [ ] Write SQL tests `isolates_equal_ids_across_daos`, `rejects_stale_order_revision`, `reserves_budget_atomically_at_boundary`, `unknown_usage_keeps_reservation` and `hash_tracked_migration_preserves_existing_records`. Run the two test files and observe missing implementation failures.
- [ ] Create namespace `cooperative` and four tables for orders/runs/usage/evidence. Use exact integer money, immutable input hash, unique operation keys and foreign/check constraints; index DAO/customer lookup and runnable state. Core implements SQL transactions behind the exported store interface.
- [ ] Extend the existing migration coordinator with `CooperativeMigrations`, following Archive's producer-owned export, preserving every existing migration hash. Module code receives no SQL pool.
- [ ] Implement `createServiceOrder`, strict schema/state validation and optimistic revision transitions. Fixture commercial state is explicitly `fixture`; it cannot satisfy a production paid-receipt check.
- [ ] Run module unit tests and core PostgreSQL integration tests, including migration from the current supported release; typecheck both repositories and verify consumer package pins.
- [ ] Commit producer then consumer changes with linked evidence: `feat(cooperative): add bounded orders and namespaced persistence`.

## Task 5: Execute resumable work with bounded cost and signer ownership

**Files:** create modules `cooperative/runner.ts`, `tests/cooperative-runner.test.ts`; create core `services/api/src/cooperative/worker.ts`, `tests/integration/cooperative-worker.test.ts`; extend core `store.ts`, `jobs.ts` tests where needed and `main.ts` startup/shutdown.

**Interfaces:** module exports `CooperativeHost` and `runCooperativeStep(input: CooperativeRun, host: CooperativeHost, agent: AgentClient): Promise<CooperativeStepResult>`. The host exposes the Task 4 store plus validated `readAuthority`, `readCommercialReceipt`, `readFunding`, `readSettlement` and scoped job operations. Add core `renewJobLease(pool, jobId, owner)`, `completeJob(pool, jobId, owner)` and `requeueJob(pool, jobId, owner, dueAt)` with fenced compare-and-update results. Core owns the SQL capability; these functions are not unrestricted module APIs.

- [ ] Write cases `restart_resumes_completed_step`, `two_workers_cannot_own_same_member`, `expired_lease_cannot_commit`, `daily_budget_is_atomic_under_concurrency`, `unknown_provider_charge_is_not_free`, `funding_policy_or_code_change_requires_new_vote`, `unknown_native_submission_needs_semantic_match` and `replayed_task_does_not_repeat_paid_effect`.
- [ ] Run module unit and core isolated PostgreSQL worker tests; confirm the required protections fail before implementation.
- [ ] Implement one-step state transitions using existing jobs/leases. Persist the instruction/step commitment before an external effect, heartbeat only while the owner matches, and close/requeue using fencing. Limit initial runtime to one signer process/member.
- [ ] Reserve provider cost before a bounded callback and reconcile returned usage; hold uncertain results. Enforce run/day/token/call ceilings from Global Constraints, with a stop disposition rather than hidden budget expansion. A timeout cannot prove the provider did no work.
- [ ] Prepare funding through existing ordinary Works/Decide encoders and Task 2 client. Finalize/execute/settle only through existing authorised APIs; store and verify their actual receipts. Do not change native cap semantics to accommodate batch work.
- [ ] Run crash/concurrency/reconciliation tests, native funded-work journey and shutdown test. Verify no in-memory timer is the sole source of durable progress.
- [ ] Commit: `feat(cooperative): run bounded work with durable leases and reconciliation`.

## Task 6: Collect verifiable evidence and separate contributor from reviewer

**Files:** create modules `cooperative/evidence.ts`, `tests/cooperative-evidence.test.ts`; extend runner; create core `tests/native/agent-cooperative-review.test.ts`; add an evidence-format guide.

**Interfaces:** export `validateDeliveryEvidence(input: unknown, order: ServiceOrder): DeliveryEvidence` and `evaluateDelivery(input: DeliveryEvidence, authority: AgentAuthoritySnapshot): ReviewDecision`. `ReviewDecision` contains approve/changes-requested, structured failed checks and evidence commitment. Evidence schemas and bounds come from Task 4.

- [ ] Write cases `requires_complete_source_coverage`, `inaccessible_source_is_not_unchanged`, `rejects_wrong_window_or_order`, `rejects_unsupported_material_claim`, `source_instruction_cannot_change_recipient_or_tools`, `redirect_to_private_address_is_rejected`, `caps_decompressed_response`, `self_review_fails` and `revoked_reviewer_cannot_approve`.
- [ ] Run module tests plus the selected native review suite and establish pre-implementation failures.
- [ ] Implement collection with allowlisted HTTPS hosts, per-hop resolved-address/host checks, request/decompressed-byte deadlines and no user cookies. Publish source evidence and redacted report using existing document actions. Inputs are untrusted text, not workflow instructions.
- [ ] Implement deterministic coverage/order/hash checks before optional model evaluation. Publish a distinct reviewer document and submit existing Works review with the eligible evaluator credential; never issue payment solely on a model's free-form “approved” text.
- [ ] Exercise two revisions then a bounded failure; keep previous documents and pending approved liabilities. For evaluator compensation, demonstrate another reviewer rather than self-review.
- [ ] Compare deterministic fixtures against known changed, unchanged, unavailable and injected pages. Commit: `feat(cooperative): verify grounded delivery through independent member review`.

## Task 7: Bind real commercial receipts without inventing native backing

**Files:** modify core `services/api/src/cooperative/host.ts`, create `routes.ts`; extend existing `payments/service.ts` only for a typed read/fulfilment hook; extend modules `cooperative/service.ts`; add core `tests/integration/cooperative-payments.test.ts` and module state tests. Existing refund/provider code remains the authoritative implementation.

**Interfaces:** `readCommercialReceipt(dao: DaoRef, orderId: string): Promise<VerifiedCommercialReceipt>` returns confirmed merchant/environment/amount/currency/application-fee evidence or explicit pending/dispute/refund state. Module `reconcileCommercialOrder(order: ServiceOrder, receipt: VerifiedCommercialReceipt): OrderTransition` never sets native funding/payout. Core route registrations use existing session/CSRF/account-control and chain authority checks.

- [ ] Test `rejects_wrong_merchant_amount_currency_environment`, `fixture_receipt_never_enables_paid_execution`, `same_receipt_cannot_fund_two_orders`, `refund_pending_remains_reserved`, `customer_refund_does_not_erase_native_liability` and `paid_fiat_receipt_does_not_increase_native_available`.
- [ ] Run isolated HTTP/SQL provider fixtures and module unit tests; expected failures identify missing cooperative binding, not a new unverified Stripe SDK.
- [ ] Bind eligible existing Connect product/order references to immutable cooperative order commitments. Keep real payment/receipt/refund operations in core; module only consumes verified facts. Retain proportional application-fee refund behaviour and uncertain refund reservations.
- [ ] Before real operation, review merchant/legal responsibility, bank/provider eligibility, actual fees/tax, native asset funding and FX/reconciliation procedure. Keep capability disabled until sandbox charge/refund/dispute callbacks and native-backed delivery have actual evidence.
- [ ] Run native test proving an unbacked project cannot reserve funds despite a paid commercial receipt, and a backed project can settle once. Actual provider qualification follows the selected account's approved sandbox process; mocks remain labelled.
- [ ] Commit: `feat(cooperative): reconcile merchant receipts with explicit funding boundaries`.

**External gate:** merchant onboarding, real charges/refunds, treasury funding and releases require later express authorisation. This plan does not request credentials in chat.

## Task 8: Report true costs, revenue and payout states

**Files:** create core `services/api/src/cooperative/report.ts`, `tests/cooperative-report.test.ts`; extend module `CooperativeReportSchema`; reuse core `reporting/spending.ts` and its current receipt checks; add report route and explanatory guide.

**Interfaces:** `buildCooperativeReport(input: CooperativeReportInput): CooperativeReport` consumes complete reconciled commercial/usage records plus existing `SpendingReport`. It returns separate currency/asset totals, known/estimated/unknown counts and labour/acquisition assumptions, with completeness flags. No implicit USD valuation of TLOS is allowed.

- [ ] Test `does_not_count_internal_payouts_as_sales`, `does_not_double_count_all_in_operator_compute`, `shows_internal_claim_separately_from_transfer`, `unknown_charge_marks_incomplete`, `refunded_job_keeps_cost`, `cannot_sum_fiat_and_native`, and `matches_decimal_planning_fixture`.
- [ ] Run `npm test -- tests/cooperative-report.test.ts tests/spending-report.test.ts`; confirm missing report failures.
- [ ] Implement exact integer cost and receipt totals, explicit economic labour inputs and external sales attribution. Define margins consistently; gross price, retained revenue and surplus are different fields.
- [ ] Reproduce the checked planning model's base $33.2765 contribution in a fixture without treating its assumed price/churn as observed customer data. Cost micro-units remain exact; display rounding occurs at the edge.
- [ ] Run report/SQL completeness tests and export round trip. Commit: `feat(cooperative): expose reconciled economics and honest payout status`.

## Task 9: Provide cooperative and customer views without changing membership

**Files:** create frontend `src/components/CooperativePanel.vue`, `src/views/CooperativeOrder.vue`, `tests/unit/cooperative.test.ts` and `tests/e2e/cooperative.spec.ts`; modify `src/views/Workspace.vue`, `src/main.ts`, `src/api/client.ts`, `ServiceCatalogue.vue`, `GovernancePanel.vue` and `TreasuryPanel.vue` only where these views require it. Extend core `tests/integration/cooperative-orders.test.ts` for customer ACL.

**Interfaces:** Vue components consume pinned module schemas and the proposed order/report routes; customer route identifies full DAO/order and current authenticated account. No new frontend authority decision is trusted by core/chain.

- [ ] Write cases `customer_reads_only_owned_order_without_membership`, `customer_cannot_vote_or_review`, `operator_sees_pending_and_unknown_states`, `claim_is_not_rendered_as_external_payment`, `public_output_requires_consent`, and desktop/mobile keyboard/focus/overflow journeys.
- [ ] Run affected Vitest/Playwright tests against the real API contract fixtures and observe missing UI/ACL failures.
- [ ] Add a focused workspace cooperative panel with roles/control groups, orders, evidence, review, costs and receipts. Reuse existing components; product flows explain actionable status, not implementation internals.
- [ ] Add customer order/issue status outside membership controls; reject cross-customer and cross-DAO access in API regardless of UI filtering. A customer issue does not grant a native reviewer role.
- [ ] Run `npm run typecheck`, Vue template checks and relevant desktop/mobile e2e journeys; check late responses after changing DAO/account are discarded.
- [ ] Commit frontend/core ACL changes separately with linked producer artifact versions: `feat(ui): show cooperative work and customer order status`.

## Task 10: Deliver CLI and optional local MCP through the same client

**Files:** create core `tools/agents/cooperative.ts`, CLI tests and agent documentation; optional `tools/agents/mcp.ts`, MCP schema/permission tests and exact pinned dependency. Update package scripts only after the CLI exists.

**Interfaces:** CLI consumes Task 2 `AgentClient` and module public schemas; all commands support JSON receipts/results. Allowed operations are read status, prepare a proposal, vote, publish evidence and submit/review assigned work. Local stdio MCP exposes those same validated operations. No administrative/withdraw/arbitrary-sign tool exists.

- [ ] Write `cli_json_matches_canonical_schemas`, `tool_refuses_wrong_member_or_scope`, `secrets_never_appear_in_stdout_or_errors`, `unknown_effect_returns_reconcile_required` and `mcp_cannot_invoke_root_action` tests.
- [ ] Run CLI tests before implementation. Implement the small CLI first using Node and existing dependencies; scripts load protected local configuration and public artifact pins.
- [ ] If pilot operators need MCP, verify the current official TypeScript SDK, authorisation/security guidance and supported client using primary docs, pin the qualified version, and implement a local stdio wrapper around the same operations. No remote server/OAuth capability is claimed at this stage.
- [ ] Execute each permitted command against the fixture and one supported local client, including denied role actions. Document public registry/package access and AGPL licensing accurately; do not publish unqualified artifacts by assumption.
- [ ] Commit: `feat(agent): expose cooperative workflows through a typed CLI` and a separate MCP commit only if implemented/qualified.

## Task 11: Qualify the complete testnet experiment and measure the baseline

**Files:** native cooperative tests, core/module integration suites, frontend e2e, producer guides, core release/compatibility manifest, new dated execution evidence. Public-site changes live in its actual repository after locating and reading its instructions.

**Interfaces:** consumes Tasks 1–10; produces an exact tested source/artifact release, public/redacted example and measured pilot dataset. No feature is enabled because a package builds alone.

- [ ] Run the complete deterministic journey: five agents, customer fixture, native-backed vote, collector/producer evidence, non-self review, exactly one settlement, explicit claim/withdrawal distinction, restart/revocation/code-change cases and reconciled costs.
- [ ] Run required affected core/module/SQL/native/browser suites plus generated docs/ABI/package verification and supported-release migration checks. Record missing/failed/skipped suites honestly.
- [ ] Execute 30 matched monitoring tasks with a simple single-agent baseline and the cooperative, using identical sources/windows; record quality checks, elapsed time, aggregate tokens/searches, support minutes and failures, including failed/free tasks. Actual provider calls require approved experimental budget/configuration.
- [ ] Review full diff, immutable artifacts, trust/custody descriptions, public proxy behaviour and deployment pins. Prepare a concrete testnet proposal; no broadcast follows from preparation.
- [ ] After express testnet approval, create/fund only the authorised disposable cooperative and verify live readback and complete receipts. Production remains disabled.
- [ ] Publish the reviewed agent explanation/example in existing site Markdown and `llms.txt`, with proper network/version labels. No outreach or public publication is undertaken without its applicable authorisation.
- [ ] Commit verified task-owned sources/docs on `dev`. Record a go/no-go based on buyer commitments, comparative quality and measured costs before paid operation.

## Task 12: Approve and run a constrained commercial pilot

This is a separate operational increment, not a coding step triggered automatically by Task 11.

- [ ] Review/select the actual offer, public-output consent, merchant/legal entity, buyer terms/refunds, guardian/root operators, native compensation/caps, working capital, tax/FX treatment and collection/subscription/commission policy. Recompute the model for those decisions and real rate cards.
- [ ] Qualify eligible merchant onboarding, sandbox paid/refund/dispute journeys, real provider cost limits, source access, secret storage/recovery, native backing, immutable release and operational restore on the selected deployment. Confidential customer material remains excluded unless private delivery is separately designed and verified.
- [ ] Obtain explicit production/payment/deployment authorisation against that concrete reviewed release and operating packet. Set customer/volume/spend limits and stop criteria; external acquisition/outreach needs its own authorisation.
- [ ] Target three unrelated paying customers, 50 charged deliveries and four to six weeks of cohort observation. Track the analysis's proposed continuation gates and sample-size limits, rather than calling a short pilot proof of general viability.
- [ ] Reconcile every merchant receipt/refund, native liability, member payout, provider cost and budget reservation. Review repeat purchases and comparative output quality with customers.
- [ ] Continue, narrow or stop based on measured contribution, renewal, support and available reserves. Independent operator control, governed administrative changes, private delivery, additional chains and marketplace integrations each require a new bounded specification/plan.

## Requirements coverage and self review

| Design requirement                                                          | Owning tasks |
| --------------------------------------------------------------------------- | ------------ |
| All-agent membership; sponsor/customer outside voting                       | 3, 4, 9, 11  |
| Safe authentication, code pins, role scopes and nonce handling              | 1, 2, 3, 5   |
| Immutable bounded orders and full DAO isolation                             | 4, 5, 9      |
| Durable restart, lease fencing and provider-budget accounting               | 4, 5         |
| Exact Works funding, code/policy changes and independent review             | 3, 5, 6, 11  |
| Fiat/native boundary, refund/claim/payout distinction                       | 7, 8, 9      |
| Evidence/source limits and injection/SSRF resistance                        | 6            |
| Public-output consent; no unqualified confidential delivery                 | 4, 6, 9, 12  |
| Measured service/platform economics and real demand gates                   | 8, 11, 12    |
| Versioned docs, package pins, source-bound native/provider release evidence | 1–3, 10–12   |

Each Review Focus failure has an owning test above. Proposed type/method names are consistent between tasks and the design; all producer additions are distinguished from current interfaces. The plan deliberately reuses ordinary Works proposals and does not add agreement actions to session scopes. Commercial/native cap and operator choices remain explicit decision gates, rather than implementation defaults invented after coding starts.

No task is executed by preparing this plan. Review the proposed design and economic assumptions before product implementation; use the already established inline workflow for any subsequently authorised work.
