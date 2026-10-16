# Private identity implementation checkpoint

This records Task 2 of the approved maximum-content-privacy plan. It is a development checkpoint, not a live activation or completion of all seven tasks. The matched development cohort is core protocol/SDK37, modules46 and frontend57. Intermediate modules44/45 are not release candidates.

Encrypted DAO names, descriptions and branding use existing exact-version DAO documents and epoch grants. Creation orders and claim requests receive staged ciphertext bound to canonical public operational setup. Private links separate their bearer token and fragment-only content key. The sole claimant generates fresh final DAO keys with their original account identity; the issuer receives no membership/grant. Metadata4 preserves setup and optional public alias, pins encrypted references and guards updates with the raw previous-metadata checksum. Existing strict public summaries remain unchanged. Interrupted uploads reconcile the original ciphertext/request before a signature, and an unfinished edit can be restored for explicit review.

## Recorded verification

| Check                                                                               | Result             |
| ----------------------------------------------------------------------------------- | ------------------ |
| Core affected private records/creation/identity/branding/presets/claims/preflight   | 35 passed          |
| PostgreSQL creation/claims and actual native claim creation                         | 23 passed, 3 files |
| Actual Spring private identity/retention/authority/stale write check                | 1 passed           |
| Modules SDK/help/ballot commitment/provenance cohort                                | 23 passed, 5 files |
| Frontend affected content/session/recovery/policy                                   | 80 passed, 8 files |
| Final browser original-key crypto/setup/claim-entry                                 | 24 passed, 3 files |
| Desktop/mobile private identity and existing public claims/passkeys                 | 10 passed          |
| Core/frontend typechecks and builds; scoped core lint; generated core documentation | Passed             |

Evidence logs and the plan ledger are under `.superpowers/sdd/2026-10-16-maximum-content-privacy/` in the isolated implementation worktree. Browser checks use owned synthetic identities, a disposable PostgreSQL cluster, actual compiled contracts on Spring 1.2.2, and a local hosted-content fixture. They do not qualify an independent external content/recovery provider.

The pinned CDT 4.1.1 `-O=s` runtime, with the existing MVP size optimizer, is857893 bytes versus853321 baseline (+4572). A local signed legacy-to-metadata4 conversion consumed1718 RAM bytes for metadata and three fixed reference slots, and3072 microseconds CPU. No new table/index is introduced. These are fixture measurements, not network guarantees.

## Review rulings and limits

Use a prospective random DAO ID reserved by the existing immutable order, rather than another reservation service. The new identity endpoint includes parsed metadata and its exact raw checksum to prevent stale writes and preserve unrelated public/reference fields. Staged cryptography additionally binds the public operational request; existing DAO document/grant domains remain unchanged.

Initial harness runs exposed stale module compatibility declarations, IP-hostname passkey restrictions and a hidden mobile navigation locator. Corrected immutable producer version46 and supported localhost fixture configuration; the final10 browser cases passed. New upload tests first reproduced a changed-payload retry bypass, then passed after the fix. Historical packages/fixtures were not overwritten.

Guarded-agent original-key authoring is an intermediate refusal assigned to Task4. Tasks3–7, complete release/upgrade/proof suites and live activation remain outstanding. Existing plaintext history cannot be made secret retroactively. No real DAO was migrated, no customer keys or authority changed, and TESTDAO-2 remains untouched.
