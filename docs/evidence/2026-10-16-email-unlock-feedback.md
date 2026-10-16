# Email unlock feedback — 16 October 2026

Frontend `0.15.0-alpha.50`, application commit `03b03128508945a0453e7deebb087e6291f80a57`, is pushed to `dev` and live on shared testnet. A subsequent test-only commit makes the simulated login response mirror the existing API CORS headers; it does not change the deployed bundle. Core32, modules42, API, database, contracts, custody and recovery policy are unchanged. Almaiso is excluded. See the [verification and rollout evidence](2026-10-16-email-unlock-feedback.json).

## Cause and correction

The user's screenshot shows an empty required email field and the browser's validation bubble. No submit request can occur in that state, so the code-confirmation form does not appear. Signed-in unlock now fills the address when exactly one email has full access enabled. Multiple eligible addresses require an explicit choice. It does not request mail automatically, overwrite an entered address or prefill a new pairing or anonymous login. Profile and account access setup reuse the same existing recovery metadata and email component.

The shared email flow explains the two steps, displays **Sending code…**, announces **Code requested**, focuses the code input and provides **Verify code and unlock** for recovery. Existing anonymous sign-in and email pairing keep their respective confirmation actions. Failures retain the address and allow retry. The status confirms a request, not delivery to an inbox: existing non-enumerating service responses are unchanged.

The embedded profile also closed its editor whenever the vault changed state. A second failing regression exposed this after successful recovery. It now closes editing when the account, network or membership changes, or on explicit save/close; unlocking the same profile keeps its editor open. Existing original-key, fresh-verification, account/context, encryption and memory-only timeout checks remain authoritative. The [account guide](../../../daclify-frontend/docs/users/account-entry.md) explains the flow.

## Verification

Both regressions failed before their corrections. All 414 unit tests in 77 files, five lint-policy checks, Vue/TypeScript checks, changed-file formatting and the testnet build passed. The expanded desktop/mobile browser run passed 114 of 118 cases. All 30 email/recovery cases passed, including the embedded editor, request progress, focus, retry, multiple addresses, missing grants, failed key delivery, inactivity lock and preserved identity.

The four broader failures are two existing tests on both browser projects:

- `account-entry-experience.spec.ts`: **an authenticated nonmember can open admission, retain app return, and recheck membership**. Its old fixture omits the current app-join-preview response and returns 503 before consent.
- `people-workspace.spec.ts`: **Users replaces Account; your profile is first, and only your detail has editing and pairing**. It expects ArrowLeft from Profile to select Sign-in methods despite the current Profile-first tab order.

Both failures were reproduced independently from an unchanged archive of prior `dev` commit `5afbfcc03acd48000acc950ba7f336e471401949`. They are left unchanged and are not reported as passing. No new browser failures remain.

Six additional desktop/mobile cases passed against the actual deployed compiled assets with controlled HTTP/inbox/key-broker responses and real SDK/WebCrypto recovery. The first cross-origin fixture run had two failures because its synthetic login response omitted `Access-Control-Expose-Headers`; the final fixture mirrors the existing server's recovery-grant exposure and all six pass. This required no production/API change.

All 155 public release files match the immutable manifest. Read-only portal/document checks passed on desktop/mobile without page exceptions or API 5xx. Runtime/module hashes, eight ABIs and 54 retained SDK downloads matched their pins. Previous hashed assets and rollback files remain available. Publication used no service restart, proxy edit, database migration or native transaction.

No real email, code verification, key recovery, credential edit, profile publication or DAO mutation was performed. Actual inbox delivery and a real user recovery ceremony remain untested. Backend/native integration suites were not rerun because their implementations are unchanged. Execution evidence is retained under `/data/daclify-runtime/email-send-fix-20261016/`; the immutable frontend release is `/data/daclify-runtime/releases/20261016-email-send-fix`. JSON timestamps are UTC.
