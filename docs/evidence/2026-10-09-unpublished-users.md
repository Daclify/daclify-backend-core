# Users directory regression: unpublished members

Development version: **0.9.0-alpha.5**. No contract, account permission, database schema or provider configuration changed.

## Cause and correction

The original Users page queried only `/v1/people`, which returns published on-chain profiles. Read-only inspection found three testnet DAO membership records but zero published profiles. Signed-out visitors consequently saw an empty directory even though those member records were public.

The additive `/v1/people/members` endpoint reads at most 50 public members from one DAO per request, with a validated DAO/member cursor. A populated page needs three bounded table reads: two DAO rows, up to 50 members and up to 50 DAO-indexed profiles. Empty DAO pages do not read profiles. Short DAO RPC pages preserve their next cursor. The response includes only member ID, native account, activity, DAO reference and optional validated public profile; signing/encryption keys, private service identities and login pairings are excluded. The published-profile endpoint remains compatible.

Users displays fallback cards before profile publication. A public native account is listed once and prefers an available published profile. Unpaired internal members remain separate DAO/member records, without inference from private service identities. A signed-in user's own card remains first. Approved independent-operator connections scope the directory to their selected DAO. Empty-directory, loading and search-filter states have distinct messages.

## Verification actually run

- Core lint, TypeScript, generated-documentation check, build and full suite: **640 tests passed** across 108 files, including **13 people tests**.
- Modules verification: lint, TypeScript, generated-documentation check and **153 tests passed**.
- Frontend verification/build: lint, Vue/TypeScript and **160 tests passed**. Final template/type check and build passed after the browser regression additions.
- Desktop Chrome and Pixel 7 browser checks: **12 passed** for unpublished users, cross-DAO pagination/profile enrichment, native-account deduplication, common DAO/profile views, self-only editing, Help and image fallback. Accessibility scans passed.
- Both vendored alpha.5 generated documentation bundles match their producer files byte for byte.
- Actual local testnet browser check: signed-out discovery shows `3boidanimus3`, then two unpaired internal member records through Load more users; the native member's public detail opens without edit controls. No browser exceptions or writes occurred.

The new API tests failed first because the directory method/route was absent. The browser regression failed first because unpublished fallback cards were absent. The first browser run after installing the new SDK still used Vite's cached old dependency; restarting the local dev server resolved that setup issue, and the final complete run passes.

## Limits

This is a directory of public chain memberships on the connected runtime, not every private service sign-in account. Pagination can show additional members only after Load more users. Profile information is optional and comes from a DAO membership; the page does not merge private credentials or prove that distinct internal members represent different humans. Live signing, payments and provider chat were not exercised by this read-only fix.
