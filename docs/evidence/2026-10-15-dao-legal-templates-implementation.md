# DAO legal templates — implementation and rollout evidence

Scope: the approved [plan](../superpowers/plans/2026-10-15-dao-legal-templates.md), [design](../superpowers/specs/2026-10-15-dao-legal-templates-design.md) and [latest-dev review](2026-10-15-dao-legal-templates-plan-review.md). Work was performed inline in isolated `feat/dao-legal-templates` worktrees. No live service, native authority, DAO policy, user document or production database was changed.

## Delivered behavior

- Twelve curated Markdown templates, with original ZIP, per-file source hashes, bounded fields and a normalization audit in frontend `docs/legal-templates/README.md`. Source ZIP SHA-256: `9408ad036cd86566e4eb14384c8f5f3c08c269c39c9905e65ef27cd255736b41`.
- Documents → Create from template: choose documents, reuse shared DAO details, fill fields and milestone rows, edit/preview, explicitly export/import, review and publish. Drafts stay in page memory, survive closing the dialog on that page, and have no hosted backup guarantee. Protected wording clears on vault lock; account, keys, membership, epoch and full DAO changes invalidate local reviews. Exporting protected text requires explicit plaintext-download consent.
- Public/native approval keeps the existing signer path. Protected files use existing epoch encryption and recovery lookup. New code reads one bounded recovery-status page; it does not enroll contacts, publish shares, recover an account or invent historical keys. Recovery disclosure distinguishes permission, opt-in, unsupported/unknown state and actual key coverage.
- Verified bounded UTF-8 Markdown is readable before adoption or acceptance. Commitments and encrypted domains are checked before decoding; original PDF/binary and oversized/non-UTF-8 Library downloads retain their existing raw-byte path. Template provenance identifies source and customization, not legal review or execution.
- Publication is independent of registration, proposal, vote/finalization, adoption and acceptance. Continue document setup selects the existing register flow; every mutation remains explicit. Full bounded register discovery prevents treating a partial first page as proof of no constitution. Constitutions amend the existing identity; other amendments require explicit selection and preserve fixed registration settings. The adopted text must be reviewed before an amendment.
- Fresh native content, register, policy, module and membership checks precede sensitive continuation. Lost upload/publication/registration/proposal responses reconcile using the original request or exact native state, without timed mutation retries. A known conflicting native version offers receipt download and renewed review; its original stored object remains retained and charged. No cleanup/deletion promise was added.
- Administrators have an optional overview setup link. A published contributor agreement can preselect its exact document/version/commitment in a new Works proposal. Hints are validated, consumed and removed; they grant no authority and contain no body or parties. Contributor, native amounts/dates, consent, protected terms and funding remain in the existing Works flow. Older projects and accepted revisions are unchanged.

## Acceptance and verification matrix

| Area | Evidence and limits |
| --- | --- |
| Catalogue and renderer | Source/marker coverage; literal single-pass replacement, Markdown escaping, byte/field/date bounds, independently escaped milestones and truthful same-DAO ordinary-policy prefills. No interpretation of arbitrary legal prose. |
| Editor and access | Desktop/mobile browser scenarios cover import/export, manual edits, safe preview, accessibility/no horizontal overflow, recovery disclosure variants, same-account credential replacement, Escape/reopen, protected vault lock and no body in URLs/browser storage. |
| Hosted publication | Public and private browser fixtures verify real signatures, same upload identity and bytes through an outage, lost native response reconciliation, stale native revisions and retained-receipt conflict recovery. These are synthetic HTTP/provider faults, not live Pinata qualification. |
| Review and recovery | Unit checks use real vault/epoch crypto, original grants plus an authorized additional recovered grant, unavailable historical keys, corrupted bytes, malformed/oversized Markdown, raw downloads and an in-flight vault lock. Existing profile/recovery mechanisms are reused. |
| Register and adoption | Bounded discovery tests include later pages, foreign domains, incomplete reads, nonadvancing cursors, changed policy pins and native limits. Browser tests cover existing-constitution review, explicit handoff, lost registration/proposal responses and no automatic adoption. Existing register/adopt/accept browser regression remains green. |
| Native authorization | Pinned Spring fixture covers exact-version administrator adoption, duplicate acceptance and unsigned/nonadmin rejection; real commitment-bound member voting/finalization; public hosted agreement and Works consent; encrypted hosted agreement with epoch grants and plaintext metadata rejection; preservation of accepted history and rejection of pending approvals after an actual code replacement. |
| Archive compatibility | Modules documentation/typecheck and 21 checks across documentation, document archives, restore and Quick ballot archives pass. Older supported identities remain accepted and unknown identities remain rejected; no archive schemas, pruning rules or source hashes changed. |
| Final checks | Frontend verification: 411/411 unit tests across 77 files, 40/40 desktop/mobile browser checks, production and fixed-testnet builds. Core affected suites: 38/38; modules affected suites: 21/21; all five native scenarios pass in the recorded selections. Exact commands, hashes and static inventory are in the companion JSON. |

The native upgrade test originally relied on rows created by another test; it now creates its own same-DAO adopted/accepted revision and selects its exact pending change. Its legacy raw-vote call was separately updated to the released commitment-bound voting helper. Neither correction changes production contract behavior. The component access harness now supplies the router/window environment required by the route hints; production guards were not weakened to accommodate the harness.

Original expanded plan scenarios are not a claim of exhaustive qualification of every wallet GUI, recovery ceremony, provider fault or concurrency schedule. The native gateway, browser HTTP fixtures and actual crypto checks are complementary layers. The owned SQL fixture was unavailable at its standard synthetic test address, so a full new SQL-backed browser/provider rehearsal was not run. Live Pinata, external wallet GUI, external execution of agreements, jurisdiction-specific legal suitability and mainnet qualification remain unqualified. No external/live database was substituted.

## Release cohort and rollout

| Component | Prepared version |
| --- | --- |
| Core API and public SDK/help | `0.15.0-alpha.31` |
| Modules public SDK/help | `0.10.0-alpha.41` |
| Modules native contract version | unchanged `0.10.0-alpha.4` |
| Frontend | `0.15.0-alpha.42` |

New help bytes use new immutable packages; prior packages remain available. Core and module package bytes are vendored in the frontend and pinned by SHA-512 in its lockfile. The feature adds no runtime dependency, migration, table, stored contract field, index, service or native rebuild. The independent standalone MCP release retains its own existing pins.

Native binaries retained their baseline hashes:

- Runtime: `afa80071de5578e915c5b4c37d02f294c612a713299fa264116e7f338d65ca2d`.
- Decide: `1dbbd528e111c750e1b33eeef21db2252243de134fede3dea02ebb4341f1b95c`.
- Works: `f280b45833356855b6744b91d1c8cadda93da5b62d04c1d3e301cc8d4212ee58`.

No compiler flags changed. Reused current artifacts retain pinned CDT 4.1.1 `-O=s` and the existing Binaryen 108 pipeline; the historical upgrade probe was copied unchanged. Native temporary state used an owned `/dev/shm` directory to meet the existing minimum-free-space guard without lowering it. The representative four-action register/propose/adopt/accept scenario used 1,840 native RAM bytes; action CPU measurements and their fixture scope are in JSON, not a production capacity guarantee.

Rollout checklist (subsequent authorization, not performed by implementation):

1. Retain the current deployed frontend and API artifacts/configuration as one rollback cohort. The preceding source cohort is frontend `f1811a1`, core `33f3fdf` (application baseline `fcff209`) and modules `cec1e3f`.
2. Build/package the matching core API with the alpha31/alpha41 public archives. Confirm the existing migration 056 and preserved storage/recovery/authority configuration; there is no feature migration to apply.
3. Stage API alpha31 and the immutable frontend alpha42 artifact together. A frontend-only cutover while the API still reports alpha30 would not be a qualified version-aware help/module combination.
4. Check health/network version, module compatibility/hash verification, account sign-in and document access on staging. Rehearse the previously unqualified SQL-backed and actual storage-provider flow using disposable DAOs before any production qualification claim.
5. Review a public and a protected template through signed publication, exact-byte review and separate approval/acceptance. Confirm optional setup/Works hints perform no action themselves and that older adopted documents remain readable.
6. Promote only after review and explicit deployment authorization. If rollback is required, restore the saved API/frontend cohort together; retain all new native records and stored objects. Do not downgrade or erase user data to match an older UI.

Prepared artifacts are unpublished development artifacts. This evidence does not grant production release qualification or authorize a contract upgrade, key change, policy write or deployment.

Tested source commits: core `33b5a7679fa38f208b91ad440d622c253af584ef`, modules `a2cdc7106d72ccfe605d7f65e63b32bf8310c9f1`, frontend `644dfdd163bc3f7bfab43f209771bdbf02887452`.

The rollout artifact is `/data/daclify-runtime/artifacts/2026-10-15-legal-templates/frontend-testnet-0.15.0-alpha.42.tgz` (SHA-256 `5f98f865c6e1dbbdd1b4283eec1e5372f36e4f0f3f2000541d51965b32551f74`). The separately named local-validation archive is not the rollout candidate. The live read-only network check reported API alpha30; the candidate requires API alpha31.
