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

B0: baseline recorded; native/browser fixture checks pending until their task setup. All 21 implementation tasks pending.

### F1 — documentation source complete

- Availability table cites the installed connected-app release and the restored-account artifact set; no public npm/mainnet/MCP/erasure availability is implied.
- Added the normative database contract and builder handbook topic/group; refreshed the design and runnable instructions. Consumer delivery of the changed bundle follows F2's new immutable package set.
- Checks: core `npm run docs:generate` and `npm run docs:check` passed; all 21 local explanatory-guide links resolved. Frontend `npm test -- tests/unit/documentation.test.ts` passed 7 tests and `npm run typecheck` passed. Generated public help contains both connected-app/database topics.
- Human prose and guide-group data changes earn no new behavior tests; existing generated-guide/catalog checks cover their consuming boundaries.
