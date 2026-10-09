# Documentation assistant and Telegram group support

The user approved commands and replies only. Reuse the public handbook assistant for group support about Daclify and its documented setup. No DAO data, secrets, arbitrary web retrieval, tools or transaction authority enter this flow.

## Evidence before changes

- Testnet `GET /v1/docs/agent` reports configured. This checks configuration presence, not provider health.
- Live shared-hosting pricing question returned 502 after 6.8 seconds. Telegram login setup incorrectly returned outside; an unrelated recipe correctly returned outside.
- Local `getMe` confirms the test bot can join groups and cannot read all group messages. `getWebhookInfo` reports no webhook and no pending updates. No Telegram messages were sent.
- Routing currently sees titles only; the answer sees one guide truncated to 12,000 characters. There is no answer evidence check. The local answer-model override is Luna Pro; provider diagnosis and a bounded live evaluation will distinguish timeout, empty output and configuration failures.

## Implementation

1. Route using the complete bounded bundled handbook, reject unrelated/live-data/action requests, validate probabilities, preserve full selected guides, and verify that generated answers are relevant and supported before returning them. Preserve the existing response schema and primary-guide links. Use one total request deadline, bounded provider responses and shared app/bot rate and concurrency limits.
2. Receive Telegram webhooks on the API with a separate constant-time secret check. Require an explicit group allowlist. Accept `/docs@bot question`, `/docs question`, or a reply to this bot only; ignore private chats, other bots, edited updates and ordinary group conversation. Preserve topics and reply targets. Permit bounded previous-bot-answer context for follow-ups, without treating it as evidence.
3. Deduplicate updates in PostgreSQL before inference/send, without storing message bodies. At-most-once processing avoids repeat posts and provider spending on delivery retries. A crash after claiming can lose a reply; the member retries the command. Telegram has no send-message idempotency key, so do not claim exactly-once delivery. Reject old messages and expire receipt IDs after their replay window.
4. Add complete env examples, a webhook registration tool that refuses replacing a different webhook, canonical product help and an operator runbook. Update the app's assistant explanation and consumer help artifacts. Default group support off until the group and secret are configured. No live registration or messaging without an approved destination.

## Verification

- Regression/adversarial fixtures: full-guide routing, injection/out-of-scope refusal, malformed probabilities, unsupported outputs, deadlines, oversized responses, limits and shared-channel admission.
- Telegram config/parser/transport tests: secret/allowlist, commands/replies, forum threads, source links, no parse-mode interpretation, duplicates, stale/oversized inputs and provider failures.
- Actual isolated PostgreSQL: migration, concurrent claim, restart/retry deduplication and expiry. Full core checks and affected frontend/module package checks.
- Bounded public-docs-only live model evaluation, recorded separately from deterministic tests. Do not call it comprehensive calibration. Live group journey remains unqualified until configured and exercised.

## Execution

- [x] Assistant safeguards and regression tests
- [x] Telegram transport, migration and tests
- [x] Config, guides, runbook and frontend explanation
- [x] Verification, live evaluation and final diff review

Implementation evidence: [review, checks and remaining live group setup](../../evidence/2026-10-09-docs-assistant-telegram.md). Live Telegram registration/journey is pending the approved group and deployment; it is not marked qualified by completion of this code checklist.
