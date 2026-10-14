# Daclify review remediation — 14 October 2026

Scope: the three accepted Daclify findings, core/frontend formatting failures and the testnet RPC outage. No contract, native authority, accounting or persisted action-format changes.

## Changes

- Bootstrap now installs the nested MCP dependencies before core compilation, refreshes its exact producer archives, builds/packs it and generates both immutable companion bundles. Contract bootstrap prepares the current contracts and all historical fixtures needed by ordinary verification. Historical flags and recorded profile hashes remain enforced. MCP `npm test` builds its subprocess fixture automatically.
- Manual backend workflows retain full Git history for historical fixtures, allow the complete bootstrap/test budget and build frontend before core manifest loading. Automatic CI remains disabled.
- Migration 051 adds the account-control expiry/id index. The existing auth worker deletes at most 500 expired intents per batch with `FOR UPDATE SKIP LOCKED`; live intents retain their original validation and consumption behavior.
- Mini Apps offers module enable/review, approvals setup and registration before connection configuration. Empty registrations open automatically; loading and failed reads have distinct states. Existing app/grant/receipt actions and draft state are retained.
- Formatting repairs were compared directly with Prettier output from baseline source, establishing that those files contain no semantic changes.

The immutable development cohort is core/SDK `0.15.0-alpha.21`, modules `0.10.0-alpha.29`, frontend `0.15.0-alpha.32`, MCP `0.1.0-alpha.12`. Current contract pins and binaries are unchanged. Earlier companion download cohorts remain verified and available.

## Verification

Evidence logs: `/data/daclify-runtime/review-fixes-20261014`.

| Check | Result |
| --- | --- |
| Full-history source-only `node tools/bootstrap.ts --contracts` with pinned local CDT 4.1.1, no prior installs/build artifacts | Passed |
| Workspace and source-only core `npm run verify` | 1,016 passed; 169 files; manifest loads and publication remains refused/unqualified |
| Workspace and source-only modules `npm run verify` | 215 passed; 33 files |
| Core/modules formatting and build | Passed |
| Frontend verify, formatting and build | 364 unit tests passed; 62 files; formatting/build passed |
| Mini Apps / Connected apps desktop/mobile browser checks | 40 passed, including loading, retry, incompatible/unverified module, empty registration, locked signer and Axe checks |
| PostgreSQL proof cleanup and related authentication/store checks | 41 passed |
| Actual schema upgrade and account erasure | 27 passed; temporary CREATEDB test role/database removed |
| Nested MCP tests/typecheck | 12 passed; source-only tests also pass after deleting `dist` |
| Current/historical core and module WASM; core/MCP archives and companion manifests | Byte-identical between source-only and workspace builds |

The new proof-cleanup and setup-flow regressions failed before their fixes. Two existing pinned-RPC/version assertions were updated after the full run identified their stale expectations. Upgrade suites initially refused the restricted API test role's database creation; a separate disposable test role was used, preserving live API privileges.

## Testnet RPC recovery

The configured Caleos endpoint timed out. Telos documents `https://testnet.telos.net` for its Zero testnet in its [official FAQ](https://docs.telos.net/users/knowledge-base/faqs/). Actual reads confirmed chain `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`, current runtime/raw ABI and Names pins, plus unchanged system/token code and raw ABI pins. Only testnet configuration and current testnet tools were changed.

The development API was restarted with the validated endpoint. A separate updater snapshot passed its unsigned plan; the existing oracle service then completed its ordinary observation irreversibly (transaction `f911bf6563a1f09f9f27fe9f4647e9e28a752d32a9616b9bbd4a4013e4fd67a9`, block 450132415). Public network discovery and a synthetic Names quote now return 200. The API had 61 expired proof intents before cleanup deployment; the deployed maintenance worker removed all 61 and migration 051 is recorded.

## Limits

Docker execution, hosted GitHub CI, full native/provider qualification and new production deployment were not performed. Browser setup regressions use API fixtures; PostgreSQL/cryptographic proof checks and live RPC/Names reads are separate evidence. This development fix does not qualify a mainnet release. Deployment receipts and final commit IDs are recorded in the runtime delivery ledger.


## Completed dev delivery

Core `cf4900a`, modules `a34137a` and frontend `a1ae501` were merged and pushed to `dev`. API21, frontend32 and MCP12 are live from `/data/daclify-runtime/releases/20261014-review-fixes`; the Names updater uses its separately verified RPC snapshot. Public health/network/Names, active mini-app and MCP manifests and the previous mini-app20 manifest return 200. Desktop and mobile live Mini Apps checks have no page errors or overflow. Public HTML and the new setup asset match the published hashes.

The first API rollout correctly rejected the old version-bound recovery report. The previous API was restored while core21 passed fresh destroyed-source TLS/raft recovery, four least-privilege refusals, audit redaction and a configured live TLS roundtrip with a synthetic key. The new report preserves existing policies/keys, wallet/passkey qualification limits and the original 17 October expiry. The corrected rollout is active and healthy. Runtime delivery logs retain the initial refusal and corrective checks.
