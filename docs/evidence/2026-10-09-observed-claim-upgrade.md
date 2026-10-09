# Observed legacy claim upgrade — 2026-10-09

The owned native drill uses actual historical core `6145da8`, Works/Payroll `4a43786`, and Decide `2d44085` with its `c6e713e` core headers. Exact historical/current code hashes and native totals are in the [raw report](2026-10-09-observed-claim-upgrade.json).

It seeds two members, accepted Works milestones, a committed Payroll schedule, an open poll and a settled internal claim before upgrading. Completion-only adoption preserves original member nonces, signing/encryption domains, obligations, milestones, schedules and ballots. Native growth equals existing plus new counters for all four payers before token exit; pre-observer configuration and code/permission changes remain the measured native baseline. Completed retries leave counters unchanged.

After actual funded pools/inherited capacity and module checks, the operator enables the quota guard. The drill fills ordinary RAM using the canonical packed DAO row size, recovers the original signing key, rejects a partial withdrawal without consuming its nonce, then withdraws the full old claim using the adopted physical reserve. Two pending obligations remain. It does not silently rewrite executable approvals.

Reproduce with `npx tsx tools/build/observed-upgrade.ts` and `npm run test:native -- tests/native/ram-observed-upgrade.test.ts` on Node 24.21 and the exact owned resource fixture. The standalone claim run passed **1/1 in 22.58 seconds** (`.artifacts/quota-observed-claims-evidence.log`). After the readonly Works isolation correction, the repeated controller/claim suite passed **3/3 in 109.29 seconds** (`.artifacts/quota-scoped-native.log`); the raw report contains that final observed fixture. Earlier attempts exposed fixture setup/cursor/packed-size errors and the actual missing observed-inheritance integration; those failures remain logged.

This is one historical combination with three module producers, not the complete supported-release lifecycle matrix. Counter/native equality is checked before the token exit; external token-contract row payer changes remain separately unqualified. No public deployment, real purchase or production authority change occurred.
