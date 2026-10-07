# Recovery documentation and integration checks — 2026-10-07

This record covers the documentation update after the [wallet recovery implementation](2026-10-07-wallet-recovery.md). Core/modules/frontend remain at unpublished development version 0.6.0-alpha.1, interface 1. The public website keeps its independent version. No C++ contract changes were introduced by this documentation update.

## What changed

- Recovery now explains the ten-member example, per-user current control paths, ordinary-member/admin boundaries, rotated signing keys, separate decryption keys, lost provider pairings and surviving database backups.
- Core, modules, frontend and website READMEs link to the current handbook/runbooks. Documentation indexes distinguish current instructions from dated plans/evidence. Current setup covers migrations 001–015, actual testnet creator, fees, supported module names, and the intended Netlify/Hetzner topology.
- The 0.6 upgrade guide preserves existing contracts and identities, requires compatible nullable-account consumers and explains migration/rollback limits. The recovery guide gives a runnable offline migration/session-invalidation command using existing coordinator/SQL, without API or worker startup.
- Producer-owned account/privacy/recovery/release guides were updated and regenerated. Public development packages and consumer lock integrities were rebuilt together. The prior recovery evidence and manifest retain their original revision/artifact hashes as historical snapshots; they are not hashes of this later documentation package.

## Actual verification

| Check                                                     | Result                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core `npm run verify`, `build`, `format:check`            | Passed; 405 tests in 60 files, source lint, TypeScript, generated-doc drift and build checks                                                                                    |
| Modules `npm run verify`, `build`, `format:check`         | Passed; 82 tests in 13 files, compiled-WASM tests, lint/types and generated-doc drift                                                                                           |
| Frontend `npm run verify`, `build`, `format:check`        | Passed; 95 tests in 22 files, source lint and Vue template/TypeScript checks; existing chunk-size warning remains                                                               |
| Core `npm run test:integration`                           | Passed; 97 tests in 12 files on an isolated owned loopback database, including wallet recovery, upgrade and session invalidation                                                |
| Frontend `wallet-recovery.spec.ts`, isolated port 5208    | Passed; 4 desktop/mobile Chromium cases with HTTP/provider fixtures and client proof checks                                                                                     |
| Website typecheck, tests, format and export drift         | Passed; 43 tests; exported files match the generated site                                                                                                                       |
| Documented offline migration/session-invalidation command | Passed on the isolated documentation database; 15 migrations applied, then the database was dropped                                                                             |
| Packed handbook render                                    | Recovery text, current package version, actual topic links and no horizontal overflow verified at 1440px/390px using an owned Vite process on 5210; HTTP/provider fixtures only |
| Markdown local file links                                 | 144 targets across the four repositories resolved; fenced code was excluded from Markdown parsing                                                                               |

Total: **726 test cases** in the listed automated suites, plus the offline operator-command and handbook-render checks. Native/public-testnet recovery and the actual private archive restore were verified during the earlier implementation and are recorded there; they were not repeated for this prose update. The handbook fixture initially returned an invalid anonymous `/me` response and omitted the assistant configuration endpoint; its fixture was corrected and the render check rerun. This was a fixture correction, not an application change.

## Development artifacts

- `daclify-core-protocol-0.6.0-alpha.1.tgz` SHA-256: `32e5e06949b64ea1c0d8e128c951c82bc155d557d47457bbfb4e2eb188dbbbe4`
- `daclify-modules-0.6.0-alpha.1.tgz` SHA-256: `939c0bcf8d51e638a8d070fb2c9f5a69ead2c486e7d5942ad44dabe583e8f1e2`

These are rebuilt unpublished development packages. Published artifact bytes must never be replaced under an existing version. The separate development manifest pins the later documentation/source revisions; publication remains refused and qualification false.

## Remaining operating work

The Hetzner host, HAProxy forwarding-header/client-IP trust, certificate renewal, off-host encrypted automated backups, independent backup secrets, durable encrypted content and measured restore objectives need their own deployment verification. Real provider consent, Google browser integration, real Anchor/EVM clients and managed OpenBao custody retain their existing gates. A current README, mock browser pass or Git main merge does not establish those external properties.
