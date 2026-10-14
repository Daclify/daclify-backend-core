# Quick ballots

Date: 14 October 2026. Status: product design accepted for implementation;
the user authorized execution after choosing the privacy/proof requirements.
The first implementation step is proof qualification. Requirements and defaults are separated
below. On-chain voting, 30-day vote-row retention, executive access to individual
choices and public cryptographic verification of totals are confirmed. Remaining
implementation defaults remain proposed. An experimental proof candidate now
passes local native verification; product integration and security review remain
outstanding.

## Confirmed requirements

- Ask a question with a simple up/down vote; the question can concern any topic.
- Only executive members of DAOs can create these ballots.
- Choose one DAO, multiple selected DAOs, or all Daclify users as the audience.
- All Daclify users can vote in a public ballot, including users without DAO
  membership.
- A closing time is optional.
- Show easy statistics. The ordinary results view does not need a voter list.
- Record votes on-chain. Individual vote rows become eligible for verified
  archival cleanup **30 days after closure**; final totals remain on-chain.
- DAO executives may read individual votes; individual choices are not public.
- Final totals require a public cryptographic proof of correct counting.
  Executive approval alone is insufficient.

## Proposed first-version behavior

Each ballot has one originating DAO. Its creator must be an active member with
the current executive role in that DAO. Enforce canonical executive membership
and applicable policy in the contract, with server checks for useful feedback;
an administrator flag or browser claim alone does not establish executive
office. The existing
[executive records and policy](../../../contracts/common/executives.hpp) remain
authoritative. Another DAO's members being invited to vote does not make that
DAO an author, owner or endorser.

As a proposed discovery default, the portal lists selected-DAO ballots for their
eligible audience and the originating DAO's executives. Public ballots have a
shareable public read view; sign-in and authorized signing are required to vote.
Audience restrictions control voting eligibility, not confidentiality. The
individual choices require encryption before publication, as described below.
Question/explanation confidentiality is a separate policy: cleartext on-chain
content can be read outside the portal. Do not infer permission to copy private
DAO documents or profile data into a question. Keep voter eligibility distinct
from discovery, content access and DAO authority.

For a selected-DAO ballot, a user qualifies through current eligible membership
in at least one selected DAO. For a public ballot, a valid Daclify user account
is sufficient. Count one response per Daclify account per ballot, even if the
user belongs to several selected DAOs or uses multiple paired sign-in methods.
This establishes account uniqueness, not verified uniqueness of real people.

Users can change up to down, down to up, or remove their encrypted response while
voting is open. A change preserves the number of participants; removal reduces
it by one. Each write rechecks identity, eligibility, ballot state and the
protocol's response-validity evidence. A retry cannot create a second response
or increment participation twice. The final proof counts the latest accepted
response for each account, excluding removed responses.

The question, explanatory text, originating DAO, audience and closing rule are
fixed after the first vote. Corrections then require a new, clearly identified
ballot rather than changing what existing votes mean.

With a deadline, voting closes at that instant according to authoritative
chain time. Express stored times in UTC and show them in the viewer's
timezone. An overdue scheduled job must not extend voting. Without a deadline,
the originating DAO's current executives can close the ballot manually. Other
current executives can manage it if its creator leaves. Closure freezes voting;
show a separate "Closed — awaiting verified result" state until the contract
accepts the final tally proof. A missing/failed tally cannot reopen voting,
produce invented totals or permit pruning.

The audience and vote domain include the operator, network, runtime and DAO
references. The first version does not federate accounts or votes across
independent operators or mix production with testnet.

## Simple results

Once the final result has been verified, show:

- Upvotes.
- Downvotes.
- Total votes, equal to upvotes plus downvotes.
- Percentage voting up, equal to upvotes divided by total votes.
- Open/closed status and, where applicable, the closing time or time remaining.

Use a whole-number percentage for the initial display. At zero votes, show
"No votes yet" instead of implying a measured support percentage. The proposed
privacy-preserving display shows participation and time remaining while open;
publish the up/down split only after closure and proof verification. Highlight
the viewer's own choice using their private receipt/decryption access. Do not
add ordinary named voter lists, per-DAO breakdowns, charts or eligible-population
turnout statistics to the first version.

Open example: `40 responses · Closes in 2 days`.
Verified result: `32 up · 8 down · 40 votes · 80% voting up · Closed`.

Encrypted choices do not make participation anonymous. Account references,
timestamps, ciphertext and transaction metadata can remain public. Small or
unanimous totals can reveal choices by inference. The executive-only review is
separate from the ordinary results display; its exact UI remains to be designed.

## Individual-vote privacy and verifiable counting

The confirmed policy permits executive access to individual choices and
requires public cryptographic verification of the final totals. As a proposed
scope default, the authorized readers are the originating DAO's executives;
selecting another DAO as an audience does not grant its executives decryption
rights. Voters retain access to their own responses. Define and show the reader
policy before the first vote; do not add recipients silently afterward.

Encrypt choices in the voter client before API submission, signing-request
creation or publication. Private decryption keys and plaintext choices never go
into action arguments, history, archives, analytics or service logs. Recipients
need executive-specific key grants; the ordinary DAO member-content key would
expose choices to other members. Reuse reviewed key-wrapping primitives with a
new versioned ballot/response domain where compatible. Profile/document
encryption alone is not a private-vote counting protocol.

Authorization, response validity and tally correctness are distinct checks:

- Core identity/role checks authorize creation and one account's response.
- The chosen protocol must establish that an accepted encrypted response is a
  valid up/down choice for this ballot, key epoch, account and revision, without
  exposing that choice. Malformed ciphertext cannot count as a valid response.
- At closure, freeze an authoritative commitment to the complete final response
  set and count. A tally proof must bind the result to that exact set, ballot
  definition, chain/runtime, encryption key and protocol version. It must prove
  the up/down totals count every accepted current response exactly once.
- The contract verifies the proof before accepting canonical final totals.
  Wrong-domain, incomplete, forged or replayed proofs must fail. An executive
  signature, archive hash or service-computed total is not a substitute.

Pin the reviewed protocol/circuit, verification key and verifier release to the
ballot definition before accepting responses. Do not accept a verification key
or executable verifier supplied by an untrusted tally submitter. Upgrades must
preserve those semantics and retained historical verification artifacts.

Do not update public up/down counters alongside individually identifiable vote
transactions: their deltas would reveal each choice despite encrypted rows.
The final summary retains the totals, final proof, encryption public key, frozen
aggregate/count/root and protocol/context commitments needed for independently
checking the accepted decryption result after row pruning. These bounded fields
keep that check independent of archive availability; measure their actual RAM
in the product contract. Preserve the same proof and public inputs in the verified archive/backup;
full recount or re-proving additionally needs the complete qualified source
data. A proof authenticates the stated tally, not perpetual data availability.

The selected experimental candidate is exponential ElGamal in BLS12-381 G1,
with disjunctive Chaum–Pedersen response proofs and a final decryption proof.
Its [exact protocol](2026-10-14-quick-ballot-proof-protocol.md) and
[qualification evidence](../../evidence/2026-10-14-quick-ballot-proof-qualification.md)
record independent synthetic vectors, client/native agreement, measured costs
and limitations. The stateless probe qualifies mathematical relations on a
local Spring chain; it does not qualify live voting, account uniqueness,
executive key delivery, complete source coverage or production privacy.
Independent cryptographic review and product qualification remain necessary.
An Ethereum protocol such
as [MACI](https://maci.pse.dev/docs/introduction/) demonstrates this trust model
but is not a ready-made Telos Zero integration. Do not silently substitute an
operator attestation, external-chain trust bridge or public plaintext votes if
native verification proves impractical.

The plan must specify executive-key turnover, recipient snapshots/grants,
recovery, lost/unavailable tally keys, malformed response rejection and quorum
or coordination requirements. Losing keys may prevent tallying; it must not
permit fabricated results or early deletion. Former readers cannot be made to
forget plaintext or keys already copied. Grant changes protect only what the
qualified key-rotation protocol can actually protect. Managed recovery that
gives an operator decryption capability must be disclosed; do not promise
executive-only confidentiality when the custody model cannot provide it.

## Relationship to DAO decisions

A Quick ballot records the responses to its exact question. Any subsequent
funding, role, contract or policy action must still satisfy the DAO's existing
authorization and execution rules. An audience outside the originating DAO
does not receive that DAO's spending or administrative authority.

Keep existing Decide ballots and their pending votes intact. Existing Decide
requires DAO-member authorization, a bounded closing time, governance rules and
vote commitments. Relabelling its buttons does not establish account-wide or
open-ended voting. Reuse suitable presentation and producer schemas; choose
the new authorization/persistence path explicitly in the implementation plan.

## Proposed contract boundary

Recommend a dedicated first-party Quick ballots contract in the modules
repository, with its own tables, ABI and release pins. The user has suggested a
separate contract; this section records the recommended boundary for review.
Use one shared instance for the hosted runtime/network, with explicit ballot,
originating-DAO and audience domains. Each DAO does not need its own deployment.
Independent operators can deploy a matching instance for their own runtime.

The contract owns ballot creation, response changes/removal, proof verification,
canonical final totals, closure and guarded vote-row pruning. Reuse core's
authoritative identities, executive roles, membership, approved signing methods,
funded RAM accounting and archive verification through qualified public
interfaces. Keep one account and approval flow in the frontend. Do not introduce
a separate identity registry or
grant the contract treasury, role-assignment or arbitrary execution powers.

This boundary separates account-wide and cross-DAO participation from Decide's
formal governance and executable decisions. It permits a distinct upgrade and
cleanup lifecycle without migrating existing Decide ballots. It does not make
the feature independent of core: account-wide vote authorization, module/source
registration, archive schemas and quota integration still require coordinated
implementation and qualification. In particular, the existing member-only
`module_actor` helper cannot authorize a public voter without DAO membership.

As an implementation default to review, charge ballot and response storage to
the originating DAO's funded allowance with bounded usage; selecting another
DAO as an audience must not debit its resources. A separate contract alone does
not reduce per-vote RAM or establish a security boundary: verify permissions,
isolation and measured WASM/RAM/CPU, including deployment overhead.

## On-chain votes and cleanup

The user's storage preference is on-chain voting. Database projections may
serve discovery and history but cannot authorize responses or determine the
canonical result. The implementation still needs a reviewed account-wide
signing path that works for users without DAO membership. Existing member-only
Decide authorization does not provide that path.

Lifecycle implementing the confirmed retention policy:

1. Keep one live encrypted response per account while the ballot is open, with
   atomic participation and response-set commitments. These rows prevent
   duplicate responses and support changes/removal.
   Never prune them while voting is open. An open-ended ballot retains this
   cost until it is closed.
2. Verify the final tally proof and wait for irreversibility. Retain the bounded
   question, originating DAO, audience, final up/down totals, closure metadata
   and proof/archive commitments on-chain. Old results should remain readable
   without replaying transaction history. A closed ballot cannot reopen, and
   deleting response rows must not permit reuse of its identity.
3. Export a complete encrypted final-response snapshot, tally proof and public
   inputs with their source/schema/block domains. Verify response-set coverage,
   the proof against the accepted final result, uploaded bytes,
   retrievability and an independent backup before approving pruning. A hash
   authenticates available bytes; it does not keep those bytes available.
4. At **30 days after closure** (2,592,000 seconds), individual vote rows become
   eligible for removal in bounded, retry-safe batches, verifying archive
   proofs. Measure from the voting deadline for timed ballots, or the recorded
   manual closure time for open-ended ballots. A delayed finalization job does
   not restart this clock. Pruning still requires an irreversible finalized
   result and a verified archive with its backup; keep the rows longer if those
   checks fail. A cleanup worker submits transactions; the contract does not
   run itself when a timer expires.

Reclaiming table RAM makes it reusable by its payer. It does not erase past
transactions or reduce existing block-history storage. Historical detail can
come from a qualified history indexer or the verified archive; public readers
obtain encrypted responses and proof data, not individual plaintext choices.
Executive review requires the appropriate private keys/grants. Do not depend
on arbitrary public RPCs retaining every action; history services index and
filter data separately from current contract state. Report incomplete or
unavailable history explicitly. A final-response archive is not a full audit
trail of every changed or removed response; that requires retained action
history or a separately qualified event archive.

The existing
[ordinary-poll pruning action](../../../../daclify-backend-modules/contracts/decide/decide.cpp)
already checks terminal status, retention, archive domain, row proofs and bounded
progress while preserving the ballot result and vote-ID high-water mark. Its
[archive format and recovery guidance](../../../../daclify-backend-modules/docs/archive-format.md)
provide a pattern to extend. Those checks currently protect ordinary Decide
polls; they do not implement Quick ballots or qualify their new source schema.
Do not extend pruning to elections, executable decisions, key grants or payment
and recovery records as part of this feature.

Keep identifiers minimal; do not copy personal profiles into ballot or voter
records or describe pruning as erasure of public chain history. Measure actual
RAM and CPU before estimating costs. The retained per-ballot summary still uses
RAM; the main saving is removing the much larger collection of voter rows.

Primary references: [Telos state and history](https://docs.telos.net/overview/why-telos/scalability/)
and [Hyperion history architecture](https://github.com/eosrio/hyperion-history-api#2-core-concepts).

## Implementation and verification boundaries

The eventual plan must cover contract executive-role checks, audience validation,
one-account response identity, account merge/deletion behavior, DAO closure,
expired sessions, membership revocation, deadline races, simultaneous changes,
retries and restoration after service/database failure. Define finite content,
selected-DAO, list and request bounds, with pagination and abuse controls.
Integrate with existing account-exit/retention behavior rather than inventing
new erasure guarantees or silently changing closed results.

Also cover cleanup before/at/after the 30-day boundary, delayed finalization,
missing/corrupt archives, wrong-domain proofs, interrupted batches, unchanged
final totals, ID reuse, irreversibility and history outages. Failed archive
verification must prevent pruning. Preserve live replay/identity protections
through account deletion and upgrades.

Privacy acceptance must inspect actual client/API/action/archive bytes for
plaintext leaks, deny decryption to nonrecipients and test recipient changes,
key loss and managed-custody disclosure. Native proof qualification must reject
tampered choices/totals, wrong keys/circuits/domains, stale response roots,
omitted or duplicated responses, replay and invalid response-validity proofs.
Exercise change/removal races, delayed proofs, zero responses and unavailable
provers without showing unverified totals or pruning needed source data.

Use released producer-owned interfaces across core, modules and frontend. A
native implementation additionally needs pinned CDT `-O=s`, measured WASM/RAM
and CPU, tested migrations and exact deployment pins. No new owner/active
authority or treasury permission is implied by this feature.

Browser acceptance must cover executive creation, denied nonexecutive creation,
each audience, a member of several selected DAOs voting once, public voting
without DAO membership, change/removal, zero votes, automatic/manual closure,
simple results and desktop/mobile accessibility. Publish docs and distinguish
synthetic checks from any real sign-in or native-chain qualification.
