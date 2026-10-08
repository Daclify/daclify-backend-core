# Operations

This is the operator guide for the three deploy profiles, the API environment files, Stripe Checkout, the TLOS service quote, and the frontend network switch. It describes the current development tree. It is not a production approval, and it does not move funds.

The account names and resource numbers below are the ones in `tools/deploy/environments/`. If this page and those files disagree, the files win. A dry run reads the chain and prints the plan. It does not send a transaction.

## Three profiles

| Profile      | Chain               | API environment | API file          | Deployment-only file     | Send flag   |
| ------------ | ------------------- | --------------- | ----------------- | ------------------------ | ----------- |
| `develop`    | Owned local fixture | `local`         | `.env`            | `.env.deploy.develop`    | `--commit`  |
| `testnet`    | Telos testnet       | `testnet`       | `.env.testnet`    | `.env.deploy.testnet`    | `--commit`  |
| `production` | Telos mainnet       | `mainnet`       | `.env.production` | `.env.deploy.production` | `--confirm` |

Deploy profile names and the API's `NETWORK_ENVIRONMENT` are different enums. The API accepts `local`, `testnet`, or `mainnet`. The deploy command accepts `develop`, `production`, or `testnet`.

Chain ids recorded in the profiles:

- Testnet Antelope chain id: `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`. This is the native chain id returned by `get_info`. It is not the Telos EVM chain id 41.
- Mainnet Antelope chain id: `4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11`.
- Develop reads its chain id from `.artifacts/native/network.json` when the fixture is running. The committed profile leaves `chainId` null for that reason.

`npm run deploy -- <profile>` is a dry run. The command refuses to start unless the RPC `get_info` chain id matches the profile. `--confirm` is accepted only for `production`. `--commit` is accepted only for `develop` and `testnet`. Using the wrong flag throws `CONFIRM_IS_PRODUCTION_ONLY` or `PRODUCTION_REQUIRES_CONFIRM`.

Each API example is complete and standalone: required database/chain/module settings plus commented SMTP, Telegram OIDC/Mini App, Pinata, Stripe, Google proof verification and optional docs assistant settings. Optional groups stay commented until credentials are available. Copy the matching example for a **new** setup; do not overwrite an existing configured file:

```sh
cp .env.testnet.example .env.testnet
cp .env.deploy.testnet.example .env.deploy.testnet
chmod 600 .env.testnet .env.deploy.testnet
```

For local development use `.env.example` or `.env.develop.example` as `.env`; the deployment key uses `.env.deploy.develop.example`. Production uses `.env.production.example` and `.env.deploy.production.example`. Every actual env file is ignored; only examples are tracked.

There is one API configuration per network. `.env.testnet-api` is obsolete. `.env.deploy.testnet` contains **only** `DEPLOYER_PRIVATE_KEY`, not a second copy of the API settings. `npm run deploy -- testnet` reads it automatically; the creator/account/resource/RPC configuration comes from the committed deployment profile. The API loads `.env.testnet` and refuses to start if a deployer credential is present in its file or exported environment. Do not fall back to the API file to locate a missing deployment key.

`DACLIFY_ENV_FILE` is a shell selector, not a value inside the selected file. Existing shell variables take precedence. After changing runtime settings, restart the API; changing an env file alone does not reliably reload providers or keys.

## Account names

Telos documents an ordinary account as exactly 12 characters from `a-z` and `1-5`, with no dot. A shorter name, or a name that contains a dot, is a premium name. Only the owner of the suffix can create a dotted child. See [Telos accounts](https://docs.telos.net/zero/about/accounts/).

Production uses the premium suffix `we` because that name exists on Telos mainnet and is the intended creator. Testnet does not inherit mainnet name ownership. Account `we` is not on Telos testnet, so the testnet profile does not use `*.we`. The profile parser rejects a testnet creator or service account that is not exactly 12 ordinary characters.

The local fixture can create the short develop names because its `eosio` account is not running the Telos premium-name rule. Do not copy those short names onto testnet.

| Role                               | Contract  | Develop          | Testnet        | Production        |
| ---------------------------------- | --------- | ---------------- | -------------- | ----------------- |
| Creator, not created by the script | none      | `eosio`          | `3boidanimus3` | `we`              |
| Runtime                            | `runtime` | `daclifycore`    | `daclifycore1` | `core.we`         |
| Hub                                | `hub`     | `daclifyhub`     | `daclifyhubv1` | `hub.we`          |
| Decide                             | `decide`  | `decide`         | `daclifydecid` | `decide.we`       |
| Works                              | `works`   | `works`          | `daclifyworks` | `works.we`        |
| Payroll                            | `payroll` | `payroll`        | `daclifypayr1` | `payroll.we`      |
| Relay, no contract                 | none      | `relay`          | `daclifyrelay` | `relay.we`        |
| Billing, no contract               | none      | `fees`           | `daclifyfees1` | `fees.we`         |
| Grants, explicitly configured      | `grants`  | fixture-selected | `daclifygrant` | operator-selected |
| Endorsement, explicitly configured | `endorse` | fixture-selected | `daclifyendor` | operator-selected |
| Names, explicitly configured       | `names`   | fixture-selected | `daclifynames` | operator-selected |

On 2026-10-07 the user authorized a Telos testnet deployment from their funded `3boidanimus3` account. All seven base accounts, Grants (`daclifygrant`), Endorsement (`daclifyendor`) and Names (`daclifynames`) were created, with eight contracts installed. The user's funded account permissions were preserved. See [testnet evidence](evidence/2026-10-07-telos-testnet.md).

`DEPLOYER_PRIVATE_KEY` belongs in Git-ignored `.env.deploy.testnet`, mode `0600`. Keep it out of chat, frontend configuration and the running API environment. This workstation uses `.env.testnet` as its single API configuration. The script never creates the creator account. Missing creators fail before generating keys.

## Resources

The seven base accounts use the same resource allocations on testnet and production. The testnet profile additionally includes Grants, Endorsement and Names. The stake lines are transferred with `delegatebw` and `transfer` false, so the creator keeps ownership of the stake. Develop uses the bare resource model: the fixture has no `eosio.system` market, and the stake amounts are `0.0000 TLOS`.

| Account role        | RAM                  | CPU stake    | NET stake   | `eosio.code` on active |
| ------------------- | -------------------- | ------------ | ----------- | ---------------------- |
| Runtime             | 8,388,608 bytes      | 20.0000 TLOS | 5.0000 TLOS | yes                    |
| Decide              | 2,097,152 bytes      | 2.0000 TLOS  | 1.0000 TLOS | yes                    |
| Hub, Works, Payroll | 1,048,576 bytes each | 2.0000 TLOS  | 1.0000 TLOS | Works and Payroll only |
| Relay, Billing      | 16,384 bytes each    | 2.0000 TLOS  | 1.0000 TLOS | no                     |

The seven base buys total 13,664,256 bytes of RAM, 32.0000 TLOS of CPU stake, and 11.0000 TLOS of NET stake. The creator must already hold the 43.0000 TLOS of stake plus enough liquid TLOS to buy that RAM at the current chain price, and enough left over to pay the transaction. This page does not quote a RAM price. RAM price moves.

The three extra testnet accounts each buy 1,048,576 bytes of RAM and stake 2.0000 TLOS CPU plus 1.0000 TLOS NET. The complete ten-account plan totals 16,809,984 bytes of RAM and 52.0000 TLOS of stake, plus RAM purchase costs. The actual testnet setup spent 1,012.9303 dummy TLOS; this is historical evidence, not a future RAM quote.

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

Add `--commit` only after a develop or testnet dry run is the plan you want. Add `--confirm` only for a production send, and only when you intend to spend mainnet TLOS from `we`. Testnet `--commit` was used on 2026-10-07. No production broadcast has been sent. Deployment waits for each submitted block to become irreversible before sending dependent account/contract transactions. Public API writes also wait with a shorter bounded confirmation window; a timeout does not prove rejection. Resume the saved request and inspect authoritative state before retrying a payment.

## API environment

Start the API with the file you mean to load:

```sh
npm run dev
DACLIFY_ENV_FILE=.env.testnet npm run dev
DACLIFY_ENV_FILE=.env.production npm run dev
```

`npm run dev` loads `.env`. Set `MODULE_DEPLOYMENTS` to the deployed accounts for `decide`, `works`, `payroll`, `grants-rounds` and `endorsement-admission`. The testnet profile includes all five; production still requires explicitly reviewed extra accounts. Without configured module deployments, module reads stay empty and payroll settlement stays on `payob`.

`FRONTEND_ORIGIN` is the exact browser origin: an HTTPS origin for hosting, `http://127.0.0.1:5178` for the local fixture, or `http://testnet.localhost:5198` for this workstation's testnet app. With Netlify frontend and Hetzner API hosts, use HTTPS subdomains under the same site. `FRONTEND_ADDITIONAL_ORIGINS` is an optional JSON array of exact additional browser origins; the primary origin is always included. CORS and POST validation use the same list. Add the local developer origin only to testnet. No wildcards, paths, credentials or remote HTTP origins are accepted. When one frontend talks to two separate API hosts, both APIs must explicitly allow that frontend origin. See [local development and manual deployment](development.md#local-frontend-with-a-hosted-testnet-api).

Session cookies on an https API are `SameSite=None` and `Secure`, so the deployed frontend can call the API on another host. Local http cookies stay `SameSite=Strict`. This applies to every https deployment, including production login.

Hosted files need `PINATA_JWT`, `PINATA_ACCOUNT_ID` and `CONTENT_GATEWAY`. The gateway value is an https origin whose path is `/` only. The JWT stays in the gitignored environment file. `CONTENT_FREE_STORAGE_BYTES=0` refuses new uploads. The uploader uses the public Pinata network and does not send a group id. A private IPFS group is a Pinata Enterprise network and does not replace encryption in the browser.

## Stripe Checkout

Set these three together, or leave all three unset. A partial set refuses to start the API with `STRIPE_CONFIGURATION_INVALID`.

- `STRIPE_SECRET_KEY`: a restricted key (`rk_`) for that environment. A secret key is accepted by the parser. Prefer the restricted key. Use a different key for develop, testnet, and production.
- `STRIPE_WEBHOOK_SECRET`: the signing secret for this API's endpoint.
- `STRIPE_PRICE_ID`: the optional account-service Stripe Price id. Create that Price in Stripe and paste its id here. Shared creation is now free with 10 included active members and optional approved graduated monthly capacity; independent options show Contact for pricing. New hosting uses its separate product/destination configuration in [payment operations](operations/connected-payments.md).

Local and testnet APIs reject live Stripe keys. Only an explicitly configured mainnet API may use a live key. The configuration helper defaults to local when no environment is supplied. For local webhook forwarding, use the signing secret emitted by `stripe listen` for that listener; a separately registered Dashboard destination has its own secret. Keep all three settings in the Git-ignored environment file and select the same Stripe test account or sandbox for its key, Price and listener. The Price id is used by account service checkout; DAO setup checkout generates its amount from the captured creation order.

The checkout route is `POST /v1/billing/checkout`. It requires a session and the CSRF token. It is limited to 8 starts per account and 80 starts per process in each hour, separate from the chain-write limiter. The success URL is `<FRONTEND_ORIGIN>/account?billing=submitted` and the cancel URL is `<FRONTEND_ORIGIN>/account?billing=cancelled`. Those query values are notes to the screen. They are not a receipt.

The webhook is `POST /v1/billing/stripe/webhook`. Point Stripe at that path on the API host. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. The handler verifies the signature against the raw body. A paid receipt is written only for the two success events when `payment_status` is not `unpaid`. The failed event records a failure and does not downgrade a receipt that is already paid. Unknown event types are acknowledged and ignored. The route does not use the browser `Origin` header, because Stripe does not send one.

The Node SDK is `stripe` 22.4.0 and the API version is `2026-07-29.dahlia`. Account service Checkout Sessions omit `payment_method_types` and `automatic_tax`; DAO setup explicitly selects card payments. Ordinary repository tests use fixtures. Actual Stripe sandbox smoke verification is recorded separately below.

`GET /v1/billing/receipts` lists the signed-in account's rows. Migration `migrations/003_service_payments.sql` creates `service_payments`. The API applies a pending migration the next time it starts. The table is an account receipt. Writing it does not change `entitlements`, votes, permissions, withdrawals, or treasury obligations. Do not edit `001_core.sql` or `002_hosted_content.sql`. Do not edit `003` after a database has applied it.

If the three Stripe variables are absent, checkout and the webhook return `STRIPE_NOT_CONFIGURED`.

### Local Stripe test workspace

On 2026-10-07, the separate `daclify-testnet` Stripe CLI profile was authorized for Animusystems. Its private configuration is `.artifacts/stripe-test/config.toml`; the Daclify copy retains only the test API key. Credentials and the listener signing secret are stored in Git-ignored `.env.testnet` and `.env.stripe-test` files with mode `0600`. CLI authorization expires after 90 days and must be renewed. These credentials do not qualify production payments.

The initial local Stripe rehearsal used `http://localhost:5178`, API port 3008 and the isolated `daclify_stripe_test` PostgreSQL database. It used the owned local Spring chain on 20288 before the subsequently completed Telos testnet deployment. These are recorded fixture addresses, not the hosted deployment configuration. The original playground on 5188 is preserved. Hosted file storage is not configured in this separate payment workspace.

From core, start the API with `DACLIFY_ENV_FILE=.env.stripe-test npm run dev`. From frontend, use `DACLIFY_TEST_API_PORT=3008 DACLIFY_TEST_UI_PORT=5178 npm run dev`. Open the UI with hostname `localhost` to match its configured Origin and keep its cookies separate from the original `127.0.0.1` playground.

Keep local forwarding running:

```sh
stripe listen --config .artifacts/stripe-test/config.toml --project-name daclify-testnet \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed \
  --forward-to http://127.0.0.1:3008/v1/billing/stripe/webhook
```

Use the listener's current signing secret in both environment files; restart the API if that value changes. A permanently registered Stripe Dashboard destination requires a reachable public API URL and its own endpoint secret.

Actual sandbox verification completed: the application created a $20 USD service Checkout, Stripe confirmed `livemode: false` and a paid/completed session, the browser returned to Daclify and the signed webhook stored the paid receipt in PostgreSQL. A separate $20 shared DAO Checkout also completed; its webhook attested the payment on the local native contract and the paid order created a DAO. An invalid webhook signature was rejected with HTTP 400. The service Price is a test fixture; DAO checkout generates its captured setup amount independently. Private local evidence is under core/frontend `.artifacts/stripe-test/`. The initial browser automation needed corrections for navigation timing and capturing the vault before it was saved; the final service and DAO journeys passed. Declines, cancellation, 3DS, public Telos deployment and production Stripe remain separate qualification work.

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

## Provider settings and limits

Pinata requires `PINATA_JWT`, a stable `PINATA_ACCOUNT_ID` and an HTTPS root `CONTENT_GATEWAY` together. Set `CONTENT_FREE_STORAGE_BYTES` to a positive allowance before expecting uploads; `0` allows no new hosted bytes. Keys stay on the backend, and private documents are encrypted before public-IPFS upload. Configuration alone does not verify uploading, retrieval or decryption.

SMTP requires `SMTP_HOST` and `SMTP_FROM`, with `SMTP_USERNAME`/`SMTP_PASSWORD` together when authentication is used. `SMTP_PORT` defaults to 587 and `SMTP_TLS_MODE` to `starttls`; `tls` commonly uses 465. `local-plain` is limited to loopback under `NETWORK_ENVIRONMENT=local`, so a public-testnet profile cannot use a plaintext Mailpit fixture as real email delivery.

Telegram OIDC requires `TELEGRAM_OIDC_CLIENT_ID`, `TELEGRAM_OIDC_CLIENT_SECRET` and the exact `TELEGRAM_OIDC_REDIRECT_URI` ending `/v1/sign-in/telegram/oidc/callback`. The callback must use HTTPS for testnet/mainnet. Mini Apps require `TELEGRAM_BOT_TOKEN`; the legacy widget additionally needs `TELEGRAM_BOT_USERNAME` without `@`. OIDC does not require these separate bot-token fields in this adapter.

Google uses `GOOGLE_CLIENT_ID` plus `GOOGLE_PUBLIC_JWK` (a public RSA JWK, not an OAuth client secret). Complete browser login and provider-key rotation remain unqualified. `OPENBAO_URL`/`OPENBAO_TOKEN` are custody/provider-test inputs, not a switch that enables managed accounts in the regular API.

The optional handbook assistant needs a backend-only `OPENROUTER_API_KEY`. Its two model settings are independent:

```sh
OPENROUTER_DECISIONS_MODEL=openai/gpt-6-luna-decisions
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

These are the defaults when either model setting is absent or empty. Decisions selects the handbook topic through `POST https://openrouter.ai/api/alpha/decisions`; the chat model writes the reply through `/api/v1/chat/completions`. To explicitly retain Jev, set `OPENROUTER_DECISIONS_MODEL=typesafe/jev-1.13`. Model names receive syntax validation at startup; provider availability, permissions and credits are checked by the actual call, with failures exposed only as `DOCS_AGENT_FAILED`. Restart the API after changing its credentials or model settings. Generated documentation works without any AI provider.

As checked on 2026-10-07, [OpenRouter lists Luna Decisions](https://openrouter.ai/openai/gpt-6-luna-decisions) with a 1,050,000-token context window and [Jev](https://openrouter.ai/typesafe/jev-1.13) with 32,000. The assistant currently sends only the question and topic titles to Decisions, and one selected guide capped at 12,000 characters to the answer model. Changing the selector does not expand its inputs or grant access to vaults, balances, private documents, DAO records or transaction execution. Responses still need the existing handbook and topic-probability thresholds; calibrate them with representative support questions before broader rollout. Deterministic provider fixtures verify wiring and failure behavior; they do not establish live provider access or routing quality.

## Frontend development configuration

Frontend `.env.example` contains only public settings. The Vite dev server loads `DACLIFY_TEST_UI_PORT` and `DACLIFY_TEST_API_PORT` from the selected mode file, with shell values overriding it. For this testnet workspace:

```sh
# From daclify-frontend, for a new checkout only:
cp .env.testnet.example .env.testnet
npm run dev -- --mode testnet
```

This sets UI port 5198 and `/v1` proxy port 3028. It does not set the backend network or blockchain credentials. Keep the API's `FRONTEND_ORIGIN` aligned with the URL you open. Public `VITE_API_PRODUCTION` and `VITE_API_TESTNET` remain fallback origins only when `/networks.json` returns 404; the committed local-mode file keeps `/v1` proxy behavior. Never place private keys or provider credentials in frontend env files.

## What is still open

This tree is not a production launch. `npm run package:release` still refuses publication. The work-package checklists under `docs/superpowers/plans/` are the acceptance register, and they are not marked complete by this guide.

Still required before production:

- Complete public-testnet application/provider rehearsals and preserve their transaction evidence. Account/contract deployment, code hashes and narrow permission links have passed.
- Production still spends mainnet TLOS from `we` and still requires `--confirm`. It has not been sent.
- Testnet platform DAO 1 has the user-selected founding member, linked on-chain to `3boidanimus3`, under the standard community governance policy. The treasury asset is TLOS. Native account owner/upgrade authority remains separate from DAO governance and has not been transferred to a DAO.
- Configure a Price id, restricted key and signed webhook destination for each intended payment environment. Local PostgreSQL integration checks and actual Stripe sandbox receipt/DAO setup journeys have passed, including signed sandbox settlement and DAO fulfillment on public Telos testnet. Production Stripe payments and production database deployment remain unqualified.
- Rerun the native suite against the current runtime, and rerun the PostgreSQL and browser suites as a release gate. Local OpenBao is not production custody. An independent review is still required.
- Wire a chain watcher before a TLOS or Telos EVM transfer can be treated as a service payment. Do not add a second treasury symbol for an EVM asset.
- Shared creation is free; 10 active slots are included. Approved monthly extra slots use $1/$0.50/$0.20 graduated rates. Independent options show Contact for pricing. Historical captured paid setup orders retain their amount and 20% TLOS premium; recurring TLOS hosting is not implemented. Account-service checkout uses the configured Stripe Price; name-sale tier prices still need an explicit policy. Delphi has `tlosusd` and no EUR pair.

Still outside the current contracts: paid membership subscriptions, bounties, vesting, inbound dues, a global hackathon module owned by the project DAO, and delegated committee spending authority. Ordinary DAO membership and optional endorsement admission already exist. Core has per-obligation and UTC-day commitment limits; Decide has bounded representative elections and term records, which confer no administrative or spending authority. The legacy elections module stays in the legacy repository and is not ported. Hub is not the hackathon authority.

Pinata uploads work when `PINATA_JWT`, `PINATA_ACCOUNT_ID` and `CONTENT_GATEWAY` are set. They do not use a group id. Expired upload reservations that are uncertain stay reserved, record `UPLOAD_REVIEW_REQUIRED`, and are not unpinned. Google and Telegram live redirects are not qualified. The browser still targets one configured runtime.

For service/device loss, follow the [disaster recovery runbook](disaster-recovery.md). Wallet recovery preserves on-chain member IDs without depending on a service database backup; social pairings and operational history still require verified backups or explicit reconstruction.

## Hosted topology and recovery

The selected layout is a Netlify frontend and two independent Node API services behind HAProxy on one Hetzner VM. PostgreSQL 17 runs in Docker with a persistent volume; publish its port only on loopback. Each network needs a separate database, non-superuser role and private environment file. Do not grant one role access to the other network's database.

| Host                      | Destination                   |
| ------------------------- | ----------------------------- |
| `api.daclify.com`         | Mainnet API, `127.0.0.1:3018` |
| `testnet.api.daclify.com` | Testnet API, `127.0.0.1:3028` |
| `app.daclify.com`         | Netlify frontend              |
| `testnet.app.daclify.com` | Netlify testnet frontend      |

This is the agreed target, not evidence that DNS, certificates or the VM are configured. Mainnet must return an unavailable response until its own contracts/keys/providers are ready; never route its hostname to testnet. HAProxy must use exact host routes, reject unknown hosts and avoid retries of mutating requests. Sanitize forwarding headers at HAProxy and implement/test narrow Fastify proxy trust before relying on client-IP rate limits: the current API does not configure `trustProxy`, so it sees the loopback proxy as the client.

Automated API certificates need a tested ACME renewal timer and deploy hook that validates HAProxy configuration before reloading its combined certificate PEM. Netlify manages frontend certificates separately. Make DNS changes at the domain's current authoritative provider; being registered at Namecheap does not imply Namecheap DNS is authoritative.

The VM can clone/build all three sibling repositories from reviewed Git revisions. It does not require the Mac's API artifacts or database dump. Use the existing testnet contracts and chain configuration. Start fresh databases when service UUIDs/pairings/history are intentionally not retained, or restore a verified archive to preserve them. Follow [0.7 upgrade](operations/upgrade-0.7.md) and [disaster recovery](disaster-recovery.md). The Mac frontend makes outbound requests to the hosted testnet API; it has no public API address, tunnel or incoming connection requirement.

Encrypted automated PostgreSQL/configuration backups must be stored outside the VM, with retained decryption keys, retention/freshness monitoring and actual restore drills. Pinata ciphertext needs durable pins or another portable encrypted copy. A single VM is a shared failure domain for mainnet and testnet; two processes and two databases do not make it highly available.

## Current hosting and Connect configuration

The dated $20 sandbox examples above describe legacy flows, not current setup prices. Follow [connected payment operations](operations/connected-payments.md) for current shared/independent options, monthly approval, merchant onboarding, separate webhooks, live flags, broker tokens and billing recovery.

Resource development branch: mainnet and testnet require separate Pinata accounts and stable ownership IDs. The ledger keeps all provider file IDs and counts a verified CID once per DAO. See [storage accounting and legacy ownership reconciliation](storage-accounting.md) before upgrading an existing database. Automatic removal is disabled.
