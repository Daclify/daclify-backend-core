# Trusted-contact recovery — development evidence

Implemented inline on `dev`, 15 October 2026. No production deployment, real authority change, enrollment or contact notification was performed. This evidence qualifies the checks listed here, not production readiness.

## Behavior and boundaries

Contact enrollment requires the current, unretired root-key signature, preventing a DAO-created wallet binding from enrolling recovery for an unrelated service profile. A compiled-WASM adversarial test first reproduced the takeover boundary, then required native/EVM enrollment wrappers to reject it; native Spring also verifies the rejection. Encryption coordinates require canonical encodings so aliases cannot make a shared decryption key appear distinct. Three distinct contacts must accept; two approve the same fresh replacement-key proof. The second starts a 48-hour wait, a request expires after seven days, and current control can cancel. Recovery preserves DAO/member IDs, roles, credits, claims and stake; invalidates delegated credential epochs and the recovered membership's old native/EVM binding; and reconciles actual native authority with incoming wallet consent. Attempts to strand the last native controller or silently change the recovered admin role roll back atomically.

`recroots` and permanent indexed `recretired` records retain the current key family and immutable original key across partial DAO recoveries, repeated replacement-device loss and database snapshots predating the first claim. Migration 056 binds that chain identity to its surviving service UUID. A fresh origin/audience-bound login challenge and current chain certificate are required; normal login cannot create a competing replacement profile before claim. Key changes revoke old sessions, quarantine full-access methods and remove old sign-in bindings. Finishing another membership with the same replacement preserves newly paired methods and sessions. Complete database loss creates a new service UUID around unchanged chain memberships. No email-based account merge occurs.

DAO document recovery defaults off. Eligible epoch secrets are backed up in bounded ciphertext packets and split using `shamir-secret-sharing` 0.0.4, an exact pinned, zero-dependency Apache-2.0 library with published Cure53/Zellic audit reports ([upstream](https://github.com/privy-io/shamir-secret-sharing)). Existing WebCrypto ECDH/HKDF/AES-GCM delivery encrypts the shares to each contact. The SDK verifies packet scope and epoch commitments. No shared personal decryption private key or signing private key enters a contact packet. Any two contacts can reconstruct offline; the account wait does not delay document decryption or revoke retained copies.

Recovered keys are additional per-request encrypted `recgrants`; original grants remain intact. Historical permission and administrator-approved future reentry use separate flags. A forbidden DAO's fresh epoch and explicit reentry approval cannot enable historical recovery. Ordinary recovery-kit formats stay unchanged. A versioned pending-device backup restores only the receiving setup; import verifies the encrypted identity and does not sign in or overwrite a different pending key. After completion, the ordinary replacement kit can also resume the claim after service database loss. It is rejected as a pre-completion pending backup. Retired keys cannot choose new contacts in an unrecovered DAO; its existing accepted contacts remain usable for recovery.

## Storage and toolchain

Each membership has one contact policy, one pending request and one latest completion. Request counters survive permissionless O(1) expiry cleanup. Policies cap contacts at three; proofs expire within 15 minutes; request lifetime is bounded to seven days. Packets cap ciphertext at 16,000 bytes and epoch metadata at 64; the app exports 16 epochs per action and reads 20 packets per page. Grant envelopes cap at 8,192 bytes. Packet member paging and grant context lookup each have one justified index. Global root/retired-key indexes support bounded current-control lookup; these durable records deliberately survive cleanup to prevent replay after database restore. The global rows retain DAO attribution for existing RAM accounting.

Current contracts use pinned CDT 4.1.1 `-O=s`. The current runtime additionally uses pinned Binaryen 108 `--mvp-features -Oz` because the CDT-only binary exceeds Spring's 1 MiB decompression limit. Historical build recipes and pins are untouched. Exact sizes, SHA-256 and native RAM/action CPU samples are in the [machine-readable evidence](2026-10-15-trusted-contact-recovery.json). Two independent same-source builds produced the same optimized runtime bytes. Optimization does not establish an action CPU speedup: the raw current binary cannot be deployed within the decoder limit. Prior archive identities and frozen row layouts remain explicitly readable; unknown hashes still fail closed.

The toolchain Dockerfile pins the optimizer and libfaketime downloads by SHA-256. Package dependencies were checked against [Ubuntu's Binaryen package](https://packages.ubuntu.com/noble/amd64/binaryen) and [Jammy's updated libstdc++6](https://packages.ubuntu.com/jammy-updates/libstdc%2B%2B6). The Docker image itself was not built on this host. The native test uses libfaketime only inside its owned process, advancing from four days in the past with monotonic time untouched; it does not change host time or replace contract timing checks.

## Verification record

Final suite counts are recorded below after the dependency freeze. Intermediate failures were retained in the execution ledger: missing preimplementation APIs/ABIs, HKDF domain-size limit, native decoder size limit, stale development package cohorts, previous archive hashes and recovery error messages. Each was resolved with an affected regression; no assertion or immutable pin check was weakened.

- Actual native Spring: one test passed, including real ABI-packed K1 proofs, native authority handover, exact 48-hour checks, both native rollback cases, encrypted packet retrieval and acknowledgments, two-contact reconstruction, additional grant lookup and permanent retirement/current identity reads.
- Browser checks use real independent vaults and signatures with HTTP fixtures. Compiled-WASM/native tests establish authoritative timing and permissions; HTTP fixtures do not establish them.
- PostgreSQL integration uses disposable local databases, real challenges/signatures and the migration coordinator. It covers preserved UUIDs, stale/replayed claims, concurrency, empty/stale databases, origin-key lookup, repeated recovery, session retirement, and account erasure cleanup.

Final results (individual suites, not one combined invocation):

| Check | Result |
| --- | --- |
| Core broad regression | 1,092 passed; packaging-policy timeout passed on isolated rerun |
| Final core recovery, crypto, permissions, RAM and release checks | 67 passed in 10 files |
| Modules | 287 passed; final archive compatibility rerun 9 passed |
| Frontend | 395 passed; final affected rerun 26 passed; Vue/type/lint/build passed |
| Desktop and mobile Chromium | 6 passed, including independent contact vaults, cancellation, backup import, completed ordinary-kit resume and accessibility |
| PostgreSQL auth/recovery | 80 passed |
| PostgreSQL 17 erasure/restore | 27 passed |
| Native permissions and executive governance | 34 passed |
| Native Grants/Decide/Works/Payroll/accounting | 41 passed |
| Final pinned native recovery binary | 1 passed, including both enrollment attacks and retired-key policy changes |

The broad core run preceded the last three adversarial tests; all three passed in the final affected suite. An initial browser run was invalidated by a development hot update; the frozen-source desktop/mobile rerun passed. An initial PostgreSQL 17 restore against PostgreSQL 16 failed on its unsupported configuration parameter; matching PostgreSQL 17 passed. A native aggregate hit the fixture free-space guard; disposable task databases/staging were cleaned and isolated reruns passed without lowering the guard. A stale native grants fixture was updated to use its actual committed ballot. The frontend build retains its existing large-chunk warning. Both owned PostgreSQL fixtures and owned native processes were stopped; no existing service was stopped.

## Remaining release qualification

No single drill joined the actual browser, API, PostgreSQL and native chain into one original-database-loss flow. Live wallet/provider/client qualification and a Docker image build were not run. Existing testnet/production contracts were not upgraded; old deployments show recovery as unsupported. These are release gates, not claims established by unit or mocked browser tests. Original document ciphertext, chain availability and the contact quorum still have to survive. Later policy revocation cannot erase shared keys or plaintext already held by contacts.
