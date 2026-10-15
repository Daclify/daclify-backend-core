# Quick ballots implementation and testnet launch

> **For agentic workers:** Use `superpowers:executing-plans` inline, task by task. The user expressly requested finishing Quick ballots and launching it on testnet. No subagents, repeated plan approval or unrelated deployment is required.

**Goal:** Deliver encrypted on-chain up/down ballots, account-wide participation, publicly verified final totals and guarded cleanup in the existing Daclify app, then deploy the matching testnet release.

**Architecture:** Core authenticates one canonical account across paired approval methods; the existing member-signing path still authorizes executive actions. A separate modules-owned `quickvote` contract maintains encrypted responses and frozen source commitments. The browser encrypts votes and produces tally proofs; the API never receives ballot secret keys or individual plaintext choices. Reuse existing RAM metering, encrypted key grants, archive verification/backup, account exit and release tooling.

**Tech stack:** Existing strict TypeScript/Zod, Vue/Vite, PostgreSQL, Noble 2.4.0, CDT 4.1.1 `-O=s`, Spring 1.2.2 and native/actual-WASM/browser checks. No new server, proof circuit, generic plugin loader or database service.

**Specs:** [Accepted product design](../specs/2026-10-14-quick-ballots-design.md), [qualified experimental proof](../specs/2026-10-14-quick-ballot-proof-protocol.md), and the rulings below. The prototype qualifies mathematical relations, not this product integration or an independent cryptographic audit.

## Global constraints and settled rulings

- Only current originating-DAO executives create ballots. Audience is all registered Daclify accounts or active members of 1–20 selected DAOs. One canonical account has one current response, irrespective of memberships or paired methods. This is not real-person uniqueness.
- Question ≤256 UTF-8 bytes; explanation ≤4,096; the initial release bounds retained response identities per ballot to 5,000. Finite bounds fail before allocation and have user-facing errors. Measure actual WASM/RAM/CPU before setting deployment capacity.
- No closing time is allowed; otherwise chain time closes voting at the exact deadline. Change/remove is allowed only while open. Public participation is distinct from hidden choices; only verified closed totals are shown.
- Readers are fixed when the ballot opens (user decision, 15 October). They are the originating DAO's then-current executives; selected audience DAOs gain no reader rights. Copied keys cannot be revoked. Lost keys never permit invented totals.
- Each ballot has its own encryption key and authenticated P-256 grants, separate from ordinary member/profile keys. Reuse existing grant encryption with a new ballot/recipient domain. Grant correctness and recipient failure must be visible; do not claim that publishing ciphertext proves every reader decrypted it.
- Keep the retained final proof, encryption public key, aggregate/count/source root and protocol/domain inputs on-chain. Individual rows become cleanup-eligible 2,592,000 seconds after the voting deadline or manual closure, not after a delayed finalization job.
- Existing rule: require a verified tally before pruning. The user is being asked whether unavailable tallies may instead be archived/pruned after 30 days while retaining “No verified result” and allowing a later proof. Do not assume that answer or implement dependent cleanup until it arrives.
- Originating DAO pays ballot/response/grant storage through existing metered funded allowances. Audience DAOs are never charged. Account authentication records use the core operator pool, with a 5,000-record initial bound and bounded inactive-record cleanup. No treasury, role or arbitrary execution authority is introduced.
- This is a testnet launch. Independent cryptographic review, production custody and mainnet release remain separate qualification gates; the UI/help must identify experimental encrypted voting honestly.
- Preserve existing Decide ballots, account identities, native ownership/authorities, pending claims, all historical fixtures and other workspace changes. New current contracts use pinned `-O=s`; historical rebuild flags/hashes remain unchanged.

## Review focus

1. A gateway attestation or paired login alone must not forge a vote, replace an account anchor or qualify another member's eligibility.
2. Switching approval methods, DAO memberships, devices, retries or account recreation must not add voting power; stale account/response nonces must fail.
3. No individual choice or secret/nonces may reach action arguments, API requests/logs, ordinary archives or analytics. Public counters must not disclose choice deltas.
4. A result must bind the complete frozen current response set; changed rows, omitted/duplicate rows, wrong keys/domains and malformed proofs must fail.
5. Archive/backup failures, missing keys, DAO closure, account deletion, interrupted batches and upgrades must preserve truthful results and safe resource accounting.

## Task 1 — Core account authorization

**Files:** core `contracts/common/quick_accounts.hpp`, `contracts/runtime/runtime.cpp`, `contracts/common/ram_families.hpp`, `protocol/quick-accounts.ts`, `sdk/quick-accounts.ts`, generated ABI/schema/release pins, `tests/quick-accounts.test.ts` and `tests/native/quick-accounts.test.ts`.

**Interfaces:**

- `QuickAccountAnchorSchema`: exactly one K1 public key, native active permission, or namespaced supported EVM EOA. `quickAccountIdentity(chainId, runtime, anchor)` hashes a canonical versioned packed anchor/domain. A service UUID or user-supplied identity string cannot replace this derived subject.
- The account service records an immutable anchor for its canonical existing account. Existing key accounts anchor to the original account key; wallet-only accounts anchor to their initial verified wallet. Later vault attachment or paired-method changes preserve it. Native registration requires the configured gateway's restricted authority plus actual anchor proof. The gateway can attest registration/censor issuance; it cannot sign as the anchor or change an existing subject's owner. Disclose the registration-service trust boundary.
- `qaccounts`: monotonic ID, immutable identity hash, one optional default approval credential, epoch, nonce and active/inactive time. A unique identity index prevents duplicate registrations. Do not copy profile fields or store multiple wallet tables. Cleanup preserves a global ID high-water mark; ballot deduplication uses the stable identity hash, never a reusable numeric ID.
- `qregister`, root-authorized `qdefault`, authenticated `qsubmit`/`qnative`/`qevm`, deactivation and bounded cleanup are restricted to Quick ballot purposes. Root proof always remains an option. Incoming default-wallet consent binds the exact change. Existing Account approval setup enables the default once; do not silently copy DAO spending authority.
- `quick_account_context` is a core-owned packed prefix identifying runtime/account ID and the actually proved credential. The instruction binds version, chain/runtime, account/epoch/nonce, expiry, exact target/action and bytes. Core forwards only `respond`/`remove` to a pinned Quick source with `execctx`; no arbitrary target or core action is allowed.
- Selected-DAO eligibility compares this proved credential to current native member signing/native/EVM records. Root/member rotation fails closed until an already approved current method is used. This avoids a redundant membership-link table. Public voters need no DAO membership.

- [ ] Write failing canonical identity/encoding/domain tests and native registration/denial tests.
- [ ] Implement producer schemas, encoding and native authentication; regenerate public artifacts with pinned compiler.
- [ ] Verify root, native and EVM paths; wrong gateway/anchor/target/chain, default substitution, expiry/epoch/nonce replay, deactivation/reactivation and registry exhaustion/cleanup. Check raw old runtime rows/permissions through upgrade.
- [ ] Review inline, record exact tests/resource measurements and commit the producer-owned change with capability disabled until compatible consumers exist.

## Task 2 — Modules-owned encrypted ballot state machine

**Files:** modules `contracts/quickvote/quickvote.cpp`, `contracts/common/quick_ballot_proof.hpp`, `sdk/quick-ballot-proof.ts`, `sdk/quick-ballots.ts`, protocol/catalog exports, build/codegen and actual-WASM/native tests. Consume only packaged core public headers; move the qualified math from the research helper rather than maintaining two implementations.

**Interfaces:**

- Ballot IDs are client-generated nonzero uint64 values and never reused: retain each bounded ballot summary permanently. This permits key/proof/grant generation before a single signed creation. Every proof context includes that ID and the immutable definition.
- `open` uses existing authenticated member context and current executive records, fixed question/audience/deadline/key/protocol and fixed executive recipient grants. Bound all strings/arrays before storage and total payload to the existing signed instruction limit. Measure the existing envelope size before fixing the recipient batch bound; use bounded staging only if a complete safe creation cannot fit.
- `respond`/`remove` require the core account context, current source pin and an eligible current credential. Store one row per `(ballot, stable account identity)`, with revision, active flag, ciphertext, validity proof, optional encrypted own receipt and update time. A removed response retains only its revision/identity tombstone while open. Monotonic row IDs and a `(ballot,row ID)` index support bounded snapshots/cleanup; an identity index enforces uniqueness. Store `dao_id` solely for resource ownership.
- Maintain the encrypted aggregate/count atomically. Never maintain public up/down deltas. Bind each response proof to the canonical identity and monotonically increasing row revision. A fresh request's account nonce and expected row revision reject races/replays.
- At closure, freeze voting and aggregate/count. `prepare` scans up to 25 canonical rows per action, builds a domain-separated SHA-256 rolling commitment over exact row bytes in increasing primary-key order, and independently recomputes aggregate/count. Finalize the source root only when the complete frozen set has been scanned and sums agree. This is a snapshot commitment, not a new commutative hash or a claim of secret tallying.
- `finalize` verifies the qualified decryption proof against authoritative frozen inputs and accepts only bounded up/down totals. Empty/cancelled aggregates use the same verifier. Reject any root/key/definition/submitted-input substitution. Final proof submission cannot reopen voting.
- Justify by-DAO discovery and due-work indexes; benchmark representative valid/rejected actions, maximum payloads and 5,000-row bounded preparation. Preserve exact historical verifier behavior/artifacts for later checks.

- [ ] Add failing state/authorization/proof/privacy/aggregate tests and port the existing independent vectors.
- [ ] Implement the minimum shared verifier and state machine, resource ownership and generated producer SDK.
- [ ] Verify changes/removals, concurrent versions, public nonmember voting, selected-DAO credentials, key/reader snapshots, manual/timed close, complete snapshots, invalid final proofs and bounded RAM/CPU.
- [ ] Review inline and commit compatible module/core producer pins without enabling the UI prematurely.

## Task 3 — API and existing account integration

**Files:** core `services/api/src/quick-ballots/{service,routes,chain,jobs}.ts`, existing server/native gateway/account-exit hooks, `protocol/quick-ballots.ts`, service API exports, and the next PostgreSQL migration for immutable canonical-account anchors. Use supported migration/rollback tests.

- [ ] Register bounded discovery/detail/own-response/preparation/submission routes through existing sessions, CSRF/origin checks, public schemas and typed errors. Do not accept plaintext choice or arbitrary relay actions.
- [ ] Derive canonical anchors from the existing account/verified signup identity in a transaction, preserve aliases/reconnection/vault attachment, and reject an attempted replacement. Registration attestation always uses actual active account state and a fresh exact user intent.
- [ ] Extend the existing default approval setup rather than create a second wallet account. Validate incoming consent and prepared action bytes before signing/relay. Rate/resource limits do not replace native authorization.
- [ ] Add bounded timed-closure/snapshot jobs through the existing worker pattern. Tally secrets remain in the client; unavailable clients leave a visible awaiting-proof state.
- [ ] Add native account deactivation/cleanup to existing exit/revocation behavior and make DAO closure explicit; do not retain disposable hosted identity/profile data in ballot tables.
- [ ] Exercise session/account/credential changes, stale prepared actions, retries, restart, SQL upgrade/restore, rate limits and service outage. Review and commit.

## Task 4 — Browser voting, private receipts and executive tallying

**Files:** frontend reviewed Quick ballot page/components/routes, existing sidebar/DAO navigation, approval setup/action signer, vault/key grant helpers, API client and focused unit/desktop/mobile browser tests.

- [ ] Add a simple Quick ballots view with question, audiences/deadline, participation, vote/change/remove controls and verified up/down totals. Keep the existing Decide governance feature intact.
- [ ] Executive creation generates a dedicated key locally and wraps it to the fixed reader snapshot with existing authenticated P-256 grants. Explicitly show public question text, readers and applicable managed-key custody. Never export secrets to the API.
- [ ] Generate ciphertext/validity proofs in a worker, validate every prepared signing payload against the local intent and selected default method, and clear private work on account/network/key changes.
- [ ] Encrypt own receipts to the existing account encryption key where available. For wallet-only accounts without that key, use a device-bound private receipt with an honest device-only recovery label; do not block otherwise authorized public participation or expose a plaintext choice in storage.
- [ ] Authorized executives decrypt grants and generate final proofs locally in a cancellable worker. Inspect row coverage/source root and every validity proof before publishing a result. Show awaiting/no-verified-result states when keys or evidence are missing.
- [ ] Test actual generated cryptography plus keyboard/focus/layout at desktop/mobile sizes. Keep fixture sign-in/wallet tests labelled; qualify a real testnet wallet separately when needed. Review and commit.

## Task 5 — Verified archival cleanup and lifecycle

**Files:** Quick source pruning/closure actions, existing core archive/source eligibility and account/DAO lifecycle integration, modules archive schema/exporter and API archive verification/backup paths, producer-owned help.

- [ ] Define canonical encrypted final-row export with complete coverage, source/schema/block domains, proof/public inputs and independent backup. Never include secret keys/nonces or plaintext choices.
- [ ] Add bounded retry-safe row pruning at the exact 30-day boundary, requiring irreversible closure, verified retrievable archive/backup and source coverage proofs. Never prune an open ballot or silently change frozen totals/root.
- [ ] Apply the user's unavailable-tally answer once received; otherwise retain the existing verified-result guard. Preserve the aggregate and verifier inputs for a valid late proof after any permitted row cleanup.
- [ ] Handle DAO closure without stranded resource records or requiring a nonexistent current executive after every member leaves. Qualify a narrowly scoped closed-DAO archive path rather than weaken existing ordinary archive approval.
- [ ] Exercise before/at/after boundary, missing/corrupt/wrong-domain/unavailable archives, interrupted batches, lost keys, deleted accounts, closed DAOs, ID reuse and historical upgrades. Review and commit.

## Task 6 — Complete qualification and coordinated release

- [ ] Run native end-to-end root/default-wallet registration → create → selected/public vote → change/remove → timed/manual close → snapshot → proof → archive/backup → cleanup, including public voters with no DAO and one user in multiple audience DAOs.
- [ ] Inspect actual browser/API/action/archive bytes for choice/secret leaks; deny nonreaders, test fixed historic readers and disclose inference/custody limits. Tests are not an independent cryptographic audit.
- [ ] Complete meaningful core/modules/frontend suites, strict types/Vue templates, generated docs, compatibility/migration/upgrade/source-loss recovery and pinned native resource checks. No absent/empty required suite may count as passed.
- [ ] Publish matching prerelease public artifacts, first-party module metadata/help and current-status/release evidence; preserve immutable historical downloads. Review the whole change inline and merge/push only owned changes to `dev`.

## Task 7 — Testnet deployment and live acceptance

- [ ] Prepare an immutable source/artifact release, private SQL/native/config rollback snapshot and freshly version-bound actual recovery drill before restarting the API. Preserve the working service while preparing.
- [ ] Prepare and simulate only the required runtime/Quick source/module pins, restricted `execctx`/gateway links and measured testnet resources. Review current authorities, costs and rows. No treasury payout, owner takeover, unrelated feature cutover or mainnet action.
- [ ] Deploy authorized testnet changes, confirm irreversibility and exact code/ABI/authority/resource pins, then publish API/frontend from the tested snapshot with atomic static publication and rollback on startup failure.
- [ ] Verify real public desktop/mobile paths, existing DAO/Decide/documents/MCP and selected Quick ballot flows. Record genuine live writes separately from owned synthetic checks. Commit/push delivery evidence and state any unqualified wallet/provider/security limits.

## Execution ledger

- 15 October: user clarified “Finish Quick ballots, then launch it”; prototype-only deployment is insufficient.
- Readers fixed when opening is confirmed. Unavailable-tally cleanup question is pending; its implementation remains conditional.
- Isolated sibling branches `feat/quick-ballots`: core `1ecb7c4`, modules `140abf1`, frontend `21d9760`. Previous proof qualification remains intact.
- Current testnet core alpha23 remains running. No restart/deployment/native authority change has occurred during this phase.
- Development disk was nearly full. Removed only owned Node/tsx compiler-cache files older than 24 hours (609,195,338 bytes); retained source, releases, database and backups. Continue measuring available space before native fixtures.
