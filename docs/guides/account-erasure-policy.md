# Account erasure and retained settlement rights

Leaving a DAO, closing a DAO and deleting the hosted Daclify account are separate decisions. A member signs their own native departure. Deletion does not transfer, burn or donate treasury funds, claims or stake. A sole member may explicitly request closure; outstanding duties leave the DAO in its settlement-only closing state.

## Start and resume

In the portal, open **Account → Leave DAOs or delete account**. Review the current roles, claims, stake and outstanding duties before choosing leave-all or deletion. Each sole-member DAO offers a separate closure choice; selecting deletion does not silently close it. Leaving one DAO has its own signed button and keeps the hosted account.

Complete any private administrator handover before deletion: load the current policy and complete history, grant the selected eligible successor access, verify decryption in their own client, confirm recovery on another device, prepare and scan the native handover, then have that successor sign acceptance. Recorded native grants, client decryption and human recovery confirmation are different checks. A changed policy, epoch, recipient key or incomplete page invalidates the preparation.

Save the downloadable exit report and original recovery kit. Reopening or importing a report reads status without signing, sending a payment or recreating login. The report is bound to its operator API. If an initial response is lost, the locally saved pending capability recovers that same operation. Keep report files private.

Read `GET /v1/me/exit/preflight`, review every DAO and generate a random 32-byte status capability locally. Submit `POST /v1/me/exit` with the reviewed intent and capability using the existing fresh account-control ceremony. Its proof binds the current session, origin, audience, route, body and expiry. A paired sign-in is not this proof. Save the capability before sending: an unknown HTTP response must not lose report access.

The service stores its hash, freezes canonical and retired account ownership under ordered locks, revokes hosted sessions and app refresh families, and blocks new operational authority immediately. A leased worker removes disposable records in batches of at most 25 per class. A crashed or competing worker cannot claim another worker's completion. Hosted cleanup proceeds independently when the native chain or an app is unavailable.

`POST /v1/account-exit/status` accepts the status capability in the body and returns a no-store report for 30 days. It cannot authorize signing, publishing, spending or deletion. Keep it private; possession allows reading the report. It is not a login token. Reports distinguish hosted identity, native departures, current native profile rows, controlled key envelopes, independent apps, provider objects, backup expiry and retained shared evidence.

## Native steps and settlement

Every exit step uses the producer-owned instruction format, full native chain/runtime/DAO/member context, live nonce, expiry, operation commitment and step commitment. Root signatures use the distinct `daclify.account-exit.v1` domain. A linked native wallet can sign `exitnative` itself. The server never holds the member's Root private key.

Linked EVM wallets use the distinct `DaclifyExitInstruction` EIP-712 type, bound to the current wallet address, EVM chain, native binding epoch, operation and step. A saved Root kit can sign a narrowly permitted exit with its password without ordinary hosted login. The API currently verifies direct-key native authorities, including supported multisignature thresholds; delegated accounts and wait authorities require a separately qualified chain evaluation path.

The exact relayer packet and transaction ID are saved before delivery. Retries reconcile that identity against irreversible native receipts and retransmit only the identical unexpired packet. An uncertain or expired delivery is unresolved; it is never automatically replaced with a new nonce or financial event. A new reviewed step requires a fresh native check and signature. Native profile deletion is an idempotent own-member action; an envelope deletion alone does not prove that its current on-chain row was removed.

Claims and stake retain their immutable native member identity. The restricted settlement prepare/submit/receipt endpoints accept separately requested own-signed `withdraw` or `unstake` packets without a hosted account or ordinary login. Keep the existing recovery kit and native wallet credentials until those rights and duties are settled. Read-only report access is insufficient. Linked-wallet settlement uses its existing native authorized instruction path. These paths do not recreate the erased hosted UUID.

The portal persists a signed settlement packet before submission. After restart, explicitly check its receipt or retry that identical packet; a packet from another exit operation cannot be retried through the current report. Clearing the local vault is a separate deliberate choice after the report and usable claim credentials have been saved. Review native duties again before a later departure or closure because roles and liabilities may have changed while hosted cleanup proceeded.

## Data inventory

The worker fails closed if a new account foreign key or dependent foreign-key class lacks an inventory rule. Personal identifiers without those keys are explicitly covered too. Future MCP credentials must be added to the same inventory before deployment.

| Class | Handling and purpose | Expiry |
| --- | --- | --- |
| Root/encryption public keys, managed key wrappers, sessions, passkeys, provider/native/EVM links and login/recovery intents | Revoke authority, delete disposable proofs and clear account fields across every frozen alias | During bounded authenticated cleanup |
| Root-key challenges, unbound linked-mailbox challenges, recovery grants, app refresh-token descendants and disposable profile jobs | Delete before their parent keys/credentials disappear | During bounded cleanup; unowned challenges retain their existing short expiry |
| Personal credential/recovery/account audit entries | Delete personal subjects and credential pointers; shared content/financial evidence remains separate | During bounded cleanup |
| Unsubmitted temporary upload/asset reservations with no provider object | Delete the reservation and its disposable reconciliation job | During bounded cleanup |
| Published/shared DAO content, verified provider-object accounting, invoices, payments, archive holds and required settlement evidence | Preserve required shared rights and reconciliation; restrict access to its documented purpose | Object lifetime or settlement plus the applicable documented operator retention period |
| Current on-chain profile row | The member signs `delprofile`; actual receipt is reported separately | On confirmed native execution |
| Controlled profile key envelopes | Write an exclusion first, then delete the exact revision and wraps | Immediately; minimal exclusion lasts through the last controlled backup horizon |
| Controlled recovery provider pins | Preserve a minimal receipt until matching provider removal is reconciled | Finite 30-day exit reconciliation window; unavailable evidence remains disclosed |
| App subject mapping and step/status records | Only scoped cleanup and resumable exit reporting | 30 days; incomplete hosted minimization retains its necessary worker scope until it can finish |
| Erased account UUID anchor | No operational keys; retain only where a historical foreign key needs it | Bounded removal after status/controlled-backup expiry when no reference remains |
| Hosted DAO closure fence | Prevent new billing commitments racing final closure; no personal account fields | Native DAO's permanent retirement lifetime |

The generic inventory's financial retention wording is a qualification requirement, not a legal retention period. The operator must document the actual purpose, legal basis, access restrictions and expiry for each retained operation before a public production release. A UUID, wallet address or unlinking an author does not automatically anonymize identifiable records or free text.

## Hosted DAO closure

The existing configured hosting settler may acknowledge closure only after actual hosted reconciliation. A fixed DAO fence is written under the same advisory lock used by new billing inserts. Existing invoices, subscriptions, changes, pending orders/refunds/disputes and a connected merchant block acknowledgment. Provider reconciliation failures remain unavailable. Ordinary departure never cancels a DAO-wide subscription. Its deliberate cancellation/refund process remains separate; a paid service period may need to expire.

A zero receipt revokes a prior acknowledgment. The native contract checks the exact closing generation/current settler and consumes its acknowledgment at final closure. This is an operator attestation of hosted state, not native proof that a provider or independent app erased every copy. Installed modules separately supply their bounded current-code/generation closure proofs.

## Backups, restore and copies

Enable account erasure only with `ACCOUNT_EXIT_ENABLED=1`, a persistent owner-only `ACCOUNT_EXIT_EXCLUSIONS_DIRECTORY`, and `ACCOUNT_EXIT_MAX_BACKUP_AGE_SECONDS` matching the qualified maximum age of every controlled backup. The profile exclusion journal must also be configured when controlled profile envelopes exist. Neither journal belongs inside the ordinary SQL backup it protects. Apply both before a restored database can serve authentication or keys.

An exclusion contains minimal account UUIDs, operation ID, status hash and finite expiry. Restoring an earlier SQL snapshot blocks the old identities before service starts and recreates only the scoped cleanup/report work. It never silently repeats uncertain native actions. Keep exclusions through the last controlled backup horizon, including scheduler/expiry margin. Backup copies outside the qualified retention process invalidate that guarantee. Production qualification requires independent failure-domain evidence; a directory on the API host is not independent recovery.

The report says backup-expiry-pending until that recorded controlled horizon passes. Deleted current rows or controlled pins do not retract immutable public history, earlier public plaintext, downloaded keys, recipient copies or independently hosted backups. Do not claim “all data erased” or automatic GDPR compliance. Deliberate later enrollment creates a fresh UUID; it does not revive the erased identity, and there is no permanent personal-key blacklist.

## Independent app cleanup

See the [mini-app cleanup contract](mini-app-database-contract.md#cleanup-notices-and-restored-databases). Reports distinguish finite pending/unavailable notices, app operator acknowledgments and retained shared evidence. A missing legacy member/configuration binding is never reconstructed by guessing from the current account or an unpublished draft.
