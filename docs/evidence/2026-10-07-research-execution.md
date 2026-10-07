# Research implementation execution ledger

Scope: the accepted modules/paired-login plan; user authorized implementation on 2026-10-07. Three isolated sibling worktrees under `~/.config/superpowers/worktrees/daclify-research-implementation/`, branch `codex/research-modules-login` in each. Main, legacy repositories and other services remain separate.

Baseline: core `0d9314f` (plan plus `933f57e` implementation), modules `3a06bea`, frontend `92e8145`. Development prerequisites: Node 24.21+, npm 11.19+, pinned CDT 4.1.1/Spring 1.2.2 Docker toolchain. No production/provider credentials supplied.

| Package | Status | Verified implementation |
| --- | --- | --- |
| N1 Pairing/login | Implemented; local checks passed | Fresh root/native/verified EVM account-control intents, SMTP, Telegram OIDC/MiniApp, passkeys, provenance/history and returning-user UX. Live mail/Telegram qualification remains external. |
| N2 Zero login/signing | Implemented; local checks passed | Actual native authority proof, stable pairing/membership after key rotation, revoke and shared exact-transaction dispatcher. Real Anchor client qualification remains external. |
| N3 EVM login/signing | Implemented; local checks passed | SIWE and independently encoded EIP-712 EOA bindings/governance on Spring, common nonces, epoch revocation/guardian recovery. ERC-1271, EVM assets and bridge settlement remain future capabilities. |
| N4 Discovery | Implemented; local checks passed | v3 display metadata, immutable setup provenance, bounded public raster branding, original warm cards, URL filters and settings. Directory scope is the configured runtime. |
| N5 Agreements | Implemented; local checks passed | Frozen terms/contributor consent and authored public service listings; existing Works/Treasury reservation, review, cancellation and claim lifecycle reused. |
| N6 Reports | Implemented; local checks passed | Atomic receipts with real transaction IDs; full JSON/CSV exports, coverage/reconciliation and historical unknowns. No narrative/private key export. |
| N7 Grants rounds | Implemented; local checks passed | Bounded round/application module, exact consent and eligibility, pinned Decide award votes, atomic fully funded Works awards and once-only settlement. |
| N8 Endorsements | Implemented; local checks passed | Enforced opt-in admission across owner/signed/callback paths, current distinct witnesses, immutable revision and once-only ordinary membership without roles/credits. |
| N9 Elections | Implemented; local checks passed | Frozen candidates/policy/weights, abstention/quorum/boundary ties, durable terms and recall; no implied spending/admin powers. |
| N10 Release | Implemented; local checks passed | 0.5.0-alpha.1 package coordination, ABI/request docs, version/hash UI checks, populated native/SQL upgrade tests, deploy ABI codec and reviewable permission/account plans. External release gates remain below. |

Keep recorded passes separate from unrun provider, real-client and production qualification. Future gated capabilities in the plan are not part of this implementation scope. Update this ledger at verified package checkpoints.

## Verified checkpoint before module extensions

Core verify: 54 files / 370 unit tests passed before the latest history/MiniApp/rotation changes. Frontend: 16 files / 58 tests and template typecheck passed before those changes. PostgreSQL sign-in/link suites: 3 files / 24 tests passed with migrations 008–013. Local Mailpit SMTP capture: 1 provider test passed; mail configuration: 3 unit checks passed. Native wallet/EVM suites: 3 files / 4 tests passed before adding the rotation regression. Independent Viem typed-data and C++ EVM checks passed. These are development fixtures, not live Telegram/email/client or production qualification.

Owned fixtures only: PostgreSQL 17432, native RPC 20188, Mailpit SMTP 11025/API 18025. No production credentials, funds or authorities were changed.

The latest native rotation regression passed (2 paired-wallet tests): membership was retained under the same service account/member after native-authorized key rotation. The latest browser account test passed against real local API/PostgreSQL: passkey + email pairing, removal-scope review, same-account returning passkey login with vault locked. Directory browser checks use producer-validated API fixtures and do not qualify remote-chain discovery.

## N5/N6 native checkpoint

Real native agreement → consent → full reservation → submission/review → cancellation preserving an approved liability → once-only internal claim credit → offboarded signed withdrawal → spending report passed. Receipt transaction IDs matched actual Spring push results; generated evidence contains public fixture references only. N6 report/CSV unit checks passed (3 tests), covering foreign DAO/asset rejection, duplicate receipts, legacy unknown settlements, partial reads, reconciliation changes and formula injection. Core verify passed 56 files / 377 tests and frontend verify passed 17 files / 60 tests at the N6 checkpoint. Desktop and mobile report browser exports passed (2 tests) against actual native fixture records.

The Vue state/permission fixture now consumes producer ModuleStateSchema defaults; its regression passed after adding the agreement array. When changing development tarballs at the same prerelease version, restart Vite with --force to clear old optimized named exports. Production artifacts remain immutable and N10 will use a new version.

At that checkpoint, N7–N9 implementation was pending; the later checkpoints below supersede it.

## N7 native checkpoint

Compiled grant/Works regression: 16 tests passed. Real Spring award vote → finalized execution → full Works reservation → delivery/review → once-only settlement passed. A second approved award whose later milestone lacked backing rolled back its cap, application, execution flag, Works project and all reservations. Receipt ID matched actual native payment transaction. Public evidence: `.artifacts/native/grants-evidence.json`. Native C++ still enforces the money path independently of API checks. N8/N9 remain in progress; no live provider or production qualification.

## N8/N9 checkpoint

Full core verify: 56 files / 378 tests passed. Modules verify: 12 files / 81 tests passed. Frontend verify: 17 files / 60 tests passed. Compiled elections cover maximum candidates, withdrawn slots, abstention/no quorum, tied groups/seat boundaries, ineligible winners, policy changes and recall. Native admission + election integration: 2 tests passed, enforcing owner-path policy, authenticated callback sender, current witness eligibility, once-only ordinary membership, independent election voting/finalization and recorded recall with no role/credit powers. Guardian recovery regression passed after revoking the previous EVM binding/epoch as well as native/root/session credentials.

The N7–N9 UI is implemented and typechecked; browser/whole-flow verification and N10 version/upgrade work remain. These fixtures do not qualify live providers, real wallet clients or production deployment.


## Final verification and review packet

Release version: **0.5.0-alpha.1** across core/public protocol, modules and frontend. Interface remains 1. New state uses additive tables, metadata schemas and migrations; old row layouts remain unchanged.

| Suite | Final successful evidence |
| --- | --- |
| Core lint/typecheck/docs/unit/build | `npm run verify`, `npm run build`: 57 files / 383 tests. |
| Modules lint/typecheck/docs/unit/build | `npm run verify`, `npm run build`: 13 files / 82 tests, including two independent runtimes with identical DAO/module record IDs and no Hub. |
| Frontend lint/template/typecheck/unit/build | `npm run verify`, `npm run build`: 20 files / 78 tests. Wallet tests cover exact bytes, cancellation, route/account/network/wallet/signer changes and asynchronous lookup races before prompt/broadcast. |
| PostgreSQL | `npm run test:integration`: 11 files / 78 tests, including actual 001–007 → 001–014 upgrade and idempotent second application in a separately owned test database. |
| Providers | `npm run test:providers`: 2 files / 6 tests using actual local SMTP/Mailpit and nonexportable OpenBao R1 Transit keys. |
| Native C++ | `test:native:research` / `test:native:paid` phase selections: 14 pre-payment files / 27 cases verified across the initial run and the corrected three-file rerun (10 passed); paid creation/presets add 1 file / 2 cases. 29 unique cases passed, none left skipped. Includes actual old WASM row upgrade, unchanged ordinary commitments, invalid old code pins, preserved liabilities/claims, ABI system-action serialization and actual receipt IDs. |
| Browser | 76 unique desktop/mobile cases passed across fixture phases. Research phase: 12 passed (8 native-record/report cases plus returning-login/recovery checks). Paid full run: 65 passed with 3 obsolete UI expectations failing; corrected profile/workspace rerun: all 14 passed, resolving all 3. Signed grant consent/eligibility/award vote, election nomination and endorsement admission passed on desktop/mobile against actual native/API/PostgreSQL state. |
| Dependencies | Production-only `npm audit --omit=dev --json`: zero known vulnerabilities in all three checkouts at verification time. |
| Formatting/diff | Prettier checks and `git diff --check` passed. Generated ABI/schema/help files reviewed as generated outputs; authorization, money, state/provenance and async context changes reviewed directly. |

These are checkout/local-development checks, not GitHub CI, a production audit or live provider/client qualification. The frontend build reports a chunk-size warning around the wallet/SDK code; it builds successfully. No cache, queue or infrastructure was added to hide it.

### Failures corrected during final verification

The old native fee helper hard-coded a treasury account from another fixture. It now reads the owned fixture's actual fee configuration; the three affected native suites passed on rerun. Native tests use the recorded owned container rather than another agent's default container. The browser harness initially pointed at the old API port; it was corrected before the successful research run. Old EVM UI tests used the previous pairing endpoints/labels and invalid signature shape; their explicit provider fixture now exercises the reviewed pairing/removal flow without claiming cryptographic/client qualification. Profile and sign-out expectations now reflect return-to navigation and the unified sign-in screen. A missing locked-vault action link was restored. Native/election evidence records are read from actual rows rather than fabricated completion flags.

The report flags a missing referenced document as incomplete. Guardian signing recovery revokes previous EVM bindings/epochs. The frontend checks its own installed SDK version/hash and rejects changed account/network/route/wallet/signer context even while awaiting binding lookup or a wallet response.

### Reproduce and review

See [the upgrade runbook](../operations/upgrade-0.5.md), [paired login/provider setup](../operations/paired-login.md) and [the accepted implementation plan](../superpowers/plans/2026-10-07-modules-and-paired-login.md). Requirement-to-test paths are in `docs/releases/requirements.json`. The immutable development review manifest records implementation commit, lockfile and compiled artifact/document hashes; publication remains refused.

Owned fixtures: PostgreSQL 17432; research native RPC 20188; paid native RPC 20288; SMTP 11025/Mailpit 18025; OpenBao 18221. API 3018/UI 5188 serve only the selected local fixture. Native fixture bundles were privately archived when switching; keys/content are gitignored. Production accounts, funds and authorities were untouched.

### External qualification / future capabilities

No Pinata, SMTP mailbox, Google or Telegram production credentials were supplied. Live provider configuration/deliverability, real Anchor/EOA wallet clients, durable OpenBao recovery/audit/isolation, selected production-chain features/authorities and immutable published artifact verification remain release gates. Managed custody stays explicitly unavailable for production. Community-IQ pilot acceptance requires its actual users and policy choices.

Quadratic matching, NFT exchange, fractal elections, privileged delegate budgets/circles, recurring agreements, ERC-1271, cross-chain/EVM settlement and cross-device key synchronization remain the explicitly gated future features from the plan. Approved liabilities, claims, governance membership, recovery and complete exports cannot be paywalled by optional hosted coordination.

Implementation commits: core `d9c1f86`, modules `218435f`, frontend `1d32add`. The [development review manifest](../releases/development-2026-10-07-0.5.0-alpha.1.json) pins these implementation commits; the following core commit adds only this review record and manifest.
