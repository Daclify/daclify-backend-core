# Mini-app plan compatibility after restored-account reconnection

Reviewed 12 October 2026, Atlantic/Canary. Result: the mini-app, database, encrypted-profile, account-exit and MCP direction still applies. The restored-account continuation anticipated by the [previous review](2026-10-12-mini-app-plan-compatibility.md) has shipped as a testnet development release. This follow-up advances the execution baseline and the affected regression/file maps; all 21 implementation tasks remain pending.

## Pushed source reviewed

Fetched `origin` in all four repositories. Before documentation edits, each worktree was clean and its local branch matched the remote with zero ahead/behind commits.

| Repository | Branch/head                                    | Relevant change                                                                                                      |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Core       | `dev`, `27885ea`; application source `8ad9072` | Core `0.14.0-alpha.4`; restored-account native reconnection and publication evidence                                 |
| Modules    | `dev`, `b5e1721`                               | Modules `0.10.0-alpha.4`; exact core alpha.4 peer, explicit compatibility range and rejection of unqualified alpha.5 |
| Frontend   | `dev`, `398060f`                               | Frontend `0.14.0-alpha.7`; explicit reconnection, root signing, stale-response checks and matching vendor pins       |
| Website    | `main`, `d5c913d`                              | Unchanged main-app “soon” and test-app links                                                                         |

Reviewed the new source against `4a92d81` (core), `d4e42dc` (modules) and `093d0ac` (frontend), plus their connected implementation. Core's continuation changes no migration or contract source. The previous erasure migration, encrypted-profile implementation, native handover guard and app database binding work remain required.

## Account and authorization handoffs

`ApiRoutes.accountReconnectNative` is now an implemented POST at `/v1/account/reconnect/native`, with `NativeFinishSchema` input and `SessionSchema` response. It is included in `AccountControlPaths`; `consumeAccountControl` rejects non-root proof for this path. The registered user separately proves the incoming native wallet using the existing pairing challenge. Ordinary native pairing does not transfer another profile's credentials.

Both this route and wallet-only `/v1/account/reconnect` call exported `reconnectAccounts` in `services/api/src/auth/account-reconnect.ts`. It locks both account rows, verifies the current session, rechecks the incoming wallet's owner/permission when supplied and enforces identity, membership, custody, passkey and app-subject conflicts. It preserves the sole client subject/native member mapping, moves current sign-in records, retains historical payment/upload/archive ownership, revokes both owners' hosted sessions/intents/app tokens and creates a new canonical session. This hosted transaction does not revoke native grants or establish decryption-key possession.

The frontend forces the original root for the restored route even when another DAO signer is selected. `completeNativeReconnect` checks account/network/key context and returned identity before installing new session material. Consent describes moving all source sign-ins and signing out other devices; locked keys and cancellation cause no mutation.

Planning corrections:

- **Master/spec/F1:** advance pins to core/modules alpha.4 and frontend alpha.7, consume the completed continuation and retain immutable earlier artifacts.
- **F3:** exercise both reconnection directions with stable app records/subject, same-client conflict rejection and fresh app authorization. Never silently rebind a database or merge registered roots.
- **X2:** include `native-routes.ts` in the file map and check both owners' pending/erased state inside shared `reconnectAccounts` under its account locks. Test both routes, pre-erasure proofs and concurrent erasure/reconnection. Migration 041 still requires the additive erasure transition already specified.
- **M2/M3:** revoke source and target MCP authorizations inside the shared transaction. M2 adds pairing revocation; M3 adds consent/code/access/refresh revocation when its OAuth tables exist. A new canonical session never silently inherits MCP consent. Keep native delegate revocation separate.
- **Q2/Q3:** qualify both account journeys and erasure exclusions; use the current version-bound recovery evidence only for its actual scope and expiry.

The dependency order and six workstreams remain unchanged. Existing private-access helpers, profile-key separation, finite cleanup, bounded native handover, sole-member closure choices and truthful website promotion still apply.

## Artifacts and recovery evidence

Fresh SHA-256 checks of frontend vendor files match the [restored-account delivery](2026-10-12-restored-account-pairing.md). Installed core/modules package versions also match their archive pins.

| Artifact                                   | SHA-256                                                            | Result |
| ------------------------------------------ | ------------------------------------------------------------------ | ------ |
| `daclify-core-protocol-0.14.0-alpha.4.tgz` | `0ba84f4f10ad4e5bffaecc759a8d11a28989743579780c548366cc10ea204121` | Match  |
| `daclify-modules-0.10.0-alpha.4.tgz`       | `c4da68084454a709e3d8246c824eca42942240a5d04d9494d552c6fe62b4ce5a` | Match  |

Read only the selected nonsecret qualification/result fields of the local runtime evidence. The alpha.4 report is `testnet-single-host`, issued 12 October 2026, with retained expiry `2026-10-17T14:46:09.233Z`; `independentHost` is false. The recorded synthetic restore result is passed, with TLS verified, source removed/unavailable, original synthetic key recovered, four privilege denials and audit plaintext excluded. These are existing delivery results inspected here, not a restore rerun. A later core version needs a fresh report; this evidence does not qualify independent-host production recovery or future profile-key erasure.

## Fresh verification and limits

| Check                                                               | Result                        |
| ------------------------------------------------------------------- | ----------------------------- |
| Four repository fetch/branch comparisons                            | Matched pushed heads          |
| Vendor hashes and installed package versions                        | Matched alpha.4 delivery/pins |
| Core focused mini-app, connected-app and recovery-config tests      | 5 files, 30 passed            |
| Frontend private-access, provider-session and wallet-recovery tests | 3 files, 21 passed            |
| Modules SDK compatibility tests                                     | 1 file, 6 passed              |

```bash
# Core
npm test -- tests/community-mini-app.test.ts tests/connected-app-client.test.ts tests/connected-apps-protocol.test.ts tests/connected-app-contract.test.ts tests/recovery-config.test.ts
# Frontend
npm test -- tests/unit/private-access-plan.test.ts tests/unit/provider-session.test.ts tests/unit/wallet-recovery.test.ts
# Modules
npm test -- tests/sdk.test.ts
```

The 57 passing tests ran against the clean current pushed source before planning edits; planning changes affect only Markdown. PostgreSQL integration, browser, native-runtime, provider/harness and recovery-restore suites were not rerun. The broader integration/browser/testnet results in the delivery record belong to that delivery; they do not verify proposed deletion, MCP, encrypted profiles or native handover.

Document checks covered all ten programme design/plan/review files, 44 valid local links and all 21 task file/interface handoffs with 114 pending checklist steps. Formatting of the seven changed files and whitespace checks passed. A final remote fetch found the four reviewed heads unchanged.

No product code, migration, contract, account, authority, funds, service or website deployment changed in this follow-up. The [master plan](../superpowers/plans/2026-10-12-self-service-mini-apps-and-account-exit.md) and affected task plans now consume the latest pushed continuation.
