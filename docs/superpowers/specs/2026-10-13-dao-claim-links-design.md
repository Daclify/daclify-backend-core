# Draft DAO creation through claim links

13 October 2026. Approved design implemented in core20/modules28/frontend27. Execution and qualification are recorded in [the implementation plan](../plans/2026-10-13-dao-claim-links.md) and [claim-link evidence](../../evidence/2026-10-13-dao-claim-links.md). The ordinary paired-sign-in creation fix is delivered separately in [frontend alpha.26](../../evidence/2026-10-13-dao-creation-paired-sign-in.md).

## Purpose and selected behavior

A current executive of the Daclify governing DAO prepares a community's setup and sends a link. The recipient finishes account setup and claims the community without asking the issuer or an operator to complete it for them.

The user selected three policies:

- The first person with the link may claim it; it is not tied to an invited email or wallet.
- Only the claimant joins initially. The issuer is not added as an administrator, member or executive of the new DAO.
- Save the setup first and create the DAO on-chain when it is claimed. An abandoned link does not create a DAO or allocate its native resources.

The recipient becomes the first administrator **and executive**. These are separate native roles. Existing platform governance over shared contracts continues according to its current policy; claiming a community does not transfer ownership of the shared runtime.

## Proposed first version

These are engineering/product recommendations, not additional user-selected policies: support the existing **Shared contracts and hosting** creation path first; expire links after seven days; let an eligible issuer revoke an unclaimed link; let an existing Daclify account sign in rather than create a duplicate account. Keep the existing setup schemas, presets, custody rules, account entry, creation orders, fees and resource limits.

For this first version, use human or mixed participant mode so the person claiming the link can be its founding executive. Existing agent-only setup enrolls a nominated agent instead of the operator; keep that separate until its claim flow explicitly identifies the agent that will hold the executive office. Do not silently enroll a human into an agent-only DAO.

The issuer uses the normal setup fields and selects **Create claim link**. Review shows the setup, network, expiration and the fact that only the recipient will join. Store a bounded immutable draft and return a secret link that can be copied. Editing the setup means revoking the old draft and creating another link, so the recipient cannot approve terms that silently change.

The recipient opens a compact setup summary. Opening the link, link previews and signing in do not reserve or consume it. Preserve the destination through the existing account entry flow. A new person creates one Daclify account and saves its recovery kit; an existing person signs in through an available paired method. An account without a public signing/encryption identity completes that setup. A paired sign-in with an existing public identity can proceed with its private keys locked.

The final review names the DAO, its governance/privacy preset, the selected account, the initial administrator/executive roles and current creation costs/resource terms. The recipient explicitly confirms **Claim and create DAO**. Revalidate readiness and custody at confirmation. If current creation policy requires payment, use the existing recipient-owned order and checkout; do not silently bill the issuer or treat the draft as a paid entitlement.

The first authenticated eligible person to confirm reserves the link for their canonical account. Reuse one persisted creation reference and DAO ID across retries. The native transaction creates the DAO, enrolls that account as its sole initial member/administrator and initializes its executive office. Success is shown only after the authoritative native result confirms both membership and executive status. Return to the new community workspace.

## Authority and privacy

Issuance requires an authenticated session and the current authoritative executive office in the specifically configured Daclify governing DAO; an administrator badge or SQL projection alone is insufficient. Recheck that office at first claim. An issuer who has lost it cannot authorize another new DAO through an old unclaimed link. After a claim is reserved, reconcile any submitted native transaction before deciding its final state; later role changes cannot erase an already created DAO.

Bind fresh issuer approval to the exact draft, operation, canonical account, session, origin and API audience using the existing account-control conventions. A proof for another operation cannot issue or revoke a link. Confirmation is explicit; visiting the setup page never approves a draft. Claimant session authorization continues to use the existing creation policy and cannot impersonate the issuer's executive approval.

The link authorizes this bounded draft only. It cannot select a different chain/runtime, substitute setup, enroll the issuer or third parties, use arbitrary native actions, reveal private profiles or grant rights in the Daclify governing DAO. Use a cryptographically random bearer secret, store only its hash, and exclude the secret from logs, analytics, referrers and public listings. Claim and revoke requests require authenticated session/CSRF checks and existing bounded abuse controls. A preview exposes only what the issuer expressly includes in the invitation.

Do not widen the bootstrap service to arbitrary `appoint` or owner/active authority. Current shared creation enrolls an administrator but does not create an executive office, and the restricted service action links do not authorize ordinary appointment. Implement a narrowly reviewed first-executive bootstrap that applies only to the newly created DAO and its just-enrolled founder. It must be atomic with creation and refuse existing rosters/DAOs or substituted founders. A UI/SQL executive label cannot satisfy this requirement.

The claimant uses the account's existing public keys and custody mode; no server generation or collection of private user-controlled keys. Private history initialization/grants continue through the existing authorized encryption journey. Being an executive does not itself decrypt private data. Shared runtime owner/active authorities and its governing DAO roster retain their existing semantics.

## Concurrency and recovery

Use PostgreSQL to serialize reservation, revocation and expiration, with uniqueness for the secret hash and the draft's creation order. A second account cannot claim a reserved or completed link. The same canonical account can resume after reload or a lost response and receives the same DAO.

Check expiration/revocation before first reservation. An in-flight claim cannot be handed to another account merely because a timeout or link expiry passes: inspect its persisted order and native result first. Opening a reserved link should explain that a claim is in progress; its claimant can resume. Cancellation before confirmation changes nothing. Revocation after reservation cannot undo native work or make the link reusable. A failed preflight leaves the draft unclaimed. A reserved claim with an unresolved native result remains visibly pending until reconciled, rather than reporting success or creating another DAO.

Store drafts in the existing service database, not a database or daemon per invitation. Bound setup sizes and issuer listing page sizes using producer schemas. Persist only the draft, issuer identity/authority context, chain/runtime, secret hash, expiry/state and the claim/order association needed for once-only recovery. Justify lookup/list/expiry indexes from the actual queries. Clean expired/revoked unused drafts in bounded batches; erase their descriptive setup when no longer needed. Retain the minimum order association needed for a completed claim's retry/audit rules. Do not allocate a native claim-link table when PostgreSQL plus the existing creation reference suffices.

## Acceptance and execution boundaries

Implementation must prove the following with real API/SQL/native and desktop/mobile journeys:

- An eligible Daclify executive can issue and revoke an unclaimed link; non-executives, executives of another DAO and stale executive offices cannot issue or newly claim through it.
- New-account and existing paired-account entry return to the claim review. Locked-vault paired sign-in can confirm when its public identity is already established; missing identity and incompatible custody are refused clearly.
- Opening/previewing a link creates no account, reservation, native order or DAO. Expired, revoked, substituted and wrong-network links cannot create one.
- Two simultaneous claimants produce exactly one reserved account and one DAO. Lost native/HTTP responses, reload, worker restart and repeated confirmation reconcile the same reference.
- Only the claimant is enrolled initially, with actual administrator and executive state. Shared runtime authorities and the Daclify governing DAO roster remain unchanged.
- Human claim drafts reject agent-only mode or a substituted founding-agent identity. The existing ordinary agent-only creation path retains its founding-agent semantics.
- Native bootstrap cannot appoint an executive in an existing DAO, substitute a founder, overwrite a roster or bypass quota/payment/custody guards. All actions in failed creation roll back together.
- Expiration/revocation races cannot free a link with unresolved native work. Cleanup is bounded and preserves recovery associations.
- The compact review, recovery, errors and completion work with keyboard, screen readers and mobile layouts. Generated reference docs, user help and frozen SDKs match the exposed feature.

Build on core `CreationService`, `NativeChainGateway`, the runtime's membership/executive policy and frontend account/create components. Add canonical producer schemas and an additive migration rather than copying private API models into frontend. Native changes require pinned CDT `-O=s`, explicit ABI/version compatibility, measured WASM/RAM/action CPU, real permissions tests and immutable release pins. Prepare a separate detailed execution plan after the design discussion. Contract deployment and any necessary narrowly scoped permission-link addition need their own reviewable testnet packet; this frontend release does not deploy them.

## Inline builder review

The source review identified three constraints: existing creation orders require a claimant account, so issuing a link needs a separate draft; ordinary creation gives administrator rather than executive status, so native initialization is necessary; the current bootstrap service cannot call general appointment, so a broad service-permission extension is unacceptable. The design handles these explicitly. Payment terms are reviewed at claim time, native retries remain account-bound, and ordinary full-access signing/privacy rules continue after creation. Review is inline by the author because workspace instructions prohibit delegation.
