# Documentation assistant review and Telegram implementation — 2026-10-09

Work is on `dev`. No contracts, account keys or pairings change. No production/mainnet deployment, webhook registration or Telegram messages were performed. The new group chat feature remains disabled until the approved group, private configuration and deployed API are ready.

## Verified review findings

- The local key/model settings are present. The hosted testnet `/v1/docs/agent` returned `configured: true`; this is a configuration indicator, not provider health or credits.
- Before changes, a live hosting-pricing question returned 502 in 6.8 seconds. A Telegram login setup question was refused as outside the handbook; an unrelated recipe was correctly refused.
- The local bot identity was verified with real `getMe`: groups allowed and broad-message access disabled. `getWebhookInfo` showed no webhook and no pending updates. These read-only checks did not consume messages or change settings.
- Code routed from topic titles and truncated selected guides at 12,000 characters. It had no output-support check. Existing Telegram code handled login proofs/OIDC, not group messages.
- During the first revised-model checks, a pricing answer confused paid slots with total members, producing $35 for 50 total slots. The grounding model incorrectly accepted it with probability 0.98. This is direct evidence that a second AI cannot guarantee correctness. The canonical guide now explicitly distinguishes bands and includes source-checked capacity examples; pricing prompts use those examples rather than requesting arithmetic/live quotes.

## Implemented changes

The shared assistant routes from the complete bounded handbook, uses a complete selected guide, validates provider probabilities/response sizes, rejects unsupported/link-bearing/oversized answers, and checks output relevance/support. App and group share rate and concurrency limits with an 18-second total provider deadline. It has no data-access or execution tools. The response schema and primary-topic source link remain compatible.

Telegram uses an explicit opt-in webhook, constant-time secret verification, approved-group IDs, human `/docs` commands or replies to this bot, bounded previous-bot-answer context and original forum/reply targets. Other conversation, private chats, other bots, edited updates and stale messages are ignored. Plain-text output adds a server-constructed source link. Migration 032 stores only bot/update IDs and receipt timestamps; concurrent/retried requests claim once before inference/send. A crash after claiming can lose a reply, so members retry with a new command. This is at-most-once processing, not guaranteed or exactly-once delivery.

The setup command checks identity, privacy mode, regular membership and webhook conflicts before explicit registration. It does not silently remove/replace another webhook or clear pending updates. Full env examples, product guides, an operator runbook and frontend status/privacy explanations accompany the implementation. The updated public development help packet is vendored into the frontend for standalone Netlify builds. No package is published as an immutable release.

## Live model observations

Results and public answer text are in [the evaluation JSON](2026-10-09-docs-assistant-evaluation.json). No credentials are included.

- GPT-4.1 mini: 8/9 scope outcomes matched on the revised guide; Spanish recovery was refused despite being relevant. All four unrelated/live-data prompts were refused. Pricing was correctly $40 for 50 total slots.
- Standard Luna: 9/9 scope outcomes matched; the five Daclify questions were answered in roughly 2.4–5.6 seconds, including Spanish recovery and Polish privacy. All four outside prompts were refused in roughly 0.25–0.35 seconds. The $40 default pricing answer was checked separately.
- The configured Luna Pro: the two focused pricing/Telegram-login requests answered correctly in about 9.0 and 5.9 seconds with the revised code. Its override was preserved; no private env value was rewritten. Earlier responses included failures and occasional successful replies, so the original 502 cannot be conclusively attributed to model choice alone.

Standard Luna is a reasonable next model to evaluate for latency and false refusals. This small selection is not evidence of general superiority or a security guarantee. Thresholds remain uncalibrated; question phrasing, translation, guide ambiguity and cross-guide questions need broader sampling before rollout.

## Checks actually run

- Core `npm run verify`: lint, TypeScript, generated documentation consistency and **587 tests / 101 files** passed. Publication remains refused/qualification false, as intended.
- Core `npm run build` and targeted formatting passed.
- Isolated local PostgreSQL full suite: **193 tests / 27 files** passed. A final rerun of affected Telegram/account-link files passed **6 tests** after the final parser change. Migration/concurrent and restarted receipt claims, expiry, webhook authentication and retained app origin enforcement are exercised.
- Module `npm run verify`: lint, TypeScript, generated documentation and **144 tests / 27 files** passed. Only its lock integrity changed through the shared SDK refresh.
- Frontend `npm run verify`: lint, Vue/TypeScript and **151 tests / 31 files** passed. Testnet build passed.
- New mocked-API Chromium desktop/mobile assistant regressions: **4 tests** passed, covering safe plain text, canonical links, refusal clearing, missing configuration and failed status requests. These do not qualify live provider or Telegram clients.
- Sibling locked bootstrap completed and refreshed all development package integrities. Final diffs and whitespace were reviewed.

Other agents pushed host-preflight/rollout evidence, Telos EVM RPC endpoints and a module stress-test timeout while this work was in progress. The three unpublished local commits were rebased onto their current remote `dev` parents without conflicts or public-history rewrites. After integration, core verify passed **588 tests / 101 files**, frontend verify/build passed again (**151 tests**), and the affected module Works stress fixture passed **2 tests**. The owned isolated database and temporary credential file were removed after the PostgreSQL suites. These integration changes were preserved.

The first PostgreSQL attempt used the unrelated fixture's assumed password and failed authentication; no tests ran. The corrected run used a new owned isolated `_test` database and the container credential without logging it. Initial lint identified two fixture non-null assertions; both were removed before passing verification. The initial live revised evaluation also had relevant-question refusals; these are not silently counted as successful calibration.

## Remaining operational steps

The approved Telegram group was requested and has not yet been supplied. Configure it and a random webhook secret in private backend env, deploy the API, apply migration 032 and restart. Run the read-only setup check, then explicit registration on the intended network. Exercise actual group commands, replies, forums, rate limits and unrelated-topic refusals. See [the runbook](../operations/docs-assistant.md). Use distinct testnet/mainnet bots and a provider-side key budget.

Native contracts, provider login consent and the wider application journey were not requalified for this documentation-only service change. Existing production qualification gates remain open.
