# Legacy RAM migration — development qualification

This controller adopts an **unobserved** legacy runtime. It is not a production release or an automatic upgrade of an already observed deployment. Do not reset counters, re-run `initramobs`, rewrite accepted code pins, or reuse this sequence over a populated observer. Keep the original release artifacts and signing/encryption domains.

## Before starting

Inventory every DAO, installed module and pending executable approval. Back up the chain projection, original contract artifacts, provider ownership ledger and private recovery material using the existing backup procedures. Review the exact current runtime/module code and ABI hashes. Unsupported third-party contracts are outside this migration. All supported module payers must belong exclusively to this runtime: `bindrampool(runtime)` requires the payer's own authority and permanently binds it. Binding a payer still serving another runtime is unsafe.

Drain pending executable approvals before changing their pinned contracts, or use a separately reviewed, DAO-approved migration. Decide's `checkmig` refuses a pending unexpired plan whose Works/Grants code changed. No action here changes its approved hashes or commitments. Module kind is checked by actual module code; a wrong kind aborts `beginram` atomically.

Purchase enough actual native RAM for the existing state, scan cursors, temporary protected-write overlays, legacy financial holds and platform headroom **before** maintenance. Configured byte values are not funding. Preserve a reconciled baseline for code, permissions and external system/token rows. There is no unlimited maintenance reserve.

## Bounded sequence

1. Deploy the reviewed, compatible artifacts under operator authority after the pending-work review. This runbook does not authorize deployment.
2. Call `beginram(sources)` with at most five explicit `{account,kind,code_hash}` entries. Kinds are Decide=1, Works=2, Payroll=3, Grants=4 and Endorsement=5. Every installed module must appear with its existing accepted hash. Beginning twice rejects.
3. Call `scanram(0,table,limit)` for every global family, and `scanram(dao_id,table,limit)` for every scoped family in canonical `contracts/common/ram_families.hpp`. Limit is 1–25. Resume until that family's `ramcursors` entry is complete. Scan empty families too; an absent cursor cannot certify coverage. Key zero is included and uint64 maximum does not overflow.
4. On every module, call `scanram(runtime,table,limit)` for `rampayer` and every family returned by the canonical module-kind list. Decide additionally scans `adoptelect` and `adoptpolls`: they allocate missing election term holds and missing ordinary-poll completion markers. Terminal legacy markers start their retention clock now; the old ballot close time is not a fabricated completion timestamp.
5. Call `adoptram(dao_id,false,limit)` until `adoptobs` is complete, then `adoptram(dao_id,true,limit)` until `adoptclaims` is complete. This reserves receipt RAM for pending obligations and a separate `ramclmholds` row for an existing claim without a ready hold. A separate table avoids colliding with future obligation IDs. Run/complete the ordinary family scans for these new tables too.
6. Call `sealram(limit)` in batches of 1–5 DAOs. It requires complete core/module/adoption coverage, stable source hashes and unchanged installed code pins. Incomplete batches roll back. A completed retry is harmless. API RAM totals remain unavailable while the migration is active.
7. Reconcile all six native payers against DAO/platform counters and observer metadata. Set physically backed payer pools with their reviewed baseline and headroom. Call `inheritram` once per DAO/payer with explicitly approved additional activity/identity/completion headroom; completion headroom is at least 32 KiB. It snapshots occupied legacy bytes and uses the existing backed grant path. Exact retries do nothing; changed retries reject. This creates a capacity attestation, **not** a historical invoice or payment.

Ordinary insert/growth/pruning is blocked during migration. Fixed-size updates and explicitly bounded completion/recovery table operations preserve their original authorization and are captured before the scan when needed. Protected mutations still need physical RAM; migration is not a promise that an unfunded legacy claim can complete before its hold has been adopted.

## Remaining rollout gates

Per-DAO quota enforcement, complete supported-old-release lifecycle qualification, external token row-payer reconciliation, live provider funding and the immutable release packet are separate work. These actions do not enable quotas, buy provider services, collect payments, prune history or unpin files. Public rollout remains gated until the required evidence exists.
