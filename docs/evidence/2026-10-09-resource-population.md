# Current resource population — 2026-10-09

Actual current WASM on the owned Spring 1.2.2 chain: **200 DAOs, 40,000 active memberships, guards enabled for all 200**, one representative eleven-operation workflow per DAO across all five modules. This is RAM conservation evidence, not throughput, complete lifecycle, public-chain configuration or live provider qualification.

| Payer | Baseline bytes | Final native bytes | Native delta = accounted delta | Allocated bytes |
| --- | ---: | ---: | ---: | ---: |
| ramobszkn2to | 9080199 | 42260313 | 33180114 | 114688000 |
| rdecidzkn2to | 2722841 | 2872257 | 149416 | 13107200 |
| rworkszkn2to | 1295474 | 1418130 | 122656 | 13107200 |
| rpayrlzkn2to | 850625 | 1046593 | 195968 | 9830400 |
| rgrantzkn2to | 1113801 | 1180145 | 66344 | 13107200 |
| rendorzkn2to | 842305 | 920049 | 77744 | 9830400 |

Every payer satisfies native delta = DAO/platform counters + observer metadata, and allocation + baseline + headroom stays within actual quota. The 200 generated identities are reused across DAOs; this models 40,000 memberships, not 40,000 distinct people. Physical allocations are reservations, not measured use. Code/permission overhead is separate from DAO accounting.

Command: `npx tsx tools/analysis/resources-population.ts`; raw output `.artifacts/0.8-population.log`. [Full exact hashes, settings and measurements](2026-10-09-resource-population.json).

The owned market was expanded to a synthetic 1 TiB while preserving the original finite 1,000,000 TLOS maximum supply and existing state. The first run exhausted Alice’s dummy balance at 184 funded DAOs; its failure log is `.artifacts/0.8-population-insufficient-funding.log`. A fixture-only redistribution of 4,000 already-issued TLOS from `eosio.ramfee` funded the successful fresh run. These controlled local funding changes are not a production market cost estimate. No public chain transaction or real payment occurred.

Archive deletion, encrypted original-kit/database-loss restore, payout exhaustion and historical completion are measured in separate native drills. They are not represented by this population workload. All earlier and partial-run fixture accounts remain intact.
