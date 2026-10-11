# Project documentation review — 2026-10-10

Reviewed inline alongside the audit fixes at the user's request. The review covers the three active V2 repositories and the continuing workspace runtime instructions. Legacy repositories, dated source snapshots, original plans and historical release manifests retain their historical meaning.

## Findings corrected

- Root READMEs, documentation indexes and the public SDK/vendor guidance advertised stale versions. Current source is core/frontend 0.13.0-alpha.3 with modules SDK 0.9.0-alpha.19; module contract version remains 0.9.0-alpha.5. Public `/v1/network` still reports live core 0.13.0-alpha.2, so the candidate is explicitly staged.
- Development guidance still claimed 15 or 21 core migrations. Source has 34 immutable core migrations and five producer-owned Archive migrations. Applied migration bytes were not changed.
- Active recovery/archive guides described implemented original-key recovery, native anchors/pruning and guarded cleanup as absent. They now distinguish implemented source and owned-fixture evidence from disabled configuration, unqualified clients/providers and production release requirements.
- Native permission examples now link the already completed policy-2 testnet handover while keeping the Relay/Fees proposal pending. They explain circular owner/active delegation guards, scoped Relay operations, fee-treasury quorum, Names oracle scope and the creator recovery override.
- Names guidance records first-party basic names, seller-funded storage, independent inventory cursors and exact quotes beyond the first page. Card quotes use current policy/resource costs, and captured payment is distinct from native fulfillment.
- The user chose to retain external HAProxy unchanged. Current guidance uses exact `SHARED_PROXY_IPS` for aggregate anonymous admission, keeps headers untrusted and preserves account controls. It does not claim to recover visitor IPs.
- The updater runbook now uses an archived source/lock/artifact release matching deployed code. Ordinary development builds remain isolated from published frontend files. Historical Hetzner and version-specific upgrade instructions point to current workspace evidence rather than implying that old versions are live.
- Development source links use `dev`. SDK license links work from both source and distributed README placement. Regression requirements include the new audit, permission, pagination and fixture-provenance cases; qualification remains false.

## Review method and verification

Inventoried Markdown, producer-owned JSON guides and release registers; scanned current/historical documentation links and npm commands; compared current versions with all three manifests/locks, migrations with source, APIs/ABIs with generated references, and permission/cleanup/recovery claims with code and dated test evidence. Generated docs/help are regenerated from their canonical producers and installed through sibling bootstrap, rather than hand-edited.

The full documentation link scan initially covered 198 Markdown files and 797 references. Current runbook/source links resolved after correction. Two companion links in the separate untracked agent-cooperative planning draft initially pointed to not-yet-existing design/plan files. That concurrent work subsequently supplied them; the final scan covered 201 Markdown files and 807 references with no missing local targets. The separate draft, design, plan and model are preserved without editing or staging them. Dated evidence results and historical package hashes were not rewritten into current pass claims. Commands belonging to another repository remain explicitly contextual, rather than being falsely treated as missing scripts.

Final generation, checks, package integrities, relevant tests and exact rollout evidence are recorded in [remediation verification](../operations/project-audit-remediation-verification.md). No documentation change marks a production compatibility combination qualified or authorizes deployment.
