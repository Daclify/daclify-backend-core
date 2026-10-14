# Module Completion Implementation Plan

> Execute inline using superpowers:executing-plans. No sub-agent delegation is authorized. The user's instruction to finish all outstanding work authorizes continuous execution of these follow-ups.

**Goal:** Complete the five prioritized module gaps with compatible contracts, public interfaces, usable screens and tested testnet delivery.

**Architecture:** Core owns shared authority/accounting/protection. Modules owns ballot definitions, Works/payroll extensions and generated interfaces. Frontend consumes immutable public artifacts and existing document/signing components.

**Tech Stack:** Antelope C++, CDT 4.1.1 `-O=s`, strict TypeScript, Vue, Zod, WharfKit 4.0.2, Vitest/VERT, native Spring and Playwright.

**Spec:** [module-completion design](../specs/2026-10-14-module-completion-design.md), [ballot integrity](2026-10-08-ballot-integrity.md), [Works protection](2026-10-08-works-arbitration.md). The latest user-selected primary adjudication policy is member voting excluding conflicts.

## Global constraints

- Existing serialized rows, legacy votes and approved payment claims retain their rights and meanings.
- Strict producer-owned public types; no unsafe application casts, suppression comments or arbitrary remote UI code.
- Versioned side records, bounded data/cleanup, measured pinned builds and coherent SDK/API/frontend release pins.
- No production release, user asset movement, owner/active authority change or delegation.
- Fresh contributor/DAO consent precedes new protected funding; evidence privacy uses the existing encryption path.

## Review focus

1. Missing/forged commitment records must not turn a new ballot into a legacy one in the UI or contract.
2. Mutable tallies/status must not invalidate the frozen definition, while reordered options/targets must invalidate it.
3. Document/version mismatches and incomplete pagination must never produce a misleading review/export.
4. Renewals and dispute outcomes must preserve liabilities and reject all ordinary owner/module bypasses.
5. Upgrades must preserve old rows, native callback permissions, RAM completion reserves and pending code pins.

## Task 1 — Ballot producer and compatibility

Files: modules `contracts/common/ballot_commitments.hpp`, `contracts/decide/decide.cpp`, `protocol/ballots.ts`, `sdk/ballot-commitment.ts`, tests and generated artifacts; core public domain/RAM-family definitions as needed.

Interfaces: additive `ballotdefs` table; `votecommit` action carrying expected definition hash; explicit `openpoll` semantics. The exact ABI owns consumer arguments. Public `ballotCommitment` helper consumes the full DAO domain, ballot, commitment marker and subtype record.

- [ ] RED: actual-WASM tests for bound voting, changed metadata/domain, stable tallies, neutral binary polls, old-path rejection and pre-upgrade voting.
- [ ] GREEN: additive definitions and shared vote checks; hash immutable subtype records after opening; preserve legacy behavior and include RAM/migration coverage.
- [ ] Verify: module full suite plus focused integrity/Decide/election/Works/Grants tests, generated ABI/types/docs and fixed cross-language vectors. Expected: all pass; altered definitions reject.
- [ ] Commit producer checkpoint and immutable package pins.

## Task 2 — Ballot API, signing, review and export

Files: core module reads/routes/tests/native checks; modules public API schemas; frontend ballot/election/governing-document/Grants vote callers, signer fixtures and help.

Interfaces: Task 1's compiled actions/definitions/helper through pinned packages; typed bounded commitment/vote pages and versioned exports.

- [ ] RED: forged definition, missing binding, neutral poll, execution target, full-domain export and real signed action cases.
- [ ] GREEN: read subtype records, verify expected hash, sign only the correct legacy/bound path, display exact semantics and export explicit coverage.
- [ ] Verify: full API/frontend suites, focused browser/native checks. Expected: falsified text rejects on chain; old rows remain usable.
- [ ] Commit coherent consumer checkpoint.

## Task 3 — Exact document review and service offers

Files: frontend document navigation helper/component, elections/Works/Grants/admission/service catalogue, API callers and browser tests.

Interfaces: existing producer document-reference and ServiceOfferDocumentSchema types; integrity/decryption/publication services.

- [ ] RED: exact historic evidence, malformed/unavailable references, private access, return navigation and service publication validation/retry.
- [ ] GREEN: reuse the exact reader and add a small typed service form without manual JSON.
- [ ] Verify: frontend full suite/types/lint and focused desktop/mobile/accessibility tests. Expected: precise versions, preserved privacy and valid published offers.
- [ ] Commit checkpoint.

## Task 4 — Payroll terms and successor funding

Files: modules payroll side records/actions/schema/tests; core reads; frontend payroll form/renewal/help.

Interfaces: versioned schedule terms/reference and successor identity; existing bounded funded installments.

- [ ] RED: exact terms, successor funding, insufficient balance rollback, repeated renewal, unpaid legacy preservation and consent/context changes.
- [ ] GREEN: bind terms/label before funding; renew through a fresh authorized successor; preserve the original entries and settlement rights.
- [ ] Verify: contract/native/accounting/API/browser selections plus full affected suites. Expected: no duplicate funding or altered old obligations.
- [ ] Commit producer/consumer checkpoint.

## Task 5 — Protected Works and member-voted disputes

Files: core protection/policy/consent records and treasury guards; modules Works/Decide/Grants integration; API schemas/reads; frontend terms/evidence/challenge/decision screens.

Interfaces: existing arbitration plan, narrowed to the selected member-vote primary policy. Frozen per-agreement backup/rules and exact contributor consent; Task 1's dispute-bound ballots.

- [ ] RED: contributor/reviewer conflicts, pre-consent funding, owner/module bypasses, no-quorum/tie/timeout, backup expiry, mutual settlement, offboarding, legacy claims and Grants parity.
- [ ] GREEN: implement protected reserves, provisional reviews, challenge/adjudication, bounded fallback and core-enforced terminal outcomes with once-only settlement.
- [ ] Verify: complete accounting/property/WASM/native/API/browser flows against pinned artifacts. Expected: valid outcome or visibly unresolved reserved funds; no unilateral bypass.
- [ ] Commit checkpoint and update existing arbitration-plan coverage honestly.

## Task 6 — Review and dev/testnet delivery

- [ ] Inline whole-change review, full affected release checks, version/documentation/test registers and old-release upgrade fixtures.
- [ ] Commit/push dev, prepare and verify testnet snapshot/contract upgrade transactions, update only tested compatible artifacts, then publish API/frontend and verify public journeys.
- [ ] Record actual passes/failures/unrun provider or wallet qualification and refresh the capability report without treating unrelated roadmap limits as fixed.
