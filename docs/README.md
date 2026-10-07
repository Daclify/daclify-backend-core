# Daclify documentation

Current development version: **0.7.0-alpha.1**, contract interface 1. This is a development checkpoint; immutable publication, live provider/client qualification and hosted operations remain separate gates.

## Start with the task

| Task                                                        | Guide                                                                                                                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand the repository split and capabilities            | [Core README](../README.md), [modules README](https://github.com/Daclify/daclify-backend-modules/blob/main/README.md), [frontend README](https://github.com/Daclify/daclify-frontend/blob/main/README.md) |
| Install, build and test sibling checkouts                   | [Development](development.md)                                                                                                                                                                             |
| Configure networks, providers, payments and hosted services | [Operations](operations.md)                                                                                                                                                                               |
| Pair login credentials or activate wallet governance        | [Paired login](operations/paired-login.md)                                                                                                                                                                |
| Recover a member, vault or service after loss               | [Disaster recovery](disaster-recovery.md)                                                                                                                                                                 |
| Configure DAO payments or shared subscriptions              | [Connected payments](operations/connected-payments.md), [Upgrade0.7](operations/upgrade-0.7.md)                                                                                                           |
| Upgrade an existing 0.5 service                             | [Upgrade to 0.6](operations/upgrade-0.6.md)                                                                                                                                                               |
| Review the earlier contract/module upgrade                  | [Upgrade to 0.5](operations/upgrade-0.5.md)                                                                                                                                                               |
| Resolve paid creation incidents                             | [Paid creation incidents](operations/paid-creation-incidents.md)                                                                                                                                          |
| Understand purpose presets, agents and authority            | [DAO presets](dao-presets.md)                                                                                                                                                                             |
| Inspect exact API/action/table/configuration shapes         | [Generated core reference](generated/reference.md), [module reference](https://github.com/Daclify/daclify-backend-modules/blob/main/docs/generated/reference.md)                                          |

The app exposes these product guides at `/docs/:topic`, including `/docs/accounts`, `/docs/providers`, `/docs/recovery`, `/docs/documents`, `/docs/deployments` and `/docs/platform`. Its intended hosted destination is [app.daclify.com/docs](https://app.daclify.com/docs); this link does not certify a deployed app. `/status` reports safe configuration and chain details; configured providers are not qualified integrations.

## Documentation ownership and generation

Core owns shared guides, architecture, operational runbooks and cross-repository manifests. Modules owns module behavior/configuration guides and its generated reference. Frontend renders both packed bundles and owns presentation/UX documentation. The public website owns promotional English, Spanish and Polish content, with links to the app handbook.

Edit `docs/guides/topics.json` for product explanations. `npm run docs:generate` produces `docs/generated/reference.md`, `docs/generated/reference.json` and `protocol/generated/help.ts` from those guides, canonical API schemas and compiled ABIs. `npm run docs:check` rejects drift; never hand-edit generated files. Reference schemas describe structure; authorization and runtime refinements still depend on source and tests.

After changing a guide, regenerate it, rebuild the public development packages and reinstall the consumers through core's sibling bootstrap. Otherwise the API assistant and frontend can continue showing the old packed help. See [development](development.md). Published package bytes must never be replaced under an existing version; current development tarballs are explicitly unpublished.

Stable topic IDs are UI routes and contextual links. `release-0.5` is retained as a compatible topic ID even though its text now explains the current release. The bundles display package and interface versions. Contract module hashes are checked separately; a displayed service version is not proof of deployed runtime provenance.

## Evidence and unresolved qualification

- [Recovery documentation checks](evidence/2026-10-07-recovery-documentation.md): regenerated handbook, README/runbook consistency and the current documentation verification.
- [Wallet recovery evidence](evidence/2026-10-07-wallet-recovery.md): actual empty-database access, original-key decryption, archive restore, local native behavior and read-only Telos testnet proof.
- [Research implementation evidence](evidence/2026-10-07-research-execution.md): paired login, governance, grants, endorsements, elections and reporting.
- [Engineering audit](evidence/2026-10-07-engineering-audit.md), [access fixes](evidence/2026-10-07-access-fixes.md), [testnet deployment](evidence/2026-10-07-telos-testnet.md) and [provider smoke checks](evidence/2026-10-07-support-telegram.md).
- [Custody decision](decisions/custody.md): OpenBao candidate and unresolved durable signing/decryption recovery. Managed accounts remain unavailable.
- [Compatibility register](releases/compatibility.json) and dated development manifests in `releases/`: pinned revisions/hashes, with publication refused and qualification false.
- [Historical implementation limits](evidence/implementation-limits.md): retain dated findings; use subsequent evidence and current runbooks to determine what remains open.

Local/mock checks do not certify real browser wallet clients, SMTP delivery, provider consent, mainnet deployment, backup operations or proxy trust. The recovery runbook lists required off-host backups, decryption-key retention, content durability and restore drills.

## Plans and historical records

These record design decisions and acceptance criteria. They are not a substitute for current source, runbooks or dated verification evidence; a planned capability is not automatically implemented.

- [Master plan](superpowers/plans/2026-10-05-daclify-v2-master-plan.md)
- [Architecture](superpowers/specs/2026-10-05-daclify-v2-architecture.md)
- [Work packages](superpowers/plans/2026-10-05-daclify-v2-work-packages.md)
- [Foundation plan](superpowers/plans/2026-10-05-daclify-v2-foundation-plan.md)
- [Evidence and risks](superpowers/plans/2026-10-05-daclify-v2-evidence-and-risks.md)
- [Versioning, documentation, Pinata and test policy](superpowers/plans/2026-10-05-daclify-v2-release-docs-test-policy.md)
- [Module/login implementation plan](superpowers/plans/2026-10-07-modules-and-paired-login.md)
- [Wallet recovery plan](superpowers/plans/2026-10-07-wallet-disaster-recovery.md)
- [Execution ledger](evidence/execution-ledger.json)

## Connected payments and hosting

See core [payment operations](../docs/operations/connected-payments.md) and app `/docs/shared-hosting`, `/docs/payments`, `/docs/independent-operators`. Independent API discovery now has issuer/code/ABI and current-registration checks; actual operator browser cookies and external providers still need qualification.

[Connected payment verification](evidence/2026-10-08-connected-payments.md) records the current 0.7 local/native/PostgreSQL/browser checks and actual outstanding provider/deployment qualification.
