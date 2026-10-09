# Receiving-wallet RAM qualification — 2026-10-09

The user confirmed that receiving wallets prepare their own native token balance rows and pay that RAM. The runtime now checks the exact symbol and precision in the token contract’s `accounts` table before every claim withdrawal, stake exit, direct obligation payment and fee/publisher transfer. Internal claim credits remain independent of recipient token rows. Missing or closed rows reject atomically with `PAYOUT_TOKEN_ROW_REQUIRED`.

## Exact native fixture

- Owned Spring 1.2.2: `daclify-resources-native`, `http://127.0.0.1:20588`; chain `d9f6e8c655703ba364f0ee82b4fd0631350475747b1924396c8fbef2558b8f51`.
- Runtime WASM: `f40c696e86ab532ca57ea073265a982f694f9f21f8de53300b51365e83711878`.
- Runtime raw ABI: `a7f5fe4b28aa5cd33ac243ee2baf2a9c78dae7f20b9009f35523754c30561051`; unchanged from the preceding checkpoint. No serialized row, action shape or signed instruction domain changed.
- Reference token source: AntelopeIO/reference-contracts `c526479a48370981a1e9f0ac6b3bb0e4f737afa2`; compiled token WASM `ea1bd149e28f21420450b6c7b2c5be600ef9922e44c383fa4489b025aac0eb46`.
- Native data: [receiving-wallet report](2026-10-09-receiving-wallet-ram.json). The lightweight `testtoken` fixture is not the RAM oracle.

Run `npm run test:native -- tests/native/token-ram.test.ts` against that exact owned fixture. The final run passed both test cases in 9.80 seconds. One calibrates direct token payer changes; the other exercises Daclify’s signed claim/stake exits and direct approved payments with actual runtime/token/module binaries and native permissions.

## Verified behavior

Before funding, the operator opened the runtime’s token row under runtime authority. An internal claim, a native member’s governance stake and a separate approved native obligation were then created. Native quota was capped at exact physical usage after the system’s managed-quota control row was allocated.

Missing and closed recipient rows refused all three financial paths. Complete member/obligation/DAO/hold/receipt/counter snapshots and runtime native usage stayed unchanged, including signing nonces. Receiver-funded `open` allocated 240 bytes to the receiver and none to the runtime. A partial claim withdrawal at the exact physical limit refused without changing state.

The signed full claim exit succeeded and advanced its nonce once. It reclaimed 566 runtime bytes in this fixture and exactly matched the change in scoped counters plus observer metadata. The other pending obligation retained its reserve; that retained table header explains why this is different from an isolated-claim measurement. This delta is evidence for this state, not a universal price or fixed payout tariff.

The signed stake exit then cleared its stake and advanced its own nonce without native runtime growth. The approved native obligation paid once; retry refused `NOT_PAYABLE`. Its native usage change also reconciled with instrumented counters. Receiver and token-contract RAM remained unchanged across these payouts.

Compiled-WASM regressions separately cover claim/stake nonce rollback, direct native obligation retries, exact standard `open` ABI encoding and chain/receiver/precision validation. The module-purchase regression proves that a missing publisher row rolls back the buyer transfer and an earlier platform fee share together. UI wallet tests cover exact owner-funded actions, cancellation and changed account/network/recipient/token consent context. The rendered Treasury check proves the preparation step is available with a locked vault and late DAO responses cannot offer payments in another DAO.

## Local repository checks

The final consumed packet passed core lint/types/docs and **527 tests in 93 files**; modules lint/types/docs and **142 tests in 26 files**, using the exact current runtime WASM; and frontend lint/Vue types and **128 tests in 30 files**. Core/modules TypeScript builds and frontend Vue/Vite build passed. Tarball SHA-512 values match all three lock files, and runtime/Archive code identities agree. These are local development artifacts, not immutable releases.

PostgreSQL integration, full browser journeys and live providers were not rerun for this packet. Rendered Vue checks and wallet unit tests cover the changed UI; earlier browser/recovery evidence retains its original identities.

## Upgrade and release limits

The modules packet retains the preceding `6ad460…` runtime document decoder under its exact raw-ABI/schema identity; arbitrary identity changes remain rejected. Existing Archive bundles keep their original ciphertext, epoch metadata, scope and packed rows. No old executable module approval was rewritten.

A standard `open` call does not change the payer of an existing balance row. Historical sender rows can therefore still change payer on first outgoing transfer; their baseline/reconciliation remains a separate qualification gate. Unknown custom-token code and Telos public token code are not qualified by this fixture. The conservative completion reserve remains intact.

The fixture issuer has finite dummy supply. Its helper now caps top-ups at the actual remaining supply and permits an already-funded account to continue when no tokens can be minted. It refuses an empty exhausted issuer. Synthetic funding is restricted to the recorded owned container, endpoint and chain; it is not a production economic simulation.

Live Stripe/Pinata/gateway/wallet tests, full supported historical lifecycle combinations, immutable release qualification and production deployment remain held. This evidence authorizes none of those operations and no main merge or push. Earlier browser/population/private recovery evidence retains its original code hashes.
