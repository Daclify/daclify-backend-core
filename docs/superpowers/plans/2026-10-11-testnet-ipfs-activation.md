# Testnet IPFS activation ledger

User authorization: activate IPFS for DAO documents and images. The user confirmed the current Pinata Free plan. Work stays inline on `dev`; no mainnet changes or provider upgrade purchase. Monthly module pricing is an independent follow-up.

- [x] Inspect existing Pinata credentials/configuration without printing secrets and read current native resource policy and PostgreSQL gateway state.
- [x] Verify actual provider authentication, pinned-file totals, owned uploads/retrieval and server-key protection. Preserve unrelated provider objects.
- [x] Prepare and back up the testnet configuration/database before applying the existing platform-governed resource policy at expected revision 0.
- [x] Confirm the native governance transaction irreversible and verify the resulting canonical policy: 100 MB free / DAO and $1 per additional decimal GB monthly.
- [x] Register a conservative seven-day shared gateway period within the confirmed free plan and persist its ID. Align the private API free quota, preserve other values and restart only the API.
- [x] Exercise actual HTTPS member login, document and branding uploads, duplicate retries, signed native publication and API byte-integrity reads using owned synthetic fixtures.
- [x] Verify desktop/mobile pricing, Hub logo rendering and public document downloads, with accessibility/error/overflow checks.
- [x] Remove only the owned transient provider probe; retain published review fixtures and record renewal instructions, limits and evidence.
- [x] Run focused regression tests and generated-document checks and review the documentation diff.

Implementation and exact results: [evidence report](../../evidence/2026-10-11-testnet-ipfs.md). Operating instructions: [testnet IPFS](../../operations/testnet-ipfs.md).

Independent module-fee decisions already supplied: free through ten active DAO members; above ten, separately configured monthly fees per DAO. Proposed monthly rates: Decide $2, Works $3, Payroll $3, Grants $2, Endorsement $1 and Community Activity $1. The pricing question remains pending; no monthly billing implementation or nonzero module pricing has been deployed. The existing native catalogue's TLOS usage prices are a different mechanism. Do not turn this documentation proposal into automatic charges.
