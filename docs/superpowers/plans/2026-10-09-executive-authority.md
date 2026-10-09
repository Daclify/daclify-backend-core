# Executive Authority Implementation Plan

> For agentic workers: execute inline with superpowers:executing-plans. No delegation is authorized.

**Goal:** Implement paired native executive control with safe bootstrap, elections and inactivity.

**Architecture:** Add bounded executive state and voter exclusions beside existing member rows. Synchronize a dedicated native govern permission; consume explicit Decide executive results and preserve DAO isolation. Reuse canonical ABI-generated schemas throughout API and Vue.

**Tech Stack:** Antelope C++, VERT, Spring native Docker fixtures, strict TypeScript, Zod, Vue.

## Task 1 — Core state and lifecycle
Files: contracts/common/executives.hpp, contracts/common/ram_families.hpp, contracts/common/ram_table.hpp, contracts/runtime/runtime.cpp, tests/executives.test.ts.
- [x] Add failing compiled-contract tests. Assert ordinary pairing cannot appoint, last paired controller cannot unlink, and replacement preserves old state on failure.
- [x] Implement separate executive policy, executive rows, voter exclusions and bootstrap state. Preserve existing serialized member/DAO rows.
- [x] Integrate linknative, unlinknat, setactive and agent recovery/revocation with controller guards and credential revisions.
- [x] Verify timeout boundaries, all-inactive reactivation, holdover and cross-DAO isolation.

```typescript
await expect(act('unlinknat', {}, 1)).rejects.toThrow('LAST_NATIVE_EXECUTIVE');
expect(row(core, 'members', 1n, 1n)).toMatchObject({ native_account: 'alice' });
```

## Task 2 — Native authority and scoped service
Files: tools/native/network.ts, tests/native/executives.test.ts, sdk/executives.ts, sdk/permissions.ts, services/api/src/native-chain.ts.
- [x] Start a new owned loopback native fixture, leaving existing containers unchanged.
- [x] Add failing tests for initial owner consent, first paired executive handover, module owner inheritance, native quorum replacement and service-key root rejection.
- [x] Implement actual updateauth actions plus bounded authority plans and restricted creation-service authorization.
- [x] Run native tests; require real system authority evaluation rather than an emulator permission substitute.

```typescript
await expect(sendOwnerChangeWithServiceKey()).rejects.toThrow();
expect(await nativePermission('daclifycore', 'govern')).toMatchObject({ threshold: 1 });
```

## Task 3 — Decide integration and voting eligibility
Files: contracts/decide/decide.cpp, protocol/index.ts, tests/elections.test.ts.
- [x] Add failing tests for excluded voters, frozen denominators and representative elections retaining no executive powers.
- [x] Bind executive roster callbacks to the pinned module/grant and explicit election title. Schedule term-start activation and protect the final native controller.
- [x] Run compiled module contracts and election regressions.

## Task 4 — Typed API and Vue flows
Files: protocol/dao.ts, services/api/src/native-chain.ts, services/api/src/auth/native-routes.ts, frontend/src/components/ExecutivePanel.vue, frontend/src/components/GovernancePanel.vue, frontend/src/components/ActionSigner.vue, frontend/src/components/NativeWalletPanel.vue, relevant API/UI tests.
- [x] Generate producer ABI/SDK types, then update the existing typed governance endpoint with executive policy/roster/voter exclusions.
- [x] Guard login credential removal while authoritative governed bindings still exist.
- [x] Add accessible executive status, heartbeat, refresh, appointment and replacement flows; expose unsigned bootstrap owner transactions.
- [x] Refresh pinned development packages and verify TypeScript/Vue checks and regression tests.

## Task 5 — Documentation, review and integration
Files: docs/guides/topics.json, docs/operations/upgrade-0.9.md, README.md in affected repos, docs/evidence/2026-10-09-executive-authority.md.
- [x] Generate docs and references; explain bootstrap, inactivity, holdover, native accounts, last-controller guards and independent hosting.
- [x] Run full affected suites, native tests, builds and generated-doc checks; record actual results and unverified live integrations.
- [x] Review final diffs for root-authority bypasses and preserve audit artifacts/user environment files.
- [x] Commit feature branches and fast-forward/integrate to dev; push dev only. Do not deploy contracts or change live native permissions.

Delivery note: all three origin/dev branches contain the feature commits. Core and modules local dev checkouts were advanced and their public compiled artifacts/dependencies refreshed. The original frontend dev checkout retains concurrent, uncommitted module-card work; Git refused its fast-forward because ModulesPanel.vue overlaps. That work was neither stashed nor overwritten. Continue review in the isolated frontend feature worktree or integrate remote dev after the concurrent work is committed.
