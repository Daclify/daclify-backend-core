# Changelog

## 0.6.0-alpha.1 — Wallet disaster recovery

Wallet recovery after service database loss; per-DAO live native/EVM bindings and explicit wallet-only accounts. Dual-proof vault attachment preserves the recovered service ID. SQL migration 015 preserves existing accounts and rejects last-control removal. Includes restore-session invalidation, generated recovery help and failure/concurrency tests.

Development prerelease; production release gates remain in force.

## 0.2.0-alpha.1 — DAO presets and guarded agents

- Versioned DAO purpose presets and metadata schema 2, retaining schema 1 readers.
- Contract-enforced ballot policy, commitment budgets and separate guardian controls.
- Agent admission, scoped credentials, revocation and signing recovery.
- Atomic preset creation, governance read API, scoped relaying and bounded Works execution.
- Generated references, explanatory guides and a provider-neutral public publishing example.
- Combined marketplace/name integration, with distinct setdaogov and setgov actions and reviewed module catalogue fixtures.

Development prerelease. Existing production release gates remain in force.
