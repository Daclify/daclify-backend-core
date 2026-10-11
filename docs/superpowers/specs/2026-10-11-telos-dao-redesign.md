# Telos DAO redesign

The requested scope is a redesigned public governance page with ballots, retained Foundation elections and current block producer standings. The user selected both election types. Existing wallet pairing and Decide voting safeguards remain in place. Work proceeds inline under the established continuous implementation authorization.

Use the existing dark and amber design tokens. Show a Telos DAO heading, the connected network, three navigation choices (Ballots, Elections, Block Producers), readable record cards, open/history filters and a focused detail panel. Show candidate totals with relative bars and contract-defined selection limits. Identify `tf` as the Foundation publisher; other election publishers stay explicitly identified. Retained history is not a promise of a complete archive or future election schedule.

The deployed mainnet `tfvt........2` record in `telos.decide::ballots` is a `leaderboard`, not an `election`. Include VOTE leaderboard records in election reads and exact detail reads. Keep those records read-only until their signing path is separately qualified. Existing proposal/election voting eligibility is unchanged.

Add a bounded producer reader using `get_producers` and `get_producer_schedule` on the operator-selected chain. Preserve the RPC vote-weight order and label the active schedule separately from registration. Producer weights are contract vote weights, not a direct TLOS balance. Validate all RPC data and continuation cursors; safe HTTPS website links only. This addition does not introduce producer voting transactions.

New filtered ballot requests may scan at most four table pages and return at most 25 matching records. Stop at the first page with matches, retaining its continuation; this avoids dropping records. Empty filtered pages with a continuation must offer further loading and never claim the chain has no elections. Load-more appends records, preserves details, and ignores stale responses when navigation or network changes. Keep older unfiltered callers compatible.

Modules own the public schemas and readers; core hosts validated public routes; frontend consumes packed, pinned artifacts. No new service, database table, dependency, own contract or authority change is required. Existing testnet deployment authorization applies; production remains outside scope.

Evidence: [Foundation participation guide](https://medium.com/@TFGuardians/how-to-guide-participating-in-on-chain-guardians-elections-7f5581a543bc), live mainnet/testnet chain reads on 2026-10-11, [Decide source](https://github.com/telosnetwork/telos-decide/blob/master/contracts/decide/include/decide.hpp), and [system contract source](https://github.com/telosnetwork/telos.contracts/blob/master/contracts/eosio.system/include/eosio.system/eosio.system.hpp).
