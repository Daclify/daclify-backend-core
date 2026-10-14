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
- Create `tools/build/ballot-proof.ts`: compile only this probe with the exact pinned toolchain and `-O=s`.
- Modify `tests/helpers/native-process.ts`: expose a bounded named-feature activation helper for the caller's disposable node.
- Create `tests/native/ballot-proof.test.ts`: real compiled-WASM capability and adversarial checks.
- Create `tests/fixtures/ballot-proof-vectors.json`: deterministic independently checked public vectors and provenance; no real voter data.
- Create `docs/evidence/2026-10-14-quick-ballot-proof-qualification.md` and companion JSON: exact environment, feature activation, artifact hashes, CPU, RAM and limitations.

**Interfaces:**

- Fixture produces `activateFeature(codename: string): Promise<void>` for its own node only; unknown names reject.
- Probe actions: `g1add(left: bytes, right: bytes, expected: bytes)`, `g1mul(point: bytes, scalar: bytes, expected: bytes)` and `g1check(point: bytes, subgroup: bool)`. Actions require the probe account's authority and bounded exact byte widths; no tables or public vote API.
- Later tasks consume the qualified curve encoding, scalar rules and measured native limits, not a mock verifier.

- [ ] Read the target's `get_info` and complete activated-feature list, binding chain ID and irreversible block. Record inaccessible endpoints honestly. Live feature metadata is not a successful contract invocation.
- [ ] Write failing native tests for generator addition/multiplication, identity, malformed sizes/coordinates, scalar boundaries, subgroup behavior and denied authority.
- [ ] Run the focused native test and record the expected missing-artifact/implementation failure.
- [ ] Implement the minimal probe/build entry point and isolated fixture feature activation.
- [ ] Run `vitest run --config vitest.native.config.ts tests/native/ballot-proof.test.ts`; require actual valid/invalid action results. Measure successful action CPU, artifact size and before/after RAM for this stateless probe.
- [ ] Commit only this task's files and report the tested scope. Passing this task does not qualify ballot encryption, final counting or a production cryptographic protocol.

## Task 2: Select and specify the smallest complete proof construction

**Files:**

- Create `docs/superpowers/specs/2026-10-14-quick-ballot-proof-protocol.md` in core.
- Extend `tests/fixtures/ballot-proof-vectors.json` only after the construction and exact byte transcript are fixed.

**Interfaces:**

- Produces immutable protocol identifier, curve/group parameters, public-key/nonce rules, canonical encodings, domain transcript, response-validity relation and aggregate-decryption relation.
- Binary ElGamal candidate: `(R = rG, S = rY + bG)`, `b ∈ {0,1}`. A disjunctive equality-of-discrete-log proof establishes valid encryption; a final equality-of-discrete-log proof establishes the aggregate count. Treat the port/domain binding as new code requiring review, not as an audited ElectionGuard deployment.
- Every proof binds the exact canonical chain/runtime/ballot/key/account/revision or final-aggregate context. A proof must not rely on a user-supplied verifier/key or reveal per-voter plaintext.

- [ ] Compare primary published specifications, implemented native operations and security assumptions. Do not port all of MACI when the requested binary tally does not need its other features.
- [ ] Pin one construction with complete equations/encoding and synthetic valid/invalid vectors. Define subgroup/identity rejection and zero-response/zero-aggregate behavior.
- [ ] Specify authenticated executive key grants, proof-of-key ownership, disclosure under managed custody, recipient turnover and recovery limitations. No new readers through audience selection.
- [ ] Define aggregate update equations for replacement/removal, latest-response commitment, count bounds, finalization and post-pruning proof verification.
- [ ] Review against all five focus cases. If required primitives or soundness properties do not qualify, document the exact failure and investigate the next candidate without weakening the accepted privacy/proof policy.

## Task 3: Qualify complete validity and tally proofs

**Files:**

- Extend `contracts/ballotprobe/ballotprobe.cpp` with the selected verification relations only after Task 2 defines them.
- Add a producer-owned experimental proof helper and focused tests in the modules repository; determine exact exports in the Task 2 protocol document, not by duplicating core identity models.
- Extend the native proof test and independent fixtures with complete encrypted-response and aggregate-tally vectors.
- Update the qualification evidence with measured valid/invalid-path costs and exact source/artifact pins.

**Interfaces:**

- Consumes the immutable Task 2 transcript and exact relation definitions.
- Produces client-generated synthetic ciphertext/proofs, actual native accepted/rejected results and an independent verifier/checker agreeing on those bytes.
- No product endpoint, real voter data, treasury/role power or production verification claim is introduced by the experimental helper.

- [ ] Start with failing tests for changed choice/total/key/domain, duplicate/removed revisions, invalid proof scalars/points, subgroup and identity attacks, zero-response and cancellation aggregates.
- [ ] Implement the minimum client generation and native verification using existing curve/hash primitives and bounded input sizes. Keep private key/prover data local.
- [ ] Verify independent vectors and both success/failure paths on actual WASM. Include separate accounts/ballots and concurrency/replay contexts in the fixtures.
- [ ] Benchmark acceptance limits and record proof/ciphertext bytes, CPU, native RAM and prover memory/time with actual input sizes. Do not infer general capacity from primitive-only measurements.
- [ ] Review security assumptions and archive/upgrade/recovery requirements before declaring the construction ready for integration. List external review or qualification still needed.

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
- Current checkpoint: Task 1 target metadata read; native primitive tests not yet run.
