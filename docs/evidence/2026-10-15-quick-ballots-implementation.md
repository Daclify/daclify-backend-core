# Quick ballots implementation qualification — 15 October 2026

This records completed source qualification before the shared-testnet cutover. It does not claim deployment or an independent cryptographic audit. The companion account foundation's earlier evidence and the 14 October proof research remain historical records.

The cohort is core 0.15.0-alpha.29, modules 0.10.0-alpha.39, frontend 0.15.0-alpha.40 and community MCP 0.1.0-alpha.19. The executable contracts and public schemas, encrypted browser voting/receipts/tallying, canonical account authorization, SQL jobs, source-owned cleanup and archive restoration are integrated. The [user and operator guide](../quick-ballots.md) explains the product and its limits.

## Completed checks

| Check | Actual result |
| --- | --- |
| Core verification, strict types, lint and generated docs | 184 files, 1,077 tests passed; 336.04 s |
| Modules verification, strict types, lint and generated docs | 43 files, 286 tests passed; 422.98 s |
| Frontend verification, Vue types and lint | 72 files, 393 tests passed; 123.98 s |
| Frontend production build | Passed; 4.32 s; existing large documentation/wallet chunk warnings remain |
| Community MCP build/tests | 7 files, 13 tests passed; 6.82 s |
| Latest focused PostgreSQL integration | 5 files, 47 tests passed; 23.00 s |
| Native encrypted-ballot suite | 25 tests passed; 504.04 s, including 5,000 maximum-receipt responses |
| Desktop/mobile HTTP-source browser fixture | 12 cases passed; 49.4 s |
| Desktop/mobile executive creation fixture | 2 cases passed; 14.7 s |

The browser fixtures use actual encrypted vaults, signing, BLS vote proofs, private grants and receipt recovery. They cover vote replacement/removal, selected audiences, accessibility/layout, corruption denial, executive creation and late proof after archival. Their HTTP source and sign-in are fixtures, not a qualification of a person's installed wallet. Native and PostgreSQL suites separately exercise authoritative source/account behavior and durable packets.

The actual Spring 1.2.2 suite activates BLS_PRIMITIVES2 and uses compiled CDT 4.1.1 `-O=s` WASM. Five thousand registered accounts submit 1,024-byte encrypted receipts, the bounded preparation scans all rows and the final proof verifies 2,500 up/2,500 down. Across 5,021 `qsubmit` calls including other suite cases, median CPU was 9,593 μs, p95 12,036 μs and maximum 35,285 μs. A maximum-receipt row added 1,835 bytes; the empty-receipt profile added 810 bytes plus 224 for initial shared table overhead. Replacement/removal profiles and rejected-action rollbacks are retained in the machine evidence.

The finite RAM fixture uses the exact public Telos system binary and genuine resource purchases on the owned native chain. Exhausted backed DAO allowances reject the action without changing the count, aggregate, nonce or counters. Adding a backed grant permits it. This is distinct from a fixture with unlimited boot RAM.

Native archive tests use a test-only calendar fixture to exercise the 30-day boundary, verified archive/backup anchors, corrupt-proof rollback, untallied DAO closure and a valid proof after response/grant deletion. The fixture is excluded from the reviewed release manifest. No elapsed 30-day public-chain claim is made.

## Archive capacity and recovery

A separate offline planner measurement reads the 5,000 actual native encrypted rows and frozen header. Only the retention calendar is advanced synthetically; it does not attest a native archive. The 128 MiB worker heap completed in 269,979 ms, producing 20 chunks and 7,148,600 encoded bytes. Parent-process maximum measured event-loop delay was 133 ms. Peak process RSS, including parent and worker, was 405,278,720 bytes; that is not worker heap consumption.

PostgreSQL/provider-fixture tests cover quota reservation before upload, lost-response reconciliation without a second pin, actual authenticated encrypted backup, primary/backup failure blocking cleanup, loss of SQL archive catalog, native-anchor reconstruction and restoration while the primary is down. These are not live Pinata durability evidence. Live provider/native/recovery qualification is recorded separately at deployment.

Release packaging excludes test-only Quick fixtures and checks all seven reviewed module artifacts against producer-owned SDK hashes. Matching starter/MCP cohorts are generated. Public package production qualification still reports `publication: refused, qualified: false`; no held mainnet/provider/custody gate was weakened.

## Remaining delivery checks

At this checkpoint, testnet still serves core alpha23. Native companion/source creation, runtime upgrade, source/resource/authority pins, actual provider/backup qualification, immutable release staging, live acceptance and integration to `dev` remain delivery work. Independent cryptographic review, independent-host production recovery and mainnet launch are outside this testnet qualification.

Machine-readable measurements and artifact hashes accompany this document in [JSON](2026-10-15-quick-ballots-implementation.json). Full logs and private deployment/recovery material remain in the operator workspace; private keys, account databases and recovery snapshots are not committed.
