# Daxi support and Status execution

Development work on `dev`, 9–10 October 2026. Package/SDK/help version **0.9.0-alpha.6**. Existing module contract release remains **0.9.0-alpha.5**; no C++, ABI, account authority, database schema or private environment-file changes.

## Result

The app and Telegram share Daxi: helpful Daclify setup, Telos Zero/EVM education and general DAO design, with occasional gentle humour. Added six concise learning guides with reviewed primary-source links: DAO fundamentals, Telos environments, networks/wallets, native permissions, RAM/CPU/NET and historic Decide/Works concepts. Knowledge is release content reviewed on 9 October, not a live website crawl or account inspector.

Canonical help topics carry optional HTTPS source metadata and review dates; generated Markdown/help/reference preserve it. Public assistant status adds optional name/scope/model/knowledge metadata without provider credentials or Telegram allowlists. New clients still accept the older `{configured}` response. Older strict clients do not accept the new profile field: deploy the matching frontend before upgrading the API, or coordinate the release. Configuration is distinct from provider health.

Live investigation found that combining scope and complete answerability in the first selector caused supported recovery/setup/personality questions to be refused. Selection now separately classifies support scope and picks an evidence guide. Generation and the existing independent output-support gate decide answerability. Helpful instructions for checking live data are allowed; fabricated live balances are not. The 0.8 scope / 0.2 topic / 0.9 grounding thresholds, complete guide evidence, 18-second deadline, response/question/answer limits and shared rate/concurrency limits remain. Model URLs must exactly match trusted guide text or reviewed sources. No model-directed URL fetching or transactions were added.

Status now uses Overview, Network, Contracts, Fees, Services and AI Daxi Help tabs. It retains network mismatch, code hashes, RAM, public owner/active weights, governed fees and provider configuration. Migration listings leave the UI, while backend diagnostics remain available. AI metadata failure does not hide platform status. Shared creation/contact-independent pricing replaces stale setup-price headlines; observed legacy values are labelled separately.

The final diff review found another required consumer fix: frontend module compatibility and native state reporting must use the unchanged contract release, not the new SDK version. Manifests/installation types and the frontend gate now retain contract version 0.9.0-alpha.5. Older unsupported versions and incorrect hashes remain rejected. A failing compatibility assertion was observed before the frontend fix.

## Verified

- Core `npm run verify`: ESLint, TypeScript, generated-doc check and **650 tests / 108 files passed**. Release publication remains refused/unqualified by the existing qualification gate; no package was published.
- Modules `npm run verify`: lint, TypeScript, generated-doc check and **154 tests / 27 files passed**, including unchanged compiled-WASM suites and SDK-only contract-version coverage.
- Frontend `npm run verify`: lint, Vue/TypeScript and **163 tests / 33 files passed**, including package integrity/content checks, old public status responses, guide grouping, browser-history separation, module-version rejection and the requirement-checker regression. Static `npm run build` passed.
- Isolated PostgreSQL `account-links` and `telegram-docs` integration selections: **7 tests / 2 files passed** with schema setup, HTTP metadata/answers, concurrent/restarted update claims and cleanup. The owned disposable `daclify-daxi-review-db` container was stopped; existing databases were not used.
- Final live `DACLIFY_ENV_FILE=.env.testnet npm run docs:evaluate`: **16/16 smoke samples passed** with configured Luna Pro answer / Luna Decisions selector models. Includes English hosting/setup/Telos/DAO/comparison/identity/humour, Spanish recovery, Polish encryption, unrelated/injection/music-bot refusals and bounded current-balance guidance. The balance sample requires an explicit inability to inspect live data; it permits a sourced explanation of how to check it. Earlier prompt variants produced false refusals and are not counted as passes. This small sample does not establish calibrated accuracy or robustness.
- Read-only real-browser flow against `http://testnet.localhost:5198`: Home reported testnet, `daclifycore1`, service version 0.9.0-alpha.6; Status showed actual contract and AI metadata; a live Telos question opened `/docs/telos` and its reviewed official source. No chain write, wallet signature, payment or Telegram message occurred.
- See [frontend execution](../../../daclify-frontend/docs/evidence/2026-10-10-daxi-and-status.md) for browser selections and reviewed screenshots. Logs, screenshots and public evaluation answers remain local artifacts; secrets were not printed.

## Limits

Telegram remains disabled in the private testnet configuration. No live webhook registration, group/direct delivery, hosted deployment, wallet-client qualification or new native-permission run was performed. Commands/replies, private whitelists, privacy and replay restrictions remain unchanged and tested. Deployment needs the documented enable flag, approved IDs and reachable HTTPS webhook.

The model can still refuse a supported question or make a semantic mistake; source links and conservative gates reduce rather than eliminate that risk. Some replies include literal Markdown despite the plain-text instruction; the app and Telegram render text safely without HTML/parse mode. Knowledge updates require reviewing and rebuilding release content. The lazy handbook chunk is approximately 508 kB minified / 73 kB gzip and produces the existing Vite 500 kB warning; it is not hidden or a build failure.
