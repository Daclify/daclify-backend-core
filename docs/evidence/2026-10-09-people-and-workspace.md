# People, workspace, Help and names execution evidence

Development version: **0.9.0-alpha.4** across core, modules and frontend. Contract interface 1 remains unchanged; the names ABI adds seller management actions. All work started from fetched `origin/dev` in isolated sibling worktrees. No live testnet/mainnet contract or account authority was changed.

## Delivered behavior

- Sidebar Daclify DAO resolves the linked governing DAO and opens its ordinary workspace, matching the Hub card. Its Platform controls tab retains administrator/signer checks; ordinary DAOs cannot acquire platform powers through navigation.
- Users lists published public on-chain profiles. Your own card comes first, including an unpublished self fallback. Public details are shared with DAO Members; self-only account editing retains recovery, login pairing and wallet controls. Profiles use the producer schema and compiled `setprofile` ABI. Avatar/background CIDs display public IPFS images with readable failure fallbacks. Private service accounts and login pairings are not a public directory.
- Members supports cards/list, search and activity filtering, with administrator/reviewer/executive/non-voting labels. Admission, credits, role changes and encryption grants preserve existing authorization.
- Module tools have illustrated cards and scrollable modal details with examples, steps, requirements, limitations and guide links. Escape/close restores focus to the invoking card.
- Help is a non-modal movable/resizable window with keyboard/reset/expand/minimize controls. Browser storage keeps the last 100 validated messages, separated by service, chain/runtime and account. Canonical dotted guide IDs are supported. Late requests cannot populate another account's transcript. Stored history is not sent as model context.
- Names supports suggestions, chain quotes, native TLOS purchase, individual seller management and unsigned DAO quorum/owner-review exports. New seller-authorized `editname`, `delname` and `delsuffix` preserve created accounts and sale receipts. Native creator selection uses the actual suffix and a dedicated `namesale` child linked only to `eosio::newaccount`.
- Third-party name card charges are blocked until seller merchant routing exists. Premium card charges are blocked so failed namespace/auction claims cannot leave a captured card payment. First-party basic card checkout remains configured separately. Native purchases put intent and transfer in one transaction and roll back on failed creation.

## Checks actually run

| Scope | Result |
| --- | --- |
| Core lint, TypeScript, generated documentation check, build | Passed |
| Core Vitest | **634 passed, 108 files** |
| Modules `npm run verify`, including lint/types/docs | Passed; **153 tests, 27 files** |
| Frontend `npm run verify` and production build | Passed; **160 tests, 33 files** |
| Playwright desktop Chrome and Pixel 7 emulation | **50 passed** across people/workspace, names manager, Help, module cards, catalogue navigation and permission documentation |
| Axe scans included in browser checks | Passed for public profiles, Users with Help, names manager, modules and permission documentation |
| CDT compilation | `names` and `eosstub` compiled with the pinned CDT 4.1.1/Spring 1.2.2 toolchain |
| Fresh owned native fixture | **4 passed** on `daclify-names-native`, loopback port 21288; fixture stopped after checks |

The native cases reject unauthorized listing, prove payment rollback without suffix creation permission, create a dotted native account using the dedicated child, verify the 5% split and no duplicate payout, reject seller transfers through the creation child, and require both native accounts for a two-account active quorum. They inspect unchanged root authority. The resource/system fixture enforces the native suffix rule, while Antelope itself enforces signatures and permission links. This is **not** full Telos system-contract auction/resource qualification.

Regression failures were observed before fixes: missing public-directory API, missing browser history implementation, a valid dotted guide ID rejected by history validation, dotted creation rejected with the original wrong creator, absent seller management actions, and third-party card checkout incorrectly reaching billing. Initial broad module checks failed because old compiled fixtures were absent from the new worktree; copying only public ABI/WASM fixtures resolved that setup issue. Browser checks identified heading order, widget visual/focus problems and incorrect test locators; the final recorded run passes.

## Deployment and operational limits

The current live testnet runtime/names deployment is older than this SDK. Names broadcasts check the reviewed names code hash and refuse mismatches. A separately reviewed names upgrade and native owner/quorum approval of `namesale` are required before live selling/creation. The app never automatically rewrites owner/active authority. Shared DAO administrators need a separately controlled native seller account; this UI does not automatically rotate that account with shared DAO elections. Proceeds go to the native seller account.

Native auctions, actual Telos RAM/CPU/NET purchase economics, Stripe live/test charges, Pinata image upload, Anchor approval on the live network and OpenRouter/Telegram provider conversations were not exercised here. Avatars are configured using public IPFS CIDs; this change does not add a profile file-upload service. Telegram docs enablement and all provider credentials remain unchanged.

Reviewed against the actual [Telos native account creation source](https://github.com/telosnetwork/telos.contracts/blob/master/contracts/eosio.system/src/eosio.system.cpp) and [CDT native name suffix implementation](https://github.com/AntelopeIO/cdt/blob/main/libraries/eosiolib/core/eosio/name.hpp). The final diff retains repository boundaries, producer-owned schemas, checked integer pricing, private identity separation and atomic native payment behavior.
