# Suffix account minimum price

Use executing-plans inline, as required by the workspace instructions.

Goal: suffix accounts cannot be sold below the current normal basic-account price.

The Names contract owns the floor. Reuse its basic quote calculation, without changing serialized rows, fee splits, provisioning tiers or seller authority. Validate every nonzero rail on registration and edits; zero still means that rail is unset. At purchase, use the higher of the seller price and current basic quote. Raise the effective price after a suffix sale, preserving unset rails. API quotes and the seller form must agree with the contract. A stale fee reference disables USD quotes while native pricing continues.

- [x] Add failing compiled-contract tests for native/USD registration, dotted exact-name edits, rising floors and effective sale increments; API tests for the same quote behavior; desktop/mobile form coverage.
- [x] Implement shared basic pricing and floor checks in Names, matching API quote calculations and seller hints/validation. Run targeted checks.
- [x] Regenerate canonical SDK/docs and package immutable development versions for all consumers. Run core/frontend suites, lint, typecheck, builds, documentation checks and browser checks; review connected code inline.
- [x] Prepare and simulate the compatible testnet code upgrade, preserving policies, tables, reserves and permissions; apply it, integrate dev and deploy the API/frontend; record live evidence and publication limitations.

Review focus: stale pricing must fail closed; USD-only offers retain conversion behavior; explicit dotted listings cannot bypass the floor; old offers must not undercut a rising floor; post-sale increases must start from the charged effective price. Third-party card routing remains unavailable. These price comparisons do not change the platform's existing third-party revenue share.

Execution ledger: started from core d37fcc5, modules a9dfca5 and frontend ce7b209 in existing clean isolated worktrees. User authorization includes ongoing testnet implementation; production is outside this change.

Contract/API red-green verification reproduced below-floor registrations, legacy underpriced purchases and dotted-listing fulfillment. Compiled WASM regression suites passed, including RAM/TLOS drift, expired fee/oracle references and USD-only conversion. The full core suite passed 116 files / 705 tests; a final USD-only contract regression added afterward passed in the targeted 20-test contract/API run. Frontend passed 179 unit tests and all 14 desktop/mobile Names tests. Module metadata/SDK/docs checks passed 7 tests. Lint, strict type/template checking, testnet build and generated-document checks passed. All consumer tarball integrity pins match. Inline review caught and corrected the client error class so below-floor validation displays the canonical explanation.

Signed native pre-upgrade simulations rejected both one-unit-below-floor rails and accepted native, USD and dual-rail exact minima. First-party native account provisioning also passed with real Telos permissions. Names ABI is byte-compatible; all contract rows, policies, authorities and the 100 TLOS reserve remained unchanged. Code-only upgrade applied irreversibly in transaction 0ceb3ca7bc59d06720a21ec032b06acf031cba345e7b7b525200cb7f33b5e1f6 at block 449481664. Live UI integration and resumed timer checks are next.

Integrated dev verification completed: all 706 core tests passed. API/frontend deployed; new code pin validated by the resumed Names oracle service. Live browser inspection confirmed price validation but found an existing 20px seller-guide target on a 390px mobile viewport; a failing regression reproduced it. Enlarging only that link to a 44px target and re-verifying UI is the final corrective step.

Final: all 14 Names browser tests passed after the mobile fix and reference-label clarification. Deployed frontend/API passed desktop/mobile real-API minimum-price/export checks with zero WCAG 2.2 AA violations, page errors or overflow. Integrated core dev passed 706 tests; frontend passed 179 unit tests and final strict template/build checks. Module compatibility metadata was integrated into dev. All three continuing development checkouts have the completed implementation; testnet code, service and asset updates are verified. No suffix purchase, seller authority mutation, main/production release or reserve transfer was performed. Remote dev pushes remain dependent on GitHub server authentication.
