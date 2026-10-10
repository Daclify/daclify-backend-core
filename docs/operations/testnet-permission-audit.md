# Inspect deployment permissions

From backend core, run:

```sh
npm run --silent audit:permissions -- testnet > .artifacts/testnet-permission-audit.json
```

Use `develop` for the owned local fixture or `production` for read-only mainnet inspection. The command uses the committed public deployment profile, checks the RPC chain ID and returned account names, and applies a ten-second request deadline. It does not load private environment files, read keys, sign or broadcast.

Exit codes: **0** means the checked execution links/authority match; **2** means execution-permission drift was found; **1** means usage or a required read failed. Upgrade minimums are reported for review, not judged against an owner-only policy (`upgradePolicyEvaluated` is false). This does not certify code safety, executive governance, service-key isolation, transitive external account authority, balances or provider readiness.

`context` compares the runtime's execctx parent and full authority against the code-only producer plan. It reports each missing or differently assigned action link and any unexpected execution links. Wildcards remain visible for review; they are not counted as the required explicit links. The module list comes from the same configured account mapping used by the deployment planner.

RPCs that omit linked_actions or raw eosio_any_linked_actions are rejected. A nonempty eosio.any link list is withheld for review before the pinned SDK can discard that metadata. Omitted link information does not establish that links are absent and must not produce an overwrite proposal.

`upgrades` reports the effective linked minimum for eosio setcode/setabi on each configured contract account. An exact action link takes precedence over an account-wide wildcard; absent links default to active. Inspect the reported permission's full authority: active may contain an operator key or an executive quorum. Choosing owner when deploying does not enforce owner-only upgrades. The CLI reports ordinary action links only after those complete raw checks. Existing active can update itself; owner can recover it, while active cannot update owner. The parent/child relationship does not grant owner authority to active.

`unsignedRepair` contains only absent member-action linkauth actions, authorized by the runtime owner. It contains no updateauth, setcode/setabi, unlinkauth, handover or payout action. If the existing execctx authority/parent differs, it has unexpected links, or an action is already assigned to another permission, repair preparation is withheld for explicit review. The inspector never replaces keys or removes unrelated grants.

Before approving or signing a repair, review its chain/account/action list and re-read current authorities and links. The report is a snapshot, not a transaction precondition: an external owner can change permissions afterward. Use the current owner's established signing or multisig workflow only after explicit approval. The audit command has no send option.

## Read permissions alongside the app

An internal Daclify member signs a domain-bound instruction. A native member signs submitnat with the paired account; an EVM member supplies its separate bound proof. Runtime checks the chain/runtime/DAO/member, payload actor context, nonce and expiry, then dispatches the validated instruction inline as runtime@execctx. Each member action needs its matching runtime-account link, including links to module contracts.

Do not delegate module owner/active to runtime@active merely to make a member action work. The module checks the runtime sender and execution permission. Its callbacks use module@active, satisfied by its own eosio.code; runtime additionally checks the module sender, installed grant and live code pin. Removing those code entries breaks valid callbacks and payouts.

Shared native ownership is a separate owner-reviewed governance handover. An app administrator or paired wallet does not acquire it automatically. Configured Hub, settler, treasury and Names roles are business relationships; inspect their own authorities separately. Release hash verification and the Status permission tree show facts, rather than certifying that all required setup or governance handover is complete.

The dated findings and verification for the current testnet are in [the smart-contract permission review](../evidence/2026-10-10-testnet-permission-review.md).
