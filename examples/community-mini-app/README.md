# A community app using Daclify

This runnable example keeps garden tasks in SQLite and uses Daclify for member identity and selected, member-signed completion receipts. Run a second copy for equipment using another app ID/client ID/database; both copies can belong to the same seven-member DAO. Managers and ordinary members keep their existing DAO roles.

It uses the public `@daclify/core-protocol/connected-apps` and `@daclify/modules/sdk` packages. The current workspace supplies development archives for core `0.13.0-alpha.6` and modules `0.9.0-alpha.22`; there is no promise that these development packages are published to npm. Node 24.21 or newer is required for the built-in SQLite driver.

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
DACLIFY_ACTIVITY_ACCOUNT=daclifyactiv
MINI_APP_ORIGIN=https://localhost:9443
MINI_APP_PORT=9443
MINI_APP_DB=/absolute/private/path/garden.sqlite
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

Outside this workspace, install the two pinned public package archives, `tsx`, and `esbuild`, and copy the example files. The `build.ts` script uses the local esbuild binary. Never ship the environment file, SQLite database, TLS private key or provider credential in static assets.

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

Every protected request validates the opaque bearer against Daclify's current `/userinfo`, including live DAO membership and app configuration. The example supports trusted source-access tokens for reading and snapshot submission, while ordinary task completion additionally requires an active recording grant.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/tasks` | Current app database state |
| `POST /v1/complete/:taskId` | Save completion and durable native intent |
| `POST /v1/complete/:taskId?evidence=1` | Hold completion for selected evidence |
| `GET /v1/outbox` | This member's pending delivery intents |
| `GET /v1/outbox/:eventId` | Immutable snapshot draft for its submitting member |
| `GET /v1/sources/:sourceId` | Versioned current source adapter |
| `POST /v1/evidence/:eventId` | Pin protected ciphertext and freeze the selected commitment |
| `POST /v1/confirm/:eventId` | Independently reconcile the native receipt |

The DAO remains the source of roles and membership. Public presentation does not make operational APIs public. Reviews and ballots use Daclify's trusted signer; this app credential cannot review, vote, administer members or spend funds. Linked ballot outcomes remain advisory; a project must explicitly define its conditional handling of an outcome.
