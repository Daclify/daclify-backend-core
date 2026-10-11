# Agents only service cooperative proposed design

Date: 11 October 2026, Atlantic/Canary. Status: proposed for review. The user selected analysis of an agents-only DAO and requested an implementation plan; the operational defaults below are the assistant's proposed choices. This document authorises no product implementation or live changes. [Economic analysis](../../research/2026-10-11-agent-service-cooperative-analysis.md) supplies the commercial rationale and calculation assumptions.

## Intent and scope

Build a reproducible agent cooperative that performs a narrow service, governs member funding, independently reviews evidence and reconciles payments. Its members are agents; an external human sponsor/guardian and commercial operators hold disclosed responsibilities without receiving voting memberships.

First offer: weekly change monitoring for up to 25 approved public product/documentation sources. Deliver a structured change brief with source coverage, timestamps, evidence hashes, diffs and grounded summaries. Initially use deterministic provider fixtures, synthetic customer orders and disposable testnet funds. A constrained commercial pilot follows commercial, provider, source-bound release and payment qualification.

Do not convert platform DAO 1. Create a separate tenant using existing `agents-guarded` participation. Do not implement an agent token, generic task marketplace, new chain, asset bridge, custodial wallet platform, automatic upgrade authority, arbitrary signing endpoint or open remote-plugin execution.

## Proposed product behaviour

1. An external sponsor prepares the existing order-backed DAO creation, supplies only the founding agent's public signing/encryption keys and reviews a guardian and limits. Sponsorship grants no member vote.
2. The founding agent's root controller admits the remaining four declared agents and assigns roles through existing signed instructions. These setup operations are deliberate administrative ceremonies outside the LLM tool surface.
3. Each member publishes a service/control-group declaration and obtains a role-specific credential from its root controller. A public label does not prove operator independence.
4. An external customer submits an immutable bounded order. A fixture receipt marks a test order; a real provider-verified receipt is required for the commercial path. Neither receipt is a native treasury deposit.
5. Agents prepare exact Works projects/milestones and vote on funding using current Decide policy. Begin from separately funded native treasury backing. All milestone amounts, recipients and document references are frozen before the vote.
6. A durable runner assigns collection and production work, reserves off-chain provider budgets and publishes evidence using member credentials.
7. A different eligible evaluator reviews the delivery. The contributor cannot review its own Works milestone. Review pays no money by itself; it can create an approved liability under existing contract rules.
8. Existing bounded finalization/execution/settlement APIs handle authorised transitions. Chain receipts establish native payout or internal claim. Customer delivery and refund state remain separately recorded.
9. A run failure preserves completed evidence, financial liabilities and cost reservations. It resumes the incomplete step where safe; uncertain provider/chain effects enter reconciliation.
10. The customer can acknowledge delivery or raise an issue without joining the DAO. Refund actions require the existing fresh account-control proof and merchant authority; an LLM receives no unrestricted refund credential.

## Membership, roles and governance

The initial five identities are coordinator, collector, producer, evaluator A and evaluator B. All chain actor records have agent kind. The coordinator root is an administrative agent controller operated through a restricted non-LLM ceremony. No model prompt, MCP call or customer order can obtain that root key.

Both evaluator identities have reviewer capability. Collectors/producers do not receive it. Evaluator-service payments, if introduced, must be reviewed by the other evaluator under an exact separately funded project. Do not distribute new earnings merely for casting votes.

Proposed equal-member voting: quorum 8,000 basis points; approval 7,500 basis points; ballot duration 900 seconds; governed Works required. All agent members may vote through explicitly granted scopes. Actual result arithmetic and eligibility come from Decide, including abstention and frozen denominator rules. Native platform executive quorum is an independent policy.

For the fixture, demonstrate a per-milestone commitment cap of 10.0000 testnet TLOS and UTC-day aggregate cap of 50.0000 testnet TLOS. These are test values with no assumed cash valuation. Commercial native limits must be explicitly reviewed in supported asset base units after selecting payout terms and funding. USD provider-budget limits do not change native asset caps.

Fast local native funding fixtures explicitly use the current supported 60-second duration and wait on the actual chain close time. Separate profile/schema checks verify the proposed 900-second pilot default. This test override is recorded in evidence and does not imply that a 60-second fixture qualified a live 15-minute customer workflow.

Current administrator roots can change roles/admission and several policy fields outside active ballots. Preserve this behaviour and disclose it. The pilot does not claim these fields require an agent vote. A later version can add a bounded on-chain administrative executor, but only under a new approved authority specification and native/migration qualification.

Governance approves exact projects, not arbitrary spending envelopes. A project has one contributor and at most 16 milestones. All milestones reserve on acceptance and count toward that UTC day's allowance. Batch only naturally related deliveries by the same contributor; never disguise a different recipient or changed amount as the same approved milestone. Contributor consent to `offeragr`/`acceptagr` is not in current routine session scopes: use an explicit root ceremony for those actions or ordinary Works proposals initially. Do not silently widen C++ scope rules to make onboarding easier.

## Signing and authentication

Core publishes a Node agent client consuming the canonical protocol and generated ABI codecs. It handles login v3 with both public keys, exact HTTPS origins, cookies/CSRF, capability/code pins, expiration and nonce refresh. Its signing dependency exposes separate `signLoginMessage(message: string): Promise<string>` and `signInstruction(request: instruction): Promise<string>` methods, where `instruction` is the producer-exported type from `@daclify/core-protocol/sdk`. The controller validates the context and permits only its granted actions before signing.

Routine scopes:

| Role                    | Core actions                   | Explicit installed module actions                  |
| ----------------------- | ------------------------------ | -------------------------------------------------- |
| Coordinator routine key | `putjson`, optionally `putdoc` | Decide `open`, `openwork`, `vote`; Works `propose` |
| Collector/producer      | `putjson`, optionally `putdoc` | Works `propose`, `submitwork`; Decide `vote`       |
| Evaluators              | `putjson`, optionally `putdoc` | Works `review`; Decide `vote`                      |

The role table is an upper bound, not a reason to grant unused actions. Module scopes pin reviewed code and current membership/roles remain authoritative. Routine keys never get `withdraw`, `setroles`, `setcredits`, `setdaogov`, admission, further delegation or native upgrade powers.

Credential lifetime is at most seven days; renew by day six through the isolated root controller, prove new-key possession, test the new credential, then revoke/delete the replaced entry. Each member has at most 16 stored credentials and each credential at most 16 target/action scopes. A root is not automatically recovered by successful HTTP login. Signing-key recovery does not restore document decryption.

Root and delegated keys share the same member nonce. Serialise submissions for that full DAO/member context; separate member identities can run concurrently. Before retry after timeout, reconcile the prior instruction against authoritative nonce and matching chain effect. An incremented nonce alone does not prove the intended action happened. Never automatically re-sign a consequential instruction against a new nonce after an unknown result. Return `reconcile-required` until the effect is known.

Initial deployment is one active signer process per member, with leases preventing overlapping signers for the same context. Credential values stay in protected local configuration or qualified key storage; LLMs receive tool arguments and receipts only. This explicit service control can impersonate agents within its scope and must be disclosed.

## Domain schemas and data ownership

All listed names and paths are proposed additions, not existing APIs.

Core owns `sdk/agent.ts`, the agent SDK subpath, narrow public host primitives in `protocol/agent-host.ts`, API authentication, raw SQL adapters, job leases and actual provider/chain verification. The modules producer owns `protocol/cooperative.ts`, cooperative business logic and namespaced migrations. Frontend consumes pinned releases and owns its Vue UI.

Define these module-owned, schema-inferred records:

- `CooperativeProfile`: schema version 1, full `DaoRef`, five role/member bindings, declared control-group labels, permitted source hosts and reviewed proposal defaults. Role bindings must resolve to current agent actors; no label grants chain permissions.
- `ServiceOrder`: UUID, DAO, authenticated external customer account UUID, immutable offer version/commitment, canonical `requestId`, source URLs, reporting window, due time, price `{currency: 'USD', amountMinor: Uint64}`, consent to public/redacted output, and commercial/native/task status fields. Different payload with the same DAO/customer/request ID returns a conflict.
- `FundingReference`: DAO, contributor, Works project and milestone IDs, proposal/document commitment, policy revision, module code hashes and ballot ID. Only authoritative reads can set funded/approved/settled states.
- `DeliveryEvidence`: schema version 1, DAO/order/run IDs, source roster commitment, coverage records, capture times, content SHA-256, change/no-change/inaccessible disposition, grounded report items, artifact reference, reviewer member ID and review disposition. Published proof contains no private customer identifiers or credentials.
- `UsageEntry`: DAO/order/run/member/attempt IDs, provider/model/rate-card version, request ID, token/search counts, estimated and reconciled USD micro-units, payer label and outcome. Unknown provider outcomes retain reservations; they do not become free calls.
- `CooperativeReport`: separate external gross receipts/refunds/fees, off-chain costs, native available/reserved/claims/settlements, acquisition and labour assumptions, completeness flags and proposed-versus-observed price labels. Never add USD and TLOS without an explicit valuation time/source.

Use native money only in existing exact asset base units. Use USD cents for checkout amounts and integer USD micro-units, scale 1,000,000, for model/search cost accounting. Round display amounts separately. Tables identify the complete chain/runtime/DAO context; member-local IDs alone are insufficient.

## Minimal host and persistence boundary

The public core host primitive is `AgentAuthoritySnapshot`, containing current DAO, member, actor kind/status, nonce, role permissions, policy revision and installed code pins. Core implements validated reads; module code cannot override them.

The module exports `CooperativeStore` with DAO-scoped methods `createOrder`, `getOrder`, `transitionOrder`, `reserveUsage`, `reconcileUsage` and `appendEvidence`. Core implements those methods with its SQL pool and transaction boundaries. Modules receive no raw PostgreSQL pool, arbitrary SQL method, platform private signer or provider credential. Persistence schema/migrations remain module-owned under namespace `cooperative`.

Reuse core `jobs`, `leaseJob` and the polling wrapper. Add the minimum core lease-renewal/completion/requeue methods needed for long cooperative runs with `lease_owner` compare-and-update checks. A failed/stale worker cannot complete or requeue another worker's task. Processing is at least once; business transitions and on-chain effects are reconciled and idempotent, never described as magically exactly once.

`CooperativeHost` provides only validated `readAuthority`, `readCommercialReceipt`, `readFunding`, `readSettlement`, the store interface and scoped job operations. `CooperativeRunner` receives member-bound `AgentClient` instances and a bounded model/fetch callback. It cannot mint provider receipts or call arbitrary relayer transactions. Core remains the provider-verification owner.

First tables: `cooperative.orders`, `cooperative.runs`, `cooperative.usage` and `cooperative.evidence`, in a module-owned migration export following the Archive pattern. Unique constraints cover DAO/customer/request ID and DAO/order/step/attempt identity; immutable order input hashes, lease owners and monotonic status revisions reject stale writes. Migration coordinator includes the module's hash-tracked export and verifies upgrades from the supported current release. If another change has consumed a filename/version, allocate the next free version without rewriting an applied migration.

## Order, job and payment states

Use independent dimensions rather than one ambiguous paid flag:

- Commercial: `fixture`, `unpaid`, `paid`, `refund-pending`, `partially-refunded`, `refunded`, `disputed`.
- Execution: `queued`, `awaiting-funding`, `collecting`, `producing`, `reviewing`, `changes-requested`, `delivered`, `failed`, `reconcile-required`, `cancelled`.
- Native obligation: projected from existing authoritative contract states, with separate external payout versus internal claim receipt.

Customer delivery proceeds only after the required review and intact order/funding bindings. Customer acknowledgement affects commercial service evidence; it cannot manufacture an agent vote or approve a native milestone. A customer issue after native settlement requires a separately funded refund/reserve process. Cancelling unapproved work never erases an already approved liability.

Until real merchant integration passes, all order routes for paid operation are capability-disabled. Fixture receipts are visibly synthetic and cannot be consumed by the production payment adapter. Existing Connect products should bind to the Works service module with an explicit order-fulfilment handler; do not advertise a new native module deployment unless one is actually built and installed.

Proposed authenticated API routes: `GET/POST /v1/cooperatives/:id/orders`, `GET /v1/cooperatives/:id/orders/:orderId`, `POST /v1/cooperatives/:id/orders/:orderId/issues`, and `GET /v1/cooperatives/:id/report`. Writes use existing session/CSRF plus current chain permissions where membership authority is involved. Customers can read/raise issues only on their own orders. Ordinary signing-in creates no DAO membership. Reviewer claims and authoritative agent records remain separate from customer accounts.

## Execution bounds and evidence review

Proposed default job bounds: 25 allowlisted HTTPS URLs; no private-network destinations or authentication cookies; 256 KiB decompressed text per source; 20 model calls; 200,000 total input and 24,000 output tokens across agents; two revision rounds; one active signer per member. Overall order due time is at least 24 hours after its reporting window closes. Invalid/inaccessible sources return explicit coverage outcomes.

Only collection follows redirects, and each hop rechecks scheme, resolved IP and allowlisted host, with fixed time/byte limits. Source text is untrusted content: it cannot choose tools, modify roster/recipients, request secrets or alter the order scope. No arbitrary shell execution is needed for the monitoring service.

Off-chain safety budget: reserve estimated USD micro-units before each provider call; total run ceiling $2.50 for the initial fixture/provider experiment and cooperative aggregate UTC-day ceiling $25, with a concurrency-safe reservation. These are proposed operating caps distinct from the economic expected cost and native treasury caps. Unknown provider charges hold the reservation for reconciliation; a hard provider-side limit is a separate defence. No provider purchase/call is authorised by this document.

Reviewer requirements: validate schema, exact source roster, immutable order/report window, coverage timestamps, hash/URL evidence, every material claim's source reference and contributor/reviewer distinction. Test plausible but unsupported claims and a producer's injected instruction to pay it. A second model is an optional semantic check, not the sole approval criterion. Deterministic checks precede the review decision.

## Customer experience and reporting

Reuse the workspace, service catalogue, treasury/spending reports and governance controls. Add a focused cooperative panel showing roles/control-group declarations, bounded orders, funding/review status, exceptions, cost completeness and receipts. Human operators view this panel through existing account authority; an observer screen does not enroll them as members. Customer order status lives outside membership screens.

Show “internal claim recorded” when settlement creates a walletless claim and “native payout recorded” only for an actual transfer. Do not present an internal claim as a bank/USDC payment. Signed root withdrawals and recipient-wallet/RAM setup remain deliberate external operations, outside routine LLM tools.

Publish only public/redacted pilot reports with explicit order consent. Confidential client delivery is a separate increment: authenticated customer ACL, reviewed encryption/key recipients and provider data-disclosure policy must be specified and qualified before accepting private material. Existing encrypted DAO content does not automatically authorise a non-member customer or protect data sent to a model.

## CLI and MCP

Core exposes a Node client; a small CLI adds JSON results. A local stdio MCP adapter uses that same client and signer process, avoiding an unqualified remote OAuth service in the first release. Initial tools are read cooperative/order status, prepare a proposal, cast a scoped vote, publish evidence and submit/review assigned work. Schema/action validation and contract permissions apply to every call; no `sign_arbitrary_transaction` or administrative tool exists.

Read-only discovery can be public. Mutations require the explicit member-bound local connection. Add remote MCP only after its current authorisation/security requirements and supported clients are qualified. Publish agent onboarding in existing site Markdown and `llms.txt`; do not rebuild the site's documentation mechanism or promise unavailable npm/registry access.

## Economics and commercial decisions

The companion model uses an illustrative $49 delivery, $49 monthly platform subscription and 5% of retained eligible service receipts. Current shared hosting includes ten identities and Connect fees capture their own native policy. No new price or fee policy is applied by this design.

Measure actual rate-card version, cost, provider outcome, refund, support minutes, acquisition and repeat purchase. Show economic labour cost even if the sponsor provides unpaid help. Keep member compute expenses distinct from all-in operator compensation. Do not count internal member payments as external sales.

Before a paid pilot, select the merchant/legal counterparty, real asset/FX flow, refund/dispute responsibility, commercial terms and reviewed native limits. Qualify refund/charge reconciliation separately from chain settlement. Taxes, vendor jurisdiction, production recovery and confidential delivery can change the economic results.

## Qualification and rollout

1. Repair the example and create a deterministic full native fixture with five agent members, a human external guardian/sponsor, two independent reviewers and synthetic customer orders.
2. Add client/scopes, durable execution, evidence and measured costs while keeping real-paid operation disabled. Prove restart, unknown-result reconciliation, lease fencing, cross-DAO isolation, code/policy changes and claim/payout distinctions.
3. Deliver a bounded public testnet cooperative with explicit user authorisation for any live creation/funding. Run matched single-agent/cooperative tasks and record cost, quality and latency.
4. Advance to a constrained paid service only after merchant/provider/client qualification, source-bound release review, customer commitments and express approval of real operations. Use customer/volume caps and reserve funds.
5. Add independence, governed administrative changes, private delivery and additional payment rails only if the pilot proves the need.

An agent paused/revoked between model completion and submission cannot approve or receive newly authorised work through stale credentials. Existing approved liabilities remain governed by current contract settlement rules. Recovery invalidates old signing/session authority and does not invent lost encryption capabilities. Browser, API and native evidence must agree on those boundaries.

## Acceptance and decision register

The minimum demonstration must show: all five member actors are agents; the sponsor/guardian has no ordinary vote; valid scoped agent work succeeds; administration and withdrawal through routine tools fail; funding/recipient/policy/code commitments match; self-review and cross-DAO reuse fail; settlement happens once; a customer account sees only its order; costs/unknown charges are retained correctly; restart preserves work; and report totals reconcile without mixing fiat and native assets.

Commercial continuation requires measured demand and economics, including external paid customers and renewals. Proposed thresholds are in the analysis, with sample-size limits. These are reviewed experiment parameters, not properties guaranteed by implementation.

Still requiring user/business decisions before dependent implementation: initial service/customer niche; acceptance of public-output pilot limits; actual native commitment limits and member compensation; root/guardian operator model; merchant/payment jurisdiction and refund responsibility; and whether independent operators require voted policy changes from the first commercial release. Deterministic testnet work can be planned without pretending those commercial decisions are already made.
