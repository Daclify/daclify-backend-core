# DAO pricing page — testnet qualification

The Create a DAO screen now opens the public [DAO pricing page](https://testnet.app.daclify.com/pricing) in a separate tab. The creation page remains open. This reports current platform pricing and does not approve purchases or change configured fees.

Installed source archives under `/data/daclify-runtime/releases/20261011-dao-pricing`:

| Repository | Commit | Git archive SHA-256 |
| --- | --- | --- |
| Core/API | `e69f89981e5a6247a78e138ad284a3fa2d1037aa` | `4425fdcc7b932e61b9cb16488b55cb7bcd87f91018390e3cb724bde55d80390b` |
| Frontend | `08c13494f5ad3750fcfb8081c03f25af71b9db75` | `670716fc92bab792b42acb25028771d6d56c0554388e9ad0f1acfa74eb62ab8b` |
| Modules, unchanged | `6962c884cf57a00546edeaf5d1361f4438d02736` | `4a91486cb0de35fb910bf5f1217344d34a9405c30bcd14a815a2be750cf0cd9b` |

Frontend version is 0.13.0-alpha.7. API and core protocol remain 0.13.0-alpha.6; module SDK remains 0.9.0-alpha.22. The API archive identifies a compatible reporting fix without republishing either public package. Their unchanged SHA-256 values are `f2e7c2214cd6d4f1f7d3c367bd6644598d4c37e9c557af99fe90ffbe75c848ea` and `ff40aa811318a11e58d5f578044d24036d160b5ae976c26281797751a956f24a`, respectively.

All 108 generated frontend files matched the installed files. The installed `index.html` SHA-256 is `9198523320fd82810656db1e459f57aee309d8e5864358dc579549a785ff601b`. Old hashed assets were retained for existing browser sessions. API/Names services use the archived core source; environment bytes are unchanged. A private database backup and old service/static entry files are retained outside Git.

| Verification | Result |
| --- | --- |
| Core `npm test` | 139 files, 872 tests passed |
| Owned native `tests/native/connected-apps.test.ts` | 8 tests passed, including defaults and governance overrides |
| Frontend `npm test` | 42 files, 275 tests passed |
| Pricing Playwright regression | 6 passed across desktop/mobile; configured overrides, unavailable reads and retry |
| Core typecheck, lint, generated docs, build | Passed |
| Frontend typecheck, lint, testnet build | Passed |
| Archived core/frontend `npm ci` and builds | Passed |
| Live public pricing check | Passed at 1440×1000 and 390×844; actual new-tab click, six module prices, no page errors, no horizontal overflow, zero Axe violations within main content |
| Existing `npm run test:testnet-public` | Both viewports passed; Hub/API routing, contract inventory/resources, Names permissions/quote and Daclify DAO navigation |
| Signup/recovery/Names preservation | Assisted signup available; API and both recovery services active; Names job completed with exit 0 and timer active |

The live pricing browser check completed at `2026-10-11T16:04:57.759Z`. It read real public API data without route mocks. Logs and screenshots are retained in the repositories' ignored `.artifacts/dao-pricing-*` files. Local regression fixtures exercise nondefault prices and failures; native governance override actions ran only on the owned disposable chain.

Observed testnet pricing includes 10 member slots, then graduated monthly rates of $1.00/$0.50/$0.20 per paid slot, and 5% Connect commission. All six catalogue modules currently list `0.0000 TLOS`. Shared setup is $0.00; independent deployments require a separate quote. Storage and RAM top-up policies are unconfigured and displayed as such. Existing subscriptions can retain an earlier approved schedule, and conversion/provider prices require their applicable purchase quote.

This qualification covers public pricing reads and presentation, plus the existing public testnet checks. It does not establish payment-provider checkout, a newly created signup account, or mainnet qualification. No native contract, authority or live fee policy was changed for this rollout. See [the operations guide](../operations/dao-pricing.md) and [execution ledger](../superpowers/plans/2026-10-11-dao-pricing-page.md).

## Follow-up: clearer member pricing

The user found the paid-slot numbering confusing. Frontend 0.13.0-alpha.8 now shows total member ranges, the free allowance and example monthly totals from the pinned public billing helper. Current testnet examples are 10 places free, 50 places $40.00/month, 100 places $65.00/month and 300 places $150.00/month. The card explains that examples cover membership only and approved empty places are billed.

Installed frontend source is `7a4a198e11cb440000d174cc08780147cfda6cdd`, archived under `/data/daclify-runtime/releases/20261011-dao-pricing-clarity`. Its Git archive SHA-256 is `bfd8bdb37bafef3c01a05dfc145baad5fd0efa02b2d094fa7bdd04ca42bc93df`. All 108 built files matched their installed files; the new public entry file SHA-256 is `eb30991d5be73b6145c69dd2c47f664cb8750c998e1b0b0a176d68649865ae05`. Previous static entry files and hashed assets are retained. API/core/module sources and SDK artifacts remain at the initial pricing rollout's pins.

Frontend checks passed: 42 files / 275 unit tests, lint, strict Vue/TypeScript checks, 8 pricing browser tests across desktop/mobile, clean archived install and testnet build. Nondefault fixture prices and 12 free places verify derived member ranges and independently calculated totals. The initial regression failed on the absent new ranges; a strict tuple-type error in the fixture was corrected before delivery.

Real public browser checks completed at `2026-10-11T16:32:26.829Z` for 1440×1000 and 390×844. They verified the new-tab button, member ranges, all four monthly totals and the six module prices, with zero main-content Axe violations, no page errors and no horizontal overflow. Desktop/mobile card screenshots were inspected. Follow-up logs/screenshots are in ignored `.artifacts/dao-pricing-clarity-*` files. Core generated-doc checking passed; backend/native suites and the broader public testnet check were not repeated because their source/behaviour did not change.
