# Daclify documentation audit and delivery

Reviewed 14 October 2026 for community members, DAO administrators, mini-app builders and integrators. The supplied documentation-engineer brief authorized audit, safe corrections and verification; existing workspace instructions authorize development commits and dev integration. Review and implementation stayed inline because delegation is not authorized.

## Coverage and findings

The baseline inventory covers **361 tracked Markdown files**: core 237, modules 11, frontend 89 and standalone website 24. Current entry pages, account/recovery guides, canonical handbook topics, mini-app integration/database/MCP guides, generated reference and operator instructions were checked against their source owners and the live testnet capability response. Historical plans, evidence, upgrade guides and changelogs retain their dated meaning; inventory/link coverage does not imply a fresh runtime qualification of every historical claim.

| Priority | Problem | Correction |
| --- | --- | --- |
| High | Builders encountered obsolete package hashes and statements that available app APIs/downloads were pending | Describe the implemented registration/module/signer flow and trusted API-selected immutable manifest/starter; keep hosting/database ownership and login/receipt verification explicit |
| High | Implemented account exit was confused with service enablement; recovery was described as off | State that account exit is disabled on shared testnet; distinguish disclosed same-VM assisted recovery from independent production and wallet/passkey qualification |
| High | Members/admins had no concise first journey | Add canonical `start-here`, first in Getting started, with account, admission, approvals, roles, private access and app setup prerequisites |
| Medium | README/index versions and handbook navigation had drifted | Point to producer manifests and a dated current-status checkpoint; describe seven actual guide groups and Mini Apps routes |
| Medium | A recovery paragraph appeared twice | Preserve one member/service reconstruction explanation and replace the duplicate with unique production restore/reconciliation guidance |
| Medium | Google browser login was still called unimplemented | Verify the browser component and configuration route; explain configuration and actual-provider verification separately |
| Medium | Browser navigation/title expectations had drifted | Keep exact sidebar order, current account title and permission/version checks; add starting-guide discovery/reading/accessibility coverage |

## Changes and source ownership

- `docs/guides/topics.json` remains authoritative for handbook prose; core reference/help is regenerated. Stable existing topic IDs remain available. Frontend catalog adds the new topic to its existing collection.
- `docs/current-status.md` distinguishes implementation, enabled shared-testnet capabilities and unfinished qualification. README/index pages across the active repositories link to canonical guides rather than copying current versions repeatedly.
- `docs/connected-community-apps.md` documents the current Mini Apps setup, numeric ID/exact HTTPS callback, matching download verification, persistent database binding and separate member-login/native-receipt checks. The SDK sample uses existing public producer interfaces.
- Recovery/operator guides require fresh version-bound restore/TLS evidence and a configured synthetic key roundtrip before dev API restart. Earlier qualification expiry is preserved.
- Website README links to canonical dev sources; marketing translations and the public website are unchanged. No historical document is deleted, no documentation framework is added, and no contract, authority, database migration or application business rule changes.

The documentation cohort uses core/SDK `0.15.0-alpha.22`, modules `0.10.0-alpha.30`, frontend `0.15.0-alpha.33` and MCP `0.1.0-alpha.13`. New public archives are necessary because handbook content is shipped inside the SDK. Exact module compatibility advances by one reviewed core version; future versions remain refused. Native module versions and WASM/ABI pins remain unchanged.

## Validation

Runtime logs and machine-readable inventory, link, qualification and delivery records are in `/data/daclify-runtime/docs-review-20261014`; they contain public summaries, not secret configuration.

- Core `npm run verify`:169files /1016tests passed, including generated consistency, lint/typecheck and publication-refusal gates. Modules:33files /215tests passed. Frontend:62files /364tests passed, plus the five-test preparation check. Nested MCP:7files /12tests passed and typecheck passed. Core/module/frontend formatting and builds passed; website formatting passed.
- The new starting-guide test failed before the consumer SDK was refreshed, establishing the missing-guide regression. The first broad browser run passed60 and exposed four failures from two obsolete expectations across desktop/mobile; the expectations were corrected without weakening permission/version assertions.
- Local links are parsed with the installed Markdown parser, including images and excluding code fences, with an assert-based parser self-check. Baseline800 and updated833 file references resolve. Five heading links in changed Markdown resolve using checked GitHub-style slugs, and eight linked app-handbook destinations match existing canonical topic IDs. Five selected current public/primary-documentation URLs return HTTP200. This does not qualify every external/authenticated URL or every historical heading anchor.
- The connected-app browser example is typechecked as an ES module against the installed pinned public SDKs. External variables are explicitly declared as registration/callback/outbox inputs for this check; real provider login and native delivery are separate qualifications.
- Fresh disposable OpenBao 2.7.1 TLS/Raft source-loss restore recovers the original synthetic key, denies four unauthorized operations and excludes plaintext from audit. The candidate refuses the older version report and passes a configured live TLS synthetic wrap/unwrap. Single-host scope, no qualified wallet/passkey and original expiry **17 October 2026 at 14:46:09.233 UTC** are preserved. Live policies and existing recovery keys are not changed.

The final locked bootstrap succeeds without publishing a package or deploying chain code. The corrected browser suite passes **64 checks** on desktop/mobile, followed by **four checks** against the final regenerated/consumed package. Final core/module generated checks and core/frontend formatting pass. The snippet typecheck succeeds; its first scratch check used a CommonJS extension and was corrected to an explicit ES module, matching the documented browser integration.

Final immutable mini-app bundle: `490fb7f84e488e286a59a23c752c44c073f2dd126defb388076218a97924c78d`, manifest SHA-256 `486c0262a2d012dbfde9734d82f25816cf5ad9300eefb5a2ccc9bae0f14da778`.

Final immutable MCP bundle: `925fd4e8d604f81ca4cd6dcd0a1146d3157da006ea01cc3204720cb3777a1ba7`, manifest SHA-256 `1730f27baaa07a0335171179b730b8079e9ed3e634b467bef4c9cf9e46e8c711`.

## Development delivery

The tested documentation change was fast-forwarded and pushed to the existing repository branches. The website commit contains README source notes only.

| Repository | Branch | Documentation/source commit |
| --- | --- | --- |
| daclify-backend-core | `dev` | `5a39a34d556fda4588a35ead0d23f2ef5c7953e7` |
| daclify-backend-modules | `dev` | `dbff869939b5ddd7e728b672af10b8e8f23e7652` |
| daclify-frontend | `dev` | `efa008ce87adacd8c990d9d85d031a564d22d7bf` |
| www-landing-page | `main` | `afa2e41f1c3ed34605ee8991f1ecc4546cc1dea2` |

The API/frontend source snapshots are `/data/daclify-runtime/releases/20261014-documentation-audit/daclify-backend-core` and `daclify-frontend`. The dev service was rebuilt from these snapshots and is healthy. The public API reports core 22, modules 30 and MCP 13 on the correct Telos testnet chain/RPC. All three current mini-app archives and all three current MCP archives match manifest hashes and lengths. The current mini-app manifest and four earlier manifests return HTTP200 with unchanged exact bytes; four previous MCP download cohorts remain available. The public frontend index hash matches the Caddy publication.

Actual live browser checks at 1440px and 393px discover [Start here](https://testnet.app.daclify.com/docs/start-here) from Getting started, read the updated [connected-app guide](https://testnet.app.daclify.com/docs/connected-apps), confirm account exit is disclosed as disabled and verify the corrected Google configuration wording. Each starting-guide view has zero Axe violations, no horizontal overflow and no page errors; desktop/mobile screenshots were captured and visually inspected. The installed guide reports core 22 matching the connected API. Read-only anonymous handbook checks do not qualify real member signing/provider flows.

Earlier download cohorts and the previous working API/recovery configuration are retained. The fresh version-bound development recovery report remains valid only until its original17 October expiry. No contract deployment, authority change, asset movement, public website deployment or mainnet release occurred.

A follow-up documentation-only commit records these actual delivery results and completes the plan. The deployed source remains the tested source commit above; the follow-up does not change SDK bytes or runtime behavior.

## Limits

This task does not requalify native workflows, PostgreSQL upgrades, every independent app host, full provider/wallet/passkey clients, production recovery, mainnet or hosted GitHub CI. C++ and migrations are unchanged. The website's English/Spanish/Polish marketing translations were inventoried and their current roadmap distinctions preserved; no translation rewrite or website deployment occurred. All external/private links were inventoried, but only selected current public URLs were fetched. Review used member/admin/builder, security and operator perspectives inline, not an independent agent. Garden Care and the six legacy repositories were excluded.
