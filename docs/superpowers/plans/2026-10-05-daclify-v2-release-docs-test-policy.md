# Daclify V2 Versioning, Product Documentation, Storage and Test Policy

Date: 2026-10-05. Status: implementation requirements; implementation is in progress and the complete release system is not yet verified. The user selected three private repositories, Pinata for pinning, extensive meaningful tests, and one continuous implementation session followed by their review of the complete code. Current evidence and open limitations are tracked in `docs/evidence/`.

This policy applies to all [work packages](2026-10-05-daclify-v2-work-packages.md). WP02 establishes version/release tooling and test infrastructure; WP11 implements Pinata; WP13 delivers documentation in the UI; WP18 verifies and publishes the complete release. Each other package supplies its own compatibility rules, documentation and acceptance evidence.

## Repository and version boundaries

The private repositories are [frontend](https://github.com/Daclify/daclify-frontend), [backend core](https://github.com/Daclify/daclify-backend-core), and [backend modules](https://github.com/Daclify/daclify-backend-modules). The core repository owns this programme plan and the cross-repository release manifest. Frontend and modules link to that source instead of maintaining separate copies of the architecture.

Use three mechanisms rather than one overloaded version number:

| Mechanism | Purpose | Rules |
| --- | --- | --- |
| Semantic code/package versions | Identify frontend, core, modules and their published protocol/SDK artifacts. | Immutable versions and tags. Patch for compatible fixes, minor for compatible additions, major for incompatible public behavior. During `0.x`, incompatible changes advance the minor version and are explicitly labelled. |
| Explicit data/interface versions | Interpret persisted records, API families, signed instructions, module configuration, document metadata and encryption envelopes. | Versions belong in their canonical schema. Code version alone cannot select a decoder or authorize a signature. A format change needs a reader/migration strategy. |
| Immutable release manifest | Identify a tested product/deployment combination across repositories. | Pin commit IDs, package versions, artifact hashes, toolchain/runtime requirements, code/ABI hashes, schema versions, module capabilities and documentation bundle hashes. Record what actually passed. |

Define public compatibility before `1.0.0`. Use prereleases for incomplete development, testnet and pilot builds; do not label a scaffold stable merely because it compiles. The [SemVer specification](https://semver.org/) is the code/package convention; the additional persisted-state rules here are Daclify requirements.

Start with one release train per repository. The modules repository publishes a catalogue containing each module's code/interface/configuration versions. Introduce independently released module packages only when needed; do not create a release bureaucracy for every folder. Core and module public SDK/schema artifacts remain separately versioned where consumers depend on them.

Each repository owns its changelog, dependency lockfile, verification commands and release artifacts. On 2026-10-07 the user selected local builds/tests on the Mac and manual deployment of the checked artifacts. GitHub workflows are optional `workflow_dispatch` jobs only; pushes and pull requests do not start them. A local check must record the exact source/artifact combination tested; GitHub status is not a release requirement. Release automation rejects moving/replacing a published version, mismatched generated code, unpinned production dependencies and a release manifest lacking required verification. Rebuild from clean checkouts and include enough provenance to reproduce the artifact. Repository visibility is private initially; public licensing, registry access and package visibility are separate explicit release decisions.

## Compatibility and migrations

Core publishes supported API/protocol versions. Modules declare compatible core interfaces, required capabilities and configuration schemas. Frontend checks the connected deployment/module versions before offering mutating actions. Unsupported combinations explain the mismatch and provide documented read/export or direct-connection options where those operations can be decoded safely; never guess a transaction format to keep a button working.

Test both compatible rolling upgrades and rejected incompatible combinations. A module version range is a compatibility claim that needs test evidence. A release manifest records the exact combination exercised; it does not prove every permutation within a broad range.

Antelope action/table compatibility must be checked against real serialized fixtures. An ABI diff is useful but insufficient: a table layout or action encoding can break existing rows/signatures, and a policy change can invalidate pending decisions without changing field types. Active ballots, executable proposals and payment obligations pin the rules needed to interpret and finish them.

On-chain state migrations use authorized, bounded and resumable transitions with progress/version records and explicit behavior while a migration is running. Preserve identity bindings, votes, credit supply, treasury backing, reserved liabilities and document/key references. Prevent mixed-format writes. Test interruption, retry and restart using representative old-version fixtures. Do not erase a table to make a schema upgrade convenient.

PostgreSQL migrations are ordered, namespaced for modules, recorded and applied by the core coordinator. Prefer compatible expansion followed by verified backfill and later removal. Test clean setup and upgrades from each supported release, database constraints and failure recovery. An irreversible migration is identified before rollout. After real payouts or key-policy changes, restoring an old snapshot is not a safe universal rollback.

Keep old document/encryption readers for the promised support window. New writes use the selected supported format. Migrations that re-encrypt private content require authorized key holders; a blind service cannot perform them by administrative wishful thinking. Version signed instructions and canonical encodings explicitly, with old/new test vectors and replay separation where required.

DAO owners authorize their independent contract upgrades. Shared deployment changes disclose the platform's upgrade authority and impact. Hosted compatible service updates do not imply permission to change DAO policy, spend funds or upgrade DAO-owned contracts.

## Documentation as part of the product

Generate reference material from canonical API schemas, compiled ABIs, module manifests, configuration schemas, typed error codes and the tested release manifest. This provides action/API references, configuration fields and defaults, capability/compatibility information and examples. Producers own these outputs: core produces common references; modules produce module references; frontend consumes pinned documentation bundles.

Write explanatory guides alongside the feature. Generation cannot explain why a quorum rule matters, how managed recovery changes confidentiality, or what an operator should do after a failed payout. Every advertised feature needs a tested user journey, role requirements, limits, failure/recovery behavior and relevant operating instructions. Examples use synthetic identities and amounts and contain no credentials or private DAO records.

| UI location | Documentation behavior |
| --- | --- |
| Onboarding and recovery | Explain signing versus encryption custody, backups, recovery authority and unsupported-client fallbacks before selection. |
| DAO setup and module configuration | Contextual help for fields, usable presets, required roles, resource costs and effects on active work. Show the connected module's defaults. |
| Ballots, grants and treasury | Explain eligibility, thresholds, acceptance, payment states and the selected verifier's trust model at the relevant step. |
| Private documents | Explain key access, historic-access policy, rotation, availability and the limits of deletion/revocation. |
| Help centre | Searchable user guides and module documentation, plus advanced developer/operator references. Keyboard and screen-reader accessible; responsive in Telegram. |
| DAO settings and upgrades | Current deployment/module versions, available compatible upgrades, changed behavior, migration steps and authority required to proceed. |
| Application/support details | Frontend build identity, connected chain/deployment, tested compatibility and links to the matching release notes. Exclude secrets and private records. |

Use stable documentation topic IDs linked by schemas/manifests and UI features. Resolve content against the connected deployment/module/interface versions. Host older supported bundles and provide the corresponding bundle in independent deployment kits. If matching documentation is unavailable, say so; do not silently present latest defaults as instructions for an older contract.

Publish documentation and executable artifacts together through the release manifest. Public reference pages stay generic; member-specific help/support exports obey DAO authorization and privacy policy. Sanitize rendered Markdown/HTML, restrict external content and prevent module metadata from injecting executable help pages.

Local documentation verification checks generated-output consistency, topic/link resolution, configuration examples against schemas, reproducible request/action examples against fixtures and missing coverage for newly exposed fields/actions. UI tests verify help access, focus restoration, search, error-code guidance and version switching. Publish a documentation preview with each reviewable feature. Reference generation and user-guide completeness are separate acceptance checks.

## Pinata pinning and content lifecycle

Pinata is the initial hosted pinning provider, as selected by the user. Core owns its provider adapter and operational credentials. Store portable validated CIDs and content/envelope versions in contract records; provider file/group IDs and job state belong in the backend. An independent DAO can configure its own Pinata account or a compatible self-hosted content service. Implement only the selected provider now, with a small interface supporting export/migration later.

Private DAO documents are encrypted by the client before upload, including sensitive titles/filenames/metadata where required. Pin encrypted bytes on public IPFS for portable CID retrieval. Pinata's separately offered Private IPFS does not publish to the public network and uses access links; that access control alone is not member-held encryption. It is not the selected confidentiality mechanism. [Pinata network documentation](https://docs.pinata.cloud/files/private-ipfs)

Keep the Pinata JWT in backend secret configuration, outside source, static bundles, analytics and logs. Use least-privilege credentials for the operations actually needed and separate development/test/production projects or credentials. Provide a credential-free example configuration and startup validation; never ask for a secret pasted into chat.

For browser uploads, authenticate the user, check DAO/content capability and reserve quota before issuing a short-lived signed upload URL. Apply the provider's documented size/type constraints, a fixed CID profile and privacy-safe metadata. Treat the URL as a temporary bearer credential. Verify completed upload ownership/job binding, actual size/type, CID and retrievable content before publication. Release failed reservations and reconcile orphaned uploads; reject forged completion responses. Pinata documents signed URLs and size/type options, but does not establish a single-use guarantee in the references reviewed here. Test replay behavior; use a bounded backend-mediated path if reliable cost/abuse limits cannot be enforced. [Upload guidance](https://docs.pinata.cloud/files/uploading-files), [signed URL API](https://docs.pinata.cloud/api-reference/endpoint/create-signed-upload-url).

Pin before publishing an authoritative document record. A successful upload response alone is not the full durable-content gate: verify retrieval and content integrity, then publish; show an explicit pending/failure state until both complete. IPFS file CIDs can describe a DAG, so a raw file SHA-256 is not automatically its CID. Pin the import profile and verify reconstructed bytes with a separately defined commitment or proper DAG verification. Do not silently rewrite immutable CID references using provider URL-swap features.

Track pin/retrieval health, retries, usage and retention. Handle credential expiry, rate limits, provider outage, gateway corruption, missing content and quota exhaustion. Export includes content/commitments and encrypted envelopes needed for re-pinning. Unpinning follows authorization, retention and shared-reference rules and cannot remove third-party copies. Pinata is the chosen provider; live account access, plan limits, actual costs and failure behavior still require integration evidence.

## Extensive tests with meaningful evidence

The user requested as many tests as practical. Optimize for coverage of behavior, adversarial boundaries and failure recovery; repeated assertions of the same happy path are not additional confidence. Every package extends a requirement-to-test register with scenario, invariant, suite/runtime, fixture release and actual result. Required tests cannot pass through zero-test execution or silent skips.

| Test layer | Required evidence |
| --- | --- |
| Static/schema/build | Strict TypeScript and Vue checks, no unsafe application types, generated API/ABI consistency, schema validation and reproducible C++ artifacts. |
| VERT contract | Actual compiled C++ WASM; accepted and rejected actions, scope/callback isolation, real signature vectors, table transitions and rollback. |
| Native runtime | Actual permission graphs, inline actions, permission intrinsics, resource bounds and behavior unavailable in VERT. |
| Property/state-machine | Conservation of money/credits, reserved backing, monotonic settlement, once-only execution and permission boundaries over sequences of actions. |
| Fuzz/boundary | Malformed serialized inputs, JSON/CIDs/envelopes, sizes, precision/overflow, times, thresholds, nonce exhaustion and canonical encoding. Reproducible seeds and minimized regression cases. |
| API/database/worker | Boundary validation, authorization, CSRF/session/recovery, transactional idempotency, migrations, concurrent requests, leases/restarts and redacted structured errors. |
| Provider | Pinata uploads/retrieval, OAuth/Telegram verification, managed key/recovery and billing behavior. Deterministic fault fixtures plus separate real sandbox/provider checks. |
| EVM/cross-runtime | EOA and supported contract wallets, domain replay, decimals, success/revert/out-of-gas/refund, finality, durable evidence and duplicate consumption. |
| Browser/accessibility | Public/private DAO journeys, both custody modes, loss/recovery, native/internal/EVM capability labels, help/version UX, keyboard/focus/zoom and supported Telegram clients. |
| Upgrade/migration | Supported old data and clients, interrupted migrations, preserved rights/liabilities/keys, compatible rolling releases and rejected incompatible combinations. |

Maintain critical invariants: unauthorized actors cannot change DAO state; relayers cannot manufacture member consent; DAO scopes never authorize cross-DAO actions; backing covers recorded liabilities; obligations pay once; approved work remains interpretable after upgrades; linked credentials cannot duplicate votes; noncustodial recovery needs the recovery credential; privacy grants match custody/admission/history policy; billing expiry cannot seize funds or keys.

For manageable state spaces, test all boundary combinations. For larger sequences, use state-machine/property tests with independent expected models, seed recording and a bounded local execution budget. Add selected mutation checks to critical authorization/accounting code to confirm that tests catch removal of a guard or duplication of a payout. Do not require exhaustive global combinations or a cosmetic universal coverage percentage.

Run fast relevant checks during development, affected integration journeys after meaningful changes and a clean full release suite before delivery. Extend checks when failures, changed contracts or unresolved concerns justify it. Mark provider/native/client tests that could not run as unverified; mocks do not convert them into real integration passes. Gather source coverage where available, but behavioral and invariant evidence remains the acceptance standard.

Encryption claims assume a trustworthy client. An authorized member can retain/share plaintext; a compromised device or frontend update can steal unlocked keys. User-controlled keys remove routine server custody, not malicious-client risk. Test plaintext leakage into backend requests, Pinata metadata, logs, search, notifications and support exports, and document the reviewed static/self-hosted client option without promising immunity to a compromised browser.

## One continuous implementation session and final review

The user will review the complete code after it is written. During implementation, proceed through the approved dependency order without asking for permission after every module or internal checkpoint. Keep internal reviews, tests, commits, progress updates and a durable execution ledger; context compaction does not restart the task. No delegation is authorized by this workflow.

Resolve routine implementation details from evidence. Ask only for a material missing policy, external account/credential access or an action beyond the agreed scope, and continue independent work while waiting. Credentials are supplied through secure local/service configuration. Do not claim a production provider integration is verified using a mock because access is absent.

The final review packet includes all three repository commit references, changed features and public interfaces, current release/compatibility manifest, migrations, generated and explanatory docs, runnable setup/deployment instructions, actual check commands/results, passed/failed/skipped distinctions and remaining risks. Application source, test infrastructure and deployment tooling are delivered together. Each advertised capability must meet its acceptance gate or remain clearly unavailable with the outstanding requirement recorded.

Writing deployment code in this session does not authorize live production deployment, owner/active permission changes, production key rotation, asset movement or a migration cutover. Prepare and test those artifacts first; the user's completed-code review precedes an expressly authorized production release. A continuous implementation session is a working preference, not evidence that all third-party services, clients and security reviews can be completed without external access or elapsed time.
