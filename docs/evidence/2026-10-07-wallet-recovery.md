# Wallet disaster recovery evidence — 2026-10-07

Development version: core, modules and frontend 0.6.0-alpha.1. Antelope contract interface remains 1; no contract source/layout changes or public-chain deployments were made. Publication remains refused and the release remains unqualified.

## Verified behavior

- An empty PostgreSQL database accepts a fresh cryptographically verified native wallet proof or Telos EVM EOA SIWE signature only when the configured runtime has a corresponding current binding. It creates one wallet-only service profile under concurrent login, without claiming lost vault keys or creating a chain member.
- Wallet membership discovery ignores other DAOs sharing a signing key and rechecks current bindings. On-chain unlinking removes recovered access despite surviving sessions/database pairings. Invalid signatures, wrong chains, unavailable RPC, browser mismatch, replay and completion from another allowed frontend origin fail closed.
- Existing root key login reconstructs its authorized memberships independently. A wallet-only account cannot create a DAO without a proved vault identity or remove its last control credential. Concurrent removal of different final credentials leaves one working control path.
- Vault attachment requires fresh wallet control and incoming signing-key possession and preserves the recovered service UUID. The UI distinguishes governance recovery from decryption recovery, gates creation before checkout and aborts key unlock/CSRF replacement when the account changes during attachment.
- A recovered original private encryption key opens surviving encrypted epoch grants and document ciphertext on a fresh device. Replacement keys cannot open those grants.

## Commands and actual results

| Check | Result |
| --- | --- |
| Core npm run verify / build / format:check | Passed; 405 tests in 60 files; lint, TypeScript, generated docs and build passed |
| Modules npm run verify / build / format:check | Passed; 82 tests in 13 files; lint, TypeScript, generated docs and build passed |
| Frontend npm run verify / build / format:check | Passed; 95 tests in 22 files; source lint, Vue template/TypeScript checking and build passed |
| Core npm run test:integration with owned local test database | Passed; 97 tests in 12 files, including migration and recovery/session invalidation |
| Core npm run test:native -- tests/native/paired-wallets.test.ts | Passed; 2 tests against actual compiled contracts on local Antelope Spring, including a separate empty service database, native governance/key rotation and on-chain revocation |
| Frontend Playwright wallet-recovery.spec.ts at isolated UI port 5208 | Passed; 4 desktop/mobile Chromium cases; provider/RPC responses are UI fixtures, not live wallet-client qualification |
| Existing private Mac PostgreSQL 17 archive restore | Passed into an isolated database; migration 015 applied, administrator service UUID ea8725ba-243d-4dd4-8455-c9f6da55cbfe retained, restored sessions revoked; temporary database dropped |
| Actual Telos testnet empty-database login | Passed for 3boidanimus3 at daclifycore1, DAO 1/member 1: active/admin true, vault key fields null; zero on-chain transactions submitted; temporary database dropped |
| Final diff whitespace checks | Passed in all three worktrees |

Total: 685 test cases across the listed suites, plus the real archive and public-testnet recovery checks. Setup initially selected a stale native fixture and existing UI server; those checks were rerun against the owned native container and separate new UI server. The final frontend regression caught a Pinia dependency in ordinary vault login; the wallet context is now supplied explicitly. Test-first regressions reproduced missing recovery, last-control removal, cross-origin proof reuse and stale-account vault attachment before fixes.

## Limits and operations

Private signing keys/provider secrets were not printed or added to source. Live testnet validation used the locally configured deployer key only to sign an offline login proof; it did not submit a blockchain transaction. Existing Mac testnet services/database and on-chain DAO records remain in place.

Native login supports current direct-key active permission and weighted thresholds; delegated accounts/waits remain unsupported. EVM recovery supports EOAs on chains 40/41, not ERC-1271. Discovery covers the configured runtime; independently hosted DAOs need their original runtime configured. The read model scans DAO/member tables; a verified index is warranted when measured scale requires it.

Social pairings and service/payment/job history are PostgreSQL data. Their columns are not application-encrypted, and absent pairings cannot be inferred from blockchain state. Encrypted off-host automated backups, retained decryption/configuration secrets, durable IPFS copies and measured restore objectives are still operator deployment work. Managed/OpenBao custody and live Anchor/EVM browser/provider integrations retain their existing qualification gates. This source review does not certify the Hetzner deployment or its proxy/header trust configuration. The frontend retains its existing chunk-size warning; no unmeasured bundling refactor was added.

See [the recovery runbook](../disaster-recovery.md) and its reviewed session-invalidation SQL before a database restore is exposed.

## Development SDK SHA-256

- `daclify-core-protocol-0.6.0-alpha.1.tgz`: `385746687685c80d6b4cf66cdb6d52689898240ed95f3f6c287780fe31416749`
- `daclify-modules-0.6.0-alpha.1.tgz`: `b1a7fd854429c83062ad71759756cb601aaf9a97d92dc76873f222135c94f640`
