# Daclify V2 Backend Core

Private development repository for Antelope C++ core contracts and strict TypeScript services. Core owns DAO runtime and discovery Hub, identity/roles, governance-credit and staking primitives, treasury/obligations/native settlement, API/custody boundaries, relayer/worker host, database migrations, common schemas, generated public SDK and release/deployment tooling.

Current status: incomplete development implementation. Core C++ runtime/Hub, generated protocol/SDK, TypeScript API, PostgreSQL migrations, user-controlled identity, hosted storage/reconciliation and functional test harnesses are implemented. A confirmed native module authorization defect, missing on-chain module code pinning, provider/custody qualification and remaining account/deployment/release work prevent production readiness. See [implementation limits](docs/evidence/implementation-limits.md) and the [execution ledger](docs/evidence/execution-ledger.json).

The comprehensive plan is version controlled here:

- [Master implementation plan](docs/superpowers/plans/2026-10-05-daclify-v2-master-plan.md)
- [Architecture and product specification](docs/superpowers/specs/2026-10-05-daclify-v2-architecture.md)
- [Work packages and acceptance criteria](docs/superpowers/plans/2026-10-05-daclify-v2-work-packages.md)
- [Foundation readiness plan](docs/superpowers/plans/2026-10-05-daclify-v2-foundation-plan.md)
- [Evidence and outstanding risks](docs/superpowers/plans/2026-10-05-daclify-v2-evidence-and-risks.md)
- [Versioning, product documentation, Pinata and test policy](docs/superpowers/plans/2026-10-05-daclify-v2-release-docs-test-policy.md)

The other repositories are [frontend](https://github.com/Daclify/daclify-frontend) and [backend modules](https://github.com/Daclify/daclify-backend-modules). In the standard local layout they are siblings. Core publishes safe versioned protocol/SDK/documentation artifacts; consumers must not import private service, database or custody implementations.

Core uses Pinata as its first pinning provider, with backend-only credentials and client-encrypted private content. Both shared multi-DAO deployments and DAO-owned independent deployments must satisfy the same conformance suite. VERT is supplemented by actual native-runtime tests for permissions and unsupported emulator behavior.

The user requests one continuous implementation session and reviews the complete code afterward. Record meaningful test results, migrations, compatibility and documentation with each feature, then deliver a complete review packet across all three repositories. Production deployment, authority changes and asset migration require separate express authorization after that review.
Daclify V2 — Antelope C++ core contracts, services, identity, and public protocol

For source-only checkout installation, local test setup and the held-check boundaries, read [development instructions](docs/development.md). Use `node tools/bootstrap.ts` before an initial ordinary `npm ci`; use `--contracts` to rebuild the C++ artifacts with the documented local toolchain image.
