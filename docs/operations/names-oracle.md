# Names price observation updater

Core/SDK 0.13.0-alpha.2 adds `observeprice` and `observefee` without changing existing Names row layouts or executive pricing actions. Install the oracle permission after native ownership handover, using the public SDK `nameOraclePermissionActions(names, publicKey)` and the existing Names active authority. The recipe creates a threshold-1 key-only `oracle` child of active and links only those two Names actions. It preserves owner, active, upgrade links, treasury and root governance.

Generate a dedicated key outside source and keep `NAMES_RATE_PRIVATE_KEY` in a private updater environment, separate from API/creator keys. The testnet file is `/data/daclify-env/names-oracle.testnet.env`, mode 0600 in a private directory. It also contains the public testnet network, chain ID and RPC settings. Never reuse an executive, recovery or deployment key for observations.

Generate unsigned observations:

```sh
DACLIFY_ENV_FILE=/data/daclify-env/names-oracle.testnet.env npm run price:names -- testnet
```

The reviewed testnet service runs the command with `--apply`. It checks the runtime and Names code pins, exact child authority and exact two links before signing. It uses the existing Delphi TLOS/USD reader and ECB daily EUR reference. An ECB outage preserves the last valid fee estimate while permitting TLOS observations. Price observations must be newer than the saved value, at most 15 minutes old, and not in the future. Fee dates must not decrease and must be within seven days. Quotes fail when required observations expire.

`observeprice` changes only the median, precision and observation time. `observefee` changes only the fixed card-processing observation and date in an existing version-1 profit policy. Minimum profit, percentage fees, bump/premium, treasury and contract upgrades keep their existing executive requirements. The publisher remains trusted for market observations; this does not attest external feed correctness.

Executives rotate the child with `updateauth` signed through Names active; existing links do not need reinstalling. Reinstalling an unchanged `linkauth` is rejected by the native chain. Antelope allows a child to rotate its own authority, too, but it cannot change its parent or expand links. Executive active can replace or revoke that child. Update the updater's private key when rotating, and verify all parent authorities and links again.

Owned native checks include `tests/native/names-oracle-permission.test.ts` in `npm run test:native:permissions`. They use actual compiled Names C++ and distinct dummy signatures with two-executive delegated active. They test policy preservation, wrong signatures, scope denial, replay/future/stale observations, upgrade/withdrawal/authority/link denial and executive revocation. VERT additionally checks numeric and freshness boundaries.

## Pin the running release

Run the updater from an archived reviewed source, lockfile and public-artifact snapshot matching live runtime/Names code. Do not point a production timer at the mutable development checkout. The testnet service's `source.conf` drop-in currently uses `/data/daclify-runtime/releases/20261017-private-content/daclify-backend-core`, matching the deployed core 0.15.0-alpha.46 / modules 0.10.0-alpha.57 cohort. The five-minute timer retains the dedicated oracle key and existing permission links.

On 2026-10-17 the service was still using `20261015-trusted-contact-recovery`. Its runtime hash check rejected the newer deployed privacy runtime, so the saved Names observation expired and `/v1/names` returned `ORACLE_STALE`. RAM estimates in TLOS remained readable, but their USD conversion was unavailable. Repointing the service to the matching immutable release restored an irreversible observation and the live portal's dollar estimate. See [recovery evidence](../evidence/2026-10-17-ram-usd-oracle-recovery.md).

A running timer alone is insufficient rollout evidence. After a runtime or Names upgrade, verify the effective service working directory and executable against the deployed snapshot, run the unsigned updater check, then confirm the scheduled service reports `Result=success` and `ExecMainStatus=0`. Check a published observation younger than 900 seconds, an HTTP 200 `/v1/names` response and a visible USD estimate in Contract resources. Keep the code/ABI and authority checks; update the service snapshot rather than bypassing those checks. Preserve the prior drop-in for rollback to its matching contract release.

Earlier snapshots and rollout evidence remain historical: [Users cutover](../evidence/2026-10-11-unified-users-testnet-rollout.md) and [earlier audit rollout](../evidence/2026-10-11-project-audit-testnet-rollout.md).
