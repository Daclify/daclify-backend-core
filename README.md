# Daclify V2 backend core

Antelope C++ runtime and Hub, the TypeScript API, PostgreSQL migrations, custody boundary, relayer host, shared protocol, generated public SDK, and the deploy tooling for develop, testnet, and production.

This repository is one of three private V2 repositories. The others are [daclify-backend-modules](https://github.com/Daclify/daclify-backend-modules) and [daclify-frontend](https://github.com/Daclify/daclify-frontend). In the normal local layout they are sibling directories. Six older repositories live beside them and are not this application. Core publishes the public protocol and SDK. The other two repositories consume those packages. They must not import the API, the database, or custody code.

The implementation is not a production release. `npm run package:release` still refuses publication. The acceptance register is [the work-package plan](docs/superpowers/plans/2026-10-05-daclify-v2-work-packages.md). Nothing in this README marks a package complete.

## Read next

The current development version is **0.7.0-alpha.1**, with contract interface 1. It adds free shared creation, graduated monthly member capacity, optional DAO Stripe Connect and Hub-discovered independent portals. This update changes runtime WASM/ABI and adds migrations 016–021; the baseline modules retain their existing C++ contracts. The resource-billing-archives development branch changes all five module WASM builds for opt-in RAM observation while preserving existing serialized rows. Observation over legacy state, backed resource enforcement and the new upgrade path remain unfinished; the baseline 0.7 upgrade guide does not qualify this branch. Deploy matching API/frontend/SDK/help artifacts and review [upgrade 0.7](docs/operations/upgrade-0.7.md). Existing wallet recovery remains available; social pairings and billing records require database backups.

Shared creation includes 10 active members. Paid slots 1–40 cost $1/month each,41–240 cost $0.50, further slots cost $0.20. Administrators approve capacity; joining never triggers charges. Own contracts/server with either the Daclify frontend or an own portal show Contact for pricing. Optional module-product Connect receipts use each DAO's own merchant account and initially 5% governed commission, separately from hosting. Read [payment operations](docs/operations/connected-payments.md) and app `/docs/shared-hosting`, `/docs/payments`, `/docs/independent-operators`.

- [Development checkouts and tests](docs/development.md) covers Node, bootstrap, the local fixture, and which suite proves what.
- [Operations](docs/operations.md) covers the three deploy profiles, testnet account names, Stripe, the TLOS quote, and the frontend network switch.
- [Implementation limits](docs/evidence/implementation-limits.md) records what has been exercised and what is still held.
- [Documentation index](docs/README.md) points at the plan, the architecture, and the generated reference.
- [Public protocol package](sdk/README.md) is the boundary other repositories import.
- [DAO presets and guarded agents](docs/dao-presets.md) covers the 0.2 feature, authority boundaries, compatibility and merge order.
- [Disaster recovery](docs/disaster-recovery.md) explains per-user recovery, document keys, lost login pairings and operator backups.
- [Paired login setup](docs/operations/paired-login.md) covers providers and the distinction between service login and on-chain wallet activation.
- [Recovery verification evidence](docs/evidence/2026-10-07-wallet-recovery.md) records actual database, native-runtime, browser and public-testnet checks.

## What is implemented

The runtime owns DAO identity, roles, governance credits, one native treasury asset per DAO, obligations, and native settlement. The Hub lists deployments. Decide, Works, Payroll, Grants rounds and Endorsement admission live in the modules repository and settle through this runtime. A module install that keeps any action stores the `get_code_hash` pin for that account. Direct module-key calls do not pass the sender check. `confirmext` stores a DAO-confirmed external payment statement and does not pay. `payroll::settle` pays every installment that is already due on that schedule.

The API serves the versioned routes in `protocol/routes.ts`, with additional provider/billing response references in `protocol/service-api.ts`. PostgreSQL migrations 001–021 include content/payments, account-control intents, paired native/EOA sign-in, Telegram OIDC, credential provenance/history, return destinations and wallet-only accounts. Applied migration bytes are immutable. The actual seven-migration schema is exercised by the upgrade test before current migrations are applied.

User-controlled accounts keep signing and decryption keys in the browser. Managed recovery is an OpenBao development boundary, not a production custody operation. Hosted files can use Pinata when `PINATA_JWT` and `CONTENT_GATEWAY` are set in the gitignored environment file. The uploader uses the public network and does not send a group id.

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

`npm test` does not run `tests/integration`, `tests/providers`, or `tests/native`. Those are `npm run test:integration`, `npm run test:providers`, and `npm run test:native`. Integration tests require an isolated database whose name ends in `_test`. Native qualification uses both `test:native:research` and `test:native:paid` with their matching owned fixture bundles; their bootstrap/payment setup is deliberately different. See the 0.5 upgrade runbook. Browser journeys are run from the frontend repository. Builds and tests run locally. GitHub verification workflows are manual-only, so pushing source does not start CI. See [manual Netlify uploads and hosted-testnet development](docs/development.md#local-builds-and-manual-netlify-uploads).

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

`npm run price:tlos -- <profile> <minor-units>` quotes TLOS from Delphi `tlosusd` plus 20 percent. `1000` means 10.00 USD. DAO setup is contract-priced at $20 shared or $50 independent, with blockchain resources charged separately for independent deployment. Independent self-service remains disabled. Optional account-service checkout uses the separately configured Stripe Price.

## Stripe

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` together, or leave all three unset. Prefer a restricted key, and use a different key for each environment. The card amount is the Stripe Price id, not a number in this repository.

`POST /v1/billing/checkout` starts a Checkout Session. `POST /v1/billing/stripe/webhook` is the fulfillment path. `GET /v1/billing/receipts` lists account receipts. A paid receipt does not change votes, permissions, withdrawals, treasury obligations, or storage entitlements. The procedure, the webhook events, and the cookie rules are in [Operations](docs/operations.md).

## Local API

`npm run dev` loads `.env` and listens on `API_PORT` (3008 in the examples). The frontend dev server proxies `/v1` to `127.0.0.1:3008`. `npm run dev:local` is the disposable native fixture API used by browser tests. `npm run native:start` starts that fixture chain. Do not reset a fixture that already holds state you need.

Secrets stay in the gitignored environment files. Use `.env.testnet` for the testnet API and `.env.deploy.testnet` only for the deployment key; the API refuses a deployer key. Do not print secrets or commit `.artifacts/deploy/*-keys.json`. The [operations guide](docs/operations.md) describes the planned Netlify frontend and separate mainnet/testnet API services on one Hetzner VM; source availability does not establish a deployed service.

## License

First-party code, contracts, SDKs and documentation are licensed under
**AGPL-3.0-only**. See [LICENSE](LICENSE) and [licensing and source obligations](LICENSING.md).
Third-party files retain their own licenses. Contributions remain owned by their authors.
