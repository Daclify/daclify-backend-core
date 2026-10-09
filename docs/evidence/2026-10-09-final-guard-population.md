# Final guard population — 2026-10-09

Current core `6ad460053da97c3f55fe2217291b9c1f77c5d73bb5f7b7188a092d9fcf3e6615`; all five module hashes and six payer measurements appear in the [raw evidence](2026-10-09-final-guard-population.json).

200 DAOs × 200 active memberships = 40,000 memberships. All 200 guards are enabled before eleven representative module operations per DAO, including accepted Works and fixed reference slots. **Every native state delta equals the corresponding complete counters**.

- Additional state/meter RAM: **33,792,242 bytes (32.23 MiB)**.
- Total occupied code, permissions and state: **49,676,757 bytes (47.38 MiB)**.

The inheritance-only core change adds 440 occupied code bytes compared with the preceding [completion-guard run](2026-10-09-completion-guard-population.md); state usage is identical. Successful log: `.artifacts/quota-current-population.log`. Reproduce with `npx tsx tools/analysis/resources-population.ts` after compiling/installing matching packets on the exact owned fixture.

This measures occupancy and accounting, not throughput, distinct-person registration, the full financial lifecycle or production market pricing. The runner reuses 200 identities across DAOs, a synthetic 200-slot policy, dummy issuer funding and the owned synthetic market. External token rows, historical lifecycle combinations and live providers remain separate qualification gates.
