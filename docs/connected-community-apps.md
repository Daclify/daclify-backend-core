# Connected community apps

Status: proposed integration, documented on 11 October 2026. External app registration, Daclify-issued third-party login, app-bound signing grants and the Community Activity module are not implemented. This guide describes the intended product and its boundaries; it is not an available API onboarding procedure.

A community can build its own small application and use Daclify for account verification, DAO membership and selected governance records. The app keeps its interface, hosting and database. Daclify supplies the shared community relationship and records member-authorised submissions without copying the application's complete task database onto the blockchain.

For a concrete project specification, use the [example mini-app design](examples/community-mini-app-design.md). The [platform design](superpowers/specs/2026-10-11-connected-community-apps-design.md) describes the proposed changes across core, modules and frontend.

## One community, several apps

A community creates a DAO and admits its members before connecting apps. A garden app, equipment booking app and volunteer rota can belong to the same DAO. Members join once and keep the same native member identity and voting weight across those apps.

Each app has a separate registration, source-record namespace, approved login callbacks, access settings and restricted signing permissions. Garden task 42 and equipment booking 42 are different records. Suspending the garden app stops its future access and recording authority without suspending the equipment app or removing community membership.

DAO membership establishes eligibility. Each app also enforces its business permissions, such as who can assign a task. Administrator/reviewer permissions and native executive office are distinct: becoming an executive does not automatically approve work in every app.

## Sign in and authorise actions

The proposed Sign in with Daclify flow redirects to Daclify's trusted login screen. A previously paired, configured email or Telegram method can authenticate the existing account. The app receives a verified identity scoped to that app and checks active membership in its configured DAO. It receives neither the person's login pairing inventory nor their private signing or decryption keys.

Login and activity authorisation are separate. A member enables a short-lived signing credential restricted to the app, DAO, module and permitted actions through Daclify's existing supported signer. After setup, a Complete click can use that credential in the app browser. The proposed first credential allows completion reporting and submission for review. Approvals and votes require their own displayed signing step.

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

Compact records still cost RAM. Exact limits and costs require native measurement. Each DAO/app needs explicit funded capacity, bounded identifiers and safe expired-grant cleanup. The first proposal retains completed receipts; the current Archive module does not automatically support their deletion.

## Public and private communities

Private DAO task details, photos and review contents are available only to authorised members. Protected snapshots and manifests are encrypted before public IPFS publication. An API login check alone cannot protect plaintext placed on IPFS.

A public DAO can publish selected information while keeping its operational apps private. Public visitors receive no membership, signing credential, review permission or voting authority. Every protected API read and write checks membership and the relevant app permissions; hiding controls in the browser is insufficient.

The public blockchain still exposes member identifiers, authenticated activity, timing, commitments and native voting outcomes. Private content does not imply anonymous governance. Removing a member restricts future access and key grants but cannot retract information or old keys they already obtained.

Signing credentials confer no decryption rights. The proposed first evidence viewer uses Daclify's trusted client boundary. Private evidence inside a public DAO requires explicit app encryption/key-grant support; the current public DAO document path does not provide that automatically. A mini app must not receive keys that unlock every other app's content.

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

## Current support and implementation dependencies

Current Daclify provides account sessions, paired login where configured, DAO membership, native scoped sessions, encrypted private documents and governance modules. Those components are foundations rather than an external-app login service. The current account/membership endpoints serve Daclify's own trusted clients.

The external feature needs registered-client login and consent, native app constraints, versioned producer-owned event schemas, the Community Activity module, app encryption grants and a public developer client. Adding an app origin to the trusted frontend CORS list or issuing a server API key does not supply those guarantees.

Potential projects can use the example to design their local workflow now. They must wait for a qualified integration release before using these proposed flows with real users. Exact endpoint names, SDK calls, deployed accounts, resource prices and release dates are intentionally unspecified here. Existing API/action schemas remain in the [generated reference](generated/reference.md).
