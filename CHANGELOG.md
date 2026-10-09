# Changelog

## 0.9.0-alpha.6 development — Daxi support and Status metadata

Name the shared app/Telegram assistant Daxi and support reviewed Telos Zero/EVM and general DAO guides with light, helpful humour. Use simpler evidence-based guide selection, retain output grounding, exact guide/source URL checks and existing privacy/rate/deadline limits. Add optional reviewed sources and public model/scope/knowledge metadata; generate the matching help and API references. Status configuration does not establish live qualification.

SDK/help changes leave contract binaries and database layouts unchanged. Read actual module contract versions from their manifests rather than the SDK package version. See [Daxi operations](docs/operations/docs-assistant.md).

## Unreleased — handbook assistant and Telegram groups

Added `TELEGRAM_DOCS_PRIVATE_CHAT_IDS` for explicit one-on-one testers. Private questions require matching human sender/chat IDs; group commands/replies remain restricted. Private-only setup can omit groups and validates the private chat instead of requiring group membership.

Handbook routing reads actual guide evidence, preserves the complete selected guide and checks replies for support before returning them. App and group requests share bounded provider deadlines, responses, rates and concurrency. Generated help now documents provider setup and disambiguates paid-slot pricing with tested default-capacity examples.

Added opt-in authenticated Telegram group webhooks for `/docs` and replies only, approved-group restrictions, forum reply targets, canonical source links and PostgreSQL retry receipts without conversation storage. Setup checks privacy, regular membership and webhook conflicts; it registers only with `--confirm`. Group deployment/qualification remains separate. No contracts, account keys or pairings change.

## 0.8.0-alpha.1 development candidate — RAM, prepaid storage and Archive

- Fixed live Pinata upload/CID recovery by following terminal cursors with bounded coverage, duplicate-ID and loop checks.
- Added source/artifact-bound release evidence validation and immutable local packaging; incomplete or changed reports remain refused. This is not registry publication or deployment.
- Added a chain/code/raw-ABI pinned public Telos token downloader and owned-native new/legacy sender tests, preserving exact deployed ABI bytes and separating external payer changes from DAO usage.
- Qualified eight maximum-title election terms at both native payer limits, including actual historical election adoption without rewriting ballots or member credentials.
- Guard activation now verifies existing credentials, claims and pending holds plus pinned module completion checks. Bounded completion-only adoption preserves already-metered legacy counters.
- Extended the owned native observed-upgrade drill to Grants and signed governance, preserved failed award plans, and consumed the compatible Decide migration fix and retained poll Archive decoder.

Native RAM purchases verify actual acquisition; card orders use a separate funded operator reserve. Physically backed per-DAO/payer allocations, native counters, finite financial/election holds, bounded legacy adoption and explicit growth enforcement preserve existing record layouts and signing domains. Works acceptance reserves fixed review/submission reference slots. Full-claim withdrawals are the emergency exit; partial withdrawals need ordinary capacity.

Prepaid pinned storage has immutable pricing/period agreements, verified CID ownership/reference accounting, 30-day grace, notices and fenced opt-in cleanup. The Archive service adds encrypted backups, native approval/revocation, constrained poll/document pruning, retained trusted decoders and original-kit recovery. Shared gateway requests require a manually funded, bounded allowance.

Reviewed development checkpoints are integrated into main; continuation uses `codex/resource-billing-archives`. Public rollout, destructive retention and immutable release packaging remain gated by the recorded migration, token, native and live-provider requirements. See [execution evidence](docs/evidence/2026-10-08-resource-execution.md).

## 0.7.0-alpha.1 — Shared hosting and connected payments

Applied AGPL-3.0-only to first-party code, contracts, SDKs and documentation; preserved third-party licenses. Development packages include the license and source guidance.

Free shared creation and 10 included members; explicit monthly graduated capacity, governed future rates and grandfathered agreements. Optional DAO merchant onboarding,5% governed Connect commission, receipt/refund controls and server-only broker integration. Public Hub portal discovery, isolated independent API selection and issuer-bound account-control challenges. Coordinated protocol/help/SDK upgrade and local regression checks; live provider qualification remains held.

## 0.6.0-alpha.1 — Wallet disaster recovery

Wallet recovery after service database loss; per-DAO live native/EVM bindings and explicit wallet-only accounts. Dual-proof vault attachment preserves the recovered service ID. SQL migration 015 preserves existing accounts and rejects last-control removal. Includes restore-session invalidation, generated recovery help and failure/concurrency tests.

Updated READMEs, documentation navigation, recovery/storage limits and coordinated 0.6 upgrade instructions. Generated help and development package integrities are refreshed together; older dated evidence remains historical.

Development prerelease; production release gates remain in force.

## 0.2.0-alpha.1 — DAO presets and guarded agents

- Versioned DAO purpose presets and metadata schema 2, retaining schema 1 readers.
- Contract-enforced ballot policy, commitment budgets and separate guardian controls.
- Agent admission, scoped credentials, revocation and signing recovery.
- Atomic preset creation, governance read API, scoped relaying and bounded Works execution.
- Generated references, explanatory guides and a provider-neutral public publishing example.
- Combined marketplace/name integration, with distinct setdaogov and setgov actions and reviewed module catalogue fixtures.

Development prerelease. Existing production release gates remain in force.
