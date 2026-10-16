# Daclify documentation

Start with what you want to do. The [shared testnet handbook](https://testnet.app.daclify.com/docs) contains the member/admin guides; [current status](current-status.md) separates implemented features, enabled deployment capabilities and unfinished production qualification. Source versions live in producer package manifests and generated help, while `/v1/network` identifies the connected API.

## Community members and DAO administrators

| Task | Guide |
| --- | --- |
| First visit, account, joining and approvals | [Start here](https://testnet.app.daclify.com/docs/start-here), [Accounts](https://testnet.app.daclify.com/docs/accounts), [Approval setup](../../daclify-frontend/docs/approval-setup.md) |
| Admit members and understand permissions | [Members](https://testnet.app.daclify.com/docs/members), [Governance](https://testnet.app.daclify.com/docs/dao-governance) |
| Vote, arrange work or manage money | [Decide](../../daclify-frontend/docs/users/decide.md), [Works](../../daclify-frontend/docs/users/works.md), [Treasury](https://testnet.app.daclify.com/docs/treasury) |
| Publish or recover private documents | [Documents](https://testnet.app.daclify.com/docs/documents), [Recovery](disaster-recovery.md) |
| Run encrypted up/down consultations | [Quick ballots](quick-ballots.md): audience, readers, proof and 30-day archive policy |
| Create a DAO from an invitation | [DAO claim links](dao-claim-links.md) |
| Draft legal documents from templates | [Documents handbook](https://testnet.app.daclify.com/docs/documents), [template source and maintenance](../../daclify-frontend/docs/legal-templates/README.md) |
| Connect or register a mini app | [Connected apps](connected-community-apps.md), [Mini-app handbook](https://testnet.app.daclify.com/docs/connected-apps) |
| Understand costs and storage | [Pricing](https://testnet.app.daclify.com/pricing), [DAO pricing](operations/dao-pricing.md), [Resources](https://testnet.app.daclify.com/docs/resources-and-retention) |

The handbook groups guides into Getting started, Members & governance, Modules & treasury, Costs & storage, Privacy & recovery, Mini apps & builders, and Operators & reference. Topics have stable `/docs/:topic` links. Use the matching deployment's guides and review version/code warnings before signing.

## Mini-app builders and integrators

1. [Register and connect an app](connected-community-apps.md): administrator/module/signer prerequisites, exact callbacks, trusted matching downloads and receipt confirmation.
2. [Design the app database](guides/mini-app-database-contract.md): pairwise subjects, full DAO bindings, transactions, outbox retries, privacy and restore.
3. [Use the runnable recipe](../examples/community-mini-app/README.md) and [mini-app design example](examples/community-mini-app-design.md).
4. [Connect a community MCP harness](guides/community-mcp.md): scoped delegates, supported tools, explicit consent and harness qualification limits.

A directory listing is separate from native app registration. Each app owns its hosting/database; registration grants neither treasury authority nor automatic payment.

## Contributors and operators

| Task | Source |
| --- | --- |
| Install/build/test sibling repositories | [Development](development.md) |
| Configure services or publish the dev app | [Operations](operations.md), [workspace publication](../../daclify-frontend/docs/workspace-testnet.md), [historical Hetzner checkpoints](../ops/hetzner/README.md) |
| Configure payments or hosting | [Connected payments](operations/connected-payments.md) |
| Diagnose paid creation or Names | [Paid creation incidents](operations/paid-creation-incidents.md), [Names updater](operations/names-oracle.md) |
| Restore service/key data | [Disaster recovery](disaster-recovery.md), [recovery setup](../ops/recovery/README.md) |
| Fund gateway access or renew IPFS services | [Gateway allowance](operations/gateway-allowance.md), [testnet IPFS](operations/testnet-ipfs.md) |
| Inspect exact schemas/actions | [Generated core reference](generated/reference.md), [module reference](../../daclify-backend-modules/docs/generated/reference.md) |
| Qualify an immutable release | [Release qualification](operations/release-qualification.md) |

Historical upgrades remain version-specific: [0.5](operations/upgrade-0.5.md), [0.6](operations/upgrade-0.6.md), [0.7](operations/upgrade-0.7.md), [0.8](operations/upgrade-0.8.md), [0.9](operations/upgrade-0.9.md). Use their recorded prerequisites when upgrading those releases, rather than treating their versions as today's deployment.

## Documentation ownership and generation

Core owns shared guides, architecture, operational runbooks and cross-repository manifests. Modules owns module behavior/configuration guides and its generated reference. Frontend renders both packed bundles and owns presentation/UX documentation. The public website owns promotional English, Spanish and Polish content, with links to the app handbook.

Edit `docs/guides/topics.json` for product explanations. `npm run docs:generate` produces `docs/generated/reference.md`, `docs/generated/reference.json` and `protocol/generated/help.ts` from those guides, canonical API schemas and compiled ABIs. `npm run docs:check` rejects drift; never hand-edit generated files. Reference schemas describe structure; authorization and runtime refinements still depend on source and tests.

After changing a guide, regenerate it, rebuild the public development packages and reinstall the consumers through core's sibling bootstrap. Otherwise the API assistant and frontend can continue showing the old packed help. See [development](development.md). Published package bytes must never be replaced under an existing version; development bundles already in use remain immutable even when they are not published to a package registry. Advance the producer version when their bytes change.

Stable topic IDs are UI routes and contextual links. `release-0.5` is retained as a compatible topic ID even though its text now explains the current release. The bundles display package and interface versions. Contract module hashes are checked separately; a displayed service version is not proof of deployed runtime provenance.

Use [current status](current-status.md) for the latest dated checkpoint; [audit remediation](operations/project-audit-remediation.md) records its reviewed coordinated update; [upgrade 0.8](operations/upgrade-0.8.md) remains the historical resource migration, [release qualification](operations/release-qualification.md) for immutable packaging, and the [acceptance record](evidence/2026-10-09-resource-completion.md) for actual checks and remaining external dependencies.

## Evidence and unresolved qualification

- [Maximum content privacy design](superpowers/specs/2026-10-16-maximum-content-privacy-design.md) and [implementation plan](superpowers/plans/2026-10-16-maximum-content-privacy.md): proposed confidential identity, setup/invitations, ballot content and module labels; not yet implemented or enabled. The [separate Telos EVM privacy proposal](proposals/2026-10-16-telos-evm-privacy.md) investigates shielded payments and their public entry/exit limits.
- [Three-repository security audit](evidence/2026-10-11-security-audit.md): four reproduced API resource-limit bypasses repaired, local/native verification and remaining development-dependency/provider qualification limits.
- [Native RAM and history simulation](evidence/2026-10-08-ram-history-simulation.md): measured 200 shared DAOs/40,000 active memberships, growth projections and proposed archive-before-prune safeguards.
- [Recovery documentation checks](evidence/2026-10-07-recovery-documentation.md): regenerated handbook, README/runbook consistency and the current documentation verification.
- [Wallet recovery evidence](evidence/2026-10-07-wallet-recovery.md): actual empty-database access, original-key decryption, archive restore, local native behavior and read-only Telos testnet proof.
- [Research implementation evidence](evidence/2026-10-07-research-execution.md): paired login, governance, grants, endorsements, elections and reporting.
- [Engineering audit](evidence/2026-10-07-engineering-audit.md), [access fixes](evidence/2026-10-07-access-fixes.md), [testnet deployment](evidence/2026-10-07-telos-testnet.md) and [provider smoke checks](evidence/2026-10-07-support-telegram.md).
- [Custody decision](decisions/custody.md): OpenBao candidate and unresolved durable signing/decryption recovery. Production independent recovery remains unqualified; shared testnet assisted recovery is an explicitly disclosed development mode.
- [Compatibility register](releases/compatibility.json) and dated development manifests in `releases/`: pinned revisions/hashes, with publication refused and qualification false.
- [Historical implementation limits](evidence/implementation-limits.md): retain dated findings; use subsequent evidence and current runbooks to determine what remains open.

Local/mock checks do not certify real browser wallet clients, SMTP delivery, provider consent, mainnet deployment, backup operations or proxy trust. The recovery runbook lists required off-host backups, decryption-key retention, content durability and restore drills.

## Plans and historical records

These record design decisions and acceptance criteria. They are not a substitute for current source, runbooks or dated verification evidence; a planned capability is not automatically implemented.

- [Master plan](superpowers/plans/2026-10-05-daclify-v2-master-plan.md)
- [Governance hardening plan](superpowers/plans/2026-10-08-governance-hardening.md): qualification, ballot integrity, DAO module selection, arbitration and election methods.
- [Architecture](superpowers/specs/2026-10-05-daclify-v2-architecture.md)
- [Connected community apps design](superpowers/specs/2026-10-11-connected-community-apps-design.md): several apps per public or private DAO, member authorised completions, compact native records and protected IPFS evidence; see the current app guide and live capability response for availability.
- [Work packages](superpowers/plans/2026-10-05-daclify-v2-work-packages.md)
- [Foundation plan](superpowers/plans/2026-10-05-daclify-v2-foundation-plan.md)
- [Evidence and risks](superpowers/plans/2026-10-05-daclify-v2-evidence-and-risks.md)
- [Versioning, documentation, Pinata and test policy](superpowers/plans/2026-10-05-daclify-v2-release-docs-test-policy.md)
- [Module/login implementation plan](superpowers/plans/2026-10-07-modules-and-paired-login.md)
- [Wallet recovery plan](superpowers/plans/2026-10-07-wallet-disaster-recovery.md)
- [RAM, prepaid storage and archives plan](superpowers/plans/2026-10-08-resource-billing-and-archives.md)
- [Archive export operations](archive-exports.md): reservations, restart recovery, standalone integrity/encrypted-backup restore verification and outstanding native approval/pruning gates.
- [RAM observation](ram-accounting.md): per-DAO/module counters, purchased credits, native account totals and unfinished funding/enforcement gates.
- [Execution ledger](evidence/execution-ledger.json)

## Connected payments and hosting

See core [payment operations](../docs/operations/connected-payments.md) and app `/docs/shared-hosting`, `/docs/payments`, `/docs/independent-operators`. Independent API discovery now has issuer/code/ABI and current-registration checks; actual operator browser cookies and external providers still need qualification.

[Connected payment verification](evidence/2026-10-08-connected-payments.md) records the current 0.7 local/native/PostgreSQL/browser checks and actual outstanding provider/deployment qualification.

## Source and license

The application, contract, SDK and first-party module repositories use
[AGPL-3.0-only](../LICENSE). Read [licensing guidance](../LICENSING.md) before
redistribution, hosting modified versions or combining modules. The app exposes
this guidance at `/docs/license`; operators must offer their actual deployed source.


Resource checkpoint: [RAM accounting, native/card purchases and operator reserve](ram-accounting.md) describes the current implementation and launch gates. DAO Resources exposes native one-time purchases and optional exact-price card checkout, prepaid pinned-storage capacity and verified archive exports. Included pools, new obligation receipt holds, native archive approval/pruning and empty-database history recovery are implemented in development and have bounded owned-fixture verification. Complete completion/external-token qualification, general legacy backfill and live guarded-cleanup/provider proof remain release gates; automatic deletion and release packaging stay disabled.

The [documentation assistant and Telegram group runbook](operations/docs-assistant.md) explains backend-only model configuration, docs-only scope, approved-group webhooks, privacy mode, cost limits and at-most-once reply delivery. App AI needs an OpenRouter key; Telegram chat additionally requires explicit chat allowlists, enablement and webhook registration.

## Current audit and documentation review

The [16 October documentation audit](evidence/2026-10-16-documentation-review.md) records the latest cross-repository corrections and separates historical plans from current capabilities.

The [remediation guide](operations/project-audit-remediation.md) connects the six confirmed fixes, service-account migration, unchanged external proxy and coordinated runtime/API/frontend cutover. [Source verification](operations/project-audit-remediation-verification.md) records local/native/read-only-chain evidence; [2026-10-11 testnet rollout](evidence/2026-10-11-project-audit-testnet-rollout.md) records the expressly approved irreversible transactions and public desktop/mobile checks. The [documentation review](evidence/2026-10-10-project-documentation-review.md) records stale guidance corrected across all three current repos and separates historical checkpoints from deployed state. The compatibility register remains unqualified; these changes do not close provider or production release gates.

- [Unified Users and DAO activity](operations/unified-users.md): public identity aggregation, legacy activity initialization, bounded RAM and coordinated testnet cutover.

- [Telos governance entry and operator setup](telos-governance.md).

See [monthly module access](operations/module-fees.md) for governed prices, the free tier and manual calendar-month renewal, and [the testnet qualification](evidence/2026-10-11-monthly-module-fees.md) for the actual sandbox payment/refund, native threshold and live encrypted-document results.
