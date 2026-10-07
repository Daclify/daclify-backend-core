# Support assistant and Telegram provider smoke tests — 2026-10-07

The user supplied OpenRouter and Telegram bot credentials locally in ignored backend `.env.testnet`. No credential values, provider tokens or personal Telegram identities are recorded here. The owned API was restarted to reload that file; the app remains connected to public Telos testnet at `http://testnet.localhost:5198`, proxying `/v1` to port 3028. No contract transaction, account pairing or bot message was sent during these checks.

## Verified live checks

- Telegram's real Bot API `getMe` returned HTTP 200 and a validated bot identity matching the configured username and bot ID. The bot reported no configured main Mini App.
- Both `/v1/docs/agent` and `/v1/sign-in/options` returned HTTP 200 through the frontend proxy after restart. The support assistant is configured, the Telegram legacy widget and Mini App verifier are configured, and Telegram OIDC remains unconfigured.
- The actual support request uses `openai/gpt-6-luna-decisions` for selection and the user-configured `openai/gpt-6-luna-pro` for replies. A recovery question returned HTTP 200, selected the `recovery` guide and answered within its content in approximately 5.8 seconds. A live treasury-balance question returned HTTP 200 with `status: outside` in approximately 0.3 seconds.
- A fresh headless Chromium context opened `/docs`, submitted a private-document-storage question through the real UI, received HTTP 200 with `status: answered` and topic `documents`, and rendered the exact returned answer. No mocked API/provider route was used.
- Chromium opened `/account` and verified that the real Telegram iframe mounts. The iframe displays **Bot domain invalid**, so browser authentication is blocked on provider domain setup despite a valid bot token.
- Posting an invalid Telegram proof to the real login endpoint returned HTTP 401. This rejection is not a successful provider login or a real-user consent test.
- `npm test -- tests/provider-proofs.test.ts tests/telegram-oidc.test.ts tests/docs-agent.test.ts` passed 31 deterministic tests across three files. These cover proof/configuration validation and the handbook workflow; their synthetic tokens do not qualify real login.

## Remaining gates

Select and configure an HTTPS test origin, register it and the exact OIDC callback with BotFather, add the OIDC client ID/secret, and verify real consent, explicit pairing, repeat entry, cancellation and session revocation. Configure and exercise a Mini App launch URL separately. Google has a token verifier but no complete browser login ceremony; remote rotating JWKS and server-issued browser-bound nonce/state remain required before that flow is qualified. Live email delivery and wallet-client checks remain separate.

See [provider setup instructions](../operations/paired-login.md). Successful smoke tests establish the observed requests, not uptime, routing quality across all support questions, privacy guarantees, or production qualification.
