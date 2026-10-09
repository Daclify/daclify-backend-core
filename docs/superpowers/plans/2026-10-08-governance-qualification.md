# Governance Qualification Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans`. No delegation is authorized. Follow the [programme plan](2026-10-08-governance-hardening.md); record real results without weakening release gates.

**Goal:** Qualify wallet, sandbox payment, browser-origin and restore journeys using auditable evidence.

**Architecture:** Extend existing verification and runbooks. Keep an environment/artifact-bound qualification record separate from fixture results and the global production-release decision.

**Tech stack:** TypeScript/Zod, existing Stripe and Wharfkit integrations, Vitest, Playwright, PostgreSQL and native Spring fixtures.

## Task 1 Evidence that cannot turn fixtures into live passes

**Existing files:** C `tools/release/manifest.ts`, `tests/release-manifest.test.ts`, `docs/releases/compatibility.json`, `docs/operations/connected-payments.md`, `docs/disaster-recovery.md`.

**New files:** C `tools/release/qualification.ts`, `tests/qualification.test.ts`, `docs/operations/governance-qualification.md` and `docs/evidence/2026-10-08-governance-qualification.md`.

- [ ] Define a Zod-owned qualification record with check name, environment, status, execution time, the three repository commits, deployed chain/runtime/module code and binary-ABI hashes, client/browser versions and a redacted evidence reference. Use `passed`, `failed`, `blocked` and `not-run` statuses. Validate all imported evidence as untrusted input.
- [ ] Write failing cases: fixture evidence presented as sandbox qualification; evidence for different deployed hashes; missing required case; missing log reference; failure presented as a pass. Do not derive success from prose or from an operator editing a boolean.
- [ ] Implement validation and evidence reporting. Fixture success can appear in the local-check section but cannot satisfy a real-provider/client case. Require operator review of evidence; this is an audit record, not cryptographic proof of a third-party event.
- [ ] Run `npx vitest run tests/qualification.test.ts tests/release-manifest.test.ts` from C. The new regressions must fail before their implementation and pass after it.
- [ ] Retain global `qualified: false` and `publication: refused` while remaining release holds are unresolved. Do not refactor release publication in this package.
- [ ] Commit only the evidence schema, relevant checks and runbook changes.

## Task 2 Real wallet and browser-origin journeys

**Existing files:** F `src/auth/telos-zero.ts`, `src/auth/telos-evm.ts`, `tests/unit/native-wallet.test.ts`, `tests/unit/wallet-signing.test.ts`, `tests/unit/telos-evm.test.ts`, `tests/e2e/wallet-recovery.spec.ts`; C `tests/native/paired-wallets.test.ts`.

- [ ] Add regressions only for actual gaps exposed during the journey; retain exact-action checks, nonbroadcast proof signing and context validation.
- [ ] Exercise real Anchor on desktop and mobile: connect, sign intent, sign governance, cancel, disconnect, reconnect and later sign. Test restored sessions only if the application actually uses restoration.
- [ ] Exercise a real supported EOA client: login/link, bound governance signing, cancellation, network change, account change and revoked binding. A browser cancellation or stale context must not broadcast.
- [ ] Repeat on the selected actual frontend/API domains. Cover same-site operation and any supported independent operator origin. Verify cookies, CSRF, issuer binding, logout and return destinations in the actual browser.
- [ ] Record approved prompts, expected chain/account/action, transaction IDs and redacted failure evidence. Human wallet approval remains part of the genuine client test; no fixture counts as that approval.
- [ ] Run the existing focused unit tests and native paired-wallet selection after a code change. Record actual results. Keep user-controlled decryption recovery distinct from service/governance recovery.

**Acceptance:** A valid exact action succeeds with the intended identity; cancellation and any changed context cause zero broadcasts. Login persistence works on the actual supported domain/browser combinations.

## Task 3 Genuine Stripe sandbox lifecycle

**Existing files:** C `services/api/src/payments/`, `services/api/src/billing/`, `tests/connect-provider.test.ts`, `tests/connected-payments.test.ts`, `tests/integration/connected-payments.test.ts`; F `tests/e2e/connected-payments.spec.ts`.

**New file:** C `tests/providers/stripe-sandbox.test.ts`, with explicit sandbox-only configuration and redacted evidence output.

- [ ] Read the installed Stripe SDK types and current provider adapters before adding the sandbox selection. Assert sandbox mode through supported response data and isolated account configuration. Do not infer it from a filename.
- [ ] Exercise existing-account OAuth, new-account onboarding, capability availability and an actual direct charge/application fee where the sandbox account supports them.
- [ ] Exercise graduated subscription purchase and increase, failed/pending payment, renewal, decrease, cancellation, refund and dispute. Verify native capacity/receipt reconciliation through the real delivery path.
- [ ] Replay a previously delivered event and retry an uncertain request. Assert no replacement subscription, duplicate fulfillment, duplicate native attestation or wrong-buyer receipt.
- [ ] Add a regression for each observed failure. Run `npm run test:providers -- tests/providers/stripe-sandbox.test.ts` only against intentionally configured sandbox resources.
- [ ] Record regional/account restrictions or unavailable provider delivery as blocked cases with reasons. Do not substitute mocked SDK responses.

**Acceptance:** Provider records, immutable consent/pricing and native capacity agree. Failure/refund/dispute outcomes reconcile without granting governance rights or creating duplicate customer liabilities.

## Task 4 Restore and final evidence

- [ ] Rehearse off-host backup restoration into a separate PostgreSQL database whose name ends in `_test`; preserve the source database and current fixture containers.
- [ ] Verify merchant/customer/order/invoice mappings, consent snapshots, broker revocation, login pairings and job retry state. Keep workers/payment creation disabled while mappings are unresolved.
- [ ] Verify wallet recovery preserves existing membership and does not recreate a DAO, subscription or voting identity. Decryption additionally needs the original document keys and surviving ciphertext.
- [ ] Record archive integrity, restore commands, recovered mappings and unresolved content without secrets or personal data.
- [ ] Run the relevant integration recovery and payment checks, then review the qualification record against exact artifacts.
- [ ] Commit the runbook and redacted evidence. Leave provider/client cases visibly blocked when external access is missing and continue independent B/E/W work.

**Acceptance:** The restore recovers the original associations and jobs without duplicate payments. No claim of total recovery is made where keys, ciphertext or provider mappings are absent.
