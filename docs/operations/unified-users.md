# Unified Users and DAO activity upgrade

Core/frontend `0.13.0-alpha.4` and modules SDK `0.9.0-alpha.20` add the public directory projection and authoritative member activity. The five module contract binaries remain `0.9.0-alpha.5` and do not need redeployment. The Hub still registers deployments; this change creates no global identity registry.

## Data and compatibility

Existing `members` and `profiles` layouts, IDs, credentials, signing domains, treasury rights and permissions stay intact. `memberacts`, scoped by DAO, contains `{member_id,last_active}`. Enrollment reserves a constant-size row with zero time. Successful authenticated native, signing-key, scoped-session or EVM instructions update it, including installed module actions. A failed transaction rolls back the nonce and timestamp. Administrative calls and sign-ins are excluded.

Initialize old members with root governance through `initactivity(dao_id,after,limit)`, with at most 50 members per call. `after` is an inclusive member-ID lower bound. Resume with the next member ID; initialization is idempotent and preserves nonzero timestamps. Old members without a row may still execute their actions without allocating activity RAM on an exit path. Missing/zero activity remains unknown; there is no historical backfill.

The activity table is a metered scoped family and participates in bounded RAM migration. An observer-enabled deployment needs its exact runtime pin reviewed and rebound; the testnet preparer refuses an existing observer rather than silently bypassing its guard. Initialize legacy rows before enabling a new quota/migration, and budget their real row/table-header RAM. Activity updates themselves consume no additional physical RAM, verified on an owned native chain.

`GET /v1/people/members` retains its bounded cursor and adds nullable `identityKey` (SHA-256 of the public signing key) and `lastActive` (chain seconds). `daoId` plus `memberId` performs an exact public lookup with no continuation. Older response decoding supplies null fields conservatively. Only the specifically absent old activity table is treated as unavailable history; other RPC failures remain errors.

The SDK `unifyPublicMembers` groups the same native account or current signing identity within a chain/runtime, keeping all memberships and maximum known activity. Distinct native accounts sharing a key stay separate, and ambiguous unpaired rows cannot attach to either. Similar names/contact details and private service-account pairings never establish public identity. Rotated, unpaired keys may still produce separate cards. Published profiles remain editable at their original membership; selecting a representative profile does not merge or overwrite profile records.

## Testnet preparation

Run `npm run prepare:unified-users -- .artifacts/unified-users-testnet-review.json` for the unsigned seven-action proposal, or add `--with-ram` to prepare the RAM-funded eight-action proposal. This reads chain state and writes a private review file; it never signs, broadcasts or restarts services. It requires the reviewed alpha.3 runtime baseline, matching Hub registration, absent RAM observer and bounded complete membership reads.

At the 2026-10-11 preparation, four DAOs each had one existing member. The seven actions are runtime `setcode`, runtime `setabi`, Hub `regdeploy`, and four bounded zero-time initializations. The baseline RAM quota was 10,208,621 bytes with 10,185,526 used.

The current workspace compiler policy requires pinned CDT `-O=s`. The candidate WASM is 869,764 bytes, versus 1,019,165 for the initial unoptimized Users candidate (14.66% smaller). Its readonly seven-action simulation executed successfully without buying RAM: 27,693 μs CPU, 27,205 NET words, and -1,431,041 bytes net root RAM. The deployed alpha.3 baseline is distinct from that initial development candidate. Earlier unoptimized simulations and their proposed 3.7517 TLOS RAM purchase are superseded; the current packet contains no token transfer or RAM purchase.

These are simulation observations, not a broadcast or a permission proof. Native signed tests separately cover actual authority, partial executive quorum rejection, legacy upgrades, failures, replay, R1 sessions, EVM consent/governance and module dispatch. The optional `--with-ram` preparer mode remains an explicit proposal for deployments needing resources: it targets 64 KiB using an exact TLOS `buyram` quantity derived from the market and capped by the preparer at 4 TLOS. The transaction cannot spend more than its specified quantity. Reprepare/review when the market, source bytes or baseline changes.

Candidate runtime code SHA-256: `2733a5295dd72580c43622346ec3db8d93e9315a3e2febff929e895b30f687f5`.

Candidate raw ABI SHA-256: `7c4c309b9a564d3abae1aac7a369cb5a47fd9d0549ebf720e0764ce2c70554c3`.

## Approved cutover sequence

1. Obtain express approval for the reviewed runtime/ABI/Hub/activity actions, any RAM purchase, and the API/frontend/oracle cutover. Source commits and tests do not grant it.
2. Confirm exact source/package hashes, unchanged approved authority, available executive quorum, current code/ABI and sufficient resources. Freeze a new immutable Names-oracle source snapshot using the candidate runtime pin; retain the old snapshot for recovery.
3. Apply the approved transaction, confirm irreversibility, and verify root code/raw ABI, Hub pins, existing membership/profile/financial rows and four zero-time activity rows. Authorities and balances must match the approved changes; only the explicit RAM purchase may move tokens.
4. Cut over the API, published frontend build and immutable oracle snapshot together. Keep the old frontend assets and service evidence. Do not change HAProxy.
5. Verify public network/health/member responses, all four DAO memberships in Users, profile/DAO links, explicit unknown activity and a scheduled oracle run. Record receipts and resource measurements. A new member action must be explicitly authorized if a live write probe is desired.

Public service code remains alpha.3 until this new rollout is approved. Existing oracle operations use its archived alpha.3 source and must not be switched prematurely.
