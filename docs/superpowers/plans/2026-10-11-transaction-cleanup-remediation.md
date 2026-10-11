# Transaction cleanup remediation implementation plan

> Execute inline with Superpowers executing-plans; the workspace prohibits delegation.

**Goal:** Repair remaining rollback cleanup, commit and push the fixes, and apply the verified API/frontend changes to the existing live testnet.

**Architecture:** Keep transaction statements, lock scopes, error mappings and accounting decisions in their existing owners. Share only rollback cleanup in `services/api/src/transaction.ts`; each leased connection records whether cleanup requires discarding it. A failed archive unlock must still release its connection without hiding the operation failure.

**Tech Stack:** Existing TypeScript, pg, Vitest, PostgreSQL and Playwright; existing systemd/Caddy deployment tooling.

**Spec:** Remaining transaction-cleanup finding in `docs/evidence/2026-10-11-autonomous-repository-audit.json`; user requests fixes, commit/push, and live application.

## Global constraints

- Work inline on core/frontend `dev`; preserve unrelated changes and the other repositories.
- Preserve SQL statements, early commits, retry/fallback behavior, business errors, schemas, public pins and contract binaries.
- Deploy the API and frontend to the established testnet hosts after validation. No asset transfers, authority changes or smart-contract deployment are required.
- Provider fixtures qualify their fixture boundary; real wallet consent and production providers cannot be claimed from mocks.

## Review focus

- Simultaneous operation/rollback failures preserve the operation error and release exactly once with discard.
- Successful rollback returns a usable connection; early-commit branches keep their existing results.
- Archive session-lock cleanup cannot leak a connection or replace a business error when unlock fails.
- Content recovery's deliberate per-object fallback continues after rollback failure while discarding that connection.
- Testnet restart must retain existing database records/configuration and serve the verified source and frontend assets.

### Task 1: Repair and verify transaction cleanup

**Files:** New `services/api/src/transaction.ts`, remaining rollback owners in API auth/store/creation/archive/billing/payments/resources/content, new `tests/transaction-cleanup.test.ts`, and existing shared account transaction helper.

**Interface:** `rollbackTransaction(client: PoolClient): Promise<boolean>` returns whether rollback failed and the client must be discarded. Existing business interfaces stay unchanged.

- [x] Add failing fault-injection tests through real authentication, migration, payment, gateway and archive operations, including failed archive unlock.
- [x] Introduce shared rollback cleanup and update every remaining leased-client catch/finally pair. Review every diff and preserve original transaction bodies.
- [x] Run targeted tests, core verify/build, and the full integration suite against owned disposable PostgreSQL. Check available provider fixtures without touching production credentials.

### Task 2: Deliver and apply live

- [x] Run current frontend verify/build and affected browser checks; record wallet/provider limits precisely.
- [x] Record source-bound evidence, review final diffs, commit only this task's files and push core `dev`.
- [x] Snapshot the current API build and frontend entry point, rebuild/publish the frontend, restart the API through existing tooling, and verify public HTTPS UI/API and active runtime source.
- [x] Commit/push deployment evidence and confirm remote heads, service health and cleanup of owned fixtures.
