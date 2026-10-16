# Documentation and review-fix delivery — 16 October 2026

The approved shared-testnet deployment completed at 00:08 UTC. The portal is [testnet.app.daclify.com](https://testnet.app.daclify.com/) and the API identifies its version at [/v1/network](https://testnet.api.daclify.com/v1/network). Almaiso is excluded. Mainnet was not changed.

| Component | Version | Deployed source |
| --- | --- | --- |
| Core/API/public SDK | `0.15.0-alpha.32` | `dc749e1f52e6c25ced820baad71b52fd3b52125d` |
| Module SDK/help | `0.10.0-alpha.42` | `491e9dbed0fd0895bc54c75bbfe4198aec132a9c` |
| Frontend | `0.15.0-alpha.43` | `2c377675cb1336eef0d227a0ae5959adc0fd3164` |
| Independent MCP package | `0.1.0-alpha.20` | Existing immutable package and SDK dependencies retained |
| Website documentation | Existing published site bytes | `890c10c829fb73c546cf846bccb038cd1f9e3ecb` |

The deployment includes the preceding review fixes for connected-app origin pagination and local key locking during sign-out, plus the [documentation audit](2026-10-16-documentation-review.md). Native contracts, native permissions and migration SQL are unchanged. No contract was recompiled or redeployed for this delivery. Source changes are pushed to `dev`; the standalone website uses `main`. Final status/evidence documentation follows in a separate documentation-only commit.

## Checks actually run

- Core: 1,113 tests passed and one packaging-policy test timed out under concurrent load; that test passed an isolated rerun. This verifies 1,114 unique cases without claiming the first full invocation exited successfully. Core lint, type checking, generated-reference checking and builds passed.
- Frontend: 414 tests, Vue/TypeScript checking and the testnet build passed. Modules: 287 compiled-WASM tests, type checking, generated-reference checking and build passed. Website: 43 tests, type checking and static export verification passed. Total unique local cases verified: 1,858.
- The archive regression failed before extending the mini-app archive bound and passed after it. Sixteen distinct archives load and the seventeenth rejects. Existing duplicate/tamper checks remain enforced.
- Public API/network and DAO module schemas validate. Runtime and all seven deployed module code hashes match reviewed pins; all eight binary ABI hashes match the staged producer artifacts.
- All 154 current frontend files match the staged bytes. All 54 download files across ten mini-app and eight MCP cohorts match their manifests. Old hashed frontend assets are retained. The MCP cohort was not relabelled or rebuilt against newer peers.
- Read-only desktop and mobile journeys cover account entry, signup/recovery screens, Hub, Telos views, contract resources/Names oracle and Decide. Accessibility, horizontal layout, correct API origin and the forced testnet network pass. Separate desktop/mobile checks of the Documents handbook and legal-template previews pass. There are no observed JavaScript errors or API 5xx responses in these journeys.
- A disposable PostgreSQL restore preserves all 98 application tables and 61 migration records after applying migrations twice. A paused backup and prior source/config/frontend remain in the private rollback packet; no live database rollback was performed.
- A fresh recovery snapshot restore recovers the original drill key while its source is unavailable, denies four forbidden operations and restores source health. Core32 qualification expires **21 October 2026, 23:59 UTC**. It remains explicitly same-host testnet qualification.
- All 45 public website files, including 15 HTML pages, match generated output. The canonical `www` redirect returns 301 and an unknown page returns 404. The live website was already current; no separate manual website publication was needed.
- API, frontend, PostgreSQL, recovery service/agent and Names timer are active. Startup/post-cutover API logs contain no error-level entries or ChatGPT metadata-unavailable entries in the checked interval.

## Limits and retained evidence

The [machine-readable delivery record](2026-10-16-docs-and-review-testnet.json) identifies source, hashes, counts and observed scope. Detailed logs, screenshots, configuration backups and database/recovery snapshots remain in the private operator workspace; secrets and backup payloads are not committed.

Signed public-chain mutation journeys and real external-wallet/ChatGPT account ceremonies were not repeated. These documentation and deployment checks do not replace independent cryptographic/legal review or production qualification. Recovery remains on the API host. Host disk remains constrained; the health record measures approximately 330 MiB free after regenerable build caches were moved/cleared. Runtime dependencies are installed persistently in the release; only checkout build caches use temporary memory-backed storage.
