# Maximum Content Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` inline. Delegation is prohibited in this workspace. Checkboxes record verified implementation, not approval or deployment.

**Goal:** Make descriptive content confidential by default in encrypted DAOs while preserving public contract enforcement, original keys and existing rights.

**Architecture:** Reuse encrypted DAO documents as the authoritative source of private descriptions. Add bounded versioned references and capability-gated writers/readers, covering API setup/claims as well as chain records and UI. Keep Telos shielded-payment research in its separate proposal.

**Tech Stack:** Existing Antelope C++/pinned CDT `-O=s`, strict TypeScript/Zod, PostgreSQL, Vue 3, current browser cryptography, generated public SDKs, VERT/native and Playwright tests. No new cryptographic dependency in this plan.

**Spec:** [Maximum practical privacy design](../specs/2026-10-16-maximum-content-privacy-design.md). **Status:** approved on 2026-10-16; implementation and live activation remain incomplete.

## Global constraints

- Work on `dev`, inline, without delegation; exclude Almaiso. Preserve user changes.
- Self-custody stays self-custody. No silent assisted enrollment, generated replacement identities or server-side decryption.
- Do not erase or reinterpret historical records, ballots, amounts, rights, liabilities, key grants or policy revisions.
- Current protocol-visible membership, authorization, ordinary vote choices and native financial amounts stay public; never label them confidential.
- Preserve 4096-byte complete inline/module metadata bounds, 5 MiB stored-file bound and existing bounded grant/maintenance batches. Use encrypted file storage when inline envelopes do not fit.
- Current baseline: core protocol/SDK32, API implementation34, modules42, frontend54. Allocate unused immutable prerelease versions at packaging; never replace baseline artifacts or infer protocol version from the API package version.
- No Telos payment SDK, bridge or external relayer dependency in content-privacy packages. The [payment proposal](../../proposals/2026-10-16-telos-evm-privacy.md) has separate gates.

## Review focus

1. Confidential text leaks before encryption through creation orders, claim previews, notifications, logs or duplicated labels: assert canary absence at every boundary in Tasks 2/4/7.
2. A stale unlock/account/network request repopulates decrypted content after a lock or switch: verify cancellation and in-memory clearing in Tasks 1/3/7.
3. Same-looking choices or copied references change vote meaning: bind exact ordered labels, parent IDs, document versions and execution snapshots in Task 3.
4. A new display version, cleanup or key rotation strands a payable historical agreement: test retained immutable references and permitted grants in Tasks 4/6.
5. Unsupported older clients overwrite protected metadata or make blind decisions: test mixed releases, refusal and explicit public disclosure in Tasks 2/3/6.

## Ownership and files

Paths are repository-relative; prefixes identify the sibling repository.

| Package                          | Principal files                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared content reference         | core `protocol/content.ts`, new `protocol/private-records.ts`, `protocol/index.ts`, public SDK export/package tooling; frontend new `src/content/private-records.ts`, existing `src/auth/session.ts`/`src/content/document-review.ts`                                                                                                                                    |
| Identity / creation / claims     | core `protocol/dao.ts`, `protocol/platform.ts`, `protocol/dao-claims.ts`, `protocol/directory.ts`, `services/api/src/{creation,dao-claims,native-chain}.ts`, `contracts/runtime/runtime.cpp`, `contracts/common/{creation,document_refs}.hpp`; frontend `src/views/{CreateDao,ClaimDao}.vue`, `src/components/{DaoClaimIssuer,DaoSettings,DaoBrandingPanel,DaoCard}.vue` |
| Ordinary ballots                 | modules `protocol/ballots.ts`, `sdk/{ballots,ballot-commitment,ballot-export}.ts`, `contracts/decide/decide.cpp`, `contracts/common/{decide_ballots,ballot_targets,ballot_commitments}.hpp`; frontend `src/components/{ModulesPanel,BallotTargetReview,BallotExportButton}.vue`                                                                                          |
| Other module labels / narratives | modules `contracts/payroll/payroll.cpp`, `contracts/common/{works_records,grants_records}.hpp`, relevant producer/API readers; frontend `src/components/{ModulesPanel,GrantsPanel,ContributionAgreementPanel,ServiceCatalogue,ArbitrationPanel}.vue`                                                                                                                     |
| Quick questions                  | modules `protocol/quick-ballots.ts`, `contracts/common/quick_ballots.hpp`, `contracts/quickvote/quickvote.cpp`, `sdk/{quick-ballots,quick-ballot-proof}.ts`; core `services/api/src/quick-ballots/*`; frontend `src/views/QuickBallots.vue` and quick-ballot worker/grant code                                                                                           |
| Consumer/privacy audit           | core `services/api/src/{mcp,docs,profiles,connected-apps}/*`, `docs/guides/topics.json`; modules `docs/guides/topics.json`; frontend `src/state/workspace.ts`, `src/App.vue`, guide/render/export consumers and all writers/readers found by caller search                                                                                                               |

Do not assume every listed file needs editing. Before each task, trace all callers and keep the smallest complete diff. Do not extend stored rows merely to avoid reusing existing document references.

### Task 1: producer schemas and guarded local record reading

**Interfaces:** Produce `PrivateRecordReferenceSchema`, `PrivateRecordPayloadSchema`, `PrivateRecordReference` and `PrivateRecordPayload` in core, with the exact fields/kinds from the spec. Frontend produces `readPrivateRecord(dao: DaoRef, memberId: string, reference: PrivateRecordReference, records: DaoContent, expected: { kind: PrivateRecordPayload['kind']; source: string; recordId: string }): Promise<PrivateRecordPayload>` using existing document verification/decryption; validate `source` with the canonical native-account schema. Writers use existing document publication and its idempotent receipt flow; do not invent a new upload store.

- [x] Add core `tests/private-records.test.ts` and frontend `tests/unit/private-records.test.ts`: strict bounded shapes; wrong DAO/kind/ID/version/epoch; ciphertext/hash corruption; missing key; valid original-key open; replacement-key rejection; lock/context change during awaited retrieval.
- [x] Run `npx vitest run tests/private-records.test.ts` in core and the frontend test command for its named test; confirm failures on missing interfaces, then implement and rerun to passing results.
- [x] Expose schemas through the canonical public export and development package using the release tooling. Keep existing document/file byte limits and cryptographic domains unchanged. Decrypted results stay in caller-scoped memory and clear with the existing vault lifecycle.
- [x] Check core/frontend typechecks and affected content/recovery tests. Commit the tested producer boundary and its pinned development consumer update without overwriting released artifacts.

### Task 2: confidential DAO identity from creation through discovery

**Interfaces:** Add metadata schema version 4 containing an opaque public identity, preserved setup/provenance, optional explicitly public branding and a `PrivateRecordReference` for the internal identity. Core exports `PrivateRecordRoutes.identity`, `GET /v1/daos/:id/private-identity`, returning `{ dao: DaoRef, reference: PrivateRecordReference | null, metadata: Metadata, metadataCommitment: string }`; existing strict v1 summary response shapes stay unchanged. Version creation/claim input formats for sealed descriptive setup and bind initial epoch/document installation to the selected founder. Expose capability names exactly as in the spec, only for verified deployed support.

- [x] Extend core `tests/{dao-branding,dao-presets,dao-claims-protocol,creation-preflight}.test.ts`, `tests/integration/{creation,dao-claims,dao-claims-native}.test.ts` and new `tests/native/private-identity.test.ts`. Test no plaintext setup/order storage, exact founder binding, no issuer membership/key grant, duplicate/concurrent claims, expired/revoked links, interrupted initialization and atomic rollback.
- [x] Add frontend `tests/e2e/private-identity.spec.ts` alongside existing `tests/e2e/dao-claims.spec.ts`: canary name/description/asset metadata absent from outgoing plaintext requests and URLs; claimant sees decrypted reviewed setup; locked and unsupported clients cannot publish a fallback.
- [x] Run each named narrow suite red before implementation. Add an immutable additive PostgreSQL migration only where the versioned sealed request requires it; keep old stored orders interpretable and never edit a historical migration.
- [x] Implement browser sealing before descriptive fields enter `creation_orders`/`dao_claim_links`. Separate the claim token from the fragment-only content key; guard browser history, reload/retry and claimant switches. Generate the final DAO key in the claimant's browser, not from the issuer's invitation key.
- [x] Update native metadata validation, exact reference retention, identity summaries and directory responses. Preserve optional public publication as an explicit separate choice. Reject accidental plaintext downgrade in current native/API paths; old clients get a generic label and capability refusal.
- [x] Verify native/DB/browser suites plus existing paid/free setup and claim-resume paths. Measure new storage/RAM/CPU and failure rollback. Commit the independently usable identity package and matching help.

### Task 3: confidential ordinary ballot content

**Interfaces:** Modules publishes a new private ballot metadata variant: semantics, generic ordered choice indices and exact protected content reference. Extend `encodeBallotMetadata`/`readBallotMetadata` without changing legacy interpretation. The encrypted payload contains title, explanation, ordered original labels, semantics and the optional existing supporting document reference. Native definition commitment binds the new variant and its target/policy snapshot.

- [x] Extend modules `tests/{ballot-metadata,ballot-definition-encoding,ballot-commitment,ballot-export}.test.ts` and native/compiled Decide tests for copied references, changed option order/count, wrong document commitment, legacy commitments and unchanged executor authority.
- [x] Extend frontend `tests/e2e/{ballot-content,ballot-targets,module-authoring}.spec.ts`: title/description/custom choice canaries never appear in chain submissions; authorized members see them; locked/missing-grant/tampered clients cannot vote; disclosure is deliberate; funding/adoption/election ballots keep exact target review.
- [x] Run the narrow new regressions red; implement private writes and on-demand verified reads. Do not fetch/decrypt every ballot on page load. Remove plaintext text from page titles, logs, notifications and export metadata.
- [x] Keep open ballots immutable and readable under their opening format. Version retention/cleanup rules so referenced encrypted content survives finalization and archive. Ensure frozen semantics include ordered encrypted labels and supporting-reference identity rather than a mutable latest document.
- [x] Run affected module unit, compiled/native and desktop/mobile browser cases; measure metadata/RAM and commit with generated producer artifacts, consumer pins and guides.

### Task 4: payroll labels and remaining narratives

**Interfaces:** Introduce additive private payroll label/reference actions and records, preserving legacy 80-byte ASCII labels and their historic interpretation. Distinguish immutable agreed label reference from editable display reference. Reuse existing encrypted Works/Grants/review/agreement/service documents; do not duplicate private prose in public module metadata. Agent descriptions use the spec's protected record kind while required kind/identity flags remain public.

- [x] Extend modules `tests/{payroll,grants,contribution-agreements,arbitration-agreements}.test.ts` and compiled/native tests: settled/approved amounts unchanged, label edit cannot alter agreed terms, successor uniqueness, reference release only after rights permit it and interrupted upgrades retain payability.
- [x] Add frontend `tests/e2e/private-module-content.spec.ts`: author/reviewer names and narratives stay in encrypted bodies; public controls use generic technical labels; personal-profile visibility stays explicit; missing history keys show unavailable content and block unread acceptance.
- [x] Run new regressions red, implement the reference-bound label path and remove narrative duplication in all caller paths, including generated funding/review ballots and admission/operator labels. Do not change native recipients, amounts or eligibility flags.
- [x] Verify current guarded reads, lock clearing, original-key agent initialization and canary absence in immutable/editable payroll rows and API submissions. Complete post-deactivation rotation, from-join/full-history access, original-key restoration and interrupted-upgrade continuity for these surfaces in Task 6 before activation (execution-ledger ruling).
- [x] Run affected suites and resource checks; commit module producers and pinned consumers with precise privacy-limit help.

### Task 5: private Quick ballot questions for a single DAO

**Interfaces:** Add a versioned definition for a single-origin-DAO protected question reference. Question readership follows that DAO's existing content grants; individual-vote readers remain the original fixed executive set. Bind the protected reference to opening commitments, valid-choice proofs, final tally inputs and archived definition.

- [x] Extend modules `tests/{quick-ballot-context,quick-ballot-proof,quick-ballot-snapshot,quick-ballot-archive}.test.ts` and native Quickvote tests: cross-ballot copied questions/proofs fail; legacy version 1 remains valid; cleanup preserves the bound question reference and final-proof inputs.
- [x] Extend frontend `tests/e2e/quick-ballots.spec.ts`: eligible non-executive member can read a private question and vote but cannot decrypt others' choices; a missing grant blocks voting; all-account/cross-DAO questions display the explicit public disclosure and never claim private question access.
- [x] Run narrow regressions red; implement separate question/vote reader handling without altering fixed readers, eligibility, account uniqueness or the approved 30-day archive rule. Do not distribute the vote-decryption key to the question audience.
- [x] Verify real compiled proof paths and desktop/mobile workflows. Preserve public multi-DAO/all-account support; confidential cross-DAO question-key distribution remains disabled until separately qualified. Commit the versioned package and guides.

### Task 6: signed migration and recovery continuity

**Interfaces:** A read-only migration preview reports public fields, proposed protected successors, required keys/grants, retained historical references and unchanged public protocol state. Applying a preview requires the normal authorized signed actions. A cursor identifies bounded resumable work; it grants no new authority and never stores plaintext.

- [x] Add core `tests/native/private-content-upgrade.test.ts` and integration migration tests from pinned current fixtures. Exercise mixed readers/writers, interrupted batches, lost responses, wrong account, downgrade rejection and old open ballots/approved payroll surviving the upgrade.
- [x] Extend frontend `tests/e2e/private-access-continuity.spec.ts`: migration with original keys; locked account fails clearly; signed opt-in only; keys/roles/balances preserved; historic plaintext warning; private source/key loss never causes replacement identity creation.
- [x] Run red first; implement preview/application using existing epoch/document-reference operations. Keep completed stages resumable and reconcile uncertain transactions before another signature. Bound each grant/cleanup operation to existing limits.
- [x] Verify legitimate full-history/from-join recoveries, retained term/document versions, closure and safe cleanup. Leave TESTDAO-2 unchanged until its owner can unlock the originals and deliberately approves its exact preview.
- [x] Commit the tested migration and recovery runbook. Do not claim retroactive secrecy, erasure or independent-provider qualification from local fixtures.

### Task 7: leakage, release and operational verification

**Interfaces:** Add no broad new API; audit every public projection and consumer of the new variants. `private-records-v1` and each surface capability are enabled only in an immutable tested producer/native/frontend set. Decrypted private data is excluded from hosted AI/MCP by default.

- [x] Add core `tests/integration/private-content-leakage.test.ts` and frontend `tests/e2e/private-content-leakage.spec.ts` with canaries across all surfaces. Include logs, DB request rows, uploads, routes/history, page titles, notifications, API/MCP/documentation-assistant payloads, exports and lock/sign-out/back navigation. Test an unavailable encrypted source without plaintext fallback.
- [x] Run narrow regressions red, remove any leaked duplicated fields and give unsupported readers generic placeholders. Test deliberate local plaintext downloads as a separately acknowledged disclosure.
- [x] Generate schemas/ABIs/help and allocate unused immutable public SDK/module/frontend releases through the existing tooling. Run core/modules/frontend `npm test`, typecheck/build/lint and `npm run docs:check`; run the affected PostgreSQL, actual compiled/native, upgrade and browser suites. Record passed/failed/skipped/unrun explicitly.
- [x] Compile current contracts with pinned `-O=s`; record before/after WASM size, row/secondary-index RAM, representative CPU and cleanup. Reject a release with stale pins, incompatible archives, unbounded state or an unsupported-source downgrade path.
- [ ] Stage an immutable testnet candidate and exercise synthetic self-custody users before live capability activation. Verify the complete browser → ciphertext → API/chain → authorized browser-decryption flow, plus restart/recovery. Public entry checks cannot stand in for a real qualified wallet/private-key recovery test.
- [ ] Review the complete diff inline, commit/push the authorized `dev` changes and prepare the release evidence. Preserve the previously verified service/cohort; activate only the reviewed candidate and perform live health/rollback checks. No mainnet or customer-account migration is implied by this plan.

## Completion definition

The feature is complete only when all seven packages have recorded acceptance evidence and enabled capabilities match the actual deployed release. A finished proposal/spec/plan is documentation progress, not a completed privacy implementation. The Telos payment rail remains separate and disabled until its own feasibility/security/settlement gates pass.
