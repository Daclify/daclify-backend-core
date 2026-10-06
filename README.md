# Daclify V2 backend core

Antelope C++ runtime and Hub, the TypeScript API, PostgreSQL migrations, custody boundary, relayer host, shared protocol, generated public SDK, and the deploy tooling for develop, testnet, and production.

This repository is one of three private V2 repositories. The others are [daclify-backend-modules](https://github.com/Daclify/daclify-backend-modules) and [daclify-frontend](https://github.com/Daclify/daclify-frontend). In the normal local layout they are sibling directories. Six older repositories live beside them and are not this application. Core publishes the public protocol and SDK. The other two repositories consume those packages. They must not import the API, the database, or custody code.

The implementation is not a production release. `npm run package:release` still refuses publication. The acceptance register is [the work-package plan](docs/superpowers/plans/2026-10-05-daclify-v2-work-packages.md). Nothing in this README marks a package complete.

## Read next

- [Development checkouts and tests](docs/development.md) covers Node, bootstrap, the local fixture, and which suite proves what.
- [Operations](docs/operations.md) covers the three deploy profiles, testnet account names, Stripe, the TLOS quote, and the frontend network switch.
- [Implementation limits](docs/evidence/implementation-limits.md) records what has been exercised and what is still held.
- [Documentation index](docs/README.md) points at the plan, the architecture, and the generated reference.
- [Public protocol package](sdk/README.md) is the boundary other repositories import.
- [DAO presets and guarded agents](docs/dao-presets.md) covers the 0.2 feature, authority boundaries, compatibility and merge order.

## What is implemented

The runtime owns DAO identity, roles, governance credits, one native treasury asset per DAO, obligations, and native settlement. The Hub lists deployments. Decide, Works, and payroll live in the modules repository and settle through this runtime. A module install that keeps any action stores the `get_code_hash` pin for that account. Direct module-key calls do not pass the sender check. `confirmext` stores a DAO-confirmed external payment statement and does not pay. `payroll::settle` pays every installment that is already due on that schedule.

The API serves the versioned routes in `protocol/routes.ts`, plus the billing routes below, which are intentionally outside the packed route table. PostgreSQL migrations are `migrations/001_core.sql`, `migrations/002_hosted_content.sql`, and `migrations/003_service_payments.sql`. The first two are immutable. The third adds `service_payments` and is applied the next time the API starts. Do not edit a migration after a database has applied it.

User-controlled accounts keep signing and decryption keys in the browser. Managed recovery is an OpenBao development boundary, not a production custody operation. Hosted files can use Pinata when `PINATA_JWT` and `CONTENT_GATEWAY` are set in the gitignored environment file. The uploader uses the public network and does not send a group id.

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

`npm test` does not run `tests/integration`, `tests/providers`, or `tests/native`. Those are `npm run test:integration`, `npm run test:providers`, and `npm run test:native`. Integration tests require an isolated database whose name ends in `_test`. Browser journeys are run from the frontend repository. A green local `npm run verify` does not mean GitHub Actions has run. This launch does not use GitHub Actions.

## Deploy profiles

`npm run deploy -- <develop|testnet|production>` prints a plan and sends nothing. The profile files are the source of truth for names and resources. [Operations](docs/operations.md) explains the flags, the creator, and the stake.

| Role    | Develop       | Testnet        | Production   |
| ------- | ------------- | -------------- | ------------ |
| Creator | `eosio`       | `daclifyadmin` | `we`         |
| Runtime | `daclifycore` | `daclifycore1` | `core.we`    |
| Hub     | `daclifyhub`  | `daclifyhubv1` | `hub.we`     |
| Decide  | `decide`      | `daclifydecid` | `decide.we`  |
| Works   | `works`       | `daclifyworks` | `works.we`   |
| Payroll | `payroll`     | `daclifypayr1` | `payroll.we` |
| Relay   | `relay`       | `daclifyrelay` | `relay.we`   |
| Billing | `fees`        | `daclifyfees1` | `fees.we`    |

Testnet names are ordinary 12-character Telos accounts. Production keeps the `we` suffix. Develop uses the short fixture names. The script does not create the creator. Testnet `--commit` spends testnet TLOS. Production spends mainnet TLOS only with `--confirm`.

`npm run price:tlos -- <profile> <minor-units>` quotes TLOS from Delphi `tlosusd` plus 20 percent. `1000` means 10.00 USD. The repository does not store a product price.

## Stripe

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` together, or leave all three unset. Prefer a restricted key, and use a different key for each environment. The card amount is the Stripe Price id, not a number in this repository.

`POST /v1/billing/checkout` starts a Checkout Session. `POST /v1/billing/stripe/webhook` is the fulfillment path. `GET /v1/billing/receipts` lists account receipts. A paid receipt does not change votes, permissions, withdrawals, treasury obligations, or storage entitlements. The procedure, the webhook events, and the cookie rules are in [Operations](docs/operations.md).

## Local API

`npm run dev` loads `.env` and listens on `API_PORT` (3008 in the examples). The frontend dev server proxies `/v1` to `127.0.0.1:3008`. `npm run dev:local` is the disposable native fixture API used by browser tests. `npm run native:start` starts that fixture chain. Do not reset a fixture that already holds state you need.

Secrets stay in the gitignored environment files. Do not print them, and do not commit `.artifacts/deploy/*-keys.json`.
