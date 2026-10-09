# Deployed Telos token: owned native billing qualification

This extends the [receiving-wallet check](2026-10-09-receiving-wallet-ram.md) with the actual published Telos token binary and legacy sender-payer state. It does not authorize or certify a public deployment.

## Provenance and reproduction

`npx tsx tools/qualification/telos-token.ts` downloads only public code from the fixed mainnet/testnet sources. It checks both chain identities, code hashes before/after the download, actual WASM SHA-256 and raw ABI SHA-256, then decodes the ABI. A changed source refuses qualification. Downloads are bounded and redirects are rejected. No signing key is used.

Both sources returned token code `e7aa90a489446616f9bf0f1d0368f849722c7d36054d910e8f378ce9d2b618f1` and raw ABI `fb8452c70aa203505592aef25b696acaa1aee58805888cc9aae024b4c03af91e` on 2026-10-09. Recorded public blocks, chain IDs and sources are in the [measurement packet](2026-10-09-telos-token-ram.json). JSON ABI decoding/repacking changes its raw representation; the native test installs the original bytes with `eosio::setabi` and verifies the installed raw ABI and code hashes before testing.

Run `npm run test:native -- tests/native/token-ram.test.ts` on the exact owned `daclify-resources-native` fixture at `http://127.0.0.1:20588`. Preserve its wallet/configuration and pinned reference-token artifacts. The final run passed **6/6 cases, 0 skipped, in 36.07 seconds**: direct calibration plus new/legacy sender integration for each binary. Runtime code remains `f40c696e86ab532ca57ea073265a982f694f9f21f8de53300b51365e83711878`.

## Measurements

| Operation | Reference binary | Deployed Telos binary |
| --- | ---: | ---: |
| Sender's first payment to an unopened receiver | +368 bytes | +368 bytes |
| Receiver opens its own row | +240 receiver bytes | +240 receiver bytes |
| Full claim, runtime row opened before funding | -566 runtime bytes | -566 runtime bytes |
| Full claim, existing donor-funded runtime row | -438 runtime bytes | -438 runtime bytes |
| Instrumented DAO/meter change in either full claim | -566 bytes | -566 bytes |
| Legacy sender row changes payer on first payout | +128 runtime bytes | +128 runtime bytes |

The tests read the actual balance-row payer before/after payout. Standard `open` does not transfer an existing row's ownership. The legacy case reconciles `-566 + 128 = -438`: the extra 128 bytes are external operator infrastructure, not a historical DAO invoice. A receiver's own return transfer and close subsequently move/release externally paid row/header bytes without a Daclify callback.

In all four runtime cases, missing/closed receiving rows reject signed claim exits, signed stake exits and direct approved obligations without changing members, nonces, liabilities, holds, receipts, counters or native usage. Owner-authorized preparation pays 240 receiver bytes. Full signed claims complete at exact physical RAM quota; partial claims at that limit reject atomically. Subsequent stake exit needs no native growth, and approved direct payment completes once; replay rejects. Recipient and token-contract RAM remain unchanged during these payouts.

## Limits and failed attempts

The owned accounts use explicit finite managed quotas to isolate native billing/exhaustion from RAM-market setup spending. These tests do not prove resource acquisition; the separate RAM-purchase suite rejects managed receivers. A reduced 8 MiB setup initially failed because deploying the runtime needed 9,070,373 bytes. The corrected fixture provides 16 MiB before tightening it to actual usage. An earlier typecheck caught an unavailable SDK method, and that run was interrupted. Neither attempt is counted as qualification.

Actual Telos public transactions, chain configuration, arbitrary DAO token code, every historical lifecycle, live wallets/providers and immutable release packaging remain unqualified. Keep conservative completion holds and reviewed operator baselines. No public deployment, real payment, production authority change, funded-row closure or provider cleanup occurred.
