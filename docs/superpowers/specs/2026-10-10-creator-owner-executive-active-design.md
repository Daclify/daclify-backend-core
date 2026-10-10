# Creator recovery and executive active authority

Status: implemented and deployed on testnet under separate user rollout authorization on 2026-10-10. This replaces the native authority tree in the [2026-10-09 specification](2026-10-09-executive-authority.md). The user selected configurable quorum, executive upgrades through active and `3boidanimus3` as the sole initial executive. See the [rollout evidence](../../evidence/2026-10-10-native-ownership-testnet-rollout.md). Production deployment remains separate.

## Intended behavior

The creator retains recovery control of the runtime owner. The governing DAO's eligible paired executives control runtime active using its existing configurable quorum. The seven other deployed contract accounts delegate ownership to runtime active. Ordinary DAO membership, browser login, service credentials and module execution remain separate from native governance.

For testnet, the committed creator is `3boidanimus3`, not the illustrative `3boidanimud3` in the request. The user confirmed this creator and the initial executive roster on 2026-10-10. Existing active administrator member 1 of platform DAO 1 was already paired to this account. The creator account has two keys in active, threshold one; ownership delegates to that account authority rather than copying a public key.

## Authority tree

Let `n` be the eligible, distinct executive account count and `q = ceil(n × quorum_bps / 10000)`. Existing controller/inactivity rules determine eligibility; default quorum requires all eligible executives. Both values must be nonzero.

| Account / permission    | Parent | Threshold and signers                                                                                      |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Runtime owner           | none   | Threshold 1; creator@active weight 1; no contract code or operator key                                     |
| Runtime active          | owner  | Threshold q; each executive account@active weight 1; runtime@eosio.code weight q; no operator key          |
| Runtime execctx         | active | Threshold 1; runtime@eosio.code weight 1; explicit member-action links                                     |
| Runtime service         | active | Threshold 1; reviewed service key; six existing creation/bootstrap links only                              |
| Managed contract owner  | none   | Threshold 1; runtime@active weight 1                                                                       |
| Managed contract active | owner  | Threshold 1; runtime@active weight 1; own eosio.code weight 1 only where the contract sends inline actions |

Managed contracts on testnet: Hub, Decide, Works, Payroll, Grants, Endorse and Names. Hub currently sends no inline actions and needs no own-code entry. The five modules and Names need theirs for callbacks, payouts and native account/resource operations. Relay and Fees have no deployed code and are excluded from this contract migration. Their configured settler/treasury responsibilities continue with their existing authorities pending a separate service-scope review.

Runtime code's weight must equal q. Weight one would prevent contract-only synchronization when q exceeds one. Giving code threshold weight allows reviewed C++ to synchronize authority without borrowing creator owner signatures. The runtime code therefore remains a privileged trust boundary, including its transitive control of managed accounts.

## Upgrade policy

Runtime setcode/setabi require active, as selected by the user; creator owner remains a recovery override. Managed-contract setcode/setabi are linked to owner as an implementation recommendation: that owner delegates to runtime active, so executive quorum still controls upgrades, while each module's own code cannot authorize replacing itself through its operational active authority. No module operator key remains in the migrated owner/active authority.

This does not make active immutable. Executives can update active, and permitted runtime code can maintain it. Creator recovery can restore active through owner. Runtime active must not be given authority to update runtime owner.

## Contract changes required

- Replace the current handover's final runtime-owner rewrite with creator@active. Do not use the existing handover transaction unchanged: it replaces owner with govern OR runtime code.
- Put the executive quorum directly in runtime active; synchronization updates existing active using runtime@active authorization. Existing C++ always sends updateauth with owner and currently synchronizes govern; both paths must change together.
- Managed owner delegates to runtime active; managed active preserves only the necessary own-code entry alongside that delegate. Use the configured inline-code roles, not an unconditional own-code grant to every account.
- Native executive appointment after handover uses active. The restricted service credential cannot appoint executives, upgrade contracts, alter owner/active or authorize treasury withdrawals through an unrelated link.
- Retain the existing governing-DAO restriction, delayed election activation, last-controller protection, paired-wallet consent, all-inactive fallback, stale signer/quorum/revision checks and atomic rollback. Do not change their persisted interpretation during this migration.
- Remove reliance on govern in the new tree. Never silently reinterpret an already handed-over legacy deployment; refuse it until an explicit reviewed migration is available. Actual testnet currently has no nativegov row. If an old native policy is upgraded, freeze that governing DAO’s member instructions except withdrawal/unstake until explicit migration; preserve public settlement of approved liabilities.

## SDK, API and UI changes required

The producer owns the new handover/setup plan and authority validators. Version changed native policy explicitly and regenerate ABI/schema/release artifacts together. Consumers use the released SDK rather than constructing owner/active authorities independently.

ExecutivePanel must replace the current govern appointment and old handover download with active quorum and the creator-recovery proposal. Before download, show creator, governing DAO, managed account list, executive accounts, q/n, service scope, current authority snapshot and upgrade policy. The owner signs setup/handover externally; later executive quorum operations use the native account signing/multisig workflow. An internal app signature or one native member's submitnat instruction cannot substitute for native quorum approval.

Status continues rendering actual accounts and configured relationships. It must show reported authority, not draw the proposed tree as though already deployed. The audit's unsigned link-only repair remains independent of handover.

## Migration and preconditions

First build and qualify the changed contracts on an owned native fixture. Reproduce both quorum > 1 and creator recovery. Publish matching immutable artifacts and qualify the UI/API before proposing testnet authority changes.

Prepare one owner-approved atomic handover using the current authorities. Any temporary code grants needed for inline owner updates exist only inside that same transaction. Preserve each current owner authority while staging; replace it only after the effective roster, quorum, creator, contract list, chain and policy revision pass checks. Final contract authorities must contain neither direct bootstrap keys nor temporary owner-code entries. Creator active currently includes the shared bootstrap key; delegation preserves its transitive recovery path until the creator separately reviews their own authority. Reject unexpected preexisting permissions or policy versions instead of overwriting them.

The creator/executive bindings and current chain state must be re-read before signing. A JSON snapshot is evidence, not an on-chain precondition. The configured creator and initial roster are not inferred solely from account names in conversation.

## Required verification

- Actual native signatures: q-minus-one cannot upgrade core; q can; creator can recover active; executives cannot replace core owner.
- Runtime code updates active with creator-only owner, including q > 1, roster changes, inactivity, heartbeat, election activation and wallet replacement.
- Managed owner upgrades require runtime quorum; module code can issue valid callbacks and cannot upgrade its own code/ABI using active.
- Service key can perform its six linked actions and cannot appoint, upgrade, change authority or use unrelated actions. Relay/Names settler and treasury behavior remain valid.
- Ordinary/cross-DAO member takeover, removed executive heartbeat, unpairing the last controller, stale approvals and partial staging failure all reject or roll back.
- C++ WASM/ABI, generated SDK, API/UI producer contracts and desktop/mobile owner/quorum disclosures agree. Native-runtime evidence is mandatory; VERT alone cannot prove native permission hierarchy.

## Decision boundary

The user approved implementation of this replacement policy and confirmed 3boidanimus3 on 2026-10-10. Live testnet signing is a subsequent decision after exact authorities, roster, release hashes and native evidence are available. The current audit implements safe diagnostics, catalogue compatibility and the behavior-preserving wallet-consent fix, and tests the proposed hierarchy on disposable native nodes; it does not invoke existing handover or change keys.
