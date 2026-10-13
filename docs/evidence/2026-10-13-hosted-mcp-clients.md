# Hosted MCP: Codex CLI, Claude Code and ChatGPT

13 October 2026. This follow-up implements the user's selected three clients on testnet. It extends the completed mini-app programme; production/privacy/independent-recovery gates remain held. The first ChatGPT account-side attempt had no tools or sign-in; successful linking and model tool use remain unqualified.

## Result and permission boundary

Codex uses its explicit public client ID and exact `http://127.0.0.1:35829/callback`. Claude Code uses its explicit public client ID and exact `http://localhost:35839/callback`. Each listener uses its registered fixed port. No wildcard port, hostname substitution, arbitrary HTTP host or changed path is accepted. Mini-app HTTPS validation is unchanged.

ChatGPT uses only its fixed `https://chatgpt.com/oauth/client.json` document and the exact published HTTPS callback. Startup validates the downloaded document with bounded bytes/deadline, TLS and redirects refused; it verifies identity, configured callbacks, public-client `none` support and code/refresh grants. Arbitrary client URLs never become fetch destinations. No open dynamic registration. Registered clients still need current member selection, PKCE, fresh body-bound Root account control and separately selected native scopes. Public metadata does not itself authorize a DAO.

The actual Claude CLI requested every advertised scope. The existing browser's read/preview option then remained disabled and the API refused approval without a companion. The fix removes submission scope when the member chooses no companion; the token reports its granted read/prepare scopes. Submit-only consent still requires a companion. The remote tool inventory has no private signer. A companion-bound family retains its native session, guardian, nonce, role, epoch and current code-pin checks. Root/profile keys remain outside tools and harness configuration.

MCP alpha.6 reported alpha.4 in both actual transport handshakes. A new immutable MCP **0.1.0-alpha.7** derives server identity from its package manifest; stdio and HTTP regressions first failed, then passed. Alpha.6 is preserved. Core public SDK **0.15.0-alpha.17**, modules **0.10.0-alpha.24** and native binaries/interfaces remain unchanged. Frontend advances to **0.15.0-alpha.21**, with concrete public testnet setup and working read/preview consent. No migration, erasure, DAO closure, asset movement or owner/active authority change.

## Verification observed before deployment

- Core full unit suite: **1,002 tests / 166 files** passed. This includes the bounded metadata, exact callbacks and existing authorization/accounting checks.
- Frozen MCP alpha.7 installed outside the checkout with exact core17/module24 peers; genuine stdio/HTTP package suite **12 / 7** passed. Metadata and server-version claims come from the package itself.
- Actual installed Codex CLI **0.162.0-alpha.17.2** with frozen alpha.7: local and hosted OAuth/read/prepare/trusted external signing confirmed once-only native votes, with no inference turn.
- Actual installed Claude Code **2.1.296** in an isolated runtime directory: preregistration, CLI OAuth, exact callback and genuine MCP initialization passed against the owned Spring/PostgreSQL fixture. The granted family contains read/prepare scopes and null native signer fields. Service revocation is checked. Model tool calls/signing remain unrun.
- Combined actual CLI/native and OAuth integration: **7 tests / 2 files** passed. Human/mixed/guarded journeys preserve scope, pause and native revocation checks.
- Frontend unit suite **342 / 58** passed. Desktop/mobile browser **4 / 4** passed, including actual native session retirement and read/preview approval when all scopes were requested. PKCE token exchange reports narrowed scopes and code replay fails.
- Browser regression against the previous consent view failed because its approval button remained disabled. The updated view passed. Earlier selector and terminal escape parsing errors were corrected in the test drivers.
- One combined run produced a redacted unexpected token-endpoint failure; a subsequent complete combined run passed. Its original cause was not established, so this is not recorded as a fixed product defect. A fixture-only redacted error-type/code hook makes a recurrence diagnosable without tokens or keys.
- Strict types/lint/build/docs passed before committing. All 140 public package/SDK/header/document files byte-match the frozen core17 archive. Production-only dependency audit found zero vulnerabilities; development dependencies are excluded. Final deployment evidence records clean locked installs and actual public-client checks separately.

MCP archive SHA-256: `cbab7d4608a1ab7dcdf2143190e1ceabb5c303de9d7d6a48847c08719d8c414b`.
MCP release ID: `3b829d0e1367706c09aeec681072cf691a7d3d3128a510be1200d0edfe68d00a`.
Manifest SHA-256: `d31425c600b2ea17440148a263aeb4286be7f6d15064ab41ae27da10f2c1af56`.

## Remaining account and operational checks

Actual ChatGPT linking, discovered tools and a model-selected membership/preparation call must be checked inside the user's real ChatGPT account. The connected plugin tools in this session cannot create a custom MCP connection; plugin discovery did not establish that capability. Server tests or another SDK cannot substitute for that client. [Official OpenAI instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt) show Plugins → plus → Add custom MCP server and account/workspace policy requirements. No plugin is published to the directory by this work.

Actual Claude model-selected tool use is also separate from CLI login/initialization; no Anthropic account authentication or inference key has been supplied. The shared tool layer and actual native Codex journey establish server behavior, not a Claude inference result.

When ChatGPT metadata verification is enabled, a provider outage/incompatible document blocks startup. The bound is ten seconds/16 KiB; the deployment rollback restores the earlier reviewed service configuration rather than bypassing validation. Public/native testnet checks use only the retained, explicitly owned seven-member qualification DAO. They do not erase or close it. Recovery remains the previously qualified single-host development topology and retains its existing expiry; independence is still unrun.


## Actual testnet delivery

Clean detached checkouts serve core `65ee66213b08bd4575cf683633d4a3c7869f53d7`, modules `455e2f311632fb546325a6b4ff240f23be069148` and combined frontend `15869000e8f32a9b8c1f42d60e063f63ddf5f186`. The newer DAO Settings source and its published evidence were merged without altering MCP source. The combined frontend is alpha.21, preserving both tested alpha.20 versions. The merged unit suite and desktop/mobile MCP checks passed again. Clean installs/builds and all three download SHA/size/ETag checks passed; the served frontend HTML matches its clean candidate.

Hosted MCP is now enabled **only on testnet**, with exactly three registrations. Public HTTPS discovery and the `/mcp` 401 resource challenge passed. Actual public Codex sign-in, membership read and proposal preparation returned a signer-required preview with no native submission. Actual public Claude CLI sign-in/initialization passed with the exact localhost callback. Four synthetic OAuth families were explicitly revoked after the successful run. No inference turn or ChatGPT account-side flow is inferred from these results.

The retained owned DAO `8122199153663004859` (seven members) predates governance-policy setup and had only Activity installed. The initial consent was correctly refused for missing policy, then proposal preparation was correctly refused for missing Decide. Its authenticated administrator used normal Root-signed native `setdaogov` and `modconfig` actions: human policy, 60-second duration, quorum5000/approval5001, zero commitment limits, no guardian, and pinned Decide actions open/vote/close with only govlock. No asset moved, proposal was submitted or participant key/role/session altered. Transaction IDs are recorded in the deployment JSON. These are synthetic fixture prerequisites, not permission bypasses or platform-owner setup required for every community. Older communities configure their own Governance and Modules through the existing administrator UI.

The public Mini apps page includes exact CLI commands and ChatGPT setup, with its account-side test explicitly pending. The ChatGPT account step has been presented to the user after the server, endpoint, artifacts and reviewable UI were complete. It is an external account-access requirement, not another platform authorization question.

## ChatGPT discovery follow-up

The user created the plugin, but its detail page contained no tools and it never opened Daclify sign-in. A read-only aggregate check observed zero ChatGPT OAuth requests/families; expired-request cleanup limits historical inference. Actual public unauthenticated initialization and tool listing returned 401. The original tools omitted OAuth descriptors. This established a server-side discovery gap, without treating the model's “tools unavailable” message as a native membership failure.

The new regression failed with initialization 401. The fix permits only individual initialization, initialized notification, ping and catalog-list requests before linking. It advertises each HTTP tool's required OAuth scope through the pinned SDK's supported `_meta.securitySchemes` mirror, plus safety annotations. Calls and batches still require authenticated current account/DAO/member authority; malformed/invalid credentials and foreign hosts/origins stay refused. No personal data becomes anonymous, and no new signer or scope is granted. The catalog/authentication regressions passed **4 / 1** after the fix.

Publish immutable MCP **0.1.0-alpha.8**, preserving alpha.7 and the frozen core17/module24/native artifacts. The frontend remains the combined alpha.21. Final delivery evidence records the new source, artifact and deployed discovery checks. Successful ChatGPT linking/model use still needs the real account-side refresh and test; the protocol regression is not a ChatGPT client pass.

The [official authentication guidance](https://developers.openai.com/plugins/build/auth) and [metadata reference](https://developers.openai.com/plugins/reference) document OAuth scopes/challenges and the metadata mirror. The [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) documents Refresh and starting a new conversation after metadata changes.
