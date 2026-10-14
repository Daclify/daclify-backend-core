# Quick ballot proof candidate: encrypted binary tallies

Date: 14 October 2026. Status: experimental qualification specification;
not a production protocol or an independently reviewed deployment.

## Why this candidate

The requested question has two answers. An exponential ElGamal ciphertext can
hold a zero/down or one/up value; ciphertext addition produces an encryption of
the upvote total. A disjunctive Chaum–Pedersen proof establishes a valid binary
response, and a Chaum–Pedersen decryption proof establishes the final total.
This is the established construction described in
[ElectionGuard's verifiability guide](https://electionguard.vote/concepts/Verifiability/).
This candidate adapts that construction to BLS12-381 G1 and Daclify domains; it
does not claim ElectionGuard compatibility or inherit a review of this port.

No circuit or circuit-specific setup ceremony is required for this candidate.
It still requires review of the group assumptions, Fiat–Shamir transcript,
randomness, point validation, implementation and application integration.

## Parameters and canonical encoding

- Group: the standard prime-order BLS12-381 G1 subgroup; standard generator `G`.
- Base field `p`: `0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab`.
- Group order `q`: `0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001`.
- Point: exactly 96 bytes, canonical 48-byte little-endian affine `x || y`,
  matching pinned CDT/Spring BLS intrinsics. Identity is 96 zero bytes.
- Scalar: exactly 32 little-endian bytes, integer in `[0,q)`. Secret keys,
  encryption nonces and fresh proof nonces are in `[1,q)`.
- Ciphertext: exactly 192 bytes `R || S`.
- Hash: SHA-256 over the exact byte transcript below; interpret its digest as a
  big-endian integer and reduce modulo `q` for a challenge.
- A tag is its literal UTF-8 bytes followed by one zero byte. Contexts are
  exactly 32 bytes. Counts/revisions use unsigned 64-bit little-endian integers;
  key epochs use unsigned 32-bit little-endian integers.

Every input point must have canonical coordinates, be on-curve and be in the
prime-order subgroup. Curve membership alone is insufficient: the native probe
accepts `(0,2)` for a curve-only operation, but the subgroup check rejects it.
Reject identity public keys and identity response `R`; response `S` and aggregate
points may legitimately be identity. Do not silently reduce noncanonical input
coordinates or proof scalars. Both client and native verifier enforce these
rules. The security assumption is decisional Diffie–Hellman in the chosen group
and the random-oracle model for the Fiat–Shamir transform; review it explicitly.

## Authoritative application contexts

The product contract derives a base byte sequence from authoritative state:
`chain_id[32] || runtime_name[8] || ballot_id[8] || definition_hash[32] || key_epoch[4]`.
Antelope names and integers use their packed little-endian representations.
Here `definition_hash` commits to the question, origin, audience, closing rule
and declared reader policy before key generation. The public key is bound in
each proof transcript below, avoiding a circular key-generation context.

- Key context: `SHA256(tag("daclify.quick-ballot.context.key.v1") || base)`.
- Response context: `SHA256(tag("daclify.quick-ballot.context.response.v1") || base || account_identity[32] || revision[8])`.
- Tally context: `SHA256(tag("daclify.quick-ballot.context.tally.v1") || base || response_root[32] || count[8] || aggregate_ciphertext[192])`.

The global account identity/response-root producer interfaces belong to the
later product integration. They cannot be arbitrary client claims. The
qualification probe accepts an explicit context solely to test the cryptographic
relation; it has no authoritative ballot, account registry or voting API.

## Key generation and possession proof

Generate secret `x` uniformly in `[1,q)` and public key `Y=xG`. Generate a fresh
uniform `w` in `[1,q)` and compute `A=wG`.

`c = Hq(tag("daclify.quick-ballot.key.v1") || context || Y || A)`;
`z = w + cx mod q`.

Publish the possession proof `c || z` (64 bytes). Verification reconstructs
`A=zG-cY` and checks the challenge. A valid public key must be nonidentity.
Fresh CSPRNG randomness and rejection sampling are required; deterministic
constants are used only in clearly synthetic independent test vectors.
Reject an identity reconstructed `A`: a zero proof nonce can expose `x` through
the published challenge/response even though the verification equation holds.

## Encrypted response and binary-validity proof

For choice `b ∈ {0,1}`, generate fresh `r` and compute `R=rG`, `S=rY+bG`.
Reuse neither encryption nonces nor proof nonces across revisions or ballots.

For the real branch `b`, generate fresh `w` and set `A_b=wG`, `B_b=wY`.
For simulated branch `j=1-b`, generate uniform `c_j,z_j ∈ [0,q)` and compute:

`A_j=z_jG-c_jR`; `B_j=z_jY-c_j(S-jG)`.

`h = Hq(tag("daclify.quick-ballot.response.v1") || context || Y || R || S || A_0 || B_0 || A_1 || B_1)`.

Set `c_b=h-c_j mod q`, `z_b=w+c_b r mod q`.
Publish `c_0 || z_0 || c_1 || z_1` (128 bytes).
Resample a simulated branch if either commitment is identity; verification
rejects identity `A_0,B_0,A_1,B_1` to exclude degenerate nonce disclosures and
branch markers. This restriction is part of this candidate's transcript rules.

Verification reconstructs both branches from ciphertext and proof scalars,
recomputes `h`, and checks `c_0+c_1 mod q == h`. Bind the account, revision,
definition and encryption epoch through the authoritative response context.
The proof does not prove that the browser encrypted the voter's intended click;
reviewed clients, local decryption/receipt checks and honest UI remain necessary.

## Aggregate and final decryption proof

The product contract maintains accepted ciphertext sums and active response
count. Replacement subtracts the previous ciphertext and adds the new one;
removal subtracts the previous ciphertext and decrements count exactly once.
Freeze the aggregate, response-set root and count on closure. Public plaintext
up/down counters are never updated alongside individual response transactions.

For aggregate `(R,S)`, total responses `N` and claimed upvotes `U`, require
`0 <= U <= N <= 2^64-1`. The downvote total is `N-U`.
Let `D=S-UG`. An authorized secret-key holder proves `log_G(Y)=log_R(D)`:

Choose fresh `w`; `A=wG`, `B=wR`.

`c = Hq(tag("daclify.quick-ballot.tally.v1") || context || Y || R || S || N[8] || U[8] || A || B)`;
`z=w+cx mod q`.

Publish `c || z` (64 bytes). Verification reconstructs `A=zG-cY`, `B=zR-cD`
and checks the challenge, rejecting identity `A` to exclude a zero nonce.
Identity `B` remains allowed when aggregate `R` is identity.
Correct zero-response and zero-aggregate cases use
the same equations; identity aggregate points are allowed. A missing key/proof
leaves the product ballot pending, including an empty ballot, unless a later
reviewed product rule explicitly finalizes a mathematically empty set.

The final proof alone does not establish voter eligibility or source coverage.
The native contract must supply its frozen aggregate/count/context, verify all
accepted response proofs, and maintain uniqueness through authorization/state.
An independent checker recomputes the sum/count/root from the canonical archived
response set and verifies the same relation. Proof-byte uniqueness is never a
replay or double-voting defense.

## Executive access and retained evidence

For individual response `(R,S)`, a holder of `x` computes `S-xR` and compares it
to identity/down or `G`/up. Share only this dedicated ballot key, through
authenticated per-executive encryption grants. It is separate from signing,
profile and ordinary DAO-member content keys. Managed-key recovery disclosures
and turnover/historic-read limits follow the product design; keys already copied
cannot be revoked retroactively.

Retain the final result, 64-byte proof, public key, frozen aggregate/count/root
and exact protocol/context commitments on-chain. Each retained field supplies a
public input needed to verify the accepted decryption independently of an
archive; measuring its table RAM belongs to the product implementation.
Archive ciphertext rows, proof/public inputs and the qualified historical
verifier artifacts; never archive `x`, encryption/proof nonces or plaintext
individual choices. Reclaim row RAM only after the full 30-day/irreversible
result/archive/backup gates. Participation and small/unanimous-result inference
remain disclosed limitations.

## Qualification boundary

The [measured evidence](../../evidence/2026-10-14-quick-ballot-proof-qualification.md)
qualifies these relations against actual local WASM, independent Python vectors
and fresh client-generated proofs. It does not constitute independent
cryptographic review. Browser side channels, production key custody/grants,
authoritative account eligibility/uniqueness, response-root maintenance, funded
resource accounting, archive coverage and live-chain execution remain untested.
JavaScript BigInt computations are not a constant-time secret-handling guarantee.

## Experimental interfaces for qualification

Keep the prototype in `tests/helpers/ballot-proof.ts` in core, beside the native
probe. It is not a published SDK or a production cryptography API. Moving the
qualified first-party implementation into modules and releasing producer-owned
schemas is part of the product integration plan.

- `createBallotKey(context: string): { secret: string; publicKey: string; proof: string }`.
- `verifyBallotKey(context: string, publicKey: string, proof: string): boolean`.
- `encryptBallotChoice(context: string, publicKey: string, choice: number): { ciphertext: string; proof: string }`.
- `verifyBallotChoice(context: string, publicKey: string, ciphertext: string, proof: string): boolean`.
- `addBallotCiphertexts(left: string, right: string): string` and `subtractBallotCiphertexts(left: string, right: string): string`.
- `decryptBallotChoice(secret: string, ciphertext: string): 0 | 1`.
- `proveBallotTally(context: string, secret: string, ciphertext: string, count: bigint, up: bigint): string`.
- `verifyBallotTally(context: string, publicKey: string, ciphertext: string, count: bigint, up: bigint, proof: string): boolean`.

Strings are lowercase canonical hex of the exact widths above. Native probe
actions are `validkey(context: bytes, key: bytes, proof: bytes)`,
`validvote(context: bytes, key: bytes, ciphertext: bytes, proof: bytes)` and
`validtally(context: bytes, key: bytes, ciphertext: bytes, count: uint64,
up: uint64, proof: bytes)`. They remain owner-authorized stateless qualification
actions; they are not a voting API. Tests must reject wrong contexts, false
binary choices, noncanonical/subgroup inputs, changed totals and stale proofs,
and cover replacement/removal and identity aggregates with independent vectors.
