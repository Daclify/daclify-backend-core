# Upgrade to 0.6.0-alpha.1

This development update adds wallet-only account recovery and explicit vault attachment. Update core, modules and frontend together using matching 0.6 protocol/SDK/help artifacts. Contract interface remains 1. Relative to the tested 0.5 code, no C++ action/table layout or WASM changes are introduced; this upgrade does not require contract redeployment, authority changes, module repinning or new DAO creation. If starting from an older contract release, review its separate [0.5 upgrade procedure](upgrade-0.5.md) first.

## Preserve and prepare

1. Record the exact Git revisions, chain ID, runtime/Hub, deployed code/ABI hashes and configured module accounts. Back up PostgreSQL, private environment/provider configuration and encrypted content references outside the VM. Retain backup-decryption keys separately and rehearse a restore into an isolated database. User-controlled vault kits and recovery credentials remain each user's responsibility.
2. Review [disaster recovery](../disaster-recovery.md), including old signing-key rotation, per-user access and invalidating restored sessions. An optional old database dump preserves service UUIDs/pairings; a new empty database is also supported when those service records are intentionally not restored. Neither approach replaces deployed DAO contracts.
3. In three sibling checkouts using Node 24.21+/npm 11.19+ within the supported major versions, run `node tools/bootstrap.ts` from core. Regenerate changed docs in the producer before bootstrapping consumers. Use `--contracts` only when compiling changed contract source or preparing missing test artifacts. Never copy Mac `node_modules` to Linux.
4. Run each repo's `npm run verify`, `npm run build` and `npm run format:check`, core's isolated `npm run test:integration`, and the recovery regressions described below. Pin the reviewed revisions and artifact hashes. Development packaging does not publish or qualify production.

## Apply the service migration

Stop the old API and its content worker before updating its files. Keep the replacement service inaccessible until its schema and restore reconciliation are complete. Core's existing startup coordinator applies all pending migrations, including `015_wallet_accounts.sql`, before listening. An offline restore should apply the same coordinator without starting the API/worker, then run [revoke-restored-sessions.sql](../../tools/recovery/revoke-restored-sessions.sql) before service exposure. Do not run the whole API merely to migrate a stale archive with live workers.

Migration 015 preserves existing account IDs, non-null key pairs and login records. It permits both key fields to be null only for a user-controlled wallet-only profile, creates session-bound vault-attachment intents and enforces retention of a blockchain account-control credential. It does not overwrite vaults, rotate chain keys, replace memberships or reset jobs/payments. Applied migration hashes remain immutable.

Deploy the rebuilt frontend bundle with the matching API. `AccountSchema` now permits a wallet-only profile with `signingKey: null` and `encryptionKey: null`; older frontend/callers that assume strings are incompatible with that response. Keys are still required for public join identities and DAO creation. Do not roll the service back to 0.5 after wallet-only profiles have been written. Preserve the migrated database and use a reviewed forward fix if needed; no downgrade migration is provided.

## Check before exposing the service

- Verify the selected actual chain ID, existing DAO/member IDs, current roles/bindings, resources and compatible code hashes. Keep testnet/mainnet configuration and database credentials separate.
- With an existing vault account, sign in and verify its UUID, membership and paired methods. With an empty isolated database, prove control of a currently bound native wallet or Telos EVM EOA and verify its original on-chain member/role, explicit wallet-only label and absence of a new DAO fee.
- Import an original encrypted kit with its recovery credential and approve vault attachment using the wallet. Check that the recovered service UUID stays unchanged and that matching surviving private grants/content decrypt. New vault keys must not decrypt historical content or change an existing contract identity.
- Verify invalid/replayed/wrong-origin proofs, removed on-chain bindings and removal of the final wallet control credential are rejected. Native delegated authorities/waits and ERC-1271 wallets remain unsupported.
- Check `/docs/recovery`, `/docs/accounts`, `/status`, network selection and matching help/package versions in the actual deployed frontend. Reconcile payment/content jobs before enabling automation. Real Anchor/EVM clients and provider consent still need their own live qualification.

Core's `tests/integration/wallet-recovery.test.ts` creates an additional empty database and exercises real proof verification against fixture RPC data. `tests/native/paired-wallets.test.ts` exercises actual local contract bindings. Select frontend `tests/e2e/wallet-recovery.spec.ts` with a free `DACLIFY_TEST_UI_PORT` so Playwright cannot reuse an older app. The browser test uses HTTP/provider fixtures; it does not establish real wallet-client behavior. Actual test results and the public-testnet recovery check are in [recovery evidence](../evidence/2026-10-07-wallet-recovery.md).

Hosted acceptance additionally requires narrowly configured proxy trust, encrypted off-host automated backups, independently retained secrets, monitored backup freshness, durable encrypted content and a measured restore drill. Those deployment tasks are not fulfilled by merging source into main.
