# DAO claim-link implementation and qualification

13 October 2026. Development/testnet work; production qualification remains held.

A Daclify governing-DAO executive can save a shared human/mixed setup and issue a seven-day bearer invitation. The first eligible authenticated confirmation reserves it; preview and sign-in allocate nothing. Only the claimant joins, as member, administrator and native executive. Existing public identities can claim with their keys locked. New-account entry preserves the fragment through a temporary tab checkpoint without putting it in provider redirect queries.

The native change is a trailing optional `createpaid` binary extension. It adds no stored contract field/index/table and uses the existing six service links. Membership, governance and the sole executive office commit atomically. Migration 050 binds immutable SQL drafts to stable native receipt references; response loss, SQL restore, expiry and issuer erasure cannot give a reserved DAO to another person. Cleanup is bounded to five rows; completed descriptive data and hashes expire while minimum reservation associations remain.

The cohort is core20/modules28/frontend27/MCP11. Original module bytecode is unchanged. Earlier local development archives (core19/modules26/27/MCP10) were preserved and are not selected as the tested active cohort. The corrected module28 range explicitly accepts core19/20 and rejects21. Previous public mini-app/MCP download URLs are retained through verified, bounded archive directories.

## Verified behavior

- Founder/schema/fee/preflight targeted suite: 42 tests across six files; real native founder: one test, with unchanged permissions/balances and rejected general appointment by the service.
- PostgreSQL/API: draft authority, concurrency, immutable setup/payment method, lost native response, restored reservation, expiry/revoke, erasure and reconnect regressions. Exact paired account-control proofs expand only to issuance/revocation in addition to existing hosted consent.
- Native/SQL/HTTP claim journey: four tests prove first-confirmation ownership, actual sole executive readback, unchanged governing roster/authorities, response-loss recovery, proof/CSRF and preview abuse bounds. A newly installed office waits for its publishing block before eligibility qualification.
- Native upgrade/rollback test: preserved core18 binary reproduced with its original pinned CDT4.1.1 `-O=s` flags and exact hash; existing DAO rows, authorities and a pending old receipt survive upgrade, claimed creation, rollback and forward upgrade.
- Native permission/ownership suites: 86 tests in eight files; financial/cross-DAO workflow suite: 41 tests. An initial loaded run exceeded native transaction CPU in fixture preparation and was rerun successfully without the compiler/browser load. The legacy fixed-container `dao-presets` harness was not qualified; current VERT presets, portable native founder and actual browser creation cover this change.
- Frontend: 348 tests in 61 files plus strict Vue/TypeScript and lint checks. The final desktop/mobile browser creation/resume/claim run passed all ten cases. An earlier desktop native request refused under competing load, passed on isolated retry, and then passed in the complete final run. Virtual CTAP2 passkeys exercise real browser/server verification; physical hardware and live social providers are separate qualification.
- Modules: full strict/generated/contract suite 215/33. MCP11: types/build and 12/7 tests. MCP archive integrity/retention regression: RED missing lookup, then two GREEN tests, including duplicate/over-limit/corrupt archives.
- OpenBao: isolated TLS snapshot/restore and least-privilege/audit checks, then the configured live testnet wrap/unwrap round trip using a synthetic key. The prior-version report is rejected. Existing qualification expiry remains 17 October 2026; this single-host service is development-only.

## Resources and boundaries

Runtime WASM 992,572 bytes (+1,374), JSON ABI 184,083 (+592). Native founder sample CPU 4,998us and DAO/module/executive RAM 3,091 bytes; this is one loaded sample, not a latency benchmark. The testnet upgrade simulation changes only code/ABI, retains 192 rows in 71 tables, and fits existing RAM quota without purchasing resources.

No production deployment, owner/active replacement, asset transfer or real account erasure is authorized or performed. End-to-end use of an actual platform executive's live claim link remains the account owner's acceptance journey. Private document key initialization remains separate. Native delegates pinned to the old runtime hash require explicit reapproval for core-target submissions.

Detailed redacted commands, final deployment/commit references and corrected failure records are retained in [the JSON evidence](2026-10-13-dao-claim-links.json) and private release packet `/data/daclify-runtime/dao-claims-20261013`.

## Final testnet delivery

The clean-source release was deployed at 19:23 UTC on 13 October 2026. Native transaction `d7494802ada43d5261dd04948dbb0a16d21c49a4fc6996f2de869352f3ace6bf` is irreversible at block 450032539. All 192 existing rows in 71 tables, native authorities and TLOS balances were unchanged. Measured runtime RAM usage changed from 10,021,484 to 10,035,321 bytes (+13,837), within the 10,208,621-byte quota. Migration 050 is applied; live account/order counts are unchanged and no test invitation was created.

Fresh final runs passed core 1,016/169 with strict types/lint/generated checks and integration 435/50, including PostgreSQL restore and the actual Claude Code CLI. Earlier CPU/time-budget failures and fixture configuration/head-visibility failures were corrected and are retained in the JSON record. Production publication is still refused by the existing broader qualification gate.

Public verification checked the new capability, all configured contract pins, shared creation, protected/anonymous routes, OAuth discovery, deployed frontend hash and 18 active/archived download files with immutable headers and exact content hashes. The existing Daclify Testnet connected app also retrieved its authorized active membership after the native/API update. Portal creation and the published claim guide were checked at desktop/mobile widths.

The initial portal's static/layout checks missed a browser connection failure: the clean frontend build lacked its public testnet environment settings and fell back to local API routing. On 13 October the same frontend source was rebuilt with explicit `VITE_NETWORK=testnet` and `VITE_API_TESTNET=https://testnet.api.daclify.com`. Eight desktop/mobile checks verified actual network and DAO reads before publication and again against the corrected hosted build. Entry SHA-256 `04ec5fb82b59cb156f6968a10083d33c69cbeadb7202b6c11c66d5f099e54503` supersedes the initial static build. See the [frontend connection correction](https://github.com/Daclify/daclify-frontend/blob/dev/docs/evidence/2026-10-13-testnet-connection.md); native/API artifacts are unchanged.

A private database/native/frontend backup and guarded rollback are in `/data/daclify-runtime/dao-claims-20261013`. The archived alpha26 portal is not a qualified claim-order client for core20; a UI rollback needs the current SDK cohort. The guarded runtime rollback preserves current rows/reservations and leaves fulfillment paused rather than enabling an older administrator-only creation service.
