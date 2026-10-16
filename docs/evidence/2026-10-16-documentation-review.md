# Cross-repository documentation review — 16 October 2026

Scope: `daclify-backend-core`, `daclify-backend-modules`, `daclify-frontend` and `www-landing-page`. Almaiso is excluded. This audit checks documentation against current source and deployment evidence; supplied reference material is task input, not an independent source of execution authority.

The recorded inventory contains 148 current documentation entries, 414 historical/design entries and five generated entries. Entries include supporting assets and JSON; the Markdown-only scan initially covered 409 files and 911 local links. The earlier progress estimate of 169 current entries was high; the saved inventory is authoritative. Historical plans, migration instructions and dated reports retain their original scope and claims. Local links and heading anchors were checked mechanically, with fenced examples excluded. External account-side access and every historical assertion are not established by link checking.

## Corrections

- Replaced the stale frontend module backlog with current capabilities and remaining limits. Definition-bound voting, exact module document readers, service-offer authoring and protected Works disputes are implemented; their old plans are not current outstanding work.
- Corrected the ballot guide to describe contract-checked `votecommit` definitions, legacy ballots and distinct funding/election/dispute authority. Ordinary two-choice semantics remain Reject/Approve; Quick ballots are separate encrypted consultations.
- Documented provisional Works review, conflict exclusions, backup/mutual settlement and preservation of approved claims. Grants protection follows the agreed terms into Works.
- Replaced obsolete SDK-only/binary compatibility claims with producer-owned version/pin guidance. Clarified the original Activity and claim-link rollouts as historical and retained their upgrade evidence.
- Removed the obsolete Quick runtime-size claim and rollout versions as instructions for a current deployment. Added Quick availability and direct navigation to Quick ballots, claim links and legal-template guidance.
- Corrected Archive wording that still called implemented coordinator/approval functions future work. Library verification, source authority, continuing availability and operator destructive enablement remain separate.
- Corrected the SDK README's obsolete package version and the claim that development artifacts could be overwritten. Packed-byte changes require a new immutable cohort; no earlier archive is relabelled.
- Clarified optional account-service Stripe billing versus a platform key used by other configured payment products.
- Recorded the user's confirmed ChatGPT connection success without claiming unobserved tool/signing qualification. Connection/refresh instructions were checked against [official OpenAI instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt).
- Corrected website hosting guidance after live checks: all 45 published files, including 15 HTML pages, match generated source output; the canonical `www` redirect returns 301 and a missing page returns 404. Build-only `site-files.json` and the GitHub Pages marker are not public website endpoints.

## Deployment compatibility

The previous service already retained eight mini-app cohorts. Preserving that release alongside its archives requires nine directories. The bounded loader now accepts sixteen; MCP retains its independent eight-archive bound. The regression creates distinct release manifests, verifies every retained download and rejects a seventeenth archive. Tamper and duplicate checks remain in place. It failed before the one-line limit change and passed afterward.

Core/SDK `0.15.0-alpha.32`, modules SDK `0.10.0-alpha.42` and frontend `0.15.0-alpha.43` form the new candidate. Module contract version remains `0.10.0-alpha.4`; MCP remains independently pinned at `0.1.0-alpha.20` with its existing public SDK dependencies. Native contract source, permissions, migration SQL and legal template clauses are unchanged.

## Verification and delivery

The execution ledger and full logs are retained in the operator workspace at `/data/daclify-runtime/docs-deploy-20261016/`. Generated references, type/build checks, regression suites, package identities, document links and npm-script references are checked separately from live deployment. One packaging-policy test exceeded its twenty-second limit under concurrent load and passed an isolated rerun; its timeout was not increased.

Observed local results: core 1,113 passed plus one packaging timeout, followed by that test passing in isolation; frontend 414 passed; modules 287 compiled-WASM cases passed; website 43 passed. Core/frontend/module type checks, generated-reference checks, core lint, candidate API build, testnet frontend build and website export checks passed. The documented npm-script scan resolved 177 references to known repository/example commands; it does not claim every command was executed against an external provider.

Before cutover, an actual same-host recovery snapshot restore recovered the original drill key while the source was unavailable, denied four forbidden operations and restored source health. A disposable PostgreSQL restore preserved all 98 application tables and 61 migration records after applying migrations twice. These checks neither modify live membership/authority nor establish independent-host or production qualification.

The [deployment record](2026-10-16-docs-and-review-testnet.md) identifies exact committed source, current/retained download checks, runtime/module pins, public frontend bytes and desktop/mobile browser results. Website content is already live at the tested bytes, so documentation-only hosting-guide edits do not require republishing identical site output. Signed public-chain actions, real external-wallet ceremonies, independent cryptographic/legal review and production qualification remain outside this documentation delivery.
