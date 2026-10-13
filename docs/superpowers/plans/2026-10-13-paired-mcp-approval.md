# Approve hosted MCP connections with a paired account

The user confirmed that paired wallets and paired Google, Telegram, email or passkey sign-ins should approve the hosted AI connection. Existing authorization covers inline implementation, commits to `dev`, and testnet delivery. Production and native authority changes remain outside this task.

The existing API accepts paired native/EVM account-control proofs, but the consent screen incorrectly uses DAO-action authorization. Replace that control with a small account-approval selector; wallet pairing with the Daclify account is sufficient. Do not activate or replace a DAO wallet from this card.

For paired sign-ins, accept a recent authenticated Daclify session only for `/v1/mcp/oauth/approve`. Reuse the existing session `step_up_at` and credential provenance, require authentication within five minutes and an existing paired credential, and keep the fresh one-use intent bound to the exact request body, account, session, origin and API audience. Session resumption must not renew this authentication window. Account recovery, key sharing, credential changes, native pairing and erasure retain their existing proof requirements. Hosted submission still needs an already approved, matching local companion.

Execution:

1. Add failing SQL/security regressions for paired approval, stale/unpaired/revoked sessions, replay, changed body/session and proof restrictions.
2. Add the canonical sign-in proof variant and authenticated freshness endpoint. Publish a new immutable development protocol archive; preserve core 17, modules 24, MCP 8 and existing starter artifacts.
3. Reuse the existing paired sign-in controls in the compact card, with an explicit sign-in-again step when needed. Add the missing Google sign-in button using the existing verified provider login endpoint and Google's official GIS library, only when configured. Reject a sign-in to a different account.
4. Add browser coverage with the vault locked and an actual email-code login, plus existing root approval and wallet-readiness coverage. Confirm requested submit is narrowed when no companion exists, replay fails, the card remains compact, and accessibility holds.
5. Run affected integration journeys, full core/frontend suites, type/lint/build/docs checks, inspect the final diff, commit and push `dev`, build clean candidates, and deploy the API and frontend to testnet with fresh rollback artifacts.
6. Record the exact source/artifact/test combination and public smoke checks. Live Google/Telegram/passkey/wallet prompts and an actual ChatGPT model tool call require user/provider evidence; synthetic proofs do not qualify those external flows.

No new database fields, indexes, migrations, runtime contract changes or native RAM are needed. Only public Google client configuration is exposed; credentials, provider secrets, private keys and private documents stay out of the grant and logs.
