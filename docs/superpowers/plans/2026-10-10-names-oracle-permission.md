# Names observation permission implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Subagents are prohibited by workspace instructions.

**Goal:** Restore automatic testnet Names quotes through a dedicated observation permission.

**Architecture:** Add two compatible Names actions over existing singleton rows and a key-only child of Names active. The public SDK owns installation actions; the updater signs only observation actions with a separate key. Root governance is unchanged.

**Tech Stack:** C++, pinned CDT 4.1.1, native Spring 1.2.2, TypeScript, WharfKit, Vitest and existing Vue UI.

**Spec:** [Names observation permission](../specs/2026-10-10-names-oracle-permission-design.md).

## Global constraints

- Execute inline on dev and preserve existing keys, liabilities and native governance.
- No new dependencies, row-layout changes, token transfers or RAM purchase.
- Permission: Names@oracle, parent active, threshold 1, one dedicated key, no waits or account delegates; links only to observeprice and observefee.
- Prices: median 1..1000000000000, precision 0..18, observation <= chain time, age <=900 seconds, newer than the prior price.
- Fee observations: 0..1000000 cents, <= chain time, age <=604800 seconds, nondecreasing date, existing version-1 policy.

## Review focus

- Oracle key cannot alter minimum profit, percentage fees, bump/premium, treasury or authority.
- Older and future observations cannot silently replace valid data.
- Two-executive Names active remains effective above the oracle child; revocation takes effect immediately.
- Failed or unavailable ECB reads do not suppress a valid TLOS observation.
- API/frontend must use matching generated artifact pins after the upgrade.

### Task 1: Contract and public permission recipe

Files: contracts/names/names.cpp, sdk/names.ts, tests/names-oracle.test.ts, tests/names-sdk.test.ts, tests/native/names-oracle-permission.test.ts, generated Names ABI/schema/hash.

Interfaces: observeprice(median, quoted_precision, observed_at); observefee(card_fixed_usd_cents, observed_at); nameOraclePermissionActions(contract: string, key: string): Action[].

- [x] Write and run failing contract observation and SDK installation tests. Expected: absent observation actions/recipe fail.
- [x] Implement the two actions, validation and exact public installation recipe; compile Names and regenerate ABI/schema/hash.
- [x] Run focused unit tests and a fresh native fixture covering policy preservation, unauthorized policy/upgrade/withdrawal/auth changes, inherited executive quorum and revocation. Expected: all pass without skips.

### Task 2: Updater and compatible artifacts

Files: tools/deploy/names-rate.ts, producer/consumer version manifests and pinned lockfiles, generated documentation, operator guide.

Interfaces: consume Task 1 actions and recipe; read NAMES_RATE_PRIVATE_KEY from a separate private environment; output unsigned observation actions or confirmed irreversible receipt.

- [x] Verify old updater fails with the new restricted authority; add executable updater coverage where local fixture boundaries permit.
- [x] Use Names@oracle for observations and validate its exact authority and two links before signing; keep ECB outage behavior.
- [x] Version and package producer artifacts, update module/frontend consumer pins and generated help; run types, lint, builds, default suites and generated-doc checks.

### Task 3: Testnet rollout and evidence

Files: durable private rollback/readback snapshots, docs/evidence/2026-10-10-names-oracle-testnet-rollout.md, runtime oracle service environment.

Interfaces: consume qualified Names binary, public recipe and updater; preserve deployed native policy 2 and other accounts.

- [x] Generate a dedicated private key outside source; prepare, inspect and simulate the Names code/ABI upgrade and oracle installation with current executive authorization. Expected: resources sufficient, no asset action.
- [x] Apply under the user's testnet permission authorization, wait for irreversibility and verify exact code, links, authorities and preserved rows.
- [x] Restore the automatic timer; verify actual fresh API quotes, read-only negative permission probes and desktop/mobile UI.
- [x] Review final diff, record limitations, commit/push dev and verify remote refs and clean worktrees.
