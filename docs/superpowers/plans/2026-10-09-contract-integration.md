# Contract integration and permission documentation

> Execute inline using the existing test and verification workflow; no delegation or live authority changes.

**Goal:** Prove first-party modules still cooperate after native executive handover, with real Antelope permissions, and explain the model in searchable app documentation.

**Architecture:** Reuse the disposable native-chain harness and signed research DAO helper. Create two tenants before handover, transfer the runtime and all module owners in one transaction, then run successful and rejected flows against real compiled WASM. Publish a reviewed static SVG through the core public package and render it in the matching documentation topic; no remote code or diagram dependency.

**Tech stack:** Antelope C++, Spring native fixture, WharfKit, Vitest, Vue, Playwright and Axe.

- [x] Add a separate loopback-only fixture name and extend the existing research helper to accept it, preserving chain-ID checks.
- [x] Add native tests in `tests/native/module-integration.test.ts`: all module owner/active permissions, removed bootstrap keys, service separation, direct-call failures, two-tenant isolation, Decide → Grants → Works → Runtime, Payroll obligations, endorsement admission, recipient token rows and once-only payouts.
- [x] Add module usage regression cases where the combined flow exposes missing grants, disabled modules or changed policy. Use generated action encoders and state readers.
- [x] Add `docs/guides/contract-permissions.md`, the reviewed SVG and the `contract-permissions` topic. Show shared versus independent control, bootstrap versus handed-over authority, and the exact owner/active/govern/execctx/service examples.
- [x] Export the SVG with the public SDK, consume it in `src/views/Docs.vue`, and verify loaded diagrams, readable text and accessibility on desktop and mobile.
- [x] Regenerate producer docs and pinned development packages; run relevant VERT/unit/native suites, strict types, lint, documentation checks and frontend build.
- [x] Review the final diff and record actual results and limitations in `docs/evidence/2026-10-09-contract-integration.md`.
- [x] Integrate and push `dev` without staging concurrent work.

Native fixture tests qualify local contract interaction, not live Telos deployment, production resource pricing or Stripe/IPFS availability. Tests must not reuse the shared research container or any real environment file.
