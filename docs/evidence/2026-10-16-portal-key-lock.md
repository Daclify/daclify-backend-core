# Portal activity and key locking

The user requested that active portal use keep keys unlocked and that the inactivity interval match normal sign-in expiration. The portal now uses twelve hours of inactivity. Clicking, typing, pointer movement and scrolling in a visible tab reset that interval. The existing fixed twelve-hour sign-in expiration remains a hard limit; browsing does not renew authentication.

Keys remain in memory and lock on reload, manual lock, sign-out, account/key replacement, confirmed session removal, or the earlier of inactivity and the reported session deadline. Activity cannot reopen a locked vault. Manual locking and sign-out still propagate only within the matching account/operator scope. Deadline checks also reject key use and pending private work when browser timers were suspended.

The API exposes the existing session's remaining milliseconds in the CORS-exposed `x-daclify-session-ms` header on login and session reads. Reads do not rotate credentials, renew step-up freshness or extend sessions. The browser validates the bounded lifetime and counts from request start, conservatively allowing for transport delay. An older API without this optional header retains inactivity locking and confirmed-session-removal handling; the hard session-deadline timer requires the updated API.

The API implementation package advances to 0.15.0-alpha.33. The public protocol, SDK and network compatibility version remain 0.15.0-alpha.32: no body schemas, native contracts or module interfaces changed. Existing modules pin that protocol exactly. Their SDK archives and deployed code/ABI hashes remain unchanged. The frontend advances to 0.15.0-alpha.52; no dependencies, database schemas, custody permissions, email-code lifetimes or key persistence changed.

Verification is recorded in the accompanying JSON and the owned execution ledger at `/data/daclify-runtime/portal-key-lock-20261016/`. It distinguishes controlled browser/SQL tests from public deployment checks. No user email code, private key, encrypted backup or live recovery ceremony was used.

Checks: 422 frontend unit tests; 84 selected desktop/mobile browser cases; a final 28-case session-security rerun; 10 compiled-bundle account/lock checks; 70 authentication/recovery SQL integration cases; and 37 module/packaging compatibility cases passed. Vue/TypeScript builds, core/frontend lint, formatting and unchanged generated-document checks passed.

The complete core run passed 1,113 of 1,114 cases. The unchanged `requires finite explicit retention and refuses ephemeral mainnet configuration` test assumes the conventional `/tmp` prefix; the run used `/dev/shm` for temporary files. All four cases in its file passed when repeated with `TMPDIR=/tmp`, without changing profile configuration or tests. The JSON preserves this result separately rather than claiming an entirely green single full run.
