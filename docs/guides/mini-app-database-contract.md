# Mini-app database and identity contract

These requirements apply whenever an app uses Daclify accounts, regardless of its database or framework. Daclify verifies identity/membership and records selected receipts; the app operates its own database and business permissions. A hosted mini-app database service is outside this release. SQLite and PostgreSQL recipes must demonstrate the same behavior before being labelled supported.

## Bind the database before accessing records

Persist a versioned binding containing chain ID, runtime, DAO ID, app ID, identity issuer and registered client ID. Compare every field with the configured connection on open. A dedicated SQLite database has one binding; shared PostgreSQL storage includes its full binding namespace in every query, unique key and foreign key. A mismatch refuses access before returning tasks or pending events.

Configuration changes are explicit migrations with a backup and verified original binding. A nonempty legacy database without metadata must not silently adopt whichever DAO starts the app first. Legacy rows do not prove their missing chain/DAO/issuer/client; the explicit adoption operator must confirm the original trusted deployment configuration and verify the original actor mappings before migration. Preserve native identifiers as validated decimal strings or a database representation supporting their full uint64 range. Never convert them through JavaScript `Number`.

## Derive the actor from current verified access

The app verifies the credential using the configured Daclify issuer/client and current membership. Construct the actor from the verified pairwise subject and complete chain/runtime/DAO/member reference. Request-supplied member numbers, names, email, assignee IDs and saved role projections cannot establish authority. Validate the actor's binding before reads, writes, evidence retrieval or receipt reconciliation.

The Daclify account UUID, app subject and native member ID serve different purposes. Subjects are scoped to a registered client. Two DAOs may each have member `1`; they must never read or change each other's records. A subject changes only through verified relinking or an explicit migration, never because another credential has a matching name or email. Do not copy Daclify login pairings, account root keys or passwords into the app.

Check current membership/app policy for each protected operation. Login grants no recording, review, vote, spending or decryption authority. A recording grant is a separately approved native capability with an expiry and app/DAO/action scope. Review and local result application recheck their own policy. Losing a browser delegate requires renewed consent; a backend cannot create a fresh member signature.

## Commit local changes and frozen events together

Use one database transaction for the business change and durable outbox insertion. Freeze the source revision, authorized actor, event identity and selected evidence requirement. An outbox failure rolls back the business change. Repeated completion and restart retrieve the original frozen intent even after a later source edit.

For general apps, uniqueness identifies the binding, logical source operation and applicable revision. A booking and its later cancellation are distinct events; a retry of one event is the same event. The one-completion garden task example deliberately allows one completion per task and must not impose that schema on every mini app.

Concurrent writes use database locking/conditional revisions and uniqueness constraints. Reconcile uncertain native delivery by the exact event/source/revision/receipt before signing a replacement. Background jobs can deliver unchanged signed bytes; they cannot extend a grant, modify a signed revision or manufacture approval. Apply a confirmed review only to its exact submitted source revision.

## Recovery and migration

Persist task/outbox schema versions. Test clean setup, supported upgrades, interruption and restore with pending work. Back up the database, actual photos/files and required surviving encryption envelopes; a native receipt cannot reconstruct them. Restore checks the original binding before serving data and reapplies controlled deletion/revocation exclusions before opening access.

An account restored or explicitly reconnected through either supported Daclify route retains its sole existing client subject/native member mapping, but old app tokens are revoked. Obtain fresh app access. Same-client subject collisions reject; two registered root identities are not silently merged. Test this with both the wallet-only and restored-account reconnection paths.

Change an issuer/client/DAO only through a reviewed migration proving the old and new identities. Existing local accounts require proof of both identities to claim their history. Ambiguous historic authors stay legacy/unattributed instead of being assigned to a convenient current member.

## Retention and resources

Document each data class's purpose, audience, operator, retention/expiry and deletion exceptions, including task text, photos, identity links, outbox drafts, logs and backups. Leaving a DAO stops new operational access; it does not automatically delete shared work, financial rights or the person's wider Daclify account. Removing an identity link does not anonymize identifiable surviving text, photographs, native identifiers or histories.

Personal-data cleanup must preserve required shared evidence and unsettled rights. Future signed app cleanup notices are an explicit implementation task; ordinary app login does not already implement deletion. An independent app reports its actual cleanup and outstanding backup/provider retention. No operator can promise to retract recipients' copies or public blockchain history.

Delete expired/disposable rows in bounded batches. SQLite should run on a persistent local volume with coordinated WAL/checkpoint/backup; it is unsuitable as a concurrently shared network file. `VACUUM` needs operational coordination and space for rebuilding the file. PostgreSQL suits concurrent workers/hosts; normal vacuum makes pages reusable and does not promise a smaller physical file after each deletion. Test logical deletion separately from disk reclamation.

Keep database credentials, signing keys, TLS keys and provider secrets outside frontend assets, model prompts, source and ordinary logs. Production deployments must reject ephemeral-only storage and include a tested recovery path. Native receipts still consume funded RAM and remain retained; reducing app database storage does not erase those receipts.

## Conformance required for a supported recipe

- Wrong DAO/app/issuer/client binding refuses access without modifying existing data.
- Same member numbers and subjects in another tenant never expose records.
- Forged or inactive actors cannot read, complete, retrieve evidence or confirm a receipt.
- Full uint64 IDs survive serialization and storage without rounding.
- Completion/outbox insertion rolls back together on failure and yields one logical event under concurrency.
- Source edits, retries, process restart and restored databases preserve the frozen intent and exact-version review.
- Recovery/reconnection retains the verified mapping and requires renewed access; ambiguous subject collisions reject.
- Controlled finite cleanup and engine maintenance demonstrate actual outcomes without claiming universal anonymity or physical reclamation.

See the [connection guide](../connected-community-apps.md), [project design template](../examples/community-mini-app-design.md) and [runnable starter](../../examples/community-mini-app/README.md). These are acceptance requirements, not certification of every SQL/NoSQL engine.
