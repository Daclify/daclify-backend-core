# One account and private DAO access continuity

Completed and published to testnet on 2026-10-12. [Machine-readable evidence](2026-10-12-account-access-continuity.json) records source commits, package hashes, checks and deployment limits. Production qualification is not claimed.

## Result

The portal presents one Daclify account setup and one encrypted recovery kit. Signing and P-256 document-encryption purposes remain separate internally and are restored together. Pairing a sign-in method does not silently enable key recovery or operator custody.

A correct original kit that matches a registered account now offers **Restore account and keep my sign-ins**, **Restore account only**, or **Cancel**. Reconnection requires fresh wallet control and a signature from the original account, rejects identity/link/request conflicts and passkey limits, preserves counters, and invalidates both profiles' sessions and pending account-bound and vault-key login challenges. The registered identity remains canonical. Historical receipts, uploads, archive evidence and provider references retain their original owners, with a constrained one-way ownership relationship. Connected apps and payment brokers require fresh authorization. No account was reconnected by publication.

Create and Join reuse Account setup inline and preserve the originating route. Public join identity requires an available recovery-policy check; a failed check offers Retry instead of displaying an endless checking state. New keys cannot decrypt a different membership's old history.

Private admission can explicitly request permitted grants. Administrators prepare at most 20 missing grants per batch, using only epochs they can decrypt, current history/custody policy and active recipients. Completed grants survive a later failure. Moving between Members and Documents refreshes access and uses the actual current epoch. A local verification action opens grants and checks commitments without sending keys or plaintext to the API.

Before private administrator deactivation or demotion, the portal refreshes records and requires another active administrator with all recorded grants and human confirmation of decryption/recovery on another device. A failed refresh blocks this flow. Direct native actions can bypass this portal check; the existing contract last-administrator guard remains authoritative. From-join privacy deliberately forbids giving a later member earlier epochs, so an administrator who already has that history must remain if it is to be retained. No contract was changed or deployed.

## Verification

| Check | Result |
| --- | --- |
| Core lint, strict TypeScript, generated docs and build | Passed |
| Core unit and compiled-WASM suites | 887 passed |
| PostgreSQL integration suites on owned disposable database | 287 passed, zero skips |
| Final reconnection regressions after pending-vault-challenge fix | 23 passed |
| Module lint, TypeScript, generated docs, build and full tests | 192 passed |
| Frontend lint, strict Vue TypeScript, build and unit suites | 286 passed |
| Final affected frontend unit checks after recovery retry | 21 passed |
| Desktop and mobile recovery, Create/Join and workspace browser suites | 44 passed, including Axe checks |
| Actual public testnet browser checks | Desktop and phone passed; zero browser errors |
| TLS isolated OpenBao snapshot restore after disposable source removal | Passed with original synthetic bytes recovered and four denied privileged operations |
| Configured live key service, synthetic wrapping and unwrapping | Passed over TLS |

The browser continuity test uses two original encrypted kits, real local encryption and root signatures: prepare the successor's grant, restore on another browser context, verify decryption, block an unavailable handover refresh, remove the creator, decrypt retained history, and initialize the next epoch. Its API/chain transport is a fixture, so it does not establish a new live native-contract invariant. Actual wallet proof verification and PostgreSQL atomicity/replay/conflict checks run in the backend integration tests.

Full checks caught and corrected an outdated module compatibility expectation, a missing encryption field in the component-test login fixture and a stale development migration copy in the disposable database. The final reported suites have no failures or skips. Existing published migrations were preserved. Contract source was unchanged; no new CDT build, native-runtime run or live-wallet/passkey qualification is claimed.

## Testnet delivery

Application source pins are core `7d7a8ec`, modules `d4e42dc` and frontend `093d0ac`; the versions are core `0.14.0-alpha.3`, modules `0.10.0-alpha.3` and frontend `0.14.0-alpha.6`. All were pushed to `dev`. Protocol and module artifacts remain tested development packages; the existing production publication gate remains closed.

Exact Git archives and the tested pinned tarballs formed the testnet snapshots. A private database dump, prior frontend index and API source override were retained before publication. The initial API start failed because recovery evidence was pinned to core alpha.2. The previous API was restored while a fresh alpha.3 isolated TLS/raft restore and configured live-service synthetic wrapping check completed. A release-specific recovery report then enabled the new API. The original recovery report and live key-service policies/material were preserved. This remains explicitly single-host testnet development recovery, with no independent-host or wallet/passkey qualification added.

The public API reports core alpha.3 and returns the actual DAO private-access policy. Public frontend index SHA-256 is `31f34ce1a60cf779f1185096ac46286fa5d87d7380361437b219026a9a353d1f` and matches the published build. Both public browser sizes passed against the real API. Read-only before/after comparisons found account identities, keys, paired credentials, passkey counters, wallet links and service-to-member associations unchanged. No chain action or live account reconciliation was performed by development or publication.

Rollback retains hashed frontend assets and the prior index. Restoring the old API also requires removing this delivery's recovery-report environment override. Preserve migration 041 and any subsequent user-initiated reconnections; do not restore an older database over new user actions. Runtime backups and recovery tokens are private and absent from source control.

An unrelated untracked mini-app/account-exit design file was preserved outside this change.
