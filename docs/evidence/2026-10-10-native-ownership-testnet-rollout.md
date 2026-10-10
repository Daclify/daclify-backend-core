# Native ownership testnet rollout — 10 October 2026

The user authorized `3boidanimus3` as creator and sole initial executive of the
platform Daclify DAO (DAO ID 1), and approved at most 4 testnet TLOS for required
RAM. Administrator member 1 was already actively paired to this native account;
no wallet binding or internal identity was invented.

Both transactions are irreversible on Telos testnet:

| Transaction                                                                                             | Block     | ID                                                                 |
| ------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| 64 KiB RAM, reviewed runtime/ABI upgrade, eleven missing context links, setup and executive appointment | 449530503 | `341f910626c5a9995a53a1d2efb09563c46a5914f264455e28dc131bcc874840` |
| Atomic owner staging and final permission handover                                                      | 449530510 | `08a8c0061f1b6e897e9748c4ff9e8ce6fec228ee2de0b7892401882122ac07a3` |

Chain ID: `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`.
The deployed runtime WASM and raw ABI match the reviewed SDK hashes
`0943069c7a09dcde50ce36037671bd2487289d392dbe334bf08d4251952e0bad` and
`50ab00d5e3e61a5e1fa4339a2edecaa005cd1edd7f28268aa87c7d8195fa4e63`.
Other contract binaries were unchanged.

Core owner contains only `3boidanimus3@active`. Core active contains that executive
and `daclifycore1@eosio.code`, each with weight 1 and threshold 1. Executive quorum
remains configurable at its default 100%; inactivity is 30 days. Execctx is
code-only. Service is key-only, linked to the six reviewed creation/bootstrap
actions. The seven managed accounts delegate owner and active to core active;
the five modules and Names additionally retain their own code in active. Hub
has no own-code entry. Core upgrades are active-linked; managed upgrades are
owner-linked. Every resulting authority and upgrade/service link was checked
against the public SDK's expected definitions. No temporary owner-code grants remain.

The RAM simulation initially rejected the upgrade because core needed 28,362
more bytes. The approved 65,536-byte purchase cost **3.7512 testnet TLOS** from
`3boidanimus3`, including 0.0188 TLOS RAM fee; the live preflight enforced the
4-TLOS limit before broadcasting. The payer's balance decreased by exactly
37,512 base units, confirming the quoted cost. Core and relay both pass the API's live
resource-readiness checks afterward. All 19 existing runtime tables / 44 rows
were checked for byte-for-byte preservation. Other DAO memberships, liabilities
and wallet bindings were preserved.

The API bootstrap signer now matches the separate relay/service key. Its previous
configuration backup remains private under `/data/daclify-env`. Current code,
ABI, table and authority snapshots and exact unsigned/simulation/receipt files
are under `/data/daclify-runtime/ownership-rollout-20261010-complete`, with private
directory/file permissions. [The public machine record](2026-10-10-native-ownership-testnet-rollout.json)
contains transaction, authority, cost and permission-probe evidence without secrets.

During integration, sharing the service and relay key exposed duplicate signatures
in order-backed DAO creation. The API now emits one signature when both account
authorities accept the same key; both action authorizations remain present.
A native dummy DAO successfully consumes its free creation order and enrolls its
founding member after handover, exercising the same creation path used by paid orders.

The final service check exposed a remaining Names integration issue. Its automatic
price updater still assumes the API bootstrap key directly satisfies runtime active.
The new restricted service key cannot refresh Names prices. The timer is disabled
to stop failed retries; an unsigned price update was prepared at
`.artifacts/native-ownership-names-price-unsigned.json`, without broadcasting.
Live `get_required_keys` checks reject the service key and accept the current
creator/executive key for that update. Automatic observation updates need a separate
permission design, or updates must retain executive approval. In particular,
`setprofit` also changes pricing policy and must not be delegated wholesale merely
to refresh a fee observation. Basic-name quotes become unavailable when their
15-minute price observation expires. This remains unresolved pending the user's
choice; the owner/active migration and general UI reads are deployed successfully.

| Verification actually run                                                | Result                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upgrade and handover simulation, broadcast and irreversible readback     | Passed; handover staging and final update remained one atomic transaction.                                                                                                                                                                                                                         |
| Five live read-only RPC permission probes                                | Duplicate shared-key signatures rejected; one signature satisfies service and relay authorities and reaches the expected missing-order business guard. Executive key permits active-authorized upgrades; service and old runtime operator keys fail upgrade authorization. No probe was broadcast. |
| Native creation regression                                               | Failed before the signing fix; passed after it.                                                                                                                                                                                                                                                    |
| Complete native contract-workflow file                                   | 41/41 passed, no skips; actual compiled C++ and strict native permissions, including dummy DAOs and module workflows.                                                                                                                                                                              |
| Core default suite                                                       | 124 files / 769 tests passed.                                                                                                                                                                                                                                                                      |
| Core TypeScript, lint, build, generated docs and changed-file formatting | Passed.                                                                                                                                                                                                                                                                                            |
| Public desktop/mobile UI                                                 | Passed with real HTTPS API/RPC data: DAO discovery, Status, account resources, contract selection and platform workspace; API advertises ownership policy support.                                                                                                                                 |

The first focused native invocation lacked the fixture's `DACLIFY_NATIVE_LIBS`
setting and failed before tests; it was corrected. A subsequent test assertion
used the wrong creation-order table name; the canonical `createords` assertion
now verifies actual receipt consumption. The live permission probe's initial
handwritten request lacked the compute endpoint's packed-transaction envelope;
the corrected requests follow the installed primary SDK and pass. These were
test/tooling corrections, not changes to the deployed C++.

The preceding 108-case native permission suite qualified the same deployed
contract binaries before rollout. This run repeated the 41-case workflow file,
not all other native families. Real provider login/payment ceremonies and browser
wallet or multisig signing were not repeated. Creator account keys were not rotated;
its existing shared bootstrap key still has the documented transitive recovery role.
This is testnet evidence, not a production release.
