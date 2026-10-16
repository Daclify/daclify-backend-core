# Account sections and DAO creation navigation — 16 October 2026

Frontend `0.15.0-alpha.46`, commit `75e9586de22d00ca270443c709adff887bc38466`, is pushed to `dev` and live on the shared testnet. Core32, modules42, native contracts, API and database are unchanged. Almaiso is excluded. Exact verification and deployment results are in the [JSON evidence](2026-10-16-account-navigation.json).

The requested tab order is **Profile → Sign-in methods → Access & recovery → Payment history**. Signed-in settings starts on Profile. Account entry retains access setup, and unlock, approval, device, Telegram and billing links retain their relevant section. Embedded profile editing remains on Profile. Keyboard navigation follows the new order; existing authorization, key handling and private profile behavior are preserved.

The former shared `createdDaoLocation` helper diverted creation to account approval setup whenever the member's signer was locked or unavailable. The DAO workspace already offers **Set up approvals** with a return destination. Normal creation, resumed created orders and claim confirmation now use the DAO destination directly. Signing and private-content gates remain in their existing components.

Three browser checks failed before implementation: the requested tab order and the two order-creation destinations. Final verification completed 32 unique desktop/mobile browser cases, all 77 unit files / 414 tests, lint, Vue/TypeScript checks, formatting, local guide-link checks and the testnet build. Browser cases cover clipboard and invitation behavior, creation/resume destinations, optional approval setup and return, keyboard/accessibility, full-access recovery, profile drafts and targeted account sections. One run received SIGTERM after 25 passing cases; its final three mobile cases passed in a separate run, followed by four account-entry/recovery cases. The earlier strict-selector and test-matrix typing issues were corrected before final verification. The fixtures use synthetic accounts and stubbed HTTP/provider transport.

Desktop/mobile screenshots were inspected. Existing unit-fixture router and build chunk-size warnings remain visible. Dependency pins are unchanged. `npm run docs:check` confirms generated core documentation is unchanged.

Deployment retained earlier hashed assets, prepared rollback, and published the entry last without restarting portal/API services or changing configuration. Live read-only checks matched 155 static files, seven module hashes, the runtime hash, eight raw ABIs and 54 retained downloads. Desktop/mobile Create and document-template flows passed without browser errors or API 5xx responses. The interrupted run's owned development server was stopped.

No real DAO, claim, order, payment, account keys or wallet ceremony was exercised or changed. Native creation/claim integration suites were not rerun for this frontend-only change. Reload existing portal tabs to receive the updated client.
