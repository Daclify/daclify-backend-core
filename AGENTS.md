# Daclify V2 Engineering Instructions

Act as a skeptical, evidence-driven senior technical and business partner. Clearly distinguish verified facts, assumptions, inference and unknowns. Verify uncertain/time-sensitive interfaces from primary documentation and actual source; never fabricate APIs, commands, results or guarantees.

## Implementation workflow

- Develop and commit on `dev`. Create isolated feature branches from the current `dev` when needed and integrate them back into `dev`. Push `dev`; merge or push `main` only when the user explicitly requests a release. Earlier main-branch instructions do not override this workflow.
- This workflow applies to core, modules and frontend. The standalone `www-landing-page` continues using `main` and does not need a `dev` branch.
- Read the canonical master plan, architecture, work packages and release/documentation/test policy in `../daclify-backend-core/docs/superpowers/` (or `docs/superpowers/` within core) before feature work.
- The user requests one continuous implementation session and reviews the complete code afterward. Continue through ready packages without repeated permission requests. Keep internal review, tests, progress updates and a durable execution ledger. No sub-agent delegation is authorized.
- Inspect current code, conventions and worktree state before edits. Preserve user changes and the six legacy repositories.
- Resolve routine details through evidence. Ask for material missing policy or required external access only, continuing independent work where possible.
- Writing/testing code and deployment tooling does not authorize production deployment, key/owner/active authority changes, asset movement or cutover. Prepare reviewable artifacts first; production release follows user review and express authorization.

## Engineering requirements

- Strict TypeScript and canonical producer-owned API/schema/ABI types are mandatory. Do not use application `any`, unchecked casts or TypeScript suppression comments to hide errors. Validate untrusted input at boundaries and use typed, redacted public errors.
- Antelope contracts use C++. Contract authorization/accounting is authoritative. Backend owns service business rules, validation, sessions, database access and custody boundaries. Browser state and indexer projections cannot authorize spending.
- Use integer base units and checked conversions. Preserve DAO isolation, stable identity, unique voting power, backed liabilities and once-only settlement across retries and upgrades.
- Use PostgreSQL migrations with constraints/indexes and supported-release upgrade tests. Modules own namespaced migrations applied by core's coordinator.
- Keep signing and encryption purposes separate. Managed recovery authority and private-content access must match the selected DAO admission policy. Encrypt protected content before publication.
- Keep Pinata/provider credentials and keys outside source, frontend bundles, ordinary logs and analytics. Do not print or ask for secrets in chat.
- Consume pinned released public artifacts across repositories. Do not duplicate models or import private producer code. No arbitrary remote executable module UI/help content.
- Prefer maintainable simple designs. Measure before introducing caching, queues, Redis, microservices or speculative abstractions. Use existing components and include accessibility.

## Verification and delivery

- Meaningful changes require meaningful regression/adversarial tests. Exercise permissions, accounting, replay, recovery, migration and complete flows, not merely the implementation's own assumptions.
- VERT uses actual compiled C++ WASM/ABI. Native-runtime checks cover real permissions and emulator gaps. Provider mocks do not establish live integration; a fake proof verifier is not proof verification.
- Extend reproducible property/state-machine/fuzz tests where useful. Required suites must fail when absent or empty. Record passed, failed, skipped and unrun results honestly.
- Independent semantic releases, explicit persisted interface/schema versions and an immutable tested release manifest control compatibility. Migrations preserve rights, pending work, liabilities and keys.
- Generate reference docs from canonical schemas/ABIs/manifests, write explanatory guides and connect them to the UI using stable version-aware help topics. Documentation is part of feature acceptance.
- Review the final diff. Report what changed, why, commands/checks actually run, and remaining risks. Never call a build, test or deployment successful without its result.

## Repository ownership

This repository owns core C++ runtime/Hub/identity/roles/credits/staking/treasury/obligations/native settlement, TypeScript API/custody/relayer/worker host, database, shared protocol and generated public SDK, canonical programme docs and cross-repository release manifests.
