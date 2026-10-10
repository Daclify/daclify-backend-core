# Creator owner / executive active implementation evidence

The user approved the replacement policy and confirmed testnet creator `3boidanimus3` on 2026-10-10. This work implements C++ ownership policy 2, its public SDK/API/UI, native regression tests and a read-only unsigned testnet plan. It performs no live chain writes, signing, deployment, asset movement, registry publication or production release. Work remains on dev.

## Resulting policy

Runtime owner is creator@active only. Runtime active is the eligible paired executive roster at configurable quorum, plus own eosio.code weighted to that quorum. Synchronization uses active authorization and leaves owner intact. Core code/ABI upgrades require active. Each managed contract delegates owner/active to runtime active; own code is included only for configured inline senders. Managed upgrades are owner-linked. Hub has no own-code grant. Testnet includes Hub, five modules and Names; no-code Relay/Fees retain their separate settler/treasury authorities.

Service remains a key-only child of active with the six existing creation/bootstrap links. C++ rejects a service key that can independently satisfy creator or executive active/owner, direct creator/contract cycles, duplicate contracts, no-code managed accounts and invalid inline roles. The API already fails closed if its bootstrap signer does not match an existing service authority; deployment must configure that separate signer before handover.

Nativegov retains all old serialized fields and appends optional versioned ownership metadata. Legacy authorities are not silently reinterpreted. An unsupported governing policy freezes its member instructions except withdrawal/unstake; public settlement of existing liabilities remains usable. Actual preceding-binary upgrade tests cover this behavior. Already handed-over legacy deployments need an explicit separate reviewed migration.

SDK nativeHandoverActions returns owner staging and final handover together. It checks exact account sets, owner/active parents, policy/creator/version/DAO, distinct ordered executive wallets, reachable quorum, unexpected permissions, existing temporary grants, code-only execctx with all core links, and service scope. Clients separately verify exact WASM/raw ABI pins. Raw account reads check eosio.any metadata before canonical WharfKit decoding. C++ rechecks creator, policy version, roster, quorum and revision; stale handover rolls back every temporary grant.

UI displays configured creator recovery, effective q/n, wallet accounts, managed inline roles, service scope and upgrade policy. Before handover it explicitly labels the policy proposed; effective eligibility is distinguished from the last synchronized native authority. Downloads refresh chain identity, exact release pins, native configuration, executive state and public authorities, and include before/after review details. Unsupported metadata/releases refuse native transaction preparation. Status continues showing actual reported authorities, rather than claiming the proposed policy has been deployed.

## Artifact pins

| Artifact                       | Version / SHA256                                                 |
| ------------------------------ | ---------------------------------------------------------------- |
| Core / public SDK              | 0.13.0-alpha.1                                                   |
| Module SDK / help              | 0.9.0-alpha.17; module contract binaries remain 0.9.0-alpha.5    |
| Runtime WASM                   | 0943069c7a09dcde50ce36037671bd2487289d392dbe334bf08d4251952e0bad |
| Runtime raw ABI                | 50ab00d5e3e61a5e1fa4339a2edecaa005cd1edd7f28268aa87c7d8195fa4e63 |
| Core development SDK tarball   | e574fbf3b5ced33c0a42a863145481ddbe87adf0d20f1c6e83cd81af801026f9 |
| Module development SDK tarball | b0f46807062081ec892237ed903d85cf9f6e81c9cfa21ceeac2365bc0a6347d6 |
| Preceding policy-1 runtime     | ecdb1e3dab7fb57502dd9ea8cde447a00892f20f4d30fa373f02c072eca03f40 |

The preceding binary was rebuilt from full source revision 8a2c5f94622c219814d2bbd0689f49ac6ea12d65 using pinned CDT 4.1.1 and matched its saved hash. Core compiled all eleven contracts/fixtures with the pinned compiler. The actual five module binaries match the public module SDK hashes and run in native workflows; their source/binaries were not changed or freshly compiled in this policy work. SDK packaging is explicitly development packaging, not immutable production qualification. Consumer archives and lock integrity are pinned; installed SDK executables match the built producer output.

## Checks

| Check                                                                                                       | Result                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core default suite, two workers, 90-second timeout                                                          | 769/769 tests, 124 files passed                                                                                                                          |
| Module default suite, one worker, 90-second default; existing large case keeps its explicit timeout         | 163/163 tests, 27 files passed                                                                                                                           |
| Frontend default suite, two workers, 90-second timeout                                                      | 209/209 tests, 38 files passed                                                                                                                           |
| Final desktop/mobile browser fixtures                                                                       | 16/16 passed, including accessible offline permission guide, owner/quorum disclosures, atomic handover download, legacy block and exact release mismatch |
| Final full owned native permission suite                                                                    | 108/108 tests, six files passed; no skips; 256.70 seconds                                                                                                |
| Core/module strict types, lint, generated docs checks and builds; frontend Vue template/type/build and lint | Passed                                                                                                                                                   |
| Changed-file formatting and git diff whitespace checks                                                      | Passed                                                                                                                                                   |

There are 18 additional core unit/API cases and 19 additional native cases over the preceding audit baseline, plus six additional desktop/mobile browser executions. Native nodes use real Spring 1.2.2, actual compiled C++/ABI, distinct disposable signatures and dummy DAOs, and RAM_RESTRICTIONS / RESTRICT_ACTION_TO_SELF alongside the other required features. The workflow fixture now uses actual policy-2 handover, rather than manually installing a hypothetical tree. The authority-probe fixture independently tests primitive authorization and hostile inline calls, including attempts to weaken or unlink owner-protected upgrades.

The native scenarios cover actual handover and every managed authority, q-minus-one rejection, real ABI upgrade by quorum, creator recovery, inability to replace core owner using active, stale-state rollback, configurable quorum, departed/replaced wallets, last-controller protection, governing/tenant role isolation, code-driven synchronization, genuine inactivity/all-inactive fallback, delayed executive election activation, service isolation, module sender/grant/hash checks, replay, and Grants/Decide/Works/Payroll settlement. The legacy fixture upgrades a real old handed-over runtime, verifies unchanged owner/controller state, rejects new controller mutation and proves real unstake, existing payroll liability settlement and claim withdrawal.

RED evidence: the old handover removed creator recovery, and the new SDK initially lacked atomic/preflight behavior. During qualification the election fixture initially used a representative title; it was corrected to the contract’s reserved Executives title. A combined native run had 107 passes and one NOT_PAYABLE from a new legacy payroll test executing before its on-chain due time; that fixture now waits on the actual chain deadline and all three legacy cases pass independently. The final combined rerun passed all 108 native tests. These fixture corrections did not change contract timing or authorization rules.

Browser fixtures exercise HTTP/UI behavior; they do not prove live wallet or multisig signing. Docker resource/provider/paid integration families, actual Telos system resource economics, external custody and provider integration were not newly qualified here. Full repository formatting retains the preexisting unrelated OpenBao/ignored-workspace issues recorded in the preceding audit; changed files pass. Vite retains its existing large-chunk advisory. No production security guarantee or immutable release qualification is claimed.

## Public testnet proposal

The read-only command `npm run prepare:native-ownership -- .artifacts/native-ownership-testnet-ready-review.json` reads the committed public profile and complete account metadata. It verifies chain identity and local release bytes, identifies the seven real managed code accounts, derives the separate service public key from relay active, and refuses existing/unknown native policy or conflicting context links. It emits owner-authorized code/ABI upgrade, eleven missing context links and explicit creator/inline-role setup: sixteen unsigned actions total. No key loader or broadcaster is called.

The governing DAO is 1. Public reads show no nativegov, no executive policy and no executive roster. The packet keeps handoverReady false and unsignedHandover null. It requires reviewed release/deployment state, a matching API service signer, intended executive member IDs, each wallet’s on-chain pairing consent, and a fresh effective quorum/revision before a separate atomic handover can be proposed. Creator active still includes the shared bootstrap key; delegating recovery does not rotate the creator’s authority or eliminate that transitive recovery path.

See the [operator guide](../operations/creator-owner-executive-active.md) and [native recipe](../operations/native-permission-tests.md). Signing exact live proposals is a separate subsequent decision under the approved specification. Current code, tests and proposal preparation do not authorize live authority changes.

Implementation delivery: core ce6725e, modules 24c2f87 and frontend f014bd8 were pushed to origin/dev. Remote refs matched local HEAD, and all three worktrees were clean at verification. A subsequent documentation-only commit completes this execution record; no release or live rollout follows from these pushes.

Subsequent explicit user authorization selected `3boidanimus3` as the initial executive and approved up to 4 testnet TLOS for required RAM. The policy is now deployed and handed over on testnet; see [the separate live rollout evidence](2026-10-10-native-ownership-testnet-rollout.md). The unsigned packet above describes the pre-rollout state and must not be reused.
