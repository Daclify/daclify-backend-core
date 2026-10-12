# Mini-app execution ledger

Plan: [Self-service mini apps and account exit](../superpowers/plans/2026-10-12-self-service-mini-apps-and-account-exit.md). Execution authorized 12 October 2026. Work inline on isolated `feat/self-service-mini-apps` branches, integrating tested changes into `dev`. Production deployment, live account/DAO changes and website publication remain outside this execution.

## Baseline B0

- Clean pushed refs: core `0d24830`, modules `b5e1721`, frontend `398060f`, website `d5c913d`. See the JSON baseline for exact refs/artifact hashes/toolchain.
- Focused baseline: core 26, frontend 21, modules 6 passed. PostgreSQL 17.11 fixture is bound only to loopback, port 35432, database `daclify_miniapps_test`; integration suites retain their local `_test` guards. Native/browser fixtures will be created with task-specific contexts before their first use.
- Additive reservations: 042 profile keys, 043 erasure, 044 MCP pairing, 045 MCP OAuth, 046 directory. Recheck allocation against newly pushed migrations before integration; never modify migration 041.
- Private runtime source stays outside release evidence. Only public package archives and compiled contract fixtures were copied into the isolated checkouts.

## Pre-flight interface review

| Producer → consumer | Interface and finding                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| F2 → F3/C1/X4       | Canonical AppBinding/AppActor/hash and issuer/client verification; F3 preserves all evidence/review methods while adapting async stores.            |
| F4/C1/X2 → M1–M4    | Complete root login, independently scoped signer, public artifacts and both-route revocation; no model-held root or ordinary app token passthrough. |
| P1 → P2/P3/X2       | Versioned context/cipher/envelopes; independent removable profile keys and existing single-kit account vault.                                       |
| X1 → X2/X3/Q2       | Native leave/closure and bounded handover remain authoritative; UI confirmation alone is insufficient.                                              |
| X2/F2/F3 → X4       | Frozen canonical/retired erase scope plus bounded app-bound notices; independent app acknowledgement is an assertion, not universal erasure proof.  |
| C2/M4/C3 → Q1/Q3    | Availability is derived from actual tested/deployed capabilities; site exports/SDK pins and source-bound qualification move together.               |

Ruling: Task extraction is performed from the approved F/C/P/X/M/Q headings into per-task briefs because the installed skill helper accepts only `Task N` headings. Preserve every file/interface/test step and the master order; maintain both the durable ledger and plan-scoped scratch ledger. Cost if wrong: a missing brief step would leave its task pending until review.

Ruling: F1 records exact current archive names/hashes and their access limitation. Public self-service distribution is implemented by C1; do not invent a public npm publication or download route before that task. F1's frontend guide grouping can precede the new public package, but consuming the changed help bundle waits for the next immutable producer archive. Cost if wrong: builder guidance would advertise an unavailable install path.

## Progress

B0: baseline recorded; native/browser fixture checks pending until their task setup. F1 complete (core `069cc78`, frontend `de15f4d`); F2 checks complete, commit follows; F3–Q3 pending.

### F1 — documentation source complete

- Availability table cites the installed connected-app release and the restored-account artifact set; no public npm/mainnet/MCP/erasure availability is implied.
- Added the normative database contract and builder handbook topic/group; refreshed the design and runnable instructions. Consumer delivery of the changed bundle follows F2's new immutable package set.
- Checks: core `npm run docs:generate` and `npm run docs:check` passed; all 21 local explanatory-guide links resolved. Frontend `npm test -- tests/unit/documentation.test.ts` passed 7 tests and `npm run typecheck` passed. Generated public help contains both connected-app/database topics.
- Human prose and guide-group data changes earn no new behavior tests; existing generated-guide/catalog checks cover their consuming boundaries.

### F2 — binding and client verification

- RED: the reopened-database and wrong-DAO actor assertions failed because the old example accepted both; the real PostgreSQL userinfo test returned 200 for a wrong expected client. A second regression showed no returned client context.
- Implemented canonical AppBinding/AppActor schemas and an ordered SHA-256 golden vector, full deployment/issuer/client checks, persisted binding format 1, unique subject/member mappings, transactional frozen outbox and exact review reconciliation. Added explicit backup-before-adoption CLI with current issuer/client/member verification and redacted errors.
- Ruling: `AppClaims` omits issuer/client, so configuring a client ID alone is insufficient for opaque-bearer verification. Add a backward-compatible optional expected-client query and canonical API-returned client header; new starters require the header, old clients retain their original JSON response. Cost if wrong: an unverified client could enter the wrong database namespace.
- Ruling: unbound legacy tasks/outbox do not contain their original chain/DAO/issuer/client. Adoption requires the operator's trusted original configuration and verified original actor mappings, validates all observable source/event/revision data and makes a consistent backup. It does not infer a DAO from member numbers or prove missing historical context cryptographically. Cost if wrong: an incorrect operator assertion could mislabel legacy history; uncertain provenance requires a separately reviewed migration.
- Ruling: protocol-only compilation bootstraps the new public exports while example signatures are changing; final full strict checking remains required. Private alpha.5–alpha.7/core and alpha.5/modules prototypes remain untouched and are not public install recommendations. Final F2 candidates are core `0.14.0-alpha.8`, modules `0.10.0-alpha.6`, frontend `0.14.0-alpha.9`; immutable source pins and exact peer/range/vendor/lock files move together.
- Initial full checks: core 883/904 passed and modules 180/192 passed; failures were missing historical fixtures/frontend build in the fresh worktrees. Copied original binary/ABI fixtures without recompilation, built the frontend, then all six affected core files (27 tests) and six affected module files (59 tests) passed. No product behavior was weakened for setup.
- Core lint, strict typecheck and generated-documentation checks passed with the final pins; focused SQLite/access/protocol/adoption 21 tests (including maximum uint64 storage) and all 18 connected-app PostgreSQL integration tests passed. Modules SDK 6 tests, typecheck and documentation checks passed. Frontend production build passed; its 25 focused account/help tests and typecheck are recorded with the final package pins.
- F2 file-map expansion: verified-client API response handling/integration coverage and the access/adoption helpers and their tests are necessary to make the planned actor verification and explicit adoption executable. Binding format is 1; existing unbound databases require the documented offline backup/attestation flow. No existing app database was changed.
- Production-only npm audit: zero advisories. The unchanged development VERT chain has four advisories (two high, two low), with no registry-proposed fix; record/review these for qualification, do not run an unqualified automatic upgrade.
