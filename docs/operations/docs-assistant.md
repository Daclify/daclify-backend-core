# Documentation assistant and Telegram bot

The app and bot use the same bundled public core/module guides. They do not query DAO records, open private documents, browse arbitrary sites, execute commands or sign transactions. Setup questions are allowed when the handbook actually documents the Daclify setup. General Docker, Stripe, Telegram or blockchain chat is outside scope unless it concerns a documented Daclify configuration.

## App configuration

Set backend `OPENROUTER_API_KEY` and restart the API. There is no additional app enable flag. The answer and decision model settings are independent:

```sh
OPENROUTER_DECISIONS_MODEL=openai/gpt-6-luna-decisions
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

These defaults apply to absent/empty model settings. The testnet local file currently overrides the answer model with Luna Pro. Keep that override only if representative evaluations justify its latency and cost; it is not necessary for handbook replies. Model IDs receive syntax checks, not provider availability checks. `/v1/docs/agent` returning `configured: true` means that a key/configuration was supplied; test an actual answer to check provider access and credits.

Decisions sees the full bundled handbook paragraphs, selects one guide and admits only in-scope questions with evidence. The answer model sees the complete selected guide. A second decision checks relevance and support before the reply is returned. Thresholds are 0.8 for answerability, 0.2 for the selected topic and 0.9 for output support. These are conservative launch gates, **not calibrated accuracy guarantees**. A refusal can mean either unrelated content or insufficient documented evidence. Complex questions spanning several guides may need to be split into separate questions.

All provider calls for one answer share an 18-second deadline. Responses are bounded at 128 KB; questions are limited to 500 characters and replies to 2,000 characters. The current instance admits 12 model requests per subject and 80 globally per ten minutes, with at most four answers in flight. Web and Telegram share that global pool. Limits are per API instance and reset on restart; set an OpenRouter key budget for an account-wide cost ceiling. Do not supply secrets or private DAO content in questions. Public guide text and the question go to OpenRouter.

## Telegram group configuration

Telegram login/OIDC does not run a group bot. Group chat is off by default. No login client ID or OIDC callback is required just for documentation chat.

1. Use a dedicated test bot in BotFather. Enable **Allow Groups** and **Group Privacy**. Add it to the approved group as a regular member with permission to send messages, **not an administrator**. Telegram administrators receive broad message access even with privacy enabled. Use different bot identities and secrets for testnet and mainnet: a bot can have only one webhook.
2. Obtain the approved group's numeric negative chat ID. A supergroup ID commonly starts with `-100`; do not guess it from a group invite URL. Keep any private group identifiers out of public example files. Configure only groups whose administrators want the bot.
3. Store the following in the VM's private testnet backend env, alongside its existing bot token, username and OpenRouter key. These are examples, not credentials:

   ```sh
   TELEGRAM_DOCS_ENABLED=true
   TELEGRAM_DOCS_GROUP_IDS=["-1001234567890"]
   TELEGRAM_DOCS_WEBHOOK_SECRET=YOUR_RANDOM_URL_SAFE_SECRET_AT_LEAST_32_CHARACTERS
   TELEGRAM_DOCS_WEBHOOK_URL=https://testnet.api.daclify.com/v1/docs/telegram/webhook
   FRONTEND_ORIGIN=https://testnet.app.daclify.com
   ```

   Generate the secret locally into private configuration, for example with Node's `crypto.randomBytes(32).toString('base64url')`; do not paste it into chat or a shell argument. Protect the env file using the existing VM credential-file procedure. The secret is separate from the bot token. Group IDs must be a JSON array of negative numeric **strings**, with no duplicates. Startup refuses incomplete enabled configuration. HTTP webhook URLs are rejected.

4. Deploy the API code and apply migration 032 through normal startup. The migration adds only update IDs and timestamps; it changes no user identity or pairings. Restart the API. HAProxy must route this exact HTTPS API path without adding a browser-origin requirement or logging its secret header. The route verifies `X-Telegram-Bot-Api-Secret-Token` before parsing the update, and checks the group allowlist before any model or send call. App endpoints retain their existing origin checks.
5. From the backend checkout on the VM, run the read-only check with the actual private env path:

   ```sh
   DACLIFY_ENV_FILE=/path/to/private/testnet.env npm run telegram:docs:setup
   ```

   It verifies the bot ID/username, privacy mode, group membership and existing webhook. A different webhook or an admin/restricted/absent bot is refused. It does not disable an existing webhook, alter BotFather settings, send group messages or discard queued updates.

6. Once the API is reachable and the checked group is approved, register it:

   ```sh
   DACLIFY_ENV_FILE=/path/to/private/testnet.env npm run telegram:docs:setup -- --confirm
   ```

   This makes the explicit `setWebhook` call with the configured secret, `allowed_updates: ["message"]` and four connections. It keeps pending updates. Startup alone does not register a webhook, and the group bot does not poll `getUpdates`. Stop any other consumer of this bot first; webhook delivery and polling cannot run together.

7. In the group, try `/docs@YOUR_BOT_USERNAME How does Daclify recovery work?`. In multi-bot groups the explicit username is the reliable command form. `/docs` works when Telegram routes it to this bot. Reply to the bot response to ask a follow-up; the previous bot answer is bounded context and never a source of authority. Verify a source link, a forum-topic reply, an unrelated-question refusal and normal-conversation silence. Do not use actual secrets or private DAO records as test inputs.

The handler ignores private chats, channels, other bots, edited updates, unapproved groups, ordinary text and messages older than one day. A forwarded message is not a command unless it is itself an accepted command/reply. No parse mode is used for bot output, so model text cannot introduce Telegram formatting entities. Source links are constructed from the configured frontend origin and the validated bundled topic ID, rather than a model-supplied URL.

## Retry and privacy limits

PostgreSQL claims `(bot_id, update_id)` before model calls/sending. Concurrent or repeated webhook delivery does not repeat the inference or reply. Receipts contain no question, answer, sender or group ID. Expired receipt IDs are pruned on a later accepted update after two days; stale messages are rejected before a claim.

This is **at-most-once processing**, not guaranteed delivery. If the API stops after the claim, or a send times out, the reply may be lost. The handler does not blindly retry a potentially delivered message. Ask `/docs` again with a new message. A database failure before a claim returns an error so Telegram may retry safely. Rate limits can silently suppress a bot reply; wait before retrying.

Only a command/reply question, optional previous bot answer and public guides are sent to OpenRouter. The API does not retain message bodies. Telegram/OpenRouter have their own provider retention policies; this is not an end-to-end private support channel. A model-based scope check reduces mistakes and prompt injection but cannot guarantee perfect restriction. Review source guides and evaluate representative questions before broader rollout.

## Verification

`npm test -- tests/docs-agent.test.ts tests/telegram-docs.test.ts` checks routing/grounding gates, config, commands/replies, authentication, bounded inputs, replay suppression and transport. The isolated PostgreSQL integration test checks concurrent/restarted claims and cleanup. `npm run docs:evaluate` uses fixed public questions with the selected backend model; it is a small paid live smoke evaluation, not comprehensive calibration. No Telegram registration or group messages occur in that evaluation. Its results must be distinguished from fixtures and live group qualification.

Authoritative provider references: [Telegram privacy and delivery](https://core.telegram.org/bots/faq), [Bot API webhook and send methods](https://core.telegram.org/bots/api#setwebhook), [OpenRouter Decisions specification](https://openrouter.ai/openapi.json).
