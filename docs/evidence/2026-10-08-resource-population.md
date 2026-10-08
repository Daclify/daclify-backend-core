# Native resource population and physical allocation check

Executed on the owned `daclify-resources-native` Spring fixture, never a public blockchain. Reproduce with pinned Node/npm, compiled current core contracts, the matching fixture network, then `npx tsx tools/analysis/resources-population.ts`.

| Quantity                                                | Measured bytes |
| ------------------------------------------------------- | -------------: |
| Core code, permissions and initial settings             |      6,762,632 |
| Core after 200 DAOs and 200 backed allocation receipts  |      7,119,535 |
| Core after 40,000 active memberships                    |     32,004,335 |
| Core after replaying all 200 grants                     |     32,004,335 |
| Observed native increase                                |     25,241,703 |
| Sum of resource counters and observer metadata increase |     25,241,703 |
| Actual core account quota                               |    268,436,217 |
| Total pledged core allocation                           |    140,902,400 |

The measured core footprint is 30.52 MiB; membership insertion adds 23.73 MiB. Pledged capacity is not occupied RAM. The runner independently reads all 200 member scopes, checks active counts and physical allocation backing, and demonstrates grant replay adds no bytes.

This profile reuses 200 disposable identities across DAOs, representing 40,000 memberships rather than 40,000 distinct people. It does not populate all modules, private epochs, user profiles or Hub records. Therefore it is not directly comparable to the earlier seven-account 33.046 MiB scenario. Module mutation conservation has separate native tests; a combined funded all-module population/release proof is still required.

The free-member limit and synthetic system RAM supply are overridden only on this fixture. Native prices in its artificial market are not Telos quotes. Enforcement, obligation-specific completion holds, automatic included/slot allowances and legacy backfill are not qualified by this measurement. [Machine-readable measurements](2026-10-08-resource-population.json) include the chain and code hashes and scope limits.
