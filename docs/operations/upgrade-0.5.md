# Upgrade to 0.5.0-alpha.1

This development release adds paired sign-in, direct Zero/EOA governance, display metadata v3, contribution agreements, spending receipts/reports, Grants rounds, Endorsement admission and representative elections. Deploy the three repositories together. Interface version remains 1; additive action/table/schema capabilities are release-pinned. The frontend checks its own installed module version/hash before offering module actions.

## Prepare and review

Use Node 24.21/npm 11.19 in three sibling checkouts. Run `node tools/bootstrap.ts --contracts` from core to compile pinned CDT 4.1.1 contracts, regenerate SDK/docs and wire local development tarballs. This publishes no package and deploys no chain. Production artifacts must be built once, pinned and verified after immutable registry publication. Never replace bytes under an existing published version.

Back up PostgreSQL and chain table snapshots. Record full chain/runtime/DAO references, account authorities, deployed WASM/ABI hashes, enabled module hashes/actions/grants/configuration, pending Decide plans, unpaid Works/Payroll obligations, balances, claims, epoch grants and recovery arrangements. Keep keys and encrypted kits out of audit logs. Reconcile these records after each deployment step. Historical settlements without receipts remain explicitly incomplete; a migration cannot invent their destinations.

The startup migration coordinator applies 008–014 after 001–007. Old sessions of unknown provenance are revoked, old unbound challenges are consumed, and old EVM service links require fresh verified pairing. Account IDs and DAO member IDs persist. Test restore and upgrade in a disposable database before maintenance. Never roll back the application to an old credential-write path after these migrations.

## Contract and permissions

Deploy the new runtime/Decide/Works code and ABIs in a maintenance window, preserving every existing table. Existing DAO/module rows are not rewritten. Upgrading a module intentionally invalidates its old code pin. Pending execution plans retain their original commitments/hash and fail under changed code; open a new reviewed proposal. Do not silently repin a pending plan or replace its terms. Approved Treasury liabilities remain claimable independently of module availability.

Grants and endorsement contracts require operator-selected accounts. Add entries to the environment's `extraModules` array with `contract` equal to `grants` or `endorse`, `inlineCode: true`, and reviewed RAM/CPU/NET values. The existing seven configured account names remain unchanged. Testnet accounts must be ordinary 12-character names. Confirm the selected native chain has GET_SENDER, GET_CODE_HASH and CRYPTO_PRIMITIVES activated before deployment.

`npm run deploy -- <environment> --set-contract` is a read-only deployment preview. It includes a JSON `execctx` authority/link plan derived from the producer's module action lists. Review it with the runtime controller. Apply the runtime's `execctx` permission under `active` with only its own `eosio.code` weight, then link precisely the listed core/module actions to it. For each reviewed link, use `cleos set action permission <runtime> <action-account> <action> execctx -p <runtime>@active`. Modules that issue inline callbacks also need their own reviewed `eosio.code` authority. Never link arbitrary token transfers, owner operations or callback-only actions to `execctx`. The preview does not apply these authorities.

Deployment `--set-contract` installs only missing code. Existing code upgrades must be executed explicitly by their account controllers using the verified artifact and ABI. Do not assume a dry run performs an upgrade. The deployment encoder uses native abi_def serialization; raw JSON text is not the setabi payload.

Register the exact deployed module hashes and accepted fee terms through platform governance. DAO administrators explicitly enable or upgrade their module configurations with the new published action/grant/hash pins. Grants requires Decide and Works; it uses the existing Works/Treasury ledger and a lifetime round cap. Endorsement admission requires the narrow `admit` grant and a separate opt-in policy. New elections confer title/term records only; they do not grant administrative or spending powers. Pilot with a small public DAO before enabling optional admission policies on established communities.

## Reproduce development checks

Use owned loopback fixtures only. The documented research harness is `daclify-research-native` on 20188. The paid-creation browser harness is `daclify-research-paid-native` on 20288. Do not overwrite another session's `.artifacts/native` keys/network file: archive them privately and restore the matching fixture bundle before switching harnesses. Run pre-payment tests before configuring paid creation; its singleton intentionally disables operator bootstrap creation.

Run `npm run build:upgrade-fixture` before `tests/native/upgrade.test.ts`. It archives the exact 0.4 core/modules Git revisions and compiles them with the pinned toolchain. The native upgrade test creates isolated alias accounts, populates actual old contract rows, upgrades them and verifies old commitments, claims, obligations and execution-pin failure. `tests/integration/account-upgrade.test.ts` creates and drops its own loopback `_test` database and applies real migrations twice.

Run core `npm run verify`, `npm run build`, `npm run test:integration`, `npm run test:providers` and both `npm run test:native:research` and `npm run test:native:paid` with their matching owned fixtures; modules `npm run verify`/`npm run build`; frontend `npm run verify`, `npm run build`, and browser tests against the matching local API. Real provider credentials, Anchor/client qualification, durable managed custody and production deployment remain separate checks. See the execution ledger for exact passes and prerequisites.

## Operations and commercial boundaries

Configure SMTP/Telegram through the paired-login runbook. User-controlled provider login opens the service account and never restores decryption keys. Managed accounts remain clearly labelled and production-gated pending durable OpenBao qualification. Do not advertise local dev-mode OpenBao as production custody.

Keep membership, approved claims, recovery and complete exports available irrespective of paid hosted coordination. Shared DAO setup remains $20; independent setup $50 plus separately charged blockchain resources. TLOS conversion retains the existing 20% premium. Neither grants nor elections introduce a second payment ledger. Matching, NFTs, privileged delegate budgets, recurring agreements, contract-wallet governance, bridges and EVM payouts remain explicit future capabilities.

The native phase commands select disjoint tests because paid creation disables bootstrap creation. The raw `test:native` glob is useful for explicit file selection, but cannot run both fixture phases on one configured chain. For the research phase use the recorded research bundle and build the upgrade fixture first. Run the paid phase only after selecting its fresh paid bundle. These selections must both pass before native qualification is recorded.

Actual final research command used:

```sh
DATABASE_URL=postgres://daclify:daclify-test-only@127.0.0.1:17432/daclify_research_test OPENBAO_URL=http://127.0.0.1:18221 OPENBAO_TOKEN=daclify-research-test-only npm run test:native:research
```

These values are synthetic local fixture credentials. Production configuration is separate. The paid phase uses the same owned test database and `npm run test:native:paid`. Never use these dev-mode credentials for production custody.
