# Daclify review findings remediation

> **For agentic workers:** Use superpowers:executing-plans inline. Sub-agent delegation is not authorized in this workspace.

**Goal:** Fix the three Daclify findings accepted in chat, restore formatting checks, and resolve or precisely identify the testnet RPC outage.

**Architecture:** Keep the existing bootstrap, authentication maintenance worker, and Vue signer components. Generate required companion artifacts after producer packages exist; clean expired account-control intents in bounded batches; present module readiness and registration before app configuration. Preserve signing policy, immutable release validation, historical binary hashes and existing app/grant actions.

**Tech Stack:** Node 24.21, TypeScript, PostgreSQL 17, Vue 3, Vitest, Playwright, pinned Antelope CDT 4.1.1.

**Spec:** The user's accepted three findings and “fix them all” instruction; detailed audit at `/data/daclify-runtime/all-repos-review-20261014/findings.json`.

## Global constraints

- Daclify repositories only; no Garden Care work.
- Work inline on isolated feature branches from current `dev`; preserve other worktrees and deployed snapshots.
- Preserve public SDK/contract interfaces, authentication policy and release refusal checks.
- Current contracts use pinned CDT `-O=s`; historical fixtures retain their recorded flags and exact hashes.
- No production deployment, authority change, asset transfer or new dependency.

## Review focus

- Verification must work without pre-existing companion archives or historical profile fixtures.
- Compiler selection must support the existing local pinned compiler and Docker CI.
- Expired cleanup must retain live intents, respect batch limits and tolerate concurrent workers.
- App setup must distinguish loading/failure from a disabled or unverified module and preserve existing grants.
- A replacement RPC must match the configured chain and deployed code pins before use.

## Tasks

### Task 1: Reproducible verification prerequisites

- [x] Reproduce missing artifacts and add a clean setup check that exercises actual bootstrap output.
- [x] Extend bootstrap to build/package the nested MCP package and generate both companion bundles using final producer archives.
- [x] Build the pinned historical profile fixture in contract bootstrap; support the same compiler/Docker selection as current contracts.
- [x] Make nested MCP tests build their subprocess fixture automatically and fix manual CI setup where necessary.
- [x] Verify from an isolated source-only workspace and document the commands.

### Task 2: Expired account-control cleanup

- [x] Add a PostgreSQL regression covering bounded expired/consumed batches, surviving live intents and invalid limits; observe failure first.
- [x] Add an additive expiry index migration and a bounded cleanup function to the existing maintenance worker.
- [x] Run integration tests on an owned disposable `_test` database and relevant unit checks.

### Task 3: Mini Apps registration guidance

- [x] Add browser regressions for absent/unverified Activity, no registered apps, a locked signer, and existing app configuration; observe failure first.
- [x] Put Connected apps/setup first, show module readiness/loading/retry, expose registration for ready admins and reuse the existing compact ActionSigner.
- [x] Preserve member/grant/receipt behavior, context guards and unsaved form state.
- [x] Run desktop/mobile browser checks and accessibility checks; update the user guide.

### Task 4: Formatting, RPC and final verification

- [x] Format the files identified by the audit, without semantic edits.
- [x] Diagnose the RPC timeout; validate a documented alternative using chain identity, deployed hashes and real API reads before any testnet configuration change.
- [x] Run core/modules/frontend verify, builds, formatting, MCP tests, affected integration/browser checks and website checks as applicable.
- [x] Review the complete diffs inline, record evidence and integrate the authorized development work.

## Execution record

Baseline: core 994 passed / 22 missing-artifact failures; modules 215 passed; frontend 364 unit and 16 Mini Apps browser checks passed; MCP 12 passed after manual build; core/frontend formatting failed in 29/2 files. Public testnet RPC `testnet.telos.caleos.io` now times out, with both network discovery and Names quote returning `CHAIN_UNAVAILABLE`.

Ruling: Use feature branches in the existing checkouts, honoring the workspace's inline-work preference and retaining installed tooling and sibling dependency paths. The accepted report already supplies the small-change description; no additional design approval is needed.

Progress: core proof cleanup passed 12 focused PostgreSQL checks, plus 41 related authentication/store checks and 27 actual account-erasure/schema-upgrade checks. Upgrade tests used a separate temporary CREATEDB test role after the restricted API role correctly refused database creation. Frontend verify passed all 364 unit tests; formatting/build and 24 connection browser checks passed. The original Mini Apps design journey is being rerun. Formatting-only sources were checked byte-for-byte against baseline Prettier output. Live network discovery and Names quotes return 200 after verified RPC replacement and successful routine oracle observation. Clean-source bootstrap exposed and now addresses MCP dependencies needed before core compilation.

Final pre-delivery verification: workspace core verify1,016/169 files, modules verify215/33 files, all three formatting/build checks passed. Source-only core/module verify also passed; all current/historical WASM and core/MCP tar archives plus companion manifests match byte-for-byte. New development artifacts are local/vendored only; full release publication remains refused. Inline final review completed; no C++ binaries, native authority or action encodings changed. Dev integration/deployment remains the last task.

Delivered: core cf4900a, modules a34137a, frontend a1ae501 merged/pushed to dev. New API21/frontend32/MCP12 served from separate dated snapshots; old mini-app download20 remains accessible. An initially stale recovery20 qualification correctly refused API startup; the old API was restored while fresh isolated TLS/raft and configured live synthetic wrap/unwrap checks qualified core21. Recovery policies/keys and the original 17 October expiry are preserved. Migration051 is live and the worker removed all61 expired intents; live network/Names/downloads return200. Desktop/mobile live browser has no page errors or overflow; public index/setup asset hashes match the delivered build.
