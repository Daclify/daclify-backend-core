# Workspace testnet server setup — 10 October 2026

The user requested this server as the continuing development workspace, using
the supplied `/data/daclify-env` configuration, Telos testnet, an external
HAProxy, API port 9090 and frontend port 9091. The clean source checkouts were
switched from `main` to their tracked `dev` branches before setup:

| Repository | Initial dev revision | Version |
| --- | --- | --- |
| Core | `a0a7174` | `0.10.0-alpha.1` |
| Modules | `df625c1` | `0.9.0-alpha.8` |
| Frontend | `ca7bf6b` | `0.10.0-alpha.4` |

## Installed and configured

Node 24.21.0 / npm 11.19.0, PostgreSQL 17.11 and Caddy 2.6.2 are installed
under `/data/daclify-runtime`. Node's release checksum and PostgreSQL package
checksums were verified; Caddy/browser libraries came from Ubuntu's configured
APT repositories. No root package installation was needed. The core's
`node tools/bootstrap.ts --backend-only` completed, and the frontend's standalone
`npm ci --ignore-scripts --no-audit --no-fund` completed. Tracked package and
lockfile contents remained unchanged.

`API_HOST` now accepts a validated IPv4/IPv6 listener address, retaining the
loopback default. This instance uses `0.0.0.0:9090` so the external HAProxy can
reach `192.168.5.32:9090`. The frontend's built, testnet-locked bundle is served
at `192.168.5.32:9091`; its public API URL is
`https://testnet.api.daclify.com`. Caddy serves only `dist/`, supports SPA
fallback, returns 404 for missing assets, and provides `/healthz`.

The isolated fresh `daclify_testnet` database is owned by
`daclify_testnet_app`, with no superuser, database-creation or role-creation
privileges. Its generated password is stored only in the private API env.
PostgreSQL listens only on `127.0.0.1:5432`; local administration uses the
`animus` peer-authenticated Unix socket. Startup applied 32 core and 5 Archive
migrations. Previous service database records were not imported.

The API env directory is mode 0700 and all its files are mode 0600. The
original API env was preserved as `testnet.env.before-server-setup`. The
frontend env contains only public build settings. Core's API and deploy env
symlinks remain separate; the API refuses deployment keys. Storage cleanup,
storage notices and Telegram Docs delivery remain disabled as supplied.

`daclify-postgres`, `daclify-api` and `daclify-frontend` are enabled user
systemd services. Linger is enabled for `animus`, which keeps them running
after logout and starts the user manager at boot. The local runtime README,
service units, HAProxy backend snippet, status/rebuild commands and browser
smoke check are stored in `/data/daclify-runtime`.

## Verification actually executed

| Check | Result |
| --- | --- |
| Core TypeScript, build and lint | Passed. |
| Core environment/host regressions | 2 files / 10 tests passed (`env-examples` and `host-preflight`). |
| Frontend Vue type/template check and testnet build | Passed; existing approximately 509 KB Docs chunk warning remains. |
| Frontend lint | 5 checks passed. |
| Frontend unit tests | 33 files / 168 tests passed. |
| Live RPC and deployed code | Expected Telos testnet chain ID; runtime, Hub and all five configured module code hashes matched; runtime raw ABI hash matched. |
| Configured signing credentials | Public keys derived locally matched the relay and runtime active authorities; no transaction broadcast. |
| Local API and frontend | HTTP 200 on the private NIC at ports 9090 and 9091. |
| Database | Migration counts and non-superuser role privileges queried successfully. |
| CORS | Actual preflight returned 204, the exact HTTPS frontend origin and credential support. |
| Static serving | `/account` returned HTML 200 with `no-cache`; missing asset returned 404; `/healthz` returned 200. |
| Browser smoke | Welcome, live Hub DAO discovery and account/provider-options screens passed. Testnet lock ignored a saved production preference. No page errors or API 5xx responses. |
| External public HTTPS routes | Both returned HAProxy 503, "No server is available to handle this request", after local startup. External backend routing remains to be updated. |
| Core generated-doc check | Attempted but failed because `.artifacts/contracts/runtime.abi` is absent in this source-only checkout. Compiled contract artifacts were not rebuilt or substituted. |

The local browser check retains the real HTTPS browser origins while forwarding
its requests to this workspace's running listeners. Responses are actual API,
PostgreSQL and Telos reads, not HTTP fixtures. It does not establish external
HAProxy/TLS delivery, a real wallet/provider ceremony, payment fulfillment,
funded gateway access, backups, compiled native suites or release qualification.
No chain code, authority, balances or contract state were changed. No provider
messages or payment/model requests were sent. The fresh database has no supplied
gateway allowance period; hosted-content verification remains subject to the
existing funded-allowance procedure.

External routing required:

| Host | HAProxy backend |
| --- | --- |
| `testnet.api.daclify.com` | `192.168.5.32:9090` |
| `testnet.app.daclify.com` | `192.168.5.32:9091` |

See `/data/daclify-runtime/README.md` for local operations and hot reload.
The user confirmed that they will update the external HAProxy backends.

## Latest-work pull and public proxy verification

2026-10-10T12:15:30+01:00 (Atlantic/Canary). Fetched `origin/dev` in all three repos.
Core and modules were already current. Fast-forwarded frontend from `ca7bf6b`
to `91bd794` (handbook discovery/reading/deployment checks), version
`0.10.0-alpha.5`. Dependency versions and pinned producer archives did not
change. Existing local core setup edits were preserved.

Frontend Vue/TypeScript checking and testnet build passed. Public API, app and
frontend health URLs returned HTTP 200; all 18 public entry assets matched
the rebuilt local files by SHA-256. A Chromium browser check using actual
public HTTPS through HAProxy, without interception, passed welcome, live
DAO discovery, account options, handbook search and reading. No browser page
errors or API 5xx responses occurred. The saved-production preference still
cannot change this testnet deployment. All three services remain active.
Logs are `/data/daclify-runtime/frontend-latest-build.log` and
`/data/daclify-runtime/browser-public.log`.

## Subsequent service qualification

The initial disabled service settings and failed public HAProxy checks above describe the original setup stage. Public routing subsequently passed, and the [service qualification](2026-10-10-service-qualification.md) records the later private-chat Daxi webhook, sandbox hosting/storage/RAM products and webhooks, funded-storage reminders and test-mailbox alerts. Storage cleanup remains disabled. Native pricing/settings proposals await a user decision. Frontend delivery is now development version 0.10.0-alpha.7.
