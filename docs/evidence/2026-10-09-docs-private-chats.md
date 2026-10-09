# Whitelisted one-on-one documentation support — 2026-10-09

The user requested a direct-chat whitelist for testing the documentation bot. `TELEGRAM_DOCS_PRIVATE_CHAT_IDS` accepts positive numeric Telegram user IDs as JSON strings and defaults to an empty list. Group IDs remain a separate negative-ID list; enabling support requires at least one allowed chat in either list.

Only whitelisted human senders whose private chat and sender IDs match can ask ordinary questions, use `/docs`, or reply to the bot. Groups retain commands/replies only. Unlisted private senders are ignored before receipt claims, model calls or sends. The same docs-only assistant, response limits, source links, rate limits and duplicate protection serve both paths. No migrations, contract actions, keys or login pairings change.

Private-only setup can leave groups empty. The setup command verifies the private chat type/ID and applies membership/privacy checks only for configured groups. Telegram's optional `can_join_groups` field is decoded as optional rather than blocking a bot used only for private testing. The test for that omission failed before the correction and passed afterward. Setup refuses a non-private or mismatched private chat before webhook registration.

## Actual checks

- Initial three new private-mode regressions failed before implementation; all passed afterward. Configuration, private eligibility, impersonated/mismatched IDs, unlisted senders, unchanged group behavior, private-only setup and transport are covered.
- Core `npm run verify` passed lint, TypeScript, generated-doc consistency and **593 tests / 101 files**. `npm run build` passed. Publication remains refused/qualification false.
- Frontend `npm run verify` passed lint, Vue/TypeScript and **151 tests / 31 files**. Testnet build passed with the refreshed vendored help package.
- Modules TypeScript and generated-doc checks passed after the public SDK lock refresh. Module source code did not change.
- Locked sibling bootstrap completed, generated help was refreshed, and final diffs/formatting were reviewed. No private env credentials or tester IDs were added to tracked files.

The user initiated a private message to the configured test bot. With no webhook registered, a read-only `getUpdates` request without an offset was filtered to the expected username and matching private sender/chat ID. `getChat` then independently confirmed that same private ID and username. Only the requested sender metadata was reported; no chat bodies or other user profiles were logged. The verified ID was added only to ignored local `.env.testnet`; existing credentials and group allowance were preserved. The bot enable flag remains false. No update acknowledgment, Telegram message, webhook registration or VM deployment was performed.

Live direct-chat qualification still requires deploying the updated testnet API, private VM configuration, restart and webhook registration. For private-only testing before group membership is ready, use an empty group list and the verified tester ID. The current handler ignores `/start`; after pressing Start, send an ordinary Daclify question or `/docs question`. See [the operator runbook](../operations/docs-assistant.md#one-on-one-testing).
