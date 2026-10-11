# Combined workspace testnet rollout — 11 October 2026

The user authorized committing and pushing all outstanding workspace work, then making it live on the existing server. The combined app is available at [testnet.app.daclify.com](https://testnet.app.daclify.com), including [Telos governance](https://testnet.app.daclify.com/telos), monthly module access, connected apps, account entry and the compact platform controls. [Machine-readable evidence](2026-10-11-workspace-testnet-rollout.json) records the source commits, artifact hashes and actual checks.

## Source and repository reconciliation

| Component | Version | Deployed source |
| --- | --- | --- |
| Core API/protocol | 0.14.0-alpha.1 | `f2b8d2284f9105db1b8689a0577e974fdd938560` |
| Modules SDK | 0.10.0-alpha.1 | `f46432b70a91b385c79a09a46ddf9cecff442b8c` |
| Frontend | 0.14.0-alpha.1 | `6ff2756680e3bd8fae7bcd4e530033cb782f6081` |

The four primary checkouts, registered worktrees, temporary size-comparison clones and retained legacy copies were checked. The old Names worktree's pending evidence already existed on dev; its exact state was committed and its history reconciled. The size-comparison copies were committed and preserved in dev ancestry. Their optimization changes are already integrated; preservation merges retained current source and release pins rather than reinstalling historical experimental hashes. The retained legacy repositories were preserved. Core/modules/frontend use dev; the separate landing page uses main.

Committed source was archived under `/data/daclify-runtime/releases/20261011-telos-governance`. Exact producer archives match the frontend's tracked vendor copies and the implementation evidence. The corrected frontend was built from Git tree `9e7dc79583e3f89c2a002cd78160c9e1e1f24ee6`, which exactly matches its pushed implementation commit. Deployment documentation commits follow those implementation commits.

## Database, native state and recovery

A private 270,528-byte PostgreSQL backup preceded the upgrade. Restoring it under the real application database owner and applying migration `039_native_signup.sql` twice preserved all 17 account rows and native login intents, and the previous 44 migration hashes. The live database then matched the account digest and contains 45 migrations, including unchanged `040_module_fees.sql`.

The runtime's live code and ABI match the current SDK pins. Runtime code remains `b0c1826a210d273b3250915b7db0a4c1a4cc70be465153195b52febfb3272fb4`. Existing module contracts remain unchanged. No contract deployment, native authority change or blockchain transaction was performed by this rollout. The existing Names oracle continues from its matching module-fees source archive.

The first API switch refused the recovery report bound to the previous exact core version. The previous API was restored while investigating. A real same-VM Raft snapshot drill then recovered the original transit key with the source service stopped, verified TLS and audit redaction, and demonstrated four denied API-token operations. The owned restore process needed a restart after snapshot installation to load the restored seal configuration. No validation was bypassed, and no recovery key was replaced. The renewed qualification binds 0.14.0-alpha.1 and expires **17 October 2026 at 14:46:09 UTC**, before the existing AppRole bootstrap expires. API, recovery service and agent are active with no automatic restarts after the final switch.

## Verification actually run

- Fresh snapshot lint/build and generated-reference checks passed for both producers; core Telos routes passed 4 tests and the module reader passed 9.
- Frontend lint, Vue/TypeScript checks, the complete 44-file/280-test suite, and the corrected testnet build passed. The existing large-chunk advisory remains.
- A regression first observed two main landmarks on Telos. Replacing the view's nested main with a div passed all 16 Telos desktop/mobile browser cases, including the original signing and uncertain-broadcast flows.
- Actual public HTTPS verifies API 0.14.0-alpha.1, modules SDK 0.10.0-alpha.1, approved CORS, the applied signup migration, retained fee migration, native runtime pins, invalid-signup rejection and invalid-cursor rejection.
- The real testnet reader returned 9 supported records on its first bounded source page and 12 on the next, with matching detail/source identity. This is retained contract history, not a complete archive.
- The standard public desktop/mobile checks passed for Hub, Status, native resources, fresh Names quotes and the DAO workspace. The corrected public build additionally passed Telos detail/filter/refresh/pagination/guide, module pricing, same-tab Create → Pricing → Back, all three Platform sections and account entry. These checks used actual HTTPS responses, with no browser errors, horizontal overflow or main-region Axe violations.

The static entry was published after the API checks, with old hashed assets retained. Final entry SHA-256 is `085ed7fc437c5188b671b6c3794ed1ac64375558984de481d1016f3bdbbf101f`. Ordinary repository builds still cannot overwrite the served directory.

## Scope and remaining qualification

This deployment uses the existing **Telos testnet** service. Decide signing pins remain absent, so `/telos` provides read-only history on this connection. Mainnet official ballots/voting require the separate mainnet service, approved Decide code/ABI pins and actual wallet/contract qualification. Actual Anchor approval and mainnet voting were not performed.

Recovery remains the explicitly authorized single-VM development mode; the drill does not qualify independent-host disaster recovery. The separate paid-creation native browser fixture at local port 3008 was not run. No mainnet service or real-money provider behavior was enabled, and the development archives remain distinct from a qualified immutable mainnet release. Existing payment/IPFS qualification is recorded in [monthly module fees](2026-10-11-monthly-module-fees.md) and [testnet IPFS](2026-10-11-testnet-ipfs.md).
