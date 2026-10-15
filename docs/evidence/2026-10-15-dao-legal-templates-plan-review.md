# Legal template plan compatibility with latest dev

Date: 2026-10-15. Scope: revalidate the proposed legal-template design/implementation plan against all three fetched development branches. This is a plan review, not implementation of templates, a full security audit of recovery or a fresh live deployment qualification. Work and review were inline.

## Reviewed source and release cohort

Each `git fetch origin dev` succeeded. At review start, local `dev` matched `origin/dev` and the working tree/index were clean in each repository.

| Repository | Previous planning baseline | Fetched head | Current package |
| --- | --- | --- | --- |
| Core | `cb99cc3`; plan added in `060f5fd` | `34beb8705da7fa2f295666da927eaba9f38ba411` | `0.15.0-alpha.30` |
| Modules | `d346582` | `cec1e3fe788fc89d49195fa5507771d9e8692dcb` | `0.10.0-alpha.40` |
| Frontend | `911153f` | `f1811a1ffdfc47064450b6814bb105c843206b00` | `0.15.0-alpha.41` |

Core's current application implementation is `fcff2097e9b8fc52a2da28ed04cfdddc626bbecc`; `34beb87` records its testnet deployment. The source delta comprises 62 core files, 14 module files and 15 frontend files, principally trusted-contact recovery, matching dependencies/binary hashes/help and backward archive readers. The [recovery rollout report](2026-10-15-trusted-contact-recovery-testnet.md) records the existing deployment; those live checks were not rerun for this review.

Frontend vendor archives are byte-identical to current producer artifacts:

| Artifact | SHA-256 |
| --- | --- |
| `daclify-core-protocol-0.15.0-alpha.30.tgz` | `9101d98d8c2b1c06096df09ba117010a51665eaac006cc32a8b98a514eb9f198` |
| `daclify-modules-0.10.0-alpha.40.tgz` | `63ed4584b36fc79ca05fbda2fef9d01d6a813c9c60a8aff2bd6c5a40a6ce2eeb` |

The unchanged template ZIP checksum remains `9408ad036cd86566e4eb14384c8f5f3c08c269c39c9905e65ef27cd255736b41`.

## Compatibility findings and plan adjustments

The core approach and eight-task sequence remain valid. No additional contract, service, table, migration or dependency is needed for templates. The following requirements were made explicit in the [design](../superpowers/specs/2026-10-15-dao-legal-templates-design.md) and [implementation plan](../superpowers/plans/2026-10-15-dao-legal-templates.md):

1. **Replace stale release assumptions.** Recovery/package work that was uncommitted during initial planning is now committed. Start from the matching alpha.30/alpha.40/alpha.41 cohort, preserve migration 056 and use current ABI/code pins. Current runtime rebuilds require the established CDT 4.1.1 `-O=s` plus Binaryen 108 `--mvp-features -Oz` recipe. Templates require no binary rebuild; historical fixture recipes/hashes remain unchanged.
2. **Show the complete private-content trust boundary.** DAO recovery permission and member opt-in are separate facts. When eligible epoch keys were backed up, two of three contacts can reconstruct them independently of the account waiting period. An enabled setting does not prove that a specific document epoch was backed up; later revocation cannot erase copies. Read the existing scoped recovery-state endpoint for the summary, avoid scanning packet history or initiating enrollment/backup, and retain unknown/unsupported states.
3. **Invalidate reviews on key replacement even when IDs stay the same.** Recovery can retain account UUID/member ID while changing signing/encryption keys and wallet bindings. Editor/preview/signer guards must include current public keys and epoch, reject old asynchronous results and re-read current membership/signers. Service database loss can change the service UUID without changing the native member; authoritative published records remain the reconciliation anchor, not an old upload ticket.
4. **Reuse recovered-grant handling; preserve historical access limits.** `session.ts` now tries ordinary epoch grants and, where supported/authorized, additional recovered grants. The existing file encrypt/decrypt helpers already use that logic. Template code must not duplicate it, overwrite original grants, assume a successful account claim recovered old document keys, or treat fresh future access as permission to read an old agreement. Extend the planned tests for each case.
5. **Preserve earlier document/archive reads.** All rebuilt module hash pins changed, while archive readers explicitly retain the previous release identities. Test old supported archives with their original source hashes; unknown identities must still be refused. New help releases cannot silently rewrite historical identities or require another native upgrade.

## Interfaces checked

Diffs against the original planning baselines confirm these frontend files are unchanged: `ContentPanel.vue`, `FilePanel.vue`, `GoverningDocumentsPanel.vue`, `ModulesPanel.vue`, `WorkspaceOverview.vue`, `content/files.ts`, `content/document-review.ts`, `auth/action-signer.ts`, `auth/destination.ts`.

Core `protocol/storage.ts`, `protocol/content.ts` and `contracts/common/content.hpp` are unchanged. A structured comparison of old/current generated runtime ABIs confirms unchanged table declarations and row layouts for `docclocks`, `docheads`, `docrefs`, `docscan`, `docsrcs`, `docstate`, `documents`, `epochs`, `keygrants`, `members`; action declarations/argument layouts for `putdoc`, `putjson`, `commitepoch`, `grantkey` also match. This is layout compatibility, not a claim that all recovery-related authorization behavior is unchanged.

Modules `contracts/decide/decide.cpp`, `contracts/works/works.cpp`, `protocol/api.ts` are unchanged. Register/adopt/accept and Works exact-version references remain the appropriate integration points. Their current binary hashes must still be respected.

The recovery-aware session helper, recovery state/grant schemas and callers, account replacement/claim behavior, privacy guidance, build recipe, new migration, archive identity selection and release artifacts were reviewed for their effect on the plan. No application code was changed by this review.

## Checks run for this review

All commands ran on the fetched/current committed source with Node `v24.21.0`, npm `11.19.0`.

| Repository/check | Actual result |
| --- | --- |
| Frontend `npm run typecheck` | Passed: Vue and TypeScript, exit 0. |
| Frontend `npm test -- tests/unit/files.test.ts tests/unit/document-review.test.ts tests/unit/governing-documents.test.ts tests/unit/help-format.test.ts tests/unit/contact-recovery.test.ts tests/unit/provider-session.test.ts tests/unit/documentation.test.ts` | 46 passed in 7 files. |
| Modules `npm test -- tests/governing-documents.test.ts tests/document-archive.test.ts tests/archive-restore.test.ts tests/quick-ballot-archive.test.ts tests/documentation.test.ts` | 28 passed in 5 files. |
| Core `npm test -- tests/governing-document-reads.test.ts tests/contact-recovery-routes.test.ts tests/contact-recovery-crypto.test.ts` | 14 passed in 3 files. |
| Package byte/hash comparisons, selected ABI layout comparisons and unchanged-interface diffs | Passed. |

Total: **88 focused tests passed**, plus frontend typechecking. These are focused local Vitest checks; they do not establish a newly joined browser/API/PostgreSQL/native recovery flow. Previously recorded deployment results are not included in this total.

## Remaining execution boundary

All template implementation tasks remain unchecked. The added recovery/privacy tests are requirements for later execution, not tests claimed to exist already. No application build, browser/native/provider ceremony or live deployment was performed by this review. In particular, no new 48-hour recovery ceremony, original-database-loss drill, wallet requalification or legal assessment was attempted. Existing source evidence records their own limitations separately.

Verdict: the plan applies to latest dev **with the documented recovery/release amendments**. Proceed with the same implementation scope when execution is requested; do not roll back recovery or automatically change a DAO's document recovery policy.
