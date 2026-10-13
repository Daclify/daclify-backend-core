# Hosted MCP OAuth implementation evidence

M3 source cohort: core/protocol `0.15.0-alpha.13`, modules SDK `0.10.0-alpha.20`, community MCP `0.1.0-alpha.3`, frontend `0.15.0-alpha.15`. Native contracts and their authorization/ABI pins are unchanged. Hosted deployment stays disabled; this is implementation and owned-fixture qualification.

The separate `/mcp` resource discovers issuer `<api-origin>/mcp/oauth` through RFC 9728/RFC 8414 metadata. Preregistered exact HTTPS redirects, mandatory resource on authorization/token, S256 PKCE and returned state/issuer bind consent. The trusted frontend requires fresh body-bound account proof. Opaque random tokens retain only SHA-256 hashes in additive migration 047; local/app bearer namespaces cannot authorize this resource. Access expires within five minutes, one-minute codes are single use, rotating refresh reuse revokes its family. Families expire within seven days or the earlier native companion deadline. Consent requests, token context and records are bounded; cleanup batches are at most 25 by default, families require no remaining tokens, and local-grant cleanup waits for referencing OAuth families. Per-account live families and per-family token records are capped at 32/512.

Every operation resolves the active canonical account, selected native membership, DAO policy, guardian, actor epoch and reviewer role. Companion operations additionally resolve the actual native session and Activity app scope. Hosted tools are read/prepare/external `submit_signed`; no hosted signer or root/private profile tool is registered. HTTP-only preparation returns a producer-owned `signer-required` preview outside the signed-preparation schema. Ready preparations and exact protected packet persistence share the qualified local service; an uncertain response keeps the original transaction reconciliation.

Fastify mounts the genuine SDK stateless handler, with validated bearer context per request, configured Host/Origin checks, bounded body, streamed response cancellation and separate OAuth form parser scope. Existing app form parsing is preserved. Both account-reconnection entry paths delete both owners' OAuth requests/families/tokens before local grants. Erasure uses the same dependency inventory; pending/erased accounts cannot insert fresh records.

Actual checks in this session:

- Initial RED missing OAuth service; strict claim/preview and community protocol/client tests: 9 passed across three files. Native SQL discovery/authorization/pairing/real hosted preparation→delegate signature→irreversible native vote/refresh replay: five passed across two files. The vote exists once in the real `decide::votes` table. The native fixture uses compiled actual WASM and the real relayer/delegate signatures.
- Additional parser coexistence RED reproduced the startup conflict with ordinary app form encoding; scoped parser replacement GREEN: two SQL/HTTP tests. OAuth token failure has the standard `invalid_grant` shape. A first HTTP test assertion incorrectly searched escaped JSON; corrected to inspect the real SDK result and observed principal trace. A native result parser was corrected for `event:`-first SSE and the actual published `votes` schema; no failed product assertion was removed.
- Genuine stable SDK server/client `2.3.1` HTTP initialization/discovery/calls/close with two independent principals: two passed. Complete package suite: ten passed across five files, including separate-process stdio. Transport-only fixture principals are not claimed as OAuth/native evidence.
- Wallet-only/restored reconnect: two passed, 42 intentionally filtered; each seeds both owners' local preparations and all OAuth token kinds/families/requests, and verifies deletion. Account erasure SQL suite: 23 passed, including dependency removal of OAuth and native-companion records. These database/erasure tests do not claim live user erasure or independent provider deletion.
- Real owned paid-native browser: four passed, desktop/mobile local pairing and hosted consent with real account proof/PKCE/token redemption/member read. HTTPS callback interception is the owned browser test destination; it is not an external harness qualification.
- Frontend 334/56, module public compatibility 6/1, strict root/package/frontend types, lint, builds and docs checks passed. Frontend docs chunk retains the existing large-chunk warning. Initial module next-version rejection assertion was advanced to the next unqualified version; no compatibility range was broadened beyond the tested exact core candidate.
- Clean installation of the three immutable archives outside the checkout loaded the real HTTP/tool exports successfully. Native contracts were not rebuilt or altered.

Immutable hashes:

| Artifact | SHA-256 |
| --- | --- |
| core protocol alpha.13 | `ef4e5edfae8dce4e7d828e3e948919643610a8832b3cb7c3441b3742b6b3e71c` |
| modules SDK alpha.20 | `d55e372697e519ddf09e1e37971ffbb19dd33dfe29534b9b286f0647669078cf` |
| community MCP alpha.3 | `5580f0dcc95fd04242a68397f214f951e424091ca5b83c54f74807821e9de141` |
| migration 047 | `5f4ae6a90088a8f512d3165b7667d094e6c2036b0406411b268eaf4dee806af8` |

Starter release `ddaf504bd621bd975409d37ba265a30a605903308bba7478e760ba833caecc46`, manifest `d1028bb653f46e7ce172abd80eca533db688cae622ecb0195af9495d36b0c650`.

Primary authorization requirements were verified against the [current MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization); SDK interfaces were read from the pinned installed v2 declaration files. Only the official SDK transport version and owned browser/native journeys above are qualified here. Third-party harness OAuth, independent recovery infrastructure, public hosted availability and production release remain outside this evidence.
