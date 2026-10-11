# Telos DAO redesign implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. No delegation is authorized. Continue through implementation and verification; user reviews the complete result afterward.

**Goal:** Redesign Telos DAO and expose retained Foundation elections and current producer standings.

**Architecture:** Modules publish bounded external-chain schemas/readers. Core hosts public validated routes. Vue consumes pinned public artifacts and preserves the existing qualified Decide voting journey.

**Tech Stack:** strict TypeScript, Zod, Vue 3, WharfKit, Vitest, Playwright.

**Spec:** [Telos DAO redesign](../specs/2026-10-11-telos-dao-redesign.md).

## Global constraints

- Work inline on dev, use Ponytail Full, preserve wallet context and pending transaction safeguards.
- No dependencies, chain writes, authority changes or production deployment.
- Use operator-selected network and producer-owned public artifacts.
- Filtered reads scan at most four pages; each response contains at most 25 records.

## Review focus

- A Foundation leaderboard must remain visible without accidentally enabling an unqualified transaction.
- An empty filtered page with more records must permit continued discovery.
- Unsafe website/content references remain inert text.
- Network or view changes invalidate stale requests and preserve the original pending vote reference.
- Schedule membership must not be inferred from vote rank or registration.

### Task 1: External readers and API

**Files:** modules `protocol/telos-governance.ts`, `sdk/telos-governance.ts`, `tests/telos-governance.test.ts`; core `services/api/src/telos-governance.ts` and route tests.

**Interfaces:** `ballots(cursor?: string, kind?: 'ballots' | 'elections')`; `producers(cursor?: string)`; public `TelosProducerPageSchema`; GET `/v1/telos/producers` with native-account continuation. Existing response fields and vote preparation remain compatible.

- [x] Add failing tests for retained leaderboard reads, bounded filtered continuation, producer pagination/schedule/chain validation and invalid RPC weights.
- [x] Run focused tests and observe expected failures.
- [x] Implement schemas, readers and validated routes, with independent chain/source checks.
- [x] Run module verify and API focused/full required checks; publish packed modules artifact and pin core consumer.

### Task 2: Page redesign

**Files:** frontend `src/views/TelosGovernance.vue`, `src/components/TelosProducers.vue`, `src/api/client.ts`, `tests/e2e/telos-governance.spec.ts`, navigation/public checks.

- [ ] Add failing browser cases for the three views, leaderboard candidate totals, safe producer links and empty-page continuation.
- [ ] Implement responsive cards, details and producer view using existing tokens/icons; append load-more results and guard stale requests.
- [ ] Preserve existing native vote tests and pending evidence; run frontend verify, build and meaningful desktop/mobile browser checks.

### Task 3: Delivery

- [ ] Update generated reference/explanatory docs, compatible versions, changelogs and execution evidence.
- [ ] Review final changes inline, fix material findings, commit and push dev under standing authorization.
- [ ] Deploy immutable API/frontend artifacts to the existing testnet, preserve recovery qualification and verify all three public views in desktop/mobile browsers.
- [ ] Record exact results and limitations. Mainnet signing/producer voting remains unqualified.
