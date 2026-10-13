# Unified approvals implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline; delegation is unauthorized. The user requested continuous implementation and reviews the completed change.

**Goal:** Reuse one chosen wallet through one account setup journey for existing and new DAO memberships.

**Architecture:** Keep account pairing and DAO bindings authoritative; reuse their current APIs and signed instructions. Account owns the shared setup screen, and existing ActionSigner callers link to it rather than implementing setup separately.

**Tech stack:** Existing Vue, strict TypeScript, Pinia, Zod, WharfKit, Vitest and Playwright; no new dependency.

**Spec:** ../specs/2026-10-13-unified-approvals-design.md

## Global constraints

- No contract, custody, identity, recovery-policy or treasury change.
- Preferred wallet is a browser preference scoped to account/operator/network, never proof of authority.
- Every activation needs explicit user intent, original member consent and incoming-wallet consent; 20 selected memberships maximum per gesture.
- Preserve pending work and independently confirmed native state across cancellation/failure/retry.

## Review focus

- Changed wallet/account/network/location during async setup must prevent submission.
- Restored preference for a different account or operator must never be reused.
- Stale nonces and already confirmed transactions must be reread before retry.
- Native/EVM activation must verify the paired account and current signing identity.
- Recovery/sign-in return navigation must not skip an unfinished approval setup.

### Task 1: Scoped default and shared activation

**Files:** src/auth/action-signer.ts, src/auth/approval-preference.ts, src/App.vue; tests/unit/approval-setup.test.ts and existing wallet-signing.test.ts.

**Interfaces:** `preferredApproval`, `saveApprovalPreference`, `startApprovalPreferences`; `activateMemberWallet(member: UserMembership, kind: 'native' | 'evm', check: () => void): Promise<void>` reuses current native/EVM activation and refreshes current authorization.

- [x] Write and run failing regressions for preference isolation and activation refusal/skip/retry, using typed producer data and real instruction encoding.
- [x] Implement scoped preferences and move existing activation logic into the shared signer helper, preserving validation and adding context/pairing checks.
- [x] Run targeted tests and strict typecheck; commit after all consumers in Task 2 use the helper.

### Task 2: One setup screen and all entry points

**Files:** src/components/ApprovalSetup.vue; src/views/Account.vue, CreateDao.vue, Workspace.vue; src/components/ActionSigner.vue, AdmissionPanel.vue, NativeWalletPanel.vue, LinkedAccounts.vue; src/auth/destination.ts; tests/e2e/unified-approvals.spec.ts.

**Interfaces:** ApprovalSetup consumes the shared default/activation helpers and existing pairing/recovery components. `approvalSetupLocation(returnTo: string, daoId?: string)` produces only a local Account setup destination.

- [x] Write a browser regression that reaches setup from an unready document signer; verify selected DAO, return destination, and no activation on navigation.
- [x] Implement account-level default and selected-DAO approval review, with visible progress and fail-stop retry. Keep recovery controls on the same page.
- [x] Replace standalone DAO activation with the shared setup entry. Route unready creation and join journeys there; preserve sign-in/return behavior.
- [x] Exercise desktop/mobile setup, wrong pairings, two DAO choices, retry, reload and return navigation; adapt existing flow tests to the new journey.

### Task 3: Verification and delivery

**Files:** README.md, CHANGELOG.md, docs/README.md, docs/evidence/2026-10-13-unified-approvals.md, frontend package/lock versions; core operations/paired-login.md.

- [x] Run `npm run verify`, relevant browser suites and production testnet build. Inspect the compact screen and review auth/recovery callers.
- [x] Record exact results and unqualified physical-wallet limitations, then commit/integrate/push dev preserving any concurrent work.
- [x] Build a clean testnet artifact, publish atomically with rollback assets retained, and run real portal network/DAO loading checks.
