# Module opportunities from Pomelo, EOS Market, Eden and Hypha

Research date: 2026-10-07. This is a proposal, not a claim that these modules have been implemented or that another project's contracts are safe to deploy. Sources were inspected without running their installation, deployment or test scripts. Dates below are the inspected default-branch commit dates, not proof that every branch or deployment is inactive.

## Recommendation

Prioritize **grants rounds**, **contribution agreements** and **clearer DAO discovery**. They extend the existing Decide → Works → Treasury flow. Add **member endorsements and term-limited delegates** when a real community wants those policies. Leave quadratic matching, NFT trading and cross-chain custody behind explicit feasibility and security gates.

Daclify already has milestones, reviewer checks, backed obligations, governance credits, ballots and bounded recurring payments. Renaming those features into five new contracts would create maintenance work, not new value. Use presets and better screens where the underlying rules already exist; create a module only where it adds a distinct contract state machine or policy.

Community-IQ is a useful first acceptance partner for the participation, grants and contribution flows. Its actual funding, admission and reporting requirements still need to be confirmed; this report does not assume it needs NFTs or investment products.

## Source snapshots and limits

| Input | Inspected revision | Commit date | Reuse assessment |
| --- | --- | --- | --- |
| Pomelo grants contract | `74b840e817c047e387aaeabfe5f82d484375f5f4` | 2024-11-03 | Strong grants-round domain reference; service closure is explicit; no top-level software license found in inspected tree |
| EOS Market | `930b8059e706eea6201874bfe46f71aab6504329` | 2023-11-19 | Prototype examples; unsuitable as Daclify's identity, custody or settlement foundation |
| EdenOS | `2d779d476f8bb6bc14dc30eadae9f7d70264b6fc` | 2022-07-29 | Useful C++ induction/election/distribution reference; repository has MIT license |
| Hypha legacy DAO contracts | `0bb10573ec03a9e1887c9f0143587b13bd556791` | 2024-05-29 | Role, assignment, budget and subscription reference; permissive license text present; this is a different codebase from current Hypha web |
| Hypha current web | `27764a361dbd3744f1671daa7ce3581831275722` | 2026-10-06 | Useful current directory/card source; root package declares MIT, but no standalone license file was found by the tree search |

Primary repositories: [Pomelo](https://github.com/pomelo-io/pomelo-grants-contract), [EOS Market](https://github.com/eos-market/eos-market), [EdenOS](https://github.com/gofractally/Eden), [Hypha contracts](https://github.com/hypha-dao/dao-contracts), [Hypha web](https://github.com/hypha-dao/hypha-web).

No code or artwork from these projects was copied into Daclify. Confirm applicable license and attribution requirements before any future source reuse. Hypha itself directs users to each component's license and asks commercial/white-label users to contact its team. A public repository is not a blanket license for every asset. [Hypha licensing](https://hypha.earth/website/licensing)

The supplied Eden site describes its community and governance philosophy, but its legacy marketing page is not evidence of current contract maintenance. The search result for “Eden Network” on Ethereum is a different project; it was excluded. Likewise, `docs.hypha.app` is an unrelated grants-management product and was excluded. [Supplied Eden site](https://www.edenoneos.com/)

## 1. Pomelo: grants programmes, with matching kept separate

**Verified:** the README explicitly says Pomelo has concluded. Its contract models seasons and rounds, grant publication states, supported token identities, donation records and matching statistics. It identifies an older audit link, which does not establish coverage of the inspected revision. [README](https://github.com/pomelo-io/pomelo-grants-contract/blob/74b840e817c047e387aaeabfe5f82d484375f5f4/README.md), [tables](https://github.com/pomelo-io/pomelo-grants-contract/blob/74b840e817c047e387aaeabfe5f82d484375f5f4/app.pomelo.hpp)

**Verified:** transfers are authenticated and checked against configured tokens. Social notifications only update matching when they originate from the configured login contract. Matching calculations use floating-point values and social-derived multipliers. Identity and oracle dependencies are therefore part of the result's trust model. [notifications](https://github.com/pomelo-io/pomelo-grants-contract/blob/74b840e817c047e387aaeabfe5f82d484375f5f4/src/notifiers.cpp), [token/oracle helpers](https://github.com/pomelo-io/pomelo-grants-contract/blob/74b840e817c047e387aaeabfe5f82d484375f5f4/src/getters.cpp)

**Proposal: `grants-rounds`.** A DAO defines a programme, application window, contribution window, eligibility policy, funding cap and review period. Applicants select an existing member identity, publish a versioned proposal, and submit milestones. Accepted funding becomes ordinary Works obligations; Treasury remains the only money ledger. Start with one native asset per round and explicitly distinguish voluntary donations from DAO-awarded grants.

Suggested journey: **programme → apply → eligibility review → funding decision → milestones → independent review → payment → outcomes**. Public rounds have public proposal cards. Private rounds encrypt application/evidence documents, while candidacy, votes, recipients and payments remain publicly observable under the current chain model.

Minimum new state is programme/round provenance, deadlines, applicant eligibility and application-to-Works linkage. Do not duplicate membership, token balances or milestone accounting. Donations must bind the actual payer, native token contract, symbol, exact amount and round reference; a typed memo is routing information, not proof of an internal donor's identity. Walletless donors need a documented funding/identity path. Governance credits are not spendable donations.

**Quadratic matching is a later capability, not the first release.** Creating many internal identities, social logins or agent keys is cheap. Square roots do not make them independent people. Before offering matching, select a Sybil policy, freeze eligibility and round rules, fund the matching pool, define exclusions/self-donations, publish deterministic integer rounding, and explain appeal/administrator powers. Human and agent participation should have explicitly separate matching eligibility where necessary.

A reviewed off-chain matching calculation can produce a reproducible allocation proposal for DAO approval. That is an attested calculation, not automatically a verified proof. On-chain settlement must still enforce pool backing, allocation sum, authorized recipients and once-only payment. A future proof verifier needs its own acceptance criteria.

Tests: deadline edges, application changes after approval, duplicate donor credentials, self-donation policy, wrong token/precision, matching pool insolvency, deterministic rounding conservation, allocation replay, cross-DAO reuse, removal/upgrade during unpaid awards, and confidentiality of application content.

Business fit: strong for NGO/community funding. Free programme and milestone basics; paid reporting, application coordination, notifications and large programme operations are plausible. Avoid charging recipients to claim already approved grants.

## 2. EOS Market: take the marketplace concept, leave the implementation

**Verified source findings:** `exchange.py` stores submitted passwords directly and performs a password equality query. Its NFT creation accepts a caller-supplied owner ID without a session-binding check in that handler. `smart_record.sol` records whatever NFT chain/address/token ID the caller supplies; it does not establish ownership or custody. These are source observations, not live exploitation findings. [exchange.py](https://github.com/eos-market/eos-market/blob/930b8059e706eea6201874bfe46f71aab6504329/exchange.py), [NFT registry example](https://github.com/eos-market/eos-market/blob/930b8059e706eea6201874bfe46f71aab6504329/smart_record.sol)

**Verified:** the “NFT deposit” example sends an `eosio.token` fungible-token transfer with a memo naming an NFT. That is not an NFT lock, verified bridge message or destination-chain mint. The local vault example stores its encryption key alongside its vault and prints a retrieved example key. No production custody qualification follows from that example. [deposit example](https://github.com/eos-market/eos-market/blob/930b8059e706eea6201874bfe46f71aab6504329/deposit_nft.py), [vault example](https://github.com/eos-market/eos-market/blob/930b8059e706eea6201874bfe46f71aab6504329/vault.py)

The inspected tree has no dependency lock or real test suite identified; `testcontract.sol` is a contract example. It references `Counters` and `_setTokenURI` without their definitions/imports in that file. I did not compile it and do not claim a compilation result. Some Solidity files carry MIT SPDX labels; no blanket repository license was found. [contract example](https://github.com/eos-market/eos-market/blob/930b8059e706eea6201874bfe46f71aab6504329/testcontract.sol)

**Proposal: DAO service marketplace**, initially as a Works configuration and frontend catalogue rather than a new escrow contract. Members advertise a service, buyer and provider accept immutable deliverables/price, funds are reserved, evidence is reviewed, and the existing obligation settles. Include cancellation, expiry and a clearly chosen dispute policy before accepting funds. A catalogue listing is not a quality guarantee.

A distinct marketplace module becomes justified when listings/orders need persistent independent states, shared search, repeat purchases or dispute authority beyond Works. It must use existing DAO/member references and the existing treasury; optional service charges cannot acquire owner authority.

**NFT assets/trading is lower priority.** Begin with a read-only verified inventory only if a gaming DAO asks for it. An asserted asset reference is not verified ownership. Native AtomicAssets and EVM ERC-721/1155 custody need separate adapters, actual ownership/control verification, transfer semantics, approval handling, metadata validation and settlement tests. Cross-chain escrow must wait for a verified bridge/finality model. The reviewed repository does not resolve that problem.

Tests: caller-supplied owner spoofing, wrong asset contract, transferred/burned NFTs, revoked approvals, payment/delivery atomicity, disputes, cancellation races, listing replay and malicious metadata. Use valueless local fixtures first.

Business fit: service coordination is plausible for communities and teams. NFT commerce should follow demonstrated demand; a marketplace is not improved by adding an unneeded exchange.

## 3. Eden: endorsements and accountable delegates

**Verified:** induction requires authorized existing members/witnesses, binds the applicant's profile and endorsement data, and checks endorsers remain active. Election actions include opting in, submitting a seed, group voting and processing bounded steps. Election and induction meeting data can carry encrypted participant keys. This is richer than an ordinary yes/no ballot. [induction actions](https://github.com/gofractally/Eden/blob/2d779d476f8bb6bc14dc30eadae9f7d70264b6fc/contracts/eden/src/actions/induct.cpp), [election actions](https://github.com/gofractally/Eden/blob/2d779d476f8bb6bc14dc30eadae9f7d70264b6fc/contracts/eden/src/actions/elect.cpp)

**Verified:** the inspected seeding code evaluates Bitcoin-header material in a time window and uses it for randomized election handling. Distribution code allocates native assets by member ranks and handles the unused remainder. These designs depend on their own rules and state; they are not drop-in Daclify modules. [election implementation](https://github.com/gofractally/Eden/blob/2d779d476f8bb6bc14dc30eadae9f7d70264b6fc/contracts/eden/src/elections.cpp), [distributions](https://github.com/gofractally/Eden/blob/2d779d476f8bb6bc14dc30eadae9f7d70264b6fc/contracts/eden/src/distributions.cpp), [MIT license](https://github.com/gofractally/Eden/blob/2d779d476f8bb6bc14dc30eadae9f7d70264b6fc/LICENSE)

**Proposal A: member endorsements.** Add an optional admission policy requiring N eligible member endorsements of a specific applicant identity and versioned application commitment, with expiry and revocation rules. The existing administrator/public-identity admission remains the simple default. Endorsements improve accountability; they do not mathematically prove one human per identity.

Internal accounts sign the same domain-bound instructions as other Daclify members. Native accounts can link to that identity. EVM authentication alone must not give an endorsement an additional vote. Agent admission uses declared operator information and the DAO's agent policy; do not describe a group of agents as human personhood verification.

**Proposal B: elections/delegates.** First support transparent candidate nominations, eligible-member snapshots and term-limited delegate outcomes through a reviewed Decide extension. Winner selection is distinct from administrator or treasury authority. If delegates receive spending power, use explicit bounded budgets, term expiry, recall and disclosed guardian controls, with existing obligations preserved.

Fractal small-group elections are an advanced follow-up. They require group assignment/randomness, no-show/timeout handling, tie rules, round transitions, meeting coordination, accessibility and privacy choices. A useful election cannot depend on every participant being awake, online and able to join the same video call. Do not port Eden's randomness or distribution rules without a separate analysis of adversarial influence and liveness.

**Small early feature: spending reports.** Export existing proposals, obligations and native payment evidence with categories and references. An expense classification explains a transaction; it does not establish that a purchase happened or verify an external-chain payment. Eden's companion expense explorer is a useful reporting reference. [Eden accounting standard](https://github.com/edenia/eden-spend-explorer)

Tests: endorsements on an amended application, removed witnesses, duplicate credentials, stale signatures, nomination cutoff, snapshot changes, ties, no quorum, term expiry, recall, randomness manipulation, delegate budget exhaustion and concurrent settlement.

Business fit: community leadership and NGO accountability. Basic elections and verifiable outcomes should remain free; hosted scheduling, reminders, reporting and meeting integrations can be paid services.

## 4. Hypha: contribution agreements and a directory people can understand

**Verified UI evidence:** the official quick-start page provides a network screenshot with cover images, overlapping logos, names, short descriptions, member/agreement counts, creation dates, search, category filters and sorting. Current source renders a fixed-height cover, avatar, truncated description, counts/date, skeletons and sandbox/demo/archive labels. I inspected the official image and source; live interactive browser access was unavailable in this session, so I do not claim a live runtime visual audit. [Official network screenshot](https://hypha.earth/__l5e/assets-v1/2bf8beb1-eb25-4bc0-b538-7d6cb186ef89/network-overview.png), [current card source](https://github.com/hypha-dao/hypha-web/blob/27764a361dbd3744f1671daa7ce3581831275722/packages/epics/src/spaces/components/space-card.tsx)

**Verified:** the current directory parses search/category/order/view inputs, fetches spaces and sorts before the initial render. The documented journey groups membership, governance, tokens, contributions and treasury under a Space. Documentation also marks some investment/ownership features as future and cautions that treasury audits are ongoing; these are not proven completed capabilities. [directory source](https://github.com/hypha-dao/hypha-web/blob/27764a361dbd3744f1671daa7ce3581831275722/apps/web/src/app/%5Blang%5D/network/page.tsx), [quick-start guide](https://hypha.earth/website/quick-start-guide)

**Proposal: a Daclify directory refresh using original styling.** Keep the current warm Daclify brand. Use a reserved cover area with a safe fallback, logo/initials, name, one purpose sentence, purpose label, membership count, deployment/network label and a clear action: Open workspace for members, View DAO for visitors, and Join instructions when admission is needed. Add search, purpose, my communities and sort controls with URL state and server pagination as the directory grows.

Do not display “verified DAO” merely because a logo exists or a Hub entry was registered. Distinguish interface compatibility, pinned code verification and independent ownership. Only show activity/agreements counts when backed by an actual producer field or indexer; do not invent them from member totals. Do not publish private application data, encrypted filenames or decrypted content in cards. A private DAO can choose a deliberately sparse public listing; public-chain metadata cannot be made invisible by a card filter.

Card acceptance: keyboard-operable single primary link; no nested interactive button inside it; 44px controls; accessible filter labels; consistent image sizing; safe URL/CID handling; no remote HTML/scripts; no overflow at mobile widths; stable skeleton layout; explicit unavailable/stale data; tests for malicious metadata and private/visitor/member states.

**Proposal: contribution agreements**, mostly better integration of existing Works and Payroll. A contributor chooses a role/project, publishes a versioned agreement defining scope, term, compensation asset, payment conditions and reviewer, obtains the required approval, submits evidence and sees payment status. Separate a job title/badge from actual authorization. Start with a single DAO treasury asset; multiple currencies require a real multi-asset ledger or verified adapters.

The legacy contracts provide role/assignment/budget proposal examples through a document graph. One budget implementation contains a commented-out circle membership check, so it should be treated as a design reference requiring authorization review, not copied as a security template. This observation is limited to that revision and function; it does not establish a live exploit. [proposal types](https://github.com/hypha-dao/dao-contracts/blob/0bb10573ec03a9e1887c9f0143587b13bd556791/src/proposals/proposal_factory.cpp), [budget proposal](https://github.com/hypha-dao/dao-contracts/blob/0bb10573ec03a9e1887c9f0143587b13bd556791/src/proposals/budget_proposal.cpp)

**Teams/circles are optional later policy.** A group label or nested page can initially organize projects without a new treasury or role hierarchy. A separate delegated budget/circle contract is justified only when the group needs its own bounded authority, membership, funding and lifecycle. Preserve full DAO references and prevent a child budget from escaping its parent allocation.

**Monetization lesson:** inspect feature plans without importing their governance effects. The legacy pricing source can cap enrollment and remove membership/permissions on plan downgrade when pricing is enabled. Daclify should instead meter hosted capacity and optional operations. Subscription expiry must not revoke governance membership, confiscate balances, prevent settlement, or block export/recovery. [legacy pricing behavior](https://github.com/hypha-dao/dao-contracts/blob/0bb10573ec03a9e1887c9f0143587b13bd556791/src/pricing/features.cpp)

## Suggested delivery order

| Priority | Work | New contract module? | Dependency / completion gate |
| --- | --- | --- | --- |
| 1 | Finish access/payment corrections and acceptance flows | Core correction | Actual native, PostgreSQL and browser evidence; production provider/release gates remain separate |
| 2 | DAO directory/card polish | No | Canonical public branding fields, accurate deployment claims, safe images and private-listing policy |
| 3 | Contribution agreements and expense exports | Usually no initially | Existing Works/Payroll flow, explicit terms, reviewer independence, accounting provenance |
| 4 | Grants rounds | Yes, minimal rounds/application state | Backed pool, deadlines, admission/eligibility, Works linkage, no duplicate treasury |
| 5 | Endorsement admission and ordinary delegate elections | Optional modules/extensions | A community-approved policy, identity/snapshot rules, expiry/recall and bounded authority |
| 6 | Quadratic matching | Separate gated capability | Funded matching pool, Sybil policy, deterministic calculation, appeals and adversarial tests |
| 7 | Fractal elections, circles, verified NFT inventory | Only with demand | Proven liveness/randomness/delegation or asset verification; distinct acceptance suites |
| 8 | NFT trading and external-chain payments | Separate adapters | Verified finality/custody/proofs, refunds, atomicity, provider and contract qualification |

These priorities are recommendations, not promises about development dates. The first three can improve the product without expanding its trust boundary much. Matching, delegated treasuries and bridges materially expand it.

## Cross-cutting requirements for every accepted module

- Antelope C++ owns authoritative transitions; module backend code lives in the modules repository and consumes published core host capabilities. Frontend consumes producer-owned schemas and reviewed components.
- Scope every record, signature, allocation and obligation to chain/runtime/DAO/member. Linking another credential does not create additional voting power.
- Publish independent module versions, compatible core ranges, generated ABI/schema/docs, upgrade readers and a tested release manifest. Keep configuration/execution policy revisions immutable for active work.
- Use integer monetary units and checked arithmetic. Reserve backing before accepting commitments; settle approved obligations once. Disabled modules and expired subscriptions preserve existing liabilities and exits.
- Encrypt protected narrative/evidence before Pinata; reference CIDs and commitments. Public governance metadata and payment traces remain visible. Key rotation protects future content, not data a former member already obtained.
- Show account mode, actual permissions, price, next step and error recovery in the UI. Social/Telegram login identifies a linked session; it does not silently grant membership, signing keys or decryption keys.
- EVM address linkage is currently association only. Native governance signing, EVM governance authorization, token custody and external settlement proofs are separate capabilities. Keep unsupported paths unavailable until their complete tests pass.
- Offer free core/basic modules and charge for optional hosting, automation, reporting, integrations and capacity. Maintain data export, recovery and approved financial rights after expiry. Avoid a new platform token merely to collect fees.

Before selecting a module, obtain one concrete workflow and policy from an actual DAO, then write its invariants and complete user journey. A catalogue full of vaguely configurable modules is a very efficient way to build a platform nobody knows how to use.
