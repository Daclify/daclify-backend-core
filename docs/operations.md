# Operations

This is the operator guide for the three deploy profiles, the API environment files, Stripe Checkout, the TLOS service quote, and the frontend network switch. It describes the current development tree. It is not a production approval, and it does not move funds.

The account names and resource numbers below are the ones in `tools/deploy/environments/`. If this page and those files disagree, the files win. A dry run reads the chain and prints the plan. It does not send a transaction.

## Three profiles

| Profile      | Chain                                              | API environment value | Environment file  | Send flag   |
| ------------ | -------------------------------------------------- | --------------------- | ----------------- | ----------- |
| `develop`    | Local fixture at `http://127.0.0.1:18888`          | `local`               | `.env`            | `--commit`  |
| `testnet`    | Telos testnet at `https://testnet.telos.caleos.io` | `testnet`             | `.env.testnet`    | `--commit`  |
| `production` | Telos mainnet at `https://telos.caleos.io`         | `mainnet`             | `.env.production` | `--confirm` |

Deploy profile names and the API's `NETWORK_ENVIRONMENT` are different enums. The API accepts `local`, `testnet`, or `mainnet`. The deploy command accepts `develop`, `production`, or `testnet`.

Chain ids recorded in the profiles:

- Testnet Antelope chain id: `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`. This is the native chain id returned by `get_info`. It is not the Telos EVM chain id 41.
- Mainnet Antelope chain id: `4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11`.
- Develop reads its chain id from `.artifacts/native/network.json` when the fixture is running. The committed profile leaves `chainId` null for that reason.

`npm run deploy -- <profile>` is a dry run. The command refuses to start unless the RPC `get_info` chain id matches the profile. `--confirm` is accepted only for `production`. `--commit` is accepted only for `develop` and `testnet`. Using the wrong flag throws `CONFIRM_IS_PRODUCTION_ONLY` or `PRODUCTION_REQUIRES_CONFIRM`.

Copy the matching example before filling secrets:

- `cp .env.develop.example .env`
- `cp .env.testnet.example .env.testnet`
- `cp .env.production.example .env.production`

Those copies are gitignored. Do not commit them. The examples contain placeholders, not keys.

## Account names

Telos documents an ordinary account as exactly 12 characters from `a-z` and `1-5`, with no dot. A shorter name, or a name that contains a dot, is a premium name. Only the owner of the suffix can create a dotted child. See [Telos accounts](https://docs.telos.net/zero/about/accounts/).

Production uses the premium suffix `we` because that name exists on Telos mainnet and is the intended creator. Testnet does not inherit mainnet name ownership. Account `we` is not on Telos testnet, so the testnet profile does not use `*.we`. The profile parser rejects a testnet creator or service account that is not exactly 12 ordinary characters.

The local fixture can create the short develop names because its `eosio` account is not running the Telos premium-name rule. Do not copy those short names onto testnet.

| Role                               | Contract  | Develop       | Testnet        | Production   |
| ---------------------------------- | --------- | ------------- | -------------- | ------------ |
| Creator, not created by the script | none      | `eosio`       | `daclifyadmin` | `we`         |
| Runtime                            | `runtime` | `daclifycore` | `daclifycore1` | `core.we`    |
| Hub                                | `hub`     | `daclifyhub`  | `daclifyhubv1` | `hub.we`     |
| Decide                             | `decide`  | `decide`      | `daclifydecid` | `decide.we`  |
| Works                              | `works`   | `works`       | `daclifyworks` | `works.we`   |
| Payroll                            | `payroll` | `payroll`     | `daclifypayr1` | `payroll.we` |
| Relay, no contract                 | none      | `relay`       | `daclifyrelay` | `relay.we`   |
| Billing, no contract               | none      | `fees`        | `daclifyfees1` | `fees.we`    |

On 2026-10-06, `get_account` against `https://testnet.telos.caleos.io` reported `daclifyadmin`, `daclifycore1`, `daclifyhubv1`, `daclifydecid`, `daclifyworks`, `daclifypayr1`, `daclifyrelay`, and `daclifyfees1` as absent. `daclifyhub11` already existed, which is why the hub account is `daclifyhubv1`. A later occupant would show up in the dry run. The script does not replace an existing account.

Create and fund `daclifyadmin` on Telos testnet before the first testnet `--commit`. Use a testnet account creator, not the mainnet wallet flow. Fund it from the Telos Zero testnet faucet described at [Telos faucets](https://docs.telos.net/build/faucets/). Put that account's private key in `DEPLOYER_PRIVATE_KEY` inside `.env.testnet`. The script never prints the key. It also never creates the creator. If the creator is missing, the dry run says so and a send throws `CREATOR_MISSING` before any key file is written.

## Resources

Testnet and production buy the same RAM and stake the same CPU and NET. The stake lines are transferred with `delegatebw` and `transfer` false, so the creator keeps ownership of the stake. Develop uses the bare resource model: the fixture has no `eosio.system` market, and the stake amounts are `0.0000 TLOS`.

| Account role        | RAM                  | CPU stake    | NET stake   | `eosio.code` on active |
| ------------------- | -------------------- | ------------ | ----------- | ---------------------- |
| Runtime             | 8,388,608 bytes      | 20.0000 TLOS | 5.0000 TLOS | yes                    |
| Decide              | 2,097,152 bytes      | 2.0000 TLOS  | 1.0000 TLOS | yes                    |
| Hub, Works, Payroll | 1,048,576 bytes each | 2.0000 TLOS  | 1.0000 TLOS | Works and Payroll only |
| Relay, Billing      | 16,384 bytes each    | 2.0000 TLOS  | 1.0000 TLOS | no                     |

The seven buys total 13,664,256 bytes of RAM, 32.0000 TLOS of CPU stake, and 11.0000 TLOS of NET stake. The creator must already hold the 43.0000 TLOS of stake plus enough liquid TLOS to buy that RAM at the current chain price, and enough left over to pay the transaction. This page does not quote a RAM price. RAM price moves.

The owner key of each created account is the deployer public key. The active key is generated, written to `.artifacts/deploy/<profile>-keys.json` with mode `0600` before the first broadcast, and reused on a later run. A dry run does not generate keys. `RELAY_PRIVATE_KEY` in the API environment comes from that file for the relay account. Do not commit the key file.

`--set-contract` adds contract installation to the plan for accounts whose `contract` field is set. Relay and billing stay key-only accounts. Installation signs `setcode` and `setabi` with the new account's owner key. On the local fixture, accounts that already exist under a different owner will not accept that installation. Do not run `develop --set-contract --commit` against the current fixture.

## Commands

From `daclify-backend-core`, with Node 24.21 or later and npm 11.19 or later:

```sh
npm run deploy -- develop
npm run deploy -- testnet
npm run deploy -- production
npm run price:tlos -- testnet 1000
```

`1000` is the USD amount in minor units, so this asks for a quote of 10.00 USD. The command reads Delphi pair `tlosusd` at precision 4, adds the 2000 bps premium, and refuses a median older than 900 seconds. There is no EUR pair on that oracle. A quote printed on one day is not a standing price. On 2026-10-06 the testnet median was 197 and the same command printed 609.1371 TLOS including the premium.

Add `--commit` only after a develop or testnet dry run is the plan you want. Add `--confirm` only for a production send, and only when you intend to spend mainnet TLOS from `we`. Neither flag has been used to broadcast this profile.

## API environment

Start the API with the file you mean to load:

```sh
npm run dev
DACLIFY_ENV_FILE=.env.testnet npm run dev
DACLIFY_ENV_FILE=.env.production npm run dev
```

`npm run dev` loads `.env`. Set `MODULE_DEPLOYMENTS` to the decide, works, and payroll accounts for that profile. Without it, module reads stay empty and payroll settlement stays on `payob`.

`FRONTEND_ORIGIN` is one https origin for a deployed API, or `http://127.0.0.1:5178` for local development. Both the testnet API and the production API must use the same origin when one deployed frontend talks to both. The browser sends that origin on ordinary requests. The API rejects a foreign origin.

Session cookies on an https API are `SameSite=None` and `Secure`, so the deployed frontend can call the API on another host. Local http cookies stay `SameSite=Strict`. This applies to every https deployment, including production login.

Hosted files need `PINATA_JWT` and `CONTENT_GATEWAY`. The gateway value is an https origin whose path is `/` only. The JWT stays in the gitignored environment file. `CONTENT_FREE_STORAGE_BYTES=0` refuses new uploads. The uploader uses the public Pinata network and does not send a group id. A private IPFS group is a Pinata Enterprise network and does not replace encryption in the browser.

## Stripe Checkout

Set these three together, or leave all three unset. A partial set refuses to start the API with `STRIPE_CONFIGURATION_INVALID`.

- `STRIPE_SECRET_KEY`: a restricted key (`rk_`) for that environment. A secret key is accepted by the parser. Prefer the restricted key. Use a different key for develop, testnet, and production.
- `STRIPE_WEBHOOK_SECRET`: the signing secret for this API's endpoint.
- `STRIPE_PRICE_ID`: the Stripe Price id. The repository does not contain a dollar amount. Create the Price in Stripe and paste its id here.

The checkout route is `POST /v1/billing/checkout`. It requires a session and the CSRF token. It is limited to 8 starts per account and 80 starts per process in each hour, separate from the chain-write limiter. The success URL is `<FRONTEND_ORIGIN>/account?billing=submitted` and the cancel URL is `<FRONTEND_ORIGIN>/account?billing=cancelled`. Those query values are notes to the screen. They are not a receipt.

The webhook is `POST /v1/billing/stripe/webhook`. Point Stripe at that path on the API host. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. The handler verifies the signature against the raw body. A paid receipt is written only for the two success events when `payment_status` is not `unpaid`. The failed event records a failure and does not downgrade a receipt that is already paid. Unknown event types are acknowledged and ignored. The route does not use the browser `Origin` header, because Stripe does not send one.

The Node SDK is `stripe` 22.4.0 and the API version is `2026-07-29.dahlia`. Checkout Sessions are created without `payment_method_types` and without `automatic_tax`. No live Stripe call is part of this repository's checks.

`GET /v1/billing/receipts` lists the signed-in account's rows. Migration `migrations/003_service_payments.sql` creates `service_payments`. The API applies a pending migration the next time it starts. The table is an account receipt. Writing it does not change `entitlements`, votes, permissions, withdrawals, or treasury obligations. Do not edit `001_core.sql` or `002_hosted_content.sql`. Do not edit `003` after a database has applied it.

If the three Stripe variables are absent, checkout and the webhook return `STRIPE_NOT_CONFIGURED`.

## TLOS service payments

The billing account receives service TLOS. On testnet that account is `daclifyfees1`. On production it is `fees.we`. On the fixture it is `fees`, which this guide does not create.

A Zero payer would use the memo `svc:<reference>`. An EVM payer withdraws through `eosio.evm::withdraw`, which has no memo; the classifier treats the withdraw signer as the payer. That classifier is not wired to a chain watcher. A TLOS transfer does not create a Stripe receipt, does not settle a DAO obligation, and does not change votes or storage. Excess TLOS above the quoted amount is a tip. Underpayment does not grant the service, because nothing in this release grants the service from a chain transfer.

## Frontend switch

Local `daclify-frontend/public/networks.json` is `{ "mode": "local" }`. The app then calls relative `/v1` URLs, and Vite proxies them to `127.0.0.1:3008`. The service-network switch stays hidden. The CSRF token is stored at `daclify.csrf`.

A deployed server replaces that file with two https origins and no other fields:

```json
{
  "production": "https://api.example",
  "testnet": "https://testnet-api.example"
}
```

Each value must be an https origin with no userinfo, no path other than `/`, and no search or hash. The switch then shows Production and Testnet. The choice is stored at `daclify.network` and defaults to production. Fetches are prefixed with the selected origin. CSRF tokens are stored separately at `daclify.csrf.production` and `daclify.csrf.testnet`, because one browser is talking to two API hosts. Cookies remain host-only.

The committed `networks.json` must stay in the repository. Vite's SPA fallback would otherwise serve `index.html` for a missing file. `VITE_API_PRODUCTION` and `VITE_API_TESTNET` are used only when `/networks.json` returns 404.

The account screen can start a card checkout when the API has Stripe configured. It redirects only to `https://checkout.stripe.com`. Refreshing the receipt reads `GET /v1/billing/receipts`. The screen copy states that the receipt does not change votes, permissions, withdrawals, or a DAO treasury.

## What is still open

This tree is not a production launch. `npm run package:release` still refuses publication. The work-package checklists under `docs/superpowers/plans/` are the acceptance register, and they are not marked complete by this guide.

Still required before a public Telos deployment:

- Create and fund testnet `daclifyadmin`, review a fresh dry run, and only then decide to `--commit`. That broadcast has not been sent.
- Production still spends mainnet TLOS from `we` and still requires `--confirm`. It has not been sent.
- Name the founding member of the project DAO before anyone creates it. The treasury asset for that DAO is TLOS. Governance is integer credit weights. The DAO does not become the runtime upgrade key unless that authority is assigned later.
- Put a real Stripe Price id, restricted key, and webhook on each environment that should charge. No charge has been created from this tree. The `service_payments` SQL has not been executed against a live database here. The Postgres settlement path is covered by the same decision function as the unit tests and has not itself been run on PostgreSQL.
- Rerun the native suite against the current runtime, and rerun the PostgreSQL and browser suites as a release gate. Local OpenBao is not production custody. An independent review is still required.
- Wire a chain watcher before a TLOS or Telos EVM transfer can be treated as a service payment. Do not add a second treasury symbol for an EVM asset.
- Choose no SKU amount in the repository. Delphi has `tlosusd` and no EUR pair. A contract-stored USD or EUR price is not implemented. The Stripe Price id is the card amount.

Still outside the current contracts: memberships, bounties, vesting, inbound dues, a budget cap, a global hackathon module owned by the project DAO, and committee seats. Seat counts and terms are not chosen. The legacy elections module stays in the legacy repository and is not ported. Hub is not the hackathon authority.

Pinata uploads work when `PINATA_JWT` and `CONTENT_GATEWAY` are set. They do not use a group id. Expired upload reservations that are uncertain stay reserved, record `UPLOAD_REVIEW_REQUIRED`, and are not unpinned. Google and Telegram live redirects are not qualified. The browser still targets one configured runtime.
