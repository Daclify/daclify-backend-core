# Self service mini apps, AI connections and account exit

Date: 12 October 2026, Atlantic/Canary. Status: design and execution proposal for review. The product direction below comes from the conversation; engineering choices and delivery order are recommendations. This document does not qualify a release or authorize live account deletion, DAO closure, authority changes, asset movement or deployment. The [comprehensive execution plan](../plans/2026-10-12-self-service-mini-apps-and-account-exit.md) contains six linked workstreams and 21 implementation tasks.

## Intent and agreed direction

A community can connect its existing application or AI harness to Daclify without the Daclify owner registering it, sending packages, editing server configuration or troubleshooting the connection personally. The community and its members authorize their own permissions. App builders retain their interface, hosting and operational database while Daclify supplies verified identity, membership and selected accountable records.

The user selected these requirements:

- Promote mini apps on the main website and make their instructions and discovery accessible from a separate frontend destination.
- Support MCP connections for mixed human/agent and guarded agent DAOs.
- Define how an app database integrates with Daclify accounts regardless of its engine. SQLite and PostgreSQL are initial implementation examples; other engines need demonstrated compatibility.
- Leave a DAO, leave all DAOs and delete a Daclify account through self-service flows.
- Offer DAO closure during deletion when the departing user is the only member, preserving outstanding claims and required history.
- Keep personal profile contents on chain, readable only by the user and people they authorize. Moving the profile contents to a service database is not the selected direction.
- Minimize personal data, retained off-chain storage and live native RAM without weakening authorization, accounting, recovery or upgrades.

A specialized hosted mini-app database service is deferred. Existing third-party apps remain independently operated; connecting them cannot give Daclify unilateral control of their databases.

## Current implementation and identified gaps

Connected app registration, Daclify-issued sign-in, app-bound completion/review-submission grants and Community Activity have recorded testnet qualification. The developer guide and example refer to older artifacts than the later combined rollout. The installed handbook still calls those features unimplemented. Producer-owned explanatory guides must be corrected alongside the example instructions; a generated-reference consistency check cannot establish that an availability statement is true.

The frontend already has a DAO Connected apps section. Reuse its registration, grant and receipt controls when adding the global mini-app destination. A public listing is separate from native registration and does not authorize an application to act for a DAO. Account continuity is now implemented and published to testnet: reuse single-kit Account/Create/Join setup, the private-access policy API, batches of at most 20 grants, local commitment/decryption verification and explicit successor recovery confirmation. Reconnection also starts from the restored registered account with explicit consent, unlocked original root keys and fresh incoming wallet proof. Both entry directions use the same canonical reconciliation transaction; future erasure and MCP revocation cover both without changing ordinary pairing into account merging. [Initial delivery](../../evidence/2026-10-12-account-access-continuity.md), [restored-account delivery](../../evidence/2026-10-12-restored-account-pairing.md) and the [latest plan review](../../evidence/2026-10-12-mini-app-plan-compatibility-follow-up.md) distinguish existing behavior from planned additions.

The SQLite example saves task changes and their outbox event in one transaction and reconciles the exact receipt. It assumes one configured app/DAO per database but does not persist or validate that binding. A synthetic reproduction reused the database for a second DAO with the same member number and received the first DAO's pending event. Reopening it with another app ID also exposed the previous task state. This is a database configuration/isolation gap; the reproduction did not establish a bypass of native Daclify authorization.

The agent publishing example sends a signing-only challenge although the current schema requires both signing and encryption public keys. MCP exists in a proposed cooperative design, not as an implemented server found during this review.

Member deactivation currently requires administrator authority. The last administrator and native controller have additional continuity protections; private-history handover checks currently live in the portal and can be bypassed by direct native actions. The plan adds a bounded native recorded-grant/recipient-acceptance guard without claiming that it proves decryption or recovery. The current public profile action stores plaintext profile JSON on chain, and current Activity receipts have no deletion lifecycle. Those behaviors cannot satisfy the proposed exit and encrypted-profile experience by merely deleting an API account row.

Source context: [connected-app guide](../../connected-community-apps.md), [runnable example](../../../examples/community-mini-app/README.md), [later testnet rollout](../../evidence/2026-10-11-workspace-testnet-rollout.md), [implemented account continuity design](2026-10-12-account-access-continuity-design.md), and [agent cooperative design](2026-10-11-agents-only-service-cooperative-design.md). The older programme documents supply architectural constraints; their initial implementation-status statements are historical. Current tested artifact pins are core `0.14.0-alpha.4`, modules `0.10.0-alpha.4` and frontend `0.14.0-alpha.7`; they remain development packages, not a production-qualified release.

## Connecting a mini app

The frontend explains what an app can request before starting registration. A community administrator enters its approved HTTPS origin and exact callback, approves the requested scope and receives generated connection configuration. Resolve network/module details from verified supported interfaces rather than asking builders to invent deployed accounts or copy another community's IDs.

Provide a reproducible starter with version-matched public packages obtainable without contacting the platform owner. Until a package registry has actually been published, use an independently accessible, documented artifact distribution path. Do not promise a registry command that cannot be executed.

Connection checks distinguish configuration, successful identity verification and a confirmed signed event. Explain failures in terms the builder can resolve: wrong callback, inactive membership, renewed consent required, unavailable source, insufficient recording capacity or incompatible release. Readiness checks use bounded requests to verified app origins, reject private-network destinations and unsafe redirects, and cannot execute arbitrary app-supplied code.

Members authenticate through the existing Daclify account flow. Login, recording authority, review/voting authority and decryption access remain separate. Every protected request rechecks the relevant current authorization. App signing secrets stay in the supported client/signer boundary. Registration or login does not confer financial authority.

## Database integration requirements

The starter and every generated mini-app design include the following rules. These are required outcomes, not an instruction to impose one task schema or ORM on every project.

| Boundary              | Required behavior                                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account mapping       | Associate an optional local app profile with the verified issuer/client/subject and full native membership reference. Never infer account ownership from a name, email, assignee or supplied member number. App subjects are distinct across registered clients.              |
| Namespace             | Bind data to chain, runtime, DAO and app. A dedicated database persists that binding and fails on mismatch. Shared storage scopes reads, writes and uniqueness constraints to the full namespace. Configuration changes are explicit migrations, not silent rebinding.        |
| Identifiers           | Preserve native identifiers losslessly, using validated decimal strings or an appropriate database integer representation. Browser number conversion cannot truncate uint64 IDs.                                                                                              |
| Authorization         | The backend derives the actor from validated Daclify access and checks app/record permissions. Saved roles are projections; they cannot replace current authority. Database credentials are never given to a browser or model.                                                |
| Reliable changes      | Save an application change and its immutable pending event atomically. Give each logical event a stable idempotency identity. Uniqueness must support distinct submissions/revisions; the one-task example's one-event-per-source constraint is not a general workflow model. |
| Concurrency           | Validate expected source versions and make concurrent updates conditional. Reconcile uncertain delivery before signing replacements. Background jobs may deliver valid signed bytes but cannot invent signatures or change a submitted revision.                              |
| Recovery              | Preserve identity links and pending work through restart and tested restoration. Login-method changes do not create a second app user. Recreated issuer/client mappings require verified relinking or migration; do not merge accounts by matching personal fields.           |
| Existing data         | Preserve existing application records. Claiming an existing local account requires proof of control of both identities. Historical assignments/completions remain unattributed or legacy unless their actual author can be established.                                       |
| Privacy and retention | Define record audiences, purpose, retention, deletion and necessary exceptions. Removing membership stops new operational access; it does not automatically delete shared work, financial claims or the user's wider Daclify account.                                         |
| Operations            | Supply schema versions, repeatable migrations, durable storage and verified backup/restore. Reject a deployment that stores its only database on ephemeral disk. Include photos and files in recovery.                                                                        |

SQLite and PostgreSQL recipes must pass the same behavioral scenarios. They may use their native transaction and concurrency mechanisms; do not add a generic database abstraction without a measured need. Another engine is supported only when its adapter demonstrates the required atomicity, durability, isolation and recovery behavior.

## Mini-app discovery and website

Add a global Mini apps destination for explanation, examples, connection guidance and discovery, linked from the sidebar. Keep DAO-specific registrations and permissions in the existing workspace. Reuse the versioned handbook and public schemas rather than maintaining another independent set of API instructions.

Recommended initial directory policy: maintainers can submit bounded descriptive metadata and an HTTPS app address, prove control of that origin and clearly identify the maintainer. Label submissions as community-submitted; technical connectivity does not establish safety or endorsement. Provide reporting and moderation through existing platform governance/authorized roles rather than making the platform owner the required listing operator. A DAO administrator separately chooses which apps its community connects. Never embed arbitrary executable listing content in Daclify's trusted origin.

The main website introduces concrete community use cases, shares the same supported-availability statements, and links directly to the app's entry point and matching instructions. English, Spanish and Polish, Markdown and machine-readable exports remain consistent. MCP and new exit/privacy functions retain explicit availability labels until qualified.

The directory moderation policy is an engineering recommendation for review, not a policy the user explicitly selected. Its implementation can follow the core connection journey.

## MCP and community AI

Use one Daclify MCP implementation with authorization resolved from the actual human or agent principal and the DAO policy. An assistant acting for a human is not automatically an enrolled agent member. Preserve guarded-agent admission, pause, revocation and recovery rules.

Reuse the public SDK, canonical schemas and authoritative service/contract checks. Initial bounded capabilities cover permitted DAO discovery, membership/status reads, proposal preparation and selected activity submissions. Votes and independent reviews use their separately authorized signing paths. Do not expose arbitrary SQL, root administration, unrestricted transaction signing or automatic withdrawals. Model output and tool annotations never establish permission.

Recommended first transport: a distributable local stdio adapter, with generated harness configuration and a member-bound signer isolated from model text. It follows the prior cooperative proposal without depending on an unqualified remote signing service. Do not expand this package into a customer-order or general autonomous-agent platform.

A hosted Streamable HTTP connection is a later transport of the same capabilities. It needs MCP-compatible authorization discovery, resource/audience binding, suitable scope handling and a qualified signing boundary. Existing app login tokens cannot simply be passed through as MCP authorization. Neither transport reads private content without the applicable decryption authorization and disclosure policy for the selected AI provider.

Onboarding is tested outside the development workspace using version-pinned artifacts and the actual supported harnesses. Do not promise compatibility with every harness. Identify at least one testable client for the implementation plan; remote-only clients cannot be counted as local stdio qualification.

## Encrypted profiles on chain

Profile contents remain encrypted on chain. Only the owner and explicitly authorized recipients can decrypt them. Joining a DAO does not automatically share the entire profile. The default engineering recommendation is explicit audience selection using existing verified account identities; profile keys remain an internal implementation detail of the existing account experience, not a second password or recovery kit.

Encrypt before creating transaction payloads. Personal fields, descriptive metadata and sensitive image references must not appear in plaintext transaction arguments, logs, APIs, analytics, notifications or search indexes. Existing native member/account identifiers and transaction metadata are separate privacy considerations and cannot be described as anonymous merely because profile contents are encrypted.

Use independently generated, versioned profile data keys separated from signing keys and DAO document keys. The ordinary recovery kit retains its existing account keys. Recoverable profile-key envelopes live off chain in the selected user-controlled or explicitly disclosed managed boundary. Do not derive a supposedly erasable profile key solely from permanent account keys, embed it in the root recovery kit, or publish recoverable key envelopes in immutable on-chain history. Existing DAO-wide on-chain grants are not a deletion mechanism for this profile design.

The key lifecycle must support authorized sharing, rotation for future versions, owner recovery, deletion and bounded backup retention. Revoking a recipient changes future access; it cannot erase plaintext or keys already obtained. Profile-key availability depends on surviving permitted key material: encrypted chain contents alone cannot recover a lost key. Exported key/plaintext copies remain outside the platform's unilateral control.

Store only a bounded current profile record and bounded active access state in live native tables. A profile deletion action erases eligible current rows and reports measured reclaimed RAM; historical transaction ciphertext remains. Specify the encrypted envelope, bounds and upgrade readers in the implementation plan. Authorization remains native even though the service distributes protected key envelopes.

Existing plaintext profiles require an explicit legacy policy. An update or live-table deletion cannot erase earlier published plaintext. Migration may encrypt future writes and remove obsolete live fields, but cannot be advertised as retroactive erasure. New ciphertext must not be written through the old plaintext validator under an ambiguous format.

## Leaving DAOs and deleting an account

Offer leaving one DAO and a leave-all/account-deletion flow. An ordinary member authorizes their own departure without needing an administrator's permission. Contract checks remain authoritative and preserve financial exit rights, voting/accounting invariants and native-controller continuity.

Before exit, show memberships, governed roles, available claims/stake, pending obligations and any ownership responsibilities. Offer export and the existing deliberate financial exit paths. Leaving or deleting an account does not burn claims, move funds, donate assets, transfer ownership or cancel DAO-wide billing by default. Process account-owned subscriptions under their actual authorization and provider reconciliation rules.

An administrator/executive prepares a valid successor and the required private-history/recovery handover. A sole-member DAO offers closure during deletion. Closure is a distinct explicit choice: stop new commitments and ordinary operations, finish or preserve existing liabilities and rights, retire hosted resources safely, and retain only necessary records. Closure is not deletion of a native blockchain account or destruction of shared platform contracts. A dormant DAO with unresolved claims can remain in a settlement-only state; zero members is not proof that nothing is owed.

Account deletion uses a resumable operation rather than one large SQL cascade or an assumed atomic transaction across chains/apps. Reauthenticate ownership, obtain the relevant explicit signed operations, record bounded progress, reject replay/substitution and reconcile uncertain transactions before retry. Opening the account screen does not sign anything. New operational access stops promptly while necessary exit operations use a narrowly authorized path. Preserve migration 041: an additive migration introduces an erased state and narrowly allowed cleanup of canonical/retired owners, while keeping ownership edges immutable, blocking new credentials/sessions and preserving only necessary historical identifiers. A plain update clearing canonical keys currently fails its database guard.

Remove the hosted account's unnecessary personal fields, login pairings, passkeys, active sessions, unfinished credential intents, managed recovery material and connected-app access. Cover canonical and retired account aliases, public directory projections, account-owned temporary uploads, provider metadata and dependent jobs without erasing shared DAO evidence or outstanding accounting. Delete current profile/key state only after the confirmed user choices and safe continuity handling. Backups expire under the retention policy, and restored systems reapply deletions/revocations before reopening access.

Independent mini apps receive authenticated, idempotent account/membership cleanup notices bound to their own registered subject and namespace. They define and enforce the database retention policy; Daclify tracks acknowledgements/retries and shows unavailable or incomplete cleanup. A notice cannot reveal another app's identifiers or confer a new write privilege. Do not claim another operator's database has been erased without evidence. Suppress unnecessary hosted directory presentation while clearly separating that behavior from public blockchain availability.

Governance handover and personal-data erasure are related but distinct processes. A missing successor, outstanding balance or unavailable independent DAO is not by itself a lawful reason to retain every account field indefinitely. Retain a minimal restricted reconciliation/legal record only for its justified purpose and expiry; report unresolved membership operations separately from completed hosted-data cleanup.

The completion report distinguishes hosted account deletion, confirmed membership exits, DAO closure status, current profile removal, key deletion/backup expiry, app acknowledgements and retained history. It cannot say that every public-chain copy, exported key or independent app copy has disappeared.

## Privacy and resource policy

Every app and hosted feature defines the responsible party, purposes, recipients, retention periods, erasure route and necessary exceptions. Retention is purpose-specific, not a universal number of days or indefinite audit label. Collect only needed data and delete it when its purpose ends unless a lawful retention ground applies. See [European Commission principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en) and [erasure guidance](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en).

Encryption and removing an identity mapping do not automatically establish anonymization or GDPR erasure. Assess identification through surviving keys, recipients, backups, native identifiers and history; encrypted personal data remains personal data, and long-lived ciphertext carries future cryptographic risk. The selected on-chain profile approach needs a documented privacy assessment and required legal decisions before a compliance claim. [EDPB final blockchain guidance, section 4.2](https://www.edpb.europa.eu/documents/guideline/guidelines-022025-on-processing-of-personal-data-through-blockchain_en).

Off-chain cleanup reduces retained data but physical disk reclamation depends on database maintenance. Unpinning removes a controlled hosting commitment, not all IPFS copies. Native RAM is reclaimed through supported row erasure; it does not erase transaction history. Existing Activity receipts are retained: use selective recording and explicit funded capacity. A receipt archival/pruning design is separate work if measured usage requires it, preserving review/decision interpretation and once-only delivery/replay protection.

Compile changed current contracts and probes with pinned CDT `-O=s`. Justify every stored field and secondary index, bound profile/envelope/grant/deletion-job data, and provide safe cleanup for eligible expired records. Measure actual WASM, physical RAM and action CPU; historical compiler fixtures preserve their flags/hashes. Do not claim encrypted profiles are smaller than plaintext.

## Recommended delivery order

1. Repair current availability/version instructions, the database-binding gap and the agent-login example. Add regression evidence for the actual failures and a runnable setup independent of the workspace.
2. Deliver tested SQLite/PostgreSQL integration recipes, account/recovery mappings, safe retention and the connection diagnostics. Prove a fresh app connection with synthetic data before using Garden Care's separate preview data; follow its existing handoff and hosting rules.
3. Implement the versioned encrypted-profile/key lifecycle and native self-departure/closure primitives, preserving existing account continuity. Qualify native authorization, liabilities, private handover, bounded cleanup and upgrade behavior.
4. Add the resumable leave-all/account-deletion workflow and independent-app cleanup protocol, with evidence of success versus outstanding work.
5. Deliver the global Mini apps guidance/connection destination and the local MCP adapter. Directory submissions and the hosted MCP transport follow their own readiness criteria.
6. Update the main website and all supported guide/export languages to promote the actually qualified capabilities. Prepare immutable release artifacts; deployment remains separately authorized.

The implementation plan splits these into bounded packages with canonical interfaces, migrations, commands and tests. Following design approval, execute inline through ready packages without repeated internal approval requests. Production, live closure/deletion, native authority changes and asset movement remain outside development authorization.

## Acceptance evidence

- A fresh community and builder can connect an app from the documented artifacts without contacting the platform owner. Member login, consent and exact receipt reconciliation are demonstrated.
- Both initial database recipes reject a wrong DAO/app binding, cross-tenant records, forged actors and stale privileges. Concurrent writes, source edits, restart, restore and repeated delivery preserve the expected identity and one logical event.
- Account recovery/login-method changes retain the correct app records. Ambiguous legacy identities and changed client/issuer mappings are not silently merged.
- Human-assisted and guarded-agent MCP flows exercise the real supported signer. Unauthorized tools, cross-DAO replay, guardian pause/revocation and private-content leakage are rejected.
- Personal profile plaintext never enters new chain writes or public outputs. Wrong audiences/domains/versions fail. Sharing, future-access revocation, recovery, controlled key deletion, backup expiry and old-format upgrades are tested with the real format.
- Ordinary members can authorize departure; a nonmember cannot depart for them. Last-controller continuity, private access handover and sole-member closure are exercised with actual compiled contracts and a native runtime.
- Claims, stake, reserved/approved obligations and once-only settlement survive departure, closure, retries and upgrades. No asset transfer follows from account deletion without the applicable separate authorization.
- Interrupted account exit resumes. Incomplete native exits, independently hosted app failures and legally retained data are reported rather than silently treated as erased.
- Current eligible rows are actually erased and RAM measurements recorded. Expired sessions do not accumulate indefinitely; Activity retention remains accurately described.
- Desktop/mobile browser flows cover focus, keyboard access, signed confirmation, cancellation before irreversible operations, errors and retry. Documentation and website availability match the tested release.

## Review before implementation

Chosen engineering defaults are a local MCP transport first, two tested database recipes, explicit profile audiences, off-chain removable profile-key envelopes, a community-submitted directory policy and the delivery order above. These choices implement the stated direction but are not presented as additional user selections.

Before implementing the encrypted-profile boundary, specify its key-envelope custody/availability and deletion-versus-recovery threat model. Before exposing closure, specify the smallest supported retirement/settlement state transition against the current contracts. Final legal retention periods and controller/processor responsibilities depend on each actual operation and jurisdiction. These decisions are recorded in the implementation plan or the scoped privacy review; they cannot be hidden behind a GDPR-compliant label.

Review is inline because workspace instructions prohibit delegation. The implemented account-continuity behavior and unrelated edits are preserved. This draft is the reviewable design; it is not passing implementation evidence.
