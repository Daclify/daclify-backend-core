# Hosting updates and Users continuation repairs

Date: 2026-10-17. Scope: the two confirmed findings in the [engineering review](/data/daclify-runtime/review-engineering-20261017-02/review.md). Almaiso is excluded. Work is inline on the existing core/frontend `dev` branches; this record does not qualify or deploy a release.

## Changes

- Hosting enqueues a new generation even while its invoice job is running, retaining that worker's lease. Completion compares the persisted payload with the one actually processed. A newer generation remains pending and due immediately, with the older error cleared. Lease ownership/expiry fencing, signed webhook deduplication, invoice validation and native receipt idempotency remain in place. Existing `{invoiceId}` jobs are still accepted. No SQL migration, contract, public SDK or dependency change is needed.
- Users renders **Load more users** independently of the loading explanation. The existing 20-page batch bound, account/network guards and continuation cursor remain unchanged.

Implementation: [hosting enqueue](../../services/api/src/billing/hosting.ts), [hosting worker](../../services/api/src/billing/hosting-jobs.ts), [Users view](../../../daclify-frontend/src/views/Users.vue).

## Regression evidence

Before implementation, the real PostgreSQL hosting fixture failed both new event-ordering cases because the next worker was idle. Chromium failed to find the continuation button after displaying 20 users. These failures and subsequent runs are retained in the [repair packet](/data/daclify-runtime/fix-engineering-20261017-02/).

The extended [hosting integration fixture](../../tests/integration/hosting.test.ts) covers refund arrival during successful, retrying and failed older checks; a won dispute during revocation; duplicate signed events; legacy invoice-only jobs; and lost/expired leases. The real service, migrations and SQL queue run against an owned disposable loopback PostgreSQL database. Stripe and the native gateway are synthetic fixtures. Hosting plus RAM-card/content/storage worker checks passed **34 tests**.

The actual portal [browser journey](../../../daclify-frontend/tests/e2e/people-workspace.spec.ts) loads 20 unique users across 20 DAOs, continues to DAO 21, preserves earlier cards after a failed continuation, retries successfully, rejects duplicate clicks while busy and hides the button when exhausted. This new case passed in desktop and mobile Chromium.

Final affected-repository checks:

| Check | Result |
| --- | --- |
| Core `npm run verify` | Passed lint, strict types, generated docs and 197 files / 1,158 tests. Development publication remains refused/unqualified, as intended. |
| Frontend `npm run verify` | Passed lint, Vue/TypeScript checks and 83 files / 467 tests. |
| PostgreSQL worker integration | 34 passed across hosting, RAM-card, content and storage jobs; final hosting-only run also passed 15. |
| People/workspace browser file | 28 passed in desktop/mobile Chromium. |
| Core and frontend `npm run build` | Both passed. |
| Changed TypeScript/Vue formatting and `git diff --check` | Passed. |

The distinct final suite total is **1,687 passing tests**; repeated targeted runs and the five frontend lint tests already included in its full suite are not double-counted. The broader browser run initially exposed an obsolete ArrowLeft expectation from the previous account-tab order; that test now moves right from Profile to Sign-in methods, matching current product behavior, and the whole file passes. An initially missing return in the new lease-loss test adapter was caught by type checking, corrected, and both types and its final PostgreSQL run pass.

Full commands, logs, source hashes and earlier failed runs are retained in the repair packet. Repository-wide formatting checks report 32 core and 23 portal files; every warned file is byte-identical to HEAD. These pre-existing formatting issues are outside this repair. Changed TypeScript/Vue files are checked separately.

## Deployment and limits

Deploy API and hosting worker together: older workers reject generation-bearing payloads. A rollback must retain the compatible reader or explicitly accommodate saved generations. The operator guidance is updated in [payment operations](../operations/connected-payments.md). This prevents future dropped updates; it does not replay events already acknowledged and lost by the old worker. No live reconciliation or billing-state alteration was performed.

No commit, push, deployment, real provider request, wallet operation, asset movement, authority change or contract rebuild is part of this repair. Modules, the website, the independently pinned MCP package and Almaiso are unchanged. Existing release binaries and sealed deployment paths are untouched.
