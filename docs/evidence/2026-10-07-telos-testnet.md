# Telos testnet rehearsal — 2026-10-07

This records an authorized public **testnet** deployment, not a production release. It uses native Antelope C++, not EVM contracts. Mainnet deployment and immutable package publication remain unqualified.

## Deployment

RPC: `https://testnet.telos.caleos.io`. Native chain ID: `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`. Spring reported `v1.2.2`. GET_SENDER, GET_CODE_HASH and CRYPTO_PRIMITIVES were confirmed activated through the live chain RPC before broadcasting.

The user supplied the funded creator `3boidanimus3` and a private local credential matching its existing `active` authority. The creator's authorities were preserved. Newly created accounts have separate generated active keys; their owner key is the supplied deployer's public key. Account ownership is not a platform DAO voting permission.

| Role | Account | Deployed WASM SHA-256 |
| --- | --- | --- |
| Runtime | `daclifycore1` | `35b7018872391f8eb883b7b75e1ecad91325bceaae77e9207fc5403c4b2838b0` |
| Hub | `daclifyhubv1` | `5f05cac05cd0bc3ea057402df7aef3e0c3fb3f9373094d1ad47605b377ab6bee` |
| Decide | `daclifydecid` | `94f0fe24dad8ef28e16f7d2fbae4485d46e7154df7594b2a298904beac28dd62` |
| Works | `daclifyworks` | `ae355df0647e244a059def9ddee0a2a54f4b5833d5e10e5dc337864d9a7e0a33` |
| Payroll | `daclifypayr1` | `efdceb30d194fbf7ed06f921e94cafe0de9fb7f9d6c11792507f2c2388108ffc` |
| Grants | `daclifygrant` | `e31202b04f590f98adbc001a7949889c39c576fec9aa81b83f64403cf6fd9f2c` |
| Endorsement | `daclifyendor` | `6b03c73787541cdb28446f981bdd31e42234f10f3f5b3bccc33c7ba750b86cbc` |
| Names | `daclifynames` | `fd9348525842ff918beb9db3e7c4aa5e8e9cbba2d0bf786836494c2c17cf5869` |
| Relay | `daclifyrelay` | No contract |
| Fee treasury | `daclifyfees1` | No contract |

All eight deployed code hashes and native ABI byte serializations matched the compiled artifacts, all five module hashes matched the producer SDK pins, and the contract accounts passed the existing RAM/CPU/NET floor assessment. The runtime has exactly the 57 producer-derived action links under `execctx`, whose authority contains only its own `eosio.code`; it has no keys or extra linked actions. All five modules have their own code authority. Permission verification read the actual chain state after initialization.

The ten-account resource plan requested 16,809,984 RAM bytes and 52.0000 TLOS in CPU/NET stake. Account creation and installation spent **1,012.9303 dummy TLOS**, leaving 104,534.3815 TLOS before application payment rehearsals. These amounts are observations, not a future RAM quote. Stake remains owned by the creator (`delegatebw` uses `transfer: false`).

## Initialization and platform administration

Runtime settings bind the actual chain/interface 1. Hub registration lists this runtime. Names is initialized, but no name-sale tier pricing has been invented. Five free first-party modules are listed with their deployed hash pins. Creation settings capture shared $20, independent $50 plus separate resources, and a 20% TLOS conversion premium. Independent self-service is still disabled.

Platform DAO **1** has the user-selected account `ea8725ba-243d-4dd4-8455-c9f6da55cbfe` as administrator member **1**, with native account `3boidanimus3` linked on-chain. Public signing/encryption keys were read from that registered account and validated with the canonical schema. No private vault key or recovery credential was requested. The enrollment required the runtime owner and native account authorizations. All five modules are enabled on this DAO with narrow producer action/grant pins and the standard community governance policy.

Direct native governance was exercised with `submitnat` updating platform metadata in transaction `710bc0e901a69c8b9e1f94f52004742044b13ea8c7e303ade3e52943c5dbfecb`. The member nonce advanced to 1. Platform enrollment transaction: `44e9f91f453c8018793f1911c32de42d62a3fdf4fed674a3d1f405c4e975ff47`. Native wallet pairing for **service sign-in** remains a separate authenticated Account-screen operation; on-chain membership does not insert a backend login credential.

Fee configuration transaction: `1e97b98ecddee6d6d4019780860535b7eeb87d4a0277457e34a46a4180e8c5f0`. Creation settings transaction: `18f3228f01bf60f4ee8447a14f49c9bfa3049c263f968adcda2583b6b6597f95`. Initial live Delphi quote transaction: `69c5d3d7655a45361d40ef71e94fb643d70fb13557fbd50b9b158c5f410cc3a1`. A local worker refreshes from the bounded testnet Delphi observation every five minutes; stale/failed reads do not produce synthetic rates or bypass the 900-second freshness check.

## Local app connected to public testnet

The filenames/commands below record the initial rehearsal. The later [environment cleanup](../operations.md#three-profiles) replaces `.env.testnet-api` with one API `.env.testnet` and a key-only `.env.deploy.testnet`. Use that guide for current startup commands.

- UI: `http://testnet.localhost:5198/`; Status: `/status`; Account: `/account`.
- API: loopback port 3028, PostgreSQL database `daclify_telos_testnet` on the owned port-17432 server.
- API starts with `DACLIFY_ENV_FILE=.env.testnet-api npm run dev`. This separate ignored file excludes the funded deployer key. It contains the test runtime operator/relay credentials, so this remains a trusted local test process, not production permission isolation.
- UI starts from frontend with `DACLIFY_TEST_API_PORT=3028 DACLIFY_TEST_UI_PORT=5198 npm run dev -- --host 127.0.0.1 --force`.
- `.env.testnet` and `.artifacts/deploy/testnet-keys.json` stay private, ignored and mode `0600`. Back up the generated keys privately. A second private copy is retained in the isolated deployment worktree.
- The earlier local playground on 5188 and local Stripe prototype on 5178 are preserved. The distinct `testnet.localhost` host isolates browser cookies. Playwright confirmed that browser origin is a secure context and that Status reports the public chain, shared creation ready and fresh quotes.
- Stripe sandbox credentials use the separately authorized Animusystems account, not the untouched Banana Ventura CLI default. A separate CLI listener forwards signed events to port 3028; its signing secret was saved privately and the API restarted. It is a local forwarding session, not a permanent public webhook endpoint.

Restarting a Stripe listener can rotate its signing secret. Update the API environment and restart it. Do not copy a secret from an unrelated listener. Do not use live keys for local/testnet; the existing configuration guard rejects them.

## Failures found and validation

The public RPC accepted account creation, then a subsequent request hit a node that had not observed it. Runtime deployment and Hub account creation had succeeded before the missing-actor response. Generated keys were preserved, the plan was resumed, and existing accounts/code were not recreated. Deployment now confirms submitted blocks before dependent transactions. The same read-after-write lag was reproduced as `CREATION_ORDER_PENDING` in a real browser order. Both native API write paths now have bounded public-chain confirmation waits; local owned fixtures keep their immediate path. Timeouts preserve their typed unavailable status rather than being mislabeled contract rejection. No timeout is treated as permission to pay twice.

Checks run successfully after the code fixes: **392 core tests across 58 files**, lint, TypeScript, documentation generation check, format check; core build also passed. Tests cover optional Names deployment, duplicate/wrong-role rejection, delayed confirmation, stalled confirmation and typed error preservation. No contract source or ABI changed in this deployment work.

A browser-harness attempt lost its session-storage CSRF state when creating a new browser context, correctly receiving `CSRF_REQUIRED`. Re-authentication through the saved encrypted vault fixed the harness. It was not an authorization bypass or application defect.

## Native TLOS paid-creation browser rehearsal

The actual UI registered a synthetic user-controlled account, created a standard community setup order, quoted **1,243.5234 dummy TLOS** for $20 with the 20% premium, resumed the paid order, and fulfilled it as DAO **4899240341166052780** on `daclifycore1`. The request ID is `8f895604-c365-4b77-bff3-fb4617ab5997`. Payment transaction: `409dbae1fd1c3fe6029c1dc060079df3f0a8e5d2786bd33e65f5106c9ad9e4fc`. Authoritative order state progressed `awaiting-payment` → `paid` → `created`. This is separate from the user's platform administration identity. No native account was created for the synthetic DAO member.

The fresh order creation and fulfillment completed through the running API after the bounded-confirmation fix, rather than relying on the earlier pending-response recovery. Browser state/recovery artifacts remain private and ignored. Public evidence and hashes are recorded here.

## Stripe sandbox paid-creation browser rehearsal

The same synthetic browser account created a separate $20 card order, request **0f241a15-db41-43db-904e-e4392307422f**. Before payment, the source-owned Stripe client retrieved the session and verified `livemode: false`, currency `usd`, amount `2000` cents and the matching order metadata. Hosted Checkout accepted Stripe's public dummy 4242 card, returned to the testnet app, and the dedicated CLI listener reported a **200** signed-webhook response.

A fresh SDK read confirmed session **cs_test_a1CmjL70f1bqffCoUSJlUWwAfM23TnXJQezRul7sKkqIV6NGP1BkyxMWCt** had `payment_status: paid`, `status: complete` and `livemode: false`. The actual API attested settlement on public testnet, and the UI fulfilled the paid order as DAO **10462019581746745784**. No live charge or TLOS setup-fee transfer was used for this card order. This verifies the real sandbox → signed webhook → public native contract → browser fulfillment boundary; it does not qualify production Stripe or unrelated provider/module flows.

## Remaining qualification

Pinata, Google, Telegram, managed recovery and a permanent hosted frontend/API/webhook remain unconfigured or unqualified. Actual Anchor/client-wallet and EVM-wallet provider flows, full public-testnet module lifecycles, independent provisioning, production custody/resource operations, independent review and immutable publishing gates remain separate work. Local/provider/emulator passes do not qualify these boundaries. Existing immutable release manifests were not rewritten.
