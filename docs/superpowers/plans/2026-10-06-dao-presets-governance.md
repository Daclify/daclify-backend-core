# DAO presets, governed Works funding and guarded agents

> Execute inline with superpowers:executing-plans. No delegation. Work only in the three sibling daclify-dao-presets worktrees on codex/dao-presets-governance. Use only an owned disposable native test chain; do not alter another session's chain, deploy to production or merge main.

**Goal:** Introduce versioned purpose presets, configurable contract-enforced ballot rules, vote-authorised Works funding, and agent membership with scoped signing credentials and human emergency controls.

**Architecture:** Keep the existing three repositories and runtime. Core owns the canonical preset/configuration schemas and new additive policy, participant, credential and budget tables. Modules reuse those public records; Decide executes only a pinned Works funding proposal. Frontend uses released/generated types and existing components.

**Tech stack:** Antelope C++, VERT compiled-WASM checks, existing TypeScript/Zod/Fastify, Vue and Playwright. No new dependencies or model-provider service.

## Isolation and baseline

- Core base: f6012cdca7f090fe9de92ac57267f4b1f44d0fdf.
- Modules base: 680c3190d6cf487f339cf21f38cceaaeafc23e2b.
- Frontend base: 90de8bd2db1b1f8b1e85bfc83a5cb236187686ab.
- Original core and frontend have unrelated uncommitted marketplace changes. Do not copy or alter them. Likely merge overlaps: runtime records/actions, native-chain, API server/client and generated SDK/docs.
- Use Node /Users/seth/.nvm/versions/node/v24.21.0/bin and the existing pinned Docker compiler image. Build artifacts are local to these worktrees.

## Bounded policies

Purpose is descriptive and independent from participant mode, governance asset, privacy and deployment. Presets are community, NGO/grants, gaming guild, team and custom. Preserve metadata schema 1 readers and use an explicit new schema for preset provenance; never infer authority from a category.

A DAO policy stores exact ballot weight/duration/quorum/approval, a configured Decide account, whether Works acceptance requires a ballot, per-obligation and per-UTC-day commitment limits, and an optional native guardian account. Policy revision is pinned by executable proposals. Policy edits require administrator authority and no active ballots; participant mode and guardian identity cannot be silently replaced. Existing DAO/member/ballot rows retain their binary layouts.

Participants are approved humans or declared agents. Separate signing keys do not prove independence or AI operation. Agent-only creation enrols a supplied agent public identity, not the sponsoring human account. Guardian authority is separate from voting membership and does not grant content keys. Operator labels are declarations, not identity proofs.

Scoped credentials share the member nonce and domain checks, expire, can be revoked, and cannot authorise root administration or further credentials. Root credentials remain authoritative and their compromise is explicitly disclosed. Guardian recovery can replace an agent signing key and consequently impersonate that identity; it is disclosed, not described as a trustless recovery guarantee.

A guardian pause lasts at most 24 hours per instruction and can be renewed explicitly. It blocks new commitments, obligation approval/payment and agent instructions. It does not erase existing obligations or stop member withdrawals of already-assigned claims/stake. Guardian revocation/recovery targets agents only.

Decide execution supports one binary vote bound to an immutable Works project/milestone commitment, DAO/runtime/module identity, policy revision and execution deadline. No arbitrary contract-call executor. Reject changed or already funded projects, failed/pending votes, stale policies, module replacements, expired execution and retries that would duplicate reservations. Works direct administrator acceptance is disabled where governed funding is selected.

## Tasks and executable verification

- [x] Bootstrap isolated artifacts and run baseline core/module/frontend unit suites. Record existing failures separately.
- [x] Add canonical preset, metadata and governance schemas in protocol/dao.ts; adapt base.ts, api.ts, routes.ts. Regression cases: old metadata remains readable, unknown versions/configurations fail, participant mode does not determine purpose, bounded amounts use integer strings. Run npm test -- tests/dao-presets.test.ts.
- [x] Add contracts/common/governance.hpp records and runtime actions without modifying old table layouts. Use tests/guarded-agents.test.ts for policy and credential regressions. Exercise guardian isolation, replay/expiry, scoped-key bypasses, wrong DAO, root/credential collisions, revoked credentials, admission, budget limits, pause and preserved obligations. Build with npm run build:contracts and regenerate npm run codegen before VERT checks.
- [x] Reuse module records for Works commitments; add Decide openwork/execute and Works govaccept. Add tests/governed-works.test.ts first, run npm test -- tests/governed-works.test.ts after recompiling modules and staging this branch runtime. Verify failed quorum, cancelled projects, policy bounds, expiry, once-only execution, direct acceptance rejection and atomic rollback when a later milestone exceeds its cap.
- [x] Wire validated preset creation, module installation, summaries and governance state through services/api/src/native-chain.ts/server.ts and public SDK helpers. No private producer imports. API creation is atomic and refuses missing required deployments. Test encoded API transactions against the isolated native RPC, not a simulated provider.
- [x] Implement preset creation, purpose filters/dashboard text, governance/agent controls and bounded Works funding UI in the existing frontend. Use published schemas and generated action encoders. Add browser regressions for presets, agent identity inputs, authority disclosure and configuration rendering.
- [x] Generate references and add version-aware help for presets, policy, agents and funding. Include a provider-neutral programmatic signing example and migration/merge notes.
- [x] Run core and modules lint/typecheck/docs:check/full unit tests; frontend lint/typecheck/unit/build/browser tests against isolated fixtures. Review final diff and prepare separate repository branch commits. Do not call mocks/emulator evidence native-runtime evidence. Do not push, merge main or deploy to production.

## Scope exclusions

No game engine, NFT oracle, donor compliance system, arbitrary executor, elections/delegation framework, new token economy, secret votes or LLM hosting service. Basic presets remain free; existing billing never changes governance authority.

## Evidence

Executed 2026-10-06 using Node 24.21.0 and the pinned daclify-v2-toolchain:4.1.1-spring1.2.2 image. Source-only bootstrap and the --contracts bootstrap both ran successfully. The final source-only bootstrap refreshed the public packages and all three lockfiles after guide generation; no packages were published.

Baseline: core had 286 passing tests and one failure because this new worktree lacked native network metadata. Starting the dedicated fixture supplied real metadata; no chain response was fabricated. Baseline modules had 51 passing tests and frontend had 53. Repository-wide formatting also exposed two existing core test-format differences; unrelated source was left unchanged.

Final checks:

| Checkout | Command | Observed result |
| --- | --- | --- |
| Core | npm run verify | Lint, typecheck, generated-doc check; 315 unit tests passed in 40 files. Release publication remained refused and qualified=false. |
| Modules | npm run verify | Lint, typecheck, generated-doc check; 60 compiled-WASM tests passed in 8 files. |
| Frontend | npm run verify | Lint, Vue typecheck; 53 unit tests passed in 13 files. |
| Frontend | npm run build | Production bundle built successfully. |
| Core | npm run test:integration with the owned 16432 PostgreSQL database | 62 tests passed in 9 files. |
| Core | npm run test:native -- tests/native/dao-presets.test.ts | 2 actual native/API flows passed, including standalone examples/agent-publish.ts over HTTP, scoped signatures/replay, agent-only membership, governed funding and guardian revocation/recovery. |
| Frontend | npx playwright test --config playwright.presets.config.ts | 3 HTTP-fixture cases in desktop and mobile projects: 6 passed. |

Two binary fixture tests encode baseline DAO/member values using the new SDK and compare their bytes with fixtures recorded from the original committed SDK. That evidence does not qualify a production migration. Review found a preset-provenance erasure path through metadata changes; its regression failed before the contract guard and passed after it. Root/scoped-key collisions and clearing native authentication on guardian recovery have dedicated regression checks.

The native fixture is daclify-dao-presets-native at 127.0.0.1:19888; PostgreSQL is daclify-dao-presets-postgres at 127.0.0.1:16432, database daclify_presets_test. Synthetic fixture keys stay in ignored local files. The browser fixture uses 5278 and never reuses a running server. Other agents' main worktrees, native chain and database are untouched.

Not run here: the complete existing native/browser/provider suites, live Google/Telegram/Pinata/OpenBao qualification, production permission deployment or a production migration. Guardian signing is externally prepared rather than wallet-integrated. No LLM runner or game integration was added. Strict 0.1 HTTP clients need a coordinated 0.2 upgrade. See docs/dao-presets.md for authority, limits and merge instructions; resolve source conflicts and regenerate public artifacts before integrating the concurrent branches.
