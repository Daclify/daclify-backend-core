# Daclify APIs on Hetzner

The VM is `167.233.206.242`. HAProxy runs on the host and routes exact hostnames to separate host API services:

| Environment | Core branch | Public API | Host listener | Database / owner | Approved browser origin |
| --- | --- | --- | --- | --- | --- |
| Mainnet | `main` | `https://api.daclify.com` | `127.0.0.1:3018` | `daclify_mainnet` / `daclify_mainnet_app` | `https://app.daclify.com` |
| Testnet | `dev` | `https://testnet.api.daclify.com` | `127.0.0.1:3028` | `daclify_testnet` / `daclify_testnet_app` | `https://testnet.app.daclify.com` |

Both authoritative API A records already point to this VM at `dns1.registrar-servers.com` / `dns2.registrar-servers.com`. No DNS, website or email records were changed. Frontends remain on Netlify. The frontend hostnames did not resolve during the deployment check; their Netlify domain setup and network selector still need verification.

## Installed state on 2026-10-07

- Checksum-verified Node `24.21.0` / npm `11.19.0`, Ubuntu Docker `29.1.3`, Compose `2.40.3`, HAProxy `3.2.9`, Certbot `4.0.0`.
- PostgreSQL `17.11-bookworm`, pinned by the official multi-architecture manifest digest in `compose.yaml`. The existing Mac fixture is PostgreSQL 17. Persisted data lives in the named volume `daclify_postgres_data`.
- PostgreSQL listens only through `127.0.0.1:5432`. Its two app roles own separate databases, have no administrative flags and are denied cross-database access by both grants and `pg_hba.conf`. Remote superuser connections are rejected.
- Database, HAProxy, the loopback ACME webroot server, renewal timer and backup timer start automatically. Firewall changes allow only HTTP/HTTPS in addition to the pre-existing restricted SSH rule on port 3939.
- A real Let's Encrypt certificate covers both API names and expires 2027-01-05. Registration uses `seth@animus.group`. Certbot's renewal dry run with deploy hooks passed. The hook validates expiry, both hostnames, trusted certificate chain, key match and staged HAProxy config before atomically publishing and gracefully reloading; a failed reload restores the previous PEM.
- Both API units were initially stopped and disabled while prerequisites were incomplete. There is no fallback between environments. The testnet rollout below records the later contract/provider setup.
- API source builds successfully using the two backend checkouts. The development bootstrap refreshes only local tarball integrity entries in their lockfiles; these artifacts remain unpublished and do not qualify mainnet.

On 2026-10-09, core's requested `dev` branch was created from the updated `main` and pushed. Both operator checkouts subsequently moved to the latest `dev` source (`0.8.0-alpha.1`), preserving deployment changes and private files. Separate release directories record their exact core/modules revisions in `source.json`; the operator checkout is never used directly by a running API.

## Private environment files

Edit these on the VM; never paste credentials into chat or commit them:

```sh
sudoedit /data/daclify-env/mainnet.env
sudoedit /data/daclify-env/testnet.env
```

Both files are root-owned mode `0600` in the root-only `0700` directory `/data/daclify-env`, outside all Git repositories. They were moved from `/etc/daclify` at the user's request; the old API env paths were removed. Database passwords, URLs, ports, network names and approved origins have been filled in. Each service runs as its own unprivileged OS user and gets only its own env file through systemd `LoadCredential`; JSON settings use the API's existing env parser rather than systemd's differing env-file quoting rules.

The preflight keeps the source files private and accepts systemd's read-only `api.env` in its actual `/run/credentials/` directory. On this host systemd grants the service user access through an ACL whose mask appears as mode `0440`; this does not make the credential readable by ordinary group members. [systemd credential access](https://systemd.io/CREDENTIALS/) is enforced by the kernel and the service's filesystem namespace.

You must supply the correct **relay active private key** for each chain. Mainnet additionally needs real deployed accounts, a reviewed Hub hash and an actually qualified release manifest. The sample mainnet accounts `core.we`, `hub.we` and `relay.we` returned account-query errors on the live RPC. Do not substitute testnet keys or change release metadata to pretend qualification passed.

The completed testnet settings pass the canonical configuration check. Its relay key matches live active authority, database/RPC/resource checks pass, Pinata and OpenRouter authenticate, Stripe reads the active test Price, and SMTP connection/TLS/authentication verification passes. The Pinata account ID was recovered from the authenticated JWT and saved privately; the user supplied the gateway key. The exact test-mode Stripe webhook is registered at `https://testnet.api.daclify.com/v1/billing/stripe/webhook`, with its new signing secret saved privately. Enabled events are Checkout completion, asynchronous success/failure and expiry. No email, payment or provider upload was sent. Gateway delivery still requires a verified funded allowance; frontend setup and browser acceptance are pending.

The startup check reads `API_RELEASE_MANIFEST` and `API_HUB_CODE_HASH`, requires the manifest's runtime/ABI/module pins to match the selected API's generated SDK, then confirms the live native RPC chain ID, runtime/Hub/module hashes, runtime raw ABI, resource floors, relay active authority, exact database role/database and cross-database denial. `API_RELEASE_MANIFEST` must resolve inside that environment's selected core release; a path relative to the core directory is supported. `API_PUBLIC_ORIGIN` is filled with that environment's exact HTTPS API origin so browser signing audiences agree.

The user separately authorized the latest testnet contract update and supplied the existing controller key in `/data/daclify-env/deploy.testnet.env`. The runtime now matches `f40c696e86ab532ca57ea073265a982f694f9f21f8de53300b51365e83711878`; all five modules match the generated SDK pins. Hub and Names already matched and were left in place. The update used two irreversible transactions: `2808bb322ed63def297c38372f1e9e19d2ca9f47aa62fe925f66ddb3bc54f3a6` and `d8aecd88bc4dee7098cb3064b0621268469bfffe4eb01179cd1cb08557dc94ca`. Additional testnet RAM was purchased from the configured creator. Module binaries, catalogue pins and existing DAO installation pins changed together. All 39 rows across 18 primary table scopes were verified; only the intended catalogue/module code hashes changed. Existing authorities were unchanged. Private code/ABI/account/table backups and receipts remain under `/data/daclify-upgrades/testnet/`.

The updater deliberately rejects pending module state or an existing RAM observer requiring a reviewed migration. It never resets rows or initializes quotas. Inspect receipts and live hashes after any uncertain response; do not blindly resend or roll back code over possibly changed state. Testnet development artifacts remain unqualified for mainnet; generate the actual candidate manifest instead of rewriting stale recorded manifests.

Optional services must be enabled with their complete settings together:

- Stripe: environment-specific platform key and complete settings for each enabled feature. Legacy billing uses a Price ID and `/v1/billing/stripe/webhook`; Connect uses its own OAuth client ID and `/v1/payments/stripe/webhook`. Hosting, prepaid storage and card RAM each use a separate product and webhook secret at `/v1/hosting/stripe/webhook`, `/v1/storage/stripe/webhook` and `/v1/resources/ram/stripe/webhook`. Prefix each with that environment's API origin. Mainnet requires a live key; testnet requires a test key. The testnet legacy endpoint is registered; actual payment qualification and other enabled-feature endpoints remain separate prerequisites. Live payment opt-ins remain disabled.
- Pinata: JWT, its dedicated account ID, HTTPS gateway origin and server-only gateway key together. A verified funded gateway allowance is required before content reads work. Keep uploads off until the allowance and ownership/provider qualification are complete.
- Email sign-in: SMTP host, sender and TLS settings; username/password together if used.
- Telegram OIDC: all OIDC fields and that environment's exact HTTPS API callback.
- Google, Telegram bot and docs-assistant fields are documented in the existing templates.

The start wrapper refuses shared signing/database/provider secrets across environments. Optional features remain disabled when their settings are absent. Setting OpenBao values does not enable production managed custody; see the existing custody decision.

## Fresh VM databases

On 2026-10-09 the user confirmed there is no Mac dump and there will be none. No import or import receipt is required. Both VM databases were verified empty, backed up and initialized using the API's canonical migration coordinator as their respective application roles. Each now has 36 recorded core/archive migrations and 55 public tables, with zero application accounts. No Mac account IDs or sessions were transferred; no application accounts or signing keys were fabricated.

Repeating the migration coordinator preserved all recorded hashes. Both new databases were separately backed up and restored into disposable databases, including checks of their empty account sets. Ordinary API startup applies only unapplied migrations transactionally and refuses changed published migration hashes. Never reset a database or remove its volume during updates. Storage cleanup and notices remain disabled until their provider/recovery prerequisites are qualified.

## Separate main and dev releases

The updated units use these independent code paths:

```text
/data/daclify-api/mainnet/current/daclify-backend-core
/data/daclify-api/testnet/current/daclify-backend-core
```

Each `current` symlink selects a directory under that same environment's `releases/`. Every release contains its own core and modules Git worktrees, `node_modules`, `dist`, package artifacts and migrations. Only Git's object storage is shared. A testnet build never uses mainnet's compiled files or dependencies. Each service is also denied filesystem access to the other environment's release tree.

Mainnet's core commit comes from `origin/main`; testnet's comes from `origin/dev`. The modules commit is supplied explicitly from the matching reviewed release manifest because the two repositories have independent release histories. The preparer never guesses a modules branch or falls back to `main` when `dev` is missing. The requested `dev` branch is on GitHub and local `dev` tracks `origin/dev`. GitHub CLI authentication is configured on the VM; its credential file is root-private. Never paste GitHub tokens into chat.

First commit and review these deployment changes, then merge them into each branch that will be deployed. The preparer rejects a branch that lacks the startup checker or backend-only bootstrap. The operator checkout at `/data/daclify-backend-core` can retain unrelated local changes; staging reads committed source and never changes its checked-out branch.

```sh
cd /data/daclify-backend-core
python3 ops/hetzner/prepare-release.py testnet MODULES_COMMIT_SHA
# Mainnet stages from main using its own reviewed modules commit:
python3 ops/hetzner/prepare-release.py mainnet MODULES_COMMIT_SHA
```

Replace `MODULES_COMMIT_SHA` with the full 40-character commit from that environment's reviewed manifest. Each successful command prints a new candidate directory named with the exact core/modules commits. It creates detached worktrees and a `source.json` record; it does not build, change `current`, start services, migrate databases or deploy contracts. Existing candidate directories are never overwritten. If staging or building fails, inspect or resume that candidate without touching the selected release.

For a testnet development candidate, build and verify **inside its printed core directory**:

```sh
cd /data/daclify-api/testnet/releases/CORE_SHA-MODULES_SHA/daclify-backend-core
node tools/bootstrap.ts --backend-only
npm run typecheck
npm test -- tests/host-preflight.test.ts tests/env-examples.test.ts tests/proxy-trust.test.ts
npm run build
npm run lint
```

Mainnet requires the programme's actually qualified, immutable artifacts and complete release evidence for the selected commits. Development bootstrap outputs do not qualify it. Use the reviewed production build/artifact procedure inside the mainnet candidate; leave unqualified candidates unselected. Update each private `API_RELEASE_MANIFEST` setting to its own reviewed manifest within the candidate core directory. The startup checker verifies the environment/branch record, pinned Git revisions and manifest location as well as the existing chain and database checks.

## Select and start a ready release

Once a candidate passes its required checks and configuration/release prerequisites, select it only for that environment. Substitute the printed candidate name for `CORE_SHA-MODULES_SHA`:

```sh
ln -s /data/daclify-api/testnet/releases/CORE_SHA-MODULES_SHA /data/daclify-api/testnet/.current-next
mv -Tf /data/daclify-api/testnet/.current-next /data/daclify-api/testnet/current
python3 /data/daclify-backend-core/ops/hetzner/start-api.py testnet
# For an already running API, restart only the updated environment:
systemctl restart daclify-api-testnet.service
```

Use the same steps with `mainnet` only after its real release qualification and prerequisites pass. The start wrapper checks the selected release before enabling the service. Both services can then run concurrently from different branches and commits. A running process retains its original release directory; never rebuild or check out another branch inside an active release. Prepare a new directory and switch only that environment's `current`. Retain previous releases; a rollback also requires database compatibility to have been tested. Never reset a database during an update.

The VM units have been updated, but no real release has been selected or started. These commands do not deploy contracts, upgrade them, change authorities or move assets.

```sh
systemctl status daclify-api-mainnet daclify-api-testnet --no-pager
journalctl -u daclify-api-testnet -n 50 --no-pager
curl --fail https://api.daclify.com/v1/network
curl --fail https://testnet.api.daclify.com/v1/network
```

`/v1/network` must identify the correct environment, runtime and native chain ID. The actual RPC `get_info` must agree; EVM chain IDs 40/41 are separate from these native IDs. Browser CORS and the Netlify network selector must agree with the exact approved origins and API URLs. Backend settings and fixtures cannot establish that the hosted frontend selector is correct.

## Backups and restore checks

The backup timer runs daily at 03:00 **Atlantic/Canary**, with up to 15 minutes of random delay and a catch-up after downtime. Dumps and SHA-256 sidecars are root-private under `/var/backups/daclify/mainnet/` and `/var/backups/daclify/testnet/`. The first backups contain the initial empty databases. No automatic retention deletion is configured. Off-VM backup copying is still to be configured; local copies share the VM failure boundary.

```sh
systemctl start daclify-backup.service
ops/hetzner/restore-check.sh testnet /absolute/path/to/testnet-backup.dump
# Optional third argument verifies an expected digest of sorted account IDs.
ops/hetzner/restore-check.sh testnet /absolute/path/to/testnet-backup.dump EXPECTED_SHA256
```

The restore script creates and removes only a uniquely named disposable database. Restoring an app backup into its live database is a separate maintenance operation; stop only that API, retain the old database and verify ownership, migrations and account IDs before selecting the restored database. Never use `docker compose down -v`, `docker volume rm`, database resets or `pg_restore --clean` as ordinary update steps.

Compose file secrets are mounted bind files. App password files are mode `0640` for root and the pinned container's postgres group ID, with host parent directories mode `0700`; ordinary host users cannot traverse them. The admin password is root-only. When reprovisioning, confirm the image's postgres GID before setting secret group ownership so initialization can read the files. The image init script runs only for an empty volume; editing it does not change roles in an existing database.

## Verification and remaining acceptance

```sh
python3 ops/hetzner/test-database.py
python3 ops/hetzner/test-routing.py
python3 ops/hetzner/test-releases.py
shellcheck ops/hetzner/*.sh ops/hetzner/postgres/*.sh
certbot renew --cert-name daclify-api --dry-run --run-deploy-hooks --no-random-sleep-on-renew
```

The database test checks real role flags, grants, rejected peer connections and restores preserving synthetic account IDs, using disposable databases. The routing test executes the real HAProxy config against temporary loopback listeners, tests both environments, preserves Origin, strips forged forwarding values and rejects unknown/mismatched Host/SNI. It verifies that stopping either fixture backend gives 503 without using the other backend. It does not run the real API services.

The release test uses real temporary Git repositories/worktrees to check main/dev selection, rejection of a missing dev branch, preservation of operator changes, and separate core/module build and dependency directories. It verifies that preparing or writing a testnet build cannot alter the mainnet fixture build.

Still pending: review/commit of the deployment tooling into the deployed branches; real credentials; a reviewed manifest and contracts matching the selected API source; mainnet accounts and qualification; simultaneous actual API operation and restart tests; live `/v1/network` acceptance; hosted frontend/DNS/network-selector and CORS verification; provider qualification; and an off-VM check that ports 3018/3028/5432/9080 are unreachable. Local listener inspection and firewall rules have passed, but an external network probe was not available in this workspace. No Mac import is planned or required.

Sources: [Docker localhost port publishing](https://docs.docker.com/engine/network/port-publishing/), [official PostgreSQL image](https://hub.docker.com/_/postgres), [PostgreSQL HBA](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html), [Certbot deploy hooks](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates), [Fastify proxy trust](https://fastify.dev/docs/latest/Reference/Server/#trustproxy).
