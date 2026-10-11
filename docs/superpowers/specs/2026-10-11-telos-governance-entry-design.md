# Telos governance entry and wallet onboarding

Date: 11 October 2026, Atlantic/Canary. Status: approved for inline implementation by the user's “ok do it”. The user has selected contract-loaded election history and currently open ballots, native Telos Zero voting, and automatic Daclify account pairing during the voting journey. The integration is implemented in development source; [verification evidence](../../evidence/2026-10-11-telos-governance-entry.md) records its qualification limits. Production deployment remains outside this authorization.

## Intent and established scope

Provide a public Telos governance entry inside Daclify. Telos holders arrive to participate in existing network governance and leave with a reusable Daclify account. The Telos area has its own ballot source and voting rules while remaining connected to Daclify's account system and discovery.

The user wants no additional community activities in this area. Existing proposals and elections, their retained history, and live voting are the purpose. Past elections are discovered from smart contracts; individual elections are not manually entered by Daclify administrators. The user explicitly accepted including currently open ballots for voting.

Automatic pairing means verifying control of the native account and creating or reopening its Daclify service account. A wallet connection, publicly visible previous vote, or caller-supplied account name is not proof of control. The native account remains the voting identity recognized by Telos.

## Implementation choices

These are design calls, not additional requirements stated by the user:

- Start with the existing `telos.decide` ballot service and the standard `4,VOTE` treasury. Include retained proposal and election categories supported by the verified deployed contract. Block-producer voting through `eosio` is a separate mechanism and is outside this first integration.
- Present a dedicated Telos governance entry reachable from discovery. Treat its external contract reference as an external-governance reference, not a Daclify runtime/DAO reference. Do not register `telos.decide` as if it implements Daclify's runtime or module ABI. An ordinary Daclify DAO contract, paid setup order, treasury, or member enrollment is not necessary to cast these external votes.
- Use existing Anchor/WharfKit integration first, with the native proof verifier's currently supported direct-key `active` authorities. Account-delegated authorities and waits are rejected by that verifier and are outside initial support, even if the Telos contract could accept their votes through another interface. Other native wallets/authority forms can follow their own qualification; EVM and social credentials do not authorize Telos Zero ballot actions.
- The first Vote journey provisions a wallet-linked service account after a fresh Daclify authentication proof and before the ballot transaction. A cancelled or rejected vote can therefore leave a usable account. Cancellation before successful authentication creates no account. Repeated attempts reopen the same account.
- Start a new user with the existing wallet-only profile representation. Offer normal Daclify key setup when the user chooses to join or create another DAO. Do not put that setup, an email signup, or a vault password ahead of a Telos vote.
- Browse retained contract state in the first release. A full historical backfill from a chain-history provider is a later capability, with coverage made explicit from the beginning.
- Support browsing, voting and contract-permitted changes to a vote. Creating/publishing new proposals or administering elections is separate scope; this entry does not confer publisher or network-governance authority.

## Public browsing and ballot details

Visitors can browse without an account or wallet. Show open ballots and retained history, with proposal/election filtering. An election detail includes its original ballot identifier, publisher, title and description where present, option identifiers, linked candidate/proposal material where available, voting method, selection limits, opening/closing dates, contract status and recorded tallies. Missing titles, candidate biographies or deleted records are represented as missing rather than supplied by inference.

The stable ballot identity is the complete native chain ID, Decide contract account and ballot name. Treasury precision/symbol is checked as part of source selection; the string `VOTE` alone is insufficient. Configuration supplies trusted chain and contract identities. Each ballot is discovered from those contracts and carries its source reference.

All displayed text, links and content are untrusted. Use the existing safe content renderer and external-link policy. Do not execute ballot content or fetch arbitrary publisher URLs with backend credentials. Linked content can be mutable or unavailable; show that distinction instead of claiming every biography is immutable on chain.

Use the contract's actual statuses. A ballot with a passed deadline and status `voting` is awaiting closure, with provisional recorded totals; a deadline alone does not establish a final result. Closed/archived ballots can show their recorded final tallies. Do not infer a proposal's official pass/fail status or an elected seat holder merely by choosing the largest tally. Show a winner or implementation outcome only when the authoritative governing record and its interpretation are verified.

The standard treasury is public: a ballot using `VOTE` is not by itself evidence of official Telos endorsement. Display publisher and treasury for every entry. The first release describes records as Telos governance ballots and assigns no blanket Official badge. Any later official classification must have a verified source and rule, without making ordinary record discovery depend on a curated election list.

Current-state reads cannot guarantee every historical ballot or individual voting receipt survives. State the coverage as records retained by the configured contracts. Cleaned voter receipts do not prevent displaying retained aggregate results. Light ballots must not be represented as having a complete on-chain list of individual voters. If retained history is empty, distinguish that result from an RPC failure.

## First voting journey

1. The visitor opens an eligible-looking active ballot and chooses Vote. Public browsing has made no service account or membership record.
2. Connect their Telos Zero wallet on the configured chain and explain that continuing creates or opens a Daclify account paired with that native account. Use the current supported native permission and proof-verification path.
3. Complete a fresh, browser-bound Daclify authentication challenge. Bind chain, account, purpose, origin, audience, expiry and one-time challenge consumption. Create/reuse the paired service account under the existing transaction and unique-credential constraints. An ordinary Telos holder need not already belong to a Daclify DAO.
4. Refresh the ballot and voter state. Read registered treasury membership, current voting weight, permitted selections, dates, revoting setting and existing vote where retained. Display the weight as contract-defined `VOTE` power; do not independently replace Telos's accounting with a Daclify balance calculation.
5. Build only the required ballot actions. If the voter is unregistered, include the supported `regvoter` action for the exact treasury before `castvote` where the verified contract permits this atomic transaction. Existing registration is reused. Unsupported methods/settings remain browseable with voting unavailable and an explanation.
6. Show the selected account, ballot, options and relevant resource requirement, then obtain the wallet's explicit vote signature. Broadcast the expected transaction to the configured chain and reconcile its execution/finality. Registration and the vote use the user's native authorization.
7. Show confirmed vote status and the continuing Daclify session. Offer Explore other DAOs; do not automatically enroll the user in unrelated DAOs or give them Daclify governance credits.

Authentication and voting are separate signing purposes even when presented as one journey. Do not promise a single wallet approval until the actual supported wallet flow has been qualified. A publicly visible historical vote is never an authentication credential, and a login proof never authorizes a ballot vote.

Membership in the Telos area or another Daclify DAO cannot gate an otherwise eligible native Telos vote through a supported wallet/authority. Unsupported authority forms get an honest capability explanation and a link to the existing Telos voting interface; do not imply that Telos itself rejected them. The existing Telos contract owns registration, weight, vote changes and outcomes. Votes cast through another compatible interface remain the same native account's votes. Daclify must neither duplicate their weight nor cast from a backend-controlled account.

## Account reuse, recovery and next-DAO entry

Reuse an existing pairing to preserve the account ID, original vault, recovery policy and other paired methods. Do not reset keys or automatically merge service accounts. If the wallet belongs to another account while a different Daclify session is open, require the existing account-switch/pairing rules rather than silently rebinding it. Explicitly pairing an unpaired wallet to a signed-in account still requires existing-account authorization and incoming-wallet proof.

New wallet-only profiles need a deliberate provisioning path. The current `walletAccount` recovery path requires an existing usable pairing or discoverable Daclify membership; blanket removal of that recovery check would change unrelated native/EVM recovery behavior. Implement new native signup through a separately identified intent or otherwise explicitly bounded path. Authenticate and rate-limit it, reuse the native-link uniqueness/account lock, and record signup as signup rather than pretending it is recovery of an old member. Persist an explicit distinction between a freshly provisioned wallet-only profile and a recovered membership: it is needed for truthful help and correct subsequent-login checks, not additional voting power. The implementation plan chooses its minimal schema and migration.

A wallet-only account has no Daclify signing/encryption vault. It can browse, sign in with its paired wallet and use the Telos integration. Joining/creating new Daclify DAOs follows their normal admission and key-setup requirements. The existing wallet-confirmed vault-attachment flow supplies new keys without changing the service account or implying that old private content can be decrypted. Existing wallet-only recovery messaging must distinguish a new profile from a recovered membership without falsely telling every new voter they lost document keys.

Do not automatically enable Daclify-assisted recovery or retain native private keys. Wallet loss follows the native account's recovery rules. Optional future Daclify methods use the existing explicit pairing/recovery consent model.

Newly provisioned wallet-only profiles must remain able to authenticate on later visits even while they have no Daclify membership and have not attached a vault. Preserve the stricter checks required when reconstructing memberships after service-data loss. A service-only new profile has no on-chain Daclify member record to rediscover after loss of its account database; follow the existing backup policy and do not claim otherwise.

## Data and integration boundaries

No new C++ voting engine, native token, stake pool, secondary index or per-vote Daclify receipt is required by this scope. Do not deploy or modify Telos governance contracts. Daclify's ordinary Decide module continues to govern Daclify DAOs under its existing identities and rules.

Use bounded paginated native RPC reads, verified chain identity and the deployed ABI/table layout. Preserve source status, observation time and pagination/coverage metadata. Contract-order pagination is acceptable initially; ordering and filtering must accurately describe the records loaded, without pretending a partial scan is a complete chronological archive. Measure scan cost and available native indexes before adding a projection/cache. Do not scan unbounded tables or allocate unlimited ballot history inside a request.

Recheck live ballot state before signing. Changed options, account, chain, source contract, expiry or navigation context invalidate an existing prepared vote. Pin approved contract code/ABI compatibility in the adapter release/configuration; an unsupported upgrade disables signing until reviewed while safe retained browsing can remain available. The absence of code-to-source verification is not a claim that GitHub master is the deployed WASM.

The frontend must verify the resolved wallet transaction exactly matches the intended action list, authorization and chain, using the current no-modification pattern. There are no background vote signatures, automatic staking transfers, general relayer authority, or new permission delegations. A service/indexer observation is a display/reconciliation input, not an authorization to vote.

| Owner | Required work |
| --- | --- |
| Backend core | Native signup/session and existing-pairing reuse; distinct fresh/recovered wallet-only profile semantics; guarded new-key attachment; existing module-host and versioned shared interfaces |
| Backend modules | Named Telos Decide adapter; producer-owned external ballot/action schemas and pinned ABI; bounded reads and live-state validation through published host capabilities |
| Frontend | Public Telos discovery entry, external ballot history/details and vote journey; reviewed first-party UI; existing native signer integration; signup notice and next-DAO key-setup routing |

Use current repository patterns and pinned producer-owned public artifacts. The implementation plan decides exact files, API names, schema versions, row limits and read strategy after checking existing host capabilities; this design invents no current endpoint. Any service migrations belong to their owner and use the existing coordinator and supported-upgrade policy.

## Failure and retry behavior

Separate service-account creation from the external chain transaction. They are not one atomic operation. Once a pairing has been created, a cancelled or failed vote retains it and retries reuse it. A successful on-chain vote remains successful even if Daclify account/session coordination subsequently needs recovery; never report that deleting a service record could undo it.

Wallet rejection, wrong network, unsupported permission, expired proof, closed ballot, zero weight, unavailable resources, malformed RPC data and provider outage have distinct useful states. If a broadcast response is lost, retain the signed transaction ID and reconcile it before proposing another vote. Do not show success from a button click, signature alone or an optimistic cached tally. Vote changes follow Telos's actual rules and require new explicit signing.

## Acceptance and rollout

- Public history/open-ballot browsing works with no service session; unrelated Daclify DAO membership is unnecessary. Retained results, empty history, unavailable data and pending closure are distinguishable.
- The adapter handles arbitrary option identifiers, supported election selection methods, treasury precision, revoting settings, cleaned receipts, light ballots and pagination without fabricating candidates, official status, winners or full history.
- A first-time Telos holder with no Daclify membership can authenticate, receive exactly one paired account, return on another visit and cast a real native ballot vote. Concurrent/repeated attempts reuse the same account; an existing pairing preserves its vault and policy.
- Invalid/replayed/wrong-origin/wrong-audience/wrong-chain proofs, account-switch races and attempted pairing takeover fail. Generic native/EVM recovery and existing account-entry flows retain their authorization rules.
- Required registration and casting reach the exact external contract/ballot/account. Modified wallet transactions, stale ballot preparation, unsupported contract upgrades, unauthorized selection and backend-originated voting fail. Contract-defined weight is preserved across other voting interfaces.
- Lost responses, vote cancellation and vote rejection do not duplicate accounts or mislabel execution. Account and vote failures reconcile independently.
- The new user can continue into normal Daclify key setup for another DAO using the same service account. No automatic membership, duplicated member identity, silent custody change or fake historic private-content recovery occurs.
- Run meaningful schema/adapter, PostgreSQL/authentication, real-signature, browser and supported-upgrade regressions, plus producer generation/consumer compatibility checks. Qualify actual Anchor behavior and the external contract on a local/testnet fixture separately from mocked providers. Live mainnet reads establish observed state only; they do not qualify native wallet signing or deployed code equivalence.

Deliver version-matched public API/module artifacts, explanatory help, complete check results and a release manifest. Use local/testnet contract fixtures before enabling public signing. This design authorizes no production deployment, actual user account creation, native authority change, asset movement or live ballot transaction. Any newly compiled fixture preserves applicable historical flags/hashes or uses the pinned current CDT with `-O=s`, as required by workspace policy.

## Evidence and limits

Read-only research on 11 October 2026 obtained Telos mainnet chain identity and the `telos.decide` ABI, standard treasury and retained sample ballot rows. The observed standard treasury describes `VOTE` as reflecting an account's staked TLOS. Sample rows establish available fields/settings, not official status or comprehensive historical coverage. No wallet transaction, complete retained-history inventory, source-to-deployed-WASM equivalence check or mainnet integration test was performed.

Primary references: [Telos Decide overview](https://docs.telos.net/zero/governance/decide/), [ballot fields/settings](https://docs.telos.net/zero/governance/decide/ballots/), [registration/voting](https://docs.telos.net/zero/governance/decide/voting/), [published vote implementation](https://github.com/telosnetwork/telos-decide/blob/master/contracts/decide/src/voter.cpp), and [published external-stake synchronization](https://github.com/telosnetwork/telos-decide/blob/master/contracts/decide/src/decide.cpp). Source is a reference, not an immutable release pin.

Repository evidence: `services/api/src/auth/native-routes.ts`, `services/api/src/auth/wallet-recovery.ts`, `protocol/native-wallet.ts`, frontend `src/auth/telos-zero.ts`, `src/components/NativeWalletPanel.vue`, and `src/views/Account.vue`. Existing wallet-only/key-attachment limits are documented in [upgrade 0.6](../../operations/upgrade-0.6.md). Follow the [master plan](../plans/2026-10-05-daclify-v2-master-plan.md), [architecture](2026-10-05-daclify-v2-architecture.md), and [release/docs/test policy](../plans/2026-10-05-daclify-v2-release-docs-test-policy.md).

Design reviewed inline under Ponytail Full and the brainstorming builder-check prompt. Workspace instructions prohibit sub-agent delegation. The user approved implementation after receiving the complete written design; proceed inline through the implementation plan without additional approval checkpoints.
