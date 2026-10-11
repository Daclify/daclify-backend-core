# Telos governance implementation evidence

Date: 11 October 2026 UTC. Scope: the [approved design](../superpowers/specs/2026-10-11-telos-governance-entry-design.md) and [implementation plan](../superpowers/plans/2026-10-11-telos-governance-entry.md). Implementation and review are inline under Ponytail Full; no delegation. Delivery targets `dev` in all three repositories.

## Implemented behavior

The public `/telos` entry reads retained `telos.decide` proposal/election records from `4,VOTE`, with contract-order pagination, explicit history coverage, publisher identity and recorded tallies. Ended voting periods are provisional until contract closure. Metadata stays text and HTTPS links open separately. Canonical ballot IDs can begin with dots, unlike the existing Daclify account validator.

Fresh native signup proofs provision a paired wallet-only Daclify account or reopen its existing pairing. Accounts created through this explicit path can return before joining a DAO. Existing vaults remain unchanged, and recovered wallet-only profiles retain current-membership checks. Migration 039 adds one constrained service-account origin field and extends the existing intent purpose constraint; there are no new chain fields or indexes.

The module SDK encodes registration when required and casting with the exact native actor, treasury, ballot and selections. The frontend rechecks chain identity, code/ABI pins, ballot rules, voter state and exact transaction after approval. Account, wallet, route, source or option changes stop the journey. A signed reference is saved before broadcast; uncertain outcomes remain pending and are reconciled through irreversible transaction status without resubmission. References remain tied to their original ballot during navigation.

External votes do not use Daclify DAO membership or credits. Anchor and supported direct-key active authorities are the initial wallet path. Voting remains unavailable without compatible operator-approved code and ABI pins. The source is bound to the operator's native network/RPC and `telos.decide`; a testnet operator cannot provide mainnet voting.

## Verification

Before integrating the concurrent fee rollout, the complete unit suites passed: core 140 files / 876 cases, modules 31 / 188 and frontend 43 / 279. At that checkpoint, all three lint/type/build checks and both producer docs checks passed, and six real PostgreSQL suites passed 74 cases. The feature checkpoint browser run passed 28 desktop/mobile cases, including first Decide registration and casting. Delivery identifiers and reproducible check summaries are recorded in the [companion JSON](2026-10-11-telos-governance-entry.json).

The frontend production build retains its existing chunk-size advisory; it completes successfully. No bundle optimization was added to this feature.

Commands used:

- In each repository: `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`.
- Core/modules: `npm run docs:generate` and `npm run docs:check`.
- Core: `node tools/bootstrap.ts`, rebuilding local development artifacts and refreshing exact consumer lock integrity and frontend vendor archives.
- Core real PostgreSQL tests: `npm run test:integration -- tests/integration/wallet-recovery.test.ts tests/integration/quick-signup.test.ts tests/integration/auth.test.ts tests/integration/account-links.test.ts tests/integration/account-upgrade.test.ts tests/integration/http.test.ts`.
- Frontend: `DACLIFY_TEST_UI_PORT=5283 npx playwright test tests/e2e/telos-governance.spec.ts tests/e2e/wallet-recovery.spec.ts tests/e2e/documentation.spec.ts tests/e2e/account-settings.spec.ts --config playwright.config.ts`. The portable Chromium library path was supplied through `LD_LIBRARY_PATH`.
- Final feature browser checks: the same Playwright configuration with `tests/e2e/telos-governance.spec.ts`, on desktop and mobile.

Database checks use a task-owned loopback role/database and disposable per-suite databases. Native proof verification uses actual generated K1 signatures against owned RPC fixtures; no proof verifier is replaced. The additional cases cover first signup, later login, concurrent reuse, replay, purpose/origin swapping, forged signatures, existing vault preservation and revoked recovered membership. Existing email/Telegram quick signup and account upgrades also run.

Browser tests use owned HTTP boundaries and a disposable WharfKit wallet fixture that signs actual transactions. They verify signup proof signatures and exact packed external actions. They cover public history, unsafe links, wallet-only onboarding, confirmation, read-only sources, uncertain broadcasts, reload, route changes, ended periods, missing titles and account switching during signup. Existing account, vault attachment and documentation browser checks remain covered.

Red/green checks exposed the missing feature first, then reproduced review findings: errors missing the public message field, lost RPC path prefixes, absent ballots, non-advancing cursors, UTF-8 metadata limits, leading-dot ballot IDs and a pending reference written against a changed route. The coordinated module compatibility fixture now accepts the newly pinned core version and rejects unknown future versions. One unchanged core WASM case exceeded its 20-second limit under concurrent builds/tests. The final full core run passed all 876 cases with reduced contention.

## Live read observation

At `2026-10-11T18:47:13.989Z`, the implemented bounded reader loaded the first 25 source rows from `https://mainnet.telos.net`, returned 17 supported `4,VOTE` records and verified an exact primary-key lookup. The page had a continuation cursor. Observed statuses were voting, cancelled and closed; the observed voting status alone does not establish an open voting period or official endorsement.

- Chain: `4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11`.
- Contract: `telos.decide`.
- Observed code hash: `8b0e9c21406bddae0805116287e2321c512e081ec221b3c8111be008b03d6d53`.
- Observed ABI hash: `ef5df77a2eb92e7565949fb80a7004c8872d757bcb57e3085d0139c08a0bb55f`.
- Signing capability in the probe: false; pins were intentionally absent.

At `2026-10-11T18:51:10.461Z`, an additional bounded pagination probe read three source pages and returned 17, 20 and 17 supported records, each with a continuation. This verifies the native cursor path across 75 source rows without claiming complete history.

At `2026-10-11T18:56:18.024Z`, a live `get_abi` read verified that the producer-owned `regvoter` and `castvote` action names, struct bases and exact fields match the deployed ABI subset. This establishes action-interface compatibility at the observed time, rather than deployed bytecode equivalence or transaction execution.

These observations are recorded for reproducibility and do not approve those hashes for production signing. The probe made only chain-info, ABI and table reads. It did not scan all history or send a transaction. Upstream contract behavior was reviewed at [64d3f256fb965415f718af2409129c863b6cf229](https://github.com/telosnetwork/telos-decide/tree/64d3f256fb965415f718af2409129c863b6cf229/contracts/decide), alongside [Telos ballot documentation](https://docs.telos.net/zero/governance/decide/ballots/) and [voting documentation](https://docs.telos.net/zero/governance/decide/voting/).

## Development artifacts and held qualification

Coordinated development versions are core protocol/API `0.14.0-alpha.1`, module SDK `0.10.0-alpha.1` and frontend `0.14.0-alpha.1`. The module peer dependency is the exact new core version. Public package pins, generated version-aware guides and consumer integrity locks are refreshed. The Telos feature adds no contract source or newly compiled fixture. Delivery also integrates the separate monthly-module-fee rollout, retaining its verified CDT 4.1.1 `-O=s` runtime artifact and updated SDK pins. Its runtime SHA-256 is `b0c1826a210d273b3250915b7db0a4c1a4cc70be465153195b52febfb3272fb4`. Tracked contract sources and the runtime artifact were matched before reuse; the Telos task performs no further deployment.

- Pre-merge core development tarball SHA-256: `e9c0abd4f21de6d08e6ee6e3b05bd3a5f9386f5a6f5df777c3a60f384f798187`.
- Pre-merge module development tarball SHA-256: `1866ea0d966bd090f95615306fbfe152bfc584141822db1e6bf46c7ae86ea6b9`.

These are unpublished local development artifacts. They do not constitute an immutable qualified release. Actual Anchor client approval, delegated authorities, mainnet transaction execution and deployment qualification are unrun. No production service, authority, environment secret or chain state was changed. An existing Decide voter may need to refresh externally synchronized stake in the Telos app; this entry reads its recorded balance. A provider lacking transaction-status support requires external confirmation of a pending reference. Deleted ballots and cleaned receipts cannot be reconstructed by this retained-table reader.

Operator instructions and holder behavior are in [Telos governance entry](../telos-governance.md).

## Source commits

- core: `c6bc09b1df2c66a49c4d3dddf1ed81409918aa47`.
- modules: `8a8f25d55181ccddd5e420e0b5fe993d2c4f6817`.
- frontend: `b729ee36c44060ae319424592a8e97d67d41b511`.

These implementation commits identify the tested code and pinned packages. A following core documentation commit records this evidence.

## Concurrent dev integration

The first pushes were rejected because newer monthly-module-fee commits reached all three `dev` branches during final verification. Incoming heads were core `2bf879c`, modules `91874e8` and frontend `76e8c76`. The changes are merged without force-pushing. Source changes merged cleanly; version pins, core compatibility expectations, generated references and lock/vendor artifacts were reconciled and rebuilt. Migration 039 remains native signup; the fee rollout separately owns migration 040.

All merged-source lint/type/build checks and both generated-doc checks pass. Seven real PostgreSQL suites, including the fee integration suite, pass 79 cases. Merged full-unit and browser results, final artifacts and delivery commits are recorded in the companion JSON. Fee rollout deployment and native qualification remain attributed to [its own evidence](2026-10-11-monthly-module-fees.md).

Merged verification passed **1,354 unit cases**, **79 database integration cases** and **42 desktop/mobile browser cases**, plus all lint/type/build/doc checks. Final tested implementation commits:

- core: `97efe136d1be63611ae6fab459a8921c4ab00c02`.
- modules: `1efcd7c044dff69403321fe495e08c240a2672e6`.
- frontend: `5bdf354ec207207380c80e6188087850499706bd`.

Final development tarball SHA-256:

- core: `84f8fddf677f0845b5bf6f78f6888d4e832839de7c281984e9a3623a3877cbdc`.
- modules: `b9eb5948ab6539770f730c6977eb0ef66d894fe805da52cdc9d8fec093bffcdd`.

A later pricing-documentation correction (`3d5b9cb`) and platform-controls frontend update (`cddac91`) were also preserved. The latest frontend again passes lint/types/build and all 280 unit cases. An additional owned browser run passes 32 desktop/mobile platform-controls, pricing-navigation and Telos cases. Four optional full live platform checks could not run against their expected local API on port 3008 (`ECONNREFUSED`); they remain environment-unavailable and do not qualify a live platform release. The existing 42-case combined owned browser report remains recorded separately.

All three implementation branches were pushed to `dev`. Final tested source heads before this evidence-only commit:

- core: `74f8d0bf07bca4042768fb30003062c915136e28`.
- modules: `1efcd7c044dff69403321fe495e08c240a2672e6`.
- frontend: `3553f08728035e75808bdb57d62949d86870cbd2`.
