# Quick ballots

Quick ballots ask a public question with encrypted up/down responses. They are an experimental testnet feature, separate from Decide governance ballots: a Quick result never executes a treasury payment, appoints an executive or changes DAO policy.

## Using a ballot

1. An originating DAO executive enables Quick ballots through Modules, then opens Quick ballots and chooses **Create ballot**.
2. Enter a question, optional explanation and optional closing time. Select all registered Daclify accounts, or active members of one to twenty DAOs. The question, audience and participation are public.
3. Review the fixed vote readers. These are the originating DAO's active executives when the ballot opens, with a maximum of eight. Audience DAOs do not receive reader access. Each reader needs a usable account encryption key.
4. Approve with the existing account approval method. The browser creates a fresh ballot key, verifies its possession proof and encrypts a separate key grant for every reader. The server receives no ballot secret.
5. Eligible users sign in and choose up or down. They may replace or remove their response while voting is open. Multiple memberships or paired approval methods do not create additional votes for the same canonical account. This is account uniqueness, not proof of one real person.
6. After the deadline or manual closure, the service freezes and prepares the exact response set in bounded batches. An original reader unlocks their account encryption key and selects **Verify and publish result**. Their browser checks all encrypted responses and produces the public tally proof locally.

Before a valid proof is accepted, the page reports **No verified result**. A lost reader key does not permit a guessed result or an executive override. Original readers retain their grants after leaving office; a new executive does not automatically receive an old ballot key. A recipient who copied a key cannot be made to forget it.

## Account approval and privacy

Use Account → Approval setup to choose the existing default wallet. Quick participation authenticates the canonical account through a narrowly scoped companion contract; executive creation still uses the originating DAO's member authorization. A public voter need not join any DAO. Selected-DAO eligibility uses the credential actually proved on-chain. Leaving an audience DAO prevents a new response but does not prevent removing a previous response while voting remains open.

The chain stores encrypted choices and validity proofs. Participation, timing, public account links and changes remain observable. Readers can decrypt individual choices. Small populations and information voluntarily disclosed outside Daclify may reveal choices by inference. Public proofs establish the encrypted aggregate's totals; they do not establish reader honesty, erase downloaded data or provide real-person uniqueness.

Own-response receipts are encrypted. Accounts with an available account encryption key can recover them using that key. Wallet-only accounts may use a nonextractable device key; the page labels those receipts as device-only. Clearing that browser's storage can lose its local receipt. Never send ballot keys, receipt plaintext or recovery kits to an AI harness or API.

## Storage and cleanup

The originating DAO funds response, reader-grant and archive storage. Audience DAOs are not charged. The first release bounds a ballot to 5,000 retained identities, including removed-response tombstones. Question and explanation limits are 256 and 4,096 UTF-8 bytes. An exhausted allowance rejects the entire action without partially changing a vote or consuming its account nonce.

Individual rows become eligible for cleanup 30 days after closure. The service first verifies complete encrypted exports against the frozen on-chain header, retrieves every primary file, creates and restores the authenticated encrypted backup, and obtains a native archive attestation. Every deletion batch rechecks primary and backup availability. Missing capacity, unavailable storage, corrupt files or changed source pins retain the native rows and retry later.

Cleanup does not require an available tally key. The permanent header retains the public definition, encryption key, aggregate, response count/root and any accepted proof/totals. An untallied ballot continues to show **No verified result**. A reader can restore verified encrypted history and publish a valid proof later. Cleanup releases used RAM; it does not refund purchased capacity. Blockchain transaction history and already copied data are not erased.

## Operator deployment

Deploy the matching core 0.15.0-alpha.29, modules 0.10.0-alpha.39 and frontend 0.15.0-alpha.40 cohort. Preserve historical SDK downloads. The companion and source contracts require their reviewed code/raw-ABI pins, runtime RAM-source registration, lifecycle kind 9 for the source, narrow `execctx` links and the existing restricted gateway. Set `QUICK_AUTHORITY_ACCOUNT` and the `quick-ballots` module deployment only after the native configuration agrees. Unknown pins fail closed.

Current contracts use pinned CDT 4.1.1 with `-O=s`. The runtime is 1,048,475 bytes, only 101 bytes below the measured native decoder ceiling; regenerate pins and remeasure before any future runtime change. Registry and response limits, cleanup bounds and permanent high-water marks are intentional resource controls.

Apply migrations 053–055 through the existing migration coordinator. Archive exports have no account/profile foreign key and survive account erasure and DAO closure. Their reservations count against the existing DAO storage allowance. Stable file UUIDs reconcile lost upload replies; unknown provider outcomes retain their reservations. Completed exports remove large SQL plans while preserving small immutable provenance records.

Configure all four `ARCHIVE_BACKUP_*` values using private operator configuration. Keep the key and protected directory outside Git, downloads and logs. For the testnet Pinata primary, a protected operator disk provides a second copy outside the primary provider's failure domain. It is still on the API host: this does not protect against simultaneous loss of that host and the provider, or qualify independent-host account-key recovery. Monitor disk capacity; backup failure must stop pruning. Preserve immutable older backup keys and files.

Do not enable the native archive pruning policy until actual provider retrieval and backup restoration pass. Keep ordinary poll/document archive approval restrictions intact. Quick maintenance independently archives and prunes bounded eligible rows after DAO closure; it does not invent an active administrator or bypass funded storage.

Before switching API source, retain private PostgreSQL/config/native rollback artifacts and run fresh recovery qualification for the exact core version. A testnet single-host key-service drill must remain explicitly labelled as such. Stage the API and frontend first; publish hashed assets before replacing the portal entry point. Verify exact irreversible native pins, public API/portal, old modules, MCP and a real testnet Quick lifecycle after cutover.

Independent cryptographic review and mainnet qualification remain separate release gates. See the [implementation evidence](evidence/2026-10-15-quick-ballots-implementation.md), [proof protocol](superpowers/specs/2026-10-14-quick-ballot-proof-protocol.md) and [execution plan](superpowers/plans/2026-10-15-quick-ballots.md).
