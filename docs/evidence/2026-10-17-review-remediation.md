# Repository review repairs — 17 October 2026

The four confirmed findings in the [workspace review](/data/daclify-runtime/review-all-20261017/review.md) are implemented in core/SDK **50**, modules SDK **62** and portal **69**. Native module version remains **10**; the independent community MCP package remains **23**, with its original core46/modules57 cohort. This is a development repair record, **not a deployment record**. Almaiso and the unchanged public website are excluded from these edits.

## Repairs

1. **DACLIFY-20261017-01:** DAO order reads, policy checks, Quick archive work and connected-app approval/token/relay membership reads use the caller's checked-out database connection. Archive export retains its session advisory lock and persists the provider manifest request before external I/O; short pin-ledger transactions preserve recovery after a lost chunk or manifest response. One-connection tests include real SQL membership lookups, concurrent status/fulfillment/authentication and duplicate-upload checks.
2. **DACLIFY-20261017-02:** Quick authorization reads permanent native trusted-contact continuity. The current recovered key signs while the original anchor, identity, voting record, nonce and epoch remain authoritative. Successor keys cannot register a second identity. API/SDK/browser agree on the optional current `approvalKey`; stale SQL account keys fail closed. Existing separately approved native/EVM defaults remain separate authorities until changed with the root. Recovery creates no historical decryption access.
3. **DACLIFY-20261017-03:** An original paid setup receipt resolves its owner through the same native recovery evidence. Its immutable creator/payment record remains unchanged, and it can create exactly one DAO. A fresh claimant is the sole initial member/admin/executive. A creation committed before recovery and a lost response reconciles to the existing DAO without changing that DAO's original member key or creating another DAO. Free, card and TLOS receipt paths have compiled-contract coverage.
4. **DACLIFY-20261017-04:** Native metadata updates require the current encryption epoch for changed identity/image references. Unchanged retained historical references remain valid. Legacy arbitrary JSON fields cannot impersonate retained private references during migration. The browser checks again before linking, retains unfinished publication state and offers Reprepare. Newly added stale images require replacement through the existing image uploader; it refreshes the DAO epoch/grants before reuse. Original bytes remain downloadable with their original grants.

No SQL migration, new native table, stored field, secondary index, action/table ABI layout or new dependency is introduced. The original receipt, nonce, identity and content-grant records remain authoritative.

## Verification

Final complete default suites passed: **core 1,158 tests in 197 files; modules 309 in 48 files; portal 467 in 83 files**. Core/module lint, strict builds and generated-doc checks passed, as did portal lint, Vue/TypeScript compilation and the production Vite build. Existing Vue Router fixture warnings and Vite's chunk-size warning remain. The independent unchanged MCP cohort also passed 13 tests in seven files.

Suite counts and their exact logs are recorded in the accompanying [JSON evidence](2026-10-17-review-remediation.json). The workspace retains red regressions, intermediate failed runs and final passing runs under `/data/daclify-runtime/review-all-20261017/`.

- PostgreSQL: **104 tests in eight files passed** against migrated, disposable local PostgreSQL. The existing email-recovery test now chooses an isolated synthetic DAO ID; a reused global membership ID was correctly refused by the database uniqueness constraint. That production constraint is unchanged. The disposable server was stopped after the final run.
- Native Spring: **21 tests in five files passed**: full two-contact/48-hour recovery, recovered Quick root/default/deactivation, once-only recovered receipt creation, Quick account authorization, private identity epoch guards, core27 upgrade/rollback and connected-app actions. The native clock uses the multithreaded faketime library only in the owned child process. No host clock or live service was changed.
- Actual-WASM targeted recovery/private-identity tests: **19 passed**, including repeated recovery, superseded-key refusal, three payment rails and legacy-JSON migration rejection. Browser private-record/image regressions: **27 passed** before the final complete portal suite.
- Core/modules API and SDK builds, portal Vue template/TypeScript build, lint, generated documentation checks and matching package-byte comparisons passed. The mini-app starter release is `06f2864288cd42fe0b3c87eb892e092e3d46cb6bb08bd3f7878dc5a25a97441f`.
- Production dependency audits report **zero advisories** in core, modules and portal. The VERT development dependency graph retains four registry advisories (two low, two high) with no available registry fix; it is used for owned test fixtures and is absent from production dependency graphs. No dependency safety guarantee is claimed.

Intermediate failures are preserved: pool deadlocks; old-key acceptance/recovered-key refusal; stale epoch publication; legacy metadata bypass; duplicate manifest upload after a lost reply under an overly broad transaction; a stale module compatibility pin/current-runtime fixture; repeated native membership fixture collisions; and a portal package-integrity check during an incomplete cohort installation. Those runs do not count as final qualification. Interrupted default-suite runs and native-clock/toolchain setup failures are likewise retained, rather than reported as passes. Intermediate local development archives were neither overwritten nor published.

## Native size and resource evidence

Compiled with pinned CDT **4.1.1 `-O=s`** and the existing MVP wasm-opt **`-Oz`** pass. Historical fixture compiler flags and pinned hashes are preserved.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Runtime | 869,523 (+1,247) | `66e73bdd368217f658d153adb587bfc9dae6a2b083eec43b1c9c6a0ca4c80332` |
| Quick authorization | 89,669 (+6,074) | `fd86a0af6ec8e85a3210ecc95ec4bd33a616d371a452e7216c5d670bd73c6700` |

Both raw ABI hashes are unchanged. Local native measurements: metadata migration with three retained reference slots used 1,718 RAM bytes and 3,349 microseconds; recovered receipt creation used 2,235 RAM bytes and 2,068 microseconds; the full recovery fixture used 9,729 RAM bytes. Quick submissions measured 1,078–1,416 microseconds with no row-growth RAM delta. These are owned local-fixture measurements, not network CPU/price guarantees or an assertion of performance improvement. Complete measurement objects and package hashes are in the JSON evidence.

## Rollout and limits

The live API still reports core46, and portal/API read-only checks returned HTTP 200. The sealed live runtime remains `2a2ff848e460f516df9a7a834bb7d79daf03d7d56f5f9855141170913d8022ee`. Its files were not modified. See the [existing live release](2026-10-17-private-content-release.md).

Deployment must coordinate runtime and Quick authorization code hashes, gateway/observer/lifecycle pins, public SDK/module artifacts and the portal. Native Quick source settings must point at the new authorization hash. Fresh version-bound assisted-recovery qualification is required for core50; do not bypass the startup gate or reuse core46 qualification. Review snapshot/rollback compatibility before broadcasting, particularly after recovered-key actions. No authority change or additional RAM/asset purchase is authorized by this record.

Not exercised: a new physical wallet/email/provider browser ceremony, the complete native-upgrade matrix, independent-host backup recovery, formal cryptographic review or mainnet. Existing historical decryption grants, paid rights and already created DAO member keys are preserved; recovery does not silently replace them.
