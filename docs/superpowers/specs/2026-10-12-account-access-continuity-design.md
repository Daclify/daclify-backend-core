# One account, full access, and DAO continuity

Date: 2026-10-12. Product direction approved in the conversation: improve account recovery, reconnect paired sign-ins, integrate Create/Join access setup, and protect private DAO data when its creator leaves. The user requested one account and one recovery experience. Repository instructions authorize continuous inline implementation and review of the completed code.

## User experience

Users have one Daclify account, several paired sign-in methods, and one encrypted recovery kit. The kit contains the signing and document-encryption keys internally; users do not create or maintain separate key sets. Keep the separate cryptographic purposes required by the existing protocol.

Restoring a kit for an already registered identity must explain that the account was found and offer an explicit way to continue. A user signed in through a recovered wallet can reconnect that wallet profile's sign-ins to the recovered account after proving control of both. Cancel leaves the current account usable. An existing identity is never replaced by newly generated keys.

Create/Join offers **Enable full access** in the current journey. Existing accounts recover their original keys through a qualified paired method, another device, or their kit. A genuinely new wallet account may create its account keys once, save one kit, and continue to its original destination. Assisted recovery remains an explicit choice governed by the already approved two-path account-entry design and DAO custody policy.

For private DAOs, admission includes the history access allowed by the DAO's policy. Granting access requires an authorized administrator with the relevant epoch keys. If nobody can grant it now, show access as pending. New epochs must be initialized and granted to active eligible members. A creator's departure must not be presented as safe merely because another administrator role exists: another administrator needs the permitted private history and a usable recovery route.

## Account reconciliation

Engineering choice: the registered account remains canonical. Only a wallet-only profile can be reconnected; two accounts with different registered keys are never merged by this flow. A fresh wallet account-control proof and a fresh signature from the recovered account key authorize a short-lived intent bound to both identities, the origin, API audience, and exact operation. The encryption public key must also match the registered identity.

Transfer sign-in credentials, passkeys, and wallet links transactionally. Reject conflicting wallet links or different member identities in the same DAO. Preserve passkey counters. Do not copy or rewrite encrypted recovery records bound to another account. Reconnected sign-ins initially grant sign-in access; enabling full key recovery remains an explicit account setting.

Retain the retired profile as an immutable historical owner and record its canonical account. Payment metadata, upload receipts, archive manifests, and audit evidence retain their original account IDs. Authorization and user history queries recognize the verified historical ownership relationship. Credentials and memberships move to the canonical account. Revoke old sessions, unfinished credential intents, device requests, and connected-app tokens; a fresh session opens the canonical account. Connected applications require fresh authorization rather than inheriting wider access.

The ownership relationship is one level deep, has no cycles, and is only created by the dual-proof transaction. Retired profiles cannot open sessions or receive new credentials. Existing identities, DAO member IDs, roles, credits, funds, document grants, and ciphertext stay intact.

## Continuity constraints

Use the existing per-DAO epoch commitments and per-member encrypted grants. Keep history-policy and custody admission checks. Do not send private keys, epoch keys, or plaintext documents to the API to prove readiness.

Distinguish a recorded grant from verified client decryption and a working recovery method. Continuity checks report these separately. Automatic granting and handover preparation may submit only the user's explicitly requested DAO actions. Merely opening a page must not sign transactions.

Contract invariants remain authoritative. Any additional contract safeguard requires compiled WASM/ABI tests, pinned CDT `-O=s`, bounded data and cleanup, and native-runtime verification. Preparing it does not authorize deploying a contract or changing a live member's keys or authorities.

## Acceptance

- Correct restored keys never end at the old sign-out-only collision error.
- Explicit reconciliation preserves paired sign-ins and immutable user history, rejects conflicting identities, revokes stale access, and leaves keys/custody unchanged.
- Replay, substituted keys, wrong origin/audience/session, concurrent reconciliation, and cancellation are tested.
- Create/Join returns to the original destination and uses the same account setup/recovery controls.
- Private access status reflects the selected history policy and actual grants; an administrator can prepare permitted access for eligible members.
- Handover identifies missing successor access/recovery and does not label unverified decryption as verified.
- Desktop/mobile keyboard, focus, errors, pending work, and cancellation remain usable.
- No live account is reconciled, no keys are rotated, and no DAO action is submitted by development or verification tools.

## Execution and verification

Implement inline on `dev`, preserve concurrent edits, use the existing Vue/TypeScript/PostgreSQL and protocol package boundaries, and add meaningful tests before security behavior. Record each deliverable and its actual checks in the implementation ledger. Commit and push authorized source changes. Testnet publication uses immutable artifacts and the previously authorized testnet workflow; production and contract deployment require separate authorization.


## Implemented continuity boundary

The portal offers explicit batches of up to 20 grants and local commitment/decryption verification. Admission can request a batch only when the administrator selects private access. Before administrator deactivation or demotion, the portal refreshes records, requires a remaining administrator with every recorded epoch grant, and requires human confirmation of that person's decryption and account recovery on another device. A missing policy or failed refresh stops the handover. The UI refreshes access when moving between Members and Documents and uses the actual policy's current epoch, including changes made on another device.

This release adds no contract continuity invariant: direct native actions can bypass the portal handover check. A recorded grant alone is not labelled verified. The existing last-administrator guard remains authoritative. From-join history deliberately prevents later members receiving earlier epochs, so retaining access to that history requires an administrator who already holds it; the portal never bypasses that privacy rule. No transaction is signed merely by opening or refreshing a page.
