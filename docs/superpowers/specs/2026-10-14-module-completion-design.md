# Complete the audited module flows

The user requested finishing the five prioritized follow-ups in the module capability review. Implementation is authorized inline, including dev commits/pushes and testnet delivery. Production, user fund movement and native owner/active authority changes remain separate actions.

## Outcomes

1. Every newly opened ballot has a versioned, contract-checked definition commitment. Old ballots keep their encoding and original vote path. Generic polls have explicit semantics, including neutral two-option polls; execution ballots retain binary approval semantics.
2. Elections, Works, Grants and admission open the exact evidence/rules document version and commitment through the existing integrity/decryption reader, with a return path and an explicit unavailable state.
3. Members create service offers with a form backed by the existing public producer schema and verified document publication flow.
4. Payroll creation binds a terms document and label before approval. Renewal creates a separately funded successor term with fresh authorization, preserving the old schedule and its unpaid claims.
5. Works supports opt-in protected agreements and member-voted disputes. The user selected eligible-member voting excluding conflicted parties. Previously approved payment claims remain payable.

## Boundaries and implementation choices

Use existing C++/Vue/TypeScript/Zod/WharfKit components and producer-owned packages. Add versioned side records rather than rewriting existing serialized rows. Compile with pinned CDT 4.1.1 and `-O=s`; measure changes in WASM/RAM/CPU. No delegation.

The ballot domain includes native chain ID, runtime, Decide account, DAO and ballot ID. Commit exact metadata bytes and frozen weight/quorum/threshold/member boundary plus subtype-specific immutable records. Exclude tallies, mutable status and execution flags. New ballots reject the legacy vote path; missing commitment data cannot enable a fallback. Stored commitment markers remain while their ballot exists so cleanup cannot reopen an unbound path.

Document references pin ID/version/commitment in the same DAO. Confidential text remains encrypted. Referencing a document creates no promise of access; a reviewer must hold its keys. A link must not substitute a newer version.

Payroll renewal uses the existing bounded 1–12-installment funding model. It creates fresh liabilities rather than extending or relabelling an old obligation. Terms and successor links use bounded side records.

Protected Works uses the existing arbitration plan's reserve/challenge/timeout/backup/mutual-settlement safeguards. The selected primary mode is DAO member voting; the contributor and original reviewer are excluded. Each agreement explicitly selects a nonconflicting backup and freezes its rules before contributor consent and funding. Existing funded projects keep their accepted rules; existing DAOs explicitly adopt protection for future funding. No default gives a new authority control over old funds.

Secret voting, other-chain provider qualification and managed mini-app database hosting are separate integration/product work, rather than consequences of these five fixes. Advanced election counters remain governed by their separate programme plan. The capability report must distinguish remaining platform boundaries from completed work.

## Acceptance

Contract/WASM and native tests reject changed ballot definitions, unbound new votes, foreign domains, conflicted adjudicators, direct protection bypasses and repeated settlement. Legacy votes, funded projects and approved liabilities survive upgrades. Browser/API tests exercise signed payloads, exact evidence, forms, fresh funding and failure/retry states. Testnet publication uses pinned tested artifacts, snapshot/upgrade checks and public portal verification.
