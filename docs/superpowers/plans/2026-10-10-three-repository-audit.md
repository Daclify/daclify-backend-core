# Three-repository audit and repair

Scope: current `dev` of core, modules and frontend. Preserve existing contracts, persisted data, permissions and provider policy. No production deployment or private environment changes. Ponytail 5.1.0 full; work inline under repository instructions.

## Discovery and baseline

- Core owns Antelope runtime/Hub, identity, PostgreSQL, services, billing, storage and recovery. Modules own five governance/work contracts and their public SDK/archive decoders. Frontend owns Vue UI, vault and wallet signing.
- All three checkouts matched `origin/dev` and were clean before this audit.
- Baseline verification: core 650 tests, modules 154, frontend 163. PostgreSQL integration baseline: 194 tests across 27 files.
- Historical archive ABIs/decoders and immutable migrations remain required recovery inputs; line count alone does not justify deletion.

## Ordered work

1. Trace identity/control, payments/subscriptions, resource/retention workers, archive recovery, module permissions and UI context changes. Record verified findings separately from hypotheses.
2. Reproduce failure-boundary defects before implementation: worker synchronous exceptions, rejected HTTP body cleanup and module payment response byte limits. Fix centrally with regression tests.
3. Verify developer/release tooling consumes pinned artifacts; remove obsolete frontend sibling rebuild steps if confirmed.
4. Inspect frontend asynchronous account/network transitions and accessible failure states; repair demonstrated regressions.
5. Run isolated PostgreSQL and provider fixtures, native permission/module checks where supported, unit/property suites, static checks, formatting, dependency advisories, builds and relevant browser tests.
6. Review diffs and update an evidence report in each repository. Commit and push `dev` only.

## Impact gate

Breaking authentication/API changes, destructive migrations, changed authorization or commercial policy require the user decision described in section 15 of the supplied audit prompt. Continue independent safe repairs while any such decision remains pending.

## Verification boundaries

Mocked provider responses establish service behavior, not live Stripe/Pinata qualification. Local OpenBao/SMTP and native Antelope fixtures establish their tested capabilities only. Public testnet/mainnet authority changes and real payments are outside this audit.

## Execution result

Discovery, safe repairs, regression tests, cleanup, broad verification and inline diff review are complete. See `docs/evidence/2026-10-10-three-repository-audit.md` for the per-finding evidence and exact checks. First-login encryption-key binding remains a confirmed, decision-gated protocol change. No approval arrived during independent work; preserve the current protocol until the user decides.
