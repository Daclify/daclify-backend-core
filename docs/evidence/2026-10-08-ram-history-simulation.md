# Native RAM simulation and history retention — 2026-10-08

**Measured:** 200 shared-contract DAOs and 40,000 active memberships consumed **33.046 MiB** across the runtime, hub and five first-party module accounts. Adding Decide configuration to every DAO adds 0.065 MiB. **Projected:** one 512-byte on-chain profile per membership and a first private encryption epoch for every DAO bring that total to **93.610 MiB**, before ongoing documents, governance or financial activity.

These are Antelope billed RAM figures, not the application server's physical memory. One MiB is 1,048,576 bytes. This is a storage measurement, not a throughput/load test or a mainnet resource-price quotation.

## Method and provenance

- Core revision: 9f843904bd8ed68fb0cfbcbd7aac496760935974; core/modules development interface 1, package version 0.7.0-alpha.1. Analysis is isolated on branch codex/ram-history-simulation.
- Existing checksum-verified CDT 4.1.1 / Spring 1.2.2 toolchain image; actual compiled C++ WASM and ABI, signed transactions and native get_account RAM billing. VERT estimates were not substituted for native billing.
- Disposable local container daclify-ram-native, bound to 127.0.0.1:20488. No public-chain transactions, existing fixture resets, user signing keys, provider credentials or database writes.
- Runtime WASM SHA-256: 0e01df299fd3017467087aef180bd2d9e253562d2a305e731a60ffdba003c5b8. Deployed binary ABI SHA-256: cf60ec33ea42d5fd316225310da42b528524c195a1ca997d7562e122ac125863. Both checked against the producer-owned SDK before mutation. Runtime WASM file size: 482,802 bytes; billed deployment size is larger.
- One shared runtime and hub registration; Decide, Works, Payroll, Grants and Endorse binaries deployed once. Decide enabled in every DAO. The other modules' activity tables were not populated.
- Actual free creation orders and provider-style capacity attestations allowed 200 members per DAO. Dummy receipts and a test settler were used; this does not qualify Stripe or TLOS payments. The local genesis permits unlimited account RAM while still accounting for native RAM usage.
- All 40,000 member rows were inserted and independently queried as active. The fixture reuses 200 disposable signing keys across DAOs; this models 40,000 memberships, not 40,000 distinct people. A membership row has the same size in either case.
- Each member has a 126-byte canonical-shaped P-256 encryption public-key JSON. One native-linked administrator per DAO; other memberships use internal signing keys. Extra EVM binding rows, scoped sessions, agent controls, financial obligations and provider-service records are excluded.
- Optional row samples: 200 profiles with 512-byte JSON; one private DAO with an epoch and 200 grants; 100 IPFS-pointer documents; 100 documents with 1,024-byte inline JSON; one two-choice ballot and 200 signed votes. Public document metadata is 172 bytes; ballot metadata is 173 bytes.
- Encrypted grant envelopes are 364-byte schema-valid synthetic fixtures. Their cryptographic values are placeholders: this measures storage, not decryption. Sample CIDs were not pinned; the 1 MiB document size is metadata, not uploaded content.

The reproducible runner is [tools/analysis/ram.ts](../../tools/analysis/ram.ts). [Raw account measurements](2026-10-08-ram-native.json) contain no private keys. Its assertions verify population, active membership, pinned runtime provenance and retained vote count.

## Actual native measurements

The total includes the seven platform contract accounts; the additional clone probe is measured separately. Shared code and fixture permissions are charged once.

| Stage | Total billed bytes | Total MiB |
| --- | ---: | ---: |
| Deployed contracts and fixture permissions | 9,465,530 | 9.027 |
| Plus 200 DAOs, creation orders and capacity attestations | 9,766,570 | 9.314 |
| Plus 40,000 active memberships | 34,651,370 | 33.046 |
| Plus 200 profiles with 512-byte JSON | 34,837,594 | 33.224 |
| Plus one private epoch and its 200 member grants | 34,968,778 | 33.349 |
| Plus 100 IPFS document records | 35,025,290 | 33.403 |
| Plus Decide configuration for all 200 DAOs | 35,093,587 | 33.468 |
| Plus one open ballot and its governance lock | 35,094,605 | 33.469 |
| Plus 200 signed votes | 35,152,517 | 33.524 |
| After finalizing that ballot | 35,152,517 | 33.524 |
| Plus 100 inline JSON document records | 35,288,217 | 33.654 |

Finalization reclaimed **zero bytes**. All 200 votes remained. Core paid 30,615,902 bytes at the last stage; hub paid 608,288; Decide paid 1,701,142; Works 799,533; Payroll 426,568; Grants 672,480; Endorse 464,304. DAO ID/scope provides logical isolation, but the contract accounts pay the RAM in this deployment.

Measured marginal charges include serialized payload, native row billing and secondary indexes. Empty table/scope overhead is separate:

| Record | Bytes per row | New table/index scope overhead |
| --- | ---: | ---: |
| Member with 126-byte encryption-key JSON | 621 | 224 per DAO |
| Profile with 512-byte JSON | 930 | 224 once per runtime |
| Encrypted key grant with 364-byte envelope | 654 | 112 per DAO |
| Epoch commitment | 160 | 112 per DAO |
| IPFS document pointer, 59-byte CID and 172-byte metadata | 564 | 112 per DAO |
| Inline document with 1,024-byte JSON | 1,357 | Same documents table |
| Vote | 289 | 112 once per module/runtime scope |
| Two-choice ballot with 173-byte metadata | 493 | 112 once per module/runtime scope |
| Governance lock | 301 | 112 per DAO |

40,000 member rows plus their per-DAO scopes add 24,884,800 bytes (**23.732 MiB**). Larger JSON, different encryption representations, more choices and additional indexes change these figures; they are not universal per-user prices.

## Explicit projections, not simulated populations

| Scenario | Added RAM |
| --- | ---: |
| 40,000 profile rows, each containing 512-byte JSON | 35.477 MiB |
| First encryption epoch and 200 grants in each of 200 private DAOs | 25.021 MiB |
| Each later complete epoch across those DAOs | 24.979 MiB |
| Two ballots/DAO/month, 120 votes each, for one year | 162.409 MiB |
| Three months of the same raw governance records | 40.618 MiB |
| 20 new IPFS-pointer documents/DAO/month, one version each, for one year | 25.839 MiB |
| Same document count with 1,024-byte inline JSON | 62.140 MiB |

Formulas in bytes, using measured marginal charges:

```text
profiles = 40,000 × 930 + 224
first private epochs = 200 × (200 × 654 + 160 + 112 + 112)
later full epoch = 200 × (200 × 654 + 160)
annual governance = 4,800 × (120 × 289 + 493 + 301) + 200 × 112 + 2 × 112
three-month governance = 1,200 × (120 × 289 + 493 + 301) + 200 × 112 + 2 × 112
annual CID documents = 48,000 × 564 + 200 × 112
annual inline documents = 48,000 × 1,357 + 200 × 112
```

The governance projection covers ordinary polls and their locks, not elections, office terms, executable award/work plans or financial records. The three-month figure is the hypothetical raw-record window; permanent summaries and archive anchors would still add storage after pruning is implemented.

Illustrative first year with all 40,000 profile rows, all DAOs private, 12 full encryption epochs, the annual governance scenario and the annual IPFS-document scenario: **556.622 MiB**, before additional module activity, member churn, settlement records, recovery indexes or operational headroom. This is an assumption-driven example, not a traffic forecast. Twelve full private epochs alone total **299.786 MiB**; frequent rotations can cost more. Rotation needs follow access/security requirements, not a convenient billing calendar.

Independent deployments have their own cost: deploying the same runtime WASM and ABI to one additional empty account added **4,840,287 bytes (4.616 MiB)**. Extrapolating 199 additional runtime deployments adds **918.595 MiB** above the shared-runtime case, before independent module binaries, configuration and accounts. Only one clone was actually deployed. This is resource duplication distributed among the independent operators, not necessarily RAM paid by the hub operator.

For capacity planning, the shared population with all sampled profile/private features starts near 94 MiB. Reserve headroom and measure actual activity; 94 MiB is not a permanent ceiling. There is no current USD/TLOS cost quotation or claim that these local totals exactly match every Telos permission/system configuration.

## What the current contracts retain

The runtime [record definitions](../../contracts/common/records.hpp) and [actions](../../contracts/runtime/runtime.cpp), plus [Decide](https://github.com/Daclify/daclify-backend-modules/blob/6258233/contracts/decide/decide.cpp), retain most history in live tables:

- Document writes append every version; updating a document does not replace its old row.
- Epoch commitments and encrypted member grants remain for historical document access.
- Member deactivation changes flags and counters; it does not erase identity, nonce, balances or the row.
- Decide finalization changes the result/status and unlocks governance. It does not erase ballots or individual votes. Inactive governance locks also remain.
- Creation/capacity receipts, financial evidence and module settlement/execution records carry historical state and once-only references.

There are targeted erases for scoped sessions, catalogue entries and withdrawn/ineligible nominations, but **no general archive-and-prune implementation**. The field history_policy controls entitlement to older encrypted epochs; it is not a history-retention setting.

Social pairings, Stripe state and API jobs are service/database data, not contract RAM. Neither chain history nor IPFS automatically preserves those records. IPFS CIDs reference content; they do not guarantee that somebody keeps a retrievable copy. See the [disaster-recovery runbook](../disaster-recovery.md).

## Recommended retention design — proposal only

Keep compact authoritative current state on chain. Archive bulky terminal history. Do not delete by age alone.

1. Keep member identities, credential epochs/revocations, signing nonces, balances, stake, claims, live module state, pending obligations and active governance snapshots/locks. Keep necessary terminal status, consumed-reference protection, permanent ID allocation and document/version continuity.
2. Start with **90 days after terminal completion** for individual poll votes and eligible old document versions. A DAO may choose longer retention. Financially unresolved records, executable/referenced proposals, office terms and dispute evidence require their own eligibility rules. This is a proposed policy, not a feature available today.
3. Export eligible records from irreversible chain state to a versioned archive. Use PostgreSQL for querying, encrypted off-host backups for recovery, and Pinata/IPFS for durable content-addressed bundles. Encrypt protected content and key-grant bundles before publication. Keep an on-chain archive CID/hash, domain, schema/ABI version and coverage boundaries; verify restored bytes against those commitments.
4. Verify archive integrity and independent retrievability before any authorized, bounded pruning transaction. Retain original encrypted grants or migrate them to verified grant archives with recovery tests. Deleting the only usable envelope can make surviving private documents unreadable.
5. The UI/API combines live records and archived history and explicitly reports missing archive coverage. Hyperion helps replay/rebuild/verify history, while the operator owns retention and backups.

Pruning requires a contract/interface upgrade and reference-by-reference tests. Several tables allocate IDs with available_primary_key(), and ballots/document versions have existence and continuity checks. Removing the highest row or a consumed-reference row can permit ID/reference reuse or break later writes. Retain monotonic counters/high-water marks and necessary tombstones/commitments; merely erasing a closed ballot is unsafe. A hash or Merkle root alone is not a replacement for contract-readable replay protection unless the action protocol also verifies the required proofs.

Permissionless expiry/pruning is suitable only if contract eligibility is deterministic and cannot remove a right or the sole recovery path. Archive publication/availability cannot be proven merely by giving the contract an HTTP address. The first implementation should use explicit accountable archive attestations, bounded batches and restore verification rather than claiming trustless off-chain availability.

Constant active-member counts do not bound RAM: former members, document versions, receipts, old votes and key epochs continue accumulating. Shared hosting needs separate history/storage budgets and admission/rate limits, including fair RAM accounting across DAOs. Exhaustion controls must preserve withdrawal, recovery and completion of existing obligations. Membership subscription capacity is not a storage limit.

## Hyperion: useful history, not the sole backup

Primary documentation: [history API](https://hyperion.docs.eosrio.io/api/v2/), [chain/index configuration](https://hyperion.docs.eosrio.io/providers/setup/chain/) and [index management/pruning](https://hyperion.docs.eosrio.io/providers/operations/index_management/). Providers control table/action filters and retained index ranges. Current Hyperion documentation describes optional deletion indexing; this must be checked against the actual provider/version rather than assumed.

Read-only probes on 2026-10-08:

- The official Telos [exchange-node guide](https://docs.telos.net/nodes/non-bp-nodes/exchange-teloszero-upgrade-guide/) identifies mainnet.telos.net as a chain/Hyperion endpoint and Telos Zero 1.2.2 as based on Spring 1.2.2.
- https://mainnet.telos.net/v2/health returned HTTP 200, Hyperion 3.5.0-5, index_deltas/index_all_deltas true, and reported indexed blocks 2 through 492,858,906 with zero missing blocks. This is provider-reported coverage, partly cached, not an independent completeness audit. Action/delta page limits were 100.
- A get_deltas query for eosio.token/accounts returned a row. A query with present=0 returned a deleted account-balance row from block 192,698,425, dated 2022-01-04, including decoded amount/symbol. This proves that sampled deletion history works on this provider; it does not prove Daclify-specific indexing, historical ABI accuracy or perpetual availability.
- The tested /v2/health and /v2/history/get_deltas paths on api.telos.net returned HTTP 404. A working /v1 chain RPC address is not automatically a Hyperion address. Mainnet probing does not qualify a testnet history provider.

Contracts execute against chain state and cannot HTTP-query Hyperion to authorize payments or recover a deleted nonce. Chain table queries return current state; historical actions/deltas require a history provider and suitable coverage. Store source block/transaction/sequence references, deployment/DAO domain and ABI/schema versions in the archive; handle irreversibility, pagination, deduplication and upgrades.

Deleting live rows can free billed RAM after safe pruning is added, but it does **not** erase their earlier public blockchain history. Deleting ciphertext likewise cannot revoke access to plaintext or old keys already held by a former member. Avoid describing pruning or key rotation as erasure of past access.

## Reproduction and verification

Use an isolated core worktree with the modules/frontend sibling layout and pinned public packages from [development setup](../development.md). Build or supply the exact current core/module WASM and ABIs using the verified toolchain. Do not run native:start in an existing service checkout: it writes a new disposable fixture configuration/key set.

```sh
# From the isolated core checkout, with Docker and the required Node/npm versions.
mkdir -p .artifacts/module-contracts
cp ../daclify-backend-modules/.artifacts/contracts/*.wasm .artifacts/module-contracts/
cp ../daclify-backend-modules/.artifacts/contracts/*.abi .artifacts/module-contracts/
DACLIFY_NATIVE_CONTAINER=daclify-ram-native DACLIFY_NATIVE_PORT=20488 npm run native:start
npx tsx tools/analysis/ram.ts
```

The container name/loopback port are deliberately fixed by this analysis. Start refuses an existing container; the runner refuses a populated fixture before overwriting generated member keys. For a repeat, inspect and explicitly remove only the owned daclify-ram-native container, then start a fresh fixture. The owned container was stopped after verification to release local CPU/RAM; its data was retained. The successful run remains available locally at .artifacts/ram-run.log and .artifacts/ram-measurements.json; disposable member keys stay ignored and mode 0600.

Verification: completed native population/sample run; fresh read-only population/status/RAM checks; TypeScript, lint, formatting, documentation generation check and seven focused release/pricing tests. This analysis does not qualify managed custody, encryption correctness, public-chain resource purchasing, historical Daclify replay, archival durability, pruning safety or load throughput. No retention feature, production change, commit, merge or push is part of this experiment.
