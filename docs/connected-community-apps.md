# Connected community apps

Status: connected-app integration is implemented on testnet. The current tested development package set is core `0.14.0-alpha.4`, modules `0.10.0-alpha.4` and frontend `0.14.0-alpha.7`, reviewed 12 October 2026. Projects register their own DAO/apps and operate their own backend. Mainnet is not qualified.

A community can build its own small application and use Daclify for account verification, DAO membership and selected governance records. The app keeps its interface, hosting and database. Daclify supplies the shared community relationship and records member-authorised submissions without copying the application's complete task database onto the blockchain.

For a concrete project specification, use the [example mini-app design](examples/community-mini-app-design.md). The [platform design](superpowers/specs/2026-10-11-connected-community-apps-design.md) describes the implemented boundaries across core, modules and frontend.

## Availability and first connection

| Capability                                                                                                     | Current availability                                                                                  | Evidence or remaining work                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App registration, exact-callback sign-in, app-bound completion/review-submission grants and Community Activity | Implemented on testnet                                                                                | [Connected-app installation and native/browser checks](evidence/2026-10-11-connected-community-apps.md)                                                  |
| One account/kit, paired sign-ins and explicit reconnection from either a wallet-only or restored account       | Implemented on testnet                                                                                | [Account continuity](evidence/2026-10-12-account-access-continuity.md), [restored-account reconnection](evidence/2026-10-12-restored-account-pairing.md) |
| Persisted SQLite binding and verified actor context                                                            | Implemented in the local core alpha.8/modules alpha.6 starter candidate; not yet installed on testnet | [Foundation/connection plan](superpowers/plans/2026-10-12-self-service-mini-apps-and-account-exit.md)                                                    |
| MCP server, encrypted personal profiles, self-departure/closure and hosted-account erasure                     | Planned                                                                                               | [Approved workstreams and acceptance gates](superpowers/plans/2026-10-12-self-service-mini-apps-and-account-exit.md)                                     |

The SQLite and PostgreSQL starter candidates now run shared local conformance and restore checks; see the [recipe and engine evidence](../examples/community-mini-app/README.md#postgresql-and-database-qualification). The [agent publishing example](examples/agent-publishing.md) separates protected root login from scoped native publication. The candidate API is not yet installed on testnet. Public self-service downloads and the global Mini apps/discovery destination remain pending implementation.

Start with a DAO, admitted members and enabled Community Activity. Its administrator registers the app in the DAO's **Connected apps** tab, using its own HTTPS origin, exact callback and approved source API. The builder configures the registered client/app plus verified chain/runtime/DAO; a member signs in and separately approves recording. Confirm one synthetic completion against its exact native receipt before using real records. Daclify's owner is not a registration approver. A public package distribution path remains an implementation gate; the current private source/vendor archives alone do not complete a clean-machine self-service installation.

Use the [database and identity contract](guides/mini-app-database-contract.md) when designing any mini app. This applies to SQLite, PostgreSQL and another database engine; changing engines does not change the identity or privacy rules.

## Identity and recovery

The Daclify account is the canonical service identity. A client receives a pairwise app subject and the full native membership reference, not a global email-based app user. Keep issuer/client/subject separate from chain/runtime/DAO/member ID. Native IDs are validated decimal strings; the same member number in another DAO is another membership.

Account recovery and changes to paired sign-in methods do not create a new app user. Explicit reconnection preserves a sole subject mapping for the registered client and its native member anchor, then revokes old app authorization. Sign in and authorize again. If both profiles already have a subject for the same client, reconnection rejects rather than merging app histories. Never merge records by matching names, email or Telegram IDs. Two different registered root identities cannot be combined by this flow.

```mermaid
flowchart LR
  Account[Daclify account] --> Consent[App-specific sign-in and consent]
  Consent --> Subject[Issuer + client + pairwise subject]
  Consent --> Member[Chain + runtime + DAO + member]
  Subject --> DB[Bound mini-app database]
  Member --> DB
  Member --> Authority[Current native permissions]
```

App login, recording grants, independent review/votes and decryption access are separate checks. Possessing an app subject or hosted account alias proves none of the other permissions.

## One community, several apps

A community creates a DAO and admits its members before connecting apps. A garden app, equipment booking app and volunteer rota can belong to the same DAO. Members join once and keep the same native member identity and voting weight across those apps.

Each app has a separate registration, source-record namespace, approved login callbacks, access settings and restricted signing permissions. Garden task 42 and equipment booking 42 are different records. Suspending the garden app stops its future access and recording authority without suspending the equipment app or removing community membership.

DAO membership establishes eligibility. Each app also enforces its business permissions, such as who can assign a task. Administrator/reviewer permissions and native executive office are distinct: becoming an executive does not automatically approve work in every app.

## Sign in and authorise actions

The Sign in with Daclify flow redirects to Daclify's trusted login screen. A previously paired, configured email or Telegram method can authenticate the existing account. The app receives a verified identity scoped to that app and checks active membership in its configured DAO. It receives neither the person's login pairing inventory nor their private signing or decryption keys.

Login and activity authorisation are separate. A member enables a short-lived signing credential restricted to the app, DAO, module and permitted actions through Daclify's existing supported signer. After setup, a Complete click can use that credential in the app browser. The first credential allows completion reporting and submission for review. Approvals and votes require their own displayed signing step.

Delegation authorises the app credential within those limits; it does not independently prove that a person inspected every field or clicked a particular button. A workflow needing confirmation of every event opens Daclify's trusted signing screen. The first delegated client keeps its private key in browser memory and requires renewed authorisation after losing it. App backends never hold that key.

The existing native session limit is sixteen per member, with a maximum seven-day lifetime. App registration alone uses no signing-session slot. Many registered apps do not imply unlimited simultaneously active signing credentials. Expiry, revocation, app suspension and member deactivation stop new recording under the applicable policy.

## Keep detailed data in the app

| Location                 | What belongs there                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Mini-app database        | Tasks, descriptions, instructions, assignment, photos, current state and pending submissions                                         |
| Daclify service database | Registered clients, app-scoped identity/session state and recoverable delivery coordination                                          |
| IPFS                     | Selected preserved snapshots and evidence files, encrypted when protected                                                            |
| Native activity module   | Compact app/source references, source revision commitment, authorised member, event or decision kind and optional evidence reference |

Ordinary task creation and editing stay in the mini app. The first scope records selected completions, submitted reviews and decisions. Creating a task does not automatically allocate a Daclify task row.

Daclify can request current details from the app's authenticated API. A review instead uses the exact submitted source version and preserved snapshot, so editing the live task cannot silently change what a manager approves. Included photographs need actual file commitments; a mutable photo URL does not preserve the photograph.

Compact records still cost RAM. Native measurements and limits appear below. Each DAO/app needs explicit funded capacity, bounded identifiers and safe expired-grant cleanup. The first implementation retains completed receipts; the current Archive module does not automatically support their deletion.

## Public and private communities

Private DAO task details, photos and review contents are available only to authorised members. Protected snapshots and manifests are encrypted before public IPFS publication. An API login check alone cannot protect plaintext placed on IPFS.

A public DAO can publish selected information while keeping its operational apps private. Public visitors receive no membership, signing credential, review permission or voting authority. Every protected API read and write checks membership and the relevant app permissions; hiding controls in the browser is insufficient.

The public blockchain still exposes member identifiers, authenticated activity, timing, commitments and native voting outcomes. Private content does not imply anonymous governance. Removing a member restricts future access and key grants but cannot retract information or old keys they already obtained.

Signing credentials confer no decryption rights. The evidence viewer uses Daclify's trusted client boundary and separate app encryption/key grants, including for private evidence inside a public DAO. A mini app must not receive keys that unlock every other app's content.

## What happens when Complete is pressed

1. The app checks the signed-in member and task permission, then saves the local completion and a pending event together in its database.
2. It freezes the relevant task version and prepares any selected evidence snapshot, verifying the preserved bytes and references.
3. The browser signs the exact event using the member's restricted credential. The request binds the DAO, app, member, module, source revision, evidence, nonce and expiry.
4. Daclify checks native authority and resources, then records a compact receipt.
5. The app reconciles the receipt and changes Daclify confirmation pending to Recorded in Daclify only after the required confirmation.

The completer is the verified authorising member, separately from the assignee. Repeated delivery of the same logical event must not create another receipt. Local completion, IPFS hosting and native recording are separate systems: a durable outbox preserves pending work across failures, and a lost response requires reconciliation before retrying or signing a replacement.

A recorded completion is a member-authorised claim. Independent review can accept it or request changes; the record alone does not prove physical work or pay the member. If authorisation expires, evidence is unavailable or resources are exhausted, local work remains visibly pending for Daclify recording.

## Reviews and decisions

The implemented Community Activity module provides nonfinancial completion and review records reusable across gardening, bookings, volunteering and other app domains. Its initial review policy allows an authorised independent administrator or reviewer to approve or request changes; the submitter cannot approve their own request.

The integration uses one reusable activity smart contract, alongside app-specific signing restrictions in the existing runtime. A shared deployment can use the same activity contract for many DAOs and apps, isolating their records by runtime, DAO and app. It does not create a smart contract per mini app or task. An independent DAO deployment can use its own compatible module instance. Login and most app data remain off chain; native code and resource changes need their own qualification before deployment.

Decide can provide a community ballot linked to the exact app/source revision and evidence. Ordinary polls are advisory. The app backend applies a confirmed result under its explicit business rules and must not apply approval to a later edited revision.

Works remains a separate funded contribution workflow with positive milestone amounts and its existing reservation, review and settlement rules. A completion credential gives no spending, withdrawal or automatic payment authority.

## Developer integration

Use one matched development set: `daclify-core-protocol-0.14.0-alpha.4.tgz` (SHA-256 `0ba84f4f10ad4e5bffaecc759a8d11a28989743579780c548366cc10ea204121`) and `daclify-modules-0.10.0-alpha.4.tgz` (SHA-256 `c4da68084454a709e3d8246c824eca42942240a5d04d9494d552c6fe62b4ce5a`). Both are currently in the frontend repository's `vendor/` directory, accessible to authorized repository users; do not assume public npm/GitHub registry publication. The [restored-account delivery](evidence/2026-10-12-restored-account-pairing.md) verifies this set with frontend `0.14.0-alpha.7`. Preserve earlier archives rather than replacing their bytes. Contract code pins remain distinct from SDK versions; check the actual installed module/code through canonical interfaces.

```ts
import { ConnectedAppClient } from '@daclify/core-protocol/connected-apps';
import { CommunityActivityClient } from '@daclify/modules/sdk';
const client = new ConnectedAppClient({
  issuer: 'https://testnet.api.daclify.com',
  clientId: registeredClientId,
  redirectUri: 'https://garden.example/callback',
});
// Keep this instance in the original browser tab, with the delegate key in memory.
const consentUrl = client.beginLogin({ recording: true, grantSeconds: 3600 });
// Open consent in a popup; the exact callback returns to the original tab.
await client.finishLogin(callbackUrl);
const activity = new CommunityActivityClient(client, 'daclifyactiv');
// Persist this intent in the project's outbox before sending it.
const result = await activity.deliver(savedIntent);
// result.status is confirmed only after the exact native event is read back.
```

Tokens use a five-minute access lifetime and rotating refresh credentials bounded by the native recording grant. Every protected call rechecks active membership, native app revision, credential generation and current code pins. A token is scoped to one app/DAO; it contains no paired email, Telegram ID, vault secret or treasury authority.

Administrators manage apps from the DAO's Connected apps tab. Native app registrations hold fixed IDs, target/revision/configuration commitment and enabled/security-generation flags; names, exact HTTPS callbacks and source API settings live in PostgreSQL. At most 64 apps can be registered per DAO. Each member has at most 16 native sessions and one current recording grant per app, with seven days maximum expiry. Expired cleanup is bounded to 25 rows.

The module retains at most 10,000 selected receipts and 128 encryption epochs per app. Compact source/event hashes carry no private descriptions or photos. First receipt/table overhead measured 1,225 physical RAM bytes in the owned native fixture; a second app receipt/count used 889 bytes. These measurements include table/index headers and are not public testnet timings. Capacity must be backed by the existing RAM model; permanent receipts are not erased to make space.

The optional source adapter serves current detail under short-lived membership access. Daclify labels a revision that differs from the receipt. The trusted snapshot screen accepts an immutable project outbox draft and selected files, encrypts the actual bytes using a separately granted app key, and sends ciphertext to the project's pinning adapter. The native receipt stores CID, byte commitment and epoch. Protected snapshots remain encrypted for public DAOs too. Missing pinning, an unavailable source API or an unavailable wrapped key is shown as unavailable; it does not invent historical evidence.

See the [runnable SQLite/outbox example](../examples/community-mini-app/README.md), the [project design template](examples/community-mini-app-design.md), and the producer-owned schemas in the [generated reference](generated/reference.md).

If configuration fails, check the exact issuer/client, callback/origin, full membership reference and matched package pins. If recording fails, distinguish inactive membership, suspended app, expired/revoked grant, changed nonce, incompatible code, unavailable evidence and exhausted capacity. A restart preserves a durable outbox but loses the browser-held delegate; renew consent before signing, and reconcile an uncertain previous submission first. Removing an identity link alone does not anonymize surviving tasks, photos, receipts or backups. Each app defines its own record audiences, finite retention and cleanup; native receipts are retained under the limits above.
