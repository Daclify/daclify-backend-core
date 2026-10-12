# Governing documents testnet rollout — 12 October 2026

The user expressly authorized live activation and selected the current pushed `dev` branches. The exact archived core `dd5ee89`, modules `29ec2a6` and frontend `c6b6479` are now live at [the testnet portal](https://testnet.app.daclify.com/dao/1/documents) and [testnet API](https://testnet.api.daclify.com/v1/network). Separate Mini apps feature-branch commits and unfinished profile-encryption changes were excluded and preserved. This is testnet development activation, not a mainnet release or production qualification.

The API reports core `0.14.0-alpha.5`; the selected module SDK is `0.10.0-alpha.5` and frontend is `0.14.0-alpha.8`. The [machine evidence](2026-10-12-governing-documents-testnet-rollout.json) records exact source, binary/ABI pins and all seven irreversible transactions.

## Native upgrade and preservation

Before upgrading, the operator retained private account/hash/authority snapshots for 11 native accounts and binary/ABI/table backups for the seven upgraded contracts, with 173 existing rows across 65 primary table scopes. No open ballot, pending Works/grants state or active RAM observer required draining. Existing stored rows round-tripped with the candidate ABIs.

The upgrade replaced the runtime and six module binaries and updated catalogue and existing installation pins. Enabled Decide installations gained only `regdoc`, `proposedoc`, `adoptdoc`, `canceldoc` and `ackdoc`, retaining existing actions and grants. The same five runtime `execctx` links were added. A separate Relay `operator` link enables permissionless bounded `cleardocs`; it is excluded from member dispatch. Decide's `docchanges`, `elections` and `terms` reference coverage was backfilled for every enabled installation. The existing RAM observer remains uninitialized; no existing RAM ledger or quota was reset or enabled.

Decide needed 376832 additional RAM bytes. Signed simulation quoted 21.5801 testnet TLOS including the RAM fee, with a 50.0000 TLOS bound rechecked before broadcast. The actual executed transactions, actual code/ABI hashes, catalogue/install pins and retained row contents were verified after irreversibility. Owner and active authorities, account keys, membership/role rows, treasury balances and existing module state were preserved. Intended configuration and document-source/scan rows are the exceptions to byte-identical preservation.

## API, frontend and recovery

A private service database dump and prior API/frontend/oracle configuration were retained before cutover. After publication, hashes of all 18 service accounts, signing/encryption identities, paired credentials, passkey counters, native/EVM links and member associations matched the original snapshot. Account merge ownership also matched the actual dump, including its preexisting merged account. No new service account, key replacement or sign-in reconnection was performed.

A fresh disposable TLS/OpenBao Raft drill recovered a synthetic original key after destroying its source, verified four privilege denials and excluded plaintext from audit output. Its report binds core alpha.5 and retains the original expiry, 17 October 2026 at 15:46 Atlantic/Canary. The new API's actual recovery configuration validator and live TLS synthetic wrap/unwrap passed. The live key service was never stopped. This remains single-host testnet development recovery; independent-host and wallet/passkey recovery were not qualified.

The matching API snapshot and recovery report were selected together. The built testnet frontend was published with its entry point last, retaining old hashed assets for open tabs. Public index SHA-256 is `7100e35bf4a94600e38b79541f9541e21f7d9e41094ba00472972f73f8008401`; all 22 referenced entry assets match the candidate bytes. The Names oracle also checks the runtime hash, so its source was moved to the matching snapshot; its actual refresh succeeded with existing credentials and unchanged Names code. API, frontend, PostgreSQL, recovery and oracle services/timer are active.

## Checks actually completed

- Fresh archived core/module builds and typechecks, Vue/template checking and testnet frontend build passed. The final private upgrade helper also typechecked.
- Core release checks passed 14 tests, with another 7 governing-document API/permission tests.
- Module governing-document/deployment contract checks passed 8 tests using the exact candidate WASM.
- Three fresh disposable native tests passed: real dispatch/authorization and acceptance, genuine changed-binary persistence and source refusal, and a real member vote.
- Two fresh mocked desktop/mobile browser workflow tests passed.
- Public desktop/mobile general smoke checks passed against real HTTPS/API responses, including account journeys, Hub, Telos history, contract resources, Names freshness and DAO navigation.
- Public desktop/mobile Documents checks passed: the new register and help guide are visible, with no axe violations, horizontal overflow, page errors or API 5xx responses. The actual register endpoint is available and verifies the new native pins.
- A signed live `compute_transaction` rehearsed `putjson`, registration, proposal, adoption and acceptance through the installed native permissions. A second computation rejected duplicate acceptance. No rehearsal was broadcast; member nonce and document/register/change/acceptance rows remained unchanged. No real DAO constitution or acceptance record was created by deployment.

The [implementation evidence](2026-10-12-governing-documents.md) retains the earlier broader test counts and their scope. They were not all rerun during this rollout. The earlier paid browser selection remains unqualified; this delivery does not relabel it as passed.

## Rollout diagnostics and retained packet

All work and review were inline. Initial staging lacked copied fixture artifacts; supplying the exact candidate fixtures resolved those failures. Prebroadcast simulations exposed the RPC's unpacked-request size limit and catalogue-before-install ordering; both were corrected before module broadcast.

A variable shadowing error in a new cost guard stopped the first cutover iteration after only the runtime code transaction became irreversible. The API stayed paused. The helper was corrected and typechecked; a guarded receipt/LIB/hash/row check recognized the completed runtime stage, then the remaining six batches were simulated and applied. No transaction was blindly resent or code rolled back. The final preservation checks passed. The API maintenance window was approximately 3 minutes 41 seconds.

Public verification probes were corrected to use the canonical `coreVersion` schema and actual handbook heading. A copied previous delivery assertion that assumed zero merged accounts was replaced by comparison with actual backup ownership. These were diagnostic harness errors; final checks above passed with the recorded assertions.

The private operator packet is `/data/daclify-runtime/releases/20261012-governing-documents/`, including exact archived sources, backup, source selectors, exact reviewed plan, simulations, receipts, recovery report references, browser screenshots/logs and the continuous ledger. Original implementation worktrees and separate feature branches were preserved. The general production release qualifier remains unqualified.
