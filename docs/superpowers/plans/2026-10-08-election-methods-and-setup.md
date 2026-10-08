# Election Methods and DAO Setup Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans`. No delegation is authorized. Follow the [programme plan](2026-10-08-governance-hardening.md) and B. Task 1 supplies the configuration dependency for Works arbitration.

**Goal:** Let creators select compatible modules and DAOs enable several election methods, with frozen per-election rules.

**Architecture:** Extend the existing preset/installation flow and one Decide contract. New policy, method-specific ballot and count-progress records are versioned additions; shared nomination, identity and representative-term behavior stays in place.

**Tech stack:** Antelope C++, strict TypeScript/Zod and generated SDKs, Vue, fast-check/Vitest/VERT, native Spring and Playwright.

## Task 1 Module selection and versioned DAO configuration

**Existing files:** C `protocol/dao.ts`, `protocol/api.ts`, `protocol/service-api.ts`, `sdk/dao.ts`, `services/api/src/creation.ts`, `services/api/src/native-chain.ts`, `contracts/runtime/runtime.cpp`, `contracts/common/governance.hpp`, `tests/dao-presets.test.ts`, `tests/creation-preflight.test.ts`, `tests/integration/creation.test.ts`; M `protocol/index.ts`; F `src/views/CreateDao.vue`, `src/components/GovernancePanel.vue` and `src/components/ModulesPanel.vue`.

**New files:** C `protocol/arbitration.ts`, `contracts/common/arbitration.hpp`, `tests/module-selection.test.ts` and F `tests/e2e/governance-setup.spec.ts`.

- [ ] Define the core-owned arbitration mode/timing/default-authority schema and public contract configuration types here, before W consumes them. Creation can leave concrete arbiter identities unassigned; funding cannot proceed until its frozen agreement supplies valid primary authority where required and a backup.
- [ ] Add a new setup/configuration version with explicit selected module IDs, enabled election methods and arbitration defaults. Keep old stored metadata readers and their preset provenance.
- [ ] Supply preset defaults as editable selections. Render only installed/reviewed compatible available deployments; the frontend cannot activate a module by inventing an account or code hash.
- [ ] Enforce dependencies in preflight, the final creation/configuration path and relevant contract actions:
  - Governed Works funding requires Works and Decide.
  - Grants rounds require Grants, Works and Decide.
  - Member-vote arbitration requires Decide.
  - Guarded-agent governance retains its existing mandatory governed-funding safeguards.
- [ ] Permit manual-administration DAOs to omit Decide only when no selected capability requires it. Validate the absent executor explicitly; do not bypass governance/commitment limits by dropping the setup object.
- [ ] Use the existing atomic creation transaction to install exactly the selected modules and persist authoritative policy. Extend current activation controls for later authorized changes.
- [ ] Store new policy extensions alongside existing serialized governance rows. Changes to future defaults cannot rewrite active object snapshots; retain existing active-ballot restrictions on weight/threshold edits.
- [ ] Test unavailable module, wrong code/hash, duplicate module, broken dependency, stale catalogue, partial creation failure, guarded-agent removal of required Decide and valid no-Decide manual setup.
- [ ] Run `npx vitest run tests/module-selection.test.ts tests/dao-presets.test.ts tests/creation-preflight.test.ts` from C, then the integration creation selection against the isolated `_test` database.
- [ ] Verify the UI-selected modules against actual on-chain action/grant rows. A checked checkbox is not configuration evidence.

## Task 2 Single-choice and approval elections

**Existing files:** M `contracts/decide/decide.cpp`, `tests/elections.test.ts`, `protocol/index.ts`; F `src/components/ElectionPanel.vue`.

**New files:** M `tests/approval-elections.test.ts` and F `tests/unit/election-selection.test.ts`.

- [ ] Introduce an explicit election rule version and method in an additive record. Legacy elections remain single-choice.
- [ ] At creation freeze method, policy revision, document commitment, seats and term; at voting start freeze final candidates, choice map, voter boundary and eligible denominator. The rule hash binds both stages' immutable output.
- [ ] Preserve one member's once-only vote and existing credit/stake locks. Weight is independent of method.
- [ ] Single-choice accepts one candidate or explicit abstention. Approval accepts a unique nonempty subset of frozen candidates or explicit abstention, never both.
- [ ] Add an approval tally for every selected candidate but add the voter's weight to participation/quorum once. Reject duplicate/out-of-range selections and empty selections that pretend to be a vote.
- [ ] Rank positive tallies and retain the existing seat-boundary tie rule: fill a tied group only if it all fits, otherwise leave remaining seats vacant.
- [ ] Preserve term expiry, recall and current-winner eligibility checks. An ineligible winner leaves a vacancy; do not promote a runner-up after the vote.
- [ ] Test weighted approval, three supported candidates with one quorum contribution, abstention-only voting, zero-positive-tally seats, boundary ties and wrong method/action.
- [ ] Run `npx vitest run tests/elections.test.ts tests/approval-elections.test.ts` from M after rebuilding and generating matching artifacts.

Concrete quorum regression:

```text
Eligible weight = 10; voter weight = 3; voter approves A, B and C.
Tallies A/B/C each increase by 3.
Participation increases by 3, never 9.
A 50% quorum is still unmet.
```

## Task 3 Precisely defined STV and independent reference evidence

**New files:** M `contracts/common/stv.hpp`, `tests/stv.test.ts` and `tests/fixtures/stv/`.

- [ ] Implement one published Daclify STV rule version, not an unbounded catalogue of quota/transfer variants. Proposed rules are Scottish-style weighted inclusive Gregory with Droop quota and five-decimal integer per-unit transfer values.
- [ ] Separate explicit abstention from ranked ballots. Abstention contributes to participation/quorum but not the quota's valid ranked weight. Ranked ballots contain unique valid candidates, with at least one preference.
- [ ] Treat integer weight as identical unit-ballot multiplicity. Initialize per-unit transfer value to 100000. Sum `weight × unitValue` in checked wide integers; record exhausted weight and rounding loss.
- [ ] Extend C `sdk/compiler.ts` wide-integer schema generation where required: unsigned 128-bit values must reject negatives and values at or above 2^128; signed values use their own bounds. Add C `tests/compiler-wide-integers.test.ts` with boundary vectors, regenerate consumers and test API transport values beyond JavaScript's safe integer range. Do not convert tallies to `number`.
- [ ] Compute Droop as `floor(validRankedWeight / (seats + 1)) + 1` and express it in the same fixed-point units as tallies. Transfer a parcel with `newUnitValue = floor(oldUnitValue × surplusUnits / winnerTallyUnits)`. Elect candidates reaching quota in the same round before transferring their surpluses, largest first, only to continuing candidates. Eliminate a lowest candidate only when no transferable surplus remains.
- [ ] Break tally ties by the most recent earlier round distinguishing them. Stop on a remaining decision-critical tie, retaining already awarded seats and reporting vacancies. Do not privilege lower IDs or broadcast order.
- [ ] Define a decision-critical tie as one requiring a candidate to be chosen for the next surplus transfer or elimination after countback is exhausted. Stop conservatively at that point; do not enumerate every possible tie branch on chain.
- [ ] Freeze deterministic treatment of zero-support continuing candidates: no zero-supported representative is issued. Test this Daclify departure separately from external reference fixtures.
- [ ] Produce round transcripts, quota, elected/excluded/exhausted totals and rule version. Assert conservation including retained and truncated units; do not call five-decimal arithmetic exact rational counting.
- [ ] Compare hand-checkable vectors and randomized elections against an independently implemented counter at a pinned revision with matching rules. Compare published stage reports only when quota, rounding and tie behavior match; mark Daclify-specific tie/zero-support cases separately.
- [ ] Store small source-attributed inputs and independent expected transcripts, or a reproducible external-fetch procedure when fixture licensing is uncertain. Do not copy Loomio/ConcreteSTV implementation code.
- [ ] Include surplus ordering, simultaneous winners, exhausted preferences, irreducible ties, one seat, maximum seats/candidates, large integer weights and rounding boundaries.
- [ ] Run `npx vitest run tests/stv.test.ts` from M. A counter agreeing only with itself is insufficient.

## Task 4 Native resource bounds and resumable finalization

**Existing files:** C `tools/native/network.ts`, `tools/native/start.ts`, `tools/native/configure-report.ts`, `tests/native/elections.test.ts`; M `contracts/decide/decide.cpp` and `protocol/api.ts`.

**New files:** C `tests/native/stv.test.ts` and M `tests/stv-progress.test.ts`.

- [ ] Add a new owned governance fixture container to the existing strict fixture allowlist. Allocate unused loopback ports and preserve all existing containers.
- [ ] Use the proposed fixture name `daclify-governance-native` and existing `DACLIFY_NATIVE_CONTAINER` / `DACLIFY_NATIVE_PORT` configuration after the allowlist update. Store its actual chain ID and loopback URL in its own ignored fixture bundle; browser/native checks must validate that bundle before running.
- [ ] Measure worst-case candidate/seat/ranking patterns and up to 5,000 submitted member ballots using actual compiled WASM on Spring. Record CPU, NET, RAM growth and transactions required, not a TypeScript timing proxy.
- [ ] Qualify a bounded count-step size from those measurements. Persist stage/cursor/accumulator/transcript progress so no caller must finish a large election in one transaction.
- [ ] Make count progress permissionless after closing, with once-only terminal issuance. Validate the frozen definition hash at every step. New votes cannot arrive after closing.
- [ ] Test retries, interruption/restart, competing count callers, term expiry during counting and finalized replay. Changing chunk size must not change the transcript or winners.
- [ ] Allow existing governance-lock cleanup after voting closes; counting uses already recorded immutable vote weights. Do not unnecessarily lock member stake for an unbounded counting period.
- [ ] Reject unsupported input capacity before accepting votes; never stop after accepting an election because the advertised capacity cannot be counted.
- [ ] Fix the supported limit in the schema, contract, capability record and help only after native evidence. A failed resource gate keeps STV unavailable; it does not remove STV from the agreed implementation scope.

## Task 5 Interface, exports and upgrade qualification

**Existing files:** M `protocol/api.ts`, `protocol/index.ts`, `sdk/index.ts`, `tools/codegen.ts`, `docs/guides/topics.json`; C `services/api/src/native-chain.ts`, `tools/build/upgrade.ts`, `tests/native/upgrade.test.ts`; F `src/components/ElectionPanel.vue`, `src/api/client.ts`, `src/help/catalog.ts`.

**New file:** F `tests/e2e/election-methods.spec.ts`.

- [ ] Regenerate action/table types and reviewed code hashes. Expose method, rules, count progress and paginated selection records through module-owned schemas.
- [ ] Offer enabled methods per election; review and freeze the selection before signing/opening. Later DAO method changes affect future elections only.
- [ ] Use a select for single-choice, accessible checkboxes for approval and keyboard-operable ordered preferences for STV. Provide move-up/down controls; dragging cannot be the only interface.
- [ ] Show counting progress, partial/tied/vacant outcomes and round explanations. Terms do not imply spending or administration.
- [ ] Extend B's versioned JSON/CSV export with selected method, rankings, frozen weight, definition hash and complete transcript/coverage information.
- [ ] Exercise all three methods on desktop/mobile against actual native results. Add a dedicated governance Playwright selection with strict matching fixture checks; do not pretend the existing research selection automatically includes the new files.
- [ ] Upgrade a genuine 0.7 fixture with an active election, votes, terms and liabilities. Finish legacy elections under original semantics, then open new-method elections.
- [ ] Run legacy/native/browser regressions and record resource/reference evidence with exact release pins.

## Acceptance gate

The DAO's selected modules and enabled methods are enforced authoritatively. Each election uses exactly its frozen method and rules. All three methods count one participant's weight once toward quorum, preserve current eligibility/term semantics and have typed accessible interfaces. STV additionally passes independent-result and native-resource gates before being offered on a deployment.
