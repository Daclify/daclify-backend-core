# Connect a local AI harness

The local connection is self-service for a community member. Daclify's owner does not register or approve the harness. A member approves a new public delegate through the ordinary Daclify account screen. Routine proposals/votes/reviews and app-specific Activity grants are separate. A human assistant acts as its enrolled human member; an enrolled agent retains the DAO's guardian, credential epoch and budget rules.

1. Use the version-matched MCP package and immutable core/modules artifacts from the connection download. Install those three archives together. Run `daclify-community-mcp pair --config /absolute/public-connection.json --credentials /absolute/private-directory/delegate.json --socket /absolute/private-directory/companion.sock` on a trusted host with a controlling terminal.
2. Open the printed Daclify consent URL. Sign in with your existing account, preserving the return route. Verify the community, member, new delegate public key and requested actions. Choose trusted-terminal confirmation for each local signature or explicitly authorize automatic routine actions.
3. The browser signs `addsession` or `addappses` and then approves the same request using a fresh body-bound account proof. The harness never receives the account root key or recovery kit. A request expires in five minutes and its PKCE verifier redeems it once.
4. Set a local encryption password of at least 16 ASCII characters in the trusted terminal. The delegate/token are authenticated-encrypted in a `0600` file under a `0700` directory. Put the generated command/args/reference into your harness configuration; it contains no private key, password or bearer token.
5. Start `daclify-community-mcp serve --credentials /absolute/private-directory/delegate.json --socket /absolute/private-directory/companion.sock` in a trusted foreground terminal and unlock there. Keep it running. The generated harness command uses `bridge --socket` and carries MCP only; it receives no password or signing key. The Unix socket requires an owned `0700` directory and `0600` mode. Direct `serve` in a background process cannot unlock the terminal; use the companion bridge. Do not put passwords in model prompts, command arguments, environment variables or harness JSON.

Tools: `list_daos`, `get_membership`, `list_activity`, `prepare_proposal`, `prepare_activity`, `prepare_vote`, `prepare_review`, `submit_signed`. Only the protected local signer adds `submit_prepared`. Every preparation/sign/submission rechecks member, nonce, session expiry/epoch/revocation, guardian, current policy and module code pins. Reviews require an independent current reviewer; private evidence/profile decryption and root/treasury administration are outside this initial inventory. Activity grants pin the selected approved app configuration/revision.

The backend persists the exact protected native transaction before submission. A missing response reuses its transaction ID and bounded irreversible-block reconciliation. No new event or replacement packet is created while an earlier delivery is uncertain. Pending preparations, pairings, grants and their native sessions have finite lifetimes and bounded cleanup. Key material stays outside the model-visible tool arguments/results.

Run `status --credentials /absolute/private-directory/delegate.json` for current public grant status. Run `revoke --credentials ...` to revoke the service token and remove this local file; also retire the corresponding native session through Daclify to disable independent delegate copies. Account erasure blocks the grant immediately and deletes its service records. Reconnection invalidates both owners' pairings/grants instead of inheriting consent. Authorized recipient/exported copies are independently controlled.

This guide describes the implementation in review. The capability matrix and exact clean-install/native/browser/harness evidence are recorded separately. Local tests do not qualify hosted OAuth, a remote-only signer, independent recovery infrastructure or production availability.

## Hosted HTTP access

A hosted client connects to the canonical API `/mcp` resource. Its separate OAuth issuer is `<api-origin>/mcp/oauth`; discover the resource at `/.well-known/oauth-protected-resource/mcp` and the issuer at `/.well-known/oauth-authorization-server/mcp/oauth`. The deployment preregisters each client's exact HTTPS or fixed native loopback redirect URI. Known ChatGPT metadata is verified at startup; arbitrary client URLs are never fetched. Open registration and wildcard redirects are unavailable. Send the exact resource in both authorization and token requests; use S256 PKCE, preserve state, and verify the returned issuer. Ordinary mini-app and local pairing tokens are refused here.

Clients can initialize and list the fixed public tool catalog before linking an account. The catalog includes each HTTP tool's OAuth scopes in the supported `securitySchemes` metadata mirror and accurate read/write annotations. Only individual metadata requests are public; tool calls, request batches, foreign origins/hosts and invalid supplied credentials still require authorization. An unauthenticated tool call returns the protected-resource OAuth challenge. Catalog discovery exposes no account, membership or private data.

The HTTP authorization boundary ignores unknown OAuth query parameters such as `ui_locales`, while refusing duplicated parameters. If a client requests `openid` alongside Daclify scopes, the request is narrowed to the supported DAO scopes before storage and consent. Daclify does not issue an OpenID Connect identity grant or ID token; token responses report only the actual granted Daclify scopes. An `openid`-only request, other unsupported scopes, mismatched client/callback/resource and invalid PKCE remain refused. Canonical persisted requests and public SDK schemas remain strict.

The trusted Daclify consent screen binds a selected current DAO/member and explicit scopes: `daclify:read`, `daclify:prepare`, `daclify:submit`. Preparing also needs selected native proposal/vote/review/Activity scopes. Choose read and preview without a native companion, even when a client requests all advertised scopes. Consent removes `daclify:submit` from that grant and the token response reports only the granted scopes. A client without a native companion receives a canonical `signer-required` preview; it cannot sign or submit. A submit-only request still requires a companion. Activity needs its separately authorized app companion. Signed submission binds an existing local native grant approved by the same account. The remote tools never include `submit_prepared` and never receive root/private keys.

Access lasts at most five minutes. Refresh tokens rotate; reuse revokes the family. Consent expires after five minutes, authorization codes after one minute, and families after at most seven days or the native companion's earlier expiry. Each operation checks current canonical account, membership, guardian, reviewer role and credential epoch. Native companion removal, reconnection and erasure invalidate access. Exact protected submission packets retain the same reconciliation rules as local access.

Hosted access is separately gated by `COMMUNITY_MCP_HTTP_ENABLED=1` and a nonempty exact `COMMUNITY_MCP_HTTP_CLIENTS` configuration. Enable it only with a version-matched release and recorded client qualification. Testnet registration and actual public-client checks are recorded separately from production and ChatGPT account-side qualification. Browser applications must use the trusted Daclify origin; transport tests with the official SDK establish that tested client version only.

## Connection downloads and revocation

Renewal clears this member's expired native delegates automatically before new consent is approved. The restricted relay calls the existing permissionless `pruneappses` action; the contract checks expiry and removes at most 25 IDs per action. It cannot remove a live delegate or consume the member's Root nonce. Deployed relays need the reviewed `pruneappses` operator action link. Service revocation remains separate from explicit retirement of a still-live native delegate.

The Mini apps page offers an AI connection setup section when local MCP is enabled. Choose a current membership and routine proposal/vote/review scopes. Download public configuration and the three matching core/modules/MCP archives, verify their displayed SHA-256 values, and install them together. Configuration contains public context only. Activity follows its separately approved app configuration/revision.

The page lists local delegates and hosted OAuth families for the current account, including revoked service entries until expiry. Service revocation needs fresh account control. Native session retirement separately signs `delsession`, which also removes an app scope if present; only that native action disables independent copies of the delegate. A lost native response requires checking the original session before issuing another instruction. Renewal uses fresh pairing/consent; it never widens a paused or revoked grant automatically.

A dedicated MCP OAuth client may also preregister exactly `http://127.0.0.1:<fixed high port>/callback` for Codex or `http://localhost:<fixed high port>/callback` for Claude Code for a native harness whose actual listener is configured to that same port. Only that exact URI matches: no wildcard ports, implicit hostname substitutions, arbitrary HTTP hosts, query or fragment. This exception belongs to MCP; mini-app web origins/callbacks retain their HTTPS contract. Codex supports a preregistered client ID and fixed listener/callback configuration according to its [current official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Documentation compatibility does not by itself qualify a Daclify journey; consult the exact tested-client evidence.

The foreground companion accepts at most four same-user socket connections, 32 KiB input buffers and 16 subscriptions per connection. Every call retains the same native/member/session/policy checks and trusted confirmation or explicitly authorized automatic routine policy. Stopping the companion closes its owned socket; it does not create a new signing grant or replace an uncertain native packet. This adapter is for a qualified Unix host; other operating systems/secret stores require separate evidence.


## Tested client capabilities

| Client | Transport | Read / prepare | Signing / submit | Limit |
| --- | --- | --- | --- | --- |
| Official MCP SDK 2.3.1 | stdio and hosted HTTP | Tested | Protected local delegate; externally signed hosted submission | Source/native/OAuth evidence is separate from transport-only fixtures |
| Codex CLI 0.162.0-alpha.17.2 | Local stdio through private Unix companion | Tested with actual app-server RPC client | Terminal-unlocked companion, confirmed native submission | Direct background terminal unlock is unavailable |
| Codex CLI 0.162.0-alpha.17.2 | Hosted HTTP with preregistered fixed callback | Actual OAuth, read and prepare tested | Separate companion validates/signs; hosted submit confirms natively | Provider/model inference and private-data tools are outside these tests |
| Claude Code 2.1.296 | Hosted HTTP with exact localhost callback | Actual CLI OAuth and MCP initialization tested on owned native fixture and public HTTPS testnet; model tool calls unrun | No remote private signer; read/preview consent has no submit scope | The native fixture checks fresh Root consent and logout revocation; this is not model inference |
| ChatGPT | Hosted HTTP with verified `https://chatgpt.com/oauth/client.json` | Connection UI observed; authorization parameter correction tested separately | Remote signing remains unavailable | Retry linking after the correction, then qualify actual sign-in and tool use |
| Other harnesses or operating systems | Their own transports | Unrun | Unrun | Requires an actual version-bound journey before promotion |

Human, mixed and guarded-agent native/SQL journeys exercise scope, guardian pause after preparation and key separation. The client does not enroll a human's assistant as an agent automatically. A prior vote is checked through the producer's member-specific native vote lookup before another signing request; native enforcement remains authoritative. For an uncertain packet, reconcile that exact transaction before requesting another event or nonce. Exact source/artifact pins and remaining qualification are recorded in the release evidence; an enabled capability on one deployment does not imply production availability.


## Codex CLI, Claude Code and ChatGPT on testnet

The public endpoint is `https://testnet.api.daclify.com/mcp`. A current DAO governance policy is required for hosted consent. For an older DAO without one, its administrator configures Governance in DAO Settings; proposal/vote preparation also needs the verified Decide module enabled under Modules. Activity has its separate app permission. Configure these through the normal community administration screens before requesting matching scopes; reconnecting alone cannot repair a missing module or policy. The Mini apps page shows these public configurations when that deployment advertises hosted MCP. Members approve their own DAO and native scopes in Daclify; nobody needs the platform owner's personal approval or a client secret.

For Codex, add this configuration, then run `codex mcp login daclify_testnet`:

```toml
[mcp_servers.daclify_testnet]
url = "https://testnet.api.daclify.com/mcp"

[mcp_servers.daclify_testnet.oauth]
client_id = "daclify-codex-testnet"
callback_url = "http://127.0.0.1:35829/callback"
callback_port = 35829
```

For Claude Code:

```sh
claude mcp add --transport http --client-id daclify-claude-testnet --callback-port 35839 daclify_testnet https://testnet.api.daclify.com/mcp
claude mcp login daclify_testnet
```

Both clients need the corresponding callback port free on the computer running the CLI. On a headless Claude host use `claude mcp login daclify_testnet --no-browser` and paste the complete approved redirect back into the trusted terminal. Daclify's browser approval still requires the member's current account proof. The API does not accept an unregistered client, substitute hostname or another port. These commands use public client IDs, without a client secret or bearer header.

For ChatGPT, open [Plugins](https://chatgpt.com/plugins), choose the plus button and **Add custom MCP server**. Enter the endpoint above, a name such as **Daclify testnet**, and OAuth authentication. Choose client metadata registration when offered. Review the connection and its eight discovered tools, then create/install the resulting plugin. Start a new **Work** chat, type `@` and select that plugin. Ask: “Use Daclify testnet to show the DAO I authorized and my current membership.” Complete Daclify sign-in and choose a community and read/preview or an existing approved companion when linking is requested. For a proposal preview, select proposal permission in consent and ask: “Preview a proposal to hold a weekly community meeting; ask for any missing information.” Read/preview access cannot submit the proposal. Each grant selects one DAO; another DAO needs separate consent. Account/workspace policies can restrict custom connections. The real account now reaches the connection UI; its subsequent `INPUT_INVALID` request exposed the `ui_locales` and additional `openid` compatibility issues addressed at the HTTP boundary. Successful account-side sign-in and tool calls remain to be qualified. Follow the [official connection instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt) for the current account surface.

If a connection created before the catalog fix shows no tools, open it in Plugins and select **Refresh**, confirm `list_daos` and `get_membership` are listed, and start a new Work chat with the plugin selected. A model response saying its tools are unavailable does not establish a missing membership. Check discovered tools and OAuth linking first; do not invent a client ID, use a wildcard callback or put account keys in the conversation.

ChatGPT's exact client ID is `https://chatgpt.com/oauth/client.json`; its verified document currently lists `https://chatgpt.com/connector_platform_oauth_redirect`. The API fetches only that fixed HTTPS document at startup, refuses redirects, bounds its bytes to 16 KiB and its deadline to ten seconds, verifies identity/registered callbacks/code and refresh grants, and requires public-client `none` support. It never fetches arbitrary client metadata or opens dynamic registration. A provider outage or incompatible document blocks startup with this registration enabled; restore the previous reviewed configuration rather than bypassing validation. The prior metadata document's legacy singular private-key method does not override its explicit supported-method list.

Current client interfaces were checked against [official Codex documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [official Claude Code documentation](https://code.claude.com/docs/en/mcp), and [OpenAI OAuth requirements](https://developers.openai.com/plugins/build/auth). Exact installed versions and deployment results belong in the dated qualification evidence. Protocol tests and CLI sign-in do not establish an inference journey or private-data access.
