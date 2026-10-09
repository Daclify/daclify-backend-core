# Development branch integration audit

Date: 9 October 2026. Scope: core, modules, frontend and the landing page. Legacy repositories were not changed.

The audit fetched each origin, compared every local and fetched remote branch head with `dev`, and inspected all 41 registered worktree checkouts for tracked and untracked changes. All worktrees were clean. Ignored environment files, keys, fixtures and generated artifacts are not missing source commits and were not copied into Git.

| Repository | Main baseline | Local feature branches checked | Finding |
| --- | --- | --- | --- |
| Core | `8cc318ae346f8982a671e743cb8ea6014096f73d` | 17 | One missing planning commit: `a29511d4dde82f69fdf342f1cfb6632a50fb4628`. All other heads were already ancestors. |
| Modules | `b02243221f4ccc3ce3c01e0c13f930f1d9aa52be` | 10 | All heads already included. |
| Frontend | `06a43ee1e8c44d877a79d691f9ab5afe4cee77ad` | 12 | All heads already included, including CIQ visual alignment. |
| Landing page | `295ba92f6cf45abc1a63aed337df945a3f580c5c` | 3 | All heads already included. |

Core's existing remote `dev` at `dc229ab` was already an ancestor of the current main baseline. The missing governance-hardening branch was merged into core `dev` without conflicts. It adds five proposed implementation documents and their index entry; it implements no new governance behavior. Its original 0.7 source revisions remain a dated planning baseline, not replacements for current 0.8 work.

All four current checkouts now use `dev`. Repository instructions record dev-first development and require a new explicit request before updating `main`. Older branches and worktrees remain intact; branch deletion was not requested.

This is a source integration audit, not production release qualification. No runtime, contract, database or provider configuration was changed. The Netlify guide documents a manual testnet deployment; no Netlify project, DNS record or hosted API was provisioned by this work.

## Verification

- `git merge-base --is-ancestor` succeeded for every local and fetched remote branch head against its repository's `dev` after integration.
- `git diff --check` passed in all four repositories. Local file links passed an existence check in the eight changed/merged deployment and planning documents.
- Core `npm run verify` passed lint, TypeScript, generated-document checks and 558 tests across 97 files. Its manifest still reports publication refused and qualification false. Core `npm run build` passed.
- Modules `npm run verify` passed lint, TypeScript, generated-document checks and 144 tests across 27 files. Its build and formatting checks passed.
- Frontend `npm run verify` passed lint, Vue/TypeScript checks and all 128 unit tests across 30 files. Its build and formatting checks passed.
- Core `npm run format:check` failed on six existing evidence JSON files and `tests/native/archive-preview.test.ts`. All seven files are byte-identical to `main`; the failures were reproduced by checking those main-branch bytes. They were left unchanged by this branch/documentation task. This is not an all-green formatting result.
- Database/native/browser/provider suites were not rerun for these instructions and planning-document changes. Hosted Netlify/DNS/API behavior remains untested.
