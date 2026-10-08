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
| 3 Backed allowances/metering         | Pending     | No capacity granted by configuration alone                                                             |
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
