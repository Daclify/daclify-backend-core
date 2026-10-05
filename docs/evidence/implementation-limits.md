# Implementation limits and verification holds

Updated 2026-10-05. This is an incomplete development release, not a production readiness claim.

## Platform interruption

The user repeatedly received the VS Code notice “This content can’t be shown” with advice to apply for Daybreak. Local request errors identified possible cybersecurity risk while the configured/requested model remained `gpt-6.1-sol`. No model switch or agent delegation was performed. The exact classifier decision and the account's access provisioning are not visible to this implementation.

The security checks associated with those interruptions are held rather than repeatedly retried. Application, documentation and ordinary functional work continues. A held check is not a pass. The agent cannot dismiss the notice or provision access. OpenAI's [official guidance](https://learn.chatgpt.com/docs/cyber-safety) recommends reporting suspected false positives through `/feedback` where available.

## Known contract issue

Direct module-account authorization no longer reaches `reserve`, `approveob`, module `cancelob`, `govlock`, or an unexpired `govunlock`. `require_source` requires `get_sender()==source`, which an inline action from the module contract sets and a direct key signature does not. DAO-owner cancellation and permissionless settlement of an already approved obligation are unchanged.

A module install that keeps any action or grant must store the hash returned by `get_code_hash` for that account, and the hash must be non-zero. `require_source` and member-instruction dispatch both reject the call when the live hash differs. Clearing both the action list and the grant list removes the pin without reading the current code, so a replaced module can still be disabled. On 2026-10-05 the local Spring 1.2.2 fixture activated builtin feature `GET_CODE_HASH` and then loaded this runtime. A wrong pin was rejected, `works::accept` still reserved funds, and a replacement of a test account's wasm made the next callback fail with `MODULE_CODE`. Node SHA-256, WharfKit, GreyMass, and `get_code_hash` agreed on the deployed wasm. VERT also rejected a replaced module's member instruction. The API treats an enabled row as code-verified only when the live hash matches both the reviewed module hash and the stored pin.

This is not a completed module-authority package. Module rows written by the previous ABI do not deserialize. The runtime wasm does not load on a node where `GET_CODE_HASH` is inactive. Whether Telos mainnet has activated that feature was not checked. The first-party works, decide, and payroll wasm were not rebuilt; the current native works contract still executed `accept` against the extended row. Client hash checks remain a second layer. They do not replace the contract check.

Network metadata currently reports the service package version. It does not independently verify the core runtime's deployed code/ABI hashes. The handbook identifies that distinction. Full runtime release verification remains required.

## External integrations

The user has no configured Pinata credentials, Google OAuth client or Telegram bot. Local schemas, adapters and fixtures do not establish a live provider integration. Managed recovery's OpenBao development signing and wrapping checks do not establish production custody operations, restore procedures or the full account recovery journey.

Hosted uploads currently use a bounded backend-mediated path. Fault-fixture and PostgreSQL checks cover retry binding, quota reservation and byte verification. A fixed CIDv1 profile is requested, but live provider upload/retrieval, indexed completion behavior, sharing and retention costs remain unverified. Uncertain/orphaned reservations keep their budget allocated; automatic unpinning is not enabled. Public/private file UI, download byte checks and a bounded leased reconciliation worker are implemented and exercised locally. The disk provider is explicitly labelled; it is not Pinata/IPFS integration evidence. Automatic cleanup, shared-reference retention and re-pinning remain incomplete.

No production deployment, native authority change, asset movement or legacy cutover has been performed. Packages currently consumed across repositories are local development tarballs; immutable registry releases and their complete verification manifest remain pending.

## Product and release scope

Decide finalization, Works submission/review/revision/cancellation, payroll settlement after removal and signed treasury exits are wired into the UI/API. Fixture enrollment does not establish a production invitation/admission flow. The browser and service still target one configured runtime; independent hub/fleet routing remains incomplete. Each DAO currently has one native treasury asset; claim-to-stake conversion and multiple assets remain future work.

The development bootstrap was exercised from source-only sibling copies and rebuilds actual C++ artifacts with the checksum-verified image. It refreshes unpublished local tarball integrities; it is not immutable registry release management. CI, the complete tested release manifest, production deployment tooling, legacy cutover and remaining master packages are pending.

Public sponsored factory resource/rate limits remain incomplete. The regular API entry point still needs deployment/module configuration tooling; the local fixture explicitly configures its first-party modules. A passing local journey is not a qualified public service deployment.

`package:release` explicitly refuses this incomplete checkpoint. Merely creating a manifest file cannot qualify it. Local development SDK packaging remains available for review.
