# Private payroll and agent content: package evidence

Date: 2026-10-16. This is isolated package qualification, not live activation.

The package is core public SDK/API 0.15.0-alpha.41, modules SDK 0.10.0-alpha.50 (contract cohort 0.10.0-alpha.7), frontend 0.15.0-alpha.60. Development snapshots core40 and modules49 are immutable intermediate artifacts, not the qualified delivery set.

Private payroll authoring encrypts names before publication and checks the exact terms version. The native agreed reference remains immutable; display renaming preserves pause, recipient, amounts, installments and successor uniqueness. Retry recovery retains only technical fields and checks the actual schedule before another financial signature. Missing descriptive content cannot revoke an approved claim. References release only after all installments settle, through existing retention controls.

Agent operating names use separate encrypted records, public Agent labels and the existing original account keys. Protected founding-agent requests must use the selected account’s originals. Strict custody checks include known managed/assisted public signing or encryption keys, including the sixteen equivalent coordinate encodings; stored account keys are not rewritten. An additive PostgreSQL encryption-key index bounds that lookup. Private representative offices use an encrypted rules document and the public Office label; the reserved Executives marker keeps its authority meaning. Existing public titles and prior disclosures are unchanged.

Old strict governance and module response shapes remain unchanged. Selected private references have additive on-demand endpoints. Native actor/payroll rows gain trailing binary_extension<optional<reference>> values: one explicit null byte when unset, 53 bytes when present. Pinned CDT serializes empty flat binary extensions as defaults, so the nested optional is necessary to represent removal correctly. Existing rows without the extension remain readable. There are no new native tables or secondary indexes. Existing docrefs retain exact versions, with bounded backfill.

Verification actually completed:

- Core scoped compiled/schema/compiler/preflight: 21 cases in four files; observed RED before the agent/custody/compiler fixes.
- Owned PostgreSQL plus native claim integration: 23 cases in three files. Known managed encryption-key alias regression: RED then GREEN in the isolated creation suite.
- Module SDK/payroll/agent/grants/agreement suites: 62 cases in seven files. Private representative regression: actual signed native WASM RED, then five private-ballot cases GREEN; all seventeen existing election cases passed separately. Fixture-only bootstrap/sender failures were corrected before the meaningful RED.
- Actual owned Spring process: one combined payroll/agent authority, liability and resource case passed. Its first attempt used API camel-case references in a native request and failed encoding; the corrected snake-case native request passed.
- Browser: four desktop/mobile cases passed against the matching native41/modules50 fixture, including real encryption/decryption, operating-name confinement, a lost successful payroll response with one commitment, private display renaming and clearing on lock/reload. Earlier test navigation failures used stale document-button/settings-tab labels; those were corrected.
- Frontend affected unit/policy cases: 29 in four files. Core/modules typechecks, scoped core ESLint, module lint, generated documentation checks and frontend production build passed. Build retains the existing chunk-size warning. All five public payroll desktop regressions passed after preserving a failed draft’s existing start time and confirmation when reopening it.

Resource measurements, local Spring only:

- Runtime WASM: 857893 → 861650 bytes. Current hash: `fecff3e07c4e42e1a23165e8aa45ad0826dd39cce06c09f0ad377ebe33457362`.
- Payroll WASM: 114563 → 128760 bytes. Rebuilt the original fed5453 source with core39 headers and original CDT4.1.1 -O=s flags; its historical hash `c5b6aa9975709b6094c716df00b7a1c7134b1e9e9597c632090e54bbbb9184fc` matched exactly. Current hash: `eccef934c359d2a85f4cd2eb188e3f151da610cde1c3df625f342962125944d7`.
- Private two-installment commit: 4542 bytes total native RAM growth and 7462 μs CPU, excluding already published ciphertext. This includes existing schedule/liability bookkeeping.
- Display rename: 0 bytes net growth, 12050 μs CPU. Agent descriptor: 486 bytes, 1864 μs CPU. Native envelopes are synthetic for authorization measurement; actual cryptography is covered in browsers. These are not network prices or CPU guarantees.

Still required before live release: private Quick-question qualification, signed opt-in migration, from-join/full-history continuity, full historical archive decoder and frozen-financial-source compatibility, complete leakage/upgrade suites, and immutable candidate deployment checks. No TESTDAO-2 state, customer keys, memberships, funds or live services were changed. Local verification does not establish independent cryptographic assurance or erase historical plaintext.
