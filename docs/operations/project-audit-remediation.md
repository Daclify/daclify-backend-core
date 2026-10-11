# Project audit fixes and service account rollout

Core/SDK `0.13.0-alpha.3`, modules `0.9.0-alpha.19` and frontend `0.13.0-alpha.3` are coordinated development artifacts. Runtime and Names WASM change; module WASM is unchanged. Existing action encodings and persisted table layouts remain compatible.

## Names

Ordinary 12-character undotted names remain first-party offers. Seller `regname`/`editname` rejects them; existing invalid basic-name rows are ignored during on-chain and API offer selection. Existing sales, references and liabilities are retained. Sellers can still remove their old unsold rows. New exact/suffix listings charge the authorizing seller's RAM; authorized edits move legacy listing storage to the seller. Purchases preserve the stored listing payer.

`GET /v1/names` returns at most 100 entries per inventory, with `listingsNext` and `suffixesNext`. Pass either cursor as `listingsCursor` or `suffixesCursor`. Cursors are canonical uint64 strings and the API rejects a non-advancing chain cursor. Browsing follows independent cursors; quotes use exact listing/suffix reads and do not load the whole catalogue. Frontend Load more controls retain previously displayed entries. Pricing still comes from a fresh quote before purchase.

Before deploying the new frontend/API, upgrade Names with the matching compiled WASM/ABI and reviewed executive authorization. Its hash is consumed by native purchase/card preflight; serving the new consumer against the old Names code can block purchases. Re-read pending sales/orders, preserve history, and verify normal and third-party offers after the coordinated rollout. A contract-only rollback would reintroduce the listing defect.

## Public API admission

`TRUSTED_PROXY_IPS` is a JSON array of extra exact trusted IPs. Default trust includes IPv4/IPv6 loopback. Configure the real final proxy peer, replace client-supplied forwarding headers at that proxy, and restrict direct access to the listener. The VM's observed peer is `192.168.5.1`; off-host configuration needs read-back verification before trusting it. Private address ranges and wildcard trust are rejected.

The user selected keeping the external HAProxy unchanged. Configure `SHARED_PROXY_IPS=["192.168.5.1"]` and leave this peer out of `TRUSTED_PROXY_IPS`. Shared peers use each anonymous route's existing aggregate allowance instead of the smaller single-client ceiling; all traffic still consumes the global limit. Other peers retain their original per-IP ceiling. Billing, recovery, account control and sponsored writes keep their authenticated account limits. Native/EVM challenge, passkey/email sign-in, Telegram OIDC, reports and branding reads all receive this configuration.

This does not recover visitor IP addresses: forwarding headers from that peer remain ignored, and anonymous visitors share aggregate protection. One abusive visitor can exhaust that aggregate allowance. Separate per-visitor IP enforcement would require a trusted address supplied by the proxy. Exact IP validation rejects wildcard/CIDR entries and a peer cannot be configured as both shared and trusted.

For a different deployment whose proxy does replace all forwarding headers and whose listener is restricted, `TRUSTED_PROXY_IPS` remains the supported alternative. The current testnet cutover requires no HAProxy edits.

`POST /v1/auth/challenge` admits 20 requests per client and 2,000 total per ten-minute window per API process, before SQL insertion. The API starts an auth maintenance worker that removes expired challenge rows in batches of at most 500 using the existing expiry index and `SKIP LOCKED`. Active challenges survive cleanup. Shutdown waits for the worker before closing the SQL pool. Replicas would need coordinated admission if this deployment expands beyond its current single API process.

Google verification needs only `GOOGLE_CLIENT_ID`. Signing keys come from the fixed official JWKS URL with bounded fetching, caching and rotation refresh. Remove obsolete fixed-key environment settings. Cryptographic regression tests do not qualify an actual provider browser ceremony.

## Relay and Fees

The live `daclifyrelay` and `daclifyfees1` accounts have no deployed code. The earlier seven-contract migration intentionally excluded them. Their current direct owner/active keys therefore remain in place until this separate service-account rollout is explicitly authorized. Fees holds actual testnet revenue; inspect authority changes with the same care as a treasury change.

The runtime now rejects an executive or creator recovery account whose owner/active can be authorized through core owner or active. The native regression first reproduced Fees becoming the sole executive under a circular core → Fees → core authority, then verified atomic rejection for both Fees and Relay and for delegated creator and executive owner/active through both core authorities. Upgrade the matching runtime before migrating these service authorities.

Proposed owner and active for both service accounts delegate to `daclifycore1@active`, preserving its configurable executive quorum. Neither gets an `eosio.code` contributor. Relay retains its existing operational public key in an `operator` child under active. Fees gets no operator child and no direct key in owner/active.

The reviewed Relay scope contains 20 links:

- Core: `submit`, `submitsess`, `submitevm`, `orderfree`, `ordercreate`, `cardcreate`, `createpaid`, `setcapacity`, `revokecap`, `resumecap`, `fulfilram`, `archattest`, `prunedocs`, `payob`.
- Names: `fulfillnet`.
- Decide: `finalize`, `execute`, `executeaward`, `prunevotes`.
- Payroll: `settle`.

These links cover current API submissions; they do not add governance or unchecked payout authority to contract logic. Transfers and system authority/link changes are outside the operator scope. `setcode`/`setabi` are linked to owner. Antelope allows an operator to rotate its own child authority; changing its parent or expanding linked actions still needs governing authority.

Prepare a fresh unsigned proposal:

```sh
npm run prepare:service-accounts -- .artifacts/service-accounts-testnet-review.json
```

The command has no private-key loader or broadcaster. It verifies the chain, current core release/governance authority, zero service-account code, existing key and permission/link shapes, and target action ABIs. It requires the patched runtime, records the current public permission snapshot and proposes 29 actions in one transaction. The combined audit preparer permits only the exact reviewed prior runtime as a prerequisite of its ordered runtime-upgrade proposal. Required current signing permissions are `daclifyrelay@owner` and `daclifyfees1@owner`. Re-run preparation immediately before signing and compare its snapshot with the reviewed state. No token transfer is part of this proposal.

For the coordinated audit rollout, `npm run prepare:audit-remediation -- .artifacts/project-audit-testnet-review.json` adds a runtime `setcode` action authorized by `daclifycore1@active`, followed by a Names `setcode` action authorized by `daclifynames@owner`. It verifies the reviewed prior runtime/Names code, matching compiled new hashes, unchanged serialized ABIs, and current governing authorities. It snapshots all Names tables with bounded advancing pages, records invalid legacy basic listings, and reads the fee balance. It also refreshes the existing Hub deployment’s runtime code/ABI hashes while preserving its owner, listing and metadata. The live Hub entry advertised stale hashes even before this upgrade. The testnet rejects both WASM binaries in one compressed transaction because their decompressed size exceeds its limit. The packet therefore contains a first transaction with only the runtime upgrade and a second transaction with Names, the Hub refresh and the 29 service-account actions. Confirm the first transaction is irreversible and recheck service preconditions before submitting the second. This produces 32 unsigned actions in two ordered transactions without loading keys, signing, broadcasting, spending tokens or changing runtime configuration. Recheck these preconditions and snapshots immediately before an expressly approved cutover.

Pause API writes and the price timer for the approved two-stage cutover. Coordinate the second transaction with `RELAY_PERMISSION=operator` and an API restart. Current default `active` remains compatible before migration. Applying the authority change while leaving the API at `active` breaks relay signing; changing configuration first also fails before the child exists. Verify free creation, a signed member instruction, resource/card attestations and module settlement after cutover. Executive quorum can repair Relay active or its operator child if service signing is interrupted.

Status shows service-role labels, No contract code, their actual permission trees and account resources. Its configured connections describe responsibility; they do not imply that the proposed governance delegation already exists. The service proposal is independent of immutable `nativegov.contracts` and does not manufacture contracts or restart the earlier handover.

## Fixtures and verification

Normal module fixtures must match the pinned core SDK's WASM and serialized ABI hashes. The loader rejects drift before executing module actions. Bootstrap refreshes matching producer fixtures even without `--contracts`; if producer binaries are unavailable, build them before contract tests. Old named upgrade fixtures remain separate.

Default core/module/frontend tests use one worker and a 20-second test budget based on this VM's measured workload. These settings address the earlier timeout failures without dropping cases. Native permission qualification includes Names admission/storage/pagination and service-account tests with real signatures and dummy DAOs/users/tokens. Full suite results are recorded in the release evidence, rather than inferred from targeted tests.

## Existing price updater

The approved oracle timer previously ran directly from the development checkout. New release pins caused it to fail against the still-deployed alpha.2 contracts during this work. Its existing, separately authorized observation service has been restored to an archived `cdc482a8e6e3683abece3fbc3a1594095e468067` source snapshot with the alpha.2 lockfile and artifacts at `/data/daclify-runtime/releases/oracle-alpha2/daclify-backend-core`. It retains the same oracle key, two action links and private environment; it does not change ownership or transfer assets. The approved audit cutover must switch it to an archived alpha.3 snapshot with matching code pins, then resume observations. Future development edits must not change the code expected by this deployed timer.
