# Browser security remediation — 16 October 2026

The user authorized fixing the two findings from the Daclify security review, committing/pushing `dev`, and deployment to the existing shared testnet. Almaiso is excluded. The frontend release is `0.15.0-alpha.44`, consuming unchanged core32/modules42 SDKs. Exact source, verification and live delivery results are recorded in the [machine-readable evidence](2026-10-16-browser-security-remediation.json).

## Changes

- **SEC-001:** Signing out and manually locking keys invalidate matching account/service scopes across same-origin tabs. Signals contain only scope, account ID and event type; they cannot grant access. The browser validates bounded messages and uses storage events if BroadcastChannel is missing or denied. Session removal and incompatible account keys also clear local keys. Existing generation guards invalidate pending private work. Inactivity locking remains local to each tab.
- **Logout race:** A delayed logout response cannot clear a different account or newer CSRF state opened while it was pending. The browser regression failed before the shared client/session cleanup was corrected.
- **SEC-002:** Vite development/preview, Netlify's shipped `_headers` and the checked-in Caddy host example set HTTP `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. Top-level pages and OAuth popups remain available. No opener-isolation policy was added.

The implementation and browser cases are in the [frontend](../../../daclify-frontend/src/auth/session.ts), [API client](../../../daclify-frontend/src/api/client.ts) and [security regressions](../../../daclify-frontend/tests/e2e/session-security.spec.ts). The [deployment guide](../../../daclify-frontend/docs/netlify-dev.md) explains that non-Netlify hosts must apply the HTTP headers themselves.

## Verification and delivery boundaries

The original two-tab/framing checks failed before remediation. On the final implementation, all 414 frontend unit tests and 24 desktop/mobile browser security cases passed. The browser cases use real vault/session/signing code with synthetic keys and stubbed API transport. They cover delayed/failed logout, another account opened during logout, account/network isolation, messaging fallbacks, session loss, changed keys, malformed signals, blocked framing and top-level/popup rendering. Existing environment-configuration tests also caught and verified a correction to the local linked-dependency cache path.

`npm run verify`, `npm run build -- --mode testnet`, formatting checks and Caddy validation passed. The frontend audit reports zero known vulnerabilities. Build output still reports existing large-chunk warnings; some component unit fixtures report duplicate RouterLink registration warnings. Neither is presented as a security failure or suppressed by this change.

Only static frontend files and portal response headers need deployment. Preserve existing hashed assets for open clients, publish the new entry after its assets, and retain the old entry/config for rollback. No API restart, database migration, native transaction, key rotation or authority change is part of this release. Live checks matched all 155 frontend files, seven module hashes, eight raw ABIs and 54 retained downloads. Desktop/mobile document-template journeys passed without browser errors or API 5xx responses. The deployed browser refused unrelated framing; top-level and actual popup consent rendered. MCP discovery remained available. Exact hashes are in the JSON record. Local fixtures and read-only live checks do not establish a new real-provider authorization qualification.

## Upstream development-only advisories

The registry still lists `@proton/vert@0.3.24` as its current release. Its development dependency chain includes [lodash.set prototype pollution](https://github.com/advisories/GHSA-p6mc-m468-83gw) and [elliptic signature-generation risk](https://github.com/advisories/GHSA-848j-6mx2-7j84). Neither advisory lists a patched version for those affected packages. Do not use production keys with the emulator or override cryptographic APIs to hide the audit warning. These upstream advisories remain open; reviewed production dependency scopes do not contain this chain. This release does not claim independent cryptographic certification or mainnet qualification.

Reload tabs opened before this security update. Existing loaded JavaScript cannot acquire the new cross-tab listener until the page reloads. Previously copied keys and plaintext cannot be revoked by a browser logout.
