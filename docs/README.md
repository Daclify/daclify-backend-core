# Daclify V2 documentation

Start with the repository [README](../README.md), then [development checkouts and tests](development.md) and [operations](operations.md). Operations is the current procedure for develop, testnet, and production accounts, Stripe Checkout, the TLOS quote, and the frontend network switch.

## Plan and evidence

These planning documents are the acceptance register. They are not rewritten when a later change lands, and a feature described here is not complete until its package is accepted.

- [Master plan](superpowers/plans/2026-10-05-daclify-v2-master-plan.md)
- [Architecture](superpowers/specs/2026-10-05-daclify-v2-architecture.md)
- [Work packages](superpowers/plans/2026-10-05-daclify-v2-work-packages.md)
- [Foundation plan](superpowers/plans/2026-10-05-daclify-v2-foundation-plan.md)
- [Evidence and risks](superpowers/plans/2026-10-05-daclify-v2-evidence-and-risks.md)
- [Versioning, documentation, Pinata, and test policy](superpowers/plans/2026-10-05-daclify-v2-release-docs-test-policy.md)
- [Implementation limits](evidence/implementation-limits.md)
- [Execution ledger](evidence/execution-ledger.json)

## Generated reference and guides

`npm run docs:generate` writes `docs/generated/reference.md`, `docs/generated/reference.json`, and `protocol/generated/help.ts` from `docs/guides/topics.json`, the compiled ABI, and the API schemas. `npm run docs:check` fails if those files drift. Do not hand-edit the generated files.

The guides are explanatory product text. The reference is structural. Contract rules still live in the C++ and in the tests. The frontend Docs screen shows the guide bundle that was packed into `@daclify/core-protocol`. A guide edited here appears in the app after the local protocol package is rebuilt and the frontend reinstalls it.

Core owns the shared architecture, the common guides, and the cross-repository release manifest. The modules repository owns its behavior guides and generated module reference. The frontend owns presentation of those bundles and the user journeys.

## Custody note

[Custody decision](decisions/custody.md) records the OpenBao development boundary. Local OpenBao checks are not a production custody qualification.
