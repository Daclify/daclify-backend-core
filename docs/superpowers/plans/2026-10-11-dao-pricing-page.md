# DAO pricing page

User request: add a Pricing button to Create a DAO, opening a separate page or card with all configured DAO pricing. Builder choice: a separate public page in a new tab so the original form keeps its draft. Work inline on `dev`, preserving existing signup/apps functionality and the user's testnet deployment. No delegation or fee/contract changes.

- [x] Inspect canonical public platform schemas and actual testnet prices; distinguish configured overrides, billing defaults, missing policies and separate independent deployment quotes.
- [x] Reproduce the missing link in the browser and the missing effective member prices against an owned native fixture.
- [x] Add the route, accessible Pricing button and responsive page with configured values, refresh/retry and unavailable/stale states. Reuse producer-owned types and existing billing readers.
- [x] Report effective default member/Connect prices from the API; retain stored overrides and unavailable unsupported policies.
- [x] Finish native override/default checks, frontend/core static/unit checks, browser accessibility/mobile checks and testnet builds.
- [x] Archive and install matching testnet API/frontend source; verify the real public Pricing button/page and unchanged signup availability. Commit/push source and final evidence to `dev`.

Initial checks: the browser failed on the absent Pricing link. The native reader returned null for absent seat configuration despite hosted billing's built-in USD rates. The test fixture initially lacked the native governance actor links needed for its override checks; only its owned disposable chain links were repaired. Frontend browser fixtures exercise nondefault configured rates, missing/wrong-chain responses, retry, accessibility and mobile overflow. Native tests compare default and governance-overridden prices with the existing payment-policy reader.

Qualification: core 139 test files / 872 tests; frontend 42 files / 275 tests; owned native fixture 8 tests; pricing browser fixtures 6 tests across desktop/mobile. Core typecheck/lint/generated-doc checks and build passed; frontend typecheck/lint and testnet build passed. Clean archived installs/builds passed. The live Pricing button/new tab, all six module prices, accessibility and overflow checks passed at 1440×1000 and 390×844. The existing public testnet check also passed at both viewports, including API routing, chain inventory, Names quotes and DAO navigation.

Installed source: core `e69f89981e5a6247a78e138ad284a3fa2d1037aa`, frontend `08c13494f5ad3750fcfb8081c03f25af71b9db75` (frontend 0.13.0-alpha.7), unchanged modules `6962c884cf57a00546edeaf5d1361f4438d02736`. The API/public core SDK remain 0.13.0-alpha.6 and module SDK 0.9.0-alpha.22; their immutable package hashes and all native contracts remain unchanged. The API source archive separately identifies this compatible reporting fix.

The public API reports existing member rates 100/50/20 USD cents and Connect commission 500 basis points. No testnet fee setters, authority changes, contract deployments or purchases were performed. Private environment bytes are unchanged, assisted signup remains available, the recovery services are active and Names completed successfully from the new archive. Storage/RAM prices remain visibly unconfigured. Final [testnet evidence](../../evidence/2026-10-11-dao-pricing-page.md) records source/artifact bindings and verification limits.
