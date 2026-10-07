# Code-level freeze for N7–N9

This records the bounded defaults used to implement the already accepted plan. Native C++ owns all decisions and money. These packages are not yet implemented or tested as of this freeze.

## N7 Grants → Decide → Works

Add separate `grants` tables in the modules repository. Rounds freeze programme/rules document versions, revision 1, application/review/award cutoffs, native maximum award amount, human/all-active participant eligibility and the chosen installed Works account. A cap reserves no funds. There are no donor pots or matching.

Applications belong to the signing member. Draft → submitted → eligible/rejected → awarded/closed. Before the application cutoff an amendment increments revision and resets submission/eligibility/consent; funded/awarded entries cannot be amended. The exact application document, native milestone payments/dues and one-year maximum contribution term are stored and committed. Submission is the contributor's explicit consent to those enforceable terms. Review requires the current DAO administrator and an exact decision document reference; eligibility is not funding authorization.

Extend Decide with `openaward`/`executeaward` and a separate grant execution table. Use the existing frozen ballot/weight/nonce machinery. The plan pins grant/Works code hashes, current DAO policy revision, round/application/revision, application commitment, future Works project ID and decision reference. A C++ passed ballot is checked on execution; no API attestation can replace it.

Grants `govaward` accepts only the configured, pinned Decide sender and its executed matching plan, before the award deadline. It rechecks current contributor eligibility and atomically increments the round's awarded total under its cap. It calls the selected Works `grantwork` callback under a narrow `awardwork` grant. Works checks the real grant sender/code pin, the awarded application and exact execution reference, creates the project/milestones and frozen accepted agreement, then reuses full-project reservation. Any duplicate ID, cap/backing/DAO limit failure rolls the whole transaction back. No second obligation/payment ledger is introduced.

Extend catalogue, generated SDK/ABI/help and configured deployment IDs for grants. Add paged round/application projections and a small first-party panel for creating a round, applying/amending/submitting, reviewing and opening/executing award votes. Show actual reserved awards separately from the unfunded cap. Existing Works handles delivery, review, claim and native receipts/reporting.

## N8 Endorsement admission

Keep administrator admission as the absent/default core policy. Add a separate opt-in core admission policy with the selected pinned endorsement module and an explicit administrator override flag (default false for the endorsement mode). Apply it to every ordinary enrolment path, including owner/bootstrap and signed addmember, so the policy is not merely a hidden UI button. The selected DAO still controls disclosed policy changes through its existing administrator authorization.

A current member sponsors an application containing the applicant's public join identity, declared human/agent kind/operator, application document version/commitment, policy revision and a bounded deadline. Sponsors confirm the keys with the applicant; as with existing administrator admission, a public identity is not proof of unique personhood. Amendments replace the revision and invalidate prior endorsements.

Configured distinct active eligible member IDs endorse the exact revision. An explicit revocation removes their endorsement. At admission recheck active/guardian-revoked witnesses, self-endorsement via applicant's current member key, current policy revision, deadline, threshold and the complete applicant identity. Paired credentials never add endorsement weight.

Use a narrow authenticated runtime admission callback, bound to this application, with once-only consumption. Admission reuses ordinary custody/participant/key uniqueness checks and adds neither roles nor credits. Document required private epoch grants after joining. The privileged module cannot issue credits, assign roles or move assets.

## N9 Representatives with terms

Extend Decide with separate election, nomination and term records; keep old yes/no ballots and executable Works/award plans intact. One signing member can nominate only themselves before the nomination cutoff; withdrawn/duplicate/ineligible nominees do not occupy extra candidate slots. Bound to 15 candidates plus the explicit abstention option and at most 8 declared seats.

Freeze candidates/rules before voting. Reuse an ordinary member/credit/native-stake ballot and existing DAO weight lock; each stable member votes once, with one choice. Election finalization differs from a yes/no proposal: require the frozen quorum, rank positive candidate tallies, leave boundary ties unfilled, and issue no seats on no quorum. Candidates unable to serve because of inactive/guardian-revoked status are not installed; this rule is disclosed before voting.

Create durable representative terms with actual start/end and recall state. Administrator-authorized recall is on chain. Terms give titles only: no administrator flag, treasury authority, credit power or module grant is assigned. Ordinary administrators, approved obligations and existing governance locks are unaffected by expiry. Privileged delegated budgets remain outside this release.

## Verification and release

Write failing contract/state/producer checks first. Cover wrong/cross-DAO sender, code/policy/revision changes, deadline edges, duplicate credentials/member IDs, cap/backing rollback, term ties/no quorum/recall, legacy rows and once-only native settlement. Run compiled VERT and actual owned Spring integration; use producer schemas in UI fixtures. Update references/help, native permission/deployment plans, version ranges, generated artifacts and the requirements/evidence registers. No registry publication or production authority/fund changes are authorized.
