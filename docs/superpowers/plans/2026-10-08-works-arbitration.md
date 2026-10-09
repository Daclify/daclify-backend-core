# Works Arbitration Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans`. No delegation is authorized. Follow the [programme plan](2026-10-08-governance-hardening.md), B and E1 before changing protected money paths.

**Goal:** Offer three DAO-selected arbitration modes with pre-agreed backup authority and enforceable protection for reserved milestones.

**Architecture:** Core owns protected-obligation accounting and final release authorization. Works owns agreement, submission/review and evidence references; Decide supplies narrowly bound adjudication votes. Core permits the agreed backup/mutual resolution paths even when ordinary Works actions are disabled.

**Tech stack:** Antelope C++, producer-owned TypeScript/Zod schemas and generated SDKs, VERT/native Spring, Vue and existing encrypted documents.

## Task 1 Frozen agreement and DAO policy

**Existing files:** C `contracts/common/records.hpp`, `contracts/common/governance.hpp`, `protocol/dao.ts`; M `contracts/common/works_records.hpp`, `contracts/works/works.cpp`, `contracts/common/grants_records.hpp`, `contracts/grants/grants.cpp`, `protocol/agreements.ts`.

**Files introduced in E1 and extended here:** C `contracts/common/arbitration.hpp` and `protocol/arbitration.ts`.

**New file:** M `tests/arbitration-agreements.test.ts`.

- [ ] Extend E1's core-owned canonical arbitration configuration with frozen agreement/protection records. Modules consume it instead of inventing another authority model.
- [ ] Store DAO policy revisions separately from existing `govpolicies` rows. E1 exposes the mode and timing configuration; individual agreements bind concrete authority and fallback IDs.
- [ ] Extend new agreement commitments through a versioned side record. Include primary mode, eligibility/rules, primary/backup identities, deadlines, evidence privacy and final-outcome rules.
- [ ] Require contributor consent to the exact new commitment before any covered reservation. Changing those terms invalidates earlier consent.
- [ ] Require protection for new DAOs using upgraded Works. Existing DAOs adopt the policy explicitly for future reservations; after adoption, all reservation entry points enforce it. Preserve already funded legacy projects, but do not silently grandfather old unfunded proposals around contributor consent.
- [ ] Freeze the agreement term end as the final delivery/revision cutoff, separately from each obligation's earliest payment time. Nondelivery and unfinished rework can enter adjudication without a submission; neither automatically releases the funds.
- [ ] Validate distinct eligible arbiters, nonconflicting identities, periods and supported rules before funding. The selected arbiters must be able to receive permitted evidence; membership does not itself provide decryption keys.
- [ ] Apply the same protection to Grants-created Works projects. There is no Grants shortcut around agreement consent.
- [ ] Test changed authority after consent, cross-DAO arbiter, contributor-as-arbiter, duplicate primary/backup, missing backup and funding before consent. Include valid agreements for all three modes.
- [ ] Preserve pre-upgrade agreements and funded projects without introducing new delays or retroactive policy.

## Task 2 Core protection and accounting

**Existing files:** C `contracts/runtime/runtime.cpp`, `contracts/common/records.hpp`, `tests/treasury.test.ts`, `tests/module-callback-authority.test.ts`, `tests/independent-runtime.test.ts`.

**New files:** C `tests/protected-obligations.test.ts` and `tests/native/arbitration.test.ts`.

- [ ] Add a versioned protected-obligation table keyed by the authoritative obligation ID. Preserve the existing `obligations` encoding.
- [ ] Bind protection atomically with the original reserve operation, using a reviewed Works/Grants callback and the frozen agreement commitment. A reserve/protection failure rolls back the entire project.
- [ ] Prevent ordinary `approveob` and `cancelob` from changing a protected obligation before an authorized terminal resolution. The native DAO-owner cancellation path must obey this guard as well.
- [ ] Keep backup/mutual settlement authorization in core. Removing Works or changing its grants must not make the DAO owner a replacement arbiter or erase the protection record.
- [ ] Release the fixed amount to approved status only on the valid payout outcome; cancel only the covered unpaid amount on cancellation. Reuse the current ledger invariants and once-only settlement.
- [ ] Preserve `payob` for due, approved obligations, including those approved before this feature. Hosted billing never affects its authority.
- [ ] Add regressions for direct owner cancellation, direct module-key calls, unreviewed replacement WASM, forged resolver, foreign obligation, duplicate outcome, approve/cancel races and rollback after an insufficient later reservation.

Accounting checks:

```text
reservation: available decreases by A; reserved increases by A
pending review/dispute/timeout: available and reserved are unchanged
final payout approval: A remains reserved until settlement
settlement: reserved decreases by A; recipient transfer or claim increases by A exactly once
final cancellation: reserved decreases by A; available increases by A exactly once
```

- [ ] Run the core VERT checks after rebuilding the runtime, then exercise the native permission graph. VERT success cannot replace actual sender/permission checks.

## Task 3 Review, challenge and primary decision

**Existing files:** M `contracts/works/works.cpp`, `contracts/decide/decide.cpp`, `tests/works.test.ts`, `tests/governed-works.test.ts` and `tests/grants.test.ts`.

**New file:** M `tests/arbitration.test.ts`.

| State or event                                      | Required behavior                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| Funded submission                                   | Start the frozen review clock; retain backing                          |
| Provisional approval                                | Start challenge window; do not approve the core obligation yet         |
| Revision requested                                  | Preserve the contributor's rework path and challenge opportunity       |
| No initial review by deadline                       | Escalate to primary arbitration without automatic payout/cancellation  |
| No delivery or unfinished revision by agreed cutoff | Enter primary arbitration without an invented approval or cancellation |
| Timely challenge                                    | Freeze the disputed decision and start primary arbitration             |
| Unchallenged approval after window                  | Permissionlessly finalize approval, subject to the contract guard      |
| Primary payout/cancel outcome                       | Commit exactly one terminal result to core                             |
| Invalid/tied/no-quorum result                       | Escalate when the primary deadline expires                             |
| Backup expiry without result                        | Remain reserved; only a mutually authorized settlement can end it      |

- [ ] Specify which authorized DAO representative can challenge an approval; freeze that authority in the agreement. Contributor challenges rejection/revision. Named arbiters cannot be the original reviewer.
- [ ] Implement independent-member arbitration using the pre-agreed primary identity and current proof of control.
- [ ] Implement DAO-member voting using frozen agreement rules and a dispute-bound binary decision. Payout and cancellation are both explicit outcomes. A failed funding-style vote is not a cancellation decision.
- [ ] Implement administrator arbitration as a majority of the eligible administrator set frozen at adjudication opening. Exclude contributor/reviewer; new admins cannot be inserted midway to manufacture a result.
- [ ] Bind voter eligibility/weight and quorum once. Removed/revoked identities cannot submit new votes; removals do not lower the frozen denominator. An unavailable electorate leads to backup, not seizure.
- [ ] Record an unavailable primary electorate, including zero eligible weight, without trapping escalation behind a failed ballot-opening transaction. Reuse the frozen timeout and backup rules.
- [ ] Allow only narrowly bound dispute execution into core. Do not create an arbitrary action executor.
- [ ] Test deadline equality, missing delivery, repeated revision, late reviewer decisions after escalation, changes during wallet prompts, duplicate evidence, disputed milestone isolation, vote weighting, administrator role change, zero eligible weight, no quorum, ties and partial-project cancellation.
- [ ] Run `npx vitest run tests/arbitration-agreements.test.ts tests/arbitration.test.ts tests/works.test.ts tests/governed-works.test.ts tests/grants.test.ts` from M against matching artifacts.

## Task 4 Backup and mutually authorized settlement

- [ ] Permit anyone to trigger a valid deadline escalation; they acquire no decision authority by doing so.
- [ ] Accept backup decisions only after recorded escalation and before the backup deadline. Primary decisions arriving afterward cannot race or override backup authority.
- [ ] Verify the backup's frozen identity and current proof; reject contributor/reviewer identity and cross-DAO reuse.
- [ ] After backup expiry, reject unilateral late decisions. Keep backing reserved and expose the unresolved state.
- [ ] Permit an agreed fixed payout or cancellation only after matching contributor and authorized DAO-side consents to the exact obligation/outcome/terms hash. One consent, mismatching outcomes, reused signatures and a changed amount cannot settle.
- [ ] Preserve a narrowly scoped consent path for an offboarded contributor with valid current keys/binding. Do not grant general governance access to inactive members.
- [ ] Test primary/backup races, late decisions, revoked credentials, unavailable backup, consent mismatch, offboarding and once-only execution after Works removal.

The backup is a liveness improvement, not a guarantee. Native runtime/module upgrade authorities remain a disclosed trust boundary; this contract cannot prevent a controlling account from replacing its own code.

## Task 5 API, interface, help and native/browser journeys

**Existing files:** C `services/api/src/native-chain.ts`, `services/api/src/chain.ts`, `services/api/src/server.ts`, `tools/deploy/permissions.ts`, `tools/native/permissions.ts`; M `protocol/api.ts`, `protocol/index.ts`, `sdk/index.ts`, `docs/guides/topics.json`; F `src/components/ModulesPanel.vue`, `src/components/GovernancePanel.vue` and `src/api/client.ts`.

**New files:** F `tests/e2e/arbitration.spec.ts` and C `docs/operations/governance-upgrade.md`.

- [ ] Generate and export the new producer-owned types. Add paginated DAO-scoped policy/protection/dispute reads without returning private evidence plaintext.
- [ ] Show mode, decision authority, timing, backup and unresolved-funds behavior before contributor consent. Show the current state and next authorized action.
- [ ] Add accessible evidence/review/challenge/decision controls. Sharing private evidence follows existing document-key grants; arbitration does not silently make it public.
- [ ] Update module action/grant installation lists, dispatch allowlists and native execution links for the actual compiled additions. Review native authority diffs.
- [ ] Run each primary mode through actual native core/Works/Decide execution, deadline escalation, backup and settlement. Browser journeys must compare actual chain state.
- [ ] Regress ordinary Works revision, legacy immediate approval, approved settlement after removal and Grants-funded projects.
- [ ] Commit generated docs, explanatory guides, upgrade fixtures and redacted evidence with the matching release pins.

## Acceptance gate

Every agreed mode reaches a valid payout/cancellation or an explicitly unresolved reserved state. Core blocks all unilateral bypasses. No valid path pays twice, releases unrelated milestones, changes the fixed asset/amount or overwrites existing approved rights. All proposal defaults in this plan are visible for review before the financial interface is frozen.
