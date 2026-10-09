# Executive authority and native handover

Approved by the user on 2026-10-09; implemented locally; deployment pending review. This authorizes local implementation and verification, not live authority changes.

Shared DAOs govern their records without changing platform account permissions. Exactly one governing DAO may control a runtime and its explicitly registered contract accounts: the Daclify DAO for shared hosting, or the owning DAO for an independent runtime.

Membership, voting eligibility and executive office are separate. Pairing alone never appoints an executive. Existing members retain their previous voting eligibility until explicitly changed. Existing row layouts remain readable; added state uses new metered tables.

The deployment authority appoints initial internal member IDs. Native handover remains pending until an appointed executive proves a Telos Zero binding and the current native owner authorities authorize handover. No automatic return to bootstrap is allowed after handover. Ordinary shared DAOs cannot claim platform authority.

The elected native permission is `govern`, a child of owner and sibling of active. Runtime owner delegates to govern and its own contract code, permitting reviewed code to maintain that permission. Runtime active delegates to govern and its own code. Managed contract accounts delegate owner to runtime govern and active to runtime govern or their own code. Backend creation uses a restricted service child permission with explicit links; its key has no direct owner or govern grant. Settler/oracle credentials remain separately scoped.

Executive inactivity is independent of membership. Default timeout is 30 days. Eligible active executives determine the effective quorum; one remaining active executive can control the organisation. With every executive inactive, retained paired executives can sign a heartbeat to reactivate. Permissionless refresh and relevant identity/governance actions synchronize native permissions. Passing time alone cannot mutate native authorities.

Unpairing, deactivation, removal or election replacement must never eliminate the last paired native controller after handover. Replacement requires existing member authorization and new wallet consent in one chain transaction; binding, credential invalidation and authority changes roll back together. Login-only credential changes remain explicitly distinct from on-chain DAO bindings and must refuse removal while governed bindings persist.

Executive elections are explicitly bound to the configured Decide deployment and the reserved title `Executives`. Representative elections retain their existing behaviour. Finalized elected rosters activate at their term start through on-chain synchronization; failed quorum, ties or missing eligible paired controllers cannot replace a functioning roster with zero controllers. Removed executives cannot restore themselves with a heartbeat. Terms require an explicit successor handover; the previous roster holds authority until a valid successor activates, avoiding expiry-induced loss of root control.

The UI shows appointment, pending handover, current executives, wallet requirements, timeout, quorum and holdover. It supports heartbeat, refresh, appointment changes and atomic wallet replacement. Initial owner transactions are prepared for external multisig signing; secrets never enter the frontend. Documentation explains bootstrap trust, single-executive control, native synchronization timing, user-controlled keys and login versus governance binding.

Verification requires compiled C++ VERT state tests and native permission tests: ordinary-member takeover rejection, cross-DAO isolation, last-controller guards, replacement rollback, active versus inactive executives, all-inactive reactivation, elected roster activation, stale approvals, restricted service authority, legacy row compatibility, generated SDK/API consistency and accessible UI states.

After native handover, the governing DAO’s app administrator rights track eligible paired executives. Ordinary shared DAO administrators remain separate. Individually signed app administrator actions remain distinct from native ownership quorum actions. Initial setup locks setcode/setabi to owner; atomic handover stages owner code authority in the same transaction and rejects stale signer/threshold/policy snapshots. Managed custody can authorize wallet replacement using the member key, so its provider is part of the executive trust boundary.

Native permissions delegate to the executives’ Telos Zero account authorities. Those account owners can change their own keys or delegate control outside Daclify. Avoid reusing the hosting service key in executive wallets, and audit external account authority changes; Daclify checks the configured service key during native synchronization.
