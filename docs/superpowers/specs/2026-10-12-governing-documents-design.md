# Governing documents in Documents

## Intent and selected policy

The user wants DAO constitutions and legal documentation properly managed in the existing Documents screen. The user selected **each DAO chooses administrator approval or a member vote**. Existing generic uploads are immutable versions, but the latest upload is not evidence of adoption. Ordinary Decide polls do not adopt documents.

The repository workflow authorizes continuous inline implementation, completed-code review and `dev` integration. No delegation is authorized. Contract upgrades and live permission changes are a distinct delivery operation.

## Product behavior

An administrator can register an existing document as Constitution, Policy, Agreement, Legal document or Other, choose administrator approval or a member vote, and choose whether to track member acceptance. The choices are fixed on registration; the UI explains this. Each DAO has at most one Constitution registration. A document can be registered once. Existing ordinary documents keep their upload behavior.

The register shows draft, awaiting approval and adopted versions separately. Uploading another version does not replace the adopted version. An administrator proposes a specific stored version against the current adoption revision. Administrator approval requires a second explicit signed adoption action. Member-vote approval opens an actual Reject/Approve ballot using the DAO's current Decide policy. Finalizing a passing vote permits adoption of only the reviewed version. The screen supports voting, finalization and adoption without leaving Documents.

An adopted version remains readable/downloadable through existing content integrity and encryption helpers. A member can explicitly acknowledge that exact current adopted version after opening it. Acceptance records contain the stable DAO member ID and version, independent of paired sign-in methods, and survive later amendments or a member leaving. Each member can acknowledge an adoption once. Acceptance is optional tracking: it does not grant membership, enforce admission, change voting rights, certify an external signature, or guarantee legal enforceability.

## Implementation choices made by the builder

- Extend the existing Decide module with `regdoc`, `proposedoc`, `adoptdoc`, `canceldoc`, `ackdoc` and bounded permissionless `cleardocs`. Both approval modes use the same register and exact-version history. No new module or dependency.
- Categories are enums, not new public filenames. Content titles/filenames remain in the existing public content or encrypted envelopes. New chain records expose IDs, category, approvals, voters and acceptance timestamps, as ordinary governance metadata already does. No protected document body or secret goes into voting metadata.
- At most **64 registered documents per DAO**, one active proposal per registration, proposal expiry **7 days after ballot close** (7 days after submission for administrator approval), cleanup of at most **25 proposal IDs** per call. No unbounded on-chain array of versions or acceptances.
- Tables `docregs`, `docchanges`, `docaccepts` contain fixed-size records. `docregs` indexes DAO and `(DAO, document)`; `docchanges` indexes registration and ballot; `docaccepts` indexes `(adoption, member)`. Indexes serve bounded isolation, uniqueness, history, ballot protection and acceptance reads. Immutable history is charged to retained RAM; expired proposals release active document references but retain the audit entry.
- A proposal stores exact content commitment, expected adoption revision, source code hash and (for votes) governance-policy revision. Adoption verifies all, checks the DAO is not paused, and is once-only. A stale candidate never silently switches to latest. Upgrading source code invalidates pending proposals rather than rewriting their approved hash.
- Cancelling a live or failed proposal is possible, but administrators cannot veto an unexpired passing ballot. Permissionless cleanup closes expired/rejected proposals; ballot finalization remains necessary to release a governance lock if still open.
- Register/history/adoption pointer is contract authoritative. Core document references protect pending/adopted versions from pruning. Bound legal ballots remain protected from ordinary vote pruning, including after cancellation. New families have full RAM metering/backfill coverage. Existing table layouts do not change.
- A module-owned, bounded, paginated API returns register entries, one registration's history and one adoption's acceptance page. It verifies DAO ownership and the actual installed module hash/actions. Old deployments return an explicit unavailable state and retain generic Documents.
- Frontend consumes generated producer-owned ABI schemas/actions and the existing root/native/EVM signing path. Private documents must be decrypted/opened before the review confirmation is available; no grant policy bypass. DAO/account changes clear review state and ignore old responses.

## Verification and delivery

Compile current binaries using pinned CDT 4.1.1 `-O=s`. Test real compiled WASM authorization, exact-version adoption, replay, one constitution, immutable approval mode, stale revision/policy/source, cancellation, expiry, DAO isolation, private envelopes and reference/retention behavior. Exercise native permission dispatch, persistence across replacement, RAM deltas and action CPU on a disposable chain. Verify API pagination and fail-closed capability gating, browser administrator/member workflows and narrow-screen accessibility.

Regenerate public SDK/reference docs and explicit new release pins; preserve historical fixture flags/hashes. Publish reviewable development artifacts and commit/push `dev`. Do not upgrade live contracts, catalogue pins or permissions implicitly. Report actual checks and remaining live activation requirements. This feature does not interpret written constitutions into runtime roles or treasury rules.

## Inline builder check

Reviewed against current source: Decide already owns ballots, policy snapshots, exact-version agreement patterns and module authorization; core document sources permit four tables (this adds `docchanges` alongside elections/terms). RAM family coverage needs a corresponding core header change and new compiled core pin. Private content cannot be accepted from a numeric version alone. The implementation must show the adopted content, preserve old acknowledgement records and gate unsupported deployments. No material policy questions remain after the user's approval-mode selection.
