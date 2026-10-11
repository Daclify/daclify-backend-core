# Audit remediation verification — 2026-10-10

The six confirmed review findings have source fixes across core, modules and frontend. Additional permission review reproduced and fixed circular executive/recovery delegation and prepared a stale Hub hash refresh. The new contract code, service-account authorities and application cutover are staged for express testnet rollout approval. This is a development release, not production qualification.

## Sources and artifacts

The starting `dev` revisions were core `cdc482a8e6e3683abece3fbc3a1594095e468067`, modules `d93ffea5f8f8e4a89210c303010becc48e22da03` and frontend `4d6df7323602bbba6f86ec1d7f703f8eb29412a0`. Implementation was inline, without sub-agent delegation.

Core/SDK and frontend are `0.13.0-alpha.3`; modules are `0.9.0-alpha.19`, with unchanged contract version `0.9.0-alpha.5`. Bootstrap completed with the final source, refreshed normal module fixtures, pinned consumer artifacts and consumer lock integrities. Its initial import-only SDK resolution failure was corrected before the final successful run.

| Artifact | SHA-256 |
| --- | --- |
| Runtime WASM | `a05da7ad1cf616db6af7129fa036ddbc4ae03423f81c87f5eae17d3c78878213` |
| Runtime serialized ABI, unchanged | `50ab00d5e3e61a5e1fa4339a2edecaa005cd1edd7f28268aa87c7d8195fa4e63` |
| Names WASM | `29f3155cc67c86871aa862b0ae9168acfdbaadf899721d4f5ef9a7ccaff86a65` |
| Core public SDK tarball | `ecf580b7dbe87df81cd71d0a3cee4224ae6ee0551c64e6b5ed49c3d3239e5f8b` |
| Modules tarball | `5245bac3018423be6701459a50a0b4e7420cbbcea9eb20ee7ce22490f79152d7` |

CDT 4.1.1 used the repository's default runtime compiler settings and `-O=s` for Names. Both existing serialized ABIs remain unchanged. Module WASM hashes are unchanged. An intermediate size-optimized runtime was discarded; final verification used the canonical artifact above.

## Final verification

| Check | Result |
| --- | --- |
| Core `npm test` | 804 passed, 129 files |
| Modules `npm test`, matching current core fixtures | 164 passed, 28 files |
| Frontend `npm test` | 210 passed, 38 files |
| Core `npm run test:integration`, owned isolated PostgreSQL database | 233 passed, 29 files |
| Core `npm run test:native:permissions`, actual Spring signatures and WASM | 136 passed, 9 files |
| Names, Status and handbook Playwright journeys | 52 cases in desktop and mobile Chromium; 104 runs passed |
| All three repositories: lint, typecheck, format and build | Passed |
| Core and modules: generated documentation checks | Passed |
| `node tools/bootstrap.ts` | Passed; final artifacts and fixtures installed |

All 1,547 unit/integration/native tests and 104 browser runs passed, with no skipped or failing cases in these final commands. The owned SQL database was dropped afterward; the live database was untouched. Earlier combined heavy runs hit existing 20-second contract budgets and a secondary VERT teardown error. One worker retained the cases and budget; the final canonical suites passed while running alongside the other repos. Recovery tests originally exhausted the new admission limit by reusing one client IP for many dummy accounts; distinct simulated client addresses fixed the fixture while preserving the same-IP rejection test. Old configuration assertions were updated for the intentionally qualified new package and Google settings.

Regression evidence includes signed ordinary-name takeover rejection, seller-paid listing RAM, namespace/signer substitution rejection, a 102-entry native catalogue and exact later listing lookup, invalid chain cursors, real SQL admission and expiry cleanup, actual JOSE rotation and forged-token rejection, and fixture binary drift rejection. The Relay tests perform an API creation order with the scoped operator and actual dummy treasury transfers; old keys, operator signing and partial executive quorums are denied. The circular-authority test first reproduced Fees becoming sole executive, then verified atomic rejection for Fees and Relay, plus delegated creator and executive owner/active through both core owner and active. Hub hash registration accepts executive authority and rejects the operator key.

Logs are retained in `.superpowers/sdd/2026-10-10-project-audit-remediation/`, including the final `*-documentation-final.log` files, `documentation-final-bootstrap.log`, `documentation-links-final.json` and the focused RED/GREEN evidence.

## Reviewed rollout

`.artifacts/project-audit-testnet-review.json` contains 32 unsigned actions in two ordered transactions: the runtime guard upgrade, followed by Names, unchanged-metadata Hub hash refresh and the 29 Relay/Fees authority actions. Required existing authority is reachable by the available deployment signer, verified with a read-only permission lookup. Current root creator and initial executive remain `3boidanimus3`; its configurable quorum is preserved.

Both transactions passed `compute_transaction` on testnet without broadcast. After the user selected the local shared-proxy option, the review packet added its exact configuration; all 32 encoded chain actions were compared and remain identical to the simulated ones. Each simulation starts from live state and does not persist the preceding simulation. The owned native tests establish the new runtime's guard behavior; the live rollout must confirm the first transaction irreversible and recheck the second transaction's preconditions. An initial combined transaction failed the decompressed-size limit, which is why the packet is explicitly staged.

| Simulated stage | Actions | Additional account RAM |
| --- | --- | --- |
| Runtime upgrade | 1 | Core: 12,750 bytes |
| Names, Hub and service permissions | 31 | Names: 860 bytes; Relay: 3,470 bytes; Fees: 252 bytes |

All fit observed allocations. The proposal includes no RAM purchase or token transfer; Fees held `1243.5234 TLOS` during preparation. Both service accounts have zero deployed code, so their proposed owner/active delegate to core active, with a 20-action operator child only on Relay and no service-account `eosio.code` grants. Service accounts remain outside immutable `nativegov.contracts`.

The currently deployed alpha.2 frontend/API also passed the read-only public desktop/mobile regression using the preceding committed checker, with real HTTPS/API/native state, fresh Names quote, no page errors and no misplaced API requests. The new checker expects the staged alpha.3 UI and is reserved for its approved cutover. Logs are in `public-live-baseline.log`.

The currently deployed price updater was separately authorized earlier. It was restored to an archived alpha.2 source/lock/artifact snapshot after development pins made the old mutable checkout fail. Its ordinary oracle observation completed irreversibly at block `449545558`, transaction `2b689b13fa9a259811bd04383e5f505cca64b6e389c5c9e2e96352b5d77cd711`. No contract code, owner/active, treasury assets or API/frontend release changed in that restoration. The approved audit cutover must advance the updater snapshot with the new contract pins.

## Remaining boundaries

The user chose to leave external HAProxy unchanged. The candidate supports exact `SHARED_PROXY_IPS=["192.168.5.1"]` without trusting that peer's forwarding headers. Anonymous routes share their existing aggregate budget, other peers retain per-client limits, and authenticated controls remain account-based. SQL regression proves more than 20 shared-peer admissions for vault and passkey challenges, ordinary-peer limits and forged-header rejection. The live API still uses its older configuration until the reviewed cutover; separate client-IP limiting cannot be restored without a trustworthy forwarded address.

Actual Google/wallet/passkey/Telegram ceremonies, Stripe/provider lifecycle and production load/soak qualification remain outside this remediation. The browser cases validate the real UI with substituted external responses; they do not establish those live integrations. Existing frontend documentation chunk-size warnings remain. Contract-only rollback reintroduces the fixed behavior; authority rollback and multi-stage recovery require fresh executive authorization and current-state review.
