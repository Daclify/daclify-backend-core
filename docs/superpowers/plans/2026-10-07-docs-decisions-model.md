# Documentation Decisions Model Implementation Plan

> Execute inline in the existing owned worktree. Repository instructions prohibit delegation and require continuous implementation with review after completion.

**Goal:** Configure the handbook topic selector independently from its answer model, defaulting to the user-selected `openai/gpt-6-luna-decisions`.

**Architecture:** Extend `readDocsAgent` and `DocsAgentConfiguration` with `decisionsModel`, read from `OPENROUTER_DECISIONS_MODEL`. Keep `OPENROUTER_MODEL` for chat replies, and retain the existing OpenRouter Decisions endpoint, response validation, handbook-only scope, rate limits and request bounds.

**Tech stack:** Existing strict TypeScript, Fetch, Zod and Vitest; no dependency, database, contract or frontend changes.

## Verified provider contract

On 2026-10-07, [OpenRouter's model page](https://openrouter.ai/openai/gpt-6-luna-decisions) listed the exact requested model and a 1,050,000-token context window. The [OpenRouter OpenAPI specification](https://openrouter.ai/openapi.json) documents `POST /api/alpha/decisions`, with `model`, `state` and named `questions`, returning named `noul`/`choice` answers. The context window is a provider limit, not a requirement to send that much content. Current selection uses topic titles; answer generation uses one guide capped at 12,000 characters. Local testnet has no configured OpenRouter key, so live inference is unverified.

## Execution

- [x] Read the existing selector, configuration, callers, frontend assistant and environment conventions; verify the provider contract. Baseline: `npm test -- tests/docs-agent.test.ts tests/env-examples.test.ts` passed 7 tests.
- [x] Extend `tests/docs-agent.test.ts` to assert the Luna default, independent explicit model overrides, invalid selector names, actual request routing for Luna and Jev, and closed behavior for invalid provider answers. Parse intercepted request bodies with Zod instead of unchecked casts. Add `OPENROUTER_DECISIONS_MODEL` to `tests/env-examples.test.ts`.
- [x] Run the targeted command above and confirm the new requirements fail before implementation. Observed 7 expected failures and 6 passes.
- [x] In `services/api/src/docs/config.ts`, add `DEFAULT_DOCS_DECISIONS_MODEL = 'openai/gpt-6-luna-decisions'`, a required `decisionsModel: string` field, and `const decisionsModel = env.OPENROUTER_DECISIONS_MODEL || DEFAULT_DOCS_DECISIONS_MODEL`. Validate both model names using the existing model-name pattern, and return both values.
- [x] In `services/api/src/docs/agent.ts`, replace the hardcoded Jev model with `agent.decisionsModel` and rename the endpoint/comment to be provider-neutral. Preserve existing question/guide bounds and classifier thresholds.
- [x] Update all four API `.env*.example` files and `docs/operations.md` with the two model settings, explicit Jev override, restart requirement and scope/context limits. Configured local secret files were not overwritten.
- [x] Run targeted tests, `npm test`, `npm run typecheck`, `npm run lint`, `npm run docs:check`, `npm run format:check` and `npm run build`. Inspect the final diff, record actual results and leave live inference explicitly unverified.

## Verification evidence

On 2026-10-07, the targeted suites passed 13 tests and the complete unit suite passed 400 tests across 59 files. Strict typecheck and build initially found an integration fixture missing the new required field; `tests/integration/account-links.test.ts` was updated and both commands then passed. Lint, documentation consistency and formatting passed, with the touched integration file also checked separately. `npm run test:integration -- tests/integration/account-links.test.ts` passed 3 tests against a newly created isolated local database; the database was removed after the run. The integration uses provider fixtures, not paid inference. No live OpenRouter call, frontend change, dependency change, contract change or blockchain transaction was performed.

Delivery follows verification: commit the reviewed backend change, fast-forward clean `main`, push and verify the remote commit. No deployment or provider request is required for this configuration change.
