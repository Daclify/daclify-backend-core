# Connect an AI harness to a community

Use the frontend's **Mini apps → AI connections** page to choose a current membership, routine permissions and the version-matched download set. Install `core.tgz`, `modules.tgz` and `mcp.tgz` together. The public connection JSON carries API/frontend origin, DAO, membership and permissions; it carries no secret.

On a trusted Unix host, create a private directory with mode `0700`. Pair through a foreground terminal:

```sh
npx daclify-community-mcp pair --config /absolute/daclify-mcp-connection.json --credentials /absolute/private-directory/delegate.json --socket /absolute/private-directory/companion.sock
npx daclify-community-mcp serve --credentials /absolute/private-directory/delegate.json --socket /absolute/private-directory/companion.sock
```

Approve the browser's exact membership, permissions, public delegate and expiry. Choose automatic scoped actions or trusted confirmation. Unlock the encrypted replaceable delegate in the foreground terminal and keep that companion running. Configure the harness with the generated `bridge` command and socket reference. The background process receives neither an unlock password nor a Root key. Closing the companion removes its socket. A copied delegate remains governed by its native session until expiry or explicit native retirement.

For hosted HTTP, use the deployment's advertised resource and exact preregistered client. Complete resource-bound PKCE consent in Daclify. Read/prepare without a companion produces a `signer-required` preview. Submission needs a separately approved companion and an external signature over the validated prepared packet. Hosted tools never expose `submit_prepared` or a private signer.

The tested harness is Codex CLI `0.162.0-alpha.17.2`, using actual app-server MCP tool calls with no inference turn. Official MCP SDK client/server `2.3.1` is tested separately. This does not qualify other clients, Codex inference, production endpoints or a provider secret-store adapter. Check the versioned guide's matrix.

Current native authority is checked again before signing and submission. A guardian pause, expired/revoked session, changed membership/policy or wrong code pin stops the operation. A repeated vote is refused. An unknown delivery reconciles the original protected packet before another preparation. Service revocation and native session retirement are separate controls on the connection page; use both when retiring a copied delegate. Guardian recovery and account Root ceremonies remain deliberate trusted actions outside model tools.
