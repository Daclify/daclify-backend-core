# Testnet sign-in and service qualification — 2026-10-10

This is development evidence for the server at `testnet.api.daclify.com:443` behind HAProxy, with API port 9090 and frontend port 9091. Configuration and a successful provider read are separate from complete payment, wallet or storage qualification.

## Changes applied

- Verified configured SMTP authentication and sent one delivery check to the designated tester. The tester confirmed inbox receipt; email pairing and sign-in confirmation remain human checks.
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
| Email | Public options report mail delivery; actual SMTP connection/authentication, message acceptance and tester-confirmed receipt passed. | Tester must pair their own account, enter the emailed code in that same browser, sign out, then verify email login. Email was not attached to a disposable account. |
| Telegram widget / Mini App | Bot identity and username match; configured proof routes and signature regressions pass. After the bot owner authorized the domain, the public widget rendered its **Log in with Telegram** button with no domain rejection. | Consent, pairing and Mini App launch require the tester. |
| Google | Legacy proof verifier exists, but Google credentials are absent and the account UI has no Google browser flow. | OAuth client/domain setup and a reviewed interactive integration are required. |
| Managed signup / recovery | API deliberately reports this unavailable; OpenBao is a candidate. | Further custody implementation and qualification are required. |

Telegram's login-domain setting is managed by the bot owner, separately from its API webhook. See [Telegram login widget setup](https://core.telegram.org/widgets/login/).

## Services

Ten of fourteen reported services are configured after this setup. Every service retains its producer-reported `not-qualified` status; these checks do not rewrite availability badges as live qualification.

| Service | Current evidence / prerequisite |
| --- | --- |
| Card RAM provisioning | Sandbox product/account/webhook configured. Signed no-op HTTP ingress accepts valid signatures and rejects invalid ones. Segregated backed RAM reserve, administrator consent, actual payment and native provisioning need a designated end-to-end test. |
| Shared hosting | Sandbox product/webhook configured; ingress verified. Approved free setup and ten member slots are now set on chain; actual disposable DAO creation passed. Paid capacity settlement and invoices remain unqualified. |
| DAO merchant Connect | Unconfigured. Needs a test Connect OAuth client ID, Connect webhook and merchant consent. |
| Pinata / hosted storage | Real auth, upload, lookup, metadata and gateway byte round trip passed. App-funded storage entitlement and shared gateway allowance are separate; gateway budget remains unconfigured. |
| Guarded retention | Disabled. Needs approved disposable cleanup data, funded periods, recovery proof and live deletion qualification. |
| Storage reminders | Enabled; SMTP and configuration checks passed. Actual reminder needs a verified paid period and currently authorized paired administrator. |
| Storage operator alerts | Enabled to the designated test mailbox. A staged review object and actual alert receipt remain unqualified. |
| Prepaid pinned storage | Sandbox product/webhook configured; ingress verified. Complete recurring invoice verification, capacity and cleanup still require qualification. |
| Card payments | Existing sandbox credentials, active one-time price and webhook verified. Authenticated no-op ingress passed; purchase fulfillment not exercised. |
| Google sign-in | External setup and interactive implementation absent. |
| Telegram sign-in | Credentials and domain valid; public widget renders. Tester consent and actual pairing/login remain unqualified. |
| Daxi in the app | A real public `/v1/docs/ask` call returned `answered`, linked to the accounts guide. Decisions use the provider's separate alpha decisions endpoint; absence from the ordinary model catalogue is not itself a failure. |
| Daxi on Telegram | Registered webhook matches this API, zero pending updates/no reported webhook error; three real updates were claimed with no Daxi failure log observed. Tester receipt of replies remains a human check. |
| Managed custody | Not implemented/configured as a usable service. |

Sandbox products/webhooks follow [Stripe's product API](https://docs.stripe.com/api/products/create) and [webhook endpoint API](https://docs.stripe.com/api/webhook_endpoints). The signed ingress checks use synthetic no-op events, not provider-delivered payments.

## Approved testnet policies applied

The user approved the [two shared-creation actions](2026-10-10-testnet-shared-creation-proposal.json). Code, raw ABI, chain ID, signing authority and exact action data were checked before broadcast. Transaction `e5239a46c5e15dd049911c26ec8703443e648fc377ef0d46ac5eb027e94af4ea` is irreversible: `shared_usd=0`, `free_members=10`. Independent pricing, premium, settler and existing conversion observation were preserved. [Before/after and receipt](2026-10-10-testnet-shared-creation-applied.json) record the native result.

A disposable browser identity prepared, reviewed and fulfilled a free DAO order through the public API. DAO `7010534441818256360` was created with the selected community policy, one active founding member and ten free member slots. [Native readback](2026-10-10-testnet-free-dao-verification.json) verifies the record. This test did not prove admission at the eleventh-member boundary, paid capacity or a backed automatic RAM entitlement; its entitlement table is empty.

Names initially returned `TIER_UNSET`. The user selected **$1** and accepted the reviewed provisioning arrangement with CPU and NET reduced to **0.5 TLOS each**. The revised [proposal](2026-10-10-testnet-basic-name-proposal.json) uses basic tier 0, `usd_cents=100`, `ram_bytes=30720`, `cpu_stake=net_stake=0.5000 TLOS`, and a **100 test-TLOS** float from `3boidanimus3` to `daclifynames`. The existing 20% native conversion premium, seller fees, treasury, settler and authorities were preserved. No premium tier, suffix or individual listing was created.

Transaction `9a232e1093e979ad7fc360686dcc3e167fb6062c1fa515e6b643845552151bba` applied funding, the basic tier and a fresh trusted Delphi observation atomically and irreversibly. [Applied state and receipt](2026-10-10-testnet-basic-name-applied.json) record the result. The observed provisioning estimate is 2.7587 TLOS per account, so the reserve covers approximately 36 accounts at that RAM price; this is an estimate, not a capacity guarantee.

The actual public quote returns **$1**, **68.1819 TLOS** at the observed rate plus the unchanged premium, 30 KiB RAM and 0.5 TLOS CPU/NET. Desktop and 390px public browser checks display these values, with no page errors, horizontal overflow or selected WCAG Axe violations. A [signed read-only purchase simulation](2026-10-10-testnet-name-purchase-simulation.json) executed native account creation, RAM purchase and CPU/NET delegation; reserve balances and sale rows stayed unchanged, and the name was not actually created. Actual wallet consent, payment settlement and card fulfillment remain unqualified.

An enabled user-systemd timer refreshes **only the Names oracle observation** every five minutes from the configured testnet Delphi `tlosusd` feed. `/data/daclify-runtime/names-oracle.mts` pins the testnet chain, runtime code/raw ABI and Names code, checks signing authority, consumes canonical schemas, rejects stale/future observations and verifies irreversible native readback. It preserves fee rules and performs no transfers or authority changes. Service failures retry after 15 seconds with a bounded restart limit. Initial update `08d0d99fb06f3324d40ae47680a829f0b9e3b5f149c1744c20d5b6b53d3cd9ba` was verified irreversible; an immediate repeated run correctly made no update. Inspect with `systemctl --user status daclify-names-oracle.timer` and `journalctl --user -u daclify-names-oracle.service`. Keep the runtime script and private environment in server backups. A failed feed or stopped timer can still make conversion quotes expire after 15 minutes.

## Reproducible evidence

Sanitized logs are under `/data/daclify-runtime`: `provider-readiness.jsonl`, `service-exercises.jsonl`, `pinata-retrieve-check.jsonl`, `live-auth.jsonl`, `live-evm.jsonl`, `stripe-ingress.jsonl`, `stripe-service-setup.json` and targeted unit-test logs. The original Pinata exercise used a wrong method name after upload; its separate retrieve check completed the round trip without another upload. The initial Telegram setup CLI omitted the explicit environment and was rerun with the testnet environment.

Core typecheck and lint passed. Provider/sign-in unit selection passed 73 tests. Notification/pricing/configuration selection passed 6 tests, native proof selection passed 2, and environment/host preflight selection passed 10. These disjoint selections total 91 tests. These use fixtures where stated and do not establish physical-wallet, live-card-settlement or destructive-cleanup qualification. Full WASM/native and live recurring-payment suites were not run.

The subsequent native activation uses actual deployed contracts and real signatures. Its operational scripts perform assertions before broadcasting and read back irreversible state. The first dry-run checked an incorrect environment variable/table spelling and was corrected against the environment example and generated ABI before any write. One oracle read rejected a newly published future observation; a later fresh read passed without weakening freshness validation. The first live Names browser check used `KB` instead of the actual `KiB` label and was corrected before both widths passed.

The additional six-file regression selection initially reported 22 passing and 12 failing tests: all 11 `tests/creation-fees.test.ts` cases lacked `.artifacts/contracts/runtime.abi`, and `tests/name-checkout.test.ts` lacked `names.abi`. The deployed Names ABI was then downloaded only after chain/code verification and exact canonical binary ABI comparison. The follow-up five-file selection (`names-sdk`, `name-checkout`, `name-market-routes`, `service-price`, `creation-preflight`) passed **23 tests**. The WASM creation fixture remains blocked: runtime/testtoken compiled artifacts and the Docker/CDT toolchain are absent on this server. No substitute WASM or invented ABI was used. These counts overlap earlier selections and are not added to the prior 91-test total.

The private environment and backups remain outside Git and frontend source. Runtime configuration uses the existing systemd environment-file path. Public frontend delivery is recorded in its sibling [UX evidence](../../../daclify-frontend/docs/evidence/2026-10-10-user-setup-and-services.md).

## Source delivery

Core setup and qualification are committed locally on `dev` as `63ef7c0`. The API binding/default, example and original server record are included with these qualification documents. Core build also passed before this commit. `git push origin dev` failed because this server has no GitHub authentication (`could not read Username`, terminal prompts disabled). Remote publication is pending; no main branch was changed.
