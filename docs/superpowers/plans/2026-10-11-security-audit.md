# Three-repository security audit and remediation plan

**Goal:** Review core, modules and frontend security boundaries, reproduce credible weaknesses locally, repair safe confirmed defects and record verification limits.

**Architecture:** Contracts remain authoritative for authorization and money. Services enforce session, provider, resource and storage boundaries; the frontend holds user keys and verifies signed context. Execute inline as required by the workspace instructions and the user's autonomous audit brief.

**Scope:** Current `dev` source in all three repositories; preserve unrelated documentation edits. No live penetration tests, deployment, authority changes, payments or credential rotation.

- [x] Record source revisions, working-tree state and runtime/dependency baseline.
- [x] Map browser/API/database/provider/contract trust boundaries and inspect authentication, recovery, connected-app delegation, content and payment paths.
- [x] Complete contract/module, frontend, infrastructure and redacted secret/dependency review; challenge suspected findings against actual safeguards.
- [x] Reproduce connected-app sponsored-relay limit bypass using canonical ABI payloads and an owned PostgreSQL database; pass the existing account-wide admission function into the connected-app route and verify a shared budget across both relay routes and tokens.
- [x] Reproduce public gateway-download abuse through HTTP; apply bounded admission before provider retrieval, preserve public encrypted-byte access and verify forged forwarding headers cannot evade the limit.
- [x] Extend the existing sign-in admission hook to direct vault/provider login routes after reproducing the namespace bypass; verify shared limits, ignored forged forwarding headers and expiry.
- [x] Apply the existing account-wide asset-write budget to document uploads and reconciliation after reproducing repeated-byte allocation of upload/job records; verify quotas cannot substitute for operation admission and status reads remain available.
- [x] Run relevant regression/integration tests and all three verification suites/builds, perform a separate adversarial review pass, and publish the evidence-based report.

**Review focus:** Cross-DAO and cross-app payload substitution; stale/revoked credentials; concurrent duplicate payments; cancellation and network/account switches while keys are unlocked; exhaustion of sponsored chain CPU or shared gateway capacity.

**Rulings:** The user's attached brief authorizes safe remediation despite the audit skill's default read-only mode. Existing instructions require inline execution, so separate review passes replace agent delegation. Public ciphertext availability is intentional; the content finding concerns shared provider capacity, not plaintext disclosure. Test-emulator advisories do not establish production exploitability.

**Execution ledger:** All three baseline verification suites passed. Four production fixes were supported by five failing-before regression cases. Final core verification passed 872 cases; the complete owned database suite passed 271; selected owned native suites passed 137 permission/workflow and eight connected-app cases. Modules passed 179 cases and frontend 275; all three builds passed. The separate adversarial review added explicit provider-read side-effect assertions, followed by a passing full 43-case content suite and fresh static checks. The owned database, ephemeral role and credential file were removed. The evidence report and machine receipt record unresolved emulator advisories, setup failures, source revisions and qualification limits. No deployment occurred.
