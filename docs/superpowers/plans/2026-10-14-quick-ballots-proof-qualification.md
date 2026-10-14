# Quick ballots proof qualification implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` inline, task by task. The user has authorized execution; workspace instructions prohibit subagents. Track checks here and preserve unrelated workspace changes.

**Goal:** Establish a reproducible native verification path for encrypted binary votes and a publicly verifiable final tally before integrating Quick ballots into the product.

**Architecture:** Start with a stateless contract on an owned, disposable Spring fixture. Prefer an established ElGamal/Chaum–Pedersen binary-voting construction if its native operations and security requirements qualify; a generic SNARK is an alternative, not an assumed requirement. Freeze the protocol/domain/encoding decisions and measured limits before the product contract and producer interfaces are implemented.

**Tech stack:** Pinned CDT 4.1.1 (`-O=s`), Spring 1.2.2, strict TypeScript, existing Noble curve primitives, Vitest and the existing native-process fixture. No new production dependency or live-chain write is needed for the capability probe.

**Spec:** [Quick ballots design](../specs/2026-10-14-quick-ballots-design.md).

## Global constraints

- Votes remain on-chain as ciphertext; executives may read individual choices; final totals require public cryptographic proof.
- Preserve existing Daclify account/approval methods and Decide ballots. This phase does not authorize treasury actions, new live authorities or production deployment.
- One response per account, latest accepted revision, changed/removed votes and ballot/domain binding must survive the chosen proof construction.
- Individual rows become eligible for verified archival cleanup 2,592,000 seconds after closure, only after a verified final result, irreversibility, archive and backup.
- Keep prover witnesses and executive secret keys outside action arguments, ordinary logs, analytics and public archives.
- Compile new contracts with pinned `-O=s`; do not rebuild historical fixtures with different flags.
- Do not install over or commit other ongoing mini-app admission work. Use an isolated checkout and existing dependencies where compatible.

## Review focus

1. Curve points outside the intended prime-order subgroup must not create accepted votes or keys.
2. Vote changes/removals must update the encrypted aggregate rather than count historical revisions twice.
3. Valid mathematics for another ballot, key, account, revision or response snapshot must be rejected.
4. Public counter changes and raw signing/API bytes must not disclose individual choices.
5. Missing keys/proofs/archives must leave honest pending states and prevent premature deletion.

## Task 1: Verify the actual target and native primitives

**Files:**

- Create `contracts/ballotprobe/ballotprobe.cpp`: stateless BLS12-381 primitive probe, never a product ballot contract.
- Create `tools/build/ballot-proof.ts`: compile this probe and its current boot prerequisite with the exact pinned toolchain and `-O=s`.
- Create `vitest.ballot-proof.config.ts`: require the standalone experimental qualification file; do not make the default native suite depend on an unbuilt research artifact.
- Reuse `tests/helpers/native-process.ts`: activate the named feature through its existing feature-digest map and the owned boot action; no shared fixture change.
- Create `tests/native/ballot-proof.qualification.ts`: real compiled-WASM capability and adversarial checks.
- Create `tests/fixtures/ballot-proof-vectors.json`: deterministic independently checked public vectors and provenance; no real voter data.
- Create `docs/evidence/2026-10-14-quick-ballot-proof-qualification.md` and companion JSON: exact environment, feature activation, artifact hashes, CPU, RAM and limitations.

**Interfaces:**

- Fixture already exposes `featureDigests` and signed `action`/`push` operations; the qualification test activates only the supported `BLS_PRIMITIVES2` feature on its own node.
- Probe actions: `g1add(left: bytes, right: bytes, expected: bytes)`, `g1mul(point: bytes, scalar: bytes, expected: bytes)` and `g1check(point: bytes, subgroup: bool)`. Actions require the probe account's authority and bounded exact byte widths; no tables or public vote API.
- Later tasks consume the qualified curve encoding, scalar rules and measured native limits, not a mock verifier.

- [x] Read the target's `get_info` and complete activated-feature list, binding chain ID and irreversible block. Record inaccessible endpoints honestly. Live feature metadata is not a successful contract invocation.
- [x] Write failing native tests for generator addition/multiplication, identity, malformed sizes/coordinates, scalar boundaries, subgroup behavior and denied authority.
- [x] Run the focused native test and record the expected missing-artifact/implementation failure.
- [x] Implement the minimal probe/build entry point and isolated fixture feature activation.
- [x] Run `vitest run --config vitest.ballot-proof.config.ts`; require actual valid/invalid action results. Measure successful action CPU, artifact size and before/after RAM for this stateless probe.
- [x] Commit only this phase's files and report the tested scope in the qualification evidence. Passing the stateless probe does not qualify product voting or production cryptographic security.

## Task 2: Select and specify the smallest complete proof construction

**Files:**

- Create `docs/superpowers/specs/2026-10-14-quick-ballot-proof-protocol.md` in core.
- Extend `tests/fixtures/ballot-proof-vectors.json` only after the construction and exact byte transcript are fixed.

**Interfaces:**

- Produces immutable protocol identifier, curve/group parameters, public-key/nonce rules, canonical encodings, domain transcript, response-validity relation and aggregate-decryption relation.
- Binary ElGamal candidate: `(R = rG, S = rY + bG)`, `b ∈ {0,1}`. A disjunctive equality-of-discrete-log proof establishes valid encryption; a final equality-of-discrete-log proof establishes the aggregate count. Treat the port/domain binding as new code requiring review, not as an audited ElectionGuard deployment.
- Every proof binds the exact canonical chain/runtime/ballot/key/account/revision or final-aggregate context. A proof must not rely on a user-supplied verifier/key or reveal per-voter plaintext.

- [x] Compare primary published specifications, implemented native operations and security assumptions. Do not port all of MACI when the requested binary tally does not need its other features.
- [x] Pin one experimental construction with complete equations/encoding and synthetic valid/invalid vectors. Define subgroup/identity rejection and zero-response/zero-aggregate behavior.
- [ ] Specify authenticated executive key grants, proof-of-key ownership, disclosure under managed custody, recipient turnover and recovery limitations. No new readers through audience selection.
- [ ] Define aggregate update equations for replacement/removal, latest-response commitment, count bounds, finalization and post-pruning proof verification.
- [ ] Review against all five focus cases. If required primitives or soundness properties do not qualify, document the exact failure and investigate the next candidate without weakening the accepted privacy/proof policy.

## Task 3: Qualify complete validity and tally proofs

**Files:**

- Extend `contracts/ballotprobe/ballotprobe.cpp` with the selected verification relations only after Task 2 defines them.
- Keep the experimental proof helper and focused tests in core beside the probe. Publish modules-owned production exports only after integration qualification; do not duplicate core identity models.
- Add `tools/research/ballot-proof-vectors.py` for independent synthetic vectors and `tools/research/ballot-proof-benchmark.ts` for assert-based client measurements.
- Extend the native proof test and independent fixtures with complete encrypted-response and aggregate-tally vectors.
- Update the qualification evidence with measured valid/invalid-path costs and exact source/artifact pins.

**Interfaces:**

- Consumes the immutable Task 2 transcript and exact relation definitions.
- Produces client-generated synthetic ciphertext/proofs, actual native accepted/rejected results and an independent verifier/checker agreeing on those bytes.
- No product endpoint, real voter data, treasury/role power or production verification claim is introduced by the experimental helper.

- [x] Start with failing mathematical tests for changed choice/total/key/context, replaced/removed aggregates, invalid scalars/points, subgroup and identity attacks, empty and cancellation aggregates.
- [x] Implement the minimum client generation and native verification using existing curve/hash primitives and bounded input sizes. Keep private key/prover data local.
- [x] Verify independent vectors and fresh client proofs on actual WASM, including rejected contexts and forged totals. Real account/ballot concurrency and replay state remain Task 4 work.
- [x] Record proof/ciphertext bytes, successful native CPU/RAM and synthetic Node prover memory/time. Rejected paths report RPC wall latency, not unavailable failure-receipt CPU. Product acceptance limits remain unqualified.
- [x] Review the experimental code inline, fix degenerate nonce commitments with failing regression cases, and record remaining security/archive/recovery qualifications. This is not an independent cryptographic audit.

## Task 4: Continue into the product implementation

Task 3's qualified interfaces become the inputs to a detailed product execution plan. Continue inline under the existing authorization; do not re-ask settled product choices or enable an unqualified voting mode.

- [ ] Implement the dedicated modules-owned Quick ballots contract, account-wide core authorization and funded originating-DAO resource accounting with generated/pinned producer interfaces.
- [ ] Implement executive key setup/review and local tally-proof generation, API discovery/jobs, then the reviewed frontend creation/voting/results flows. No operator access to user-controlled executive keys.
- [ ] Integrate the exact encrypted-row/proof schema with existing verified archive/backup/pruning paths and the 30-day boundary.
- [ ] Complete authorization, privacy, proof, concurrency, replay, deletion/closure, recovery and upgrade tests; publish compatible SDK/help artifacts together.
- [ ] Prepare a testnet release and evidence. Any live owner/active authority changes, asset movement or production deployment retain their existing separate authorization boundaries.

## Execution ledger

- Product design accepted; execution authorized by the user's “ok lets do it.”
- Implementation method is inline. No delegation is authorized or required.
- Current checkpoint: stateless native qualification passes 19 tests; the complete core unit suite passes 1,036 tests in 172 files. See [measured evidence](../../evidence/2026-10-14-quick-ballot-proof-qualification.md).
- Task 2's production key-grant and response-root interfaces remain open; Task 4 is not implemented. No new product endpoints, published crypto SDK or live deployment are included.
- A policy question is pending about verified archive/cleanup of closed ballots whose final proof remains unavailable. Preserve the existing verified-result-before-pruning rule until answered.
