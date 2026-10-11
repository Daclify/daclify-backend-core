# Connected community apps with member authorised activity

Date: 11 October 2026, Atlantic/Canary. Status: user-approved design, implemented for testnet qualification. The user selected member-authorised completions, compact native records, optional IPFS snapshots, several apps per DAO, and public/private DAO support, then requested backend/frontend implementation and testnet rollout. Signup and connected apps share the qualified development release. Production deployment remains unauthorised. Existing native authorities are preserved; the additive Activity account delegates control to the existing runtime. The friend's app and DAO are not modified or created by this implementation.

Daclify supplies identity, membership and selected activity or decision records to independently hosted community apps. A community creates its DAO and admits its members, then connects applications such as garden care, volunteer planning and equipment booking. Each app keeps its own database and interface. Members can authenticate through credentials already paired to their Daclify account, including configured email and Telegram methods. Recording an activity requires separate member signing authority.

## Agreed product scope

- One DAO can register several independently hosted apps. A member joins the DAO once; connecting another app creates neither another membership nor additional voting weight.
- App access requires verified active membership in the configured DAO. A complete DAO reference identifies the chain, runtime, DAO ID and interface; names and URLs are display information.
- Public and private DAOs can connect apps. Public visibility does not grant membership or permission to record activity. Private task content and evidence remain restricted to authorised members.
- The first integration records selected task completions, submitted reviews and decisions. It does not synchronise every database edit.
- Task descriptions, instructions, photos and ordinary working state remain in the app's database. Preserved evidence belongs in IPFS, with compact references in Daclify.
- A completion records the member who authorised it, separately from the person assigned to the task. A task marked Unassigned can still have an identified completer.
- Member authorisation is required. An app backend's assertion that a person clicked Complete is not a member signature.

Garden Care is the motivating example. Its private repository was reviewed at commit `88c928ed42ba643924b56785634ccf5df1a34479` on branch `home`; its actual integration requires a separate authorised change. A garden DAO does not yet exist. Development examples must use owned disposable fixtures rather than create a public DAO implicitly.

## Several apps under one DAO

Each registered app has its own identifier, approved HTTPS origins and exact login callbacks, configuration revision, enabled capabilities and suspension state. Server client credentials and login attempts stay in PostgreSQL. Native authorisation retains only the bounded app identity and configuration needed to enforce signing restrictions; it must not trust a browser-provided registration or a database role projection.

The public identity issued to an app is stable for that app and resolves to the existing DAO member. It does not disclose the person's private email or Telegram pairing inventory. Changing a paired login method does not create another app user or member. Issuer identity, app subject mappings and necessary issuer secrets need verified backups; service loss must not be represented as recovery of missing pairings.

Apps may use common DAO roles while retaining their own business permissions. The garden app can control task assignment, while an equipment app controls bookings. Membership, application administrator/reviewer permissions and native executive office are distinct. In the example with two managers and five ordinary members, managers receive explicit permissions for the relevant workflow. Executive status alone is not used as a generic permission to approve every app action.

Disabling one app invalidates its access and delegated recording permissions without removing DAO membership, disabling other apps or erasing previous records. Member deactivation and credential rotation invalidate future unauthorised actions under the existing native policy. They do not erase previously authorised activity.

## Public and members-only communities

DAO privacy, an app's public presentation and permission to act are separate settings. The same DAO can have a public garden progress page and a members-only equipment app. The first integration keeps protected app access and all recording actions membership-gated in both public and private DAOs. Optional visitor pages expose only explicitly published material; they issue no member signing credential.

| Community | App data and evidence | Recording and governance |
| --- | --- | --- |
| Private DAO | Task details, photos, review contents and decrypted snapshots are members-only, subject to the app's additional permissions. No automatic public summaries or content publication. | Active members can request their permitted actions; administrators, reviewers and voters retain the relevant DAO/module checks. |
| Public DAO | A community may publish selected summaries and decisions. Operational details and snapshots remain protected unless explicitly published; a public DAO does not make every connected database public. | The same membership and role checks apply. Public readers receive no recording, review or voting authority. |

App backends and Daclify APIs enforce protected reads as well as writes. The SDK does not rely on hiding buttons. Identity tokens and local sessions do not freeze membership indefinitely: protected access rechecks current membership and app state, fails closed when authority cannot be verified, and has an explicitly bounded revocation delay. Native actions always check authoritative live membership. Public endpoints, search, previews, shared links, caches and notifications must not expose protected titles, photographs, review text, pairing details or source API credentials. Publishing a summary is an explicit permitted operation with a defined audience.

Encryption protects private content independently of an API access check. Public IPFS receives only ciphertext for protected snapshots, including manifests and included files; keys travel through authorised encryption-key grants. Signing grants do not confer decryption rights. App-specific content access must not export a root vault or grant a mini app the ability to decrypt every other connected app's content. The proposed first evidence viewer uses Daclify's trusted client boundary; direct decryption inside a mini app requires separately qualified, app-scoped key access and explicit consent. Key recovery and managed access must respect the DAO's existing admission policy.

Private evidence in a public DAO needs an explicit versioned app encryption envelope and authorised key distribution. It cannot silently reuse the existing public DAO document path: that path requires an unencrypted public envelope. The new activity/reference implementation must qualify this case while preserving existing DAO document rules. The implementation plan must select and measure the minimal app-key/grant storage and recovery path.

Members-only content does not imply an anonymous community. On the existing public native ledger, DAO/member identifiers, app grants, authenticated actors, transaction timing, commitments and native voting activity/outcomes remain observable. Source references should use opaque random identifiers or protected commitments rather than a guessable hash of a small task number. Sensitive descriptions and business conclusions stay in encrypted content; any outcome required in plaintext by a native governance module remains public. API restrictions cannot conceal native tables or transaction history. Hiding membership, activity relationships or vote outcomes requires a separate privacy protocol and is not claimed by this proposal.

Removing a member stops new access and grants under the configured policy, advances applicable future encryption epochs and revokes app sessions. It cannot retract plaintext, ciphertext keys or public results already obtained. Retained evidence remains decryptable only by surviving authorised grants and recovery material, with missing-key states reported honestly.

## Login and signing

External login uses a registered-client OpenID Connect authorisation-code flow with PKCE, state and nonce checks. Daclify authenticates the user at its own origin, obtains the requested consent, verifies current membership and returns app-specific identity through the registered callback. The app creates its own protected session. Client registration, token audiences and callback validation are new work; adding an app to the trusted frontend CORS list is not this feature.

Paired email or Telegram login opens an account session. It does not export or unlock the member's signing or decryption keys. On first enabling activity recording, the member uses an existing supported signing path in Daclify to approve a short-lived credential for that app, DAO, installed module and exact action set. The root key stays in Daclify's existing client boundary or supported wallet. The delegated private key stays in the app browser, never its backend or ordinary logs. The first client keeps it in memory and requires renewed authorisation after losing it; persistent browser key storage requires a separately qualified encrypted design.

Initial delegated authority covers completion reporting and submission for review. It grants no administrator actions, approvals, voting, withdrawals or spending. Manager approvals and votes use a separately displayed member signing step. A later design may add explicitly consented capabilities without broadening existing credentials.

A delegated signature proves use of the member's approved app credential within its scope. It does not independently attest that the member saw every field or clicked a particular button; compromised app code could misuse its active credential within those limits. Consent states that authority plainly. Workflows requiring confirmation of every event use Daclify's trusted signing screen rather than automatic delegated signing.

Existing native sessions constrain target, action and module code, but do not constrain an app identifier inside the payload. The implementation must add native app constraints beside those sessions and a producer-owned action envelope containing the actor context and app identifier. Both the runtime and new activity module must reject an app or action mismatch. Existing serialized session and member rows remain unchanged. A generic session cannot bypass the new app constraint by calling the same activity action directly.

Signed requests bind the chain, runtime, DAO, member, app, module and code revision, source record/version, event kind, evidence commitment where present, native nonce and short instruction expiry. Credential revocation, expiry, module replacement and app suspension are checked at execution. Adding a new app action to the existing scope whitelist alone is insufficient.

Registration and login do not consume native signing-session slots. Active delegated grants initially retain the current limits of sixteen sessions per member and seven days maximum lifetime, with at most one active grant per member/app. The client shows the expiry and allows explicit renewal or revocation. Bounded cleanup reclaims expired app constraints and sessions without deleting active authority or replay evidence. More simultaneously active signing grants require measured RAM and a separate compatible change; the number of registered apps is governed by explicit service and DAO resource capacity.

The current shared member nonce also applies across apps. The SDK prepares and reconciles requests through a common member coordination path. A stale nonce requires a fresh native read and a new client signature. An uncertain broadcast must be reconciled before the client signs a replacement; the server cannot alter signed bytes.

## Data location and compact records

| Location | Data and purpose |
| --- | --- |
| App database | Current tasks, instructions, assignment, photos, business state, local completion actor and durable pending submissions |
| Daclify service database | App client configuration, consent/session state, request coordination, source-to-native lookup mappings and recoverable delivery state |
| IPFS | Selected immutable snapshots and evidence files, or a versioned manifest of those files |
| Native activity module | App/task reference, source revision commitment, authorised actor, event or decision kind, chain recording time, idempotency identity and optional evidence reference |

Only records involved in a selected action allocate native activity state. Creating an ordinary task in the app does not create a Daclify task row. The generic source reference includes the app, record kind and opaque source ID; a bounded canonical representation or digest identifies it without storing the description. Two apps can each have task 42 without sharing a record. Different DAOs remain isolated even when their local app and task labels match.

The implementation plan selects exact stored fields and indexes against real lookup and recovery needs. No task title, instructions, photograph, paired email, Telegram identifier or arbitrary source API URL belongs in each native activity row. A configured app API supplies authorised viewers with current details. Frozen review evidence is retrieved by its committed IPFS reference, independently of later edits to the live task.

An evidence manifest binds the source identity, source version, submitted contents and the actual included file commitments. A snapshot containing only a mutable photo URL does not preserve the photograph. Private snapshots are encrypted before publication. Pinning, verified retrieval, retention terms and independent backups determine availability; an IPFS CID alone does not guarantee recovery.

Small receipts still consume RAM as their count grows. Qualification must measure WASM size, per-app/per-grant/per-receipt RAM, required indexes and native action CPU with pinned CDT `-O=s`. New activity uses explicit funded DAO/module capacity. Exhaustion leaves local work visibly pending and preserves existing records and rights. The first version does not prune completed receipts. Larger-volume batching and source-qualified archival are follow-on work; existing Archive support for documents and ordinary polls does not automatically qualify a new activity-table recipe.

## Completing the task shown in Garden Care

1. Roberto signs in using a method paired to his Daclify account. Garden Care verifies current garden DAO membership and applies its task permissions.
2. Roberto enables the restricted garden recording credential through Daclify if no valid browser credential exists.
3. Pressing Complete atomically saves the local completion and a durable pending event in the app database. The actor is derived from verified identity, not an editable assignee field.
4. The connector preserves the relevant task version and prepares any selected IPFS snapshot. Snapshot bytes and references must be verified before an evidence-backed native record is confirmed.
5. The browser authorises the exact completion request with its restricted credential. Daclify validates the signature, live membership, app binding, module grant, expiry, nonce and available resources. The activity module stores the compact completion receipt.
6. The app reconciles the receipt and shows the native confirmation separately from the local completion. Lost responses and retries reuse the same logical event identity and cannot create another receipt.

The UI can show Completed by Roberto with Daclify confirmation pending, then Recorded in Daclify after the transaction is confirmed under the required finality policy. A blocked request explains whether authorisation, evidence availability or resources need attention. Background retries cannot fabricate a signature, extend an expired grant or represent an unconfirmed event as recorded. If fresh signing is required, the user reconnects and authorises the retry.

Local saving, IPFS hosting and native execution are separate systems. The connector uses a durable outbox and reconciliation, not an assumed atomic transaction across them. Its result carries the complete DAO/app/source identity and expected record version. Applying a returned result uses a conditional database update and never approves an edited record by mistake.

A completion is a member-authorised claim that work was done. It is not proof of physical work, a certified photograph, complete capture of all app edits or automatic acceptance by a manager. App assignment/existence rules remain enforced by the app backend; Daclify cannot independently evaluate arbitrary database rules.

## Reviews and governance modules

A reusable Community Activity module records completions and nonfinancial review requests without knowing gardening, booking or rota fields. A review names the exact source revision and preserved evidence. The proposed first policy follows existing independent review semantics: one currently authorised administrator or reviewer can approve or request changes, and the submitter cannot approve their own request. Communities needing both managers' approval require an explicitly defined additional policy rather than an inferred executive quorum.

Community Activity is one new reusable contract implementation, with additive app constraints in the existing runtime. A shared deployment can host many DAOs and apps on one reviewed activity contract, with authoritative runtime/DAO/app isolation and explicit payer accounting. Independent deployments may install their own compatible instance. Neither registering an app nor creating a task implies deploying a new contract. Exact deployed accounts, code pins and permissions belong to the qualified deployment packet.

Decide provides community votes. A decision link must bind the exact ballot, app/source revision, evidence commitment and DAO policy; an arbitrary successful ballot is not approval of another task. Native reference registration must preserve evidence required by pending reviews and decisions. Ordinary Decide polls remain advisory and do not execute arbitrary app database operations. The app's backend applies their results according to its explicit business workflow.

Works can later connect funded contributions through its existing contributor, milestone, reservation, independent review and settlement rules. It is not used to emulate a free task approval: current Works milestones require positive funded amounts. No completion event grants money, votes, credits or module installation rights.

## Implementation ownership and first qualification

Core owns external client registration, identity issuance, app access checks, constrained member sessions, canonical app/actor envelopes, database migrations and the public developer client. Modules owns the Community Activity contract, its configuration/action schemas, generated SDK and native state readers. Frontend owns app settings, consent, restricted credential approval/revocation, activity and decision views. Existing public artifact and release pin boundaries apply across all three repositories.

The first developer example connects two distinct synthetic apps to the same disposable seven-member DAO. Exercise that scenario with both public and encrypted private DAO fixtures, including a protected app within the public DAO. It demonstrates paired login through qualified providers where available, membership denial, one authorised completion, a nonfinancial review, an advisory vote and exact source/version reconciliation. The Garden Care interface and backend remain untouched until their integration is expressly requested.

Acceptance includes rejection of cross-app/cross-DAO signatures, forged actor IDs, wrong module code, expired or revoked credentials, deactivated members, repeated events, changed snapshots and stale result application. Exercise concurrent requests from both apps, nonce changes from ordinary Daclify actions, lost responses, database restart, unavailable pinning, missing ciphertext and RAM exhaustion. Native tests must verify actual compiled WASM permissions and resource measurements. Browser tests cover email/Telegram account login separately from key approval, renewal, logout and pending/confirmed UI states.

Privacy checks exercise unauthenticated visitors, nonmembers, removed members, stale app sessions and a member of the other DAO against every protected read route. Verify no protected plaintext in native payloads, IPFS manifests/files, public responses, previews, logs or shared caches. A public DAO visitor can view only published material and cannot obtain a signing grant. Native inspection separately documents the metadata that remains public. Test app-scoped decryption isolation and future-key rotation without claiming erasure of earlier access.

Restore drills must preserve native member identity and receipts, app registration/issuer subjects, surviving IPFS evidence and explicit missing-data states. They must not invent lost pairings, recover an app database from a receipt alone, or imply that a member signing credential unlocks DAO document decryption.

## Design calls for review

The user chose the product scope above. Proposed implementation calls are registered-client OpenID Connect, additive native constraints beside existing sessions, browser-memory delegated keys, explicit renewal, a common member nonce coordinator, durable local outboxes, independent single-reviewer acceptance, protected content by default and individually metered receipts for the first pilot. Exact table layouts, resource limits, revocation bounds, app encryption grants, safe schema rendering and release versions belong in the implementation plan after measurements and review. App hosting, arbitrary remote module UI, database replication, anonymous native governance and new payment rails are outside this feature.

## References

- [Community/project guide](../../connected-community-apps.md) and [reusable mini-app design example](../../examples/community-mini-app-design.md).
- [Current account and membership routes](../../../protocol/routes.ts), [paired sign-in](../../../services/api/src/auth/sign-in-routes.ts) and [client signing boundary](../../../../daclify-frontend/src/auth/session.ts).
- [Native session constraints and instruction dispatch](../../../contracts/runtime/runtime.cpp), [scope records](../../../contracts/common/governance.hpp) and [module actor checks](../../../../daclify-backend-modules/contracts/common/module.hpp).
- [Existing document and role guides](../../guides/topics.json), [DAO presets and scoped credentials](../../dao-presets.md), [RAM accounting](../../ram-accounting.md) and [recovery](../../disaster-recovery.md).
- [Current module API](../../../../daclify-backend-modules/protocol/api.ts) and [funded Works rules](../../../../daclify-backend-modules/contracts/works/works.cpp).
- [OpenID Connect](https://openid.net/specs/openid-connect-core-1_0.html), [OAuth security guidance](https://www.rfc-editor.org/rfc/rfc9700.html), [JSON canonicalization](https://www.rfc-editor.org/rfc/rfc8785.html), [IPFS pinning](https://docs.ipfs.tech/how-to/pin-files/) and [IPFS privacy](https://docs.ipfs.tech/concepts/privacy-and-encryption/).
