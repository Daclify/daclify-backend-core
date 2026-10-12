# A community app using Daclify

This runnable example keeps garden tasks in SQLite and uses Daclify for member identity and selected, member-signed completion receipts. Run a second copy for equipment using another app ID/client ID/database; both copies can belong to the same seven-member DAO. Managers and ordinary members keep their existing DAO roles.

The current starter build consumes public core `0.14.0-alpha.9` and modules `0.10.0-alpha.7` development archives (frontend candidate `0.14.0-alpha.10`). It persists a full binding and checks the verified client context returned by the new API. This is local development work; the older testnet core `0.14.0-alpha.4` does not supply that context and the starter fails closed against it. PostgreSQL has passed the shared local recipe checks. Connection-bundle/distribution tooling is implemented locally; public deployment remains a separate release step. Node `>=24.21 <25` is required for the pinned SQLite recipe.

Read the [database contract](../../docs/guides/mini-app-database-contract.md) and use one matched API/SDK set. The account root, pairwise subject and full native membership are distinct. The file is permanently bound to chain/runtime/DAO/app/issuer/client; changing any field refuses access rather than reusing another community's records.

## Setup

1. Create your DAO, enrol its members, and enable Community Activity from DAO modules.
2. Register the app in **Connected apps** with its HTTPS origin, exact `/callback` URI, and the same origin as its optional source API base. Copy its client ID and app ID.
3. Set these values in a private environment file and provide a TLS certificate/key for the mini app’s own HTTPS origin:

```dotenv
DACLIFY_ISSUER=https://testnet.api.daclify.com
DACLIFY_FRONTEND_ORIGIN=https://testnet.app.daclify.com
DACLIFY_CLIENT_ID=<registered client UUID>
DACLIFY_APP_ID=<native app ID>
DACLIFY_DAO_ID=<your DAO ID>
DACLIFY_CHAIN_ID=<verified 64-character native chain ID>
DACLIFY_RUNTIME=<verified native runtime account>
DACLIFY_ACTIVITY_ACCOUNT=daclifyactiv
MINI_APP_ORIGIN=https://localhost:9443
MINI_APP_PORT=9443
MINI_APP_DB=/absolute/private/path/garden.sqlite
MINI_APP_DATABASE_ENGINE=sqlite
# Production SQLite: declare an actual persistent local volume; temporary paths are refused.
MINI_APP_PERSISTENT_VOLUME=1
MINI_APP_TLS_CERT=/absolute/private/path/certificate.pem
MINI_APP_TLS_KEY=/absolute/private/path/private-key.pem
# Optional: the project's own server-only Pinata credential, for snapshot pinning.
MINI_APP_PINATA_JWT=<project server credential>
```

For local development, a certificate trusted by your browser is required. This example does not weaken Daclify's HTTPS/callback rules. Bind remains `127.0.0.1`; expose a deployed project through its own HTTPS reverse proxy. Keep third-party app JavaScript on its own origin.

From the core checkout, after bootstrap:

```sh
npx tsx examples/community-mini-app/build.ts
node --env-file=/absolute/private/path/mini-app.env --import tsx examples/community-mini-app/server.ts
```

Outside this workspace, use the candidate archives from the implementation checkout or its versioned frontend vendor directory. Their SHA-256 values are core `d6e9b1ac9a382f0ff3acfba5af5dc249a2c83df3fec75a1417ef089b189c9d04` and modules `a70a21f43ce60f79cc24926f612447ce429ef328d9daedfe52ce7c2892a593b7`; a private repository still needs authorized access. Install those files with `npm install ./daclify-core-protocol-0.14.0-alpha.9.tgz ./daclify-modules-0.10.0-alpha.7.tgz tsx@4.23.15 esbuild@0.28.2 zod@4.6.5 pg@8.23.1`, and copy the example files. The candidate API supplies an immutable starter/download route when its reviewed release directory is configured. It has not been deployed by this execution. The `build.ts` script uses the local esbuild binary. Never ship the environment file, SQLite database, TLS private key or provider credential in static assets.

## PostgreSQL and database qualification

For PostgreSQL, set `MINI_APP_DATABASE_ENGINE=postgres` and `MINI_APP_DB` to the project's protected PostgreSQL connection URL. Keep it in the server environment file. The same HTTPS server, verified actors and outbox flow apply. Database TLS, connection limits and backups belong to the app operator. `postgres-schema.sql` initializes the namespaced tables; the application needs privileges on its own `mini_app` schema. Schema initialization is serialized, and each completion locks its task row before reading the frozen outbox.

Each PostgreSQL tenant uses the full binding hash in primary, unique and foreign keys and every data query. Creating another binding creates a separate empty tenant; it cannot adopt the old tenant's tasks. One SQLite file holds one binding and refuses a different binding on open. Actor mappings never infer identity from names/email or member numbers alone. The caller owns the PostgreSQL pool; store calls release their transaction connections, and process shutdown closes the pool.

Both engines implement `MiniAppStore` and run the same conformance cases: tenant isolation, verified subject/member pairs, uint64 boundaries, atomic outbox persistence, concurrency, stable retries and exact evidence/review reconciliation. SQLite backup and PostgreSQL `pg_dump` restore are exercised with pending events. Both account-reconnection routes preserve the sole subject/native anchor, revoke old app access/refresh credentials and reject two existing subjects for the same client. Fresh source access is demonstrated separately from recording permission.

Run the disposable fixtures with an owned loopback database whose name ends in `_test`:

```sh
npm test -- tests/community-mini-app.test.ts
DATABASE_URL=<owned-loopback-_test-db> npm run test:integration -- tests/integration/mini-app-postgres.test.ts tests/integration/wallet-recovery.test.ts tests/integration/mini-app-database-maintenance.test.ts
```

`pg_dump` must be installed and match the server's supported major version; an explicit executable can be supplied through `MINI_APP_PG_DUMP`. These tests refuse nonlocal databases. They qualify this small recipe against the recorded engines; they do not certify arbitrary databases or establish a live native-chain/provider integration.

Restore only into the original binding. Back up app files and their surviving keys separately. Reapply completed deletion/revocation exclusions before allowing access after restore. An issuer/client migration needs a reviewed mapping with proof of both old and new actors; changing configuration never merges history. Versioned schema changes need a backup and pending-outbox upgrade test before installing newer pinned packages.

The [synthetic storage record](../../docs/evidence/2026-10-12-mini-app-database-storage.json) measures 256 disposable personal payloads. Logical deletion left both files allocated. Coordinated SQLite checkpoint/`VACUUM` reclaimed the fixture file; PostgreSQL normal vacuum reclaimed some empty tail space and made the remainder reusable. Future deletions need not repeat those exact sizes. Coordinate SQLite maintenance and allow rebuild space; shared network files and ephemeral-only volumes are unsuitable. Each app defines finite purpose-specific retention and backup handling.

## Existing SQLite databases

A nonempty database without binding metadata refuses normal startup with `APP_DATABASE_ADOPTION_REQUIRED`. Never delete it to make startup pass. Stop its old writers and confirm the original chain/runtime/DAO/app/issuer/client from trusted deployment records; those missing fields cannot be reconstructed from a task or member number. Adoption is an explicit operator assertion of that original scope, not automatic identity recovery.

Supply that original `AppBinding` as a JSON file, choose a new backup path, and supply a private `0600` JSON array of fresh app access tokens for the original outbox members. Obtain tokens through their own normal app sign-in; never use root keys, passwords or email matching. The command verifies current membership/client/subject, checks the old source/event/revision identities, creates a consistent SQLite backup while holding a writer lock, and binds/backfills in one transaction:

```sh
node --import tsx examples/community-mini-app/adopt.ts --database /absolute/private/path/garden.sqlite --binding /absolute/private/path/original-binding.json --backup /absolute/private/path/garden-before-binding.sqlite --access /absolute/private/path/member-access.json
```

If the original scope, an actor or frozen source revision cannot be verified, the command refuses and preserves the old database. Missing/removed-member access requires a separately reviewed migration; it cannot justify guessing a new author. A populated or existing backup path is never overwritten. Protect/remove the short-lived token file afterward, back up actual photos separately, and retain the database backup only under the app's disclosed retention policy. The `adoptLegacyDatabase` helper accepts already verified actors; callers must meet that same original-scope boundary.

New files initialize binding format 1 before task/outbox data. Actor mapping is unique by subject and native member within that binding. Tasks bound IDs to 64 characters, titles to 256 and details to 4096; builders can design other validated schemas. The one-completion task model intentionally does not support automatic reassignment or multiple completion revisions.

## Complete a task

Open the mini app and select **Sign in with Daclify**. Existing paired email/Telegram sign-in methods open the Daclify account session. Recording consent then uses the member's supported Daclify signer to approve a one-hour app credential. The private app key lives only in the original browser tab; refresh/logout requires renewed consent.

**Complete** saves the task and its completing member to SQLite in one transaction with a durable outbox event. The browser signs the canonical native activity payload. The outbox is confirmed only after the server independently checks the matching native receipt. A lost reply or repeated click reuses the event/source/revision; another member cannot take over its pending completion. Restarting the process preserves pending work.

**Submit for review** uses the separate restricted `askreview` action. An independent manager reviews it in Daclify. Checking confirmation again applies an accepted/rejected review only if the current task still has the submitted source revision. A later edit cannot inherit that approval. Linked ballots remain advisory and do not automatically change the app database.

The example has one task and no reopen/edit workflow. Projects adding those workflows need a unique outbox event for each selected source revision, immutable submitted intent, and conditional application of later reviews to that exact revision. Changes in a source API must never silently rewrite a historical receipt.

## Optional encrypted snapshot

An administrator rotates an app-specific snapshot key in Daclify and grants encrypted access to the completing member. These grants are separate from recording authority. Removing members, changing credentials/roles or changing registration makes future use of the old key invalid; an administrator prepares the next key. Previously decrypted content cannot be recalled.

**Complete with encrypted snapshot** saves the task but holds its receipt pending. It opens Daclify's trusted evidence screen, where the member unlocks their vault, reviews the source revision, optionally includes files, and approves encryption. Daclify encrypts the manifest and included bytes with the member's app grant. The mini app validates the selected context, pins ciphertext using its own provider credential, and saves the returned CID/commitment in the outbox. Return to the mini app and select **Retry confirmation** to sign that exact intent.

Pinning failure leaves the completion pending; it cannot fall back silently to a receipt without the requested evidence. Once selected, the snapshot commitment is immutable. If a reply is lost after the server saved it, retry confirmation retrieves the same saved intent. An upload that succeeds at the provider but fails before database persistence can leave an orphan pin; projects should reconcile provider uploads and apply their own retention policy. No provider mock establishes live IPFS availability.

From the DAO's activity list, fetch current task details through the app API or save its CID's ciphertext and open it in Daclify. The trusted viewer checks the byte hash, exact app/source/event domain and native key commitment before decrypting. Current details are labelled when their source revision has changed. Native rows hold no titles, instructions, photos, email addresses or Telegram IDs.

## Adapter endpoints

Every protected request validates the opaque bearer against Daclify's current `/userinfo`, including live DAO membership, full deployment and app configuration. The request supplies its expected client ID and checks the API-owned `x-daclify-client-id` response header; absent or different context refuses access. No previous actor is cached after a membership denial. The example supports trusted source-access tokens for reading and snapshot submission, while ordinary task completion additionally requires an active recording grant.

| Endpoint                               | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `GET /v1/tasks`                        | Current app database state                                  |
| `POST /v1/complete/:taskId`            | Save completion and durable native intent                   |
| `POST /v1/complete/:taskId?evidence=1` | Hold completion for selected evidence                       |
| `GET /v1/outbox`                       | This member's pending delivery intents                      |
| `GET /v1/outbox/:eventId`              | Immutable snapshot draft for its submitting member          |
| `GET /v1/sources/:sourceId`            | Versioned current source adapter                            |
| `POST /v1/evidence/:eventId`           | Pin protected ciphertext and freeze the selected commitment |
| `POST /v1/confirm/:eventId`            | Independently reconcile the native receipt                  |

The DAO remains the source of roles and membership. Public presentation does not make operational APIs public. Reviews and ballots use Daclify's trusted signer; this app credential cannot review, vote, administer members or spend funds. Linked ballot outcomes remain advisory; a project must explicitly define its conditional handling of an outcome.


## Cleanup notices and restored databases

Register an optional `cleanupUrl` in app configuration **version 2**, under an approved HTTPS origin; the starter implements `/v1/cleanup`. The URL is part of the configuration hash signed into the native registry. Version 1 configurations and hashes remain valid, but they have no cleanup endpoint. The portal registration form offers this field. A change requires a new native revision and renewed app consent.

Daclify records the native member and configuration verified when issuing the app identity. A newer unpublished draft cannot select a cleanup target. A notice uses a distinct ES256 JWT audience/type, the exact seven-field app binding, one subject/member and one event ID. Fetch keys only from the configured issuer; use `verifyCleanupNotice` from the public `mini-app-cleanup` SDK subpath. Never trust a JWT-supplied issuer, JWK URL, ordinary login token or browser member number. Signatures last at most ten minutes (the service normally uses five); re-signing after downtime keeps the event ID. HTTPS responses are limited to 16 KiB; delivery rejects redirects, private/reserved/mixed DNS addresses and nonstandard ports.

Leave-all notices wait for the corresponding confirmed native departure. Account-erasure notices proceed independently of unresolved native duties. Delivery leases one notice per turn so chain/HTTPS checks fit the lease, makes immediate progress through available notices, and uses at most twelve attempts within the finite 30-day report window. Stale registration, missing endpoints, unknown legacy member/configuration mappings, invalid acknowledgments and unavailable apps remain disclosed. No unrelated hosted profile field is retained while waiting.

The starter first persists an owner-only exclusion outside its SQL backup, then clears the exact app subject link. SQLite upgrades its outbox without changing event/source/receipt identities. PostgreSQL namespaces every update and applies the same exclusion before restored access. Completed and uncertain completion evidence, including identifiable free text or native member references needed for reconciliation, is explicitly retained as `DAO_COMPLETION_EVIDENCE`; unlinking its login subject does not make that content anonymous. Optional personal profile fields are not stored by this starter. A custom app must inventory and erase its own eligible private rows, attachments, caches and logs, and justify every retained class.

Configure `MINI_APP_CLEANUP_EXCLUSIONS_DIRECTORY` as a separate persistent absolute path (0700 directory, 0600 files), and `MINI_APP_MAX_BACKUP_AGE_SECONDS` to the actual maximum controlled SQL-backup age. Production requires both. Keep these exclusions available to every worker/restore host; they must survive the SQL snapshot being restored. The starter retains them through that age plus a one-hour margin and performs hourly bounded expiry cleanup. A PostgreSQL multi-host installation must supply a consistent shared exclusion volume and qualify its backup/recovery process; the database alone cannot supply independent restore exclusions. Do not retain older untracked SQL copies beyond this declared horizon.

Acknowledgment is the independent app operator's assertion. `confirmed` means eligible links/rows are handled under that app's policy; `retained` includes bounded nonpersonal retention codes. Neither proves destruction of every independent backup, recipient copy or blockchain record. The current source checks use real SQLite/PostgreSQL restores and genuine notice signatures, with fixture HTTPS delivery; they do not certify a live third-party operator or production GDPR compliance.
