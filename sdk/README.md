# Daclify public protocol

Strict boundary schemas, full DAO references, integer amounts, account and encryption envelopes, generated Antelope runtime types/codecs, and a public ABI compiler. This package contains no database, session, relayer, or custody implementation.

Import schemas from `@daclify/core-protocol`, contract codecs from `@daclify/core-protocol/sdk`, and the build-time generator from `@daclify/core-protocol/compiler`. Generated contract types and runtime validators originate from the same compiled C++ ABI. Native RPC reads normalize exact integer transport, `0`/`1` booleans, and legacy public keys; instruction inputs remain strict.

The installed package version is recorded in its `package.json`; source versions are owned by `sdk/public-package.json` and `protocol/base.ts`. The contract interface is version 1, independently of the package version. `AccountSchema` includes vault accounts with public keys and user-controlled wallet-only accounts with both key fields null; narrow that union before signing or encryption. `VaultAccountSchema` and `JoinIdentitySchema` still require keys. Wallet recovery retains chain DAO/member IDs while a rebuilt service can have a new account UUID. Vault-attachment schemas bind origin, session intent and incoming keys; the API separately verifies current wallet control and signing-key possession.

The development version is unreleased and its interfaces may change. Released consumers must pin an immutable registry version and a tested release manifest. The package does not represent a production security audit or a deployed chain capability.

`@daclify/core-protocol/help` supplies the generated versioned guides and references; `@daclify/core-protocol/documentation` is the producer's build-time documentation generator. API routes and validators are exported from the protocol root. ABI reference hashes identify the source JSON bytes, not Antelope's separately encoded ABI hash. Generated JSON Schema describes structural constraints; contract rules and custom runtime refinements still require their validators and tests.

New payment/hosting/Hub schemas and typed routes are producer-owned. Wallet sign-in uses audience-bound version-2 messages; vault login uses its version-3 challenge binding both public keys and the API issuer. `RuntimeCodeHash` and `RuntimeRawAbiHash` export the reviewed compiled WASM and binary-ABI pins; JSON ABI hashes are different and must not substitute for chain raw ABI verification. `CoreContextActions` includes new governed hosting/Connect permission links.

## License

This SDK, generated code, headers and documentation are **AGPL-3.0-only**.
The package includes [LICENSE](https://github.com/Daclify/daclify-backend-core/blob/dev/LICENSE) and [licensing guidance](https://github.com/Daclify/daclify-backend-core/blob/dev/LICENSING.md).
Dependencies retain their own licenses. Review copyleft compatibility before
combining this SDK with proprietary code; there is no blanket module exception.


`nativeTokenOpenAction(token,wallet,destination)` encodes the standard native token `open` action with the receiving wallet as both owner and RAM payer. It validates the producer-owned asset and native identity, exact chain and destination. Preparation does not pair an identity or authorize a withdrawal. Tokens without the qualified standard `open`/`accounts` layout need operator review; an existing row alone does not qualify arbitrary token RAM behavior.

Executive actions and tables are ABI-generated. `nativeOwnershipSetupActions` prepares owner-only code/ABI links plus immutable governance configuration. `nativeHandoverActions` prepares temporary owner delegation and the policy-2 handover in one transaction; never broadcast staging separately. Creator, policy version, signer roster, threshold and policy revision are checked against the current chain. The handover action requires the expected signer roster, threshold and policy revision to reject stale approval. See [creator-owner/executive-active operations](https://github.com/Daclify/daclify-backend-core/blob/dev/docs/operations/creator-owner-executive-active.md).

Names policy version 1 is opt-in through `setprofit`; `fulfillnet` requires settler-verified net USD proceeds. The self-authorized `checkprofit` action runs after provisioning and rolls back the whole sale below the configured margin. Existing tiers, policies, sales and legacy action encodings remain unchanged. See [Names pricing](https://github.com/Daclify/daclify-backend-core/blob/dev/docs/operations/names-pricing.md).

Names inventory responses carry independent `listingsNext`/`suffixesNext` cursors; quotes use keyed reads. The typed `ApiRoutes.names` query accepts the corresponding cursors. `serviceAccountPermissionActions` exports the reviewed Relay/Fees authority proposal, with governance delegated to runtime active and a 20-action Relay operator child. These exports prepare transactions; they never authorize or broadcast them. The API must switch `RELAY_PERMISSION` together with an approved service authority rollout.

Native authentication includes explicit `signup` proofs and `/v1/sign-up/native`. Fresh native wallet profiles expose `walletOrigin: signup`; existing recovery checks and keyed profiles are preserved. External Telos ballot schemas and action encoding belong to the public module SDK.

`@daclify/core-protocol/mini-app-cleanup` verifies short-lived, issuer-signed cleanup notices against configured issuer keys and the exact app binding. Configuration version 2 commits an approved cleanup URL; legacy version 1 hashes stay unchanged. An app acknowledgment reports its operator’s assertion, including required retained evidence, and does not prove erasure of independent copies.

`@daclify/core-protocol/community-agent` provides the Node client for scoped public community intents. It authenticates with both root public keys, keeps root authentication separate from delegate signatures, and rechecks current nonce, member, session, guardian, policy and module pins before submission. `authenticatedRequest` is a trusted SDK transport, never an MCP tool. Unknown delivery freezes new preparations until the original packet is reconciled; callers must persist that packet before delivery. Module intent encoding remains owned by the module SDK. No treasury, root administration, private-profile or decryption tool is supplied.

Local MCP pairing routes bind the new delegate public key, lossless DAO/member context and bounded scopes to a five-minute single-use PKCE request. Approval uses the existing fresh account-control proof and a separately signed native session. The shared `prepareCommunityInstruction` validates native authority for both the Node client and the internally authorized service adapter, without substituting MCP tokens for root authentication. See the versioned community MCP help topic for key storage, consent and supported-host limits.
