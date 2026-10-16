# Private Quick question package

This is package evidence, not activation. The approved maximum-content-privacy plan still requires signed migration/recovery and complete release/upgrade/leakage qualification before deployment. No customer DAO was migrated.

## Definition and reader boundaries

Core public SDK43 adds the bounded `quick-question` protected payload (256/4096 UTF-8 bytes). Modules52/contract9 and frontend61 bind protocol2 to a single originating DAO, exact ballot ID and encrypted document/version/commitment/epoch. The original proof domains, real BLS choice/key/tally proofs, account uniqueness, eligibility and fixed executive vote readers remain unchanged. DAO question grants never contain the individual-vote key.

New public authoring uses protocol3 after explicit permanent-disclosure review; legacy protocol1 stays readable. Private multi-DAO/all-account publication is refused. Definition-aware v1 readers are additive (`/quick-ballots/definitions`, `/:ballotId/definition`); old strict readers receive legacy rows only, with unchanged pagination cursors, and an update-required result for newer detail formats.

Only technical draft data and encrypted grants are persisted locally. Original encrypted publication resumes in its account/deployment/member scope; uncertain opening reconciles the exact definition, key/proof and retained grants before another signature. A read verifies the protected reference and local content before voting. Lock/context changes clear the wording. Existing response withdrawal remains possible without reading the question again.

## Native and browser evidence

Actual Spring1.2.2 suite: 25 of26 passed in the full run, including 5,000 signed authorized votes. The remaining RAM-exhaustion case lacked its local Telos system artifact; both public source hashes were verified against existing pins, and the focused rerun passed1 (25 excluded). A focused private-question rerun passed1 (25 excluded), including cross-parent rejection, legacy writer rejection on protected DAOs, retained fixed readers, verified archives, 30-day cleanup and valid late proof after pruning. No fake verifier was used.

The real browser/native publication/decryption case passed desktop. HTTP source fixtures use real browser vault encryption, K1 approval signatures and BLS choice proofs: public/private non-executive response/change/removal passed2, including missing question grants, no executive key access and re-reading after refresh. Combined desktop/mobile cohort passed19/20; the normal desktop case reached encrypted-setup completion after its10s test wait while concurrent TypeScript builds loaded this host. The helper now allows30s for signed creation completion; its focused rerun passed1. Both lost-success cases passed with exactly one native opening. These local tests do not qualify an independent content provider.

Core focused checks passed7/3 files; module proof/context/snapshot/archive/API/SDK checks passed37/6; frontend private reader/draft/policy checks passed24/3. Core build/scoped ESLint/docs, module types/lint/docs and frontend build/policy5 passed. The frontend build retains its existing large-chunk warning.

## Resource costs

Pinned CDT4.1.1 `-O=s`, with the existing optimizer policy unchanged: freshly rebuilt preceding Quickvote hash `b2771fbd69b556f79dbbe6c5e675a7dac1c6838d45985af8995dd4640e948aef`,188469 bytes; current hash `963a7b2b7cd558c3726f00a68a67b404a0b94aa6c3b8f8b66149269ba6ce94bc`,271144 bytes (+82675). Core runtime remains861650 bytes, hash `fecff3e07c4e42e1a23165e8aa45ad0826dd39cce06c09f0ad377ebe33457362`.

No new Quick native field, table or secondary index is introduced. The existing bounded question string holds a technical reference. The existing docrefs table retains the document until both verified response/grant archives have been pruned; bounded25 backfill skips already-pruned ballots. Cleanup of the document itself remains separately authorized and archive-gated. Final definition/tally inputs remain on-chain.

One local private run measured response+1034 RAM bytes/9219us; response pruning−1034/2568us, grant pruning−226/3068us, backfill0/3851us. These are local samples, not chain capacity guarantees. The larger WASM comes from reusing the existing strict document-reference validation; no speculative optimization was added.

Inline debugging also reproduced a stale executive-action nonce after another action. The common ExecutivePanel sender now fetches current membership/signing authority immediately before signing, matching the existing module sender.
