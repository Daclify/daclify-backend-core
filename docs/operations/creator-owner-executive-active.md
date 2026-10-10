# Creator recovery and executive active ownership

Ownership policy 2 is introduced in core/SDK 0.13.0-alpha.1. Its configured creator is the native recovery authority, not an internal Daclify member ID or a copied public key. Testnet uses the user-confirmed `3boidanimus3@active`.

Testnet was handed over on 2026-10-10 with `3boidanimus3` as its sole initial executive. Quorum remains configurable, initially 100% / 1 of 1. See the [deployed authority and transaction evidence](../evidence/2026-10-10-native-ownership-testnet-rollout.md). The original unsigned preparation packet is now stale; the preparation command correctly refuses an existing native policy.

The runtime owner contains only creator@active, threshold 1. Runtime active contains each eligible paired executive@active at weight 1 and runtime@eosio.code weighted to the configurable quorum. Code can maintain active while owner stays with the creator. A creator who is also an executive retains an owner recovery override; quorum does not restrict that owner. Creator active currently includes the shared bootstrap key, so this change does not remove that transitive recovery path or rotate the creator's keys.

Each explicitly managed contract delegates owner and active to runtime@active. Its own eosio.code is added to active only for inline senders. Core upgrades require active. Managed code/ABI upgrades require owner, so their own operational code cannot upgrade itself, relax that owner link or unlink it. Hub receives no own-code grant. Testnet's five modules and Names receive theirs. Relay and Fees have no deployed code and remain separate settler/treasury accounts.

## Prepare and review testnet

Build the changed contracts and matching generated SDK, then run:

```sh
npm run prepare:native-ownership -- .artifacts/native-ownership-testnet-review.json
```

The command reads the committed public testnet profile and bounded RPC responses. It never reads deployment keys, signs, broadcasts, calls a wallet, changes an authority or moves funds. It refuses an existing native policy, incomplete permission metadata, unrestricted `eosio.any` links, an unexpected context authority or conflicting action links. It verifies the locally compiled WASM/raw ABI against the SDK hashes. Its output is a local development review artifact; immutable production release qualification is separate.

The packet includes chain/block/time, observed code/ABI hashes, public owner/active/permission-link snapshots, creator, exact managed inline roles, six service actions, existing executive policy/roster and an unsigned owner-authorized runtime upgrade + ABI + missing-link repairs + setup transaction. Output files must not already exist. Review the complete action list against the current authorities and deployment state before any signing.

When executive policy or offices are absent, the preparation command leaves `unsignedHandover` null and `handoverReady` false. It does not choose internal members or invent wallet bindings. Configure the API bootstrap signer to the packet’s service public key before handover. The API requires an exact code-free, key-only service authority matching its bootstrap signer and fails closed if it differs. Do not retain a creator/deployment key in that service role. Appoint the intended eligible members and obtain each incoming wallet consent through the actual on-chain linknative workflow before preparing handover. A separate paired wallet is required for each executive; ordinary wallet pairing grants no office. Existing valid bindings can be reused: testnet administrator member 1 was already paired to `3boidanimus3`.

The testnet service key is the existing relay key. Order-backed DAO creation declares runtime@service and relay@active authorization, but signs once when both authorities accept the same key. Distinct signing keys still receive separate signatures. Native chain validation rejects duplicate signatures for a shared key.

Names automatic price refresh is paused after handover. The old `names-rate.ts --apply` timer used the API bootstrap key as runtime active; the restricted service key cannot authorize `daclifynames::setoracle` or `setprofit`. Both actions currently require executive active approval. Generate unsigned updates with `DACLIFY_ENV_FILE=/data/daclify-env/testnet.env npm run price:names -- testnet` and obtain the required native executive signatures. A separate automatic observation permission needs an explicit follow-up design: `setprofit` also changes pricing policy, so granting the service that entire action would grant more than observation updates. Re-enable `daclify-names-oracle.timer` only after its authorization path is resolved and verified.

Once the reviewed runtime is deployed and setup is confirmed, use the public SDK `assertNativeOwnershipRuntime`, `nativeOwnershipAccount` and `nativeHandoverActions`, or the Executive settings UI. The runtime must match both the exact reviewed WASM and raw ABI hash. Read raw account metadata before canonical decoding; the pinned WharfKit model omits eosio.any links. The planner requires the runtime and every managed account, valid owner/active parents, no unexpected permissions or preexisting temporary code grants, and a code-only execctx with all core action links. It returns temporary owner staging and final handover in one action array. Never split or broadcast staging separately.

The UI shows creator, effective q/n, wallet accounts, managed inline roles, service scope and upgrade policy. It refreshes chain identity, release pins, nativegov, executive state and account snapshots before downloading. The final handover action binds governing DAO, creator, policy version, executive signers, quorum threshold and executive policy revision. The contract rechecks that snapshot and service-key independence; any failure rolls back the entire transaction. Re-read state again before external owner/quorum signing.

## Existing native ownership policies

The nativegov row retains its old serialized fields and appends optional versioned ownership metadata. An old row remains readable after upgrade. The new contract refuses native controller changes for missing/unsupported policy metadata and leaves existing authorities intact; it does not silently migrate govern into active. For that governing DAO, member instructions are frozen except withdrawal and unstake; already approved public settlement callbacks remain usable. A deployment already handed over under the old policy needs a separate explicit reviewed migration and must not run this new setup command unchanged.

## Qualification

See the [native test recipe](native-permission-tests.md) and [dated implementation evidence](../evidence/2026-10-10-creator-owner-executive-active.md). Native nodes use the real compiled contracts, distinct dummy users and DAOs, strict permission features and genuine expiry/election deadlines. HTTP browser fixtures check UI behavior; they do not prove live wallet or multisig integration. Telos system resource pricing, providers, external custody and production rollout remain separately qualified.
