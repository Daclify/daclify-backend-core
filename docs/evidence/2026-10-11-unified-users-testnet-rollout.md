# Unified Users testnet rollout — 2026-10-11

The user expressly approved `.artifacts/unified-users-testnet-ready-review.json` and the coordinated API/frontend/Names-oracle cutover. Its SHA-256 is `070cf64e0674ffb2f8152f52fdb23a275faa1bc762f8ace0c8ec5a13a8caac11`. Fresh preparation matched all seven encoded actions, four memberships and runtime pins. This evidence covers Telos testnet; production qualification remains separate. See the [source checks](2026-10-11-unified-users.md), [upgrade runbook](../operations/unified-users.md) and [machine-readable live evidence](2026-10-11-unified-users-testnet-rollout.json).

## Irreversible transactions

| Operation | Transaction | Block |
| --- | --- | --- |
| Seven actions: runtime code/ABI, Hub hash refresh, four activity initializations | `6229ba2f9e6370dfdc231aba69de8a17122cf5fefc39edd8d9e1d1cce7e9d073` | 449620491 |
| Ordinary observation from the new archived Names oracle | `d0a4069f1d20f8c68ee60fba9dcc2a56809b6d6fe2bc189343135db66a2d91b6` | 449620675 |

The runtime transaction was accepted at 11:06:28 Atlantic/Canary and confirmed irreversible before read-back and service cutover. Its actual receipt recorded 35,176 μs CPU and 27,207 NET words. A fresh signed read-only simulation preceded broadcast. All seven actions declare the same `daclifycore1@active`; a bounded authority-only `get_required_keys` lookup confirmed satisfaction by the existing creator/executive signer. The native signed tests supply separate minimum-permission evidence; the RPC simulation alone bypasses those checks.

## Installed runtime and preserved state

Runtime code is `2733a5295dd72580c43622346ec3db8d93e9315a3e2febff929e895b30f687f5`; binary ABI is `7c4c309b9a564d3abae1aac7a369cb5a47fd9d0549ebf720e0764ce2c70554c3`. Hub registration now advertises those hashes while preserving its deployment ID, owner, chain, interface, metadata and listing. All nine other account code/ABI hashes and all ten contract-account authorities were preserved. Core creator recovery remains `3boidanimus3@active`, and its sole initial executive remains `3boidanimus3` under the existing configurable quorum.

The optimized WASM is **869,764 bytes**, versus 1,012,980 in the previously deployed alpha.3 runtime. Root physical RAM usage fell from **10,185,526 to 8,754,485 bytes**, freeing **1,431,041 bytes**. RAM quota remains 10,208,621 bytes. No RAM purchase or token transfer occurred; balances for the ten contract/service accounts and creator were unchanged. This rollout installs the reviewed CDT `-O=s` core runtime. Other contract binaries, including the five module releases, were not redeployed.

Before broadcasting, API writes and the oracle timer were paused, and 27 primary tables containing 52 existing rows were frozen. Binary read-back preserved all those records apart from the explicitly reviewed Hub hash fields. Four separate DAO-scoped activity rows were initialized with member 1 and timestamp zero. Zero correctly remains unknown; initialization does not invent a member action. The later ordinary oracle update changes its authorized observation fields only.

Private rollback binaries, snapshots, the exact approved packet, accepted response, signed authority evidence, browser logs and screenshots remain in `/data/daclify-runtime/unified-users-rollout-20261011/`. No private key or environment contents are included in the public evidence.

## Services and public journeys

API/core and frontend now run `0.13.0-alpha.4`, with modules SDK `0.9.0-alpha.20`. The already-tested frontend artifact was published with its entry point last, retaining old hashed assets. Concurrent unfinished resource-UI edits in the frontend checkout were preserved and excluded from this release.

The oracle runs from `/data/daclify-runtime/releases/oracle-alpha4/daclify-backend-core`, archived from core `2bc2227caf362c2057e7657fbea53e8d98a119ad` and modules `be8876ef719b58a39b5c9e061b46ca633e6eeb7f`, with the exact tested package hashes and lockfile. Its unchanged dedicated key and two-action oracle permission completed an irreversible observation. The API and five-minute oracle timer are active. HAProxy and private environment configuration were unchanged.

Read-only public HTTPS checks confirmed health, network, API/module versions, all four memberships, safe identity fingerprints and exact member lookup. The directory groups those memberships into three users; the same public signing identity in the two smoke DAOs appears once with both DAO links. No current member has published a profile, so fallback names/avatars remain and contact details stay absent.

Four live desktop/mobile browser runs passed: the Users/profile/list/search/DAO-link journeys and the existing Hub/status/resource/Names-quote/DAO journeys, each at 1440×1000 and 390×844. Users and profiles had zero accessibility violations or horizontal overflow. There were no browser errors, static-origin API calls or API server errors. The testnet network lock and fresh Names quote also passed.

## Boundaries

Historical ordinary-member activity remains unknown. No ordinary member write probe was broadcast; actual activity/authentication behavior is covered by the signed owned-chain suite. Different unlinked public keys can remain separate cards. Real private sign-in/payment ceremonies, production load testing and immutable production publication were not repeated or qualified by this testnet rollout.
