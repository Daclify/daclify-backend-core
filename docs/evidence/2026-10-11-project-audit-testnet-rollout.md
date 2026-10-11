# Project audit testnet rollout — 2026-10-11

The user expressly approved the 32-action packet in `.artifacts/project-audit-testnet-review.json`, including the coordinated API/frontend/oracle cutover and Relay/Fees authority changes. The approved packet SHA-256 is `1d2041354022c41591139e2d3c1f1780f5eedb05e359e38f6b0664c0770f5faf`. Fresh preparation matched every encoded action and configuration choice. This rollout applies to Telos testnet only; no mainnet or production qualification is implied.

## Irreversible transactions

| Stage | Actions | Transaction | Block |
| --- | --- | --- | --- |
| Runtime guard upgrade | 1 | `c3fde67f3f6c2c2e4c7fb526cff00a2f92217b124dedd816258b4eec95f55263` | 449603058 |
| Names upgrade, Hub hash refresh, Relay/Fees authorities | 31 | `5058459dc055fc7c9839764db0794d16eba1cdeb4cbe73fc5d0c568b8d3f09f5` | 449603084 |
| Ordinary observation from the upgraded oracle snapshot | 1 | `69cc58ec19f81fb1e574eec6a4105ef647d140c2c141f2cf7533b5aa87d00cec` | 449603132 |

Runtime and coordinated second stage were confirmed irreversible at 08:41:07 and 08:41:20 Atlantic/Canary respectively. API writes and the Names timer were paused before the final state snapshot. Stage two re-ran the service preparer against the installed runtime and compared its 29 actions with the approved packet. Both actual stages also passed fresh read-only computation before broadcast.

Runtime WASM is `a05da7ad1cf616db6af7129fa036ddbc4ae03423f81c87f5eae17d3c78878213`; Names WASM is `29f3155cc67c86871aa862b0ae9168acfdbaadf899721d4f5ef9a7ccaff86a65`. Their existing serialized ABI hashes remain `50ab00d5e3e61a5e1fa4339a2edecaa005cd1edd7f28268aa87c7d8195fa4e63` and `1c57626378c943ec3c97c6bb8fe20b8c25b9c49cabd9b65634c10c11cca86b02`. Hub registration now advertises the runtime's actual code/ABI hashes, with its existing ID, owner, listing and metadata preserved. Other contract binaries and all ten account ABIs are unchanged.

## Installed authorities and preserved state

Core owner remains `3boidanimus3@active`. Its sole initial executive remains `3boidanimus3`, with configurable quorum and current threshold 1. The native governance row, core permissions and previously managed contract permissions are unchanged. The creator's transitive shared-bootstrap recovery authority was not rotated.

Both `daclifyrelay` and `daclifyfees1` now have threshold-1 owner and active authorities containing only `daclifycore1@active`, with no direct keys, waits or own-code grant. Their `setcode` and `setabi` actions require owner. Relay retains its existing service key in the key-only `operator` child of active, with exactly the [reviewed 20 operational links](../operations/project-audit-remediation.md). Fees has no operator child. Both accounts still have zero deployed contract code and remain outside immutable `nativegov.contracts`.

All ten Names tables matched the paused snapshot immediately after the upgrade. Later verification preserved their records except the ordinary approved price/fee observation fields. The root RAM-observer table remains empty. Fees retained **1243.5234 TLOS**. The 32 rollout actions contain no token transfer or RAM purchase. Observed additional RAM was core 12,750 bytes, Names 860, Relay 3,470 and Fees 252, within the existing allocations.

Private rollback inputs, exact accepted responses, frozen snapshots, installation/build logs and browser screenshots are retained in `/data/daclify-runtime/project-audit-rollout-20261011/`, a private directory. No private keys or environment contents are included in the [public machine-readable evidence](2026-10-11-project-audit-testnet-rollout.json).

## Application and oracle verification

The public API reports core `0.13.0-alpha.3` and modules SDK `0.9.0-alpha.19`. The matching frontend was built with testnet configuration in a fresh folder and published with its entry point last, preserving existing hashed assets. API configuration now uses `RELAY_PERMISSION=operator`, `SHARED_PROXY_IPS=["192.168.5.1"]` and `TRUSTED_PROXY_IPS=[]`. The external HAProxy configuration was untouched.

The Names updater runs from `/data/daclify-runtime/releases/oracle-alpha3/daclify-backend-core`, archived from core `f1c951175d7e856d996febb2fb1bee895956a151` with its lockfile and the reviewed core/module archives. Its separate private key and two-action oracle scope are unchanged. Its observation completed irreversibly, and the five-minute timer, API and frontend are active.

The actual public HTTPS desktop/mobile check passed on 1440×1000 and 390×844 viewports: testnet lock, Hub discovery, DAO workspace, contract selection, RAM/CPU/NET, Names oracle links and a fresh quote. No browser errors, static-origin API requests or API server errors were observed. Additional live checks selected Relay and Fees, verified their service roles, no-code labels, resource meters, delegated owner/active and the Relay operator's 20 displayed links. Screenshots are retained with the private logs.

Read-only chain authority lookup confirmed the API service key satisfies Relay operator and cannot satisfy Relay or Fees active. A free creation order executed under operator in `compute_transaction`; its reference was absent afterward and Fees balance was unchanged. This created no live dummy DAO, account or order.

Documentation validation scanned 203 Markdown files across the three active repositories and runtime instructions, with 553 local references and no missing targets after excluding code examples. Current operator/user guides and repository indexes describe the installed state; historical evidence keeps its original deployment/version context. Generated help remains unchanged because its portable service-migration guidance still applies.

The simulation endpoint accepted a declaration of active even when that key could not satisfy active. `compute_transaction` alone therefore does not qualify signature authority. `get_required_keys` qualifies declared authority satisfaction, but does not establish an action's minimum permission. The [136 signed native permission cases](../operations/project-audit-remediation-verification.md) cover actual transaction rejection, minimum permissions, independent dummy DAO/users and quorum enforcement. No unauthorized write probe was broadcast on testnet.

## Remaining boundaries

Hub and Names are outside the API's module-catalogue expected-hash map; their status `verified` fields remain false with no expected hash. Direct deployment preflight and final chain read-back matched their actual compiled pins. The older core creation-rate observation remains stale; the separate Names observation is fresh and its public quote checks passed. This rollout does not change those distinct rate policies.

Unchanged HAProxy provides no trustworthy visitor IP. Anonymous visitors share aggregate route protection; authenticated account limits remain in place. Actual provider login/payment ceremonies and production load/soak qualification remain unrun. Full source verification results are recorded separately; the rollout adds live checks without claiming those external release gates are closed.
