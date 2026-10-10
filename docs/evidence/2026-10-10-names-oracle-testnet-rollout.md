# Names observation permission rollout

The user selected a separate, narrowly scoped price-update permission to restore
automatic testnet quotes after creator-owner / executive-active handover. The
implementation uses `daclifynames@oracle`, a key-only threshold-1 child of active,
linked only to `daclifynames::observeprice` and `daclifynames::observefee`. The
dedicated private key lives in the updater's separate private environment. It is
not the API service, relay, creator or executive key.

The five-action Names code/ABI upgrade and oracle installation is irreversible:
transaction `6e43dc66a5bf0da349206f898054750838e0c5ba9af5000110ee20504cdcd67a`,
block **449535209** on Telos testnet. WASM is
`f23bbd7f9dd7643a3cfcbe06bf39545e01a522434502d0857e08611d16121902`; raw ABI is
`1c57626378c943ec3c97c6bb8fe20b8c25b9c49cabd9b65634c10c11cca86b02`.
Read-only preflight and final simulation passed with 30,332 packed bytes and no
token transfer. No RAM purchase was needed. The reviewed new WASM is 2,013 bytes
larger than the preceding 89,644-byte binary. Existing Names owner/active and
upgrade links, core authority and native governance were preserved. All four
existing Names tables / four rows were preserved byte for byte before observations.

The first price observation is irreversible in transaction
`9b3108caa899c958bf886a5f10dd0d6f3d9a1a769a18381d0ae686653f50252e`, block
**449535289**. The restored systemd timer also completed an irreversible update
in `957163e768541c34d44d43ec95545ef8aa9e8abe19e1fe4b861ca54ecc206b3c`, block
**449535384**. The five-minute timer is enabled and its service reports success.
The public quote endpoint now returns HTTP 200 with a valid `NameQuoteSchema`.
Real desktop/mobile browser checks show the oracle child beneath active and both
linked actions in Contract Account Details; they also verify fresh quotes and
the existing Hub, Status, resources and platform DAO flow, without page errors.

Core/SDK and frontend use 0.13.0-alpha.2. Module SDK/help uses 0.9.0-alpha.18;
module contract binaries and runtime code/ABI are unchanged. The producer-owned
ABI, schemas, code pin and public help describe the new observation actions.

| Verification actually run                                         | Result                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract/SDK regression                                           | Expected absent-action/recipe failures before implementation; 18 focused cases pass after implementation and fixture corrections.                                                                     |
| Complete core default suite                                       | 125 files / 785 tests pass.                                                                                                                                                                           |
| Complete owned native permission suite                            | Seven files / 119 tests pass, no skips, 266.86 seconds; actual compiled C++ and strict Spring 1.2.2 permissions, dummy DAOs, executive quorum and oracle revocation.                                  |
| Frontend default suite                                            | 38 files / 209 tests pass.                                                                                                                                                                            |
| Module compatibility suite                                        | 27 files / 163 tests pass in the final rerun. Initial 162/163 pass; the old future-version boundary rejected the newly supported alpha.2. The corrected boundary accepts alpha.2 and rejects alpha.3. |
| Core/module/frontend types, lint, builds and producer docs checks | Pass. Existing frontend chunk-size advisory remains.                                                                                                                                                  |
| Live unsigned RPC authority checks                                | Oracle key permits both observation actions; Names upgrades, pricing policy, executive appointment and Names parent changes are rejected. Six checks pass; nothing is broadcast.                      |
| Public desktop/mobile regression                                  | Fails before rollout on the missing oracle child; passes after rollout with real HTTPS API/RPC data and schema-valid fresh quotes.                                                                    |

The native fixture initially used a nonexistent convenience method; it was
replaced with the fixture's real push interface. Unit/native singleton and small
uint64 JSON expectations were corrected. A hostile child-key rotation probe
revealed normal Antelope self-rotation: a child can change its own key, while
parent authorities and action links remain protected. The claim and native tests
now reflect that behavior; executives can replace/revoke the child. Repeating
unchanged linkauth is rejected, so key rotation uses updateauth alone.

The updater validates its exact key-only child authority and exact two links
before signing. Numeric/freshness/replay checks run in C++. Existing executive
actions still control minimum profit, percentage fees, bump/premium, treasury
and upgrades. The oracle publisher is trusted to supply market observations;
this does not prove external feed correctness. Actual card payment, native name
purchase and provider/wallet ceremonies were not performed by this rollout.

Private rollback binaries, exact unsigned actions, simulations, receipt, raw
readbacks and permission probes are retained under
`/data/daclify-runtime/names-oracle-rollout-20261010` with private permissions.
[The public machine record](2026-10-10-names-oracle-testnet-rollout.json) contains
no secrets. See the [operator guide](../operations/names-oracle.md) for scope,
rotation and updater behavior. This is testnet deployment evidence; production
publication and rollout remain separate.
