# Saved DAO orders and claim invitations — 16 October 2026

Frontend `0.15.0-alpha.45` is committed and pushed to `dev` at `0dfc732c7cc846c878269540e62918112392c9c2` and deployed to the existing shared testnet. Core32, modules42, native code/ABIs, API services and database remain unchanged. Almaiso is excluded. Exact hashes and results are in the [machine-readable evidence](2026-10-16-saved-order-claim-links.json).

## User behavior

The old “this order” link navigated to the order already being viewed. **Copy order link** now copies its durable owner-only address, with a selectable address if the clipboard is unavailable. It is not an invitation.

An eligible Daclify governing-DAO executive can choose **Prepare this setup for someone else** on an ordinary free shared order that is still uncreated. This uses the existing claim issuer to copy immutable saved settings into a separate seven-day invitation. The original order stays unchanged and should remain uncreated if the recipient is to be the founder. The first person to confirm the invitation creates the new DAO as its sole initial member, administrator and executive. Paid receipts, reserved claim orders and incompatible agent-only setups do not offer this shortcut. Creating both paths intentionally creates two DAOs.

Account unlocking preserves the complete saved-order return path. An already-created DAO cannot be transferred through a new claim invitation; use its normal membership and role process for a separate handover. See the [user guide](../../../daclify-frontend/docs/users/dao-creation.md) and [claim service guide](../dao-claim-links.md).

## Verification

Browser checks failed before the fix for the absent copy action and saved-setup invitation, and separately for losing the order query during account unlocking. All fourteen final desktop/mobile cases passed with real browser/component/SDK behavior, synthetic accounts and stubbed HTTP transport. They cover clipboard success/failure, exact copied settings, original-order preservation, unlock navigation and executive/receipt/reservation exclusions. The issuance fixture validates canonical request and account-control schemas and asserts no original-order fulfillment request is made.

`npm run verify` passed all 77 unit files / 414 tests plus lint and Vue/TypeScript checks. The testnet build, changed-file formatting and whitespace checks passed. Production dependency audit reports zero known vulnerabilities; dependencies are unchanged. Existing build chunk-size and unit-fixture router warnings remain visible.

Static deployment retained old hashed assets and published the entry last, with rollback prepared and no service restart. Live checks matched all 155 release files, seven module hashes, the runtime hash, eight raw ABIs and 54 retained SDK files. Desktop/mobile Create and document-template journeys passed without browser errors or API 5xx responses. Account/consent framing headers and the advertised MCP discovery endpoints remain available.

No real user order was inspected or changed, and no real claim, wallet ceremony or native creation was performed. Existing native claim/creation integration suites were not rerun for this frontend-only change. The live read-only checks do not prove completion of a new on-chain claim.
