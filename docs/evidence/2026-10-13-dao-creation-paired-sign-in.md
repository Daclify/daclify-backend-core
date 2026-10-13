# Shared DAO creation after paired sign in

13 October 2026. Frontend **0.15.0-alpha.26**, source `e2c7e2949fa73bff3d63bb5ffd00b4d15242c19a`, is pushed to `dev` and deployed on testnet from a clean detached checkout. Core fixture and operations documentation source `2517995cc54e7e286c3549c509408a9072929249` is also pushed. [Exact evidence](2026-10-13-dao-creation-paired-sign-in.json) records sources, artifact hashes, verification reports and cleanup.

The user successfully signed in with a passkey, chose **Shared contracts and hosting**, and saw only **Enable full access**, with account recovery and sign-in settings. The creation screen incorrectly required unlocked private signing keys even though the existing creation API uses an authenticated session, CSRF protection, an account-owned immutable order and the founder's public identity. A real local WebAuthn ceremony reproduced the missing form after successful sign-in. The deployed preceding frontend also reproduced it using an owned authenticated session with no private keys in the browser.

The screen now permits shared creation for an authenticated account with its existing public signing identity while the vault is locked. Signed-out users still need an account. A wallet-only account without its public identity still needs the existing account key setup. Member signing, private-content decryption and custody checks retain their existing requirements. The API, database schema, contracts and native authorities were not changed for this fix.

A second regression was found in the existing saved-order journey: entering or reloading `/create?order=<UUID>` after account/network state was already loaded did not fetch the order. The account/network watcher now runs immediately; the redundant mounted fetch was removed. Loading and refreshing still only review the saved immutable order. Creation requires explicit confirmation, and the existing API checks order ownership and founder identity.

## Verification

- Final frontend unit run: **345 tests / 60 files passed**. Strict TypeScript/Vue template checks, focused lint, formatting and clean locked frontend install/build passed. The build retains its existing large-chunk warning; no dependency was added.
- Final browser run: **16 / 16 passed**, across desktop and mobile Chromium. This includes actual passkey enrollment/sign-in, locked-vault shared creation, native order fulfillment, active administrator membership bound to the original public key, saved-order reload and explicit confirmation, signed-out/keyless-account guards, readiness retry, preset/discovery behavior and accessibility checks.
- The passkey ceremony uses Chromium's controlled virtual authenticator; API signature verification, SQL account/session state and native Spring creation are real. The owned fixture uses explicitly selected localhost and free shared creation, matching the live creation path. Existing paid-fixture defaults remain unchanged.
- Core fixture TypeScript and generated documentation checks passed. Full core, modules, all other browser suites and physical-device/provider ceremonies were not rerun for this frontend fix.
- Clean candidate preflight and final public HTTPS checks passed at **1440** and **390** pixel widths against the actual testnet API. The setup form was visible and its free review button enabled with the vault locked, no private browser keys, zero accessibility findings, overflow, console warnings/errors, page errors, failed HTTP requests or misplaced API reads. These public checks did **not** confirm creation or create a public DAO.

The first passkey test attempted a session read before the login ceremony finished; awaiting the successful login response corrected that harness race. The subsequent regression run genuinely failed because the DAO form was absent. Broader browser attempts then used a mismatched numeric-loopback configuration and a paid fixture with the portal's free path; both setup errors were corrected. The matching free localhost run passed 14 tests and exposed two saved-order reload failures. After the immediate-watcher fix, all 16 passed. Initial and final reports are retained separately.

## Testnet delivery and cleanup

The immutable frontend entry SHA-256 is `e71a2bce213771a1ae34f667c18ceb3cccfd90a693a929dd4dd119491349553d`. Deployment checked the exact clean source, matching desktop/mobile preflight hash, unchanged preceding HTML and active API working directory. Static assets were copied before atomic entry replacement. The existing API source remains `b5c466ab03ed7812eddfc846f4a5dff0fbfebf09`, with core protocol **alpha.18**, module SDK **alpha.25** and the existing MCP artifacts. The API was not restarted. The frontend alpha.25 rollback is prepared and was not executed in this change.

The public platform read reported reachable matching chain, available shared creation, **zero shared creation fee and 10 included members** at verification time. This is observed testnet policy, not a permanent price promise. The owned temporary session was logged out; its old cookie returned 401 on protected account reads and 204 on optional session discovery. The cookie file was removed. No new OAuth families were created. The disposable local fixture stopped cleanly and removed its owned database and temporary files.

Review was inline by the author, as delegation is unauthorized. Physical user passkey retry remains unobserved. No production publication, live member/DAO mutation, asset movement, contract upgrade, authority change or real erasure was performed.

## DAO claim links

The user separately selected **first person with the link**, **only the claimant joins initially**, and **create on-chain when claimed**. These choices are recorded in the [draft claim-link design](../superpowers/specs/2026-10-13-dao-claim-links-design.md). The feature is not implemented in this release. Normal shared creation currently enrolls the founder as administrator; the proposed claim feature must also initialize an authoritative executive office without changing platform runtime ownership or its executive roster.
