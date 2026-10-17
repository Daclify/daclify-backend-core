# Review repairs deployed to shared testnet — 17 October 2026

The user authorized committing and pushing the pending Daclify changes to dev and deploying the shared testnet. The API and portal switched at **14:38:49 UTC**. Native verification, the compiled candidate checks and subsequent public HTTPS checks passed. Almaiso and mainnet are excluded; the unchanged website did not need deployment.

## Deployed source

| Repository | Source commit | Package |
| --- | --- | --- |
| core | `bb6c33e60175136793799f422fc74ee432f66efc` | `0.15.0-alpha.50` |
| modules | `60652c9e8bd2f2d444869385cce0c93bdd3b6049` | `0.10.0-alpha.63` |
| frontend | `b060d198a9e6e5799c42d80420190b80c6120a9a` | `0.15.0-alpha.70` |

All three source commits were pushed to dev before staging. This deployment record and the current-status update are subsequent documentation changes; they do not change the immutable deployed source. The release at `/data/daclify-runtime/releases/20261017-review-fixes` contains the exact Git archives, pinned contract artifacts, built API/SDKs and portal compiled with `--mode testnet`. Its manifest verifies 6,232 files. Dependencies were checked against their intended package cohorts; matching immutable files were hardlinked and differing files copied, with no package-manager mutation in either sealed release.

The independent MCP package remains `0.1.0-alpha.23` with core46/modules57 peers and release `6bdef9964e07b2f092219ddfbc6209315e77e083fff1edf4366759dcdf5f9e34`. The new mini-app starter release is `b71a96e27e3eec82c40c63cb2b7f3c4352c4a501ce80f2eb897c62c027daaa9b`. Prior supported downloads and portal assets remain available. This testnet activation does not change the programme's mainnet/publication qualification decision.

## Native upgrade

Only runtime and Quick authorization bytecode changed. Current pinned artifacts use CDT 4.1.1 size optimization and the established optimization pass; the already tested release artifacts were deployed without rebuilding historical fixtures. All eleven raw ABIs remain unchanged. Three source-bound stages became irreversible:

| Stage | Transaction | Block |
| --- | --- | --- |
| runtime code/observation | `b51a4ab4e1e76a1d74774235e9b84aed1258c5e8b442d929cb30daae0979279d` | 450687606 |
| Quick authorization and cohort pins | `0af5f0156e607b9da507f1091d16e3f50414c55aaf4fa4aadc1a18e7630f9db1` | 450687627 |
| Hub directory code pin | `477d2d24fe3fc986ed256abb729634154c3f7324416d19f9a73e09e493ac4897` | 450687646 |

Runtime code hash is `66e73bdd368217f658d153adb587bfc9dae6a2b083eec43b1c9c6a0ca4c80332`; Quick authorization hash is `fd86a0af6ec8e85a3210ecc95ec4bd33a616d371a452e7216c5d670bd73c6700`. The other nine binaries are unchanged. Final native verification confirmed the planned metadata patches and preservation of captured records, scopes, keys, permission thresholds and action links. Three ordinary ballots and three Quick ballots were preserved. No RAM purchase, asset transfer, permission repair or customer-content migration was required.

The existing guarded upgrade journal was instantiated for this exact cohort, retaining required-key checks, bounded transaction sizes, full row/scope/authority comparisons, native forward/reverse simulations and receipt reconciliation. An omitted nullable binary extension in an existing actor row exposed a checker issue during preparation; the committed correction decodes the original bytes under both compatible ABIs without rewriting the row. See [preparation evidence](2026-10-17-review-release-preparation.md). The final protected snapshot is `/data/daclify-upgrades/testnet/snapshot-private-content-review-20261017-cutover`.

## Backup, recovery and cutover

The public portal displayed maintenance while API workers and scheduled mutating jobs were stopped. A database dump was taken after the API stopped. Restoring that exact dump into an isolated local PostgreSQL cluster and applying candidate migrations preserved all 99 original tables and their original rows/columns. The customer database was not restored or replaced during this test. Core58/archive5 migrations were compatible.

Fresh disposable TLS/OpenBao source-removal recovery checks passed for core50: original synthetic keys, four restricted-token denials and audit plaintext exclusion. The version-bound same-host testnet qualification expires **21 October 2026 at 14:03:49 UTC**. Live key-service policies and keys were unchanged. Same-host restoration does not qualify independent production disaster recovery.

API and its embedded workers switched together. The Names price updater now imports the new sealed release, published a fresh irreversible observation and resumed its existing timer. The profile backup and expiry timers resumed. API and portal services are active with zero restart-loop counts at final inspection.

The previous sealed API/portal, database dump, recovery qualification, service configuration and guarded native reverse plan are retained. Rollback requires checking current writes and journal state; it is not permission to restore old binaries or a database over newer customer activity.

## Verification

- Full core suite: **1,159 passed in 197 files**, after the deployment-checker correction; 17 focused deployment checks and strict build also passed.
- Earlier verification of this source cohort: modules **309**, portal **467**, documentation browser **6**; both generated-documentation checks and all three builds passed. Those suites were not repeated after the checker-only core change.
- Compiled candidate on private loopback API: desktop 1440 × 1000 and mobile 390 × 844 passed with actual testnet reads. The first private run blocked direct RPC resource reads because its proxy allowed only the app/API; allowing the configured testnet RPC fixed the harness. No application assertion was removed. The private proxy's local TLS exception is separate from the final public checks.
- Public `npm run test:testnet-public`: both viewports passed with normal public HTTPS validation, no intercepted provider fixtures, no page errors, no misplaced API requests and no API 5xx responses. The checks cover account entry, navigation, DAO/module reads, Telos ballots/elections/producers, contract resources, permissions, fresh name quotes, layout and accessibility.
- Public smoke checks: expected core50/modules63 versions, reachable RPC/database, exact sealed portal index, frame headers, fresh price observation, signed-out session 204/CORS, MCP OAuth metadata/catalog and rejection of an unauthenticated tool call with 401/CORS.
- Nine immutable archives downloaded and checked for byte count and SHA-256: new and preceding mini-app cohorts plus the independently pinned MCP cohort. Sealed file hashes, clean source checkouts and pushed dev refs passed before this evidence-only commit.

Complete logs, operator packet/diff, source hashes, receipts, candidate/public reports and protected rollback materials are retained under `/data/daclify-runtime/release-review-20261017`. Public read checks did not repeat email, wallet, passkey or hosted-client consent ceremonies and did not create customer transactions. Cryptographic/legal review, independent recovery and mainnet qualification remain outside this testnet release.
