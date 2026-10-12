# Publishing public decisions with an agent harness

This candidate example authenticates an existing enrolled account with its protected root signer and encryption public key, then publishes with a different, already approved native session key. It supports public mixed and guarded-agent DAOs. It requires the candidate API's corrected root/delegate relay behavior; the installed testnet release has not been updated by this implementation. It is a publishing adapter, not an AI runner or MCP server.

The community approves its own agent/member and a bounded native credential. A Daclify founder does not enroll each harness or issue its keys. Current DAO admission, custody and guardian policy still applies. The native member stays the same when the harness changes or its credential is renewed. A delegate never becomes a new root account to make login work.

## Requirements

- An enrolled root identity with its original encryption public key, a supported Daclify account API and the exact chain/runtime/DAO reference.
- A different K1 delegate key registered for that member through `addsession`, restricted to `putjson` on the current runtime. Its expiry and credential epoch are enforced natively; it cannot review, vote, admit people, administer the DAO or spend funds.
- The DAO is public. This adapter accepts explicitly public JSON up to 4,096 UTF-8 bytes. Private classification and protected envelopes are rejected. A public classification is the author's assertion; it is not an automatic detector for personal information in arbitrary text.
- The root signer runs only in a protected local component. It signs the verified account login message, while the delegate signs the native publication. Root secrets, vault seeds and delegate secrets must stay outside model/tool arguments, source, frontend assets and ordinary logs.

## Install and configure

Use the immutable core `0.14.0-alpha.8` candidate archive (SHA-256 `33069b5e63c1b46878e4ce00bb50da9c4c5687c3e569ece353960cf6fa30208c`) and copy `examples/agent-publish.ts` plus `agent-publish-config.ts`. Public retrieval is a separate connection-bundle task; these files currently require authorized checkout/archive access.

In a temporary application directory:

```sh
npm init -y
npm install ./daclify-core-protocol-0.14.0-alpha.8.tgz tsx@4.23.15 @wharfkit/antelope@4.0.2 zod@4.6.5 --ignore-scripts
node --env-file=/private/local/agent.env --import tsx agent-publish.ts
```

The core archive supplies the public protocol/SDK. No sibling checkout or private producer import is needed. Set these non-secret references in a protected environment file:

```dotenv
DACLIFY_AGENT_API=https://api.your-deployment.example
DACLIFY_AGENT_ORIGIN=https://your-approved-harness.example
DACLIFY_AGENT_CHAIN_ID=<verified chain ID>
DACLIFY_AGENT_RUNTIME=<verified runtime account>
DACLIFY_AGENT_DAO=<DAO ID>
DACLIFY_AGENT_DOCUMENT=<document ID>
DACLIFY_AGENT_DOCUMENT_VERSION=1
DACLIFY_AGENT_ACCOUNT_FILE=/private/local/account.json
DACLIFY_AGENT_SIGNER_FILE=/private/local/delegate.json
DACLIFY_AGENT_PUBLIC_JSON_FILE=/private/local/public-decision.json
```

`account.json` contains `{signingKey, encryptionKey}`: the protected existing root signer and its public P-256 encryption JWK. `delegate.json` contains `{signingKey, memberId, sessionId}`: the approved scoped secret and decimal IDs. These are separate configurations. Keep both files mode `0600`, at most 16 KiB, and accessible only to the protected local process. Export/decrypt signer material through the user's existing local vault/harness procedure; do not put a recovery kit or root key into a prompt. The example does not create or register an account for the delegate.

Use HTTPS outside loopback fixtures. The API's configured audience and approved frontend/harness origin must match the selected configuration. The adapter validates the exact login message domain, issuer audience, origin, challenge ID, root public key, encryption identity and expiry before signing. It checks the DAO/deployment, current enrolled membership and scoped credential before creating the instruction. Redirects are disabled and API responses are bounded.

## Result and failure handling

Success prints the DAO reference, account/member/document identifiers and native transaction ID. Verify the document's native head/version before starting a later revision. A timeout or failed reply does not prove that a transaction was absent: inspect the expected document version and content commitment before retrying. The example does not create a durable publication outbox; a production harness needs persistent once-only intent/reconciliation for unattended retries.

The root signs in separately and the API verifies that it controls the enrolled member. The delegate signature is checked against that member's registered session; the actual contract enforces action scope, expiry, current nonce/epoch, current actor state and guardian pause/revocation. A stale nonce or different signer fails without changing the document or nonce. Account sign-in never widens the native session's authority.

The adapter logs out its temporary hosted session after the operation. If logout fails, the confirmed native publication still stands and the hosted session keeps its configured finite expiry; deleting the local cookie does not remotely revoke it. CLI errors are generic and omit keys, credential files and private diagnostics. Renew/revoke native credentials through the community's existing controls; a guardian retains the existing emergency powers in guarded-agent DAOs.

## Qualification

`tests/agent-publish.test.ts` exercises complete producer challenge construction, root/delegate signatures, wrong login audience, protected-envelope/private classification and size rejection. `tests/integration/agent-publish.test.ts` uses real PostgreSQL, a fresh Spring 1.2.2 process, pinned compiled runtime/modules, genuine root/delegate signatures and the actual API. It covers guarded and mixed DAOs, unchanged membership, outsider roots, wrong scoped signatures, expired/revoked/paused/guardian-revoked credentials and wrong action scope, plus a clean temporary-directory install/CLI run and readable-secret-file refusal.

These fixtures establish the documented publication boundaries for the candidate source. They do not establish hosted MCP compatibility, external AI-harness provider integration, managed account recovery or production deployment. MCP qualification follows its own tasks and release evidence.
