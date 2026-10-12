# Scoped mini-app cleanup

X4 source qualification, reviewed inline by the implementing author. Production, live independent operators and independent-host recovery remain Q2/Q3 qualifications. Testnet still runs the earlier core 7/module SDK 14 checkpoint, with account erasure disabled.

Configuration version 2 commits an approved HTTPS cleanup endpoint; legacy version 1 parsing and hashes stay unchanged. Notices use genuine ES256 signatures, a distinct cleanup audience/type, full app binding and one subject/member. Signatures last at most ten minutes, normally five. Retries preserve the event identity. Pinned DNS/TLS delivery rejects private/reserved/mixed addresses and redirects, limits responses to 16 KiB, and caps attempts at twelve within the 30-day report window.

Verified app login now records the native member and configuration hash. Those finite identity pointers are frozen before hosted cleanup. A member cannot silently change, and an unpublished later draft cannot select the endpoint. Unknown legacy mappings remain unavailable. Each worker leases one notice so its bounded network work fits the lease; available notices progress immediately. Leave notices wait for confirmed native departure; hosted erasure does not wait for an unavailable chain or app. Acknowledged/terminal notice identity pointers are cleared, and expired pointers are cleaned independently of pending hosted work.

SQLite and PostgreSQL clear the exact login subject and preserve once-only completion/source/receipt evidence. The acknowledgment explicitly reports `DAO_COMPLETION_EVIDENCE` retention; identifiable free text is not called anonymous. A separate owner-only journal applies before restored access. It preserves immutable event identity across refreshed signatures, survives an interrupted unpublished journal write, and expires through bounded maintenance after the configured controlled backup horizon. PostgreSQL's other tenant rows remain unchanged in the actual restore test. Multi-host deployments must qualify a shared exclusion volume and independent backups.

## Checks

- Core broad rerun: **979 checks / 160 files passed**. Initial broad run passed 975 and failed two checks: a production startup fixture omitted the new retention setting; the requirement checker misread quoted route globs as comments. The updated fixture and TypeScript AST checker passed **17 focused checks** before the full green rerun. The AST regression also refuses test-like strings and preserves the empty-suite guard. No extra dependency was added.
- Real PostgreSQL cleanup/restore/erasure/app authorization: **50 checks / four files passed**. Delivery uses fixture HTTPS transport with genuine issuer signatures; this is not live-provider qualification. Cases include unknown delivery/re-signing, bounded leases, native departure waiting, legacy mappings, stale registration, a newer unpublished draft, wrong acknowledgment, private DNS, expiry and frozen actor changes.
- Modules: **215 checks / 33 files passed**; core 10 compatibility initially failed, then the exact range accepts 10 and refuses unknown 11. Native modules remain unchanged.
- Frontend: **334 checks / 56 files passed**, Vue typecheck and production build passed. **Ten desktop/mobile connected-app browser checks passed**, including the cleanup field with no signing on input changes. The existing large Docs chunk warning remains.
- The starter installs, configures and builds in a clean directory and serves its actual local TLS readiness endpoint. Its production temporary-storage guard still rejects ephemeral storage after supplying valid cleanup settings.

The fresh owned native desktop/mobile app-registration and account-exit browser result is recorded in the execution ledger after completion. Its card attestation is synthetic. No live user was erased or DAO closed by this task.

## Immutable artifacts and storage

Core `0.15.0-alpha.10`: `5a94f9bc6ecd729638fd05852bea2eda1f0bdda1d1d781d69f1cdefb473147fe`.

Modules SDK `0.10.0-alpha.17`: `9175dfd2a940f00442f5bda2358d739c9f790da1e279d90ce86752e23915030a`.

Frontend candidate: `0.15.0-alpha.13`, consuming those exact archives.

Starter release: `b564364e5f86d40a18b3f42e39b974b3ddf5e71ee7f0cabbaa128167dc53d0bb`; manifest: `274087f4ca72946bd3b669db643737c89821ac7ffb5346e1d2328d0e59eb330c`.

Migration 045: `3a6d66bce5c1b4924bc3e5d53954b8109d9ed8fa246e8de79d3c45ab358fb43f`. Nullable member/configuration anchors preserve legacy rows without inventing a mapping; a trigger preserves established member identity. The leased-operation and expiry indexes serve the actual bounded queries. JSON, hashes, acknowledgment codes and attempt counts have explicit limits. Finite notice rows cascade with the exit report; personal pointers are removed earlier on acknowledgment/expiry.

No C++ source, native stored field or secondary index changed in X4. The reviewed core 9 runtime WASM and native module alpha.3 binaries are reused unchanged. Frozen earlier SDK/starter artifacts are preserved. Explanatory setup, retention and recovery responsibilities are in the database contract, account-erasure guide and standalone starter README; generated canonical help remains accurate and its consistency check passed.
