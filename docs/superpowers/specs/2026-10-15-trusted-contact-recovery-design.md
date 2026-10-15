# Trusted-contact account and document recovery

Date: 2026-10-15. Status: combined design approved for inline implementation by the user on 2026-10-15. Approval does not authorize production deployment or enrollment of existing users.

## What the user decided

- Add optional recovery with trusted people chosen by the account holder before access is lost.
- Use the proposed starting flow: three contacts, approval by any two, a waiting period of 48 hours, and cancellation through surviving account control. Recover the existing Daclify memberships rather than create replacements.
- Also allow the chosen contacts to recover historical private-document access. The user explicitly accepts that a sufficient contact quorum could recover those keys without the user.
- Respect each DAO's decision about whether trusted-contact recovery of its private documents is allowed.
- Keep existing recovery kits and device transfer. The feature does not enroll existing users or disclose their secrets automatically.

The exact request lifetime, storage limits, cryptographic library and placement of contract records are engineering choices for the implementation plan. They are not additional user decisions or assertions of verified support.

## Intent and scope

A person who loses their devices can recover control of enrolled Daclify memberships and the document history they explicitly backed up from DAOs that permit it. The recovery keeps DAO/member IDs, current roles, balances, claims, stake and voting identity. It grants no new membership, historical entitlement, administrator role or vote. Current inactivity, revocation and DAO lifecycle rules remain authoritative.

This is a change across core contracts, public protocol/SDK, API/database, browser vault and recovery screens, documentation, compatibility fixtures and tests. Existing module assumptions and native governance authorities must be checked against the changed credential lifecycle. Work stays inline on `dev`; production deployment and actual customer authority changes are separate actions.

Recovering Daclify control does not recover the private keys or funds of an external Telos Zero/EVM wallet. Restoring document keys also cannot recreate missing document ciphertext.

## Verified starting point

- The current [vault schema](../../../protocol/crypto.ts) holds one K1 signing private key and one P-256 personal decryption private key. The latter can open grants across multiple DAOs.
- The [recovery SDK](../../../sdk/recovery.ts) encrypts both original secrets together for existing full-vault recovery. Reusing that whole payload for contacts would disclose the shared personal decryption key and undermine the new per-DAO choice. It would also disclose an old signing key while account recovery promises to replace lost signing authority.
- DAO epoch secrets have on-chain commitments and per-member encrypted grants. The frontend already [opens grants and checks their commitments](../../../../daclify-frontend/src/auth/vault.ts). A contact-recovery packet can contain eligible epoch secrets for one DAO without containing the personal decryption private key.
- [Human signing-key rotation](../../../contracts/runtime/runtime.cpp) is currently authorized by that member. `guardrecover` applies only to revoked agents. Human contact recovery needs its own explicit policy and authorization path.
- The API's [native authority verifier](../../../services/api/src/auth/native-proof.ts) supports direct-key thresholds, and rejects delegated accounts and waits. ROW's native authority arrangement is not a drop-in login mechanism.
- [Existing recovery guidance](../../disaster-recovery.md) distinguishes service profiles, on-chain membership identity, original keys and surviving content. New flows must preserve those distinctions.

## Account recovery

### Enrollment

The first version uses three distinct Daclify users with usable signing and encryption identities as contacts. Reuse existing K1 proofs and P-256 encrypted delivery rather than introduce on-chain WebAuthn verification or new wallet types. This is an engineering scope choice, not a claim that an email address can approve recovery.

The holder enrolls and changes contacts with fresh proof of the original Daclify signing key. Native/EVM bindings may be supplied by a DAO at enrollment, so those bindings alone cannot authorize recovery of the global service profile. Surviving bound wallets can still cancel pending requests. Each contact accepts with a fresh proof of their own control. Names, email addresses and social-provider identifiers do not authorize enrollment or approval. Contact selection must include identity/fingerprint confirmation and show the scope of recovery power.

Activate recovery only after enrollment and contact acceptance are complete and the relevant policy has been committed on-chain. Contacts are selected by the holder, not supplied by a DAO administrator. A contact's own credential changes require a verified update; a stale key must not silently become a different contact.

The implementation plan must define an on-chain recovery identity and membership enrollment layout that survives loss of the API database. Service UUIDs and cached membership projections are not sufficient authority. Every participating deployment/membership is explicitly enrolled. The UI lists enrolled, unsupported and unenrolled memberships; it must not imply that choosing contacts automatically upgrades every independent contract deployment.

### Request, approval and completion

1. A replacement browser generates a fresh signing key and encryption identity locally, proves possession, and prepares a recovery request for the exact enrolled identity and memberships.
2. Each approving contact verifies the person through a separate communication channel and confirms the replacement-device fingerprint. A shared link or successful login alone is not that confirmation.
3. Two distinct enrolled contacts approve the same request. Bind signatures to the chain, runtime, recovery identity, membership scope, policy revision, replacement keys, request nonce and expiry. Duplicate approval, stale policy, destination substitution and replay fail.
4. The 48-hour wait begins when the second valid approval arrives. Starting it at request creation would allow a request to age before anyone approves it. Expiry must leave enough time to complete the full wait.
5. Surviving current account control can cancel before completion. Expose pending recovery through the application and existing consented notification routes. Notifications are informational and contain no keys or private document metadata.
6. After the wait, the contract authorizes replacement of the enrolled signing authority. Invalidate old signing/session authority and stale recovery requests. Reconcile native/EVM bindings and actual native governance permissions so a lost credential cannot silently remain an equivalent control path. Any retained independent control path needs an explicit, freshly verified treatment.
7. The API accepts a fresh proof of the finalized on-chain recovery and the new key. Preserve the service account where its records survive; otherwise rebuild the service profile around the existing chain/member identities. Do not reconstruct or merge social pairings from names or email matches. Revoke/quarantine restored sessions, stale pairings and full-access recovery methods until verified.

Bound work per request and per transaction. Across independent deployments, report each membership's actual state and support resumable completion. Do not claim a global atomic reset where none exists. Old authority must not remain usable on a membership reported as recovered.

Contacts gain no direct action to transfer treasury funds, change roles or execute arbitrary transactions. They can nevertheless impersonate the recovered member after a successful takeover and exercise that member's existing powers. The UI must explain this effective authority.

### Changes and cancellation

Version contact policies and invalidate approvals when the relevant policy or credentials change. Separate revocation of an unsafe contact from activation of a replacement, and prevent an unverified replacement from acquiring authority. Enrollment changes require fresh current control and clear notice. Never fall back to one contact because another is unavailable.

An attacker who already controls a valid cancellation credential may obstruct recovery. This initial feature cannot promise recovery against an actively hostile current controller; a separate arbitration/compromise mechanism is outside scope.

## Document recovery

### Back up only the permitted DAO's document keys

Use the same accepted contacts, with separate, explicit document-recovery enrollment for each DAO that permits it. The default for existing DAOs and existing users is off. Changing a DAO's setting requires its existing authorized governance/configuration process; it does not let an administrator enroll a member's keys.

While the user's vault is unlocked, the client reads only the user's legitimate grants, decrypts the covered DAO epoch secrets and verifies each against that DAO's on-chain epoch commitment. It packages those epoch secrets into a versioned, encrypted recovery packet bound to the exact chain/runtime/DAO/member, history coverage and recovery-policy revision.

**Never put the shared personal decryption private key or a signing private key into a contact document-recovery packet.** This is the main boundary that lets one DAO allow recovery while another forbids it. Existing encrypted documents and existing member grants do not need to be republished merely to build a packet.

Generate a random packet-unlocking key. Use a vetted threshold secret-sharing implementation to make it recoverable by two of the three contacts, and encrypt each contact's share to that contact's verified encryption identity. Do not implement a new cryptographic construction to avoid a dependency. Select and pin the implementation only after checking its source, maintenance, license, applicable review and interoperability vectors.

Packet payloads and share envelopes must be size-bounded. Cover large histories with bounded, authenticated chunks and a versioned manifest rather than one unbounded table row or browser operation. Validate manifests, bounds and epoch commitments during recovery; reject mixed DAO, member, revision and epoch material. Never back up epochs the user was not granted.

### Storage and honest coverage

Encrypted packets and encrypted share envelopes need independently retained copies and portable discovery information. Reuse the existing content provider and client cryptographic primitives where they fit, but do not put the only decryptable locator or outer storage key in the Daclify server's database/OpenBao. The existing operator-wrapped full-vault storage cannot by itself satisfy operator-independent contact recovery.

The implementation plan must select a bounded locator/commitment format, independently retained encrypted packet/share copies, and a tested retrieval/export path for contacts. Public-chain records contain only the minimum policy, public verification data and opaque references/commitments; no names, emails, provider identifiers, plaintext keys or document titles. Ciphertext on IPFS needs continued availability; a CID is not a retention guarantee.

Mark document recovery ready only after verifying delivery/retention and demonstrating reconstruction with two contacts. Record covered epochs and update the packet when the client obtains additional eligible epoch keys. When no authorized client is available to perform the update, show that newer documents are not yet covered. The blind backend cannot manufacture that coverage.

### Restoring documents

After an ordinary successful account recovery, the approved application asks the contacts to release their shares encrypted to the verified receiving browser. The browser reconstructs the unlocking key and opens the covered DAO packets locally. Plaintext epoch secrets and shares stay out of normal API responses, service persistence, logs and analytics.

The recovered browser uses those epoch secrets to read the corresponding surviving ciphertext. It protects them locally and includes them in its new encrypted backup/export. It does not need the lost shared personal decryption key for the covered epochs.

Fresh personal encryption identity, future document grants and any necessary rewrapping must be implemented as explicit state transitions with proof of possession and current DAO permission checks. Existing epoch-grant uniqueness and history rules cannot be bypassed by replacing rows blindly. A recovered signing identity is not proof of possession of the old decryption key.

For a DAO that forbids contact document recovery, create no packet and perform no automatic historical regrant on contact recovery. Access can remain unavailable until the original user backup is restored or the DAO explicitly authorizes a permitted grant. Its current history and admission rules still apply. The implementation must also prevent automatic future grants from silently defeating a DAO's refusal: expose the recovered identity's contact-control capability and require whatever verified re-entry or grant approval that DAO's policy permits.

### Limits of the privacy choice

- A quorum can combine its document shares outside the application. The account-reset wait and cancellation do not cryptographically delay or revoke those copies. Never describe the 48-hour window as a guarantee for document-key reconstruction.
- A new policy can stop future backups and application-mediated releases. Removing a contact or disabling recovery cannot erase retained shares, epoch secrets or plaintext. Preserve truthful history; do not claim retroactive confidentiality.
- Contacts with backed-up epoch secrets can read the document ciphertext those secrets open, including additional documents encrypted under the same covered epoch. Coverage is a DAO epoch boundary, not an individual-file permission boundary. A DAO disabling future contact exposure needs a fresh epoch with appropriately restricted grants, not only a UI switch.
- An authorized member can always disclose plaintext or keys outside the supported client. DAO policy governs enrollment and application behavior; it is not a claim of preventing malicious member exfiltration.
- Existing assisted full-vault recovery remains separately labelled. Contact recovery does not remove operator authority already granted through another method or undo past disclosure.

## Product experience

Account settings shows the three contacts, their acceptance/credential state, enrolled memberships, pending requests and a recovery-health result. Each DAO separately shows whether document recovery is allowed, whether the user enrolled, the epochs covered and any missing/new coverage. Distinguish account recovery, document recovery and external-wallet recovery in plain language.

The receiving device shows the two approvals, replacement fingerprint, wait deadline and the memberships actually recovered. Document restore reports which DAO history is available and which still requires the original backup or DAO-authorized access. Failures remain retryable where safe, without claiming that a partial recovery succeeded completely.

The final interface is built from existing Vue components and account/content flows. No design-tool project, additional identity provider or messaging integration is required. Automatically sending notifications is limited to existing, explicitly consented application behavior; this development task authorizes no messages to real contacts.

## Implementation and compatibility requirements

- Core owns canonical schemas, signature domains, state-machine rules, recovery/custody capability, contract actions, API transactions, migrations and generated SDK/ABI artifacts. Frontend consumes the pinned public artifacts. Review modules only for affected assumptions and compatibility.
- New recovery capability is explicit and default-off for old deployments. Preserve old row/action formats or provide tested, bounded migration/read compatibility. Old recovery kits remain readable; new exports include any recovered DAO epoch material with an explicit format version.
- Publish per-DAO privacy capability and per-member recovery/custody state accurately. Existing strict policies remain strict until a separately authorized policy change. A database flag or relayer statement cannot override the contract's recovery authority.
- Compile current C++ with the pinned CDT and `-O=s`. Justify each stored field and index, cap contacts/requests/payloads, and provide bounded cleanup for expired/cancelled requests. Preserve the durable replay/revocation information needed after cleanup and restore. Measure WASM/RAM and representative action CPU; historical fixtures retain their original flags/hashes.
- Existing recovery-service qualification does not qualify contact recovery. Keep an unqualified mechanism visibly unavailable and document the actual remaining gate.

## Required verification

The implementation plan must cover real compiled C++/native permissions, API/database transactions and browser key delivery, including:

- Enrollment/acceptance/control proofs; duplicate or substituted contacts; one-contact failure; two-contact success; fresh-key possession; wrong chain/runtime/member/policy/request/destination; replay and concurrent approvals.
- The full 48 hours after the second approval; expiry; cancellation/finalization races; policy/key changes; stale sessions; lost bindings; native-controller/upgrade behavior; pending operations and unchanged voting/accounting rights.
- Forbidden and allowed DAOs sharing the same original personal key: packets restore only the explicitly covered DAO epoch secrets and never contain or reveal the personal decryption or signing private key.
- Correct/incorrect/corrupt shares, mixed packets, partial history, epoch commitment mismatch, newly granted epochs, missing content and retention failure. Test against independent cryptographic vectors and a reconstruct-from-two-contacts drill.
- Disabled recovery, contact replacement and retained historical copies; future grants/epoch rotation after policy changes; incompatible custody/admission; no automatic historical access expansion.
- Recovery with the original application database unavailable, portable packet/share retrieval, per-deployment partial completion, stale-backup quarantine and supported-release upgrade fixtures.
- Browser accessibility, fingerprint confirmation, outage/retry states, zero plaintext-secret leakage to API/logs/provider metadata, and honest distinction between account recovery and document-history coverage.

No production readiness claim follows from source inspection or mocks. The feature needs its own measured native, storage and real-client evidence; production authority changes remain subject to the repository's release process.

## Review record

Inline builder review, required because sub-agent delegation is unauthorized: checked the proposed flow against the current shared personal key, full-vault recovery payload, committed DAO epochs, agent-only guardian recovery and native login verifier. This review identified and resolved the shared-key leak by using DAO-specific epoch packets, and explicitly excluded a false document timelock, automatic regrant, unverified off-host availability and claims of cross-deployment atomicity. Exact implementation schemas and storage/chunk limits belong to the implementation plan; no additional product-policy answer is currently required.
