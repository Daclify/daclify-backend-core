# Development checkouts and tests

This is an incomplete development release. Direct module-key callbacks are rejected on the current runtime, and that check was rerun on the local native fixture. On-chain module code pinning and the other limits in [implementation limits](evidence/implementation-limits.md) remain open. Do not interpret application or emulator checks as a passing native security suite.

Check out `daclify-backend-core`, `daclify-backend-modules`, and `daclify-frontend` as sibling directories. They remain independent repositories, with separately versioned public core and module packages. Node 24.21 or later in the Node 24 line and npm 11.19 or later in the npm 11 line are required.

From core, run `node tools/bootstrap.ts` before the first ordinary `npm ci`. The dependency-free entry point stages only public protocol/SDK source, uses the checked-in builder lock, compiles that public package, packages the modules, and installs each repository. Local development package integrities are refreshed explicitly. The modules' exact core peer version is preserved. This does not publish registry packages or qualify a release.

The initial package graph contains local development tarballs, including the core service's own public SDK. An ordinary first `npm ci` cannot create those tarballs. Existing npm caches and old lock integrities can otherwise conceal a stale SDK. The bootstrap was verified in a source-only copy with no pre-existing `node_modules`, `dist`, or contract artifacts.

To build the C++ artifacts, first build the documented checksum-verified Docker toolchain image from `tools/build/Dockerfile`, then run `node tools/bootstrap.ts --contracts`. It compiles core and module contracts, regenerates ABI types and references, and stages the core WASM/ABI consumed by module tests. It does not start or deploy to a blockchain. Generated artifacts must be checked against source before release.

Ordinary checks:

- Core: `npm run typecheck`, `npm run docs:check`, `npm test`.
- Modules: `npm run typecheck`, `npm run docs:check`, `npm test`.
- Frontend: `npm run build`, `npm test`.
- PostgreSQL/API: set `DATABASE_URL` to an isolated local database whose name ends in `_test`, then run core's `npm run test:integration`. The harness rejects other database locations.
- Browser: use the disposable native chain and PostgreSQL fixture, run core's `npm run dev:local`, then frontend's `npm run test:e2e`. Native test tooling is local-only and uses synthetic tokens. The browser suite includes two internal accounts with separate contributor/reviewer roles.

The local API uses a labelled disk content fixture with a 50 MiB per-DAO allowance. Its content-addressed files are not evidence of Pinata or public IPFS availability. Production storage requires backend `PINATA_JWT`, `CONTENT_GATEWAY`, and an explicit `CONTENT_FREE_STORAGE_BYTES` allowance. No live provider credentials are currently configured.

Hosted reconciliation uses the existing PostgreSQL job table and leases, one bounded task per worker. Retry results back off to at most one hour. Lost leases cannot complete a job; malformed inputs and uncertain duplicate/expired pins produce a manual-review hold. Holds retain storage allocation. Automatic unpinning and a retention guarantee remain unimplemented.

Two applied migrations are immutable. New database changes require another migration; do not edit `001_core.sql` or `002_hosted_content.sql`. Fixture enroll/fund commands and native keys belong only to the disposable test environment. No production deployment, authority changes, funds movement, or legacy migration is included in this workflow.
