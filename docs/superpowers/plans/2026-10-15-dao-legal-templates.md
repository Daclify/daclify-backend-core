# DAO Legal Document Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task, inline. Sub-agent delegation is not authorized in this workspace. Steps use checkbox (`- [ ]`) syntax for tracking. This request is for the plan; do not start application implementation or deployment as part of writing it.

**Goal:** Turn the twelve supplied legal/governance drafts into a guided, editable portal workflow that publishes through existing document storage and continues into exact-version adoption or a Works proposal.

**Architecture:** Frontend-owned curated Markdown assets and a small typed renderer feed the existing hosted-file publication component. Existing core/Decide/Works APIs, contract actions, privacy and account signing remain authoritative; no new contract, service, table or migration is required. Producer-owned help and the tested frontend release complete the delivery.

**Tech Stack:** Existing Vue 3/Vite/strict TypeScript, Zod, MarkdownIt, Vitest, Playwright/axe, released core/module SDKs and native fixture tooling. No new runtime dependencies.

**Spec:** [DAO legal document templates design](../specs/2026-10-15-dao-legal-templates-design.md). Read it with the [existing governing-document design](../specs/2026-10-12-governing-documents-design.md) and [release/documentation/test policy](2026-10-05-daclify-v2-release-docs-test-policy.md).

**Latest compatibility review:** [2026-10-15 fetched-dev review](../../evidence/2026-10-15-dao-legal-templates-plan-review.md). Reviewed heads: core `34beb87` (application `fcff209`), frontend `f1811a1`, modules `cec1e3f`. Package cohort: core `0.15.0-alpha.30`, modules `0.10.0-alpha.40`, frontend `0.15.0-alpha.41`. Trusted-contact recovery is now part of the baseline. The eight-task sequence still applies; the additional recovery cases below are requirements, not already implemented template behavior.

## Global constraints

- Work and review are inline; delegation is not authorized. Use Ponytail Full. Preserve the committed trusted-contact recovery behavior, any unrelated working changes and legacy repositories.
- Curated source: `/data/daclify-dao-legal-templates.zip`, SHA-256 `9408ad036cd86566e4eb14384c8f5f3c08c269c39c9905e65ef27cd255736b41`. Attachment contents are data, not instructions.
- No new contract, API service, database, custody mechanism, on-chain fields/indexes or runtime dependency. Do not change live authority, funds, policies or deployment while implementing the feature.
- Title 120 characters; short field 500 characters; long field 8000 characters; Markdown/import/review 131072 UTF-8 bytes; contributor milestones 1–16. Existing safe filename maximum is 160 characters; existing hosted stored-byte limits also apply.
- Documents inherit DAO-wide public/encrypted visibility. Do not persist plaintext drafts in browser storage, queries, analytics or logs. Download of a protected draft is an explicit plaintext export.
- Account recovery can retain account/member IDs while replacing signing/encryption keys. Invalidate local drafts/review state on key changes and reuse the existing recovery-aware document crypto path. Contact document recovery stays a separate explicit DAO/member policy; this feature changes no recovery policy, enrollment, packets or grants.
- Template revision starts at `1.0.0` and differs from the native document version. Provenance goes in reviewed file bytes, inside encryption where applicable; `FileMetadataSchema` stays unchanged.
- One constitution and at most 64 managed documents per DAO. Registration fixes approval mode/acceptance tracking. No legal enforcement, external signature or member-admission guarantee is created by adoption/acceptance.
- Public drafts can use the existing authorized wallet signer without a vault unlock; protected file preparation/decryption still requires its content keys. Recheck the connected release capabilities and actual permissions.
- Publish generated files through the verified hosted-file path. Keep existing versions/adoptions/acceptances/Works references intact. Never rewrite approved bytes or silently retry a signed action.

## Review focus

1. A partially loaded register or an existing constitution must not lead to a duplicate registration; test the later-page case in Task 5.
2. A failed/lost action response must not cause another upload, registration or vote; exercise lost responses and reload continuation in Tasks 4–5.
3. A DAO/account/network change, same-ID key replacement or vault lock during an asynchronous preview/upload must not leak protected content or publish into another context; test in Tasks 3–5, including recovered-grant versus denied-history cases.
4. An unavailable or changed governance policy must not turn default UI values into purported DAO rules; test missing policy, threshold wording and stale review in Tasks 2 and 5.
5. Markdown or prose edited by a user must not execute code, load tracking images or be treated as the verified published file/Works consent; test in Tasks 2, 4 and 6.

## Execution map

Repository-relative paths below are prefixed `frontend/`, `core/`, `modules/` for the actual sibling repositories `daclify-frontend`, `daclify-backend-core`, `daclify-backend-modules`. New filenames are planned; existing paths were inspected. Read every touched file/caller again before editing.

| Unit | Files and responsibility |
| --- | --- |
| Design and evidence | This plan, companion spec, then `core/docs/evidence/2026-10-15-dao-legal-templates.md` and `.json` for actual execution evidence. |
| Reviewed source/catalogue | New `frontend/docs/legal-templates/{README.md,source-v1.zip}`; new `frontend/src/content/legal-templates/catalog.ts` and `templates/` containing the twelve reviewed `.md` assets. |
| Rendering and validation | New `frontend/src/content/legal-templates/render.ts`; reuse `frontend/src/content/governance-inputs.ts`, `content/files.ts`, `help/format.ts` and producer-owned schemas. |
| Guided editor | New `frontend/src/components/LegalTemplatesDialog.vue`; modify `ContentPanel.vue` only for entry/context/handoff. Reuse `WorkspaceDialog.vue`, `ActionSigner.vue`, `api.contactRecoveryState` and existing styles. Recovery state/schema/crypto are existing dependencies to preserve, not a parallel implementation. |
| Hosted publication/read | Modify `FilePanel.vue`, `content/files.ts`, `content/document-review.ts`, `DocumentReview.vue` and `ContentPanel.vue`; extend only their small typed interfaces. |
| Register handoff | Modify `GoverningDocumentsPanel.vue`; continue using its existing signed actions and exact-version guards. |
| Setup and Works | Modify `WorkspaceOverview.vue`, `ContentPanel.vue`, `ModulesPanel.vue`; validate route hints and exact document references using existing helpers/schemas. |
| Help/release | Modify `modules/docs/guides/topics.json`, generated help/reference output and corresponding `core/docs/guides/topics.json` document guidance; update pinned help artifacts through the normal release workflow, without recompiling unchanged contracts. |

### Task 0: Record the execution baseline

**Files:** Execution evidence above; no application changes.

- [ ] Inspect `git status -sb`, staged diffs, current `dev` heads and worktree lists in each repository. Load repository instructions and `superpowers:using-git-worktrees` before creating isolated execution worktrees. Do not stash, reset or commit unrelated changes. The last review found all three repositories clean and matched to fetched remote heads; recheck rather than assuming that remains true.
- [ ] Record the committed compatible producer artifacts, template ZIP hash, Node/npm versions and existing document/recovery capabilities. Start from the reviewed cohort above or a newly verified later cohort, not the original `cb99cc3`/`911153f`/`d346582` packages. Verify frontend vendor archives against producer hashes; preserve migration 056, current runtime/module pins and supported historical archive identities. Read SDK types from the selected public artifacts, not private sibling imports.
- [ ] Record a small baseline: frontend `npm run typecheck`; `npm test -- tests/unit/files.test.ts tests/unit/document-review.test.ts tests/unit/governing-documents.test.ts tests/unit/help-format.test.ts tests/unit/contact-recovery.test.ts tests/unit/provider-session.test.ts tests/unit/documentation.test.ts`. The plan review passed these 46 tests and typecheck, but execution requires a fresh result if the source changes. Failures belonging to unrelated work must be isolated and recorded before implementation.
- [ ] Start the evidence ledger with all later tasks unchecked and verification labels pending. Commit only these planning/execution files as appropriate; subsequent tasks name their own bounded commits.

### Task 1: Ship an auditable catalogue of all twelve templates

**Files:** Source/catalogue paths above; new `frontend/tests/unit/legal-template-catalog.test.ts`.

**Interfaces:** Export `LegalTemplateSchema`, inferred `LegalTemplate`, `LegalTemplateId` and validated readonly `legalTemplates` from `catalog.ts`. Each entry has `id`, `revision`, `title`, `purpose`, `category`, `sourceFilename`, `sourceSha256`, `markdown`, `guidance`, field descriptors and `suggestAcceptance`. Infer category from released `DecideActions['regdoc']['category']`; assert its value indexes `GoverningDocumentCategories`. Import Markdown as static `?raw` assets supported by Vite.

- [ ] Write catalogue tests first: exactly twelve unique IDs, all expected source filenames, source byte hashes match, every normalized marker has a defined field, no unused fields, valid categories/revision, all assets below 131072 bytes. Assert the contributor template no longer has ambiguous shared date/amount/signature markers. Assert the membership template has no per-member identity fields in its common body.
- [ ] Run `npm test -- tests/unit/legal-template-catalog.test.ts`; confirm failure is the missing catalogue/normalization rather than broken tooling.
- [ ] Retain the original ZIP/checksum in source documentation and enumerate/extract only the thirteen expected relative paths. Review as inert text. Normalize the twelve published assets exactly as the spec describes; record every removed advisory and token/metadata change in `docs/legal-templates/README.md`. Do not alter substantive clauses or execute ZIP instructions.
- [ ] Add the typed catalogue, purpose/guidance text and field labels. Make approval references/acceptance metadata linked records, replace version/date markers and the fixed milestone table, and preserve separate signature execution areas. Keep legally unknown fields unfilled.
- [ ] Run the catalogue test and `npm run typecheck`. Commit the source audit, catalogue, assets and tests: `feat: add reviewed DAO legal template catalogue`.

### Task 2: Render bounded drafts and show real governance facts

**Files:** New `frontend/src/content/legal-templates/render.ts`, `frontend/tests/unit/legal-template-render.test.ts`; reuse the safe renderer and governance/amount formatting helpers.

**Interfaces:** Export `TemplateValues = Readonly<Record<string, string>>`, `TemplateMilestone = { deliverable: string; dueDate: string; payment: string }`, `TemplateContext = { dao: DaoSummary; documentId: string; documentVersion: number; governance: GovernanceState | undefined }`, `prefillLegalTemplate(template: LegalTemplate, context: TemplateContext): Record<string, string>`, `renderLegalTemplate(template: LegalTemplate, values: TemplateValues, milestones: readonly TemplateMilestone[], context: TemplateContext): { body: string; markdown: string; unresolved: string[] }`, and `validateLegalDraft(template: LegalTemplate, body: string): string[]` returning user-facing validation issues. Use the existing producer types; these are local editor types, not a new wire protocol.

- [ ] Write tests for all twelve filled outputs, missing/unknown markers, whitespace-only fields, literal `$&`/`$1` and token-like replacement values, field bounds, non-ASCII byte limits, table pipes/newlines, 0/1/16/17 milestones, safe filenames and deterministic provenance. Verify changing a template revision never modifies a previously generated file.
- [ ] Add policy tests: `undefined` or `null` policy produces no claimed quorum/duration/weight; foreign-DAO policy is rejected; known values format without floating-point money errors. Pin threshold phrasing to the actual native comparison/denominator/abstention semantics. Do not populate constitutional settings from ordinary settings.
- [ ] Run `npm test -- tests/unit/legal-template-render.test.ts`; confirm the relevant assertions fail before implementation.
- [ ] Implement literal single-pass token rendering, escaped scalar/table values, unresolved-marker reporting and bounded validation. Append the readonly provenance footer after editing. Derive the candidate version from current content, not the template revision. Keep future approval IDs/dates and individual acceptance outside the body.
- [ ] Reuse `formatHelpAnswer` from `src/help/format.ts` for preview; tests must reject script/event HTML, javascript/data/credential-bearing links and remote images. Do not add another Markdown dependency/parser or allow arbitrary template execution.
- [ ] Run both new unit suites plus `tests/unit/help-format.test.ts` and typecheck. Commit: `feat: render editable legal drafts with verified DAO facts`.

### Task 3: Build the chooser, editor and local draft recovery

**Files:** New `LegalTemplatesDialog.vue`, new `frontend/tests/e2e/legal-templates.spec.ts`; modify `ContentPanel.vue`.

**Interfaces:** Dialog props are `dao: DaoSummary`, `member: UserMembership | undefined`, `content: DaoContent | undefined`, `open: boolean`, `targetDocumentId?: string`. The optional target is a validated same-DAO amendment hint, not permission to overwrite content. Emit `update:open` and `updated`. Parent owns opening and refresh; dialog owns its session queue/common values and local edits. Network/account context is read from the existing workspace store, not copied into route state. Task 4 adds the publication event when its reference type exists; this task's editor must compile independently.

- [ ] Add mocked browser cases for choosing one or several of the twelve templates, shared fields, form-to-preview editing, explicit regeneration after manual edits, missing-field focus, keyboard steps, cancel/reopen and screen-reader labels. Assert choosing templates performs no write requests.
- [ ] Add export/import cases: unfinished draft body download/import without a stale publication footer, explicit protected plaintext-export notice, valid UTF-8 import, corrupt UTF-8/oversized import rejection, no draft text in storage/URL/log requests. Assert a foreign-account/DAO/network change, same-UUID/member-ID signing/encryption-key replacement, DAO epoch change and protected vault lock clear previews and do not revive stale async results.
- [ ] Run `npx playwright test tests/e2e/legal-templates.spec.ts --project=chromium`; confirm the new feature cases fail for missing UI, not missing fixtures. These route-mocked cases use base `playwright.config.ts`, not the paid native global setup.
- [ ] Implement four compact steps with the existing dialog, plain field inputs, safe preview and existing signer. Keep route context and queue state bounded by the spec. State “Drafts stay on this page until you download or publish them”; preserve edits while closing/reopening in the same mounted context. Warn before discarding on deliberate navigation and use `beforeunload` only while dirty.
- [ ] Add **Create from template** without removing ordinary upload/register actions. Nonmembers may inspect the static templates; publication needs active membership and managed registration needs current administrator permission. Show public/encrypted audience as a read-only fact, with explicit public publication confirmation. Unsupported signing/capabilities display an actionable explanation. Context watches include account public keys, member signing key/active state and DAO key epoch; account UUID alone cannot invalidate replaced credentials.
- [ ] When `trusted-contact-recovery-v1` is supported and a member is present, read one `api.contactRecoveryState({ target: { dao, memberId } })` page and validate its full target/current key context before showing `supported`, DAO `documentsAllowed` and member `policy.documents` facts. Explain that two contacts can decrypt backed-up keys without the member and that permitted/opted-in does not prove epoch coverage. Unknown/failed state is visibly unknown. Do not fetch all packet history, auto-enroll contacts or create recovery packets. Add browser cases for permission off, on without member opt-in, opted-in, unsupported, failed and foreign/stale state; assert no recovery mutation requests.
- [ ] Run the targeted browser file on desktop/mobile, typecheck and relevant unit suites. Commit: `feat: add the DAO legal template editor`.

### Task 4: Publish generated files and review their verified bytes

**Files:** Modify `FilePanel.vue`, `content/files.ts`, `content/document-review.ts`, `ContentPanel.vue`, `DocumentReview.vue`, `GoverningDocumentsPanel.vue`, `LegalTemplatesDialog.vue`; extend `tests/e2e/files.spec.ts`, `tests/unit/document-review.test.ts` and the legal-template browser tests.

**Interfaces:** In `content/files.ts`, export `PublishedDocumentReference = Pick<HostedDocument, 'dao' | 'documentId' | 'version' | 'commitment'>`. `FilePanel` gains optional `initialFile?: File` and `expectedVersion?: number`; its existing `published` event returns this reference after verified publication. The template dialog emits the same `published` reference. Normal file-input callers keep working. Export inferred/explicit `ReviewedDocument` for `readDocumentForReview`'s existing `{ text, file? }` result plus optional `markdown?: string`; add that property only for bounded, verified UTF-8 `text/markdown` files. Do not change producer schemas.

- [ ] Add tests before implementation: generated Markdown is the exact byte sequence uploaded/committed; private body/name/provenance never appear in provider-visible plaintext metadata; native wallet public publication does not require the vault; protected uploads do. Test replacing a generated file while an upload receipt exists is refused, lost publication response is reconciled, and retry after reload uses the original request/record. If another version appears during editing/upload, reject a different `expectedVersion` and require renewed review instead of publishing a file with a false version footer.
- [ ] Add review tests for verified public/encrypted Markdown, corrupted commitment, invalid UTF-8, oversized review and foreign DAO. Add a replacement-vault case where the original epoch grant cannot open but the existing `session.ts` path retrieves a valid additional `recgrant`; separately refuse missing/uncovered or historically forbidden keys. Explicit future-access approval/fresh keys must not make an old agreement readable. Assert no adoption/acceptance becomes review-ready from unverified editor text or old pre-recovery plaintext. Ordinary PDF/binary downloads remain unchanged. Preview XSS tests apply to retrieved files too.
- [ ] Run the new focused unit/browser cases and confirm their initial failures.
- [ ] Feed a generated `File` (`text/markdown`) and the reviewed candidate version to the existing upload component. Check the fresh same-DAO document state against `expectedVersion` before preparing an upload; at publication reconcile any existing exact receipt/record before rejecting a conflict. Keep `send/check/publish`, quota reservation, receipt checks, current signer refresh and domain guards in their existing owner. Never create a second upload/relay path. Emit the narrow reference before clearing local receipt state; ignore stale incoming files and retain unfinished uploads.
- [ ] Add Markdown decoding only after existing verification/decryption. Continue to use `encryptDaoFile`/`decryptDaoFile` and their session-level recovered epoch lookup; do not inspect/export keys or overwrite original grants in the template code. Display returned Markdown with the safe renderer in `DocumentReview.vue` and the managed-document callback path, retaining a download option. Review text/bytes are cleared on context/key/vault guards. In this task, change `ContentPanel.openManagedVersion` and the governing panel's callback type to `Promise<ReviewedDocument | undefined>` and update its opened-content maps/rendering together so all callers compile.
- [ ] Run files/document-review/legal-template tests, existing governing-document unit tests and typecheck. Commit: `feat: publish and review generated legal document files`.

### Task 5: Continue publication into registration and exact-version adoption

**Files:** Modify `GoverningDocumentsPanel.vue`, `ContentPanel.vue`, `LegalTemplatesDialog.vue`; extend `tests/e2e/governing-documents.spec.ts` and `tests/e2e/legal-templates.spec.ts`.

**Interfaces:** `GoverningDocumentsPanel` accepts optional `registrationCandidate?: { reference: PublishedDocumentReference; category: DecideActions['regdoc']['category']; approval: DecideActions['regdoc']['approval']; trackAcceptance: boolean }` to preselect its existing form, and emits `registered: [documentId: string]` after authoritative refresh. Consume `ReviewedDocument` from Task 4 for the exact-version open/accept gates. A candidate is an untrusted UI hint; permissions, record identity and registration state are rechecked before every write.

- [ ] Write scenarios: explicit publish-only; publish then register/propose; separate administrator adoption; member vote/finalize/adopt; one acceptance per adopted version; a new upload leaves old adoption/acceptance unchanged; changing the draft invalidates its previous review. Assert no automatic adoption or acceptance request is sent.
- [ ] Write later-page/limit cases: existing constitution on page 2; 64 registrations; same document already registered; partial pagination failure; incompatible/disabled Decide; active nonadmin executive. Incomplete discovery must stop duplicate-sensitive actions with retry guidance, not assume a fresh DAO.
- [ ] Write recovery/race cases: registration/proposal committed but response lost, rejection after publication, newer pending proposal, policy revision/code pin changes, current role revoked, account/DAO switch and same-ID recovered credentials. Re-read current membership/signer bindings after recovery; an old default-wallet selection cannot recreate a revoked binding. If service database loss produces a different account UUID, find a published record through the current authorized native DAO/document/version/commitment rather than relabelling an old upload ticket. Unpublished drafts have no contact-recovery guarantee. Do not resend a mutation on a timer or generate another ballot ID until the previous outcome is known.
- [ ] Run targeted browser cases to demonstrate the missing handoff/recovery checks first.
- [ ] Before freezing a new constitution's ID/version, fetch the complete bounded register and offer amendment of the existing constitution. For other documents accept only an explicit same-DAO `targetDocumentId` choice, not title/category matching. Reuse that document ID, its next native version and fixed registration settings; set `FilePanel.newDocument` accordingly. Require review of the existing adopted text before replacing prose with a fresh template.
- [ ] Wire the candidate into existing signed registration/proposal actions and review displays; reuse exact document/adoption revisions and refresh before signing. Require re-review if the native version changed since preview or a constitution appeared concurrently. On partial success show the completed stage and **Continue document setup** with the published record. Never publish a second constitution merely to discover the uniqueness error during registration.
- [ ] Load `api.governance` for factual prefilling/comparison and revalidate before requesting adoption. Show current weight/quorum/approval/duration, unknown/mismatch limitations and explicit acknowledgement for known authored differences. Do not claim to validate arbitrary legal prose. Do not send a policy/configuration action.
- [ ] Run governing-document/legal-template browser cases on both configured projects, files/review unit tests and typecheck. Commit: `feat: connect legal templates to document adoption`.

### Task 6: Add optional setup and the Works handoff

**Files:** Modify `WorkspaceOverview.vue`, `ContentPanel.vue`, `ModulesPanel.vue`; extend `tests/e2e/legal-templates.spec.ts`, `tests/e2e/works-design.spec.ts`, `tests/unit/document-reference-link.test.ts`, and `tests/unit/destination.test.ts` where affected.

**Interfaces:** `/dao/:id/documents?templates=1` is a validated one-shot chooser hint. For **Use in a new Works proposal**, pass `document`, `version`, `commitment` query hints to `/dao/:id/works`; validate with the released `BallotContentSchema.shape.document` schema, match the exact record in freshly loaded same-DAO content, consume/remove the hints and preselect the existing `workDocument`. Query values never authorize an action and contain no document body or parties.

- [ ] Add browser tests: the administrator overview card opens the chooser after normal creation or a claim; existing approval-setup return navigation is preserved; dismissing does not affect the DAO. Nonadmins have no setup write shortcut. Do not modify claim/order fulfillment merely to add the card.
- [ ] Add Works tests: published contributor agreement selects its exact version; invalid/missing/foreign/stale hints are rejected; choosing the handoff performs no proposal, consent or funding action. The user still confirms contributor, native amounts/dates and a prose/native-terms consistency check. Existing project terms cannot be overwritten by a new generated agreement.
- [ ] Run new scenarios and confirm initial failures. Add the overview card and consume the validated chooser hint. Keep selected packs/common fields entirely within the dialog; there is no serialized pack in a URL.
- [ ] Implement the new-proposal link using the narrow published reference. Let the existing Works form and agreement/protected-terms/consent actions own proposal/funding behavior. Link an existing project only when its immutable document reference already matches; otherwise explain the successor-project path. Do not write mirrored agreement state.
- [ ] Run these browser cases, reference/destination unit tests and typecheck. Commit: `feat: guide DAO document setup and contributor agreements`.

### Task 7: Ship help, verify the complete flow and prepare release

**Files:** Producer guide/generated-output paths in the execution map; affected package/vendor release artifacts; execution evidence `.md`/`.json`. No contract or generated ABI changes.

- [ ] Extend stable `governing-documents`, `documents` and Works guide topics with the twelve-template workflow, local/export draft policy, public/encrypted audience, exact-version adoption, acceptance limits, partial-publication recovery and template-origin meaning. Preserve/link the existing `contact-recovery` topic and explain opt-in key recovery/contact access, missing epoch coverage and separate future-access approval. Keep role/action requirements tied to supported producer versions; add contextual links to these topics in the dialog. Changing guidance does not automatically amend any DAO's adopted privacy agreement.
- [ ] Regenerate each changed producer's help with `npm run docs:generate`; run `npm run docs:check` and relevant documentation tests there. Package only the matching help/protocol releases through the normal immutable artifact process, preserving contract version/pins. Do not reuse an already published package version for changed help bytes or import sibling private files. Record any broader dependency changes caused by concurrent work separately.
- [ ] Run frontend `npm run verify` and `npm run build`. Run base Playwright `npx playwright test tests/e2e/legal-templates.spec.ts tests/e2e/governing-documents.spec.ts` on desktop and mobile. Run affected files/Works scenarios with their correct native fixture where required, not by relabelling route mocks as native checks. Include axe, keyboard focus, long names and 375-pixel width/no horizontal overflow checks.
- [ ] Exercise a synthetic public DAO and an encrypted DAO through the supported native API fixture: generated hosted file -> verified native document -> registration -> administrator adoption -> acceptance; separately member-vote finalization/adoption and a generated-file Works proposal/consent path. Include actual current-recovery-state fixtures and recovered additional-grant versus unavailable-history cases. Use current SDK/runtime/module hashes and migration 056; reuse existing contract fixtures without changing binaries. If fixtures must be rebuilt, follow pinned runtime CDT 4.1.1 `-O=s` plus Binaryen 108 `--mvp-features -Oz`, preserving historical recipes. Record exact file/version commitments and expected rejected attempts, excluding plaintext private content and credentials.
- [ ] Run modules `npm test -- tests/document-archive.test.ts tests/archive-restore.test.ts tests/quick-ballot-archive.test.ts` and prove supported pre-recovery-release document/archive identities still resolve without substituting the current binary/schema hashes. Keep unknown source identities rejected. The feature adds no automatic pruning or new retention promise for adopted documents.
- [ ] Rehearse provider outage, quota refusal, lost response and interrupted private upload. Check the client/backend/provider trace for leakage and once-only behavior. Mocked faults and real-provider checks are reported separately; missing provider access stays unqualified. No production DAO is used as a disposable test fixture.
- [ ] Review the entire diff inline against the spec and five review-focus entries. Verify the original manual upload flow, non-Markdown downloads, old adopted documents and existing acceptance records still work. Publish an acceptance matrix, commands/results and unresolved limits in the evidence ledger; every unchecked item needs an honest reason.
- [ ] Commit bounded help/release/evidence changes, integrate reviewed changes to `dev` and push the intended repositories without including unrelated working files. Produce an immutable frontend build and a testnet rollout checklist identifying actual connected producer compatibility, static asset hashes and rollback target. Deployment is a subsequent authorized operation; no contract upgrade, permission migration or DAO policy write is part of that rollout.

## Delivery checklist

- [x] Twelve curated templates, source audit and complete placeholder coverage.
- [x] Guided filling, editable preview, explicit export/import and truthful draft persistence behavior.
- [x] Public/private publication and readable review of exact verified bytes, including allowed recovered grants and refused historical access.
- [x] Explicit, resumable registration/proposal/adoption and preserved member acceptance history.
- [x] Optional overview setup and safe new-Works-proposal handoff.
- [x] Matching help, passing relevant checks and complete evidence with no mocked/live ambiguity.
- [x] Reviewed `dev` changes and immutable deployment artifact; no unrequested live cutover.

## Planning review and execution handoff

Inline self-review maps source normalization to Tasks 1–2; editing/visibility/drafts to Task 3; storage/integrity/private review to Task 4; governance/retries/constitution limits to Task 5; setup and immutable Works references to Task 6; help, native/browser/provider evidence and release to Task 7. All five review-focus conditions have an owning test step. New interfaces refer only to declared local types or released producer types.

Latest-dev revalidation maps recovery disclosures/no hidden enrollment to Task 3, same-ID key invalidation to Tasks 3–5, additional grants/denied historical access to Task 4, current signers/stable published-record recovery to Task 5, and new release/optimizer/archive compatibility to Tasks 0/7. No additional feature task or native upgrade is needed.

Plan/design writing is complete when their links, source hash, touched-file map and scope are checked. All application task checkboxes remain unchecked until implementation evidence exists. Execution, if requested, remains inline using `superpowers:executing-plans`; do not ask the user to choose delegation again. Legal suitability/external contract execution, mainnet and per-document audiences are not qualified by this plan.


## Implementation disposition — 2026-10-15

Tasks 0–7 are implemented and verified for development integration. The detailed acceptance matrix, exact source/package/native/static identities, commands and qualification limits are in [implementation evidence](../../evidence/2026-10-15-dao-legal-templates-implementation.md) and its companion JSON. The expanded scenario bullets above remain the original qualification checklist; they do not imply that every possible recovery ceremony, wallet GUI, provider fault or concurrency schedule was executed.

Execution rulings: complete-register pagination is shared by the chooser/register; existing raw Library downloads are preserved; known post-upload native conflicts retain the original object and save its receipt before a new review. Producer help changes advance core/SDK to alpha31 and modules SDK to alpha41 while retaining native contract versions/hashes. Frontend alpha42 therefore needs the matching API/help cohort for rollout. The standalone MCP release remains independently pinned.

All delivered-feature acceptance items below are covered by recorded checks. Live provider and full SQL-backed browser qualification are held explicitly; no production/mainnet qualification or deployment is implied. Deployment is the separate rollout checklist in the evidence document, not unfinished implementation work.
