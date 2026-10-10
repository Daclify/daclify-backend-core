# Daclify V2 backend core

Antelope C++ runtime and Hub, the TypeScript API, PostgreSQL migrations, custody boundary, relayer host, shared protocol, generated public SDK, and the deploy tooling for develop, testnet, and production.

This repository is one of three private V2 repositories. The others are [daclify-backend-modules](https://github.com/Daclify/daclify-backend-modules) and [daclify-frontend](https://github.com/Daclify/daclify-frontend). In the normal local layout they are sibling directories. Six older repositories live beside them and are not this application. Core publishes the public protocol and SDK. The other two repositories consume those packages. They must not import the API, the database, or custody code.

The implementation is not a production release. `npm run package:release` refuses missing or incomplete qualification evidence; verified evidence permits immutable local packaging, with registry publication and deployment remaining separate actions. The acceptance register is [the work-package plan](docs/superpowers/plans/2026-10-05-daclify-v2-work-packages.md). Nothing in this README marks a package complete.

## Read next

Development now uses **`dev`** across core, modules and frontend. Keep sibling app checkouts on `dev`; release to `main` only on an explicit request. The standalone landing page continues using **`main`**. See the [branch workflow](docs/development.md#branches) and [branch integration audit](docs/evidence/2026-10-09-dev-branch-audit.md).

The current development version is **0.10.0-alpha.1**, with contract interface 1. The resource-billing-archives branch adds core migrations 022–031 and hash-tracked Archive migrations 001–005, plus additive C++ state while preserving existing serialized rows and signing/content domains. It implements native/card RAM acquisition, manually funded payer allocations, configured prepaid storage, verified hosted references, public card-image uploads, encrypted Archive backups, native approval/revocation, bounded ordinary-poll pruning and merged history recovery. Hosted ownership/usage can be rebuilt from surviving chain references and provider inventory without inventing payment receipts.

Complete release/provider qualification remains unfinished. Development code includes physical completion holds, bounded legacy adoption, per-DAO growth limits, source-owned pruning/restoration and tested local recovery; remaining lifecycle/old-release gates are listed in the execution ledger. Pruning and destructive retention stay off by default. Use the [0.8 upgrade guide](docs/operations/upgrade-0.8.md) and [release evidence procedure](docs/operations/release-qualification.md) before any deployment. Existing wallet recovery remains available; social pairings and billing records require database backups.

Shared creation includes 10 active members. Paid slots 1–40 cost $1/month each,41–240 cost $0.50, further slots cost $0.20. Administrators approve capacity; joining never triggers charges. Own contracts/server with either the Daclify frontend or an own portal show Contact for pricing. Optional module-product Connect receipts use each DAO's own merchant account and initially 5% governed commission, separately from hosting. Read [payment operations](docs/operations/connected-payments.md) and app `/docs/shared-hosting`, `/docs/payments`, `/docs/independent-operators`.

- [Development checkouts and tests](docs/development.md) covers Node, bootstrap, the local fixture, and which suite proves what.
- [Operations](docs/operations.md) covers the three deploy profiles, testnet account names, Stripe, the TLOS quote, and the frontend network switch.
- [Implementation limits](docs/evidence/implementation-limits.md) records what has been exercised and what is still held.
- [Documentation index](docs/README.md) points at the plan, the architecture, and the generated reference.
- [Public protocol package](sdk/README.md) is the boundary other repositories import.
- [DAO presets and guarded agents](docs/dao-presets.md) covers the 0.2 feature, authority boundaries, compatibility and merge order.
- [Disaster recovery](docs/disaster-recovery.md) explains per-user recovery, document keys, lost login pairings and operator backups.
- [Vault login v3 rollout](docs/operations/login-v3.md) documents signed encryption-key binding and the coordinated frontend/API upgrade.
- [Paired login setup](docs/operations/paired-login.md) covers providers and the distinction between service login and on-chain wallet activation.
- [Recovery verification evidence](docs/evidence/2026-10-07-wallet-recovery.md) records actual database, native-runtime, browser and public-testnet checks.

## What is implemented

The runtime owns DAO identity, roles, governance credits, one native treasury asset per DAO, obligations, and native settlement. The Hub lists deployments. Decide, Works, Payroll, Grants rounds and Endorsement admission live in the modules repository and settle through this runtime. A module install that keeps any action stores the `get_code_hash` pin for that account. Direct module-key calls do not pass the sender check. `confirmext` stores a DAO-confirmed external payment statement and does not pay. `payroll::settle` pays every installment that is already due on that schedule.

The API serves the versioned routes in `protocol/routes.ts`, with additional provider/billing response references in `protocol/service-api.ts`. PostgreSQL migrations 001–021 include content/payments, account-control intents, paired native/EOA sign-in, Telegram OIDC, credential provenance/history, return destinations and wallet-only accounts. Applied migration bytes are immutable. The actual seven-migration schema is exercised by the upgrade test before current migrations are applied.

User-controlled accounts keep signing and decryption keys in the browser. Managed recovery is an OpenBao development boundary, not a production custody operation. Hosted files can use Pinata when `PINATA_JWT`, `PINATA_STORAGE_SCOPE` and `CONTENT_GATEWAY` are set in the gitignored environment file. The uploader uses the public network and does not send a group id.

## What survives a server failure

The deployed contracts retain DAO/member IDs, roles, balances, votes, current governance wallet bindings, document references and encrypted epoch-key grants. A user can recover their own access using current Daclify signing keys restored from their kit, or a supported currently bound blockchain wallet. Recovery does not create another DAO, member or creation fee. A new empty database gives the user a new service UUID; restoring a verified database backup preserves the original UUID.

One recovered administrator can manage the DAO again. Their kit does not recover the other members' private keys or login pairings; each member needs their own recovery path. An ordinary member remains an ordinary member. An old kit whose signing key was rotated on chain may still decrypt old content, but that old signing key alone cannot regain governance.

Google, Telegram, email and passkey associations are PostgreSQL records, not public-chain identities. Without the database and its backups, users must pair them again after recovering control. These metadata columns are not application-encrypted: protect the database and use encrypted off-host backups. Private documents additionally require the original decryption key, matching epoch grant and surviving ciphertext. An IPFS CID does not guarantee continued file availability. See the [recovery runbook](docs/disaster-recovery.md) for the complete procedure and session invalidation.

## Requirements

Node 24.21 or later in the Node 24 line, and npm 11.19 or later in the npm 11 line. From a source-only checkout, run `node tools/bootstrap.ts` before the first `npm ci`. Add `--contracts` to rebuild the C++ artifacts with the toolchain image in `tools/build/Dockerfile`. Bootstrap does not publish a package and does not start a chain.

Ordinary checks from this directory:

```sh
npm run lint
npm run typecheck
npm run docs:check
npm test
npm run verify
```

See the [three-repository audit](docs/evidence/2026-10-10-three-repository-audit.md) for verified boundaries, and the [approved login v3 follow-up](docs/evidence/2026-10-10-login-key-binding.md) for the coordinated key-binding fix. Service-owned native SDK requests abort after 10 seconds and do not follow redirects. Unexpected API errors log only a fixed code and registered route; no provider error text or request data is logged. A timed-out broadcast still needs reconciliation before retrying.

`npm test` does not run `tests/integration`, `tests/providers`, or `tests/native`. Those are `npm run test:integration`, `npm run test:providers`, and `npm run test:native`. Integration tests require an isolated database whose name ends in `_test`. Native qualification uses both `test:native:research` and `test:native:paid` with their matching owned fixture bundles; their bootstrap/payment setup is deliberately different. See the 0.5 upgrade runbook. Browser journeys are run from the frontend repository. Builds and tests run locally. GitHub verification workflows are manual-only, so pushing source does not start CI. See [local checks and Netlify deployments](docs/development.md#local-checks-and-netlify-deployments).

## Deploy profiles

`npm run deploy -- <develop|testnet|production>` prints a plan and sends nothing. The profile files are the source of truth for names and resources. [Operations](docs/operations.md) explains the flags, the creator, and the stake.

| Role    | Develop       | Testnet        | Production   |
| ------- | ------------- | -------------- | ------------ |
| Creator | `eosio`       | `3boidanimus3` | `we`         |
| Runtime | `daclifycore` | `daclifycore1` | `core.we`    |
| Hub     | `daclifyhub`  | `daclifyhubv1` | `hub.we`     |
| Decide  | `decide`      | `daclifydecid` | `decide.we`  |
| Works   | `works`       | `daclifyworks` | `works.we`   |
| Payroll | `payroll`     | `daclifypayr1` | `payroll.we` |
| Relay   | `relay`       | `daclifyrelay` | `relay.we`   |
| Billing | `fees`        | `daclifyfees1` | `fees.we`    |

Testnet names are ordinary 12-character Telos accounts. Production keeps the `we` suffix. Develop uses the short fixture names. The script does not create the creator. Testnet `--commit` spends testnet TLOS. Production spends mainnet TLOS only with `--confirm`.

`npm run price:tlos -- <profile> <minor-units>` quotes TLOS from Delphi `tlosusd` plus 20 percent. `1000` means 10.00 USD. New shared DAO creation is free with 10 included member slots; higher approved capacity uses the graduated monthly schedule. Independent hosting/external portals use contact-for-pricing; blockchain resources are separate. Older captured setup orders retain their accepted price. Independent self-service remains disabled. Optional account-service checkout uses the separately configured Stripe Price.

## Stripe

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` together, or leave all three unset. Prefer a restricted key, and use a different key for each environment. The card amount is the Stripe Price id, not a number in this repository.

`POST /v1/billing/checkout` starts a Checkout Session. `POST /v1/billing/stripe/webhook` is the fulfillment path. `GET /v1/billing/receipts` lists account receipts. A paid receipt does not change votes, permissions, withdrawals, treasury obligations, or storage entitlements. The procedure, the webhook events, and the cookie rules are in [Operations](docs/operations.md).

## Local API

`npm run dev` loads `.env` and listens on `API_PORT` (3008 in the examples). The frontend dev server proxies `/v1` to `127.0.0.1:3008`. `npm run dev:local` is the disposable native fixture API used by browser tests. `npm run native:start` starts that fixture chain. Do not reset a fixture that already holds state you need.

Secrets stay in the gitignored environment files. Use `.env.testnet` for the testnet API and `.env.deploy.testnet` only for the deployment key; the API refuses a deployer key. Do not print secrets or commit `.artifacts/deploy/*-keys.json`. The [operations guide](docs/operations.md) describes the planned Netlify frontend and separate mainnet/testnet API services on one Hetzner VM; source availability does not establish a deployed service.

## Resource development branch

Resources displays per-payer RAM counters, issued identity/activity/completion allocations, permanent native/card RAM purchases, prepaid unique-CID storage, complete archive retention groups and original grace deadlines. Explicitly enabled new-DAO payer offers are physically backed; member-slot increases grant identity capacity once at the DAO’s accepted rate. Allocated completion bytes are finite budgets; physical holds back the tested exits, while the explicit per-DAO guard limits normal growth. Complete public qualification is still required. Public branding upload remains separate from signed card publication. [RAM accounting](docs/ram-accounting.md), [storage accounting](docs/storage-accounting.md) and [Archive operations](docs/archive-exports.md) explain the boundaries.

Archive supports reference/age-qualified old document versions and ordinary-poll votes, resumable exports, independently verified encrypted backup, native attestation, signed approval/revocation, manual source-owned pruning, merged history and exact original-row restoration. Current/referenced versions, keys, epochs and financial rights remain live. Hosted-reference recovery verifies surviving owned pins and bytes; it invents no invoices or social pairings.

Owned-native checks cover 200 DAOs/40,000 memberships and representative workflows with exact conservation across core and all five module payers. The private-document drill prunes an encrypted old version, recreates its owned test database, recovers archive/file accounting from native anchors and surviving bytes, decrypts with the original kit, rejects a replacement kit and signs exact-row restoration. These are local evidence, not public-chain/provider qualification. Mainnet/testnet require separate Pinata accounts. See the [execution ledger](docs/evidence/2026-10-08-resource-execution.md).

`DACLIFY_STORAGE_CLEANUP_ENABLED` defaults false. Explicit enablement requires content and storage billing configuration and current-payment reconciliation. Period-bound in-app reminders are available; optional SMTP reminder/operator alert workers require separate configuration and live delivery qualification. A server-only gateway key can protect the dedicated gateway when its matching provider restriction is configured. It does not establish a funded bandwidth allowance. Keep cleanup off during incomplete recovery.

Supported old binaries, bounded adoption, approved-code drain, full-claim exits and original-kit restoration have local evidence. Public target configuration, complete production lifecycle qualification, live gateway funding/access controls and provider/client gates remain open; see the [0.8 acceptance record](docs/evidence/2026-10-09-resource-completion.md). No production deployment or destructive rollout is certified by these development changes.

The [deployed Telos token native matrix](docs/evidence/2026-10-09-telos-token-ram.md) passes six receiver/payout/exhaustion cases using checksum-checked public token bytes on the owned chain. It reconciles legacy sender-payer costs separately from DAO counters. Run the documented read-only snapshot step before this suite; public deployment, arbitrary tokens and provider qualification remain separate gates.

The [maximum-seat election drill](docs/evidence/2026-10-09-election-completion.md) passes new and actual historical-contract adoption cases: eight maximum-title terms complete at both native RAM limits, with exact counter reconciliation and once-only finalization. Full historical lifecycle/public release qualification remains open.

## License

First-party code, contracts, SDKs and documentation are licensed under
**AGPL-3.0-only**. See [LICENSE](LICENSE) and [licensing and source obligations](LICENSING.md).
Third-party files retain their own licenses. Contributions remain owned by their authors.

The development [RAM migration controller](docs/operations/ram-migration.md) has bounded core/all-five-module scans, financial/election hold adoption and once-only physically backed inherited grants. Migration totals fail closed until sealing. Existing observed deployments use the documented completion-only adoption sequence without resetting counters. No migration is run automatically at API startup.

The development per-DAO RAM guard is explicitly enabled by native operator action after backed allocations and completed legacy adoption. Resources shows its actual on-chain state. Normal growth and partial withdrawals cannot consume the additional completion budget; native full-claim exit and sponsored acquisition checks remain part of release qualification.

Quota activation checks existing credentials, financial holds and pinned first-party module completion reserves. Already observed deployments use completion-only adoption; do not reset or backfill their historical counters. See the RAM migration runbook for exact stages, 5,000-row activation bounds and pending-approval restrictions. These local development checks do not qualify public rollout or foreign token-row ownership.


Native payouts now require receiving-wallet token-row preparation. The runtime refuses missing rows atomically, and the UI offers the receiver-funded wallet action. Operators must prepare new runtime rows before funding and separately qualify historical sender-payer state; see [RAM operating bounds](docs/ram-accounting.md#receiving-wallet-token-rows) and [native evidence](docs/evidence/2026-10-09-receiving-wallet-ram.md). These local checks do not authorize public rollout.

The [documentation assistant and Telegram group runbook](docs/operations/docs-assistant.md) explains backend-only model configuration, docs-only scope, approved-group webhooks, privacy mode, cost limits and at-most-once reply delivery. App AI needs an OpenRouter key; Telegram chat additionally requires explicit chat allowlists, enablement and webhook registration.

## Executive governance

Executive offices and voting eligibility are separate metered tables beside unchanged member rows. Native ownership uses explicit owner-reviewed bootstrap handover, a dynamic `govern` permission, a restricted hosting `service` permission and last-controller guards. Shared DAOs cannot claim runtime ownership. Adoption requires [the 0.9 owner-reviewed procedure](docs/operations/upgrade-0.9.md). See [executive design](docs/superpowers/specs/2026-10-09-executive-authority.md) and the generated `executives` help topic. Live authority changes require a separate reviewed deployment.

## Contract permission and module integration examples

Read [the permission map and worked flows](docs/guides/contract-permissions.md). The same guide is bundled into the app at `/docs/contract-permissions`. [The integration evidence](docs/evidence/2026-10-09-contract-integration.md) gives the fresh local native-node recipe and verified coverage. Run the handover suite on its own disposable chain; it changes fixture owners and cannot share a node with bootstrap suites. Live Telos permissions are unchanged.

Public people and workspace UX: Users exposes only published on-chain profiles; DAO Members supports cards/list and role labels. Daclify DAO uses its standard workspace with a platform-controls tab. Help stores a bounded per-account browser transcript. Names seller and native purchase controls require the matching reviewed names contract; third-party name cards are disabled pending merchant routing. See [people and workspace plan](docs/superpowers/plans/2026-10-09-people-and-workspace.md).

Status groups platform details into Overview, Network, Contracts, Fees, Services and AI Daxi Help tabs. AI settings show public model names and the reviewed knowledge version; credentials and Telegram whitelist IDs stay private. Daxi and Telegram setup are covered in the [support runbook](docs/operations/docs-assistant.md). See [Daxi and Status verification](docs/evidence/2026-10-10-daxi-and-status.md).
