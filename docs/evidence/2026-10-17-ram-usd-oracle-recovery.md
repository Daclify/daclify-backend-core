# Testnet RAM USD estimate recovery

Date: 2026-10-17. The resource panel still read the native RAM market and displayed 1485.7514 TLOS, but its USD conversion was unavailable.

## Cause

The active `daclify-names-oracle.service` drop-in still selected the `20261015-trusted-contact-recovery` snapshot. That updater expected runtime hash `afa80071de5578e915c5b4c37d02f294c612a713299fa264116e7f338d65ca2d`; the deployed privacy runtime is `2a2ff848e460f516df9a7a834bb7d79daf03d7d56f5f9855141170913d8022ee`. The updater correctly refused the mismatch. Its timer remained active while the service failed, so checking only the timer missed the outage.

The upstream Delphi feed was current. The Names policy observation remained at 2026-10-17 09:07:03 UTC, over three hours old, and the public `/v1/names` API returned HTTP 503 `ORACLE_STALE`. The resource view rejects observations older than 900 seconds. Its fallback to the Names observation therefore could not supply USD estimates.

## Repair and checks

- Verified the already deployed `20261017-private-content` snapshot's updater, SDK pins and testnet environment file against its immutable manifest.
- Ran that snapshot's updater without `--apply`: its runtime/ABI/Names hash checks passed and it prepared only an unsigned `observeprice` action from the fresh upstream observation.
- Backed up the service drop-in, repointed it to the matching deployed snapshot, reloaded the user service manager and restarted the existing updater. Code-hash and dedicated oracle-authority checks remain intact.
- The updater succeeded with an irreversible observation: transaction `5ecfc6f864d4275ac15117e319c85a754098a2b31271e8eb840a71595f332b01`, block 450674361. The public Names API returned HTTP 200 with an observation 29 seconds old at the subsequent read.
- An unauthenticated Chromium visit to the real testnet portal opened Status → Contracts → Resources and verified **$25.11 / 1485.7514 TLOS**, with the stale-rate warning absent. The five-minute timer remains enabled. The next automatic tick has not been separately observed in this check.

The [operator runbook](../operations/names-oracle.md#pin-the-running-release) now requires verifying the effective updater snapshot, service success, fresh published observation and visible conversion after upgrades, in addition to timer activation.

Evidence, drop-in backup, public before/after readings and screenshot: `/data/daclify-runtime/ram-usd-rate-20261017/`. No application source, contract, authority, key or payment policy was changed; no funds were transferred and no RAM was purchased. This restored the existing testnet observation service and did not deploy the separate pending development repairs. No full application test suites were rerun because no application code changed.
