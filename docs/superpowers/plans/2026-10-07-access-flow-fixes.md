# Access-flow corrections and comparative module research

User approved all findings in the 2026-10-07 access review and requested continuous implementation while away. Work is isolated in three sibling `daclify-access-fixes` worktrees on `codex/access-flow-fixes`, based on the reviewed `codex/platform-fees-status` heads. No delegation, production deployment, real payments or changes to other fixtures.

## Acceptance and execution ledger

- [x] Reproduce and regress DAO/deployment/account isolation, late responses and private draft clearing. Key workspace panels by full domain and identity; invalidate outstanding reads/decryption on switch, lock and unmount.
- [x] Regress concurrent email/passkey challenge consumption against PostgreSQL. Fix atomic consumption, bounded email guessing, caller-scoped passkey limits and explicit production environment selection using additive migrations and existing limits.
- [x] Validate deterministic creation prerequisites before a payable order: native guardian, asset integer bounds and configured token identity. Preserve immutable terms, once-only execution and paid recovery. Return owner-only stored setup and truthful expiry/execution states; review it on resume.
- [x] Bound shared module queries to the target DAO with existing native indices and paged reads, including related votes/milestones/payroll entries. Prevent unrelated rows and disabled modules blocking a workspace; provide pagination for actual per-DAO limits and directory reads.
- [x] Align effective action permissions with active membership, admin-or-reviewer and installed action grants; preserve inactive exits. Correct payroll pause wording without changing approved payment rights.
- [x] Move admission to Members; export only public join identity; clarify admission, roles and document access. Preserve destination through account sign-in/unlock. Simplify visitor/locked views, member/document selection and relevant module navigation.
- [x] Consume producer-owned response schemas, map safe chain errors, and make Status capabilities and independent-deployment limitations accurate.
- [x] Package coordinated development artifacts, update generated documentation and compatibility/release records; run applicable unit, compiled-WASM, PostgreSQL, native and browser checks, review diffs and commit verified changes.
- [x] Research Pomelo, EOS Market, Eden and Hypha from primary documentation/source at recorded commits. Inspect Hypha cards. Deliver proposals with identity/accounting/privacy/maintenance/licensing constraints and prioritized acceptance criteria; do not implement speculative new modules.

## Verification approach

Use existing Vitest, VERT, PostgreSQL and Playwright facilities. Each substantive bug has a red-before-green regression. Use synthetic accounts/tokens and a dedicated database ending `_test`; existing preview and other agents' fixtures stay intact. Store a final evidence report with actual command results, skipped/unrun checks and remaining release gates. External code is read only, never executed. Provider mocks do not establish live qualification.

Verified completion is recorded in [access-fixes evidence](../../evidence/2026-10-07-access-fixes.md) and the [development manifest](../../releases/development-2026-10-07-0.4.0-alpha.1.json). Packages are local, unpublished and unqualified for production. The source commits are pinned before this documentation-only manifest commit.
