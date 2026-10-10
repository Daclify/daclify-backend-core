# Testnet contract, permission and UI review

Reviewed inline on 2026-10-10 under the user's audit brief. Scope: eight deployed smart contracts, ten configured accounts, deployment/upgrade/authority tooling, API relay and browser signing. This is a source and evidence review, not an independent security certification.

## Verified state

Public RPC: `https://testnet.telos.caleos.io`; chain `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`. Initial account/code snapshot: 2026-10-10T18:36:41.595015Z, block 449508942. Permission audit repeated at 19:54:01.229Z, block 449518225, with the same 11 missing links and complete empty eosio.any metadata on all ten accounts. Timestamps are UTC provenance.

At discovery, all eight deployed WASM hashes matched the available local artifacts and tracked release pins. Subsequently all eleven core contract/fixture binaries were freshly compiled with pinned CDT 4.1.1; the runtime now has a new hash for the wallet-consent fix below. That development binary has not been deployed. Relay and Fees have zero code hash. All ten owner authorities contain the same bootstrap public key, threshold one; none currently delegates owner to an executive quorum or the creator's account authority.

| Account | Current active | Relevant relationship |
| --- | --- | --- |
| daclifycore1 | Operator key OR own code | Runtime; execctx code-only under active |
| daclifyhubv1 | Operator key | Hub registry; no inline sends |
| daclifydecid | Operator key OR own code | Decide callbacks/elections |
| daclifyworks | Operator key OR own code | Works callbacks/obligations |
| daclifypayr1 | Operator key OR own code | Payroll callbacks/obligations |
| daclifygrant | Operator key OR own code | Grants callbacks/obligations |
| daclifyendor | Operator key OR own code | Endorse callbacks/admission |
| daclifynames | Operator key OR own code | Names creation/resource purchases/payouts |
| daclifyrelay | Operator key; no code | Configured creation/Names settler |
| daclifyfees1 | Operator key; no code | Configured fee treasury |

The active operator keys differ between accounts; the shared owner key is a single recovery/control point. No evidence of key compromise was found or claimed. Public account inspection does not establish who holds a private key.

nativegov, execpols and execpending have no rows. Four DAOs exist with one member each; no native executive governance or handover is configured. The first snapshot accidentally queried `govpols`; that failed read is excluded. The subsequent DAO-scope queries were also the wrong scope and are excluded from conclusions. The correct global runtime scope read at 19:16:02.680522Z returned four govpolicies, matching the actual four DAO IDs. Their ordinary ballot quorum is 5000 basis points and approval 5001; this is separate from native executive quorum. Only nativegov/execpols/execpending absence establishes that native handover is unconfigured. Do not treat ordinary DAO administrators as native account owners.

## Findings and disposition

### High: native wallet linking fails under actual testnet inline-authorization rules — fixed locally

Location: runtime dispatch/linknative in contracts/runtime/runtime.cpp; incoming-wallet SDK/UI signing; old VERT/native fixtures.

The public chain has RAM_RESTRICTIONS and RESTRICT_ACTION_TO_SELF activated. The old dispatch included incoming@active on its inline self-call, and linknative required that authority again. Under RESTRICT_ACTION_TO_SELF the incoming wallet's outer authorization is not inherited by the inline action. The real-node regression reproduced unsatisfied_authorization even with both the correct member signature and incoming active consent. Previous VERT fixtures granted runtime code authority over the dummy wallet; the old Docker fixture omitted both restrictions. Those fixtures masked this defect.

The fix requires the incoming account's exact active permission on the validated outer dispatch and sends only runtime@execctx inline. linknative retains its self-sender, validated member context, uniqueness, credential bump and native-controller guards. Direct calls and quorum-signed counterfeit calls still reject. Tests reject missing consent, wrong member signature and a weaker custom permission even if submit is linked to it; accept fresh consent for replacement; and verify real K1/R1 signatures. The obsolete wallet-code grant is deleted and the Docker feature baseline now includes both restrictions.

This preserves the intended two-consent binding rule; no authorization policy or ABI changes. An intermediate actor-only check accepted a weak child permission in a new native regression; it was tightened to exact active before the final build and was never deployed. The initial real-node failure and final success are recorded in local test logs.

Fresh runtime WASM SHA256: ecdb1e3dab7fb57502dd9ea8cde447a00892f20f4d30fa373f02c072eca03f40. Raw ABI SHA256 remains 26f74776ba7b35a9fa2283fe80dd3fa14645f564025f340e7621bf71571e8806. Development core/SDK 0.12.0-alpha.2 pins this fix. Coordinated contract/API/consumer rollout is required: the new API's strict reviewed-runtime hash must not be deployed against the old contract unintentionally.

### High: deployed execution links lag behind the contract action surface

Location: runtime dispatch in contracts/runtime/runtime.cpp; sdk/permissions.ts; tools/deploy/permissions.ts; tools/deploy/upgrade-testnet.ts.

The canonical plan requires 68 explicit execctx links: 40 runtime actions and 28 module actions. Actual setup has 57. All module links are present; the missing runtime links are:

`setexecs`, `heartbeat`, `refreshgov`, `setvoter`, `archapprove`, `archrevoke`, `restoredoc`, `govpayfees`, `govhosted`, `govseatfee`, `govresources`.

Their existing minimum defaults to active. Runtime dispatch declares runtime@execctx, a child of active; the native authorization hierarchy does not let a child satisfy its parent. This is a deployment blocker for these instruction paths. The upgrade script deliberately preserves authorities, so deploying new WASM alone leaves newly added links absent. This conclusion combines actual account links and native runtime source; no live member transaction was broadcast to prove execution failure.

Safe fix: a shared read-only inspector, exact ABI/action consistency regression, configured deployment-plan reuse and unsigned missing-link repair. The actual CLI emits exactly 11 owner-authorized linkauth actions. It refuses proposals on authority/parent drift, unexpected execctx grants or existing differently assigned links. No updateauth, code upload, unlink, handover or asset action is included. Signing remains pending explicit review; the chain is unchanged.

### High: current account control is bootstrap-only, and upgrades accept individual active keys

Location: actual get_account/get_required_keys, deployment planner, sdk/executives.ts, runtime handover/synchronization and frontend ExecutivePanel.

All owner accounts use the bootstrap key, and no native governance is configured. Sixteen public unsigned get_required_keys checks show each current single active key can authorize setcode and setabi on its contract account. Probes used empty code/ABI for authorization only and were never signed, broadcast or executed. Using owner in the deployment command does not enforce an owner-only minimum.

This is confirmed control concentration and upgrade scope, not proof of an exploit. The user's selected replacement is creator recovery owner plus dynamic executive quorum in core active, including active-authorized core upgrades. Accordingly, the inspector reports upgrade minimums without treating every active link as invalid. Managed-contract owner upgrade links are recommended to keep their own-code active grant from upgrading itself while preserving executive control through delegated owner.

Policy implementation and authority changes are separate from this audit's safe fixes. See the [concrete replacement design](../superpowers/specs/2026-10-10-creator-owner-executive-active-design.md).

### High: the existing handover does not preserve the requested creator recovery root

Location: runtime handover at contracts/runtime/runtime.cpp and update_native_authority/refresh_native_governance; sdk/executives.ts; ExecutivePanel.vue.

Current handover rewrites runtime owner to govern OR runtime code, sets managed owner to govern and always issues native updateauth as owner. It is internally designed for the previous approved govern model, but does not implement the newly selected creator-owner/active-quorum tree. Signing its current downloaded proposal would remove the intended creator recovery root. Merely manually changing owner to creator without changing synchronization would also break the runtime's owner-authorized updates.

Fix requires one coordinated contract/SDK/API/UI policy migration, including active-authorized synchronization and owner-approved atomic staging. Existing stale roster/threshold/revision protections should remain. Do not reuse the current handover unchanged. No policy rewrite or live handover was performed during this review.

### Medium: compatible installed modules are disabled by stale producer metadata — fixed locally

Location: modules protocol/index.ts Catalog; NativeChainGateway.moduleState; frontend ModulesPanel and related workspace panels.

All five SDK manifests omit core 0.12.0-alpha.1 even though the SDK pins that exact core peer. The actual production moduleState read path against public testnet reported all five enabled and code-verified but incompatible. UI controls correctly honor the incompatibility flag, so this metadata defect blocks valid module operations independently of native permissions.

Fixed in final module SDK 0.9.0-alpha.16: accept exactly reviewed core 0.12.0-alpha.1 and 0.12.0-alpha.2 while retaining rejection of unqualified later releases. Contract version stays 0.9.0-alpha.5. Generated docs and core/frontend artifact pins are updated. The same locally corrected production read path against the actual RPC reports all five enabled, compatible and code-verified at 18:59:17.786Z. The final package repeats this read with core SDK alpha.2/module SDK alpha.16 and retains all five enabled/compatible/code-verified results. This verifies the local packaged fix; it is not evidence that the deployed API has been restarted with it.

### Medium: native verification and drift reconciliation are incomplete operationally

The old deploy plan prints desired permissions; the upgrade path preserves existing setup. The new audit makes drift visible and produces guarded unsigned repairs, but it is not an automatic reconciler or authorization certification. A snapshot can become stale; re-read before signing and use on-chain policy guards for handover. The proposed authority hierarchy and actual workflows are now verified on owned disposable Spring 1.2.2 nodes without Docker. The production replacement handover, inactivity/election synchronization and migration remain a separate implementation and qualification task; manually simulated authority semantics do not establish that migration is implemented.

## Contract authorization and UI flow

| Path | Authoritative checks | UI/API responsibility |
| --- | --- | --- |
| Internal instruction | Runtime-bound digest, chain/runtime/DAO/member, actor context, nonce and bounded expiry | Vault signs member instruction; API transports/relays it |
| Native member submitnat | Paired native identity and member context; native authorization | Wallet uses declared account/permission; chain and pairing checked before broadcast |
| EVM member | Separate domain-bound proof and identity checks | Bound EVM signature, not native owner/active authority |
| Runtime to module | Runtime sender and execctx; DAO installation/action checks | Consumer uses generated payload/ABI, not arbitrary native module action |
| Module callback | Actual module sender, installed callback grant and live code pin; DAO context | Module code sends under its active/own-code authority |
| Native setup/appoint/handover | Current owner/quorum, one governing DAO, paired controllers and stale-state checks | ExecutivePanel prepares unsigned native actions; ordinary app role is insufficient |
| Names settlement | Configured settler/token identity, once-only receipt, bounds and backing | Hosted settlement credentials remain separate from executive/member signing |

The browser ActionSigner.bind signs the member instruction with the unlocked vault, then nativeGovernance sends submit with the incoming wallet authorization. connectNative requires active, matching the contract's preserved exact active consent. Ordinary native instructions use submitnat for the paired identity; no browser session or DAO role substitutes for owner/executive authority.

Reviewed runtime instruction allowlist, callback grants/sender validation, executive/identity transitions, Names configuration/settlement/resource/payout authority, Hub deployment registration and the five module entry/callback paths. Existing source retains DAO isolation and treats contracts as the authority for money and permissions; browser disabled states are convenience, not authorization. No additional confirmed callback impersonation or cross-DAO takeover defect emerged from this scoped review.

The permission tree displays actual thresholds, account authorities, keys and action links. Configured Hub/settler/treasury/Names diagram edges express business configuration; they do not grant native permission. Runtime execctx and module eosio.code grants serve different directions of calls and must not be collapsed into executive signing authority. RAM/CPU/NET readings do not confer authority.

## Safe implementation and cleanup

- Reused the existing canonical permission plan and configured module mapping rather than duplicating action lists. Added a CLI that has no key loading, signing or send option; verifies RPC chain/account and uses bounded reads.
- Added eighteen inspector/repair regressions, including key/delegate/threshold/parent drift, wildcard upgrade precedence, wrong-account rejection, no overwrite of existing links, complete raw link metadata, eosio.any refusal and compiled member-ABI coverage. The pinned SDK drops eosio.any metadata; the CLI now checks raw get_account responses before canonical decoding.
- Corrected catalogue compatibility at its producer, regenerated documentation and consumed immutable module SDK artifacts in both consumers. Retained code-pin and future-version guards.
- Rebuilt C++ and pinned a new development runtime for the wallet-consent fix, without changing ABI, tables, instruction domains or public policy. Added disposable native-process fixtures, real authority probes and dummy DAOs/users. Existing handover remains the old policy until the replacement is reviewed and qualified. No live account keys, permissions, assets or services changed.

## Verification ledger

Initial focused core authorization/signing/deployment suites: 106/106 in 13 files. Initial frontend executive/wallet/recovery/map unit suites: 43/43 in four files. Inspector plus deploy regressions initially passed 17/17; five later raw-metadata cases bring the new inspector tests to eighteen. The eosio.any regression failed four cases against unchecked decoding before its fix. Compatibility regression failed against the old range and passed against the corrected producer (6/6 SDK tests).

Core initial full run: 742/745; two heavy test timeouts and one subsequent VERT initialization error. Focused rerun of those two files, unchanged assertions with a larger command-line timeout and two workers: 21/21. Full module initial run: 160/162 due to two five-second timeouts; focused rerun 2/2. The next full module run passed all original 162 tests and caught the newly added compatibility regression before its fix. These failures are recorded rather than counted as successful runs.

Final broad checks and exact totals are recorded in the final verification table below. VERT now uses the freshly compiled runtime, and new native tests run real Spring authorization and real cryptographic verification. Module binaries remain the same release-pinned deployed binaries. Desktop/mobile Playwright executive and permission-tree suites passed 10/10 using HTTP fixtures; this does not qualify live wallet/multisig or native authority execution.

Ignored local evidence: .artifacts/permissions-review-20261010.json; permission-upgrade-authority-checks-20261010.json; testnet-permission-audit-20261010.json; governance-policy-review-20261010.json; module-compatibility-before/after/release-20261010.json; protocol-feature-review-20261010.json; testnet-permission-audit-complete-20261010.json; permission-audit-artifacts-20261010.json; final public audit and test logs. No private keys are included. External execctx authorization-only probes were inconclusive and are excluded as execution evidence: neither a present nor absent link can make an external active key satisfy code-only execctx.

## Remaining work and decision

Review the replacement authority design before implementing its coordinated contract/SDK/UI migration. Keep configurable quorum and active-authorized core upgrades as selected. Implement and qualify the coordinated production handover on an owned native chain, prepare exact creator/roster/managed-account authorities, then obtain separate approval to sign testnet changes. The eleven link-only repairs and API/frontend SDK deployment can be reviewed independently; this audit has not applied them.

Native minimum-permission and existing-permission update behavior were checked against the [Spring v1.2.2 authorization manager](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/authorization_manager.cpp), matching the actual RPC's v1.2.2 runtime. Exact/wildcard/default minimums and existing-active update rules inform the proposed tree; public unsigned probes establish only the reported current upgrade authority.

## Dummy DAO and native test coverage

All new native transactions run only on freshly generated owned localhost chains, with disposable keys, private temporary configuration, separate genesis and HTTP/P2P ports, bounded reads and cleanup. There is no public RPC override. Missing binary artifacts or unavailable pinned node versions fail the suite instead of skipping qualification. The authorityprobe contract is test-only and absent from deployment profiles/catalogues.

| Layer | Coverage and limits |
| --- | --- |
| Proposed authority tree | Creator recovery, two-executive threshold, insufficient/foreign signatures, real code and ABI upgrades, active self-update versus owner update, code weight equal to quorum, parent/child action minimums, own-code and foreign-code separation, managed owner links, scoped service restrictions, atomic rollback and independent node isolation. The tree is manually configured; this does not implement the new handover. |
| Actual runtime and all five modules | Separate funded DAOs and member keys; repaired eleven links; malformed/domain/context/nonce/expiry/signature/replay rejection; direct module and counterfeit callback rejection; actual module code pin, callback grants, own-code permissions and rollback/retry; incoming native wallet consent, submitnat pairing and R1 rotation. |
| Complete financial workflow | Grants application/review → Decide ballot and time boundary → Works award/review → Runtime obligations/claims; Payroll settlement; duplicate/cross-DAO prevention, earned claims after offboarding, token-row rollback, real dummy-token withdrawal and once-only payout. |
| Existing native handover | Actual legacy govern handover; stale roster/threshold/revision rollback; bootstrap removal and six managed owners; scoped service creation, tenant isolation, configurable quorum, departing wallet removal, last-controller protection and dual-consent replacement. This deliberately characterizes the old policy, which is unsuitable for the proposed creator recovery root. |
| Existing broad suites and browser | Existing compiled-WASM/property/adversarial contract coverage plus API/SDK/UI unit tests; desktop/mobile HTTP browser fixtures. These do not establish live provider or wallet/multisig qualification. |

The creator's current active authority itself includes the shared bootstrap key. Delegating recovery to creator@active therefore preserves that key's transitive recovery power until the creator separately reviews their own authority. Do not describe removal of direct keys on contract accounts as removal of every transitive bootstrap-key path.

See [reproducible native permission tests](../operations/native-permission-tests.md) for toolchain checksums, commands and fixture boundaries.

## Final verification

| Check | Final result |
| --- | --- |
| Core broad suite | 751/751 across 124 files after the final raw-metadata guards; two workers, 97.87 seconds. |
| Modules broad suite | 163/163 across 27 files; final isolated one-worker run, 264.73 seconds. |
| Frontend broad suite | 209/209 across 38 files; two workers and 90-second command-line budgets. |
| New portable native suite | 89/89 across three files (30 authority, 40 workflows, 19 legacy handover); real Spring 1.2.2, 93.76 seconds. No filtered skips in the complete run. |
| Inspector/deploy focused suite | 22/22 (18 new inspector cases plus four existing deploy-module cases). |
| Compiler/code generation | All eleven core/fixture binaries freshly compiled with verified CDT 4.1.1; codegen passed, generated runtime WASM/raw ABI pins verified against actual serialized artifacts. Existing Ricardian warnings remain. |
| Strict checks/builds | Core, modules and frontend lint/types/build passed; core/module generated docs checks passed. Frontend retains its existing >500 KB chunk warning. |
| Formatting | All changed core files pass; complete module/frontend format checks pass. Core whole-tree check retains preexisting formatting failures in unchanged tools/recovery/openbao-lab.ts and ignored .superpowers/.../test-db.json. HEAD's OpenBao file independently fails the same check; these unrelated files were preserved. |
| Browser fixtures | Earlier executive/contract-permission desktop/mobile run 10/10; HTTP fixtures, not live wallets/multisig. |
| Public read-only checks | Final inspector exit 2 with the same eleven missing links; all raw eosio.any lists empty; exact unsigned owner repair only. Final production moduleState read with SDK alpha.2/module SDK alpha.16 reports all five enabled/compatible/code-verified. No signatures or writes. |
| Development artifacts | Consumer archive bytes equal producer archives; core bf5a7d256fe6475c8a619b0cd79d9d64570e6678aad5a833bd7dea6d9e1a68ef; modules d1dd1ce9ee4cb0c54d302c24ac07e4856cc1d7c7e8f887e901dda6675d9583dd. These are local development packages, not an immutable qualified registry release. |

Final combined-load runs also recorded a 162/163 module result (the 5,000-row Works completion test exceeded its existing 180-second limit) and a 198/209 frontend result (eleven crypto tests exceeded five-second limits). The final reruns above keep every assertion and fixture row count unchanged, reduce concurrency and increase only command-line time budgets. The module's explicit 180-second case is unchanged and passed when isolated.

Added 108 meaningful tests in this review: 89 native, 18 inspector and one producer compatibility regression. The four final broad/native runs total 1,212 passed tests; focused and browser counts are listed separately and not added twice.

The new handover migration, full Docker/resource/provider suites and live browser wallet/multisig qualification remain unrun. New portable tests establish actual native authorization and the covered dummy workflows; they do not imply full-chain resource or provider qualification.

Native strict-inline behavior was checked against [Spring v1.2.2 apply_context.cpp](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/apply_context.cpp), matching the public chain's runtime and activated features. Special eosio.any metadata was checked against [Spring get_account](https://raw.githubusercontent.com/AntelopeIO/spring/v1.2.2/plugins/chain_plugin/chain_plugin.cpp). The tests exercise real execution rather than authorization-only RPC probes.

## Impact and decision

The current C++ handover, SDK planner and ExecutivePanel download implement govern-based owner replacement, so the requested creator recovery root cannot safely be obtained by signing that existing proposal. A coordinated runtime/SDK/API/UI policy change is required.

Option A is the proposed creator-owner/executive-active design: retain creator recovery; configurable executive threshold in active with runtime code weighted to that threshold; delegate managed owner/active to runtime active; owner-link managed code/ABI upgrades so their own code cannot upgrade itself. Core upgrades through active and configurable quorum are already selected. This option preserves the user's intended control model but requires new policy versioning, atomic staging and migration qualification. Creator authority and reviewed runtime code remain powerful trust boundaries.

Option B is the tested existing govern handover. It can establish executive control with the current implementation, but rewrites runtime owner to govern OR runtime code and removes the requested creator recovery authority. It does not meet the newly selected model and is not recommended.

Recommendation: review Option A's [concrete policy](../superpowers/specs/2026-10-10-creator-owner-executive-active-design.md), including managed upgrade links, creator and initial roster, before implementing that migration. The user's attached audit brief §15 explicitly gates changes to authorization policy; it permits the diagnostics, tests and behavior-preserving bug fix completed here. Approval to implement the new policy is separate from subsequent approval to sign any exact testnet handover or repair transaction.
