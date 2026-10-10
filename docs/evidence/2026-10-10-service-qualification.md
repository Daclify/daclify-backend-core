# Testnet sign-in and service qualification — 2026-10-10

This is development evidence for the server at `testnet.api.daclify.com:443` behind HAProxy, with API port 9090 and frontend port 9091. Configuration and a successful provider read are separate from complete payment, wallet or storage qualification.

## Changes applied

- Verified configured SMTP authentication and sent one delivery check to the designated tester. Inbox receipt and email sign-in confirmation remain human checks.
- Enabled Telegram Daxi for the verified designated private chat only, with zero approved groups. Registered the HTTPS webhook with the existing secret, message updates only, privacy mode and four connections. Environment backups retain the original disabled/group configuration privately.
- Created three **Stripe test-mode** products and separate hosting, storage and RAM webhook destinations. API version matches the pinned Stripe SDK (`2026-07-29.dahlia`). Persisted returned secrets only in the private environment; validated each producer-owned configuration before restarting the API.
- Enabled funded-storage reminders and operator alerts to the designated test mailbox. Destructive storage retention remains disabled.
- Uploaded one disposable 87-byte Pinata qualification object, verified recovery lookup, metadata and exact gateway bytes. Its identifiers are recorded privately in `/data/daclify-runtime/provider-test-file.json`. The object is retained; cleanup was not performed.

Provider writes used the user's authorization for disposable sandbox data. Test-mode assertions preceded Stripe writes. There were no checkouts, card charges, payouts, token transfers or authority changes during these checks.

## Sign-in methods

| Method | Evidence | Limit / remaining step |
| --- | --- | --- |
| Daclify signing keys | Real browser vault creation and public challenge/signature/session API against PostgreSQL passed. | Disposable service identities have no DAO memberships; recovery credentials were not published. |
| Passkey | Real registration, WebAuthn assertion and session passed over public TLS, using a Chromium virtual authenticator. Secure HttpOnly SameSite=None session cookie verified; vault stayed locked on passkey login. | Physical authenticator/password-manager consent still needs a human check. |
| Telos EVM | Real SIWE signature, browser-bound pairing and sign-in passed against the public API. Vault stayed locked. | Injected EIP-1193 bridge; real wallet extension, native governance and transfers were not exercised. |
| Telos Zero / Anchor | Public network declares native-sign-in capability; cryptographic native proof regressions run separately. | Actual Anchor client and a designated human testnet account remain unqualified. Operator keys were not reused as a human wallet. |
| Email | Public options report mail delivery; actual SMTP connection/authentication and message acceptance passed. | Tester must pair their own account, enter the emailed code in that same browser, sign out, then verify email login. Email was not attached to a disposable account. |
| Telegram widget / Mini App | Bot identity and username match; configured proof routes and signature regressions pass. | Public widget reports **Bot domain invalid**. Bot owner must authorize `testnet.app.daclify.com` in BotFather. Consent, pairing and Mini App launch require the tester. |
| Google | Legacy proof verifier exists, but Google credentials are absent and the account UI has no Google browser flow. | OAuth client/domain setup and a reviewed interactive integration are required. |
| Managed signup / recovery | API deliberately reports this unavailable; OpenBao is a candidate. | Further custody implementation and qualification are required. |

Telegram's login-domain setting is managed by the bot owner, separately from its API webhook. See [Telegram login widget setup](https://core.telegram.org/widgets/login/).

## Services

Ten of fourteen reported services are configured after this setup. Every service retains its producer-reported `not-qualified` status; these checks do not rewrite availability badges as live qualification.

| Service | Current evidence / prerequisite |
| --- | --- |
| Card RAM provisioning | Sandbox product/account/webhook configured. Signed no-op HTTP ingress accepts valid signatures and rejects invalid ones. Segregated backed RAM reserve, administrator consent, actual payment and native provisioning need a designated end-to-end test. |
| Shared hosting | Sandbox product/webhook configured; ingress verified. On-chain hosted settings are absent; capacity settlement and paid invoices remain unqualified. |
| DAO merchant Connect | Unconfigured. Needs a test Connect OAuth client ID, Connect webhook and merchant consent. |
| Pinata / hosted storage | Real auth, upload, lookup, metadata and gateway byte round trip passed. App-funded storage entitlement and shared gateway allowance are separate; gateway budget remains unconfigured. |
| Guarded retention | Disabled. Needs approved disposable cleanup data, funded periods, recovery proof and live deletion qualification. |
| Storage reminders | Enabled; SMTP and configuration checks passed. Actual reminder needs a verified paid period and currently authorized paired administrator. |
| Storage operator alerts | Enabled to the designated test mailbox. A staged review object and actual alert receipt remain unqualified. |
| Prepaid pinned storage | Sandbox product/webhook configured; ingress verified. Complete recurring invoice verification, capacity and cleanup still require qualification. |
| Card payments | Existing sandbox credentials, active one-time price and webhook verified. Authenticated no-op ingress passed; purchase fulfillment not exercised. |
| Google sign-in | External setup and interactive implementation absent. |
| Telegram sign-in | Credentials valid; widget blocked by its external domain setting. |
| Daxi in the app | A real public `/v1/docs/ask` call returned `answered`, linked to the accounts guide. Decisions use the provider's separate alpha decisions endpoint; absence from the ordinary model catalogue is not itself a failure. |
| Daxi on Telegram | Registered webhook matches this API, zero pending updates/no reported webhook error; three real updates were claimed with no Daxi failure log observed. Tester receipt of replies remains a human check. |
| Managed custody | Not implemented/configured as a usable service. |

Sandbox products/webhooks follow [Stripe's product API](https://docs.stripe.com/api/products/create) and [webhook endpoint API](https://docs.stripe.com/api/webhook_endpoints). The signed ingress checks use synthetic no-op events, not provider-delivered payments.

## Pricing decisions still required

Shared creation still uses `shared_usd=2000`, with no hosted-member policy. The existing application/product policy is free shared setup with ten member slots. [Two schema-validated unsigned actions](2026-10-10-testnet-shared-creation-proposal.json) propose that alignment while preserving independent pricing, premium and settler. They have **not** been broadcast; the user has been asked to choose the testnet policy.

Names has zero tiers, zero suffixes and zero listings. A real quote cannot succeed until the operator selects a basic-name price/resources or establishes an offer. A user pricing decision is pending; no tier price was invented or changed. TLOS rate observations are also stale and require an operator update for conversion-dependent quotes.

## Reproducible evidence

Sanitized logs are under `/data/daclify-runtime`: `provider-readiness.jsonl`, `service-exercises.jsonl`, `pinata-retrieve-check.jsonl`, `live-auth.jsonl`, `live-evm.jsonl`, `stripe-ingress.jsonl`, `stripe-service-setup.json` and targeted unit-test logs. The original Pinata exercise used a wrong method name after upload; its separate retrieve check completed the round trip without another upload. The initial Telegram setup CLI omitted the explicit environment and was rerun with the testnet environment.

Core typecheck and lint passed. Provider/sign-in unit selection passed 73 tests. Notification/pricing/configuration selection passed 6 tests, native proof selection passed 2, and environment/host preflight selection passed 10. These disjoint selections total 91 tests. These use fixtures where stated and do not establish physical-wallet, live-card-settlement or destructive-cleanup qualification. Full WASM/native and live recurring-payment suites were not run.

The private environment and backups remain outside Git and frontend source. Runtime configuration uses the existing systemd environment-file path. Public frontend delivery is recorded in its sibling [UX evidence](../../../daclify-frontend/docs/evidence/2026-10-10-user-setup-and-services.md).
