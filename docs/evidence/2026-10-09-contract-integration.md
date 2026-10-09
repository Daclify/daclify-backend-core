# Contract integration and permission documentation evidence

This change adds qualification tests and documentation; it changes no C++ contract source, persisted ABI layout or live account authority. Development packages are independently pinned at 0.9.0-alpha.2. All native transactions use generated disposable fixture keys on loopback, with no real environment file.

## Coverage added

| Boundary | Checks |
| --- | --- |
| Native handover | Runtime, Hub and all five first-party modules hand over atomically to a two-executive quorum; owner/active keys are removed and code delegation is inspected from actual native account records. |
| Separation | Runtime govern, service and code-only execctx are distinct. The old root key, service key and one executive cannot change the roster. Each old module key is rejected. |
| Actual inline sender | Direct module member calls signed by the executive quorum are rejected. Direct treasury callbacks signed under each module's valid active authority are rejected because they do not originate from that contract. |
| Hub | Both runtime authority and registration owner are required. Directory registration gives no treasury callback capability. |
| Module cooperation | Grants application → reviewer → Decide ballot → Grants award → accepted Works agreement/project → Runtime reservation → milestone approval → claim. Payroll uses the same backed treasury and creates a second claim. |
| Replay and isolation | Repeated awards/settlement cannot pay twice. Votes/applications bound to another DAO fail and roll back the member nonce. A second tenant keeps separate balances, schedules and membership. |
| Callback capabilities | Removing Payroll's reserve grant rolls back its schedule, balances and nonce; restoring it makes the same operation work. VERT additionally checks missing Grants-to-Works grants, restoration and a cleared Works pin after an approved award. |
| Admission | Endorsement threshold is required; admission grants membership, not executive authority. Ordinary members can be marked nonvoting. |
| Token contract | Offboarding preserves earned claims. Withdrawal into a wallet without a token balance row fails atomically. The recipient opens and pays for its row, then receives the full claim; repeated withdrawal fails. |
| Product documentation | Offline SVG loads in the matching app guide, searchable permission examples, desktop/mobile layout and Axe checks. Latest concurrent module-card changes are retained and exercised. |

The new native file is a **stateful scenario**: later checks depend on successful setup and earlier payments. A fixture setup failure fails the suite; it is not a passing empty suite. Do not run it against a node already handed over by another suite.

## Reproduce on an owned fresh chain

Use sibling core, modules and frontend checkouts. Node/npm and the checksum-reviewed toolchain image must match [development setup](../development.md). Do not copy any real key or environment file.

```sh
# In backend core: creates locked development packages and compiles the contracts.
npm run bootstrap -- --contracts

# native:start refuses to replace an existing named container.
DACLIFY_NATIVE_CONTAINER=daclify-integration-native DACLIFY_NATIVE_PORT=21088 npm run native:start
npm run test:native:modules
```

The fixture name is explicitly allowlisted and its URL must be loopback. Transactions verify the node chain ID. Private fixture files under ignored `.artifacts/native` are local only.

Run `tests/native/executives.test.ts` on a **separate fresh run**, not after the module-integration file: both deliberately replace the root authorities. Stop/remove only the container you created before recreating that fixture. Never run the complete native directory indiscriminately on an already-mutated node.

Build the frontend and core SDK before the full core unit/compiled-WASM suite: the release-manifest tests hash those actual build artifacts. Core and modules also have their existing historical migration fixture prerequisites. Relevant standalone commands:

```sh
# frontend
npm run lint
npm run typecheck
npm test
npm run build
DACLIFY_TEST_UI_PORT=21178 npx playwright test --config playwright.config.ts tests/e2e/contract-permissions.spec.ts tests/e2e/docs-assistant.spec.ts tests/e2e/module-cards.spec.ts tests/e2e/catalogue-navigation.spec.ts

# modules
npm run lint
npm run typecheck
npm run docs:check
npm test

# core
npm run build
npm run lint
npm run typecheck
npm run docs:check
npm test
```

## Results and limits

Verified on the isolated worktrees, with frontend based on the latest module redesign commit `7fbaf7f`:

| Check | Result |
| --- | --- |
| Core unit / compiled-WASM suite | 610 passed, 105 files |
| Module unit / compiled-WASM suite | 153 passed, 27 files |
| Frontend unit suite | 155 passed, 32 files |
| Native permissions + new module integration | 22 passed, 2 files, 69.63 seconds |
| Native executive lifecycle on a fresh chain | 10 passed, 1 file, 210.86 seconds |
| Frontend desktop/mobile browser set on the module redesign | 40 passed, 27.6 seconds |
| Permission-guide Axe checks | Zero violations on desktop and mobile |
| Core/modules/frontend strict type checks and lint | Passed |
| Core/modules generated documentation checks | Passed |
| Core SDK and frontend builds | Passed |
| Module formatting check | Passed |

The native counts come from two separate fresh-node runs; they are not one indiscriminate run of the native directory. Browser HTTP fixtures establish UI behavior, not real payment or wallet-provider behavior. Native permission and settlement cases use the real local chain and signed transactions. Initial exploratory runs caught incorrect fixture field names and an invalid version-zero removal assumption; canonical generated types/contract code corrected the test setup. The first parallel full core run failed release checks because frontend/SDK build artifacts did not yet exist. Builds were completed and verification order corrected; no production behavior was changed to make a test pass.

The reviewed [permission diagram](../guides/contract-permissions.md) is illustrative after handover, not a current testnet account audit. Runtime code has root authority, so a runtime upgrade remains a deployment-wide trust decision. Single-active-executive control is the user's selected policy.

Live Telos deployment, production resource capacity/pricing, arbitrary third-party contracts, Telos EVM/external-chain settlement, Stripe, Pinata and social-provider qualification are outside these local checks. Existing native RAM/archive/upgrade/provider suites are not rerun by this task; the recorded passing suites must not be read as whole-platform production qualification.


## Delivered development state

All three repositories were integrated and pushed to `dev`; `main` was not changed. Implementation commits: core `6648481`, modules `4622f75` and frontend documentation `e2d104f`. Frontend delivery `837bb29` also incorporates the concurrent PWA commit `f06e58d`, following the module redesign. After that merge, frontend verify (155 tests), build, documentation browser regressions (8 desktop/mobile cases) and PWA checks (2 cases) passed; the full core suite passed again (610 tests). The earlier 40-case browser run predates the PWA markup change.

The local `eosio.token` account uses the compiled standard-shaped token fixture, not a live Telos token deployment. The local native node was stopped after testing. No real environment file, deployed authority or provider configuration was changed.
