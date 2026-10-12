# Governing documents — 2026-10-12

Documents now supports a managed register with Constitution, Policy, Agreement, Legal document and Other categories. An administrator selects administrator approval or a member vote and optional acceptance tracking. Uploads remain drafts until the exact version is adopted. The register preserves adopted versions, proposal history and stable-member acceptance records. Approval and acceptance choices are fixed for each registration; a DAO can register one Constitution and at most 64 managed documents.

The user explicitly selected DAO choice of administrator approval or member voting. Other implementation decisions are recorded in the [design](../superpowers/specs/2026-10-12-governing-documents-design.md). Work and review were performed inline; no independent reviewer or sub-agent was used.

## Authorization, privacy and retention

Decide contract actions enforce administrator registration/proposal, the chosen approval rule, a specific version/content commitment, current adoption revision and once-only adoption/acceptance. Voting additionally binds the source binary and governance-policy revision. Passing unexpired votes cannot be cancelled by an administrator. Cleanup accepts at most 25 rejected/expired proposal IDs and releases pending references without deleting audit entries.

Member acceptance is a voluntary signed record of an adopted version, not an admission rule or legal certification. The browser requires opening the exact content and explicit consent; it rechecks adoption before signing. Existing encryption and from-join/full-history policies apply. Protected content cannot be accepted from unread ciphertext. Disabling Decide keeps adopted documents and acceptance history readable, while mutations require installed action permissions.

Core document references protect adopted and pending versions from pruning. Bound document ballots cannot use ordinary vote pruning. Three new fixed-size tables have retained-RAM classification, bounded scan/backfill recipes and scoped indexes: `(DAO, registration)`, `(DAO, document)`, `(registration, proposal)`, ballot ID, and `(adoption, member)`. Each index serves isolation, uniqueness, paging or ballot protection. Record history is retained; cleanup never removes adopted or accepted records.

## Review artifacts and measurements

The [machine-readable evidence](2026-10-12-governing-documents.json) pins the development packages and all compiled binary hashes and sizes. Current contracts and the genuine upgrade probe were compiled with CDT **4.1.1 `-O=s`**. Historical fixtures and their original flags/hashes were preserved. Core is `0.14.0-alpha.5`; module SDK is `0.10.0-alpha.5`; the contract bundle is `0.10.0-alpha.1`; frontend is `0.14.0-alpha.8`. Vendored frontend package bytes match both producer artifacts.

On an owned disposable Spring **1.2.2** chain, registering, proposing, adopting and recording one acceptance added **1840 bytes** of Decide RAM including new table/index overhead. The observed actions used **1507 / 2789 / 2233 / 1931 microseconds** respectively in that run. These are a single local run, not production load estimates. Runtime WASM is **916168 bytes**; Decide is **314410 bytes**. No optimization claim is made.

## Verification

- Core `npm run verify`: lint, typecheck, generated-doc checks and the full final unit/WASM suite passed **893 tests**, including the disabled-module history regression; focused final API/permission checks passed 24 tests.
- Modules `npm run verify`: lint, typecheck, generated-doc checks and **201 tests** passed with the final compiled binaries.
- Frontend `npm run verify`: lint, Vue/template checks and **294 final tests** passed, including the disabled-module history regression; focused final API/help checks passed 10 tests. Frontend production build passed.
- Core `npm run test:integration` on the owned PostgreSQL 17 fixture at port **18534**: **296 tests** passed. The owned cluster was stopped afterward; the live service database was not used.
- Disposable native suite: **44 tests in five files** passed, including the new lifecycle, real member vote, genuine changed-binary persistence, source-change refusal, native permission boundaries, executive lifecycle/handover, legacy ownership and policy guards.
- Compiled-WASM regressions include one Constitution, fixed approval settings, exact version while a newer draft exists, stale revision/policy, cross-DAO and unsigned dispatch rejection, once-only acceptance, expiry bounds, and adopted-version archive-pruning protection.
- **36 final desktop/mobile browser checks** passed, including the complete signed register/propose/adopt/accept flow, stale-adoption refusal, unread private-content refusal, unsupported deployment, axe accessibility and overflow checks. Browser mocks are UI evidence, not live provider or chain evidence.

An attempted broader browser selection included the existing real-backend files/workspace/module-authoring suites without their required paid native API fixture at `127.0.0.1:3008`. Those cases failed with connection refusal and that owned run was stopped. They are not passing evidence. The relevant mocked browser cases were rerun separately. The broader paid browser suite and external provider suites remain unqualified.

## Live activation boundary

No live contract, catalogue pin, member action permission or frontend/API publication was changed by this task. All artifacts are development review artifacts; the general release qualifier still reports `publication: refused`, `qualified: false`.

Live activation requires a reviewed coordinated upgrade, because shared RAM classification changes the compiled core and all module hashes. Before replacing binaries, inventory and drain pending governed Works/grant executions under their approved hashes; do not rewrite those approvals. Preserve existing state and back up contracts/service data. Repin the approved binaries, migrate/backfill the new RAM families and document-source coverage, and add only the five member actions `regdoc`, `proposedoc`, `adoptdoc`, `canceldoc`, `ackdoc` to Decide's authorized context. `cleardocs` is service-only bounded cleanup and is excluded from member execution links. Use the existing deployment/permission planner and review its exact action list against the connected deployment before applying it.

The matching API/frontend must be published together after those native updates. The testnet API's recovery qualification also needs a fresh report for core `0.14.0-alpha.5`; an alpha.4 report cannot be relabelled or silently reused. Operator authority changes, funds and production release are outside this implementation authorization.

## Source commits

- Modules: `29ec2a6b4c70a393b8c9e1f98aa871b20b6e0978`
- Frontend: `c6b6479362d6b51d75ed6643b6db71510bde5bfb`
- Core implementation: the commit containing this report (plus the earlier committed design/plan `4da5fe5`).

All three development branches are the integration target. This report does not authorize a main-branch release or live native upgrade.
