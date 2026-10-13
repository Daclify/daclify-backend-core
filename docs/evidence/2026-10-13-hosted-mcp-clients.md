# Hosted MCP: Codex CLI, Claude Code and ChatGPT

13 October 2026. This follow-up implements the user's selected three clients on testnet. It extends the completed mini-app programme; production/privacy/independent-recovery gates remain held. Actual ChatGPT account-side connection and model inference are unrun.

## Result and permission boundary

Codex uses its explicit public client ID and exact `http://127.0.0.1:35829/callback`. Claude Code uses its explicit public client ID and exact `http://localhost:35839/callback`. Each listener uses its registered fixed port. No wildcard port, hostname substitution, arbitrary HTTP host or changed path is accepted. Mini-app HTTPS validation is unchanged.

ChatGPT uses only its fixed `https://chatgpt.com/oauth/client.json` document and the exact published HTTPS callback. Startup validates the downloaded document with bounded bytes/deadline, TLS and redirects refused; it verifies identity, configured callbacks, public-client `none` support and code/refresh grants. Arbitrary client URLs never become fetch destinations. No open dynamic registration. Registered clients still need current member selection, PKCE, fresh body-bound Root account control and separately selected native scopes. Public metadata does not itself authorize a DAO.

The actual Claude CLI requested every advertised scope. The existing browser's read/preview option then remained disabled and the API refused approval without a companion. The fix removes submission scope when the member chooses no companion; the token reports its granted read/prepare scopes. Submit-only consent still requires a companion. The remote tool inventory has no private signer. A companion-bound family retains its native session, guardian, nonce, role, epoch and current code-pin checks. Root/profile keys remain outside tools and harness configuration.

MCP alpha.6 reported alpha.4 in both actual transport handshakes. A new immutable MCP **0.1.0-alpha.7** derives server identity from its package manifest; stdio and HTTP regressions first failed, then passed. Alpha.6 is preserved. Core public SDK **0.15.0-alpha.17**, modules **0.10.0-alpha.24** and native binaries/interfaces remain unchanged. Frontend advances to **0.15.0-alpha.20**, with concrete public testnet setup and working read/preview consent. No migration, erasure, DAO closure, asset movement or owner/active authority change.

## Verification observed before deployment

- Core full unit suite: **1,002 tests / 166 files** passed. This includes the bounded metadata, exact callbacks and existing authorization/accounting checks.
- Frozen MCP alpha.7 installed outside the checkout with exact core17/module24 peers; genuine stdio/HTTP package suite **12 / 7** passed. Metadata and server-version claims come from the package itself.
- Actual installed Codex CLI **0.162.0-alpha.17.2** with frozen alpha.7: local and hosted OAuth/read/prepare/trusted external signing confirmed once-only native votes, with no inference turn.
- Actual installed Claude Code **2.1.296** in an isolated runtime directory: preregistration, CLI OAuth, exact callback and genuine MCP initialization passed against the owned Spring/PostgreSQL fixture. The granted family contains read/prepare scopes and null native signer fields. Service revocation is checked. Model tool calls/signing remain unrun.
- Combined actual CLI/native and OAuth integration: **7 tests / 2 files** passed. Human/mixed/guarded journeys preserve scope, pause and native revocation checks.
- Frontend unit suite **342 / 58** passed. Desktop/mobile browser **4 / 4** passed, including actual native session retirement and read/preview approval when all scopes were requested. PKCE token exchange reports narrowed scopes and code replay fails.
- Browser regression against the previous consent view failed because its approval button remained disabled. The updated view passed. Earlier selector and terminal escape parsing errors were corrected in the test drivers.
- One combined run produced a redacted unexpected token-endpoint failure; a subsequent complete combined run passed. Its original cause was not established, so this is not recorded as a fixed product defect. A fixture-only redacted error-type/code hook makes a recurrence diagnosable without tokens or keys.
- Strict types/lint/build/docs and frozen public SDK byte comparison are required before committing; final deployment evidence records their completion separately.

MCP archive SHA-256: `cbab7d4608a1ab7dcdf2143190e1ceabb5c303de9d7d6a48847c08719d8c414b`.
MCP release ID: `3b829d0e1367706c09aeec681072cf691a7d3d3128a510be1200d0edfe68d00a`.
Manifest SHA-256: `d31425c600b2ea17440148a263aeb4286be7f6d15064ab41ae27da10f2c1af56`.

## Remaining account and operational checks

Actual ChatGPT linking, discovered tools and a model-selected membership/preparation call must be checked inside the user's real ChatGPT account. The connected plugin tools in this session cannot create a custom MCP connection; plugin discovery did not establish that capability. Server tests or another SDK cannot substitute for that client. [Official OpenAI instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt) show Plugins → plus → Add custom MCP server and account/workspace policy requirements. No plugin is published to the directory by this work.

Actual Claude model-selected tool use is also separate from CLI login/initialization; no Anthropic account authentication or inference key has been supplied. The shared tool layer and actual native Codex journey establish server behavior, not a Claude inference result.

When ChatGPT metadata verification is enabled, a provider outage/incompatible document blocks startup. The bound is ten seconds/16 KiB; the deployment rollback restores the earlier reviewed service configuration rather than bypassing validation. Public/native testnet checks use only the retained, explicitly owned seven-member qualification DAO. They do not erase or close it. Recovery remains the previously qualified single-host development topology and retains its existing expiry; independence is still unrun.
