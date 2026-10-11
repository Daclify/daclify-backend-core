# Telos governance entry

The public `/telos` page brings Telos holders into Daclify through retained proposal and election records and native-wallet voting. It reads `telos.decide` directly on the operator's configured Telos Zero network, using the standard `4,VOTE` treasury. No Daclify DAO needs to install a module to provide this entry.

## Holder experience

Browsing creates no account. Records appear in contract order, 25 source rows at a time; Open and History filters apply to the displayed page. Other treasuries and categories are skipped while preserving the continuation cursor. Closed and archived records show stored option totals. A ballot whose voting period ended while its status remains `voting` is labelled Awaiting closure. Deleted records and cleaned vote receipts are outside this history.

Each record identifies its publisher. A public VOTE ballot is not automatically an official Telos election or proposal. The page displays contract option names when richer candidate information is unavailable. HTTPS content links open separately; ballot metadata is rendered as text.

Vote with Telos Zero opens Anchor and requests a fresh, purpose-bound account proof. Continuing creates a wallet-only Daclify account and verified native pairing, or reuses the existing pairing and preserves its vault keys. Cancelling the subsequent vote can leave the account created. Existing users should pair the native wallet in Account first if they want to retain an account opened through another method.

The wallet then reviews the external ballot transaction. A new Decide voter registers and casts atomically; a registered voter casts directly. Supported methods are `1token1vote`, `1tokennvote` and `1acct1vote`. Light ballots and other methods stay read-only. The native account's authority and Decide's rules govern the vote. External voting creates no Daclify membership, credits or private-document keys.

The app reads the balance used by the ballot from Decide's voter record. Standard VOTE stake is synchronized with external TLOS stake and REX by the contract; an existing registered voter may need to refresh that record in the Telos app after staking changes. Daclify does not recompute or silently refresh it. See [Telos voting documentation](https://docs.telos.net/zero/governance/decide/voting/), [ballot rules](https://docs.telos.net/zero/governance/decide/ballots/) and the [contract implementation reviewed here](https://github.com/telosnetwork/telos-decide/tree/64d3f256fb965415f718af2409129c863b6cf229/contracts/decide).

After voting, Explore other DAOs opens the Hub. Account and key setup uses the existing encrypted-vault attachment path for new Daclify memberships and private content. Returning native login works before joining a DAO. Existing recovered wallet-only profiles retain their current-membership recovery requirement.

## Operator setup

Deploy the matching core, module and frontend development versions together. Apply core migration `039_native_signup.sql` through the existing coordinator. The reader uses the service's native chain ID/RPC and `telos.decide`; requests cannot choose a remote RPC, contract or chain. A testnet service reads testnet. Mainnet voting needs a mainnet Daclify service and its existing authentication runtime.

Reads remain available without signing pins. To enable compatible ballots, configure both `TELOS_DECIDE_CODE_HASH` and `TELOS_DECIDE_ABI_HASH` after reviewing the deployed contract and its ABI. Both are lowercase 64-character hashes. Missing or changed pins disable signing; an upgrade requires fresh review and configuration. A live observation of a hash is not release qualification.

Public routes are producer-owned in `@daclify/modules`: list, detail, voter state and vote preparation under `/v1/telos`. Core hosts rate-limited reads and a bounded RPC transport with a 10-second timeout, 256 KiB response cap and refused redirects. Preparation never signs or broadcasts. The frontend verifies live chain identity, pins, voter state, ballot rules and the exact wallet transaction again after approval.

## Confirmation and qualification

The page records the signed transaction ID when the broadcast response is uncertain. A pending reference blocks another submission for that ballot and persists in tab session storage. Confirmation checks the same chain's transaction-status API for irreversibility without resubmitting. Providers without transaction-status tracking require checking the reference through a compatible external chain service. Closing the tab removes its session-storage reference.

The implemented wallet path initially supports Anchor and direct-key `active` authorities. Real signature/database tests and HTTP browser fixtures cover the flow; they do not qualify a live Anchor client or mainnet voting. Production deployment and real wallet transactions require operator qualification and user authorization. Block-producer voting, election creation, historical indexing and a publisher endorsement registry remain outside this entry.

See [implementation evidence](evidence/2026-10-11-telos-governance-entry.md) for exact versions, checks and limits.
