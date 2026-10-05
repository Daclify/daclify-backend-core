# V2 Foundation Execution

This is the bounded executable foundation package within the master plan. Work occurs on `feat/v2-implementation` in three sibling worktrees. No production transaction, authority change or migration is included.

1. Record source/tool baseline and external gates in `docs/evidence/`.
2. Build the checksum-verified stable compiler/native image: `docker build --platform linux/amd64 -t daclify-v2-toolchain:4.1.1-spring1.2.2 -f tools/build/Dockerfile .`.
3. Initialize independent package manifests and locks with strict TS configuration and Vitest; frontend also uses Vue/Vite/template checks. Public artifacts are packaged from canonical schema/SDK source only.
4. Write protocol tests first: reject ambiguous DAO/asset identities, unsafe numeric values, overbroad module grants, incompatible versions, unknown schema fields and malformed content records. Run them red, then implement canonical runtime schemas and checked helpers.
5. Write C++ fixture tests first for DAO creation/isolation, native/internal authorization, nonce/expiry/domain replay and bounded configuration. Build actual WASM/ABI and run VERT. Exercise the same artifacts on the native chain, including permission and inline-action rejection.
6. Generate typed SDK action/table records and references from compiled ABI. Verify unchanged generation, schema examples, docs links and compatibility manifest; package artifacts for sibling consumers.
7. Scaffold the Vue application and its browser harness. Write vault/recovery and documentation/version UI tests before feature implementations. No provider credentials or plaintext secrets enter static output.
8. Extend the execution ledger with actual passed/failed/unrun checks and continue into ready domain packages. Provider and cross-runtime prerequisites remain capability gates, not fabricated passes.

Exact package commands are committed with the scripts that implement them. Live managed provider, Pinata/social integration, Telegram-client validation, EVM settlement and legacy deployment inventory remain separate evidence requirements; independent native/core work continues while access is pending.
