# Ballot Integrity Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans`. No delegation is authorized. Follow the [programme plan](2026-10-08-governance-hardening.md) and preserve existing serialized records.

**Goal:** Show the actual decision and require new votes to commit to its immutable definition.

**Architecture:** Add versioned commitment records alongside existing ballots. The module producer owns metadata schemas and the canonical encoder; the contract recomputes/checks the commitment. SDK, API and UI consume generated interfaces.

**Tech stack:** Antelope C++, Wharfkit serialization, TypeScript/Zod, Vitest/VERT, native Spring and accessible Vue components.

## Task 1 Freeze the definition and legacy behavior

**Existing files:** M `contracts/decide/decide.cpp`, `contracts/common/works_records.hpp`, `contracts/common/grants_records.hpp`, `protocol/index.ts`, `protocol/api.ts`; C `sdk/generated/runtime.ts`; F `src/components/ModulesPanel.vue`, `src/components/ElectionPanel.vue`.

**New files:** M `protocol/ballots.ts`, `contracts/common/ballot_commitments.hpp`, `sdk/ballot-commitment.ts` and `tests/ballot-commitment.test.ts`.

- [ ] Define explicit ballot semantics: binary proposal, advisory single-choice poll, representative election, Works funding, Grants award and arbitration decision. Two alternatives do not automatically mean Reject/Approve.
- [ ] Define metadata version 2 with required nonblank title and 2–16 nonblank unique choice labels. Validate total serialized UTF-8 size against the contract's metadata bound.
- [ ] Preserve old metadata and table readers. For legacy two-choice proposals, index 0 retains rejection and index 1 retains approval. Display those semantics; do not silently reinterpret a historic proposal as an advisory poll.
- [ ] Freeze the canonical commitment fields and their types before generating consumers.

| Commitment component | Required immutable data                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain               | Commitment version, native chain ID, runtime, Decide account, DAO and ballot ID                                                                     |
| Base definition      | Ballot semantics, exact metadata bytes, ordered choice mapping, weight kind, close time, quorum, threshold, denominator and opening member boundary |
| Policy               | Relevant policy revision and exact frozen rule data                                                                                                 |
| Election             | Title, rules document ID/version/commitment, ordered candidates, seats, nomination cutoff and term                                                  |
| Execution            | Exact Works/Grants commitment, target identity, module code hashes, application revision where applicable and execution deadline                    |
| Arbitration          | Protected obligation/dispute identity, terms commitment, excluded parties and adjudication electorate/rules                                         |

Never hash changing tallies, cast weight, status, winner, execution completion or count-progress fields. Hash original metadata bytes, not a parse-and-reserialize approximation. Create the commitment only after all subtype-specific immutable records exist in the opening transaction.

## Task 2 Enforce bound voting without breaking old rows

**Existing files:** M `contracts/decide/decide.cpp`, `tests/decide.test.ts`, `tests/elections.test.ts`, `tests/governed-works.test.ts`, `tests/grants.test.ts`, `tools/codegen.ts`.

- [ ] Add a separate commitment table keyed by the existing ballot identity. New ballot openings write a versioned commitment; genuinely pre-upgrade ballots have no new-format marker.
- [ ] Introduce a bound vote action accepting the expected commitment and method-appropriate selection. Its exact name/arguments are proposed additions and must come from the compiled ABI.
- [ ] Make legacy `vote` reject new-format ballots. A public SDK/relayer must not be able to bypass binding by choosing the old action.
- [ ] Share membership, DAO, nonce, close-time, once-only vote and weight checks between the paths without dropping existing validation.
- [ ] Recompute/check the exact commitment against the authoritative definition before recording a new vote. Reject foreign DAO/runtime and mismatched content.
- [ ] For generic advisory polls, permit a qualifying winner at any choice index, including index 0. Preserve binary funding's requirement for the approval outcome.

The minimum adversarial vectors are:

```json
[
  { "change": "title bytes", "expected": "reject" },
  { "change": "choice order or label", "expected": "reject" },
  { "change": "candidate, document commitment or term", "expected": "reject" },
  { "change": "funding target, module hash or deadline", "expected": "reject" },
  { "change": "DAO, runtime or chain", "expected": "reject" },
  { "change": "cast weight or tally after another vote", "expected": "same definition commitment" },
  { "path": "legacy vote on new ballot", "expected": "reject" },
  { "path": "legacy vote on pre-upgrade ballot", "expected": "original semantics" }
]
```

- [ ] Write these cases using the existing actual-WASM harness and independent expected encodings. Capture fixed cross-language hash vectors; do not derive expected values with the implementation being tested.
- [ ] Rebuild compiled contracts and run `npm run codegen` from M. Publish the helper through `sdk/index.ts` and metadata schemas through `protocol/index.ts`.
- [ ] Run `npx vitest run tests/ballot-commitment.test.ts tests/decide.test.ts tests/elections.test.ts tests/governed-works.test.ts tests/grants.test.ts` from M after staging matching core artifacts.
- [ ] Review the generated ABI/schema diff and commit the producer checkpoint.

## Task 3 API, presentation, signing and exports

**Existing files:** C `services/api/src/native-chain.ts`, `services/api/src/chain.ts`, `services/api/src/server.ts`, `tests/shared-module-reads.test.ts`; M `protocol/api.ts`; F `src/components/ModulesPanel.vue`, `src/components/ElectionPanel.vue`, `src/api/client.ts`, `src/auth/telos-zero.ts` and `src/auth/telos-evm.ts`.

**New files:** F `tests/unit/ballot-presentation.test.ts` and `tests/e2e/ballot-integrity.spec.ts`; C `tests/native/ballot-integrity.test.ts`.

- [ ] Expose typed commitment/subtype data and bounded vote pagination through producer-owned module API schemas. Fetch and validate the full selected DAO reference.
- [ ] Render exact choices, purpose, policy and execution target. Show a review summary before signing. Do not hardcode all ordinary ballots to Reject/Approve.
- [ ] Verify referenced content bytes through existing integrity/decryption paths. Missing/mismatched decision text must prevent signing rather than turn into an invented title.
- [ ] Compute the expected commitment with the public SDK and include it in the signed action. Retain wallet cancellation, exact-action, route/account/network and signer-context checks.
- [ ] Support keyboard-operable choices, labels, focus/error announcements and mobile layouts.
- [ ] Export a versioned ballot definition and voting records/receipts with commitment, full DAO identity, ordered selections and rule version. Reuse existing CSV formula-injection protection. Fetch required pages or label incomplete coverage; never claim a complete tally from a partial API page.
- [ ] Add desktop/mobile cases for three-or-more choices, a valid two-option advisory poll, a binary funding vote, elections, missing content and falsified API text. Falsified text must fail the on-chain commitment check even if the browser received it from the API.
- [ ] Run focused frontend/native selections against matching packages. Compare the signed action bytes and the actual chain vote record, not only a mocked success message.
- [ ] Commit the consumer checkpoint and update M `docs/guides/topics.json` plus the matching core guides.

## Acceptance gate

A changed decision definition cannot produce an accepted new-format vote. A later tally update does not invalidate the definition. All options and binary execution semantics are represented accurately. Old rows and votes retain their meaning; new ballots cannot use the unbound path. This protects a trusted client's interpretation against inconsistent service data; it does not promise protection from a malicious frontend stealing keys or deliberately displaying unrelated text.
