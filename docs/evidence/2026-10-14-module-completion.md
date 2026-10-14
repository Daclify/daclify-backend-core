# Module completion on testnet

The five selected module follow-ups are implemented, pushed to `dev` and deployed to testnet. This report supplements the older audits; it does not change their historical findings or qualify the wider production programme.

| Capability | Delivered behavior |
| --- | --- |
| Ballots | Proposal explanations, exact evidence and bounded choices; neutral polls; signed domain/subtype commitments; preservation of legacy voting. |
| Review and export | Frozen Works/Grants payment targets, exact document versions, required content verification and explicit complete-live/partial-live vote exports. |
| Member services | Typed service authoring, signed publication, encrypted private offers and bounded reads cleared when account/key context changes. |
| Payroll | Immutable agreed terms and names; separately funded, unique successors; original approved installments remain payable. |
| Works and Grants | Explicit protected consent, optional/permanently adopted future-work protection, conflict-free member disputes, agreed backup and matching settlement with core-enforced payment rights. |

Release versions: core/public SDK `0.15.0-alpha.23`, modules SDK `0.10.0-alpha.32` / contract `0.10.0-alpha.4`, Community MCP `0.1.0-alpha.14`, frontend `0.15.0-alpha.35`. The frontend includes the newer mini-app admission and requested sign-in-method continuation commits from `dev`.

Verification: core 1,025 tests, modules 260, frontend 376, MCP 13, actual Spring native cases 3, combined desktop/mobile browser cases 106, and live desktop/mobile public checks 2 passed. Lint, strict types, generated docs, builds and the focused release/manifest checks passed. Native proofs, settlement and upgrade tests use real signatures and deployed WASM. Browser fixtures do not establish external wallet/provider qualification.

Ten testnet upgrade transactions were confirmed irreversible. All nine account code/ABI pins, existing primary rows and unchanged authorities were checked. Only the reviewed catalogue/installed-module pins and corresponding action selections changed; the new fixed context/operator links were verified. The existing `test1` ballot in DAO `12027513584436739430` remains open, retains its original metadata and exports as legacy-unbound/complete-live. Its state and votes were not changed by this deployment.

The contracts required 2,097,152 additional RAM bytes, purchased for 120.1074 test TLOS from the configured testnet deployment creator. DAO treasury balances and claims were preserved. Pinned CDT 4.1.1 `-O=s` produces a 1,046,335-byte runtime and 445,246-byte Decide WASM. The owned 5,000-member court prepared 4,998 eligible voters in 20 actions; maximum observed step CPU was 40,920µs and additional Decide RAM was 81,532 bytes. These results qualify the bounded 5,000-record preparation case, not arbitrary historical populations or other chains.

The clean API and frontend release runs from `/data/daclify-runtime/releases/20261014-module-completion`. Current and historical SDK/MCP artifact downloads are retained. The names-oracle timer was paused while capturing a stable rollback snapshot, then resumed successfully with the current release. The API's version-bound recovery report was requalified with an actual TLS snapshot restore, source unavailable during the drill, original key recovery, four privilege denials and audit plaintext exclusion; its previous report remains available for rollback. This is single-host testnet evidence and expires on October 17; it is not independent production recovery qualification.

Deployment preparation must validate the effective service environment and current-version recovery report before restarting the API. The initial restart exposed the old qualification report and environment override order; both were corrected. The final API, portal, recovery service and oracle are healthy. MCP's public catalogue/discovery remains available before authentication; protected tool calls return the OAuth discovery challenge.

Still outside this selected follow-up: independent production/provider/privacy qualification, a managed mini-app database service, secret voting and additional election algorithms. Existing production/registry publication gates continue to refuse qualification. No hosted CI run was returned for these `dev` pushes. The whole-change review was performed inline by the author because workspace instructions prohibit delegation.

The private rollback packet and irreversible receipts are under `/data/daclify-upgrades/testnet/snapshot-module-completion-delivery-20261014`; test logs and owned native evidence are under `/data/daclify-runtime/module-completion-20261014`. See [the execution ledger](2026-10-14-module-completion-progress.md), [the selected plan](../superpowers/plans/2026-10-14-module-completion.md) and [the native reproduction instructions](2026-10-14-native-module-completion.md).
