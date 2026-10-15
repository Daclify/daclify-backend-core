# DAO legal templates — shared testnet deployment

The user-authorized release is live at [the testnet portal](https://testnet.app.daclify.com/). In a DAO, open **Documents → Create from template**. Twelve curated drafts support guided fields, editing and review. Publishing, registration, adoption and acceptance remain separate explicit actions. See the [implementation evidence](2026-10-15-dao-legal-templates-implementation.md) for feature coverage and qualification limits.

## Deployed cohort

| Component | Version | Committed source |
| --- | --- | --- |
| Core API / SDK / help | `0.15.0-alpha.31` | `1a639c0c0620a5c5b25e4dd73ffbe0f9a5147b9d` |
| Modules SDK / help | `0.10.0-alpha.41` | `a2cdc7106d72ccfe605d7f65e63b32bf8310c9f1` |
| Frontend | `0.15.0-alpha.42` | `644dfdd163bc3f7bfab43f209771bdbf02887452` |

Cutover completed at 22:34 UTC on 15 October 2026. The API uses the committed snapshot under `/data/daclify-runtime/releases/20261015-legal-templates/`. The fixed-testnet frontend archive SHA-256 is `5f98f865c6e1dbbdd1b4283eec1e5372f36e4f0f3f2000541d51965b32551f74`. The previous API, configuration, frontend and paused database checkpoint remain available together for rollback. Hashed frontend assets from prior releases remain available for open tabs.

The matching mini-app starter was rebuilt using the immutable alpha31/alpha41 SDK archives. Its release ID is `289d37c82fc44d9545c7696f8a9c0225381b1e521e160ddeed9009e47c93559b`; all eight prior mini-app download cohorts remain available. The independent MCP package remains `0.1.0-alpha.20`, with its own alpha30/alpha40 pins and existing download cohorts. Its archived identity was preserved rather than relabelled. The Names oracle still uses its existing snapshot.

## Verification actually executed

- Staged core build, API and nested MCP imports, and installed SDK version assertions passed.
- A real PostgreSQL backup restored into a disposable database passed the canonical migration coordinator twice. All 61 migration records and 98 existing tables were preserved. Migration 056 remains the baseline; this feature adds no migration.
- A new actual recovery snapshot was restored with the source key service unavailable. The original wrapped test key was recovered; four least-privilege denials, verified TLS and audit redaction passed. The source service resumed successfully. The alpha31 qualification expires **21 October 2026, 22:33 UTC** and remains explicitly same-VM development recovery.
- Public HTTPS network/version checks passed. All 154 candidate static files matched their served bytes, all seven module compatibility/code-hash checks passed, and the native runtime hash matched its retained baseline. Six current SDK/starter/MCP downloads matched their hashes; the previous mini-app release and independent MCP identity remain accessible.
- The existing public desktop/mobile regression passed account-entry journeys, Hub, Telos governance, Status/resources, Names quotes and DAO/module reads. There were no page exceptions, misplaced API requests or API server errors.
- An additional live desktop/mobile check opened the template catalogue, verified all twelve choices, filled a Code of Conduct draft and edited its text. No identity or HTTP fixtures were supplied. Anonymous publication and managed-document registration remained disabled, drafts stayed out of browser storage, and the DAO document sections loaded without page exceptions or API server errors.
- API, portal, PostgreSQL and existing recovery services remained active; the selected API reported zero restarts after deployment.

The companion [JSON](2026-10-15-dao-legal-templates-testnet.json) records hashes, commands, source references and result summaries. Private operational scripts, logs and rollback configuration remain in `/data/daclify-runtime/legal-templates-deploy-20261015/`. Roll back the API and frontend cohort together if needed; retain new native records and hosted objects. Do not restore the database or erase documents as an ordinary UI rollback.

## Limits

This deployment does not qualify mainnet, jurisdiction-specific legal suitability, independent recovery or every external wallet/provider. No new signed live publication, external wallet ceremony or actual storage-provider upload was performed during this rollout; those paths retain the earlier native/browser fixture evidence and its limits. Native code, native permissions, DAO policies and document records were not changed by the deployment. The server has roughly 650 MiB free; no unrelated retained releases or data were deleted.
