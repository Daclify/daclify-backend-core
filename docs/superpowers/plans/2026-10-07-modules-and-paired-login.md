# Research features and paired login implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` to execute these bounded packages in dependency order. No delegation is authorized. Track the checkboxes and keep an execution ledger. This is a programme implementation plan; freeze a package's code-level steps against the actual interfaces before coding it, rather than inventing complete wallet/cryptographic APIs in advance.

**Goal:** Make paired login and direct wallet governance easy to use, then deliver better DAO discovery, contribution agreements, spending reports and grants rounds, with bounded admission/election extensions.

**Architecture:** Keep the three repositories and the existing C++ runtime → Decide/Works/Payroll → Treasury flow. Core owns identity, sessions, wallet verification, shared schemas and money primitives; modules own new policy/state machines; frontend owns reviewed UI and consumes producer-generated artifacts. Add contracts only for behavior that cannot be enforced by existing contracts or configuration.

**Tech stack:** Existing strict TypeScript, Vue 3/Vite/Pinia, Antelope C++, PostgreSQL, generated SDK/ABI/schema artifacts, Pinata, VERT, native runtime and Playwright. Pin any required wallet/cryptographic dependencies after feasibility review; do not add a new authentication platform or service per module.

## Scope, evidence and decisions

This follows the accepted [module research](../../evidence/2026-10-07-module-research.md) and the [paired-login design](../specs/2026-10-07-paired-login-and-wallet-governance.md). It extends the [master plan](2026-10-05-daclify-v2-master-plan.md), whose original implementation-status paragraphs are historical. Current source baseline is core `933f57e`, modules `3a06bea`, frontend `92e8145`, all package version `0.4.0-alpha.1`.

**Selected by the user:** Telegram, email, Telos Zero and Telos EVM paired login; linked blockchain wallets can also authorize governance directly; both labelled custody modes; separate repos; native C++ contracts; original Daclify styling; generated/versioned docs; extensive meaningful tests.

**Recommended implementation defaults:** Works-first contribution/service flows; grants without quadratic matching; native-asset funding; endorsements and ordinary term elections before fractal elections. Exact Community-IQ pilot requirements are not verified. New module policies below are proposed bounded release rules, not claims about current code.

Preserve the existing creation prices: $20 shared, $50 independent plus separate blockchain resources, with the existing 20% TLOS conversion premium. This plan changes neither those fees nor contract ownership, guardian controls, privacy limits or supported payment rails.

## Delivery sequence

| Package | Delivers | Depends on | Contract change? |
| --- | --- | --- | --- |
| N1 | Secure account pairing, common login UX, Telegram/email provider readiness | Existing identity/session code | Usually no governance ABI change; additive service state |
| N2 | Zero wallet login and direct governance | N1, qualified wallet proof | Reuse `linknative`/`submitnat`; complete safe unbinding/revocation where missing |
| N3 | EVM login and verified direct EOA governance | N1, cryptographic feasibility gate | Yes: separate EVM bindings/verification, old paths retained |
| N4 | DAO cards, filters and public branding | Existing DAO summaries; independent of N3 | Metadata validation/version addition only if branding is stored |
| N5 | Contribution agreements and basic service catalogue | Existing Works, N1/N2 for access journeys | Small Works agreement/consent extension |
| N6 | Spending/outcomes reports | Existing finance/Works data; N5 adds agreement provenance | Usually projection/export only |
| N7 | Grants rounds and award-to-Works lifecycle | N5/N6; backed native Treasury | New bounded `grants-rounds` module plus authenticated integration |
| N8 | Optional member endorsement admission | Stable account identity, real DAO policy demand | New admission policy state and narrow admission grant |
| N9 | Ordinary candidate elections and term delegates | N8 not required; stable Decide rules | Decide extension; spending authority separate |
| N10 | Compatible release, documentation and pilot evidence | Each advertised package's acceptance gates | Migration/release verification |

Recommended first review milestone: N1/N2/N4/N5/N6. N3 begins with an early feasibility spike so its uncertainty is visible, and remains required for full direct EVM governance delivery. N7 is the next substantive module. N8/N9 follow confirmed community use; they are not prerequisites for grants. Provider/custody and independent-routing gaps in the existing remaining-work plan stay visible and cannot be relabelled complete by this roadmap.

## Execution rules and repository map

Paths below are relative to the named repository. **Existing** paths were inspected; **create** paths describe proposed new files. Reserve the next free migration number when starting a package; never rewrite an applied migration. Keep C++ table additions separate where possible to preserve serialized existing rows. Add/increment explicit schema/config/signature versions when their formats change; a package version bump does not migrate state.

For each task: write the stated failing regression checks; confirm they fail for the intended missing behavior; implement the smallest complete transition; run the affected checks; review the diff; update references/help and evidence; commit. No task is done because a button appears. Keep source of truth, validation, permissions, money and state transitions at their producer/contract boundary.

## N1 — Pairing and login foundations

**Existing core:** `services/api/src/auth/{account-session,linking,email,passkey,sign-in-routes,evm-link,evm-routes}.ts`, `services/api/src/providers/proofs.ts`, `services/api/src/{auth,server,main,limits}.ts`, `protocol/{api,service-api,routes}.ts`, `migrations/`, `tests/integration/{session-linking,sign-in-methods,account-links}.test.ts`.

**Existing frontend:** `src/views/Account.vue`, `src/components/{SignInMethods,LinkedAccounts}.vue`, `src/auth/{session,telegram-login,webauthn}.ts`, `src/api/client.ts`, `src/auth/destination.ts`, `tests/e2e/sign-in-methods.spec.ts`.

**Create:** core `protocol/sign-in.ts`, `services/api/src/auth/intent.ts`, `services/api/src/auth/telegram-oidc.ts`, `tests/integration/sign-in-intents.test.ts`; frontend `tests/e2e/paired-login.spec.ts`. Use the existing `jose` dependency for verified OIDC, not a second generic authentication framework.

- [ ] Define producer-owned login/pair/unpair intent schemas and capabilities. Keep existing session/account DTO compatibility explicit; consumers must not duplicate request models in `client.ts`.
- [ ] Add an additive migration for operation-specific challenges, bounded attempts, verified credential provenance and originating credential/session authentication metadata. Enforce ownership uniqueness and expiry/consumption constraints. Test upgrade from `0.4.0-alpha.1` and rollback of failed attempts without allowing proof reuse.
- [ ] Require fresh existing-identity authorization for credential changes. Bind both proofs to the same operation, account and browser attempt; invalidate affected sessions on removal. Cover Telegram/email/passkey/EVM routes and older generic provider routes, rather than fixing one button while retaining another weaker entry point.
- [ ] Integrate Telegram OIDC web entry and Mini App entry as separately validated proof formats. Keep legacy widget compatibility only while needed. Test current JWKS/key rotation, wrong audience/issuer, attempt/state mismatch, expired/replayed proof, identifier continuity and explicit re-pairing when continuity cannot be demonstrated.
- [ ] Add one environment-configured email delivery adapter with redacted errors and bounded resend behavior. Keep local revealed codes local-only. Test account-existence-neutral responses, wrong/cross-attempt code, guess exhaustion, concurrent consume, delivery failure and resend invalidation.
- [ ] Build one returning-user entry screen; retain passkey/recovery options. Present paired methods and unavailable configuration clearly. Preserve `returnTo` through login and let the DAO screen explain admission separately. Do not force vault unlock to browse.
- [ ] Add pair/remove history and an explicit review step describing account-control scope. Test session theft alone cannot attach a new method, last-control-path removal is rejected, and a new incoming credential cannot approve its own pairing.
- [ ] Write matching account/login/recovery docs and a provider setup runbook without secrets. Record actual live mail/Telegram credentials and client access as external prerequisites; fixtures are development evidence only.

**Exit gate:** paired email and Telegram sessions resolve the existing account, do not unlock the vault or alter DAO rights, and complete browser navigation/recovery flows. Both proof verification and account-change authorization have concurrency/negative tests. Live provider capability labels remain unavailable until separately exercised.

## N2 — Telos Zero wallet login and signing

**Existing core:** `contracts/runtime/runtime.cpp`, `contracts/common/records.hpp`, `sdk/index.ts`, `services/api/src/{chain,native-chain,server}.ts`, auth/session and protocol files from N1; `tests/native/{runtime,dispatch,permission}.test.ts`.

**Existing frontend:** `src/auth/session.ts`; every caller in `src/components/{Admission,Content,File,Governance,Modules,Profile,Treasury}Panel.vue` and `src/views/{Workspace,PlatformDao}.vue`; Account, LinkedAccounts and producer SDK consumers.

**Create:** core `services/api/src/auth/native-proof.ts`, `tests/integration/native-sign-in.test.ts`, `tests/native/paired-wallets.test.ts`; frontend `src/auth/telos-zero.ts`, `src/auth/action-signer.ts`, `tests/e2e/native-wallet.spec.ts`.

- [ ] Qualify and pin the supported wallet integration from the maintained WharfKit source. Demonstrate a proof whose signed bytes bind the outstanding challenge, correct native chain, selected account/permission and expiry. Inspect real threshold evaluation; list unsupported authority structures instead of approximating them.
- [ ] Add native service pairing/login schemas and routes. Require dual consent, unique chain/account ownership and the explicit account mapping. Reject unsigned wallet connection metadata and unknown pairings. Test authority changes, revoked keys, wrong permissions, chain mismatch, copied callback state and concurrent pairing to two accounts.
- [ ] Connect `linknative` using a transaction authorized by the incoming wallet and the existing identity. Complete unbinding/replacement and scoped-session invalidation with no extra member/weight. Verify chain confirmation before showing governance authority active or removed.
- [ ] Route signing through one common action dispatcher with actual choices: local Daclify key or native wallet. Reuse canonical `makeInstruction`/generated action encoders and `submitnat`. Inspect **all callers** of `relayInstruction` and vault-based button guards so direct signing works throughout the app.
- [ ] Replace generic `vaultUnlocked` action eligibility with the available permitted signer. Keep encryption/read/publish operations that need plaintext keys guarded by decryption capability. Do not let a native signing option bypass private-file preparation or epoch-grant validation.
- [ ] Test voting, Works submission/review, permitted administrative actions and withdrawals with the vault locked. Include wrong DAO, inactive actor, insufficient role/grant, account change mid-prompt, user cancellation, nonce conflict, wrong destination and no duplicate vote/claim.
- [ ] Publish tested wallet/client/permission support and resource requirements. Provide direct compatible native submission guidance for user-controlled accounts; hosted service downtime must not become signing authority.

**Exit gate:** native login opens the same account; linked Zero authority executes permitted actions without Daclify signing keys in memory. Private content still requires encryption keys. Actual native permission/inline behavior passes; a wallet-plugin mock alone is insufficient.

## N3 — Telos EVM login and direct governance

**Existing core:** `services/api/src/auth/{evm-proof,evm-link,evm-routes}.ts`, `contracts/runtime/runtime.cpp`, `contracts/common/records.hpp`, `sdk/index.ts`, `protocol/{api,service-api,base}.ts`, `tests/evm-proof.test.ts`, `tests/integration/account-links.test.ts`.

**Existing frontend:** `src/auth/telos-evm.ts`, `src/components/LinkedAccounts.vue`, N1 entry UX and N2 action dispatcher. **Create:** core `sdk/evm.ts`, `contracts/common/evm_authorization.hpp`, `tests/evm-instruction.test.ts`, `tests/native/evm-governance.test.ts`, `docs/decisions/evm-governance-verification.md`; frontend `tests/e2e/evm-wallet.spec.ts`.

- [ ] Implement standard ERC-4361 login with independently scoped pairing/unpairing intents. Extend current address recovery only behind canonical parsing, expected origin/URI, chain, address, nonce and expiry checks. Test personal-sign login signatures cannot authorize governance or another operation.
- [ ] Freeze versioned EIP-712 byte encodings against the design: native chain/runtime domain, EVM chain/address, DAO/member, binding epoch, target/action/data commitment, shared nonce and expiry. Include exact vectors generated independently of Daclify's own encoder; test every domain/payload field by changing it separately.
- [ ] Complete the **early C++ feasibility spike**: select a compatible reviewed/licensed Keccak implementation, prove K1 recovery/address derivation and canonical signature checks on compiled WASM and the real native runtime, and measure bounded CPU/RAM costs. Record curve/signature format handling. A failed spike keeps direct signing unavailable; never substitute a trusted backend signer and call it equivalent.
- [ ] Add separate on-chain EVM binding records and signed bind/revoke actions. Existing member and incoming EVM proofs must agree on the full operation. Preserve existing member/table layouts, reject duplicate bindings in a DAO and reconcile the service projection against confirmed chain state.
- [ ] Implement the qualified EOA submission path in C++, then reuse `validate_instruction`/`dispatch`. Consume the same member nonce across K1, Zero and EVM paths; contract roles, module pin/grants, guardian pause and liabilities stay authoritative. Validate malicious relayer and direct submit attempts without relying on API prechecks.
- [ ] Expose separate EVM **login** and **direct governance** capabilities. Add wallet account/chain-change listeners, exact typed-action confirmation, cancellation and safe retry to the common dispatcher. Old service pairings need fresh control proof and explicit governance activation; no automatic authority migration.
- [ ] Extend VERT/native/browser suites with wrong signature/recovery/canonical form, changed target/data, replay across chains/runtimes/DAOs/members, old binding epoch, parallel nonce consumption, revocation and upgrade fixtures. Test the existing K1/native wire paths still work.
- [ ] Keep ERC-1271 direct governance gated until an authenticated runtime validation package is qualified. Show unsupported contract-wallet behavior explicitly. Do not advertise EVM token voting, EVM payouts or bridging from successful EOA signing.

**Exit gate:** independently generated EVM wallet signatures authorize the intended C++ action, and altered/replayed/unauthorized instructions fail in the real runtime. User-controlled signing works without a vault unlock. New-device private-content recovery remains a separate flow.

## N4 — DAO discovery and branding

**Existing core:** `protocol/{dao,api}.ts`, `services/api/src/native-chain.ts`, `contracts/runtime/runtime.cpp`, content upload/metadata validation, `tests/documentation.test.ts`. **Existing frontend:** `src/views/Hub.vue`, `src/state/workspace.ts`, `src/styles.css`, create/settings metadata flows. **Create:** frontend `src/components/DaoCard.vue`, `tests/e2e/dao-directory.spec.ts`; core `tests/dao-branding.test.ts`.

- [ ] Add a backward-readable, explicitly versioned display-metadata extension for optional logo/cover CIDs and a concise summary. Preserve immutable purpose/setup provenance and the measured metadata byte limit. Do not quietly broaden `setmeta` to alter a creation preset or privacy policy.
- [ ] Render original Daclify cards with cover fallback, logo/initials, title, purpose, member count, network/deployment and one meaningful primary link: View DAO or Open workspace. Provide join guidance on the destination page; avoid nested interactive controls.
- [ ] Move search/purpose/my-community/sort state into the URL. Use complete DAO references for membership matching and keys. Keep existing configured-runtime scope honest; multi-runtime discovery/routing remains its separately tracked foundation package.
- [ ] Extend existing paging rather than adding a search service. At current scale, filter the fully retrieved bounded directory; expose truncated/unavailable results accurately. Introduce producer-side filtered pagination only with a specified deterministic order/cursor and measured need; never imply a first-page client filter searches the entire directory.
- [ ] Use only validated portable CIDs/approved retrieval paths for hosted logos/covers, safe MIME/size limits and stable aspect ratios. Do not load arbitrary HTML/SVG scripts or proxy arbitrary remote URLs. A private DAO can choose a sparse listing; a card setting cannot hide chain metadata.
- [ ] Test mobile overflow, image fallback, long names, screen-reader/focus behavior, URL restoration, visitor/member/removed-member state, malformed metadata/CIDs and stale results. Show only real producer counts; interface compatibility/code verification is not a security certification.

**Exit gate:** users can find and open a DAO without understanding contract identifiers, while membership/privacy/deployment labels remain accurate and older metadata still renders.

## N5 — Contribution agreements and service coordination

**Existing modules:** `contracts/works/works.cpp`, `contracts/common/works_records.hpp`, `protocol/{index,api}.ts`, `tests/{works,governed-works}.test.ts`, `tools/{build,codegen}.ts`. **Existing frontend:** `src/components/ModulesPanel.vue`, Content/File panels. **Create:** modules `protocol/agreements.ts`, `tests/contribution-agreements.test.ts`; frontend `src/components/ContributionAgreementPanel.vue`, `tests/e2e/contribution-agreements.spec.ts`.

- [ ] Freeze a versioned agreement document: contributor member, scope/deliverables, term, native compensation asset, milestone amounts/dues, review policy and cancellation policy. Keep private narrative/evidence encrypted; use typed contract references/commitments for enforceable terms. A title such as Treasurer or Developer grants no role.
- [ ] Add a small Works agreement/consent record referencing the exact Works project and document version. Require the designated contributor's signed acceptance before funding an agreement. Freeze the commitment on acceptance; changing terms requires fresh consent and a successor project under the cancellation rules.
- [ ] Reuse governed Works funding, full-project reservation, evidence submission, DAO's actual reviewer/admin policy and self-review exclusion. Label it DAO review team unless a specific reviewer restriction is genuinely enforced on chain. Do not claim a named reviewer field restricts a contract that still accepts every eligible reviewer.
- [ ] Begin with milestone agreements using the current single native Treasury asset. Existing Payroll remains separate recurring compensation. A later recurring-agreement adapter needs an explicit period/obligation mapping before linking both; never create duplicate compensation obligations for one accepted period.
- [ ] Add template/list/filter/detail UI for roles/projects and optional member service offers. Treat the first service catalogue as searchable agreement templates/listings leading into Works, **not** a new exchange/escrow ledger. Keep it distinct from the platform's module Marketplace.
- [ ] Explain cancellation/dispute authority before funds are reserved. Current Works cancellation preserves approved liabilities; retain that rule. Include an explicit revisions/dispute guidance path without pretending Daclify adjudicates quality or provides legal contract certification.
- [ ] Test consent from the wrong member, amended/version-swapped terms, duplicate funding, cross-DAO project IDs, self-review, insufficient backing, cancellation after an approved milestone and service/subscription expiry with a payable claim. Preserve ordinary pre-extension Works projects in upgrade fixtures.
- [ ] Write contributor/admin/reviewer guides and contextual templates/help. Keep basic creation, acceptance, evidence, review and claim access free; hosted coordination/reminders are optional paid operations.

**Exit gate:** an applicant and DAO can agree terms, approve funding, deliver/review a milestone and see the real once-only payment state. Contract consent and document commitments match the UI; no new money ledger exists.

## N6 — Spending and outcomes reports

**Existing core:** `protocol/treasury.ts`, `services/api/src/{chain,native-chain,server}.ts`, `protocol/service-api.ts`, Treasury/content projections. **Existing frontend:** `src/components/TreasuryPanel.vue`. **Create:** core `services/api/src/reporting/spending.ts`, `tests/spending-report.test.ts`; frontend `src/components/SpendingReportPanel.vue`, `tests/e2e/spending-reports.spec.ts`.

- [ ] Define producer-owned report DTOs for approved commitments, due/approved/paid obligations, internal beneficiary claims, actual external withdrawals and document/evidence references. Do not count an internal claim credit and its later withdrawal as two expenses.
- [ ] Preserve native token contract/symbol/precision and integer amounts. Separate evidence marked DAO-confirmed from actually verified native settlement. Show source chain/runtime/read time and whether the export is complete; a sequence of live page reads is not an atomic historic snapshot.
- [ ] Add readable filters and portable JSON/CSV export with optional categories/outcome-document references. Categories explain a record, not proof that a real-world purchase happened. Neutralize formula injection in untrusted CSV fields; no decrypted documents, private titles or credentials enter backend reports.
- [ ] Test complete pagination, denomination/remainder conservation, partial/unavailable reads, duplicate claim/withdrawal counting, cross-DAO access, private-document metadata, malicious CSV fields and expired hosted entitlements. Keep a basic complete portable export free.

**Exit gate:** an operator can reconcile reported commitments and payment states to authoritative source records. Premium dashboards cannot block manual claims, recovery or export.

## N7 — Grants rounds

**Create modules:** `contracts/grants/grants.cpp`, `protocol/grants.ts`, `tests/grants-rounds.test.ts`; extend `protocol/{index,api}.ts`, `sdk/index.ts`, `tools/{build,codegen}.ts`, generated schemas/docs and the first-party catalogue. **Existing core:** module install/config validation, `services/api/src/{chain,native-chain}.ts`, `contracts/common/governance.hpp` and the supported runtime callback boundary. **Create frontend:** `src/components/GrantsRoundPanel.vue`, `tests/e2e/grants-rounds.spec.ts`.

- [ ] Define programmes/rounds with immutable rule revision, application/review/award deadlines, native asset, maximum total awards and eligible participant policy. Support internal, native and verified EVM signers through the same member identity; eligibility is not a count of credentials.
- [ ] Implement draft → submitted → eligible/rejected → awarded/closed application states and round provenance. Submitted applications pin a versioned document and proposed Works milestones; revisions reset approval before the deadline, and frozen/funded terms cannot be edited in place.
- [ ] Add a narrow authenticated award-to-Works operation binding round, application, contributor, milestone commitment and decision reference. Reserve through existing Treasury/Works; atomically enforce both the round award cap and ordinary funding/DAO commitment limits. Do not authorize awards merely because an API says a ballot passed.
- [ ] Distinguish the round's maximum award cap from funds actually reserved. Initially reserve each accepted award in full using Works; disclose that an unfunded round cap is not an escrow or funding guarantee. Creating a cap cannot create backing.
- [ ] Start with DAO-funded awards. Ordinary DAO Treasury funding remains available; restricted donation pots, donor attribution and matching are a separate extension. Do not describe a token transfer memo as proof of an internal donor or quietly pool restricted donations.
- [ ] Implement apply/review/award/milestone/outcome screens using cards and existing document/key flows. Private application bodies remain encrypted; application existence, votes, funding recipients and native money metadata remain observable.
- [ ] Test deadline edges, amended applications, inactive/agent eligibility, changed round rules, funding/cap concurrency, duplicate award/Works links, unbacked awards, cross-DAO references, forged result/callback, removal/upgrade with unpaid awards and once-only settlement.
- [ ] Register the new module under the existing Daclify DAO module process with explicit supported versions/code hashes/actions/grants. Do not give it generic ownership, credit issuance or unrelated member powers. Add conformance fixtures for shared and independent contracts even while hosted independent provisioning remains separate.

**Exit gate:** a complete programme → application → authorized award → Works delivery/review → native claim/payment → report journey passes. Matching/NFTs/external payments are not required or implied.

## N8 — Optional endorsement admission

**Create modules:** `contracts/endorse/endorse.cpp`, `protocol/endorsements.ts`, `tests/endorsements.test.ts`; extend catalogue/codegen/docs. **Existing core:** membership policy/enrolment in `contracts/runtime/runtime.cpp`, versioned public identity/admission schemas. **Existing frontend:** `src/components/AdmissionPanel.vue`; **create** `tests/e2e/endorsement-admission.spec.ts`.

- [ ] Enable an explicit opt-in admission policy requiring a configured bounded number of eligible endorsements, deadline and application commitment. Preserve current administrator admission as the default, with any override disclosed in the selected policy.
- [ ] Bind endorsements to the applicant's public identity and exact application revision. Distinct active members count once regardless of login/wallet credentials. Amended applications, stale/revoked endorsements and removed witnesses do not satisfy the current policy.
- [ ] Use a narrowly granted runtime admission operation with once-only consumption; admission adds neither credits nor roles unless separately authorized. Keep human/agent admission policies labelled; endorsements are not proof of unique personhood.
- [ ] Test duplicate credentials, self-endorsement, threshold changes, expiration, witness removal, application replacement, cross-DAO use, enrollment replay and admin override behavior. Explain outstanding private-content key grants after admission.

**Exit gate:** the configured on-chain admission rule is enforceable and auditable. A provider profile or an endorsement badge cannot bypass it.

## N9 — Elections and term delegates

**Existing modules:** `contracts/decide/decide.cpp`, `protocol/index.ts`, `tests/decide.test.ts`; **create** `protocol/elections.ts`, `tests/delegate-elections.test.ts`. **Existing core:** actor/role and governance policy code. **Create frontend:** `src/components/DelegateElectionPanel.vue`, `tests/e2e/delegate-elections.spec.ts`.

- [ ] Add bounded candidate nominations, member eligibility/weight snapshot, voting deadline, declared seat count, tie/no-quorum policy, durable results and term/recall records. Prefer a straightforward single-choice/approval policy to ranked or fractal election machinery.
- [ ] Preserve existing Decide yes/no governance behavior and finalized results. Different credentials cannot nominate/vote twice as the same member. Rules/options freeze before voting; membership and weight mutation follow the snapshot policy.
- [ ] First make delegates transparent representatives with term labels and **no automatic administrator or spending powers**. If a DAO wants delegated budgets, specify and implement authoritative expiry, recall, asset/action/amount limits and guardian controls as a separate capability before enabling it.
- [ ] Do not simulate expiring permissions by hiding a UI button while leaving a permanent admin flag. Preserve ordinary administrators, recovery, existing obligations and pending decisions when a term ends.
- [ ] Test nomination cutoff, repeated candidate/credential, late votes, ties, no quorum, recalled/expired terms, archived results, unsupported privileged execution and guardian limits. Document that a representative title is different from treasury authority.

**Exit gate:** repeatable elections select the declared outcome under frozen rules and show meaningful current/historic terms. Fractal grouping, meeting coordination and external randomness remain separate work.

## N10 — Documentation, versioning and verification

- [ ] Extend existing `docs/releases/requirements.json` registers with each requirement, invariant, test file, fixture version and actual result. Add generated reference/schema/ABI changes plus explanatory guides/topic IDs in both producers; consumers receive matching pinned bundles.
- [ ] Keep independent SemVer prereleases and exact compatible core/modules/frontend artifacts. Additive features do not justify rewriting all interface versions; breaking encoding/state/policy changes require explicit supported readers/migration. Preserve historical evidence/manifests instead of replacing them.
- [ ] Generate a new immutable tested manifest pinning commits, public artifact hashes, contract WASM/ABI hashes, documentation and qualified capabilities. Record provider/native/client checks as passed/failed/unrun independently; do not claim production qualification from fixtures or a generic verification exit code.
- [ ] Test clean setup and upgrades from the baseline with open ballots, paired credentials, encrypted envelopes, unpaid Works/payroll obligations, balances and pending chain-binding operations. Reconcile instead of erasing state to make a migration pass.
- [ ] Run the applicable full suite and final diff review. Deliver runnable setup/provider/deployment documentation and a review packet; no production deploy, authority change, real payment or registry publication without the separate authorization already required by repository policy.
- [ ] Confirm Community-IQ's actual grants, contributor/admission, wallet/client and reporting needs before the pilot. Pilot success means users finish the journeys and accounting/recovery checks pass, not that the cards resemble another product.

### Commands that exist at the baseline

Use Node 24.21+ in the Node 24 line and npm 11.19+ in npm 11. In three sibling **isolated checkouts**, core's `node tools/bootstrap.ts --contracts` builds development artifacts/contracts and wires consumers; it publishes no package and deploys no chain. Do not run setup against active user databases or another agent's fixture.

Core:

```sh
npm run build:contracts
npm run codegen
npm run docs:generate
npm run verify
npm run build
npm run test:integration
npm run test:native
```

Modules:

```sh
npm run build:contracts
npm run codegen
npm run docs:generate
npm run verify
npm run build
```

Frontend:

```sh
npm run verify
npm run build
npm run test:e2e
```

The database/native/browser commands require their documented isolated fixture configuration. Verify each suite executed nonzero relevant cases and inspect its exit status. Expected acceptance is successful relevant checks with no silent skip; these commands have **not been run for unimplemented features**. Add exact package-specific test commands and code-level regression steps when its files exist. Preserve the existing split between unit, PostgreSQL, VERT, real native, live providers and real Telegram/wallet clients.

## Later capabilities and concrete gates

| Capability | Add only after |
| --- | --- |
| Quadratic matching | Frozen Sybil/admission/exclusions policy, funded pool, deterministic integer allocation/rounding, reproducible independent calculations and once-only backed settlement. Multiple logins do not prove different people. |
| Recurring contribution agreements | Defined term/period/obligation identity and cancellation/accrual semantics integrating the existing Payroll ledger without duplicate payments. |
| Advanced marketplace | Actual demand for persistent orders, repeat purchasing/dispute authority beyond Works; reviewed cancellation/refund and fund conservation first. |
| NFT inventory/trading | Real gaming DAO demand plus verified ownership, asset/approval/finality adapters and custody/dispute tests; no EOS Market implementation reuse. |
| Delegated budgets/circles | Explicit bounded authority, authoritative expiry/recall, parent allocation conservation and preserved accrued liabilities. Labels/pages alone need no contract. |
| Fractal elections | Liveness/no-show/tie/randomness influence analysis, accessible meeting coordination and explicit privacy policy. |
| ERC-1271 governance | Authenticated contract-wallet validation on the selected Telos runtime, resource bounds and revocation/state-change tests. |
| EVM assets/payouts and other chains | Named asset/finality/verified-settlement adapter; login and a transaction hash are insufficient. |
| Cross-device key sync/passkey unlock | Reviewed encrypted envelopes, user-controlled recovery and actual browser/Telegram PRF/client support; never public signature-derived decryption keys. |

No external project source/assets are adopted by this plan. Reuse ideas; review licenses and code independently before copying any implementation. Paid features can meter hosted coordination, reminders, reporting dashboards and resource capacity. They cannot revoke governance membership, block approved claims/export/recovery or silently change custody.

## Completion record

This commit contains a plan and login design only. Implementation boxes remain unchecked. Inspection covered current producer schemas, login/pairing/contract paths, wallet capability gaps, module contracts and current official authentication standards. No new implementation, new-feature test pass or live provider qualification is claimed.
