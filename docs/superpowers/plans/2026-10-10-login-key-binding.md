# Coordinated login v3 key binding

Approved by the user after the three-repository audit. Continue on latest `dev`; preserve existing accounts, stored keys, sessions, recovery kits and on-chain state.

## Scope and contract

- Canonical challenge input contains both signing and encryption public keys.
- `daclify.login.v3` signs both keys, origin/audience, challenge ID and expiry.
- Authentication always validates the v3 message and exact submitted key binding before creating an account/session. Unused v2 challenges are rejected, including internal calls without an optional request context.
- The vault client sends its validated public identity and refuses mismatched/downgraded challenges before signing. Finish retains its encryption-key field, which must match the signed key.
- Existing accounts retain their keys and IDs. No migration or contract deployment is required; already-issued sessions remain valid. Old clients must update, and in-progress v2 logins must restart.

## Work and verification

1. Reproduce substitution and legacy-message acceptance with isolated PostgreSQL; add frontend mismatch/downgrade regressions.
2. Update producer schemas, challenge creation/authentication, all direct/HTTP callers and vault client. Validate curve points before storing a challenge.
3. Refresh public packages as core/frontend 0.10.0-alpha.1 and modules SDK 0.9.0-alpha.8, matching exact peers and vendored lockfile integrity. Keep module contract alpha.5 unchanged.
4. Test registration, unchanged-key login, signed replacement refusal, replay/concurrency, context mismatch, malformed keys, vault recovery and frontend refusal before signing. Run broad static/docs/unit/SQL checks and affected browser journeys.
5. Generate reference docs, document coordinated rollout, record evidence, review diffs, commit and push `dev` in all affected repos. No live deployment/cutover.

## Rollout

Coordinate backend and frontend delivery. Do not retain an unsigned-key compatibility fallback. During mixed versions, new vault logins fail closed; ordinary existing sessions and other paired-login methods are unaffected. Roll forward on failure rather than restoring the vulnerable registration behavior.

## Execution result

Implementation, public artifacts, generated guides, regression tests, broad checks and inline diff review are complete. Results and known qualification boundaries are in [the execution evidence](../../evidence/2026-10-10-login-key-binding.md). Delivery targets `dev` in all three repositories; no deployment or new release qualification is implied.
