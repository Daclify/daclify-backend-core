# DAO claim links

A current executive of the Daclify governing DAO can prepare a shared community in **Create a DAO**, then choose **Create claim link**. The invitation saves the setup in the service database. It creates no blockchain DAO until its recipient explicitly confirms.

The first eligible signed-in person to confirm becomes the sole initial member, administrator and executive. The issuer receives no office or membership. An existing account can sign in with a paired method while its vault stays locked. A new account finishes its public signing/encryption identity and recovery kit before claiming.

Invitations support human and mixed communities, expire after seven days, and can be revoked before reservation. Setup is immutable: issue a new invitation to change it. Treat the complete link as a private bearer credential. Its secret is in the URL fragment and is sent only in POST bodies; public listings contain no secret. Account entry keeps the fragment in temporary tab storage and passes only an opaque checkpoint through login redirects.

The recipient reviews the name, governance, privacy, network and current fees before **Claim and create DAO**. Existing custody, module availability and hosting rules apply. Any payment uses the recipient's existing creation order. An expired invitation does not release an already reserved order to another person. Reload or retry resumes the same order; success requires authoritative native administrator and executive readback.

## Service and recovery

Issuance and revocation use fresh account-control proofs bound to the exact operation, body, session, origin and API audience. Only those draft operations additionally accept recent verified paired sign-in. This does not authorize native governance changes, private key sharing or spending.

Migration 050 stores a bounded setup, chain/runtime, issuer, hashed 256-bit secret, expiry and optional claimant/method/completion. The draft UUID doubles as its order UUID. Its stable native reference is SHA-256 of `daclify.dao-claim.v1:<chain>:<runtime>:<draft UUID>`; it is independent of the claimant. A native receipt already owned by another public key cannot be reassigned after SQL restore. Unclaimed drafts allocate no native records. Five-row expiry batches remove unused drafts, reconcile restored native ownership, and retain pending order associations. Completed invitations lose descriptive setup and token hashes after expiry. Account erasure removes disposable invitations and completed descriptions; pending rights belonging to another claimant retain the immutable setup needed to finish.

Before exposing a restored database, stop the API/workers, apply current migrations and run [revoke-restored-sessions.sql](../tools/recovery/revoke-restored-sessions.sql). It revokes restored unclaimed invitations along with authentication ceremonies; SQL backups otherwise could revive a previously revoked link. Native receipts preserve completed or unresolved native ownership.

The native `createpaid` action appends an optional binary extension. Existing action bytes retain their original prefix and omission semantics. The extension atomically initializes governance, enrolls member 1 and gives that member its sole executive office. It applies only to the new paid DAO, preserves ordinary creation behavior and uses the existing restricted service links. It adds no persistent contract field, secondary index or claim-link table.

Agent-only invitations and independently hosted commissioning are outside this first version. Existing ordinary agent-only creation keeps its nominated agent behavior. Private document key initialization remains a separate authorized account journey.

## Deploying this cohort

The original claim-link rollout used core20, modules28, frontend27 and MCP11. These are historical pins; use [current status](current-status.md), the current producer manifests and the independently pinned MCP package for a new deployment. Apply migration 050 before starting the claim service and deploy the matching runtime code/ABI before enabling its advertised capability. Recovery qualification is bound to the core version and must be checked against the configured service. Native owner/active authorities, module bytecode and balances do not change.

Select the new mini-app/MCP artifact directories and retain verified previous releases through `MINI_APP_ARCHIVE_DIRECTORIES` and `COMMUNITY_MCP_ARCHIVE_DIRECTORIES` (at most sixteen mini-app archives and eight MCP archives). Those archives keep existing download URLs working; core-target native delegates pin the runtime hash and need explicit reapproval if that hash or their granted authority changes. A documentation/SDK-only rollout with unchanged native pins does not itself require new native consent. Hosted read access keeps its existing membership and consent checks.

An older portal must be rebuilt against core20/modules28 before using it as a compatible UI rollback. The archived alpha26 index is a backup, not a qualified claim-order client. Before reverting the API/runtime, stop fulfillment and retain SQL reservations; an older creation service must never fulfill a claim order as an ordinary administrator-only DAO. Never roll the database back to drop migration 050 or discard reserved work.
