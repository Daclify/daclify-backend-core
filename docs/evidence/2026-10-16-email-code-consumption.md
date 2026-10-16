# Email code consumption and account timeouts — 16 October 2026

Frontend `0.15.0-alpha.51`, commit `058234615f89ea8a46502284228f6b7516bdf54c`, is pushed to `dev` and deployed on shared testnet. Core32, modules42, authentication policy, API, database and native contracts are unchanged. Almaiso is excluded. Verification and rollout results accompany this note in the [JSON evidence](2026-10-16-email-code-consumption.json).

## Observed behavior

Scoped read-only metadata for the account being troubleshot showed a single recent email-login challenge with a 600-second validity period. It was consumed after approximately 32 seconds with one recorded attempt, followed immediately by an unrevoked email-authenticated session lasting 12 hours. The code was therefore accepted before its expiry. No user-supplied code was used, repeated, matched against its hash or stored in execution artifacts.

The exact first browser restoration failure cannot be determined from that metadata. The recovery grant remained present at inspection. Storage scope, origin and public identity comparisons matched, and a read-only key-service health/credential check succeeded. Those checks do not prove private backup retrieval or key recovery.

The browser had a reproducible UI defect: after email login succeeded, the same single-use code and its confirmation control remained available while the parent restored account access. The old invalid-code message also implied expiry for every rejection. The correction immediately clears an accepted code, acknowledges email verification, pauses only sign-in controls while restoration finishes, and preserves/focuses any separate recovery error. Failed code verification still allows correction or a fresh request; rejected private recovery keeps private fields locked. No automatic code resend or authentication bypass was added.

## Existing limits, unchanged

- An email code lasts up to 10 minutes and works once. A newer request replaces the previous code; the existing browser binding and attempt limits remain.
- A normal signed-in session expires 12 hours after sign-in. Browsing does not extend that fixed expiry.
- Browser keys lock after 10 minutes without key use, or after a page reload. Signing and other private-key operations refresh this timer; ordinary browsing does not. These are access locks, not an automatic account ban or deletion.

The [account guide](../../../daclify-frontend/docs/users/account-entry.md) and account access screen clarify these distinctions.

## Verification and limits

The new regression first failed because the accepted code remained in the form. The final selected browser run passed all 92 desktop/mobile cases, including delayed/failed restoration, cleared confirmation controls, focused recovery errors, preserved private-field locks, profile drafts, wallet focus, encrypted-kit restoration and ordinary email retries. The previously documented unrelated app-admission fixture test was excluded in both projects; it is not counted as passing.

An intermediate broader run caught three regressions from pausing the entire account screen: profile draft input, wallet-recovery focus and encrypted-kit selection restoration. That candidate was not deployed. Pausing only paired sign-in controls corrected them; all eight focused cases and the complete final 92-case run passed. All 414 unit tests in 77 files passed before that final template-only narrowing; the final Vue/TypeScript testnet build, lint, formatting and browser run verified the final templates. JavaScript/TypeScript logic did not change after the unit run.

All eight additional desktop/mobile checks against the deployed bundle passed with synthetic transport. One initial live-bundle case assumed the starting tab before asynchronous account bootstrap; explicitly selecting Profile corrected the test setup without another application change. All 155 public files matched the manifest; read-only desktop/mobile portal checks, runtime/module hashes, eight ABIs and 54 retained SDK downloads passed. Both user service units remained active. Exact results are recorded in the JSON evidence. The immutable release is `/data/daclify-runtime/releases/20261016-email-code-validity`; execution evidence is `/data/daclify-runtime/email-code-validity-20261016/`. The rollout preserves old hashed assets and rollback files and requires no service restart or configuration change.

Browser email and key-broker transport tests use synthetic responses with real SDK/WebCrypto recovery. No real email, login attempt, recovery grant, private-key operation, account edit or native transaction was performed on the user's behalf. Real private recovery and the cause of the user's first browser restoration failure remain unconfirmed; this release corrects the independently reproduced UI behavior and misleading message.
