# DAO pricing page

User request: add a Pricing button to Create a DAO, opening a separate page or card with all configured DAO pricing. Builder choice: a separate public page in a new tab so the original form keeps its draft. Work inline on `dev`, preserving existing signup/apps functionality and the user's testnet deployment. No delegation or fee/contract changes.

- [x] Inspect canonical public platform schemas and actual testnet prices; distinguish configured overrides, billing defaults, missing policies and separate independent deployment quotes.
- [x] Reproduce the missing link in the browser and the missing effective member prices against an owned native fixture.
- [x] Add the route, accessible Pricing button and responsive page with configured values, refresh/retry and unavailable/stale states. Reuse producer-owned types and existing billing readers.
- [x] Report effective default member/Connect prices from the API; retain stored overrides and unavailable unsupported policies.
- [ ] Finish native override/default checks, frontend/core static/unit checks, browser accessibility/mobile checks and testnet builds.
- [ ] Archive and install matching testnet API/frontend source; verify the real public Pricing button/page and unchanged signup availability. Commit/push source and final evidence to `dev`.

Initial checks: the browser failed on the absent Pricing link. The native reader returned null for absent seat configuration despite hosted billing's built-in USD rates. The test fixture initially lacked the native governance actor links needed for its override checks; only its owned disposable chain links were repaired. Frontend browser fixtures exercise nondefault configured rates, missing/wrong-chain responses, retry, accessibility and mobile overflow. Native tests compare default and governance-overridden prices with the existing payment-policy reader.
