# Account exit screens and wallet continuation

Scope: X3, reviewed inline by the implementing author. This is source/fixture evidence, not independent review or production qualification. Testnet still runs the previously deployed core 7/module SDK 14 cohort; account erasure remains disabled there.

The portal reviews full-context memberships, permits leaving one or all DAOs, offers explicit sole-member closure, and starts hosted erasure separately. Original Root kits, linked native wallets and linked EVM wallets can sign the narrowly permitted native exit after hosted login disappears. A status capability cannot sign. Private administrators prepare grants and obtain the selected successor's own acceptance before erasure. Downloaded reports distinguish native lifecycle, hosted services, current profiles, key envelopes, backup expiry and retained evidence.

Signed settlement packets persist before submission. Restart reads receipts only; deliberate retry uses the same transaction identity. A packet imported from a different exit operation cannot be retried through the current report. Restore exclusions reconstruct cached native references before purging operational ownership. Later closure needs a current explicit signature and its own hosted reconciliation job.

## Verification

- Core: 974 unit checks in 158 files; 13 actual Spring exit checks; 10 encrypted-profile/reader checks in two native files; final 22 PostgreSQL erasure checks. Typecheck, lint and generated documentation checks passed.
- Modules: all 215 checks in 33 files passed with the exact core 9 fixture. The initial 59 failures correctly rejected a stale disposable core 8 fixture; no mismatch guard was weakened.
- Frontend: 334 unit checks in 56 files; final affected 15 checks in four files; Vue/TypeScript checks and production build passed. The existing large Docs bundle warning remains.
- Real owned Spring/PostgreSQL browser flow deletes hosted login, removes current native profiles, leaves two DAOs with the original key, waits for irreversible receipts, and reopens its read-only report on desktop/mobile. Card attestation is synthetic. Private two-context decryption/preparation/acceptance browser checks use HTTP fixtures; native authorization constraints are tested separately.
- Earlier browser regressions exposed stale public-profile wording and an incomplete SIWE challenge fixture. Updated producer-built challenge/copy checks passed eight desktop/mobile cases. One later desktop run encountered `CHAIN_UNAVAILABLE`; the same mobile journey passed. The unchanged-source repeat is recorded in the execution ledger, without treating the transient failure as a passing run.

## Immutable candidates

Core `0.15.0-alpha.9`: `b5976c605c2909509fbbe5fb336a3d389405d6317cfa51aecb0ac3bd9b5d6e43`.

Modules SDK `0.10.0-alpha.16`: `5c784764b1a27caf457a7e862f74ba7074d72af584cef07333d4ba9595664097`. Native modules remain `0.10.0-alpha.3`.

Runtime WASM: 991013 bytes, `64a721bb4718a4affa10bfabc8e2febfa902e1258c2dabbaf5ab19388f615372`, compiled with pinned CDT 4.1.1 `-O=s`. Growth over core 8 is 6975 bytes; no new stored fields or secondary indexes. Native CPU samples are local fixture observations; explicit EVM CPU qualification remains Q2.

Frontend candidate `0.15.0-alpha.12` preserves the latest pushed Works/Payroll changes through `720d4bf` and consumes exact core 9/module 16 archives. Migration 044 increases the bounded report storage allowance to 256 KiB; published migration 043 is unchanged.

Independent-app notices are X4. Hosted MCP, discovery, promotion, independent-host/provider/retention qualification and final source-bound rollout remain subsequent tasks. No live user was erased, no production rollout was performed, and no authority or asset ownership was changed by X3.
