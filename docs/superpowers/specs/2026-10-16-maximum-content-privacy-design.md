# Maximum practical privacy for Daclify

**Date:** 2026-10-16. **Status:** design for review; product behavior described below is not implemented by this document.

**Request:** make as much DAO information private as possible, while separately proposing an integration with Telos EVM's privacy layer. This continues the user's requirement that their self-custody account remain under their control. Work is inline, without delegation, and excludes Almaiso.

## Outcome and boundaries

For an encrypted DAO, descriptive content is confidential by default: its internal identity and branding, proposals and custom option labels, work and grant narratives, payroll names, application/review text and documents. Keep only what the current contracts need to authorize actions, count votes and account for funds public. A user may deliberately publish a separate public identity or question, with a clear preview of the fields being disclosed.

Self-custody keys stay on the user's device. Reuse the existing browser encryption, DAO epoch commitments, recipient grants, document versioning and recovery boundaries. Neither a paired login nor a public wallet authorization reconstructs missing document keys. Do not silently enroll assisted recovery, upload original private keys or replace a lost encryption key. A managed-allowed DAO still permits operator-recoverable members; content available to those members has that additional reader risk. Do not silently change an existing DAO's admission policy.

This is content confidentiality, not anonymous governance. Member/public-key relationships, role flags, vote participation, ordinary vote choices, thresholds, timing, amounts, liabilities, transfers and transaction graphs remain public in this phase. Encrypting values a contract currently reads would break its enforcement. The [separate Telos proposal](../../proposals/2026-10-16-telos-evm-privacy.md) investigates private payments; it does not solve those other fields automatically.

## Verified baseline

Read against core `9cfe4ed`, modules `491e9db` and frontend `9da2eb7` on `dev`. Public SDK/protocol is core 0.15.0-alpha.32; core API implementation is 0.15.0-alpha.34, modules 0.10.0-alpha.42 and frontend 0.15.0-alpha.54. These are distinct version domains.

- `protocol/dao.ts`, `contracts/common/records.hpp` and `contracts/runtime/runtime.cpp` store DAO identity in public metadata; `protocol/directory.ts` duplicates public discovery text.
- `services/api/src/creation.ts`, `services/api/src/dao-claims.ts` and migrations 006/050 persist creation and invitation requests. Encrypting only the final chain record would leave these copies readable.
- `protocol/ballots.ts`, `sdk/ballots.ts` and `contracts/decide/decide.cpp` in modules currently publish ordinary ballot text and option labels. Ballot definition commitments bind the original metadata and vote meaning; preserve this binding.
- Works, grant applications, reviews, agreements and service offers already reference ordinary DAO documents for most narrative content. Preserve these references instead of adding another content store.
- `contracts/payroll/payroll.cpp` stores labels both in controls and immutable agreed terms. Its 80-byte ASCII labels cannot hold arbitrary encrypted JSON. Existing monetary obligations are authoritative and must survive any display change.
- `src/content/files.ts`, `src/content/document-review.ts` and `src/auth/session.ts` in frontend already encrypt and verify protected documents and names. Their DAO/document/version/epoch domains and lock/context checks are reusable.
- Quick ballots encrypt individual choices but publish questions, audience and reader identities. Their frozen definition, public tally proof and 30-day archive rules are separate from ordinary Decide ballots.
- Live TESTDAO-2 (`1551563545746804138`) reports `encrypted-managed-allowed`, full-history access and epoch 1. Its content endpoint returned no documents, committed epochs or grants at inspection. Do not initialize it or change its policy without its owner's signed action.

## Privacy inventory and intended behavior

| Surface | New private content | Public minimum / exception |
| --- | --- | --- |
| DAO identity | Internal name, description, summary and private branding assets | Opaque DAO/deployment IDs and required governance setup; optional explicitly published alias/branding |
| Setup orders | Encrypt descriptive fields before the API receives them | Payment method, price, immutable operational configuration, account/order relationship and processing status |
| Claim invitation | Encrypted descriptive setup; decryption capability remains in link fragment | Expiry, network, operational setup and claim status; bearer-link holders can read the invitation |
| Decide | Encrypt title, explanation, custom labels and optional supporting-document reference together | Choice count/order indices, semantics, deadlines, thresholds, definition commitment, target actions and results |
| Works / Grants / arbitration | Use encrypted scope, application, submission, review and agreement documents | Parties' technical IDs, state, required conflict exclusions, dates and financial terms |
| Payroll | Encrypt agreed and editable display names; retain exact protected agreement references | Recipient ID, amounts, schedule, pause state and obligations |
| Members / agents | Keep personal/contact/operating descriptions in encrypted profiles or DAO documents | Existing member/public-key bindings, required participant-kind and role flags; no promise of hidden membership |
| Quick ballots | Private question text only for a qualified single-DAO audience with readable question grants | Encrypted votes remain as today; all-account questions and unqualified cross-DAO questions require explicit public publication |
| Documents / templates / services / app evidence | Preserve existing client encryption; remove narrative duplication outside ciphertext | Ciphertext reference, byte size, revision, epoch and commitments required for integrity |
| Search / notifications / AI / export | Local decrypted search; generic notices; ciphertext or explicit local plaintext export | No automatic decrypted-text forwarding to hosted AI/MCP, logs, analytics or server search |

Not every field above needs new contracts. Audit each writer and reader first. Where a surface already publishes encrypted documents, improve its presentation and leak checks rather than adding a parallel encryption implementation.

## Storage and cryptographic design

Use a protected document as the source of descriptive information. Introduce a producer-owned, versioned `PrivateRecordReferenceSchema` with `documentId`, `version`, `commitment` and `keyEpoch`. It refers to a document within the parent record's full DAO reference, never to a free-form URL. Validate the exact document version and its ciphertext commitment, envelope version 1 and epoch before accepting the reference.

The encrypted payload has a versioned `PrivateRecordPayloadSchema`: `schemaVersion: 1`, `kind`, `source`, `recordId` and a bounded body validated by the kind-specific producer schema. `source` is the owning native contract, preventing collisions between module deployments with the same record ID. Supported kinds are `dao-identity`, `ballot-content`, `payroll-label` and `agent-description`; use existing document schemas for other narratives. On decryption check the kind, source and parent ID as well as the existing encryption domain. A ballot payload contains its semantics and ordered labels; a payroll payload distinguishes immutable agreed names from later display names.

Use current authenticated browser encryption and random IVs, with no homemade cryptography or signature-derived global DAO key. Authenticate the full DAO/document/version/epoch domain. Never hash low-entropy plaintext labels as the public commitment: commit to ciphertext. Reuse the current epoch-key lifecycle rather than making the operator a key holder.

Keep ciphertext in existing document records/IPFS. Do not duplicate it into every module row. Retain referenced versions through the existing document-reference mechanism, including ballot snapshots, agreed payroll terms and governing-document history. New reference slots must be bound and released by their owning contract, with release conditions that preserve outstanding rights. A pending upload or lost response is reconciled against its original receipt and exact chain record before retry.

Current limits remain: complete inline JSON/envelope at most 4096 bytes, hosted stored file at most 5 MiB, module metadata at most 4096 bytes, and existing bounded grant/maintenance batches. Text validation preserves the producer's existing bounds. Oversized encrypted bodies use the file path; never truncate or publish them as plaintext. No new secondary index without a demonstrated lookup, justified RAM cost and cleanup path. Compile current contracts with pinned CDT `-O=s`; compare WASM size, per-record RAM and representative action CPU before release.

## Creation and invitations

New encrypted DAO creation publishes an opaque public identity by default. Reserve the DAO ID and immutable operational order first; generate descriptive ciphertext and its initial owner grant in the creator's browser before submitting confidential fields. Complete the initial epoch/document/reference installation without a window where confidential fields are published in a public request, chain action or Pinata name. If the workflow needs more than one transaction, retain a recoverable pending state and never mark private setup complete until all required records verify.

Claim invitations preserve the agreed behavior: first successful claimant wins, the issuer does not join, and creation happens when claimed. Before upload, the issuer encrypts only descriptive setup using a random invitation-content key. The claim bearer token and content key are distinct capabilities; put them in the URL fragment, send only the token to the claim API, and never send the content key in query strings, requests, logs or telemetry. Remove the fragment from browser history after a deliberate local handoff while preserving a safe in-memory retry.

The claimant decrypts the invitation locally and reviews the fixed operational setup. Their browser creates a new DAO epoch key and founder grant with their original account keys; it re-encrypts the descriptive body for that epoch. The issuer's invitation key never becomes the DAO key. Bind the claim request to its issuer's reviewed setup, full deployment, successful claimant, initial founder keys and idempotency identity. A changed setup or a claimant swap invalidates preparation. Keep existing expiry/revocation/race protection. Unsupported clients refuse the new private claim format rather than posting plaintext.

Email/Telegram accounts using explicitly authorized assisted recovery may follow their existing key policy. Self-custody accounts must have a qualified local unlock/recovery route. This project does not bypass the missing original-key access identified in the preceding account investigation.

## Module semantics and mixed clients

DAO metadata gets a new schema version with an opaque public title, empty public description, preserved public policy/provenance and a private identity reference; optional public alias/branding is a separate, explicit publication. Old clients see a generic private DAO and must not overwrite the protected reference when renaming or branding it.

Keep existing strict `/v1/daos` and `/v1/daos/:id` response shapes unchanged. New clients obtain the reference through the capability-gated `GET /v1/daos/:id/private-identity` route, whose response is `{ dao, reference }`, with a nullable reference. This avoids breaking old strict schema readers by adding fields to their summaries. Updated backends understand metadata version 4 internally; unsupported backends fail compatibility qualification rather than silently replacing the saved governance setup with defaults. Old SDKs cannot advertise the new capability or write protected metadata.

Add a versioned private ordinary-ballot metadata variant. It exposes semantics, generic ordered choice IDs and the exact encrypted content reference. On-chain definition commitments bind this complete variant and the current policy/target snapshot. A client must decrypt and validate the payload, resolve the ordered labels and review any target before voting. Missing keys, unavailable ciphertext, mismatched options or stale versions disable voting; there is no blind fallback. Keep machine-reserved election semantics and target actions public and unchanged. Existing ballots remain readable and retain their original commitments.

For payroll, add private-label actions/references without reinterpreting old serialized rows. Keep agreed private names pinned to the immutable terms version. Editable display names point to a new encrypted revision and cannot rewrite the agreed name, amount or successor relationship. Public legacy labels remain historical disclosures.

For Quick ballots, question readership and vote readership are different. A private single-DAO question uses DAO member grants, while individual choices remain readable only by the executives fixed when the ballot opens. Freeze the encrypted question reference into the definition commitment and preserve proof inputs and archives. One-to-many DAO audiences need their own reviewed question-key distribution before confidential questions are enabled. All-account audiences cannot provide confidentiality from a person who can simply register an account. Preserve public multi-DAO/all-account ballots with an explicit publication preview; never label these questions private.

Advertise matching capabilities before enabling writers: `private-records-v1`, `private-dao-identity-v1`, `private-ballot-content-v1`, `private-payroll-labels-v1`, `private-claim-content-v1` and `private-quick-question-v1` only when the corresponding backend/native/frontend set is verified. Unknown formats render locked placeholders. Old writers cannot downgrade a protected record to plaintext accidentally; intentional public disclosure uses a separately reviewed action.

## Reader lifecycle and interface

Readers use existing DAO history/custody grants. Deactivation rotates future epochs; old readers can retain old keys and plaintext. Do not re-encrypt historical obligations under only a current epoch and strand their authorized readers. A new member's history policy controls which descriptions and old terms they can open.

The UI labels the actual state: `Private content`, `Public blockchain records`, `Keys locked` or `Access not granted`. It offers the existing account-unlock entry and explains missing enrollment or grants without inventing a password the user never set. Decrypted values live in memory only, and clear on lock, sign-out, account/deployment/member change, inactive membership or revoked access. Stale async responses cannot repopulate them. Decrypt referenced records in bounded batches on demand, not the entire DAO at page load.

Use generic names in page titles, route/query parameters, document downloads offered before decryption, application errors, emails, Telegram notices, MCP output and archives. Local plaintext exports require a deliberate user action and clearly become unprotected copies. Public branding is never reused as private branding by merely encrypting its old CID.

## Existing DAOs and TESTDAO-2

Migration is owner/admin initiated and signed. Produce a preview listing public descriptive fields, encrypted replacements and data that remains public. Preserve IDs, memberships, roles, voting anchors, original keys, open ballots, policy revisions, document commitments, balances, claims and liabilities. Publish protected successors where permitted; do not rewrite live ballot meaning or approved terms. Record the current-version change without claiming to erase earlier transactions, IPFS copies, order records or recipients' downloads.

Do not convert TESTDAO-2 to strict user-controlled admission automatically. Offer an independent policy assessment; its managed-allowed setting has consequences even when its sole current member is self-custody. No initializer or migration can run for that account while its required original keys remain unavailable.

## Verification and launch conditions

Use distinct synthetic canary strings for every private field. Assert their absence in network requests except intentional local encryption inputs, chain action/table bytes, hosted metadata, database order/invitation records, logs, URL/history, AI/MCP payloads and notification bodies. Test normalized/Unicode strings and payloads at encrypted byte limits. The API receives ciphertext and necessary operational fields; it may still know account relationships and service metadata.

Test actual browser decryption and K1 signatures with disposable identities; native tests use actual compiled WASM/ABI and real permission paths. Rejection tests cover wrong DAO/record/version/epoch, tampered ciphertext, copied references, unknown formats, wrong keys, stale context, revoked members, downgrade attempts and missing source bytes. Upgrade tests start from the pinned current release and preserve ongoing ballots/payments/recovery/archive rights. Prove supported restore with the original keys and retained ciphertext; replacement keys alone must fail.

Require measured resource deltas, generated SDK/schema/help consistency and immutable compatible release packages before enabling a capability. Do not mutate core SDK32 or modules42 packages in place. Product copy must distinguish source implementation, enabled testnet capability and production qualification. This design document alone authorizes no chain transaction, fund movement, custody change or launch claim.

## Builder review and pending review

Reviewed inline against the source paths above because delegation is prohibited. The design includes order/claim leakage, label size limits, option/target binding, retained historical terms, future-key rotation, public discovery and AI/notification/export leakage. The implementation plan is [here](../plans/2026-10-16-maximum-content-privacy.md).

Author-selected defaults to review: encrypted DAOs use opaque identity by default; public identity is explicit; existing records migrate by signed opt-in; current protocol-visible governance/finance remains public; private Quick questions initially support a single DAO. These are implementation recommendations, not new user decisions or already-live capabilities.
