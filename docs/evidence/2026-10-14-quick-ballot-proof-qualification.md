# Quick ballot proof qualification

Date: 14 October 2026. Scope: experimental mathematical relations on a disposable
local Spring chain. **Quick ballots are not implemented or enabled in the live
product by this change.**

The [machine evidence](2026-10-14-quick-ballot-proof-qualification.json) records
source SHA-256 pins, actual artifact/ABI hashes, measurements and limitations.
The [protocol specification](../superpowers/specs/2026-10-14-quick-ballot-proof-protocol.md)
defines exact encodings, equations and context requirements.

## Finding

An exponential ElGamal binary ballot with Chaum–Pedersen validity/decryption
proofs runs against pinned CDT 4.1.1 and Spring 1.2.2 BLS12-381 G1 intrinsics.
It needs no generic proof circuit or circuit-specific setup ceremony. The
construction follows [ElectionGuard's published explanation](https://electionguard.vote/concepts/Verifiability/);
this implementation is an experimental port, not an ElectionGuard-compatible
or independently audited deployment.

Native encoding/operation references are the pinned
[CDT BLS header](https://github.com/AntelopeIO/cdt/blob/v4.1.1/libraries/eosiolib/core/eosio/crypto_bls_ext.hpp)
and [Spring 1.2.2 crypto implementation](https://github.com/AntelopeIO/spring/blob/v1.2.2/libraries/chain/webassembly/crypto.cpp).

A dedicated ballot key permits authorized executives to read individual
responses. A response proof establishes an encrypted zero/down or one/up;
the final proof establishes decryption of a supplied aggregate. Product
authorization/state must independently establish the eligible accounts and
complete latest-response aggregate. The proof alone does neither.

## Actual checks

- The complete core unit suite passed **172 files / 1,036 tests**, including
  **11** new proof tests. No skipped tests were reported in that run.
- The dedicated native suite passed **19 tests**, using actual compiled C++
  WASM and an owned node, not a mock verifier.
- `tsc --noEmit --preserveSymlinks` and `tsc --preserveSymlinks` passed. The flag
  preserves declaration paths through this isolated checkout's immutable
  dependency links; no source type suppressions were introduced.
- Focused ESLint checks passed without warnings; Python vector regeneration
  reproduces the committed synthetic fixture exactly after JSON decoding.
- Independent Python standard-library group arithmetic supplies deterministic
  synthetic vectors. Native verification also accepts fresh randomized
  TypeScript proofs without receiving the private key.
- Rejected cases include malformed/noncanonical coordinates and scalars,
  off-curve and order-three points, wrong authority/context/ciphertext/total,
  identity keys/response nonce points and degenerate proof commitments.
- Aggregate checks cover replaced and removed responses, an empty set and
  cancellation of encryption nonce sums. These are mathematical aggregate
  checks; real account uniqueness, transaction races and root coverage await
  the product contract.

Initial failing tests preceded the primitive implementation, missing proof
helper and native proof actions. Inline review then found that zero proof
nonces or degenerate simulated commitments could satisfy the equations while
exposing a witness or branch information. Independent unsafe vectors produced
failing rejection tests in both implementations. Generation now resamples
simulated degenerate commitments and verifiers reject them. Legitimate
identity-aggregate tally commitments remain supported.

The probe is explicitly opt-in through `vitest.ballot-proof.config.ts`, whose
test discovery fails if empty. The ordinary native suite does not depend on an
unbuilt experimental artifact. Product native tests must be mandatory when
the actual feature is integrated.

## Native cost

The final probe compiled with **`-O=s -std=c++2a`** to **18,513 WASM bytes**.
Observed deployment code SHA-256:
`d8e5ae2934b4542b8180fdf7a0b06392da736d6c979630d8d06944141f98f8f0`.
The evidence distinguishes the binary on-chain ABI hash from the JSON ABI file
hash; they are not interchangeable.

| Successful action        | Samples | CPU minimum / median / maximum |
| ------------------------ | ------: | -----------------------------: |
| Key possession           |       2 |       1,518 / 1,963 / 2,408 µs |
| Binary response validity |       6 |     4,939 / 5,123.5 / 5,575 µs |
| Final decryption proof   |       6 |     1,879 / 3,571.5 / 3,698 µs |

The account's measured RAM remained **188,313 bytes** before/after the stateless
actions: **zero additional table RAM**, with deployment code/ABI RAM already
present. This does not estimate product storage cost per ballot or response.
The contract has no tables, stored fields or secondary indexes. Each action
requires its own contract account and at most 512 bytes of action data; the
probe never registers or counts a user's vote.

Rejected calls record RPC wall latency only. Failed RPC receipts do not expose
the same successful-action CPU measurements; do not present these latencies
as chain CPU or an abuse/load qualification. Local hardware/default fixture
limits also do not establish live-chain capacity.

## Client/prover cost

Ciphertext size is **192 bytes**, per-response validity proof **128 bytes**, and
the final proof **64 bytes**. These exclude serialization and product metadata.

| Synthetic responses | Encrypt all | Verify all | Decrypt, aggregate and prove | Observed Node RSS |
| ------------------: | ----------: | ---------: | ---------------------------: | ----------------: |
|                   1 |       44 ms |      48 ms |                        37 ms |           97.1 MB |
|                  32 |    1,077 ms |   1,289 ms |                       524 ms |           98.0 MB |
|                 128 |    4,255 ms |   5,316 ms |                     2,279 ms |          106.7 MB |

These assert-based Node 24.21.0 samples use synthetic keys/responses and the
already installed Noble 2.4.0 primitives. Observed RSS includes the process;
it is neither incremental cryptography memory nor blockchain RAM. No browser,
mobile device, production prover capacity or constant-time secret handling
has been qualified. No new production dependency was installed.

## Live target and baseline

Read-only metadata from `https://telostestnet.greymass.com` reports Spring
1.2.2, chain ID
`1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`,
and irreversible activation of `CRYPTO_PRIMITIVES` and `BLS_PRIMITIVES2`.
The snapshot's irreversible block is **450,232,849**. Exact activation blocks,
feature digests and capture time are in the JSON. `testnet.telos.net` returned
403 and the Caleos endpoint timed out during this investigation. No live proof
contract was deployed or invoked and no live authority was changed.

The isolated source base is `db84cf0`, core `0.15.0-alpha.23`, with the matching
historical modules `fff821c` and frontend `40b9430` source siblings. Initial full
suite failures came from absent generated/historical artifacts, MCP package
dependencies and required sibling checkouts. Providing exact immutable
release artifacts/dependencies and real sibling Git worktrees recovered those
checks; the final complete run passed. Historical fixtures were not rebuilt
with new flags. Parallel mini-app admission work was preserved.

## Remaining product gates

1. Core-owned account-wide authorization: public voters without DAO membership,
   canonical account deduplication and paired default approval methods.
2. Modules-owned ballot contract: executive creation, selected-DAO eligibility,
   authoritative domains/revisions/root/aggregate, deadlines and funded bounds.
3. Authenticated executive key grants, local proof generation, turnover/loss and
   disclosed managed custody. No operator access to user-controlled ballot keys.
4. API/SDK/frontend flows with byte-level privacy checks and ordinary simple stats.
5. Verified encrypted archives/backups and 30-day guarded cleanup, retaining
   the frozen public inputs and final proof for later verification.
6. Independent cryptographic review, browser/key-handling review and complete
   native authorization/accounting/concurrency/recovery/upgrade qualification.

The outstanding retention question concerns ballots with no available final
proof: the current design prevents pruning, potentially retaining RAM
indefinitely. An alternative allowing verified encrypted archival cleanup
while retaining the frozen aggregate and showing “No verified result” was
asked of the user; **it is not assumed or implemented here**.

Encrypted choices do not hide participation or transaction metadata, and
small/unanimous final totals may reveal choices by inference. Copied decryption
keys cannot be revoked retroactively. Passing these tests is not a production
privacy guarantee.

## Reproduction

Use the qualified dependency/artifact snapshots named above; do not overwrite
another checkout's dependencies or historical fixtures. Set the tool locations
to the pinned local installations and ensure native temporary storage has at
least 1 GiB free. This run used an owned node wrapper with a 99% disk threshold
on the 97%-used development disk; it did not change operator settings.

```sh
export DACLIFY_CDT_BINARY=/path/to/cdt/4.1.1/bin/cdt-cpp
export DACLIFY_NATIVE_NODEOS=/path/to/spring/1.2.2/nodeos
export DACLIFY_NATIVE_LIBS=/path/to/required/runtime/libs
./node_modules/.bin/tsx tools/build/ballot-proof.ts
./node_modules/.bin/vitest run tests/ballot-proof.test.ts
DACLIFY_BALLOT_PROOF_REPORT=/tmp/ballot-proof-report.json ./node_modules/.bin/vitest run --config vitest.ballot-proof.config.ts
./node_modules/.bin/tsx tools/research/ballot-proof-benchmark.ts
./node_modules/.bin/tsc --noEmit --preserveSymlinks
./node_modules/.bin/tsc --preserveSymlinks
./node_modules/.bin/vitest run
```

`tools/research/ballot-proof-vectors.py` regenerates the synthetic proof vectors
in `tests/fixtures/ballot-proof-vectors.json`; run in a temporary copy to compare
decoded JSON without mutating inputs during an active test suite. Secrets and
nonce constants in this generator are explicitly public synthetic fixtures,
never account or deployment keys.
