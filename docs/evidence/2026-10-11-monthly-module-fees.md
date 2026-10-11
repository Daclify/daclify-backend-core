# Testnet monthly module fees and encrypted documents — 2026-10-11

## Deployed result

The expressly requested rollout activated monthly module prices on the shared Telos testnet runtime, API and frontend. All existing first-party modules remain free through **10 active members**, including managers. Above ten, prices are per DAO per calendar month, separately from membership capacity, storage and work funding:

| Module | Monthly USD |
| --- | ---: |
| Decide | $2 |
| Works | $3 |
| Payroll | $3 |
| Grants | $2 |
| Endorsement | $1 |
| Community Activity | $1 |
| All six | $12 |

Administrators explicitly purchase and renew one month. No automatic subscription or future card charge was enabled. Only new activity requires paid access; existing voting, work completion, reviews, cancellations and payouts retain their existing authorization rules. Login, recovery, pairing and encrypted documents are independent of module access fees. See [the operational guide](../operations/module-fees.md).

The public [testnet Pricing page](https://testnet.app.daclify.com/pricing) reads the current native prices. Administrators manage access from DAO Settings → Hosting and payments → Manage module access. Actual public `/v1/modules/pricing`, `/v1/network`, `/health` and `/v1/sign-up/options` reads confirmed six governed rates, freeMembers 10, the new core version, healthy API and available assisted signup. The recovery service and credential agent remain active; Names successfully refreshed using the new source and its timer remains active.

## Exact deployed artifacts and preservation

| Component | Deployed version / source |
| --- | --- |
| Core API / public SDK | `0.13.0-alpha.7`; `98a533e` |
| Modules public SDK | `0.9.0-alpha.23`; `91874e8` |
| Frontend | `0.13.0-alpha.9`; `76e8c76` |
| Existing module contracts | `0.9.0-alpha.5`, unchanged binaries and pins |
| Chain ID | `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f` |
| Runtime | `daclifycore1` |

Core WASM SHA-256: `b0c1826a210d273b3250915b7db0a4c1a4cc70be465153195b52febfb3272fb4`.

Raw native ABI SHA-256: `b4ef5b238da08e9934a0b89ba1ead01a7e66cc2b45eac11f06f0aa759782ecb2`.

Consumer SDK archives: core `0b6c96964c433c8179c98085d51eab7967844417f8faaf91c1f98034f2f5e789`; modules `eed82d21355668e02874d6705a987c7bf9a6207f4fd4f27627715b7217d55d04`. The frontend's tracked archives match the producer artifacts. Earlier published artifacts were preserved.

The native upgrade, four missing action links and six governed prices were applied atomically in transaction `39a6a3534731c7109c796c4c4f4a4d2cd4a122fc8d319829900f382019d4a34b`, block **449681722**, subsequently verified irreversible. Before applying, the new ABI decoded and re-encoded **48 tables / 103 existing rows**, native simulation passed, and required keys were checked. Post-verification compared retained rows, every tracked owner/active authority and all six module code/ABI hashes. Only expected governance nonce/activity/RAM bookkeeping and the four explicit action links changed. No owner, active, issuer, recovery or signing key was replaced.

The private PostgreSQL backup contains 261,510 bytes, SHA-256 `dc9fa58b1f677a3615698fca46925ba31b67e34cd051bc2f82f0d05ea55ae8a0`. Matched source archives were installed under `/data/daclify-runtime/releases/20261011-module-fees`; the API and Names working directories now use that archive, and the frontend was built and published with old assets retained. Provider credentials remained private. The only API environment additions were module-fee enablement, the verified provider account ID and an explicit false live-payment flag.

The current security fixes on `dev` were merged before deployment. The separately edited Telos-governance/native-signup draft in the original checkouts was preserved. Module fee SQL uses **`040_module_fees.sql`**, leaving draft migration 039 distinct. The migration coordinator tracks each immutable file by name and hash; adding the separate earlier-numbered migration later does not rename or replay 040. Draft `0.14` / module `0.10` source was not deployed by this rollout.

The verified branches were fast-forwarded into remote **`dev`** in all three repositories; `main` was untouched. Local `dev` refs beneath the independent uncommitted draft were deliberately left unchanged. That draft still needs to merge the updated remote `dev`, regenerate fresh combined SDK artifacts and qualify its own subsequent rollout. The running services remain bound to the fee release archive.

## Actual Stripe sandbox and native access

All payment checks used the actual existing Stripe **sandbox**, hosted Checkout and SDK retrieval of the payment intent, captured charge and refund. No real card charge, provider plan upgrade or real-money transfer was made. A redirect, webhook payload or injected verifier was not accepted as proof.

The separate owned public DAO `5096066148960770562` enrolled eleven synthetic members. Its temporary capacity was an operator-provided **test grant**, not a paid hosting receipt. The earlier seven-member connected-app demonstration DAO and real communities were left unchanged.

- At eleven active members with no paid term, a signed Decide `open` failed with `MODULE_FEE_REQUIRED`; the native member nonce remained unchanged.
- Actual hosted Checkout collected a sandbox **$2** payment for order `25e454d7-2dd4-41b5-bfea-005d77f312fd`. The service independently verified the provider receipt and attested native term `dd7e2b3ec144425c4010c5197916e71fecacd0819848f1ebb52999c800add9d4`, expiry **1794423060**. Re-reading/reconciling the order preserved that exact expiry.
- Paid creation succeeded in transaction `046c3964fa6f5e7dd59a4004ea9535237693a174256be1e29c30c1d212bd0590`.
- An actual full sandbox refund revoked the matching term. A new poll again failed at eleven members without consuming the nonce. Voting on a poll created before refund still succeeded: `fcfe6797e903c5c0684dd5d2f8ad7c5d437d39453b2c8e8d404d3c2d3e0a4b4f`.
- Deactivating only synthetic member 11 restored the authoritative count to ten. A new unpaid poll succeeded: `5a379a0c47547c2d46c3e2094dac939067ad82942371cf8e8594d4bd82f6e357`.

All three fixture polls were subsequently finalized. At **2026-10-11T18:59:04.757Z**, the DAO had **zero active ballots**, ten active synthetic members and the refunded term remained revoked. The final two finalization transactions were `ce8054154c5161a51e9b360fdc9bda0757a8d6470b3cbe5aa7ec671a4f331ca0` and `ff4b96122a71d6df83e70827149696e8782070a8d2fd060f7cb4b7f091048245`. No temporary poll lock was left pending.

The calendar-month expiry, delayed retries, disputes, renewal and native expired-term behavior were also covered by local native/compiled-contract and PostgreSQL tests. A real month-long expiry or live-money dispute was not awaited or claimed.

## Live encrypted documents after upgrade

The owned private DAO `11278252133202098176` used a user-controlled member and encryption epoch 2. No community content or production keys were used.

The frontend encryption functions exercised the actual HTTPS API, Pinata provider, native private-document publication and downloaded ciphertext:

| Check | Observed result |
| --- | --- |
| Native document | ID 2, core `0.13.0-alpha.7` |
| CID | `bafkreidrcqrzebjxx4fniihsqh74cbtccushpl3feah4udzjnf75oqg4fe` |
| Stored bytes | 351 ciphertext bytes |
| Publication transaction | `a269dd2c2dda3eb5513717dfb2a7074aa07a2d84e1f98454746035bf159b4922` |
| Epoch grant unwrap and decryption | Original bytes matched |
| Stored metadata/content inspection | Plaintext and original filename absent; native metadata opaque |
| Wrong key / wrong DAO | Rejected |
| Anonymous upload | HTTP 401 |
| Same request retry | Same verified receipt |

An additional **actual deployed browser** test restored the owned member's encrypted kit through the Account UI, navigated within the unlocked app, encrypted and uploaded document **3**, signed publication, and used **Decrypt and download**. Downloaded bytes and filename matched, with no page errors. Completed at **2026-10-11T18:44:40.114Z**; plaintext SHA-256 `504eab090835131f821ce0896780825fcf490dd9fea1e0f3321d5c5ea04f7483`. This is browser/vault/API/provider/native evidence, rather than a mocked upload or server-side encryption test.

An earlier fixture-only byte assertion printed its unused epoch-1 key before publication. The diagnostic was redacted, the empty fixture rotated to epoch 2, and assertions changed to redacted boolean byte comparisons. No community documents or production keys were involved. The retained private fixture packets and logs are outside Git.

The actual deployed Pricing and authenticated Module Access pages passed on **1440×1000** and **390×844** viewports: all six current rates and $12 total, the ten-member free notice, no purchase buttons for the free DAO, no horizontal overflow, no page errors and zero main-region Axe violations. The existing public testnet browser suite also passed both viewports, including Hub, DAO and module/resource reads.

## Verification and measured costs

| Verification actually run | Result |
| --- | --- |
| Core fee candidate full unit/compiled-contract suite | 142 files / 882 tests passed |
| Core PostgreSQL suite after merging current security fixes | 34 files / 276 tests passed |
| Renumbered migration and fee HTTP checks | 2 files / 6 tests passed |
| Modules final `npm run verify` | Lint, typecheck, generated docs; 30 files / 179 tests passed |
| Frontend unit suite | 43 files / 276 tests passed |
| Core/frontend lint, type/template checks and builds | Passed; existing large-bundle warning remains |
| Desktop/mobile pricing, module-access and connected-app browser suite | 20 tests passed |
| Native permissions and member workflows | 136/138 initially passed; SDK compatibility correction followed by all 41 tests in the affected workflow file passing |
| Native fee permissions and pricing readers | 10 tests passed |
| Portable exact deployed alpha.6 → alpha.7 upgrade and connected apps | 2 files / 9 tests passed |
| Actual provider/browser/native checks above | Passed; sandbox payment fully refunded |

The core suite result precedes the security merge; the merged API was then checked through the full PostgreSQL suite, typecheck, lint and build. The original modules suite's outdated next-release rejection was corrected from alpha.7 to alpha.8, then the entire final modules verification passed. The older Docker-dependent upgrade command could not start without its fixture; the portable upgrade instead used the exact deployed alpha.6 WASM. No unsupported fixture or absent suite is reported as passed.

Pinned CDT **4.1.1 `-O=s`** produced core WASM **892,310 → 916,075 bytes** (+23,765, 2.66%). The final retained local native sample measured **261 RAM bytes / 10,199 µs CPU** for the first governed price and **269 RAM bytes / 437 µs CPU** for the first term; earlier samples were 3,937 µs and 391 µs respectively. These are individual local samples, not a load benchmark or latency guarantee. Prices are bounded to 32 plans and 16 creation actions; terms reuse one operator-funded row per module, have no secondary indexes and support bounded expired-row cleanup. Existing module binaries were preserved even where rebuilding with current size optimization produced different candidates.

## Recovery and remaining qualification

A new retained OpenBao 2.7.1 snapshot was restored while the original source service was unavailable. The original transit key was recovered, four least-privilege denials passed, audit logs excluded plaintext, and TLS was verified. Qualification is bound to exact core `0.13.0-alpha.7` and expires **2026-10-17T18:38:26.422Z**. The retained snapshot SHA-256 is `864da4580b6b13f5edf14d1fc96aaf75644c5d6bfd69dae9a6f719e51a3fd36f`. Assisted signup remains available with the explicit single-VM testnet warning.

The earlier AppRole bootstrap expires on **2026-10-17 at 14:46 UTC**, before this qualification; renew it first. This remains a single-VM testnet restore, **independentHost=false**. Mainnet, independent-host disaster recovery, real-money payments and general production release qualification remain unqualified. Pinata's confirmed free provider plan is shared across DAOs; no additional capacity was bought. The current shared gateway allowance still expires **2026-10-18T17:05:36.198Z**; see [testnet IPFS renewal](../operations/testnet-ipfs.md).
