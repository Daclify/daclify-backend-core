# Upgrade to 0.7.0-alpha.1

This records the named earlier upgrade. For the current development candidate and exact live/staged boundary, see [audit remediation](project-audit-remediation.md) and [its verification](project-audit-remediation-verification.md). Earlier version-specific instructions still apply when migrating from that version.

Update core, modules and frontend together. Update configured `MODULE_DEPLOYMENTS` release versions to the matching 0.7 module package while retaining reviewed existing module WASM hashes; otherwise the frontend correctly holds incompatible module actions. This development update adds free shared creation, graduated member-capacity subscriptions, optional DAO Stripe Connect and Hub-discovered independent portals. Contract interface remains1; the runtime WASM/ABI changes, while pre-0.7 serialized tables and module WASM remain unchanged. The new capacity/receipt tables are not present in 0.6. Never infer deployed compatibility from the API version alone.

## Prepare

Record exact revisions, deployment/chain IDs, public code and binary ABI hashes, native authorities and module pins. Back up PostgreSQL and private provider/operator configuration off-host, retain backup decryption keys separately, and rehearse a restore. Keep each member's vault kit, credential and original document-decryption keys. Read [disaster recovery](../disaster-recovery.md) and [payment operations](connected-payments.md).

Build/check the three sibling repositories locally with Node 24.21+/npm 11.19+ within supported major versions. Run producer doc generation before `node tools/bootstrap.ts`; `--contracts` rebuilds C++ with the verified local toolchain. Review the generated artifacts and development manifest. No GitHub build/test CI or automatic deployment is required.

## Native runtime and permissions

A reviewed operator deploys the exact new runtime WASM and ABI to the existing runtime account. Do not create replacement DAO/member IDs or overwrite governance/token/document data. Update the existing `execctx` permission plan from `tools/deploy/permissions.ts`, adding `govpayfees`, `govhosted` and `govseatfee` action links. The permission contains runtime `eosio.code`, no relayer key. Retain the existing native upgrade authority and module pins. Newly registered independent runtimes advertise exact WASM and binary-ABI hashes in their Hub registration; re-register after an approved upgrade.

Use existing platform governance to sign `govhosted` with free_members 10 and the configured settler, `govseatfee` with first_usd 100, next_usd 50 and rest_usd 20, and optionally `govpayfees` with bps 500. Bootstrap-only fixtures can call `sethosted`. These controls use current platform administrator authority; a member ballot does not automatically execute them. Configuration must agree with server relay/settler settings. Mainnet/testnet runtime upgrades are separate operator actions and were not performed by this implementation.

## API, database and frontend

Stop the old API/workers before replacing files; migrate offline or through the existing guarded startup coordinator while the service is inaccessible. Migrations 016–021 preserve earlier records and add immutable merchant/hosting/operator snapshots. Never modify already applied migration bytes. No downgrade migration is provided; use a reviewed forward fix after new payment records exist.

Set `API_PUBLIC_ORIGIN` to the browser-visible API origin. With the local relative Vite proxy it is the browser origin; with a direct public API it is that HTTPS API origin. Login, vault-attachment, account-control and wallet challenges now bind an explicit API issuer. Outstanding v1 challenges must be restarted. Existing vaults and chain bindings do not rotate. Deploy matching frontend and protocol artifacts before exposure.

Hosting and Connect are independently optional. Missing provider configuration does not block free creation after native hosting configuration. Live charging defaults off. Configure separate platform and connected-account webhook destinations and secrets. Independent servers use only their DAO-scoped broker token, their own database and provider login setup; central merchant administration requires a separate central account-control session. See [payment operations](connected-payments.md) and app `/docs/independent-operators`.

## Verify and recover

Run all repo verify/build/format checks, generated-doc checks, core's isolated PostgreSQL integration suite, compiled-WASM tests, the owned native payment test and frontend `npm run test:e2e:payments`. The browser payment suite uses HTTP fixtures; it is not live Stripe qualification. Replay, wrong-account/issuer/code, removed roles, invoice/refund and uncertain-response checks must fail safely. Existing membership remains usable after capacity expires.

Back up the merchant account mapping, Stripe agreement/order/invoice IDs, immutable pricing/consent, job receipts, broker hashes and local customer ownership. Chain capacity does not reconstruct a recurring Stripe subscription or social pairings. After total database loss, disable payment creation/workers until a verified backup or explicit provider reconciliation restores these mappings; never automatically create replacement subscriptions. Rotate broker credentials after restoring sessions/keys. Retain the old [0.6 recovery guide](upgrade-0.6.md) for its per-user key behavior.


## Receiving-wallet preparation update

The development runtime requires an existing token balance row for every native payout destination, including fee treasuries and module publishers. Review this behavior before upgrading: a previously unprepared destination now leaves its payment pending instead of charging the sender for a new receiving row. All state changes roll back on refusal. Deploy the matching UI/help so recipients can use **Prepare receiving wallet**, then sign their withdrawal separately.

Keep the standard token contract and exact symbol/precision fixed for a DAO. Before funding a new runtime, open its supported token row under runtime authority and account for that operator infrastructure in the native baseline. `open` does not change the payer of an existing row; historical sender ownership needs separate inspection/qualification. No token closure, asset transfer, payer repair or public upgrade is automatic. See [token-row operating bounds](../ram-accounting.md#receiving-wallet-token-rows).
