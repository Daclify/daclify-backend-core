# Daclify documentation audit and correction

**Goal:** Improve the accuracy and discoverability of existing member/admin/builder documentation, then verify and deliver it to the authorized dev environment.

**Architecture:** Existing canonical JSON topics generate the public SDK handbook/reference; the frontend groups those stable topics. Repository Markdown links to that source and source-owned operator/reference guides.

**Tech stack:** TypeScript generators, existing Vue 3 handbook, Markdown, pinned public npm archives and Playwright/Vitest. No new tooling dependency.

**Request:** Apply the supplied Documentation Engineer brief, prioritizing community members, DAO administrators, mini-app builders and integrators. Follow workspace instructions inline; no delegation.

**Design:** Preserve existing documentation locations, stable handbook topic IDs, generated references, historical records and public SDK boundaries. Correct current availability and navigation using source/live evidence. Add the task-first member/admin guide as canonical handbook topic `start-here` and one current-status reference; point repository entry pages at them. Builder connection instructions use the trusted API's matching immutable bundle rather than old manually copied archive/version values. No application business behavior, native contract/authority, production rollout or documentation framework changes.

**Baseline:** Core237, modules11, frontend89, website24 tracked Markdown documents inventoried; 800 local file/image links resolve. Core/module/frontend indexes and README headers show old versions. The handbook/mini-app guide says deployed connected apps, bundles, directory, MCP and profiles remain planned. Account exit is implemented but disabled on the current shared testnet. Recovery documentation incorrectly says the configured testnet service is off. The frontend handbook now has seven groups and includes Mini apps & builders; several guides still describe six groups and omit Mini Apps routes.

## File map

Core owns `docs/guides/topics.json`, generated references/help, `docs/current-status.md`, builder/recovery guides and package versions. Modules own SDK compatibility and generated module help. Frontend owns handbook catalog/discovery tests and consumed archives. Website README only links to canonical current sources. Runtime audit/qualification/delivery evidence stays outside packaged sources.

## Tasks

- [x] Audit current guides from member/admin/builder, security and operator perspectives; separate source implementation, live capability and release qualification.
- [x] Add concise task-first guidance and current status; repair current README/index, builder and recovery instructions without rewriting dated evidence.
- [x] Correct authoritative handbook topics and regenerate producer-owned help/reference; preserve stable topics and avoid duplicate schema/API documentation.
- [x] Produce a new immutable development documentation/SDK cohort; refresh consumer archives, locks and exact compatibility tests. C++ and schema migrations are unchanged.
- [x] Validate guide/example fields and commands against source; local/heading/navigation links, generated consistency, meaningful handbook/search tests, formatting/build and manual source review.
- [x] Verify version-bound development recovery configuration before any dev API restart; retain prior downloads and qualification expiry.
- [ ] Integrate/push authorized development changes, verify the live dev handbook and record results/limits. Website source notes may be committed; no public website or mainnet deployment is authorized.

## Evidence and scope

Audit artifacts: `/data/daclify-runtime/docs-review-20261014`. Existing release evidence records remain historical. The prior14October code fixes pass core1016/modules215/frontend364/MCP12/integration68/browser40; this documentation task will record its own checks separately. User priority confirmed in chat. Preserve the six legacy repositories and Garden Care.

Ruling: author Start here only in the existing producer guide source, expose it in the existing Getting started collection, and link to it from indexes. A second Markdown copy would recreate drift. No new documentation framework or application authority behavior is needed.
