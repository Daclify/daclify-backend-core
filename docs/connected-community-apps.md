# Connected community apps

Status: implemented and installed on testnet, 11 October 2026. External app registration, Daclify-issued login, app-bound signing grants and the Community Activity module are available in the qualified development release. Projects still register their own DAO/apps and deploy their own backend. Mainnet is not qualified.

A community can build its own small application and use Daclify for account verification, DAO membership and selected governance records. The app keeps its interface, hosting and database. Daclify supplies the shared community relationship and records member-authorised submissions without copying the application's complete task database onto the blockchain.

For a concrete project specification, use the [example mini-app design](examples/community-mini-app-design.md). The [platform design](superpowers/specs/2026-10-11-connected-community-apps-design.md) describes the implemented boundaries across core, modules and frontend.

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

| Location | What belongs there |
| --- | --- |
| Mini-app database | Tasks, descriptions, instructions, assignment, photos, current state and pending submissions |
| Daclify service database | Registered clients, app-scoped identity/session state and recoverable delivery coordination |
| IPFS | Selected preserved snapshots and evidence files, encrypted when protected |
| Native activity module | Compact app/source references, source revision commitment, authorised member, event or decision kind and optional evidence reference |

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

The proposed Community Activity module provides nonfinancial completion and review records reusable across gardening, bookings, volunteering and other app domains. The first proposed review policy allows an authorised independent administrator or reviewer to approve or request changes; the submitter cannot approve their own request.

This proposal adds one reusable activity smart contract, alongside app-specific signing restrictions in the existing runtime. A shared deployment can use the same activity contract for many DAOs and apps, isolating their records by runtime, DAO and app. It does not create a smart contract per mini app or task. An independent DAO deployment can use its own compatible module instance. Login and most app data remain off chain; native code and resource changes need their own qualification before deployment.

Decide can provide a community ballot linked to the exact app/source revision and evidence. Ordinary polls are advisory. The app backend applies a confirmed result under its explicit business rules and must not apply approval to a later edited revision.

Works remains a separate funded contribution workflow with positive milestone amounts and its existing reservation, review and settlement rules. A completion credential gives no spending, withdrawal or automatic payment authority.

## Developer integration

The installed testnet integration uses core/frontend `0.13.0-alpha.6` and modules SDK `0.9.0-alpha.22`. Community Activity is an additive contract; the five existing module release pins stay unchanged. See [installation and verification evidence](evidence/2026-10-11-connected-community-apps.md) and the [testnet recovery setup](evidence/2026-10-11-testnet-single-host-recovery.md). This is not a production qualification.

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
