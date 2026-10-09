# Completion-guard population qualification — 2026-10-09

Owned native Spring 1.2.2 fixture, current core `c762b54b8f8225f9f0a906cd0b208d675bc4fb9e5bc4572872fb192a54f219f7` and all five module hashes recorded in the [raw evidence](2026-10-09-completion-guard-population.json).

200 DAOs × 200 active memberships: **40,000 memberships**, with all 200 DAO quota guards enabled before representative module writes. Each DAO completes the runner’s eleven representative operations, including Works acceptance and both fixed milestone reference slots. All six native payer deltas equal the corresponding complete DAO/platform counters and observer overhead exactly.

- Native state/meter growth: **33,792,242 bytes (32.23 MiB)**.
- Total occupied code, permissions and state: **49,676,317 bytes (47.38 MiB)**.

Reproduction: compile/package the matching core and modules, stage the module binaries for the owned fixture, then run `npx tsx tools/analysis/resources-population.ts` with Node 24.21. The helper refuses other containers/endpoints/chains. The first attempt failed at setup with `BALANCE`: repeated prior drills left 650 MB in the synthetic market, and the initial 256 MiB purchase exceeded the fixture wallet’s available dummy balance. A red/green regression now expands only this owned synthetic market before its large batch. The successful rerun is `.artifacts/quota-population-final.log`; the failed attempt remains `.artifacts/quota-population-qualified.log`.

This is an occupancy/accounting result, not a throughput, financial-lifecycle or production pricing benchmark. Identities are reused between DAOs; there are not 40,000 distinct people. Native reserves, dummy issuance and the synthetic 200-slot policy are fixture setup. Paid-provider, public-chain, external token-row and complete historical lifecycle qualification remain separate gates.
