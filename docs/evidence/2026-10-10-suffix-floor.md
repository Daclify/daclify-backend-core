# Suffix account price floor

The testnet Names contract, API quote and seller form now enforce the current normal basic-account minimum for suffix offers and dotted exact-name listings. Native and USD rails are compared separately. Nonzero below-floor registration/edit prices reject with NAME_PRICE_FLOOR. Legacy offers are clamped at fulfillment; suffix sale increments start from the effective charged price and preserve unset rails. USD-only suffix conversion uses the floored USD amount. Unset or stale basic pricing cannot authorize cheaper offers. Third-party fee splits and provisioning tiers are unchanged.

The same existing resource/TLOS/card-fee calculation supplies the floor. This extends the selling-price minimum, without extending the first-party net-profit guard to third-party revenue. Third-party card checkout remains unavailable. Existing serialized actions and tables remain unchanged; this deployment replaces code only.

## Verification

- Contract/API red-green tests exposed the original underpricing paths. Full core: 116 files / 705 passing tests. A final USD-only suffix regression was then added; targeted contract/API verification passed all 20 tests. Dynamic contract tests also cover RAM/TLOS price increases and stale fee/oracle evidence.
- Frontend: 179 unit tests; lint and strict Vue template/TypeScript checks; testnet build; 14 desktop/mobile Names browser tests covering both minimum rails, equal-floor export, accessibility and existing key-backup behavior.
- Modules SDK compatibility metadata: lint/typecheck/docs/build and 7 SDK/documentation tests. Module contracts are unchanged.
- Generated docs/SDK match the compiled Names ABI and code hash; consumer artifact integrity matches all lockfiles.
- Signed real Telos read-only simulations tested below/equal minimum suffix registration and normal first-party native creation with real resource actions. Evidence: [pre-upgrade simulations](2026-10-10-suffix-floor-simulation.json). No sale, listing, account or balance was created/changed by those simulations.
- Reviewed [code-only proposal](2026-10-10-suffix-floor-proposal.json), then applied it irreversibly: [deployment receipt](2026-10-10-suffix-floor-applied.json). Code hash 76714f4a8980b8405fb79e64a127c7492558960ebe63a79185ce6d3cb0a38c8a. Names ABI, all current policies/tiers/sales/listings/suffixes/intents, authorities and 100.0000 TLOS reserve were preserved.

Full suffix-sale settlement is covered by compiled-contract fixtures. No actual suffix account was purchased: real creation additionally requires its configured provisioning tier, a qualified short native suffix owner and the reviewed namesale permission. None of those authorities were changed or borrowed for this test. Production deployment and main publication are outside this change. Development remote publication still requires GitHub server authentication.
