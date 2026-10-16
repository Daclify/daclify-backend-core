# DAO claim response recovery — 16 October 2026

Frontend `0.15.0-alpha.48`, commit `3997c556ee6ed94210641f2d24db4df035efd0b3`, is pushed to `dev` and live on the existing shared testnet. Core32, modules42, API/database/native implementations and proxy configuration are unchanged. Almaiso is excluded. Exact results are in the [JSON evidence](2026-10-16-claim-response-recovery.json).

## Verified incident

The reported claim POST returned an upstream 504; the browser also reported the gateway response's missing CORS header. Scoped read-only SQL and canonical public DAO/governance responses verified that the claim had completed, with the claimant as its sole member, administrator and executive. Completion was 6.236 seconds after the order was saved. No active or blocked database transactions were present during inspection. The full request duration and exact upstream timeout cause were not established; current sample platform reads took 540ms locally and 832ms publicly. No real account, invitation, order or native state was changed during diagnosis. Private identifiers and bearer credentials are omitted here.

The verified portal gap was treating an interrupted HTTP response as proof of failure. A successful native operation cannot be undone or classified as failed merely because its response is lost.

## Correction

The claim page now reconciles the existing authenticated, account-owned creation order after network loss, a gateway response that cannot be decoded, or a transient pending response. It performs at most three read checks, separated by one second. A verified completed result opens its DAO; a saved order awaiting payment/completion goes to the existing immutable order review. If no result is available, an accessible pending notice keeps **Resume my claim** available. No automatic claim POST is repeated by recovery.

An explicit resume checks the saved order first. Only an unknown order allows that explicit confirmation to call the original idempotent claim endpoint. Backend first-claim reservation, immutable request/reference, account ownership, CSRF, custody, expiry and native executive readback remain authoritative. Authorization failures retain their error rather than being treated as successful claims. Responses must match the invitation/order ID, current chain/runtime and DAO reference. Opening a completed DAO additionally requires the backend's founding-executive confirmation. Account, network, route and request-generation changes invalidate late responses. Secrets stay out of destination URLs.

The [user guide](../../../daclify-frontend/docs/users/dao-creation.md) explains interrupted responses and resuming the same invitation.

## Verification

A gateway-response browser regression failed before the fix by remaining on the invitation page. All 76 unique browser cases passed across desktop/mobile claim recovery, saved-order and unified-approval suites. The first broad run passed 74 cases and exposed one older Account-redirect expectation on both viewports; it was updated to the already-authorized DAO-workspace behavior. The final affected rerun passed all six cases, including that correction, a realistic unpaid card-order fixture and stronger cancellation checking after an account switch.

Coverage includes normal success, lost network/HTML-504/pending responses, bounded read retries, unresolved status then explicit resume without another write, reserved/completed invitation readback, rejected claims, mismatched order/network/DAO, missing executive verification, payment resume and stale-account isolation. These use synthetic accounts and stubbed HTTP transport. All 414 unit tests in 77 files, lint policy, final Vue/TypeScript checks, the testnet build, changed-file formatting and diff whitespace checks passed. No dependencies changed. API/database/native integration suites were not rerun because their implementations are unchanged.

## Delivery and limits

The immutable frontend release is `/data/daclify-runtime/releases/20261016-claim-response-recovery`. Its 155 files match the public portal. Publication replaced the entry after its assets, retained older hashed assets and prepared stable-file rollback; no service restart, Caddy edit, database migration or native transaction was needed. Public checks confirmed eight native ABIs, seven module hashes, the runtime hash, 54 retained SDK downloads, the previous mini-app release and current MCP release. Desktop/mobile read-only portal/document flows had no uncaught page errors or API 5xx responses. The incident DAO's sole active administrator/executive was independently read back again.

No real claim was repeated to test recovery, and the underlying gateway delay was not reproduced. This release fixes uncertain-result handling; it does not claim to eliminate every upstream timeout. Private execution evidence is under `/data/daclify-runtime/claim-response-recovery-20261016/`. UTC timestamps are recorded in JSON.
