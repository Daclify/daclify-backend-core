# Development checkouts and tests

This is an incomplete development release. The current runtime rejects direct module-key callbacks and pins module code with `get_code_hash`. Loading that runtime requires the Spring `GET_CODE_HASH` protocol feature. The local fixture activates it, and Telos mainnet has activated the same feature digest. Current recovery behavior and remaining operating requirements are in the [recovery runbook](disaster-recovery.md) and [0.7 upgrade guide](operations/upgrade-0.7.md). The older [implementation limits](evidence/implementation-limits.md) is a dated historical checkpoint; later evidence records supersede its completed items. Do not interpret application or emulator checks as a passing native security suite.

Set `MODULE_DEPLOYMENTS` to a JSON array of `{id, account}` objects for `decide`, `works`, `payroll`, `grants-rounds`, and `endorsement-admission` before the regular API can read those modules or settle payroll through the payroll contract. The account names differ by profile. [Operations](operations.md) lists them and covers deploy, Stripe, the TLOS quote, and the frontend network switch. `npx tsx tools/native/configure-report.ts --rpc <url> --chain-id <id>` checks `GET_CODE_HASH`. From this repository, `--fixture` also compares local code hashes and resource headroom. Run the local verify scripts. A workflow file does not show that GitHub Actions has run. Builds and tests run locally on the Mac. GitHub verification is manual-only; pushes and pull requests do not start jobs.

Check out `daclify-backend-core`, `daclify-backend-modules`, and `daclify-frontend` as sibling directories. They remain independent repositories, with separately versioned public core and module packages. Node 24.21 or later in the Node 24 line and npm 11.19 or later in the npm 11 line are required.

From core, run `node tools/bootstrap.ts` before the first ordinary backend `npm ci`. The dependency-free entry point stages only public protocol/SDK source, uses the checked-in builder lock, compiles that public package, packages the modules, and installs each repository. It copies both public archives into frontend's tracked `vendor/` directory and refreshes its repo-local dependency paths and lock integrities. The modules' exact core peer version is preserved. This does not publish registry packages or qualify a release.

The backend package graph contains local development tarballs, including the core service's own public SDK. An ordinary first backend `npm ci` cannot create those tarballs. The frontend checkout includes its pinned public packages and can install/build alone, including on Netlify. After producer changes, regenerate and commit frontend's archives, manifest and lockfile together; both ordinary and `--contracts` bootstrap paths refresh them. Existing npm caches and old lock integrities can otherwise conceal a stale SDK. The original sibling bootstrap was verified in a source-only copy with no pre-existing `node_modules`, `dist`, or contract artifacts.

To build the C++ artifacts, first build the documented checksum-verified Docker toolchain image from `tools/build/Dockerfile`, then run `node tools/bootstrap.ts --contracts`. It compiles core and module contracts, regenerates ABI types and references, and stages the core WASM/ABI consumed by module tests. It does not start or deploy to a blockchain. Generated artifacts must be checked against source before release.

Ordinary checks:

- Core: `npm run lint`, `npm run typecheck`, `npm run docs:check`, `npm test`. `npm run verify` runs those checks and then loads the release manifest. The manifest records commit, version, lockfile, toolchain, and artifact hashes. `npm run package:release -- --evidence <bundle.json>` verifies complete source/artifact-bound reports and writes immutable local artifacts; without that evidence it refuses. No command publishes or deploys. See [release qualification](operations/release-qualification.md). Build the frontend before loading its artifact-pinned candidate manifest.
- Modules: `npm run lint`, `npm run typecheck`, `npm run docs:check`, `npm test`. `npm run verify` runs those checks. Its optional manually dispatched GitHub workflow exits when `DACLIFY_CHECKOUT_TOKEN` or Docker is absent.
- Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. `npm run verify` runs lint, `vue-tsc`, and unit tests. Its optional manually dispatched GitHub workflow has the same token and Docker refusal. Browser journeys stay on `npm run test:e2e` and are not claimed by `verify`.
- All three `.github/workflows/verify.yml` files use only `workflow_dispatch`, as requested on 2026-10-07. They never run automatically on push or pull request. The optional manual core workflow requires the private sibling token and Docker. Local verification needs neither GitHub Actions nor `DACLIFY_CHECKOUT_TOKEN` once the sibling repositories are checked out.
- PostgreSQL/API: set `DATABASE_URL` to an isolated local database whose name ends in `_test`, then run core's `npm run test:integration`. The harness rejects other database locations. Provider session linking is part of that run. Fixture verification keys are supplied by the test, or by `GOOGLE_CLIENT_ID` with `GOOGLE_PUBLIC_JWK` and `TELEGRAM_BOT_TOKEN`. Those values stay outside the repository. `npm run verify` does not start PostgreSQL and does not run this suite.
- Browser: use the disposable native chain and PostgreSQL fixture, run core's `npm run dev:local`, then frontend's `npm run test:e2e`. Native test tooling is local-only and uses synthetic tokens. The browser suite includes two internal accounts with separate contributor/reviewer roles.

The local API uses a labelled disk content fixture with a 50 MiB per-DAO allowance. Its content-addressed files are not evidence of Pinata or public IPFS availability. Hosted storage requires backend `PINATA_JWT`, `PINATA_ACCOUNT_ID`, `CONTENT_GATEWAY`, and an explicit `CONTENT_FREE_STORAGE_BYTES` allowance. Those values stay in the gitignored environment file. The repository examples do not contain them. `CONTENT_FREE_STORAGE_BYTES=0` refuses new uploads.

Hosted reconciliation uses the existing PostgreSQL job table and leases, one bounded task per worker. Retry results back off to at most one hour. Lost leases cannot complete a job; malformed inputs and uncertain duplicate/expired pins produce a manual-review hold. Holds retain storage allocation. Automatic unpinning and a retention guarantee remain unimplemented.

Fifteen migration files (001–015) are in `migrations/`. Preserve every applied migration; add a new migration for future schema changes. `003_service_payments.sql` adds the account receipt table `service_payments`. The API applies a pending migration the next time it starts. Do not edit a migration after a database has applied it. A receipt does not change votes, permissions, withdrawals, obligations, or storage entitlements. Fixture enroll/fund commands and native keys belong only to the disposable test environment. No production deployment, authority change, funds movement, or legacy migration is included in this workflow. Deploy commands and their send flags are specified in [Operations](operations.md). A dry run sends nothing.

The optional manual GitHub workflows use immutable action hashes, read-only workflow permissions, no persisted checkout credentials, pinned Node/npm and a 20-minute job limit. Only if manually using GitHub verification, configure `DACLIFY_CHECKOUT_TOKEN` as a fine-grained credential with Contents read access only to the three private repositories (and organization approval if required). Store it as an organization secret restricted to these repositories or as a repository secret in each. Never substitute a broad personal credential. Hosted CI remains unverified until its actual checkout, bootstrap, checks and build succeed.

## Branches

Use `dev` for ongoing work in core, modules and frontend. Keep the three app repositories on matching development checkouts; their package versions and exact artifact integrities must still agree. A branch name does not establish package compatibility. The standalone `www-landing-page` continues using `main` and does not need a `dev` branch.

From each clean app checkout, run `git switch dev`, then `git pull --ff-only origin dev`. Preserve uncommitted work before switching. Create feature worktrees from the current `dev`, review and verify the affected changes, then merge into `dev` and push it. Update an app repository's `main` only when the user explicitly requests a release. Changing the GitHub default branch is a separate repository setting; creating `dev` does not change it.

The [9 October branch audit](evidence/2026-10-09-dev-branch-audit.md) records the older branches and the previously missing governance plan. Retaining an old branch does not mean its changes are missing; compare ancestry with `git merge-base --is-ancestor BRANCH dev` and inspect worktree status before integrating anything.

## Local checks and Netlify deployments

For the dedicated development frontend, follow the frontend's [Netlify dev guide](../../daclify-frontend/docs/netlify-dev.md). Netlify can build a frontend-only `dev` checkout using the committed public SDK archives, or accept a prebuilt local upload. Use a separate testnet Netlify project with frontend `VITE_NETWORK=testnet` and `VITE_API_TESTNET=https://testnet.api.daclify.com`. For Git builds, set those public values in Netlify's build environment, use `npm run build -- --mode testnet` and publish `dist`. No backend checkout or private package token is needed. The Git branch does not select the blockchain; the explicit env lock does. Saved browser choices cannot change a locked deployment.

Use the existing sibling bootstrap and checks on the Mac. Recompile contracts when their source changes; choose the required integration/native/browser suites for the affected flow. Run `npm run verify`, `npm run format:check` and `npm run build` in each affected repository before committing. A full release still requires the complete acceptance evidence described above. Disabling automatic CI does not remove tests or release gates.

For the frontend, build from `daclify-frontend`:

```sh
npm run verify
npm run build
```

For a mainnet frontend, use the ignored frontend `.env.production` (see `.env.production.example`) with `VITE_NETWORK=production` and `VITE_API_PRODUCTION=https://api.daclify.com`, then run `npm run build`. For the testnet frontend, put `VITE_NETWORK=testnet` and `VITE_API_TESTNET=https://testnet.api.daclify.com` in frontend `.env.testnet`, then use `npm run build -- --mode testnet`. Confirm actual service origins before publishing. The locked network and matching URL are embedded in the bundle; no `dist/networks.json` edit is needed. Rebuild/redeploy after env changes. Locked builds show a network badge instead of a switch and keep workspace screens closed if the API's reported environment differs; production expects `mainnet`. Check `/account`, `/docs` and the badge in the uploaded site.

The committed `public/_redirects` file supplies the Netlify SPA fallback, so direct `/account` and `/docs` visits reach the application. Netlify's existing static files take precedence, including `networks.json` and assets.

With Netlify CLI installed and authenticated, upload the already-built directory to a chosen project:

```sh
netlify deploy --no-build --dir=dist --site=YOUR_NETLIFY_PROJECT_ID
```

This creates a draft. After review, use the same command with `--prod` to update that project's main URL. For a separate testnet Netlify project, `--prod` means that project's stable testnet URL; it does not select the blockchain. Manual uploads remain available if Netlify Git builds are stopped or unconfigured. GitHub Actions remain manual-only regardless of the Netlify deployment choice. A random draft URL also needs explicit API/provider authorization before authenticated testing; prefer the stable testnet custom domain. [Netlify manual deploys](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/#manual-deploys), [current CLI flags](https://cli.netlify.com/commands/deploy/).

The selected backend topology is separate mainnet/testnet services on one Hetzner VM, each with its own environment, database and credentials. The VM can clone and build the sibling repositories directly; a Mac database dump or Mac-built API artifact is optional, not a setup prerequisite. See [hosted topology](operations.md#hosted-topology-and-recovery). Do not copy Mac `node_modules` to Linux. Any locally built container must target the Hetzner CPU architecture. Contract WASM/ABI artifacts are already built with the pinned toolchain. A reviewed server/deployment target is still required; this workflow does not provision Hetzner or authorize a mainnet deployment.

## Local frontend with a hosted testnet API

Once the hosted testnet API is configured and verified, leave `VITE_NETWORK` unset for the direct-development flow, set `VITE_API_ORIGIN=https://YOUR_TESTNET_API_HOST` in frontend `.env.testnet`, then run `npm run dev -- --mode testnet`. This development-only HTTPS origin overrides the network file and hides the service switch, so a saved Production choice cannot redirect development requests. CSRF storage is scoped to that API origin. A configured deployment lock takes precedence over this override. Changes remain local until committed and pushed. Requests still write to the actual testnet service and chain; they are not a private sandbox.

For dependable login, use a local HTTPS hostname under the **same site** as the API. Example only, assuming both domains are controlled by Daclify: browser `https://dev.app.daclify.com:5198`, API `https://testnet.api.daclify.com`. Map the developer hostname to `127.0.0.1` in `/etc/hosts` on this Mac; no public DNS entry or tunnel is needed. Vite continues to bind to loopback.

Create a locally trusted development certificate, for example with [mkcert](https://github.com/FiloSottile/mkcert):

```sh
brew install mkcert
mkcert -install
mkdir -p .artifacts/devcert
mkcert -cert-file .artifacts/devcert/cert.pem -key-file .artifacts/devcert/key.pem dev.app.daclify.com
```

`mkcert -install` adds a local certificate authority to the Mac trust store. Keep its CA private key on the Mac. The leaf certificate/key belong in ignored `.artifacts`, never Git or a frontend bundle. Set these frontend values, replacing the example hosts with the actual chosen domains:

```dotenv
VITE_API_ORIGIN=https://testnet.api.daclify.com
DACLIFY_TEST_HOST=dev.app.daclify.com
DACLIFY_TEST_HTTPS_CERT=.artifacts/devcert/cert.pem
DACLIFY_TEST_HTTPS_KEY=.artifacts/devcert/key.pem
```

Configure the **hosted testnet API**, keeping its primary hosted frontend origin:

```dotenv
FRONTEND_ORIGIN=https://YOUR_HOSTED_TESTNET_FRONTEND
FRONTEND_ADDITIONAL_ORIGINS=["https://dev.app.daclify.com:5198"]
```

Restart the API after editing its settings. The browser calls the hosted API directly with its real local Origin. Do not spoof Origin or proxy the login attempt cookie onto localhost: Telegram's callback must receive the same browser-attempt cookie on the hosted API. Register that API's exact HTTPS Telegram callback and the actual frontend origins with providers. Passkeys remain scoped to the configured primary hostname; adding an origin does not expand their relying-party scope.

Stripe checkout currently returns to `FRONTEND_ORIGIN`, including checkouts begun from the developer UI. Test the completed payment at the hosted frontend and return to the developer UI to refresh receipts. Telegram OIDC stores the initiating allowed frontend origin and returns there. Plain HTTP localhost to a hosted HTTPS API is cross-site; `SameSite=None; Secure` does not override browser third-party-cookie restrictions. Use the same-site HTTPS setup above and qualify real login/consent in supported browsers after Hetzner is available. [Browser cookie restrictions](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).

## Payment qualification fixture

The current payment-native test runs only against the owned `daclify-payments-native` fixture on port 20388. Start it with `DACLIFY_NATIVE_CONTAINER=daclify-payments-native DACLIFY_NATIVE_PORT=20388 npm run native:start`, then select `tests/native/connected-payments.test.ts` using `vitest.native.config.ts`. Do not point it at existing/public runtimes. PostgreSQL tests require an owned loopback database ending `_test`; browser `npm run test:e2e:payments` runs on 5218 with HTTP fixtures. These are separate evidence layers, not live Stripe or managed custody qualification.
