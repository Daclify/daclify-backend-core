# Two-path account entry and assisted-recovery opt-out

Implemented on 2026-10-11 on `dev`, inline, without delegation. The approved [design](../superpowers/specs/2026-10-11-two-path-account-entry-design.md) and [plan](../superpowers/plans/2026-10-11-two-path-account-entry.md) define the scope.

New visitors choose verified Telegram/email signup with explicit assisted-recovery consent, or the existing independent password/encrypted-kit path. Quick signup generates the original signing and document keys in browser memory after provider verification. A browser-bound, purpose-separated signed ceremony commits assistance history before key delivery. Both original keys and the retained encrypted backup are verified before credential ownership and a usable session are activated. Previously paired credentials open their original account without changing its recovery policy. Interrupted completion retries the same identity; pending accounts cannot bypass setup through root-key login. Bounded maintenance removes expired ceremony material while retaining assistance history.

Account → Access & recovery offers **Turn off Daclify-assisted recovery**. It removes every assisted route, outstanding assisted grant and pending handoff, including quarantined backups, under an account lock. Client-protected methods and Telegram/email pairings remain. Removing the final assisted route requires a current independently protected method or a same-key kit. The browser decrypts both kit envelopes, initiates its download and requires acknowledgment; the API checks encrypted-kit metadata and a fresh account-control signature without receiving the password. Another account’s local kit is preserved. Opt-out does not erase historical key exposure or relabel the original keys as never operator-exposed.

The recovery response distinguishes stored/pending assistance from temporarily unavailable methods. Consent uses the revision displayed before the user chooses it. Opt-out advances that revision and deletes pending handoffs, so an earlier consent cannot silently revive assistance.

## Verification

| Check | Actual result |
| --- | --- |
| Canonical signup/recovery schema tests | 2 files, 9 passed |
| Owned PostgreSQL/API signup, recovery, providers and cleanup | 4 files, 56 passed |
| Complete entry/recovery browser regressions | 52 passed across Chromium desktop and mobile |
| Final quick signup/opt-out, including paused backups | 16 passed across desktop/mobile after the final recovery changes |
| Exact staged frontend source: lint, Vue/types, unit tests, production build | Passed; 41 files, 274 unit tests |
| Combined workspace frontend snapshot | 42 files, 275 passed after the concurrent app-evidence fixture was corrected |
| Module lint, types, generated docs and full unit suite | Passed; 30 files, 179 tests |
| Final staged module compatibility/docs tests | 2 files, 8 passed; types passed |
| Core lint/types and development build/package | Passed; the staged-source type check used physical dependencies to avoid symlink declaration paths |
| Core full unit suite | 138 files: 136 passed, 2 failed; 861 cases passed, 4 failed |

The four core failures were also present before implementation: three `permission-audit.test.ts` expectations and one `ram-controller.test.ts` scope-count expectation (29 versus 31). Their compiled contract/permission inputs are part of the concurrent connected-app work. They do not qualify a release and were not changed by this task.

API tests use real K1/P-256 encryption/signature operations, Telegram HMAC and RS256 JWT verification, real code consumption and PostgreSQL transactions. Provider transport, key wrapping and independent storage are owned fixtures; they are not live-provider qualification. Browser tests exercise real HTTP → API → database → encrypted backup → browser keys, including new-device login, cancellation, outages, original-key kit recovery, preserved vaults and paused assistance. A claim already holding the account lock is allowed to finish before opt-out; every later claim fails. Assistance history remains true.

The first disposable database had already applied a concurrently renumbered connected-app migration. Tests moved to a fresh owned loopback `daclify_account_entry_test`; no live database or migration hashes were edited. Concurrent dependency reinstalls interrupted early test workers; definitive checks ran in disposable source snapshots. Exact staged-source views additionally checked that connected-app implementation edits were excluded from these commits. Two minimal consumer adaptations retain compatibility with the development module artifact: an empty activity cursor and an Activity display label.

## Artifacts and held qualification

Core/frontend development version is `0.13.0-alpha.5`; module SDK is `0.9.0-alpha.21`. Explicit public-package pins and consumer lock integrity are updated. The module docs generator reads an installed module’s producer-owned config and uses a distinct `activity` topic, avoiding a duplicate core `connected-apps` topic.

These are **unpublished development artifacts**, generated from the combined workspace, including the already-present connected-app public interfaces/compiled SDK. They are not immutable source-qualified releases. The connected-app implementation and contract edits remain outside this task’s commits. Committed references retain the previously committed contract rows and add only account-entry/recovery schemas and guides.

- `daclify-core-protocol-0.13.0-alpha.5.tgz` SHA-256: `0ed0d366421261d46db754bf86e92096e98ac4c6a4c083129715a9af1bbc1570`.
- `daclify-modules-0.9.0-alpha.21.tgz` SHA-256: `e96300f3716ed193e251b99bcf6d69928046a6b1e358f4ea880ec6c9c7f1838a`.

No service deployment, live recovery enablement, package publication, environment secret update, chain transaction or contract behavior change was performed by this task. Actual SMTP/Telegram clients, durable OpenBao custody/audit and independent-host/off-site restore qualification remain held. Quick signup remains unavailable until that qualification and provider configuration are present. Backend/API and frontend must be updated together before serving the new entry flow.

Implementation and diff review were performed inline under Ponytail Full. Existing unrelated edits were preserved using a separate staging index. The user authorized continuous implementation and `dev` delivery; no new approval checkpoint was introduced.
