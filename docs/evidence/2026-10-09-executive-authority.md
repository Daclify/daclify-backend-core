# Executive authority execution evidence — 2026-10-09

## Scope and latest-code check

Implemented on isolated feature branches from `dev` in core, modules and frontend. Fetched all three origins before implementation and again during final review. Core includes `515ad3b`; frontend includes the newer `cf78308` Modules/Names navigation change; modules started from `ac14a7c`. Original environment files, legacy repositories and the four pre-existing untracked module/account audit artifacts were left alone.

The matching development packages are 0.9.0-alpha.1. Contract interface and persisted instruction domains remain 1. Consumer locks and the frontend's self-contained vendor archives were regenerated; unused 0.8 vendor archives were removed. No registry package was published.

## Implemented

- Explicit executive appointment, bounded rosters, configurable inactivity/quorum, heartbeat, public/member refresh and once-only native bootstrap.
- Owner-reviewed atomic handover with current-owner consent, expected roster/threshold/revision checks, owner-only code/ABI links, and separate native govern/hosting service permissions.
- Transitive managed-contract owner/active authority, last-controller guards and atomic wallet replacement with incoming-wallet consent.
- Governing-DAO administrator rights following eligible paired executives. Shared DAOs retain separate administrator roles and cannot claim platform ownership.
- Explicit Decide executive elections, pending term-start activation, holdover for unpaired successors, expiry/recall protection and representative elections without executive powers.
- Non-voting memberships with frozen ballot eligibility and adjusted member/credit/stake denominators.
- Typed authoritative governance responses, legacy defaults, fail-closed sign-in unlink/replacement checks and unlocked credential removal after revocation.
- Accessible Vue executive status, appointment/owner transaction downloads, wallet protections and an explicit election-purpose selector. Managed executive custody implications are stated.
- Generated help/reference updates, READMEs, release requirements and an owner-reviewed 0.9 adoption guide.

## Verification actually run

| Check | Result |
| --- | --- |
| Core C++ build and ABI/SDK generation | Passed using the pinned local Antelope toolchain |
| Five module C++ builds and SDK generation | Passed |
| Core unit/compiled VERT suite | 608 tests passed in 104 files |
| Module unit/compiled VERT suite | 151 tests passed in 27 files |
| PostgreSQL integration suite | 194 tests passed in 27 files |
| Frontend unit suite | 155 tests passed in 32 files |
| Frontend production build and Vue checks | Passed |
| Core/module TypeScript and core ESLint | Passed |
| Executive and latest catalogue navigation browser checks | 20 desktop/mobile Chromium checks passed |
| Browser accessibility | Axe reported no violations in the checked executive/election/catalogue screens |
| Native executive lifecycle on owned Spring chain | Nine tests passed; real signature/authority evaluation, 211.54 seconds |
| Direct paired-wallet activity | Two targeted native cases passed (bootstrap plus the new direct-wallet case); eight other cases were filtered for that run |
| Generated core/module documentation consistency | Passed |

Native cases covered owner consent and stale handover, bootstrap retention, managed owner inheritance, service/single-signer rejection, scoped shared creation, departure/replacement rollback, final-controller guards, timed inactivity and returning weight, all-inactive revival, and an unpaired elected successor that later pairs and takes control. PostgreSQL tests checked rollback when an authoritative executive binding remains or the chain is unavailable. Browser HTTP fixtures verified access/copy/unsigned downloads; they do not establish chain or provider integration. The additional direct-wallet case used submitnat with a real paired native signature, rejected the wrong wallet and verified nonce rollback/advance without a vault signing key. Ten distinct native cases were verified across the complete nine-case run and the two-case targeted run.

The pending-successor native regression first failed with `LAST_NATIVE_EXECUTIVE`. The corrected contract permits scheduling an unpaired successor but requires a paired controller for activation. The complete native lifecycle then passed. Revoked-credential and owner-staging name-order regressions also have focused tests.

## Review and limits

Reviewed owner/service separation, callback sender/code pins, binding proofs, roster replay/expiry, DAO isolation, administrative rotation, schema propagation and the final diff. The backend uses bounded reads of at most eight executive offices. Native account authority changes remain controlled by those accounts' own owners outside Daclify.

One remaining active eligible executive can take full control; this is the approved policy. Runtime code has owner delegation so reviewed code can maintain native authority. A malicious authorized upgrade can replace those guards. Managed custody providers hold member signing power and can authorize wallet replacement; user-controlled executive accounts avoid that custody delegation.

Local verification does not qualify a production release. Public testnet/mainnet upgrades and owner/active changes, external multisig signing, live Stripe/Telegram/Pinata/custody behavior and the unrelated provider suite were not performed. No blockchain assets were moved outside owned fixtures.

## Delivery

Feature commits are to be integrated and pushed to the three `dev` branches after final checks. `main` and the landing page are outside this change.
