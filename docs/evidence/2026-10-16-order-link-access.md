# Personal DAO orders and claim invitations — 16 October 2026

Frontend `0.15.0-alpha.47`, commit `e4d99836d616285754a07f100896a1bbe1bdb667`, is pushed to `dev` and live on the existing shared testnet. Core32, modules42, API, database, native contracts and configuration are unchanged. Almaiso is excluded. Exact results are in the [JSON evidence](2026-10-16-order-link-access.json).

## Verified cause

The user confirmed that a different account/person should claim the DAO. Read-only SQL queries bounded to the reported order found an ordinary free order and no corresponding claim invitation. A read-only native receipt lookup found it paid and unused, so no DAO had been created from that order. The API deliberately uses the same `CREATION_ORDER_UNKNOWN` response for an unknown or unowned order. Its ownership restriction was correct; sharing a personal `/create?order=…` URL cannot make another account the founder. Account identities, credentials and the reported UUID are omitted from this repository evidence.

The original account must create a separate claim invitation using the existing eligible-executive approval flow. It should leave the original order uncreated. The recipient then uses the private invitation to claim and create the DAO. No ownership or payment association is reassigned.

## UI correction

Eligible free saved orders now expand **Prepare this setup for someone else** immediately. **Create claim link → Copy claim link** provides the recipient's invitation. The personal resume address is under **Save this order for my own account**, with **Copy my order link** explicitly limited to the original account.

Rejected personal-order links show account/claim guidance, a preserved return address for switching to the original account, retry and an explicit new-setup action. The blank creation form and resume form stay hidden for that rejection. Starting a new setup performs no creation or claim and does not add the rejected URL to the earlier-owned-orders list. Account/network/request generation guards reset the rejection state; a successful retry restores normal review. Backend ownership, fresh approval, token secrecy and native receipt rules are unchanged. See the [user guide](../../../daclify-frontend/docs/users/dao-creation.md).

## Verification and delivery

Three browser regressions failed before the fix: personal-copy placement, hidden invitation preparation and absent rejected-link guidance. All 24 final desktop/mobile cases passed, including correct invitation payload/link generation, manual-copy fallback, rejection guidance, preserved account return, explicit new setup without writes, retry, eligibility/paid/reserved exclusions, creation destinations and account deep links. These cases use synthetic accounts and stubbed HTTP transport; they do not issue a real invitation.

`npm run verify` passed all 77 unit files / 414 tests, lint and Vue/TypeScript checks. Changed-file formatting, whitespace, guide-link checks, the testnet build and generated core docs check passed. Dependency pins are unchanged. Existing component-fixture router and build chunk-size warnings remain visible.

Static delivery retained old hashed assets, prepared rollback and published the entry last. No service restart or configuration change was needed. Live checks matched 155 static files, seven module hashes, the runtime hash, eight raw ABIs and 54 retained downloads. Desktop/mobile Create and document-template flows passed without browser errors or API 5xx responses. The scoped investigation changed no real order, claim, account, key, payment or chain record. Native integration suites and real wallet/invitation ceremonies were not rerun. Reload old portal tabs to receive the revised UI; personal order URLs remain restricted to their owner.
