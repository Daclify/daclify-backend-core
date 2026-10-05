# Daclify V2 Evidence and Risk Register

Date: 2026-10-05. This register distinguishes observed facts, source-level findings, proposed policy, and unverified conditions. It is input to the [master plan](2026-10-05-daclify-v2-master-plan.md), not a security certification or an assertion that V2 exists.

## Source baseline

| Repository | Reviewed local revision | Relevant observation |
| --- | --- | --- |
| `daclifyfrontend` | `b72df96f2c80ef1ad6937134a6b34612a427a773` | 2025 archived demo; dummy data; application JavaScript; Quasar Webpack-era setup. |
| `daclifycore` | `168ddc14538a5251e4931b9624e239292bb92499` | Contract source from 2022; account/permission, proposal, balance, profile and document workflows. |
| `daclifymodules` | `7550b62388ae6ecff7b47dc54cae4ac03be75ec4` | Elections/payroll/hooks legacy modules. |
| `daclifyhub` | `3887a75bf9ebcf4bdab1b3624700264e8dccd174` | Legacy discovery, component/code/ABI references and deposit logic. |
| `www-landing-page` | `edb897bee6d77ce865a1f4e2e264b2ffea1bd38e` | Separate marketing repository. |
| `custom-ui-components` | `e76757387540806407f803fcfb24a10458c31358` | Separate legacy component repository. |

The six repositories were clean when the plan was started. The workspace root itself is not a Git repository. Earlier in this investigation, local heads matched remote default heads. Remote status and deployed chain code must be rechecked at execution/cutover.

## Checks actually performed during this investigation

| Check | Observed result | Limit |
| --- | --- | --- |
| Legacy frontend production build | Passed using the existing installed dependencies and Node 24.14.1. | Existing dependency installation; not a reproducible clean install, type check, live product verification or security pass. |
| Frontend dependency audit | 77 vulnerable packages reported: 13 critical, 38 high, 19 moderate, 7 low. | Included dev/build/transitive dependencies, using a temporary generated lockfile. This is not 77 demonstrated production exploits. |
| Browser review of built demo | Selected home, browsing, group, proposals, wallet and payroll views rendered; network errors and invalid progress/accessibility behavior observed. | Demo behavior, selected journeys and viewports only. No verified production treasury execution. |
| Local C++ build | Hub, elections and payroll built; core and hooks failed against installed CDT `5.0.0-dev1` with an `auto` primary-key compatibility error. | Development compiler; compilation alone does not establish runtime correctness. |
| Fresh generated ABI comparison | Hub/elections/payroll actions, structures and tables matched committed ABI. | Those three successful builds only. |
| VERT legacy Hub probes | Demonstrated wrong stored ABI hash and failure to credit a TLOS deposit while an EOS transfer was credited. | Local compiled Hub WASM and controlled token fixtures. |
| VERT native permission boundary | Payroll registration reached unimplemented `check_permission_authorization`. | Native permission safety cannot be concluded from VERT for that path. |
| Telos Works C++ build | Passed against installed CDT with explicit includes. | Old code compiled; this is not a passing old full test suite. |
| Telos Works VERT probes | Unauthorized threshold changes rejected; allocation rounding loss, zero-milestone division trap, nonempty-report claim behavior and out-of-range admin threshold acceptance demonstrated. | Claim probe seeded an approved milestone to isolate report/claim validation; it did not bypass a ballot or simulate a complete grant. |
| Telos Decide C++ build | Unchanged source failed against installed CDT because old system headers conflict on feature declarations. | Old EOSIO 1.8-era full tests were inspected, not executed. |
| `eosio.evm` interface read | Two mainnet endpoints returned `raw`, `call`, `account`, `accountstate` and related ABI declarations. Native chain ID matched configured Telos mainnet. | Read-only RPC evidence; not code-hash/security verification or a successful cross-runtime transaction. |
| User-supplied Telos service API | The Swagger page loads an OpenAPI 3.0 schema at `/v1/docs/json` with 32 documented paths for accounts, statistics, supply, contract metadata and testnet services. Read-only `get_info` and `get_abi` calls to its `/v1/chain` base returned 404. | This service API is distinct from the native-chain RPC and EVM JSON-RPC. Only the schema and read-only lookup failures were checked; no account/faucet/testnet-control route was invoked. |
| Foundation-plan example | The exact documented disposable C++ probe compiled and its VERT authorized-write/unauthorized-rejection assertions passed after correcting the decoded-value expectation. | Validates the example against installed tools; does not implement or verify V2 contracts. |
| V2 GitHub setup | Authenticated GitHub account has active Daclify organization admin membership. Created/cloned `daclify-frontend`, `daclify-backend-core` and `daclify-backend-modules`; subsequent API listing reports all three private. | Repository setup only; no application source, CI, release artifact or production deployment exists. |
| Pinata provider documentation | Official docs describe public uploads, server-issued signed upload URLs, size/type controls and a separate private network using temporary access links. | Documentation inspection, not an authenticated upload/retrieval, single-use guarantee, current account allowance or measured operating cost. |
| Planning/setup validation | Thirteen Markdown files checked for local links/fences/placeholders; 25 local links resolved, two embedded Python snippets parsed, WP01-WP19 references matched and all six legacy worktrees remained clean at their recorded heads. | Ad hoc documentation/setup checks only. No V2 application build, test suite or provider integration exists yet. [Check record](../../evidence/planning-checks-2026-10-05.json). |

Contract experiments used temporary artifacts. No contracts were deployed and no blockchain transactions were sent. The new repositories hold setup/planning work; no application dependencies were upgraded, keys rotated, data migrated or assets moved.

## Legacy findings and required response

| Finding | Evidence classification | Plan response |
| --- | --- | --- |
| Plaintext private-key literals in frontend source; sponsor key used in the transaction path and logged by legacy helper. | Source inspection. Key material is intentionally omitted here. | Identify affected deployed permissions with the account owner; use an authorized rotation/removal procedure if live. Never copy keys into V2. WP01/WP04. |
| No application TypeScript checking; no meaningful automated application suite. | Configuration/source inspection. | Strict TS, Vue template checks, generated ABI types, runtime schemas and CI in WP02. |
| Notification event predicate uses assignment; clock stop path does not clear created intervals. | Actual-source harness observations. | Typed event/state handling and lifecycle/browser regression scenarios in WP13. |
| Dynamic component loader references unavailable `httpVueLoader`. | Source inspection/browser context. | First-party typed module components; no arbitrary remote script loading. WP03/WP13. |
| Elections initialize `old_votes` from itself; maximum-vote enforcement compares against a Boolean. | Source inspection; not a demonstrated deployed exploit. | Reimplement bounded ballot selection and initialize state safely; behavioral regression tests. WP08. |
| Hub stores `codehash` in `abihash`; legacy deposit path hardcodes EOS identity. | Demonstrated in local compiled WASM. | Independent artifact hashes and validated asset references/notifications. WP03/WP07. |
| Payroll batch-add lacks the repeat-positive guard used by single-add. | Source finding; wrap/payment consequence was reasoned about, not demonstrated as a deployed exploit. | Bounded integer recurrence and single/batch validation consistency. WP10. |
| Maintainer configuration can give unilateral owner authority. | Source inspection; deployed authority unverified. | Explicit shared/independent upgrade trust models and actual permission graph verification. WP03/WP18. |
| `fileupload` does not persist the content in a table; later publication relies on transaction/block references. | Source inspection. | Durable versioned on-chain metadata/ciphertext/CID records. WP11/WP18. |
| Legacy document helper can return `found: true` with empty content after unsuccessful block scanning. | Actual-source harness observation. | Honest retrieval errors and migration gap reporting; no manufactured historic documents. WP11/WP18. |
| Selected built demo had eight accessibility rule violations and invalid `NaN` progress. | Browser/axe observation. | Explicit accessible control semantics, safe typed numeric display and real journey checks. WP13. |

Live code, permissions, current balances, unpaid obligations, and available history archives remain unknown for Daclify deployments. Old configured Animus endpoints did not resolve during parts of the investigation; this does not establish that content is irrecoverable everywhere.

## Reference systems and reuse policy

### Boid account and test patterns

Local sources reviewed: `animuslabs/boid-admin-ui`, `boidcore-ui`, `boid-worker`, `boid-bridge-ui` and related documentation. Boid-admin-ui uses WharfKit/native wallet sessions; boidcore-ui includes internal accounts and relayed signed actions. The actual VERT integration inspected was in boid-worker, including calculator fixtures. The admin UI's nominal test script does not execute a meaningful suite.

Useful reuse: account linking flow, generated ABI/SDK patterns, native/EVM wallet UI behavior, relayer workflow and VERT fixture structure. Required replacement: deterministic single-SHA password derivation, plaintext key persistence/backups, narrow wrapping nonce, omitted identity binding, permissive external action shapes and unreviewed type shortcuts. The contract implementation remains C++.

### Telos Works and Decide

Reviewed default revisions: Works `37da1445d44d86a432b0cca1a1e7f6a9699688ec`; Decide `64d3f256fb965415f718af2409129c863b6cf229`. Latest contract-source changes seen were 2022-03-24 and 2020-05-09 respectively. Both use MIT licensing; preserve applicable notices for copied code and review dependency licences.

Useful patterns: a voting service separate from funding consumers, ballot policies, committee seats, staged funding/reservation, and bounded cleanup. Required changes: internal identities, frozen eligibility/weight rules, authenticated result consumption, explicit deliverable acceptance, exact integer allocation/accounting, current C++ compatibility and durable content. Publisher-submitted light-ballot totals are not suitable for automatic fund control. Admission labelled private is not encrypted confidentiality. Delegation/ranked features in comments or roadmap are not evidence of complete implementation.

References: [Works repository](https://github.com/telosnetwork/telos-works), [Works submission workflow](https://docs.telos.net/zero/governance/works/submit-a-proposal/), [Decide repository](https://github.com/telosnetwork/telos-decide), [Decide ballots](https://github.com/telosnetwork/telos-decide/blob/master/contracts/decide/src/ballot.cpp), [Decide voters](https://github.com/telosnetwork/telos-decide/blob/master/contracts/decide/src/voter.cpp).

### Boid bridge and Telos EVM

Boid bridge source reviewed at `76fac19` (2025-03-07). Native C++ reads EVM storage and submits `raw` EVM calls; worker jobs find requests and request verification. It contains supported-token/layout/decimal assumptions that cannot define a general asset adapter. Its request-deletion test must not be generalized into proof that a payment succeeded. This investigation is not a bridge security audit.

Telos' older native/EVM bridge/example source supports the integration pattern. The newer `telos-bridge-v3` repository reviewed at `e553a9b` is a LayerZero/Stargate EVM bridge frontend; its newer maintenance date does not establish arbitrary EVM-to-Zero call support. Verify the exact native/EVM runtime and current account authorities in P0/P5.

References: [Boid bridge](https://github.com/animuslabs/boid-token-evm), [native C++ bridge implementation](https://github.com/animuslabs/boid-token-evm/blob/main/antelope-compile/src/tokenBridge.cpp), [Telos native-to-EVM example](https://github.com/telosnetwork/native-to-evm-transaction), [older token bridge](https://github.com/telosnetwork/telos-token-bridge), [Bridge v3](https://github.com/telosnetwork/telos-bridge-v3).

## Risk register

Priorities are qualitative judgments, not measured incident probabilities. A risk closes only when the named evidence exists.

| Risk | Priority | Mitigation and owner package | Closure evidence |
| --- | --- | --- | --- |
| Shared upgrade authority bypasses DAO rules | Critical | Actual permission graph, controlled upgrades, disclosed trust/exit path. WP03/WP18. | Native permission tests and reviewed deployment manifest. |
| Managed key recovery impersonates members or exposes private content | Critical | Separate custody service, scoped intent, step-up, admission policy and honest custody labels. WP04/WP12. | Lost-device/recovery/insider-boundary tests; key-provider controls reviewed. |
| Internal/EVM signed actions replay or target wrong DAO | Critical | Complete domain binding, nonwrapping nonce, expiry, revocation and canonical encoding. WP04/WP14. | Adversarial real-signature tests and independent review. |
| Treasury backing or reserved liabilities diverge | Critical | Integer conservation, actual transfer/settlement evidence and reconciliation. WP07/WP09/WP10. | Property/state-machine tests and pilot reconciliations. |
| EVM request deletion/refund mistaken for payout | Critical | Explicit durable success state and obligation binding. WP15. | Cross-runtime revert/refund/deletion/pruning tests. |
| Same tokens/identity vote more than once | High | Fixed eligibility, checkpoints/locks, stable identity and canonical bridged source. WP06/WP08/WP15. | Transfer/link/mint/bridge timing scenarios. |
| Browser/social recovery loses or leaks user-controlled keys | High | Verified vault/backup/restore UX with supported-client matrix. WP01/WP04/WP05. | Fresh-device restores and unsupported-webview fallback tests. |
| Encryption promise defeated by managed grants or metadata | High | DAO custody admission, client encryption, redacted metadata/notifications/logs. WP12. | Key-holder matrix and plaintext-leak tests. |
| IPFS content disappears or legacy content cannot be recovered | High | Pin/retrieve verification, explicit retention/backups and gap reporting. WP11/WP18. | Provider-outage/recovery/export/migration tests. |
| Emulator pass hides real permission/runtime failure | High | Mandatory native-chain and cross-runtime suites. WP02/WP15. | Actual permission/intrinsic/runtime results with no substituted verifier. |
| External-chain evidence relies on an unauthenticated root or RPC | High | Declared verification tiers and authenticated roots/finality. WP19. | Fake-root/reorg/destination-failure tests. |
| Paid-service expiry traps keys or approved funds | High | Entitlements separate from authority; manual fallback and custody exit. WP17. | Expiry/export/recovery/obligation journeys. |
| Free service resource cost is unbounded | High | Measure usage, bounded quotas and pricing evidence. WP01/WP17. | Per-DAO cost and capacity measurements. |
| Migration changes rights or fabricates history | High | Proof of control, immutable exports, reconciliation, explicit unresolved records. WP18. | Dry-run comparison and authorized cutover review. |
| Module versions or callbacks grant excess authority | High | Versioned manifests and narrow grants. WP03/WP08. | Forged callback, incompatible config and revoked capability tests. |
| Upgrades misinterpret old state, signatures or pending liabilities | High | Explicit schema/encoding versions, supported readers and resumable authorized migrations. WP02/WP03/WP18. | Old-release fixtures, interrupted migration and preserved-invariant tests. |
| UI documentation describes a different deployed module | High | Producer-owned versioned bundles, stable help topics and schema-validated examples. WP02/WP13/WP18. | Old/new deployment help journeys and release/doc hash checks. |
| Pinata ticket abuse, outages or credentials leak | High | Backend-only credentials, bounded uploads, verified completion, quota/retention/export controls. WP11. | Replay/ownership/expiry/fault tests plus real sandbox retrieval; bundle/log scans. |
| Client update steals unlocked encryption keys | High | Explicit trusted-client boundary, reviewed static/self-hosted artifacts and restricted untrusted content. WP04/WP12/WP13. | Client trust disclosure and leakage/rendering tests; no claim of browser-compromise immunity. |
| Premature multichain/marketplace architecture delays release | Medium | Small first-party catalogue and chain-specific capabilities after useful governance. Master plan. | Scope review against actual demand and dependency gates. |

## Authoritative reference links

- [Vue TypeScript support](https://vuejs.org/guide/typescript/overview.html), [Vite](https://vite.dev/guide/), [Vue Router](https://router.vuejs.org/guide/).
- [User-supplied Telos service API documentation](https://api.telos.net/v1/docs/index.html) and [discovered OpenAPI schema](https://api.telos.net/v1/docs/json).
- [VERT source and documentation](https://github.com/XPRNetwork/vert).
- [IPFS privacy and encryption](https://docs.ipfs.tech/concepts/privacy-and-encryption/), [content addressing](https://docs.ipfs.tech/concepts/content-addressing/), [pinning](https://docs.ipfs.tech/how-to/pin-files/).
- [Pinata uploads](https://docs.pinata.cloud/files/uploading-files), [signed upload API](https://docs.pinata.cloud/api-reference/endpoint/create-signed-upload-url), [private network](https://docs.pinata.cloud/files/private-ipfs).
- [Semantic Versioning specification](https://semver.org/).
- [Telegram Mini App validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
- [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).
- [WebAuthn specification](https://www.w3.org/TR/webauthn-3/).
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271), [EIP-1186](https://eips.ethereum.org/EIPS/eip-1186).

Vendor support, deployed interfaces, package versions and operating prices are time-sensitive. Reverify them in the bounded implementation package that depends on them. Preserve the distinction between a proposed policy, a source finding, a local runtime result and a deployed production guarantee.
