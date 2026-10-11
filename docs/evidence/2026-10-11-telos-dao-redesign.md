# Telos DAO redesign execution evidence

User scope: redesign the whole Telos DAO page and add elections. The user explicitly chose Foundation elections and block producers. Existing authorization covers commits, dev pushes and the existing workspace testnet deployment. Work is inline; no delegation or production chain writes.

## Changes

Modules 0.10.0-alpha.2 adds VOTE leaderboard history, bounded Foundation/election filters, producer standings and the separately fetched active schedule. Core 0.14.0-alpha.2 hosts validated public routes. Frontend 0.14.0-alpha.4 supplies Ballots/Elections/Block Producers views, dark/amber cards, recorded candidate totals, publisher identification, safe links, status/search filters and append pagination. Existing native account pairing, supported Decide vote preparation and pending-transaction safeguards are preserved.

The mainnet `tfvt........2` ballot is a `leaderboard` published by `tf`; the old reader excluded it. Verified against the deployed ABI/table and [Foundation's participation guide](https://medium.com/@TFGuardians/how-to-guide-participating-in-on-chain-guardians-elections-7f5581a543bc). [Decide source](https://github.com/telosnetwork/telos-decide/blob/master/contracts/decide/include/decide.hpp) documents category and primary table order. [System contract source](https://github.com/telosnetwork/telos.contracts/blob/master/contracts/eosio.system/include/eosio.system/eosio.system.hpp) and actual RPC responses establish producer row fields.

## Verification ledger

- RED: four new module tests failed because leaderboard history was excluded, filtering was absent and producer reads were absent. GREEN: 13 Telos module tests pass.
- RED: public producer route returned 404. GREEN: all five Telos route tests pass.
- RED: new browser journey could not find Telos DAO heading. GREEN: Foundation candidates/producer schedule and empty-page continuation journeys pass with axe.
- First module full run: 191 passed, one old compatibility expectation failed because it rejected the newly pinned core. Updated the exact accepted version and retained rejection of the next unqualified prerelease; 19 focused SDK/Telos cases pass. Full rerun passes all 192 cases.
- Frontend lint, Vue/TypeScript checks, 280 unit cases and production build pass. The initial broader desktop/mobile suite passes all 38 cases. Final Telos suite passes all 28 desktop/mobile cases, including focus/viewport and Back navigation. Latest frontend verification again passes 280 unit cases and build.
- Core lint, types and generated documentation checks pass. Full core suite passes all 887 cases. Core build also passes.
- Actual SDK read smoke on mainnet and testnet: retained Foundation elections were found, first 25 producer rows were parsed and each network's separate 21-member active schedule was returned. Testnet discovery required five bounded filtered requests; mainnet required two. Signing remained unavailable. These are read checks, not wallet transaction qualification.

## Limits

History covers retained contract records only. Producer history is the current schedule/registration state; old schedules are not reconstructed. Option account labels remain those stored by Decide, and charts compare with the largest recorded total. Leaderboard and producer signing are unqualified. Testnet and mainnet are kept separate; no mainnet Daclify deployment or transaction was performed. No own contract, authority, database schema, service dependency or production setting changed.

Final review reproduced and fixed an unavailable schedule being presented as empty, and duplicate election reads when returning from producers. Both were RED→GREEN with desktop/mobile browser coverage. The concurrent account-layout edits were preserved; 34 account-entry cases and two account-settings cases pass, including phone/enlarged-text layouts. The stale Account-help overlap expectation was updated after the concurrent removal of that link. Four optional legacy cases (handbook assistant and EVM pairing/removal on desktop/mobile) could not run because their local API fixture at port 3008 was absent. They remain environment-unavailable, not live-provider qualification.


## Testnet delivery

Core source `26be1bb55ed9e46f6f201099d13c6056525d6984`, modules source `9dec7a9` and frontend redesign/focus sources `f7b116e` / `9dfb385` are committed and pushed to dev. Concurrent account changes are preserved in frontend ancestry. Committed sources are archived under `/data/daclify-runtime/releases/20261011-telos-dao-redesign`; final frontend sources are under `/data/daclify-runtime/releases/20261011-telos-dao-focus/daclify-frontend`.

A fresh same-VM recovery drill stopped the source key service and recovered the original transit key in an isolated restore process. Four least-privilege denials, verified TLS and audit plaintext exclusion pass. The qualification binds core 0.14.0-alpha.2 and retains the existing expiry, 2026-10-17T14:46:09.233Z. No validation bypass or key replacement occurred. Both recovery services and API are active; API automatic restarts remain zero. Public assisted signup is available. An initial readiness probe used the wrong `/v1/health` path; the corrected `/health` probe and public API reads pass.

Public API reports core 0.14.0-alpha.2 / modules 0.10.0-alpha.2. Producer reads return 25 bounded rows and the separate 21-member active schedule. The initial public desktop/mobile run passed all three governance views, account choices, layout and accessibility checks, with no browser errors or requests to the wrong API origin. The final 0.14.0-alpha.4 publication passes the public desktop (1440×1000) and mobile (390×844) checks, including election details inside the viewport, restored Back focus, all three governance sections and account Restore/Cancel. Browser errors and requests to the wrong API origin are both zero. Served index SHA-256: `f38c860c5b9e546099f36c0c045d545d6add01c1ed99b9b421547f2e56bcb694`. Producer weights display compact approximate values with exact contract values on hover.

Pinned development archive SHA-256: core protocol `6ea8dc87d3e9cfb83f3aef2a28a78268282d6ba5472ecacdd38700813f02532c`; modules `ae98236e165ec45e1e06c00ea45ded36ea2fb6835eaa538bcc18305827780e9d`. These are development archives, not a qualified immutable production release.
