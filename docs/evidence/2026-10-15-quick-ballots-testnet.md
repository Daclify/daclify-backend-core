# Quick ballots testnet delivery — 15 October 2026

Quick ballots is available at <https://testnet.app.daclify.com/quick-ballots>. The API advertises `quick-ballots-v1`; discovery reports `available: true, experimental: true`. DAO executives enable the module through Modules before creating a ballot. Existing DAO permissions remain explicit; launch did not silently enable it in other communities.

The immutable deployed source cohort is core `c5a9c77`, modules `d346582` and frontend `911153f`. Versions are core 0.15.0-alpha.29, modules 0.10.0-alpha.39, frontend 0.15.0-alpha.40 and community MCP 0.1.0-alpha.19. Later documentation-only delivery commits do not change those executable sources. SDK/core/modules tarballs, starter and MCP bundles retain their original immutable bytes. Current and previous starter downloads were retrieved successfully after cutover.

## Native deployment and resources

| Contract | Role | Current code SHA-256 |
| --- | --- | --- |
| `daclifycore1` | Existing runtime upgrade | `e40c7854b7354df2147097ccf2e63a4e8b6cd94f10d90427865a62458b484843` |
| `daclifyqauth` | Canonical account authorization | `d2c7102b79cccb2ca020a071cf46c53da825f4ac86dde8b8264fab3a767db953` |
| `daclifyquick` | Encrypted Quick ballot source | `c54fb4ff71c159c60d6d0bc461d8f5a1185d564995f9cf07590fb48a27fb75dd` |

Transactions were simulated before broadcast and confirmed irreversible afterward. Both new accounts delegate ownership to the existing runtime's active authority; API/operator private keys did not become their owners. Narrow runtime/companion `execctx` and relay `operator` action links were added. All nine existing contract accounts' original authorities were compared and preserved. All six existing module binaries and raw ABIs remain identical. Original protected packed rows, including DAO/member/executive, document, ballot/vote and activity records, were compared against the preflight snapshot and preserved.

The live runtime had no RAM observer. Its old binary rejected the supported six-source migration in read-only simulation with `RAM_MIGRATION_SOURCE_LIMIT`. After upgrading to the qualified runtime, bounded `beginram`/`adoptram`/`scanram`/`sealram` completed for all eight existing DAOs and six sources. Existing DAO quota switches were preserved. Previously unused module bindings were initialized without replacing code or authorities. Stale lifecycle hashes were refreshed to the exact unchanged installed binaries.

The source/auth accounts received 12 MiB/4 MiB of physical RAM and the runtime 2 MiB additional headroom. Exact resource receipts total **1,096.1234 testnet TLOS**, including 14 TLOS staked for CPU/network. This spent the authorized testnet creator's resources, not DAO treasury funds. Backed Quick pools and 262,144 activity + 32,768 completion bytes were allocated to each existing DAO. Existing quota policies remain in effect; this is not a claim that quota enforcement was switched on everywhere.

The native archive policy uses the existing restricted relay, a 90-day minimum archive retention and enabled source pruning. Ordinary poll/document approval restrictions and provider deletion settings remain intact. Quick row eligibility still independently requires closure plus 30 days, complete source coverage, fresh primary retrieval, encrypted-backup restoration and native proof/availability checks.

## Actual live acceptance

Two synthetic accounts signed in through the normal public challenge/login API. An owned synthetic DAO was created through the normal free shared-hosting path, and its founder configured the executive group using the existing signed account action. No direct SQL insertion invented an administrator or membership.

- A public ballot accepted an account with no DAO membership. Two responses remained two after replacement, and one remained after removal.
- A selected-DAO ballot rejected that nonmember before signing, then accepted the actual member.
- Both ballots closed, froze their complete response sets and accepted actual public tally proofs. Their final totals are respectively 1 up/0 down and 0 up/1 down.
- The original reader decrypted its actual on-chain grant locally, verified every frozen encrypted row and independently verified the native final proof.
- Desktop 1440×1000 and mobile 390×844 browsers loaded the public page and verified the actual native result, without page errors or horizontal overflow.
- Existing DAO details, module state and documents returned HTTP 200. MCP initialization and tool discovery returned 200; an unauthenticated DAO tool call returned 401 with its OAuth challenge. The current MCP release and both current/previous starter manifests returned 200.

The synthetic DAO is `5281397675080092127`; the public and selected ballots are `8253074044138851613` and `4006222471198913764`. They contain no real community votes or personal profiles. A separate short-deadline live ballot, `11019100144302026168`, closed exactly at its deadline, was prepared automatically and accepted its empty-result proof.

## Recovery, rollout and limitations

A private PostgreSQL dump was restored to an owned local clone before deployment. Migrations 052–055 applied while all 91 preexisting tables' original records remained identical. No workers ran on the clone and the source database was untouched by that drill. The source API subsequently applied those same immutable migrations normally. The owned test/restore PostgreSQL instance on port 56415 was stopped after qualification; the live database was left running.

A fresh version-29 TLS key-service snapshot drill stopped the source service, restored a separate owned Raft instance and recovered the original test key. Four restricted-token operations were denied and plaintext/token exclusion from audit logs passed. The source recovery service was restarted and remains healthy. This is explicitly **testnet single-host recovery**, not independent-host production qualification. Its version-bound qualification expires **21 October 2026 at 15:42 UTC**; renew it with a fresh actual restore before a later API restart. Do not grant the API access to operator initialization shares merely to automate renewal.

Actual Pinata uploads and byte-for-byte retrieval passed for a small public encrypted qualification fixture. An authenticated AES-256-GCM copy on protected operator ext4 storage restored without the primary provider or original SQL client. Only the exact owned qualification pins were removed afterward. The backup is outside Pinata's provider failure domain but remains on the API host; simultaneous loss of that host and Pinata is not covered. Backup keys and files stay outside source and public artifacts.

The upgrade simulation caught the chain's 1 MiB decompressed-transaction limit when code and ABI were combined. Deployment used a separately bounded runtime-code transaction followed by its ABI/configuration update. The first API start also exposed a missing nested MCP dependency directory in staging; the directory was copied and service startup then passed. A read-only import check of both the staged API server and nested MCP HTTP module then passed without starting workers; include that check, in addition to the build, before future cutovers. This caused a brief API interruption; subsequent public reads and browser checks passed. Static publication retained prior hashed assets and replaced the entry point atomically. Private code/ABI, SQL, service configuration and frontend-entry rollback material remains in the operator workspace.

The source qualification is detailed in the [implementation record](2026-10-15-quick-ballots-implementation.md); the additional seventh-module configuration regression passed with 13 focused tests and strict TypeScript. The production/package qualification gate remains refused rather than being relabelled as passed.

This launch does not qualify a new real wallet GUI approval, an elapsed 30-day public cleanup cycle, independent cryptographic review or mainnet. Native cleanup boundaries use explicitly labelled owned calendar fixtures; live provider/backup qualification is separate. Current operator checks and public transaction identifiers are in the [machine evidence](2026-10-15-quick-ballots-testnet.json).
