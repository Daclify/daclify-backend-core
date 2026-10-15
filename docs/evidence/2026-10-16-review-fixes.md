# Repository review fixes

This repair addresses all three findings in the local `review-all-20261016/review.json` report. Baselines were core `6fc9618`, frontend `644dfdd` and modules `a2cdc71`, on `dev`. Almaiso and the landing page required no changes. The earlier review's fixes remain in the core baseline.

Sign-out now locks the vault before waiting for remote session revocation and immediately drops the one-use recovery grant. A failed or timed-out request still reaches the existing UI error handling; the account display and CSRF token remain available so the existing Sign out control can retry. Confirmed revocation clears account, memberships and CSRF as before. Locking invalidates pre-existing private work through the existing vault generation guard. No failed request is presented as confirmed server revocation.

Connected-app origin validation now walks UUID-ordered pages of 64 distinct clients instead of stopping after 64 arbitrary historical registrations. Each candidate still passes the existing native enabled/revision/configuration-hash, DAO-domain and exact current-origin checks. Unknown origins and inactive registrations remain denied. The PostgreSQL/Fastify regression puts a live registration beyond the first page among 129 same-origin registrations, verifies browser preflight and authenticated userinfo, rejects another origin and then denies the origin after the last live app is disabled.

The [module README](../../../daclify-backend-modules/README.md) now distinguishes ordinary review approval from provisional protected review and describes dispute voting, conflicted-party exclusion and backup/mutual-settlement safeguards. It links the existing canonical Works guide and retains deployment qualification limits. This changes no contract behavior or packaged guide input.

Verification on the final source:

- Core `npm test`: **1,113 tests / 189 files passed**.
- Frontend `npm test`: **414 tests / 77 files passed**, including three new sign-out cases using a real encrypted vault and the real API transport with controlled success, HTTP 503 and timeout responses.
- Core PostgreSQL `connected-apps.test.ts`: **26 tests passed**, including the new origin regression.
- Core typecheck, lint, generated-documentation check and build passed.
- Frontend Vue/TypeScript checking and production build passed. Module generated-documentation check passed; module contract tests were not repeated for the README-only edit.
- Both bug regressions failed on the original behavior before the fixes. Sign-out regressions also verify unusable local signing keys, erased recovery-grant material and refusal to return an earlier private operation's result.
- The combined diff was reviewed inline. No subagents were used. Runtime logs, final source hashes and commit/push verification are retained in `/data/daclify-runtime/fix-review-20261016/`.

Initial type checks caught TypeScript query-result inference and an unsupported Promise API in the test helper; both were corrected. Preliminary broad runs were stopped. Only `core-final.log`, `frontend-final.log` and `origin-final.log` qualify the final test counts above. Frontend checks retain the existing RouterLink registration and Vite bundle-size warnings.

There are no public SDK, package-version, ABI/WASM, database-schema or release-manifest changes. Existing immutable artifacts were not repacked. The owned PostgreSQL fixture was stopped and removed after verification. No live service was deployed or restarted; browser E2E, real wallets/providers and full native-chain qualification were not rerun.
