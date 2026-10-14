# Daclify status and availability

Audience: community members, DAO administrators, mini-app builders and operators. This is a dated development checkpoint, reviewed 14 October 2026. Source implementation, an enabled service capability and production qualification are different facts. Daclify mainnet is not qualified by these records.

## Check the service you are using

The shared dev app is [testnet.app.daclify.com](https://testnet.app.daclify.com/); its [handbook](https://testnet.app.daclify.com/docs) displays the installed SDK/help versions. The public [network response](https://testnet.api.daclify.com/v1/network) identifies the API, chain, runtime and advertised capabilities. A capability name or package version alone does not verify a provider, client wallet or deployed contract hash.

The documentation cohort uses core/SDK `0.15.0-alpha.22`, modules `0.10.0-alpha.30`, frontend `0.15.0-alpha.33`, and MCP `0.1.0-alpha.13`. Contract interface remains 1; module contract versions and bytecode are unchanged. Earlier download cohorts remain immutable. Exact code/artifact identities and completed delivery checks are in the [documentation delivery record](evidence/2026-10-14-documentation-audit.md); consult the live API rather than assuming this checkpoint will remain current.

## Availability

| Capability | Development implementation / shared testnet | Limit |
| --- | --- | --- |
| Accounts, paired sign-ins, DAO membership, approved actions and encrypted documents | Implemented; methods depend on service/client configuration | Sign-in, signing authority and private-content access are separate |
| Quick signup and explicitly consented assisted recovery | Shared testnet uses labelled same-VM recovery | It does not survive loss of the VM by itself or qualify independent production recovery |
| Wallet/passkey protected key unlock | Implemented behind client qualification | Ordinary wallet/passkey sign-in does not qualify protected key recovery |
| Connected-app registration, sign-in and selected Community Activity | Implemented on testnet | Active DAO administration/module/signing prerequisites apply; detailed app data stays in the app |
| Matching app connection bundles, immutable downloads and readiness diagnostics | Available through the testnet API | Server readiness does not prove member login or a confirmed native event |
| Mini Apps directory | Enabled on the shared testnet | Origin verification is not Daclify certification or native registration |
| Local and resource-bound HTTP MCP | Enabled on the shared testnet | Use the supported harness/tool matrix and separate scoped consent; no universal harness guarantee |
| Encrypted personal profiles/key envelopes | Implemented with matching deployment capabilities | Original keys/envelopes and ciphertext are needed; recipient copies and public history cannot be erased |
| Account exit / hosted erasure orchestration | Implemented; currently disabled on shared testnet | Operator backup-retention and controlled-restore exclusion configuration is required before enablement |
| Mainnet launch, universal provider/client support and independent recovery | Unqualified by this checkpoint | Development, local mocks and a same-host restore do not establish production readiness |

The shared testnet recovery qualification retains its existing expiry of **17 October 2026, 14:46 UTC**. Operators must verify the actual current report and renew qualification before expiry. Unavailable recovery options must remain unavailable until their requirements are met.

## Where to go next

- Members/admins: [Start here](https://testnet.app.daclify.com/docs/start-here), [documents](https://testnet.app.daclify.com/docs/documents), [recovery](disaster-recovery.md).
- Builders: [connected apps](connected-community-apps.md), [database contract](guides/mini-app-database-contract.md), [MCP guide](guides/community-mcp.md).
- Operators: [development](development.md), [operations](operations.md), [recovery qualification](../ops/recovery/README.md).

Historical evidence records what passed at its stated version/date. Preserve it; a later source edit does not rewrite those results.
