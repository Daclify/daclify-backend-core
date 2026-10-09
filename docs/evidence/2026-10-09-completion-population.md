# Completion-hold population checkpoint

The current pinned owned-native build passed 200 DAOs × 200 active memberships (40,000 memberships), all five dedicated module payers, automatic physically backed allocations and ten representative signed operations per DAO. Accepted Works/Payroll obligations now allocate their physical receipt holds; human credential and payroll control metadata is preallocated. Native deltas reconciled exactly for every payer.

| Payer        | Total occupied bytes | Native increase | Accounted increase |
| ------------ | -------------------: | --------------: | -----------------: |
| ramobscplfea |           40,165,798 |      32,629,114 |         32,629,114 |
| rdecidcplfea |            2,475,147 |         149,416 |            149,416 |
| rworkscplfea |            1,149,730 |         122,656 |            122,656 |
| rpayrlcplfea |              798,763 |         195,968 |            195,968 |
| rgrantcplfea |              979,265 |          66,344 |             66,344 |
| rendorcplfea |              740,919 |          77,744 |             77,744 |

Total occupied RAM: **46,309,622 bytes (44.16 MiB)** including code/permissions; measured state/metadata increase: **33,241,242 bytes (31.70 MiB)**. These are occupied quantities, not market prices or allocated capacity.

The first run stopped on depleted disposable issuer funds. After replenishment, the second run reached Spring’s 128 MiB state-database guard and shut down cleanly. Its stopped container and local state image were retained; the same chain ID/state was restarted with a 1,024 MiB database. The subsequent complete rerun passed. Future resource fixtures now use that size. No user/public deployment, live provider or production asset was touched.

Reproduce with `npx tsx tools/analysis/resources-population.ts` against the exact owned container/chain guard. The runner reuses 200 disposable identities across DAOs; it measures memberships, one workflow per DAO and actual billing, not 40,000 distinct people, throughput or complete lifecycles. Synthetic free-member capacity, payer offers and market supply are not new commercial policy. Per-DAO enforcement, general legacy adoption, external token-row reconciliation and live billing remain unqualified.

[Exact measurements and current hashes](2026-10-09-completion-population.json), [prior checkpoint](2026-10-09-six-payer-population.md).
