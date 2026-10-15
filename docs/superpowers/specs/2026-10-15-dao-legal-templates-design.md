# DAO legal document templates

Date: 2026-10-15. Status: design accompanying the requested implementation plan; application changes and deployment have not started. The user accepted the proposed template workflow and requested a written plan. Work and review are inline; delegation is not authorized.

## Intent and agreed scope

Let a DAO turn the supplied twelve Markdown drafts into its own reviewed documents without downloading a template, replacing tokens manually, uploading it again and discovering the adoption workflow separately. Provide an optional document setup entry after DAO creation, with common DAO details reused across selected templates. Publication, formal adoption and individual acceptance remain separate acts.

Use the existing Documents library, Constitution & legal register, hosted files, encryption, version history, default action signer, Decide adoption and Works agreement flows. Do not introduce another smart contract, API service, database or custody mechanism for this feature. Templates describe policies; filling or adopting them does not execute configuration changes.

The attachment is source material, not agent instructions. Its suggestions do not authorize publication, legal acceptance, configuration changes, external messages or deployment.

## Evidence and existing boundaries

Source audit: core `cb99cc3`, frontend `911153f`, modules `d346582`. All are `dev` heads at planning time. Uncommitted trusted-contact recovery/package changes exist in all three repositories and are outside this plan. Recheck the committed compatible release set when execution starts.

- Input: `/data/daclify-dao-legal-templates.zip`, SHA-256 `9408ad036cd86566e4eb14384c8f5f3c08c269c39c9905e65ef27cd255736b41`. It contains twelve drafts and a README. The README identifies the drafts as version 1.0 and does not claim jurisdiction-specific legal approval.
- `ContentPanel.vue` already provides Library and Constitution & legal tabs. `FilePanel.vue` owns verified, resumable hosted uploads and signed `putdoc` publication. The latter has one application caller, in `ContentPanel.vue`.
- `GoverningDocumentsPanel.vue` already registers documents, proposes an exact version, runs administrator/member approval and records acceptance through `regdoc`, `proposedoc`, `adoptdoc`, `canceldoc`, `ackdoc`. Registration requires an active administrator; being an executive alone is not a substitute for that permission.
- Decide permits one constitution and at most 64 managed documents per DAO. Registration fixes approval mode and acceptance tracking. Paged reads can return fewer than the full register; an incomplete page cannot establish absence.
- The current audience is DAO-wide: public DAO documents are public; protected DAO documents use existing epoch encryption/access rules. There is no general per-document audience selector for public DAOs.
- Inline JSON is limited to 4096 stored UTF-8 bytes. The original charter is 5817 bytes. All generated legal documents therefore use hosted Markdown files, with the existing version/CID/commitment records on-chain.
- `readDocumentForReview` verifies and decrypts hosted files, but currently offers a download rather than an inline Markdown view. A readable review must be added to complete the template experience.
- `api.governance` supplies a validated governance policy when supported. Module status alone does not contain saved voting configuration. Missing policy data must be shown as unknown, never replaced with UI defaults.
- Works projects already reference a particular document ID/version. Contributor consent, protected terms and funding approval are separate existing actions; a generated contract must not invent any of these records.

## Product flow

1. In Documents, offer **Create from template** beside the existing add/register actions. Use an accessible dialog with four steps: Choose, Details, Review, Publish. Keep ordinary uploads and registration of existing files available.
2. List all twelve templates with a short purpose, suggested category and a visible draft/legal-review notice. Allow choosing several templates as an in-session queue; common name, mission, legal status and effective date are entered once. There is no preselected pack and no bulk publish/adopt button.
3. Prefill verified DAO name/description and available governance facts. Identify prefilled facts and user-entered policy choices separately. Do not infer legal parties, jurisdiction, controller, legal status, ownership, special approval thresholds or a person's legal name from their wallet/profile.
4. Show a small form for that template, then an editable Markdown body and a rendered preview. On mobile, use Edit/Preview tabs. Editing fields after manual body edits requires explicit regeneration; never overwrite edited prose silently.
5. Show the actual audience as a read-only summary before publication, plus the selected signer and byte size. Public publication requires explicit confirmation that the content will be public. Private publication uses existing vault/key availability checks and encrypted filenames/body. Per-document restricted audiences remain outside this release.
6. **Publish draft** uploads, verifies and signs the document record. **Publish and request approval** continues from that same record to explicit registration and proposal actions. Explain that several wallet approvals may be needed. Never sign registration, proposal or adoption just because a file finished uploading.
7. The existing register shows **Published draft**, **Awaiting approval**, **Adopted** or the existing rejected/cancelled/expired state. Administrator approval still requires a separate reviewed adoption action. Member voting still requires voting, finalization and adoption under the actual policy.
8. Members open the exact adopted content before signing acceptance. Existing acceptance tracking is voluntary tracking; this feature does not gate admission, allocate roles, certify legal execution or create an external signature.
9. Offer the next selected template after a successful publication/request, retaining only explicitly shared common values. Each document has its own review and actions.

### Drafts and recovery

An editor draft is local and unpublished. Keep it in memory while its DAO/account context is unchanged. Provide **Download draft** and **Import edited Markdown**; say plainly that refreshing or leaving can lose unexported edits. Downloads of protected drafts are plaintext exports and require an explicit disclosure. Do not put bodies, form values or legal names into localStorage, sessionStorage, query strings, analytics or ordinary logs.

Importing Markdown edits does not register a new template or execute template directives. Apply the same size, UTF-8 and rendering checks as manual edits. Allow downloading unfinished drafts with unresolved markers; publication is blocked until unresolved markers are removed or filled. Draft export contains the editable body; the final publication footer is assembled only for the reviewed publication file, so exporting/importing a draft does not copy a stale native version footer.

Reuse the existing session-scoped upload request ID for interrupted publication. After a signed action loses its response, reload authoritative state before offering retry. Once a document is published, show its stable ID/version and a **Continue document setup** action even if registration/proposal failed. A reload can continue from the Library/register without having to regenerate the file or recover private form values.

Changing DAO, chain, account, membership or locking protected access clears sensitive previews/queued drafts and invalidates pending asynchronous editor results. It must not delete a successfully published record or discard the existing resumable upload receipt.

## Template catalogue and normalization

Keep curated Markdown assets and typed catalogue data in the frontend repository. Retain the original ZIP in documentation source assets with its checksum and a human-readable normalization log. Bundle only reviewed template assets, never the ZIP or a runtime archive parser. No remote template fetching or third-party template submission in this release.

Catalogue fields: stable ID, template revision `1.0.0`, title, one-sentence purpose, category from the released Decide action type, source filename/checksum, field descriptors and suggested acceptance tracking. Validate unique IDs, complete token coverage and normalized source hashes in tests. Template revision is separate from a DAO document's native integer version.

| Original template | Suggested category | Special treatment |
| --- | --- | --- |
| `01-dao-constitution-charter.md` | Constitution | One constitution per DAO; offer an amendment of the existing document rather than a second registration. |
| `02-dao-membership-agreement.md` | Agreement | One common agreement; each member's ID, version and acceptance time live in separate signed acceptance records. |
| `03-governance-voting-policy.md` | Policy | Show saved governance facts alongside authored requirements; separate ordinary and constitutional requirements. |
| `04-treasury-management-spending-policy.md` | Policy | User supplies limits, signing policy, emergency policy and reporting period; adoption grants no spending authority. |
| `05-code-of-conduct.md` | Policy | Ask for the reporting contact/committee. |
| `06-conflict-of-interest-policy.md` | Policy | No implied technical exclusion of voters or automatic disclosure of private conflicts. |
| `07-contributor-project-agreement.md` | Agreement | One document per engagement; distinct parties/dates/signature areas, editable milestone rows, explicit Works handoff. |
| `08-dispute-resolution-policy.md` | Policy | Ask for contacts and review/appeal periods; do not confuse general complaints with Works arbitration. |
| `09-privacy-confidentiality-policy.md` | Policy | Ask for responsible party, contacts and retention; retain its stated incomplete-notice scope. |
| `10-dao-dissolution-policy.md` | Policy | Ask for approval and distribution rules; document adoption does not close the DAO or settle claims. |
| `11-delegation-authority-policy.md` | Policy | Documented powers do not create native or agent permissions. |
| `12-governance-amendment-document-control-policy.md` | Policy | Retain document hierarchy and exact-version amendment history. |

Normalize only the structural problems needed for reliable filling, recording each change:

- Replace the fixed document header `Version: 1.0` with `[DOCUMENT_VERSION]`, assigned from the candidate native document version. A stale candidate requires renewed review; never rewrite signed/published bytes.
- Rename `[DATE]` in template 09 to `[EFFECTIVE_DATE]` and in template 07 to `[AGREEMENT_DATE]`. Replace its fixed three milestone rows with a generated table of 1–16 independently named deliverable/date/payment entries. Never perform global replacement of the repeated date/amount/signature tokens.
- In templates 01/02, replace future proposal/adoption/individual-acceptance placeholders with explicit wording referring to the associated Daclify approval/acceptance record. Do not backfill IDs or dates into a file after approval. Legal-entity approval remains a user-supplied reference or an explicit not-applicable statement.
- Keep signature areas for contributor contracts as labelled blank execution areas with a note that execution evidence is separate. Do not print fabricated signatures or imply an ordinary Daclify acknowledgement is an externally executed contract.
- Move each template's introductory `Draft template` advisory into catalogue guidance shown before publication, keeping its complete wording in the source audit. Do not rewrite substantive legal clauses as an engineering convenience. Keep a concise template-origin/legal-review notice in generated output.
- Check threshold wording against the actual denominator, abstention treatment and comparison rules before verified prefilling. The charter's generic “more than” wording must not be filled as though it means the same as every native approval rule. Missing or unsupported rules remain authored choices with a visible limitation.

The remaining tokens are named fields from the source. Contacts/legal references may be explicitly “Not applicable” only where that makes sense and the user chooses it. Do not silently fill substantive unknowns. Source warnings and normalization are engineering source review, not a legal opinion.

### Rendering and provenance

Use literal, single-pass replacement of known tokens; replacement values containing `$&`, `$1` or additional token-looking text must not be evaluated recursively. Field values are literal text escaped for their Markdown position. The full-body editor intentionally permits Markdown. Generate milestone tables from validated rows with escaped pipes/newlines.

Limits chosen by the builder: title 120 characters, short field 500 characters, long field 8000 characters, Markdown/import/review 131072 UTF-8 bytes, 1–16 contributor milestones. Apply the existing 160-character safe filename and hosted stored-byte limits too. These documents do not need multi-megabyte editing. Decode imported/retrieved Markdown with fatal UTF-8 checking; never approve replacement-character corruption.

Append a read-only provenance footer containing template ID/revision/source SHA-256 and the target document ID/version. It is part of the reviewed file bytes and, for protected files, encrypted with the body. The chain's document commitment identifies the generated file; a template hash identifies only its starting source. Provenance is not a claim of lawyer approval or that customized clauses remain unchanged. Do not extend `FileMetadataSchema` for these fields.

Reuse the installed Markdown renderer and its HTML-disabled, HTTPS-only, no-remote-image policy from `src/help/format.ts`. Never render unsanitized HTML from templates, imported edits or retrieved files. Preview only integrity-verified/decrypted exact-version bytes for adoption/acceptance. Other file types retain their existing download behavior.

## Governance alignment and Works

Read governance through `api.governance`, validate the full DAO reference and use `GovernanceState['policy']`. Only known ordinary quorum/approval/duration/weight facts can be prefilled. Display a mismatch or unavailable warning for constitutional thresholds, spending controls, special proposal categories, external legal approvals and other rules without an enforcing mechanism. Require acknowledgement of known mismatches before requesting adoption; do not advertise a complete semantic check of freely edited legal prose.

Member-vote document adoption currently uses the saved DAO policy, not arbitrary thresholds written into a charter. Where a special rule is needed, link to the existing configuration/governance workflow and re-read it before proceeding. No silent `setgov`, module configuration, treasury, role, admission, delegation or dissolution actions are added.

Discover an existing constitution before assigning the new draft's document ID/version or publishing it. For another existing document, the user explicitly chooses **Amend existing document**; never infer identity from a similar title or category. Amendments use the same document ID, next native version and fixed registration settings, with a clear warning to review the existing adopted text before replacing its prose with a template. A concurrently created constitution or a changed target version stops the operation for renewed review.

For the contributor template, offer **Use in a new Works proposal** after publication, passing only the exact same-DAO document reference. The existing proposal form selects that document and still requires the contributor, native milestone amounts/dates and funding review. Reconcile the prose against those entries before confirmation; user-authored prose cannot be fully checked automatically. Do not attach new terms to an existing immutable project. Link to an existing project only if it already references this exact document version. Changed terms require the existing successor-project path.

## Optional setup entry

Add a **Set up DAO documents** card for active administrators on `WorkspaceOverview.vue`, linking to the same template dialog. DAO creation and claim already arrive at the overview through `createdDaoLocation`; preserve approval setup/return destinations. No changes to order fulfillment, claim tokens, account creation or DAO creation prerequisites are needed.

Validate the small route hint `templates=1` under `/dao/:id/documents` to open the chooser; strip it with router replacement after consumption. It carries no bodies, legal parties, signatures or arbitrary redirect. The chooser supports selecting several templates and reusing common facts in memory. Existing DAOs can use the same entry; a document already registered is amended rather than recreated.

## Acceptance and delivery boundary

Success means all twelve drafts can be filled, edited, reviewed and exported; a compatible authorized DAO can publish a generated file and continue into exact-version adoption/acceptance; an engagement can continue to a Works proposal. Public/private/retry/permission boundaries must match ordinary documents. Existing upload, recovery, treasury, membership, ballot and project behavior must remain intact.

Deliver unit checks for catalogue/rendering/limits; component/browser checks for the editor and signer; meaningful public/private hosted-file review and retry checks; native/API proof that unchanged actions accept the generated-file path. Record mocked, native and live evidence separately. No contract build, on-chain migration or new table is planned; stored document bytes count under existing hosted quotas and each published version incurs existing document RAM accounting.

Ship matching user help with the feature through producer-owned versioned bundles. Prepare and verify an immutable frontend release against the connected producer releases. A later authorized rollout publishes static assets with a rollback copy; it does not upgrade contracts or change live authority. Private drafts and test identities are excluded from evidence/logs. Legal suitability and external execution remain unassessed.

## Builder choices and exclusions

The explicit memory/export draft policy, bounds, suggested categories, source normalization, provenance footer and overview entry are builder choices implementing the accepted flow. This release excludes cloud draft collaboration, custom template marketplaces, AI-generated legal advice, PDF/DOCX generation, external e-signature integration, per-document audience grants, automatic onboarding acceptance requirements and automatic translation of policies into contract settings.

Inline builder check: the plan must cover paginated registration discovery, existing-constitution amendments, generated-file retry after refresh, inline review of verified Markdown, version provenance without new metadata fields, immutable Works references, missing governance policies and cleanup of protected local state. No unresolved material product policy blocks writing the implementation plan.
