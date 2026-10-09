# Workspace consolidation and local testnet restart

The branch inventory covered 43 worktrees: core 17, modules 12 and frontend 14. Every local branch was already an ancestor of its repository’s current dev branch. There were no uncommitted code changes in the alternate worktrees. Core had four untracked historical audit/account snapshots; they were scanned for common private-key/provider-token formats and marked as historical before inclusion.

## Connection and fix

The hosted API at https://testnet.api.daclify.com responds but does not allow either tested local developer origin through CORS. The existing local configuration instead runs the API at http://127.0.0.1:3028, bound to loopback, with its existing .env.testnet and PostgreSQL database daclify_telos_testnet. The frontend at http://testnet.localhost:5198 uses the existing same-origin Vite /v1 proxy. No public Mac API address or hosted-server change is needed.

A real browser run exposed HTTP 400 from /v1/hub/directory. Telos serializes the native listed Boolean as 0/1. The registry schema now reuses the generated native Boolean transport schema: true/false or exactly 0/1, normalized to a Boolean. Strings, other numbers and null remain invalid. Both directory discovery and independent merchant authorization consume that shared schema.

Regression tests failed on numeric 0/1 before the fix, then passed. Independent merchant tests show numeric zero remains unauthorized, and numeric one still requires reviewed runtime code. Packages and pinned frontend archives were advanced to 0.9.0-alpha.3; C++ sources and on-chain state were unchanged.

## Verification

- Core: lint, strict types, generated docs and SDK build passed; 623 tests passed in 105 files.
- Modules: verify passed, including 153 tests in 27 files and generated documentation checks.
- Frontend: verify passed, including 155 tests in 32 files; production build passed.
- Live local browser smoke: network, DAO list and Hub directory all HTTP 200; testnet environment, runtime daclifycore1, Hub daclifyhubv1, three shared DAOs and no unexpected failed API requests or page errors. The permission diagram loaded.
- Chain ID: 1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f; RPC https://testnet.telos.caleos.io.
- Directory returns zero independent entries and skips one legacy registration whose metadata does not match the current portal schema. Shared DAOs remain visible through the runtime.

Only the identified local frontend and API processes were restarted. Both use the primary dev checkouts. Existing browser vaults, local database records, private environment files and other running Docker services were preserved. Fresh-browser verification did not sign in, create a DAO, send a transaction or call paid providers.

The deployed runtime code hash does not match the current SDK hash. Connecting to testnet does not deploy the latest contracts; newer contract features still require a separately reviewed deployment. The local API reports its own development package version. Native/resource/provider qualification was not rerun for this TypeScript transport fix.
