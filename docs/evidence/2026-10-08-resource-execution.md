# Resource billing and Archive execution ledger

Implementation branch: `codex/resource-billing-archives` in isolated sibling worktrees under `/Users/seth/.config/superpowers/worktrees/daclify-ram-history`. Main checkouts are not implementation targets. No sub-agents, deployment, external spending or live data cleanup is authorized by this ledger.

Plan: [RAM, prepaid storage and archives](../superpowers/plans/2026-10-08-resource-billing-and-archives.md). Ponytail 5.0.0, full mode. Test-first implementation proceeds inline in dependency order.

## Verification already run

- Core baseline: `npm test`, 66 files / 425 tests passed.
- Module baseline: 14 files / 83 tests passed after restoring missing ignored compiled core-release fixtures. The first run failed because `.artifacts/core-release/runtime.abi` was absent; it was not a product regression.
- Frontend baseline: 24 files / 101 tests passed; `npm run typecheck` passed.
- Task 1 red run: missing resource module and storage pricing functions caused the expected failures.
- Task 1 green run: `npx vitest run tests/resource-policy.test.ts tests/storage-pricing.test.ts tests/hosting-pricing.test.ts`, 3 files / 9 tests passed.
- Task 1: `npm run typecheck`, focused ESLint, `npm run docs:check` and `git diff --check` passed.

## Task status

| Task                                 | State       | Evidence / boundary                                                                                    |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------ |
| 1 Policy definitions                 | Complete    | Checked integer fees, approved storage units and pricing snapshot hashes; unchanged membership pricing |
| 2 Native write inventory/calibration | In progress | Enforcement unavailable until payer reconciliation is demonstrated                                     |
| 3 Backed allowances/metering         | In progress | Opt-in counters implemented; no funded allocation or enforcement                                       |
| 4 Existing-state migration           | Pending     | Existing row layouts and rights must survive                                                           |
| 5 Atomic TLOS RAM purchases          | Pending     | Must prove actual system RAM acquisition                                                               |
| 6 Card RAM provisioning              | Pending     | Segregated operator reserve; no simulated funding                                                      |
| 7 Hosted-object ledger               | Pending     | Verified size and unique-CID references                                                                |
| 8 Monthly storage                    | Pending     | Explicit prepaid capacity consent                                                                      |
| 9 Grace/retention                    | Pending     | No destructive cleanup enabled                                                                         |
| 10 Archive format/package            | Pending     | Independent C++/TS commitment vectors                                                                  |
| 11 Export/verification/approval      | Pending     | Live records remain until verification                                                                 |
| 12 Source pruning/references         | Pending     | Financial/key state excluded                                                                           |
| 13 History/recovery                  | Pending     | Empty-database and original-key restore drill                                                          |
| 14 Resources/Archive UI              | Pending     | Correct DAO/operator context and accessibility                                                         |
| 15 Documentation                     | Pending     | Qualified feature descriptions only                                                                    |
| 16 Release/qualification             | Pending     | Native/provider/browser results recorded separately                                                    |

This is a progress ledger, not a release certification. Live Stripe, Pinata and Telos testnet qualification has not been performed for these features.

## Native findings

- Spring 1.2.2 aligns database object overhead to 16 bytes: primary row 112; uint64/uint128/checksum256 indexes 128/144/160; table header 112. The first secondary index shares the primary table ID. Packed row bytes remain additional.
- A real native probe reconciled insert/grow/shrink and primary/secondary last-row erasure, including the 127→128 varuint boundary and UTF-8 bytes.
- A foreign-payer insert charged Alice's RAM when Alice authorized the action. Approved module code is therefore part of the shared RAM boundary.
- `get_resource_limits` is unavailable to an ordinary application contract: native error `3050007 unaccessible_api`. The initial exploratory quota-reader test failed on that real restriction. The regression now asserts the restriction; production must use the qualified system table/code adapter instead of elevating the Daclify runtime to privileged status.

Source: [Spring billing definitions](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/include/eosio/chain/contract_table_objects.hpp), [alignment](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/include/eosio/chain/config.hpp). The USD Stripe maximum is verified from the [PaymentIntent amount contract](https://docs.stripe.com/api/payment_intents/create).

## Real RAM-market fixture and execution-result fix

- Added the owned `daclify-resources-native` fixture on loopback port 20588. The earlier stopped RAM-population fixture and its disposable key files were preserved separately.
- Retrieved public Telos testnet system WASM and binary ABI read-only, verified hashes, and installed them only on the owned local fixture. WASM hash: `48d74c3df9f5c9952c0f87ab6c01e1c6dfe621429f59932ecf609b5d81e668e4`; raw ABI hash: `fccb1a515b98d2232a1227279666d9a3fcd41f67fafa0d75212cc0a282564361`.
- The current system WASM requires additional host features, including Savanna and its advertised dependencies. `tools/native/system.ts` verifies pins and activates dependencies only on this explicit local fixture. It does not sign or spend on the public source endpoint.
- A native `buyrambytes` increased actual account quota. In this artificially small token-market fixture, requesting 16,777,216 bytes initially acquired 15,443,350 bytes. This confirms that receipts must verify actual acquisition and enforce the accepted minimum, rather than blindly credit the request.
- Native system `userres.ram_bytes` reconciled to actual unmanaged quota plus this system's 1,400-byte gift. A later deliberately failed action rolled back receiver acquisition and resource rows.
- Failed transactions can return an HTTP-success envelope containing `processed.except` and no executed receipt. Added a strict, redacted execution validator and bound replies to the actual transaction ID in both API write paths and deployment/funding/enrollment/analysis tools.
- `npm test`: 69 files / 435 tests passed. Focused native RAM geometry/market suites: 2 files / 5 tests passed. Typecheck, lint, generated-doc check and changed-file formatting passed.
- [Write inventory](2026-10-08-ram-write-inventory.json) records 47 compiled owned tables and 137 source write candidates, with DAO bindings and aligned cost recipes. This is the instrumentation inventory, not proof that per-DAO counters already exist or every callback is reconciled.

Remaining Task 2/3 gate: implement all write hooks and prove per-DAO/payer conservation on the actual native runtime before enabling quota enforcement. Native purchases above are standalone market qualification, not implemented Daclify RAM-order settlement.

## Observer checkpoint

- Added opt-in native counters by DAO, RAM payer and identity/activity/retained/platform category. Existing serialized rows, member IDs, nonce domains and interface version remain unchanged. Shared table headers belong to platform; DAO-scoped headers belong to that DAO. Observer metadata is recorded separately and included in conservation.
- Core and all five module table aliases use the metered writes, including secondary-index modification and erasure. Platform singleton writes also participate. Modules resolve legacy vote/control ownership through their existing parent rows rather than changing serialization.
- Counter callbacks require the executing source as native sender, its authority and its currently deployed approved code hash. A directly signed account-key callback is rejected. Module installation/dispatch requires the registered code pin when observation is enabled.
- Observation must start before any tracked state exists. Existing DAO or platform settings require the pending backfill; this checkpoint does not enable observation on an old deployment. Core-code rebinding/migration is not implemented, so do not enable the observer in a production upgrade.
- The initial real-system account-creation setup failed because a separate newaccount transaction had no allocated RAM. The owned fixture now creates, buys RAM and stakes CPU/NET atomically. No public-chain transaction was sent.
- Native conservation passed after each selected transition for core and each module payer: DAO/member creation, platform settings, UTF-8 profile insert/grow/shrink through a secondary index, nonce changes, session insert/last-row deletion, private epoch/key-grant records, documents, Works proposals/milestones, Grants rounds, Payroll entries/reserves/controls, endorsement applications, Decide ballots/votes and core governance locks. A DAO ID equal to the runtime's encoded account name also reconciled. Code/ABI/permission overhead was measured as platform baseline; it was not charged to a DAO.
- The first singleton conservation regression failed by 260 bytes before metering that write; the corrected native sequence passed. The pre-existing-settings regression also failed before the initialization guard and passed after it.
- [ABI compatibility evidence](2026-10-08-observer-abi-compatibility.json): all existing ABI structures and table definitions unchanged against each repository's baseline HEAD. This is layout evidence, not the pending supported-release migration/recovery drill.
- Fresh checks after rebuilding and installing local development artifacts: core 70 files / 440 tests; modules 14 files / 83 tests; frontend 24 files / 101 tests; focused native RAM suites 3 files / 6 tests. All passed. Core typecheck/lint/docs check, module verify and frontend typecheck also passed.
- npm audit still reports the existing VERT development-tool dependency advisories (elliptic and lodash.set; no fix offered). They are not new runtime dependencies. The harness remains a local disposable-fixture tool, and its results do not replace native authorization or cryptography qualification.

Task 2/3 remain in progress: not every lifecycle/table has a native transition vector yet. Physically backed allocations, completion reserves, purchase settlement, legacy backfill, storage billing and Archive are not enabled or release-certified by this checkpoint. No main checkout, external provider data or live funds were changed.
