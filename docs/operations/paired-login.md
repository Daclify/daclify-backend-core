# Paired login and signing setup

Apply migrations using the existing API startup coordinator. Migration 008 intentionally revokes old service sessions with unknown credential provenance; users sign in again. Migration 010 invalidates old unbound sign-in challenges. Migration 012 leaves legacy EVM pairings unverified until fresh explicit pairing. Migrations 013/014 add credential history and browser return destinations; they do not rewrite keys or member rights. Migration 015 adds wallet-only service profiles, dual-proof vault attachment and last-control-credential constraints. Follow the [0.6 upgrade guide](upgrade-0.6.md) for a coordinated API/frontend update.

Configure SMTP from .env.example. STARTTLS is mandatory on port 587 by default; implicit TLS can use tls mode/465. Plaintext is limited to loopback in local development. Use a dedicated sender and credentials in local/production secret configuration, never frontend environment variables. Test deliverability and failure behavior using actual configured mailboxes before qualification. Pairing codes can be displayed only in local fixtures; email login always requires delivery.

Configure Telegram's official OIDC client ID/secret/exact callback `/v1/sign-in/telegram/oidc/callback`. Use HTTPS outside loopback local development, and configure the provider's approved redirect. Browser entry uses the official Telegram authorization/token/JWKS endpoints, RS256, nonce/state and PKCE. Mini Apps use the bot token and independently verified initData; legacy widget fallback uses bot username/token. OIDC subject continuity with widget IDs is unknown: explicit re-pairing is required. Never persist provider tokens in logs or URLs. Test consent, cancellation, expired state, rotated JWKS and a real Telegram client separately from local fixtures.

Native login accepts active permission with direct weighted keys and no delegated accounts/waits. Threshold proofs accept up to eight signatures; unsupported authority structures fail rather than being approximated. Pin supported Anchor/WharfKit client versions and verify actual wallet bytes, chain and permission. Direct native governance uses submitnat; users can submit the exact producer-generated request to the runtime directly in a transaction authorized by the bound native account, without this hosted API. Incoming native activation uses submit with existing member signature and incoming native transaction authorization. Review expiry/nonces/resource requirements; never enable broadcasting before exact transaction validation.

EVM EOA login uses server-issued ERC-4361 messages. Existing verified service pairings open their account; when no pairing survives, 0.6 can reconstruct wallet-only access from a current governance binding in the configured runtime after verifying the signature. Native login supports the same recovery distinction. A saved service pairing and an on-chain governance binding are separate records; pairing a new wallet for login alone does not activate it in a DAO. Direct governance is activated per DAO through linkevm with existing member authorization plus the incoming EIP-712 binding signature. submitevm can be submitted directly to the native runtime using the exact producer-generated request and typed signature. Native relayer funding is required to broadcast; it is not governance authority. Verify Spring cryptographic feature availability before deployment. Connected-wallet metadata alone is not login.

Signing keys and encryption keys remain separate. Provider login never restores a user-controlled vault. Restore the encrypted recovery kit and its credential for private documents on a new device. Wallet signatures are public and must not derive private decryption keys. Managed custody remains production-gated pending the existing OpenBao qualification requirements.

Development checks use owned loopback PostgreSQL/native/Mailpit fixtures; run the commands in the execution ledger. The testnet Telegram bot token was verified through the real `getMe` endpoint on 2026-10-07, but complete Telegram sign-in remains unqualified until domain registration and real consent/pairing are exercised. Live mail and real wallet-client qualification remain separate gates. Passing fixture tests does not change those gates. See [provider smoke-test evidence](../evidence/2026-10-07-support-telegram.md).

Session and browser-attempt cookies use `HttpOnly; Secure; SameSite=None` under HTTPS so browser-bound login works when the API and frontend are on different sites. Local HTTP ceremonies retain Strict (Telegram OIDC uses Lax for its redirect). Cross-site access still requires the configured exact frontend Origin, credentialed CORS, browser-bound challenges and applicable CSRF/account-control proofs. Browser restrictions on third-party cookies can still block unrelated-site deployments; prefer app/API hosts under the same site or a same-origin API proxy and qualify supported browsers.

For the selected Netlify frontend / Hetzner API deployment, keep both HTTPS hosts under the same site. Local frontend development can use an HTTPS loopback hostname under that site and the explicit testnet `FRONTEND_ADDITIONAL_ORIGINS` setting. The OIDC redirect URI stays on the hosted API, while the saved initiating frontend origin controls the browser's return destination. See [local frontend setup](../development.md#local-frontend-with-a-hosted-testnet-api).

## Telegram OIDC setup for testing

1. Choose an HTTPS test address. Prefer one origin serving the frontend and proxying `/v1` to the API, so account and browser-attempt cookies remain on the same host. `http://testnet.localhost:5198` currently fails Telegram's legacy-widget domain check and cannot be configured as a Daclify testnet OIDC callback because this profile requires HTTPS. A temporary HTTPS tunnel or a hosted staging address can provide a test origin; these instructions do not imply one is already deployed.
2. Open the official [BotFather](https://t.me/BotFather) Mini App, select the test bot, then open **Login Widget**. Telegram documents the URL registration and OIDC credentials there. Register both the test frontend origin and the exact callback, for example:

   ```text
   https://YOUR_TEST_HOST
   https://YOUR_TEST_HOST/v1/sign-in/telegram/oidc/callback
   ```

   Replace `YOUR_TEST_HOST` with the actual test host. Keep the signing algorithm at **RS256**, which the current backend accepts. Copy the displayed **Client ID** and **Client Secret** into local backend configuration. The client secret is separate from the bot token. [Telegram's official login setup](https://core.telegram.org/bots/telegram-login).

3. In backend `.env.testnet`, enable all three OIDC fields together and align the frontend origin:

   ```sh
   FRONTEND_ORIGIN=https://YOUR_TEST_HOST
   TELEGRAM_OIDC_CLIENT_ID=YOUR_NUMERIC_CLIENT_ID
   TELEGRAM_OIDC_CLIENT_SECRET=YOUR_OIDC_CLIENT_SECRET
   TELEGRAM_OIDC_REDIRECT_URI=https://YOUR_TEST_HOST/v1/sign-in/telegram/oidc/callback
   ```

   Keep the secret out of frontend files and chat. Register the actual callback exactly; do not use the UI's `/account` route or the local HTTP API address `http://127.0.0.1:3028` as the testnet callback. Restart the API after edits. `GET /v1/sign-in/options` should report `telegram.oidc: true`, and the account page should show **Continue with Telegram** or **Pair Telegram** instead of the legacy iframe.

4. First sign in to the existing Daclify account, unlock its vault, open **Account → Sign-in**, and pair Telegram. Complete provider consent and the explicit pairing confirmation. Then test Telegram entry in a separate browser session. An unpaired Telegram identity cannot open an existing account, and a Telegram session does not restore user-controlled signing/decryption keys. After database loss, recover your own account control first, then pair Telegram again; see [disaster recovery](../disaster-recovery.md).

Mini App setup is separate from OIDC. In BotFather, configure the bot's **Main Mini App** or **Menu Button** to open the same reachable HTTPS frontend, optionally at `/account`. The backend already uses `TELEGRAM_BOT_TOKEN` to verify Mini App launch data; adding a launch URL does not supply OIDC client credentials. Test launch/pairing from an actual Telegram client, including a phone where a computer's localhost is not reachable. [Telegram Mini App setup](https://core.telegram.org/bots/webapps).

## Google client setup and current implementation limit

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a dedicated test project, such as **Daclify Testnet**.
2. In **Google Auth Platform**, configure **Branding** with the app name and support/developer contact emails. Select an **External** audience when testers are not restricted to one Workspace organization, and leave publishing status at **Testing**. Add tester emails if desired; Google documents an exception to the test-user restriction for basic Sign in with Google scopes. Request only basic identity scopes (`openid`, `email`, `profile`), rather than Drive/Gmail access. [Google setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [audience/testing rules](https://support.google.com/cloud/answer/15549945).
3. In **Clients → Create client**, select **Web application**. Add the actual HTTPS frontend origin to **Authorized JavaScript origins**, without a path. For a later localhost setup, Google documents registering both `http://localhost` and `http://localhost:5198`; the backend's `FRONTEND_ORIGIN` must also match the address actually used. Do not assume the current `testnet.localhost` alias shares Google's documented plain-localhost exception.
4. Save the client ID ending `.apps.googleusercontent.com`. Our current token-verification adapter uses this as `GOOGLE_CLIENT_ID`; it does not consume a Google client secret. There is no implemented Google authorization-code callback to register yet, so do not invent `/v1/sign-in/google/callback`. A future callback flow would require its own exact registered URI; a JavaScript credential callback uses the registered frontend origin.

Creating the client does **not** enable Google login in the current UI. The backend currently requires `GOOGLE_CLIENT_ID` and `GOOGLE_PUBLIC_JWK` together, while the browser login/pairing ceremony is unfinished. Keep both fields commented until that integration is completed or an explicitly configured low-level verifier test is being run. `GOOGLE_PUBLIC_JWK` means a signing public key published by Google, not your OAuth client secret or a key you generate. Google rotates these keys: completing the integration should use its remote JWKS with rotation handling, and server-issued browser-bound nonce/state, rather than asking an operator to maintain a pinned key manually. [Google token-verification and rotation requirements](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
