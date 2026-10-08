# Six-payer native resource population

Executed on the owned `daclify-resources-native` Spring fixture. No public blockchain, user DAO or live provider was changed. Reproduce using current compiled/pinned core and all five module artifacts, then `npx tsx tools/analysis/resources-population.ts`.

The runner creates six dedicated accounts and **200 DAOs with 200 active memberships each (40,000 total)**. It uses opt-in automatic physically backed payer offers, installs all five modules and submits ten signed operations per DAO: a JSON document, Works proposal, Grants round, payroll commitment/label growth/shrink, admission policy/application and a poll/vote. It independently reads every membership, payer counter, allocation and accepted entitlement marker.

| Payer | Total native bytes | Native increase | Accounted increase | Allocated capacity |
| --- | ---: | ---: | ---: | ---: |
| ramobscgjeme | 34,279,403 | 26,831,114 | 26,831,114 | 114,688,000 |
| rdecidcgjeme | 2,435,703 | 149,416 | 149,416 | 13,107,200 |
| rworkscgjeme | 1,149,420 | 122,656 | 122,656 | 13,107,200 |
| rpayrlcgjeme | 787,443 | 195,968 | 195,968 | 9,830,400 |
| rgrantcgjeme | 978,955 | 66,344 | 66,344 | 13,107,200 |
| rendorcgjeme | 740,609 | 77,744 | 77,744 | 9,830,400 |

All six native increases equal their counters exactly. Total occupied RAM is **40,371,533 bytes (38.50 MiB)**, including the six binaries/permissions and 27,443,242 bytes of observed state/metadata growth. Pledged capacity is distinct from occupied RAM. Each allocation fits its actual payer quota after its baseline and 1 MiB platform headroom.

The runner reuses 200 disposable identities across DAOs. It models memberships, not 40,000 unique people, and one representative workflow per DAO. It does not measure production throughput, complete lifecycle coverage, operator pricing or all possible history growth. Synthetic free-member capacity is 200; the included activity split and native RAM-market supply are fixture settings, not new commercial policy. The Hub is not populated. Completion holds, quotas, legacy backfill and live billing remain unqualified.

An initial setup attempt correctly rejected binding before observer/source initialization. A later verification attempt incorrectly expected one entitlement marker; the contract stores one per offered payer. The corrected full rerun checks all six and passed. [Machine-readable measurements](2026-10-09-six-payer-population.json) retain actual hashes and limits. [Static current ABI/write inventory](2026-10-09-ram-write-inventory.json) is a review aid, not semantic lifecycle proof.
