# Daclify V2 development review checkpoint

This checkpoint contains the implementation accumulated across three private repositories on `feat/v2-implementation` and merged into `main` at the user's request. It is not the completed master plan or a release for real funds. Legacy repositories have not been cut over.

## Implemented product slices

- Antelope C++ shared runtime and discovery Hub, generated contract SDK and strict API/schema producers.
- Internal user-controlled accounts with separate signing/encryption purposes, encrypted local vault and fresh-device recovery.
- Shared DAO creation, members/roles/credits, versioned public/private inline JSON and committed encryption epochs/grants.
- Bounded hosted files: browser encryption of private filenames/content, quota/retry binding, verified upload receipts, separately signed records, exact-byte download checks and previous file versions.
- PostgreSQL upload reconciliation jobs with bounded retries, leases, manual holds and no automatic uncertain-pin deletion.
- Decide ballots/voting/finalization, Works proposal/reservation/submission/review/revision/cancellation, funded fixed-term payroll and core settlement after module removal.
- Treasury claims/stake exit forms; approved obligations preserve their recorded recipient/amount. Synthetic test transfers were confined to the disposable local chain.
- Version-aware searchable handbook, generated action/table/API/configuration references and contextual links.
- Source-only development bootstrap for separate sibling checkouts; locked compiler/dependency build, C++ artifact generation and public package staging.

The two-account Works browser journey uses an explicit local owner fixture to enroll its second account. Production invitation/admission, native-wallet linking, social/Telegram and managed recovery journeys are not established by that fixture.

## Verification

Actual latest counts and test scope are in [the execution ledger](execution-ledger.json). Current ordinary checks include 202 core unit/property/WASM cases, 41 PostgreSQL/API cases, 40 module cases and 33 frontend unit cases. Formatting/type/template/reference checks and the frontend production build passed. The final complete 20-case desktop/mobile browser suite passed against the actual local API/native chain with a labelled disk provider. It includes two-account work/review/revision, settlement after module removal, Decide finalization, claim withdrawals, encrypted files, lost-response recovery and vault recovery.

A source-only sibling copy installed without pre-existing dependencies/distribution/contract artifacts, rebuilt actual C++ contracts, and passed its core/module/frontend checks. The bootstrap exposed stale local SDK locks, which were corrected. Tests also exposed and corrected the 5 MiB Base64 stack overflow, concurrent receipt verification race, and false publication transition before byte verification. Provider faults remain fixtures rather than live Pinata evidence. Self-review also removed the misleading release path that only checked manifest-file existence: `package:release` now explicitly refuses until release verification and held checks are resolved. The local development packager remains usable.

The known native module authorization regression is still a confirmed failure and held. The complete current native suite is not passing. Earlier successful native subsets and the local OpenBao probe are distinct historical evidence; they do not qualify production contracts or custody.

## Material limits

The contract source authorization defect and absent on-chain module code pinning block production readiness. Core deployment code/ABI verification is incomplete; the service reports its package version. The UI's module hash check does not enforce on-chain policy.

Live Pinata/Google/Telegram credentials are absent. OpenBao is locally tested but production signing/recovery policies, restore drills and costs are unqualified. Cleanup/retention, sponsored factory resource/rate budgets, admission/key rotation, single-runtime routing, multi-asset accounting, custom module policy, executor/committee extensions, Operations/billing, chain adapters, CI, immutable release manifests and migration/cutover tooling remain incomplete. See [implementation limits](implementation-limits.md).

Self-review is not independent security review. The user's repository instructions prohibit sub-agent delegation. No mainnet deployment, real funds transfer, registry publication, history rewrite or legacy migration was performed.

## Local review

Use [development instructions](../development.md) to reproduce installation and ordinary checks. The development UI is served at `http://127.0.0.1:5178` while its fixture API/chain are running. Do not supply production keys or assets to the fixture tools.
