# People and workspace implementation plan

**Goal:** Make DAO navigation consistent; present public users and members; provide useful module details, movable documentation help and a usable native names marketplace.

**Architecture:** Reuse the Vue account controls, public on-chain profiles, generated ABI schemas and native wallet verification. Public directory records are published profiles, never service accounts, private sign-in pairings or recovery data. Shared DAO administration never grants the shared runtime's native selling authority. No production or testnet authority changes are part of this implementation.

**Tech stack:** Existing Vue, Pinia, Lucide, TypeScript, Zod, WharfKit and Antelope C++.

## Delivery packages

- [x] Public people API: canonical paginated profile response and validated profile data; DAO-scoped lookup; regression tests for cursor handling and privacy boundaries. No database migration: blockchain profiles are the source.
- [x] Consistent workspace: `/daclify` resolves the linked platform DAO; platform policies become its workspace tab. Ordinary DAO routes retain existing authorization.
- [x] Users and members: reusable public cards, cards/list controls and filters; own profile first; shared detail route with self-only account editing and pairing; existing admission/role controls retained.
- [x] Module tools: illustrated cards opening accessible scrollable dialogs with use cases, requirements, workflow, limitations and contextual documentation.
- [x] Help: sidebar launcher, draggable/resizable floating window, accessible minimize/reset/size controls, bounded validated last-100 browser history scoped to network/operator/account, clear-history action and late-response guards.
- [x] Names: Browse/Manage flow, valid suggestions, explicit key backup and fees, wallet seller controls, DAO transaction export requiring real native authority. Verify native suffix creator requirements and provide narrowly scoped, reviewed permission setup exports, never automatic owner/active changes.
- [x] Generated documentation and pinned public package updates; browser desktop/mobile and accessibility verification; all producer/consumer required checks; final diff review and durable evidence.

## Acceptance and limits

Directory membership uses public blockchain records and profile publication is the existing opt-in. Profiles are per DAO membership; one service account can own multiple handles and these are not publicly correlated. An unpublished user sees a self card; other unpublished members remain discoverable only through their DAO's public member records. The Help assistant remains docs-only and does not receive account, DAO content or keys. Cached chat is not a server backup.

Names sell new native accounts; existing native account ownership is not transferred. Independent DAOs can use a native seller account governed by their executives. Shared DAOs need their own native seller account if they want namespace revenue; a Daclify administrator is not thereby a native-account signer. Transactions for quorum-controlled accounts are exported for approval. Names suffix creation must use the native suffix as creator, with a dedicated permission linked only to `eosio::newaccount`.

Tests distinguish unit/HTTP fixtures, compiled-WASM execution and real native intrinsic tests. Live on-chain deployment, wallet broadcasting and provider billing remain separate reviewed operations.

Completed development checks and deployment boundaries are recorded in [execution evidence](../../evidence/2026-10-09-people-and-workspace.md). Live deployment is a separate reviewed operation.
