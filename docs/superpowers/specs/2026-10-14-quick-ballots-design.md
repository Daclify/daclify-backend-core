# Quick ballots

Date: 14 October 2026. Status: product design draft for review. Implementation
has not started. Confirmed requirements and proposed defaults are separated
below; the vote storage decision is pending.

## Confirmed requirements

- Ask a question with a simple up/down vote; the question can concern any topic.
- Only executive members of DAOs can create these ballots.
- Choose one DAO, multiple selected DAOs, or all Daclify users as the audience.
- All Daclify users can vote in a public ballot, including users without DAO
  membership.
- A closing time is optional.
- Show easy statistics. The ordinary results view does not need a voter list.

## Proposed first-version behavior

Each ballot has one originating DAO. Its creator must be an active member with
the current executive role in that DAO. Read canonical executive membership and
applicable policy on the server; an administrator flag or browser claim alone
does not establish executive office. The existing
[executive records and policy](../../../contracts/common/executives.hpp) remain
authoritative. Another DAO's members being invited to vote does not make that
DAO an author, owner or endorser.

As a proposed visibility default, selected-DAO ballots are readable by their
eligible audience and the originating DAO's executives. Public ballots have a
shareable public read view; sign-in is required to vote. Existing private DAO
documents or profile data must not become public through automatic attachment
or copying. Keep voter eligibility distinct from visibility and DAO authority.

For a selected-DAO ballot, a user qualifies through current eligible membership
in at least one selected DAO. For a public ballot, a valid Daclify user account
is sufficient. Count one response per Daclify account per ballot, even if the
user belongs to several selected DAOs or uses multiple paired sign-in methods.
This establishes account uniqueness, not verified uniqueness of real people.

Users can change up to down, down to up, or remove their response while voting
is open. A change preserves the number of participants; removal reduces it by
one. Each write rechecks identity, eligibility and ballot state. A retry cannot
create a second response or increment the totals twice.

The question, explanatory text, originating DAO, audience and closing rule are
fixed after the first vote. Corrections then require a new, clearly identified
ballot rather than changing what existing votes mean.

With a deadline, voting closes at that instant according to authoritative
server/chain time. Express stored times in UTC and show them in the viewer's
timezone. An overdue scheduled job must not extend voting. Without a deadline,
the originating DAO's current executives can close the ballot manually. Other
current executives can manage it if its creator leaves. Closed ballots reject
further responses and retain their recorded result.

The audience and vote domain include the operator, network, runtime and DAO
references. The first version does not federate accounts or votes across
independent operators or mix production with testnet.

## Simple results

Show:

- Upvotes.
- Downvotes.
- Total votes, equal to upvotes plus downvotes.
- Percentage voting up, equal to upvotes divided by total votes.
- Open/closed status and, where applicable, the closing time or time remaining.

Use a whole-number percentage for the initial display. At zero votes, show
"No votes yet" instead of implying a measured support percentage. Highlight
the viewer's own choice. Do not add named voter lists, per-DAO breakdowns,
charts, or eligible-population turnout statistics to the first version.

Example: `32 up · 8 down · 40 votes · 80% voting up · Closes in 2 days`.

Aggregate display does not establish anonymous or secret voting. Do not claim
that voter choices are confidential merely because the normal view omits them.
The storage choice below determines the underlying visibility and trust model.

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

## Storage decision to resolve

Two approaches have different consequences:

| Approach         | Consequence                                                                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daclify database | Recommended starting point for simple account voting after sign-in. PostgreSQL enforces unique responses and atomic updates. Integrity and availability depend on the Daclify service and its backups; these are not native on-chain vote records.                                  |
| On-chain         | Requires a reviewed way for all Daclify accounts to authorize votes without borrowing DAO-member authority. It adds signing, native storage accounting, retention/cleanup and upgrade work. Underlying vote records may be publicly readable even when the UI displays only totals. |

The user has been asked to choose. Do not implement either approach, promise
secret voting, or silently change the trust model before that choice is made.
Do not copy personal profile details into ballot or voter records.

## Implementation and verification boundaries

The eventual plan must cover executive-role checks, audience validation,
one-account response identity, account merge/deletion behavior, DAO closure,
expired sessions, membership revocation, deadline races, simultaneous changes,
retries and restoration after service/database failure. Define finite content,
selected-DAO, list and request bounds, with pagination and abuse controls.
Integrate with existing account-exit/retention behavior rather than inventing
new erasure guarantees or silently changing closed results.

Use released producer-owned interfaces across core, modules and frontend. A
native implementation additionally needs pinned CDT `-O=s`, measured WASM/RAM
and CPU, tested migrations and exact deployment pins. No new owner/active
authority or treasury permission is implied by this feature.

Browser acceptance must cover executive creation, denied nonexecutive creation,
each audience, a member of several selected DAOs voting once, public voting
without DAO membership, change/removal, zero votes, automatic/manual closure,
simple results and desktop/mobile accessibility. Publish docs and distinguish
synthetic checks from any real sign-in or native-chain qualification.
