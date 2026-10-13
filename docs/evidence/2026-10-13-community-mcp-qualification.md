# M4 — community MCP qualification

Source baseline: core `901775e`, modules `4613c0a`, frontend `4956daa`. Final M4 commits bind the changes and this evidence. Execution is inline; no independent reviewer or model inference was used.

Frozen development cohort: core `0.15.0-alpha.14` SHA-256 `bf2727ec8b91fab99abed23efa9e3a72a382aa26c27643f0af6ae7d16d208442`; modules SDK `0.10.0-alpha.21` `7ad5c595db38ab76becfe81d6aae12e77c5be71c9b20c7bb71d9359e37191f4b`; MCP `0.1.0-alpha.4` `6711cb65f8733d429385e16e6f006f83bae864ecead1cdd56272ea990f9a0770`; frontend `0.15.0-alpha.16`. Native WASM remains 991013 bytes, `64a721bb4718a4affa10bfabc8e2febfa902e1258c2dabbaf5ab19388f615372`; no native fields/indexes/migrations changed.

MCP download release `461e8aef226ce67e1e9a94cf0efe1921c03e6da3ff058092ef09c3ad21915cf5`, manifest `461d06e27226ead31f494a697cb6e250786e56b3f153b45066a4884248fbdda1`. Starter release `60a88d3e53c0c495d2c13dca722e6006ce393325cd592e713f5cb8e55dd09dd8`, manifest `f06ded44daadd6d87b6ac1eae68c6acdf006e29068155d645d780eb4612fa88b`. Historical artifacts remain unchanged.

| Client | Transport | Qualified evidence | Custody/limits |
| --- | --- | --- | --- |
| Official SDK 2.3.1 | stdio | Separate-process initialize/list/call/error/shutdown | Local protected signer; confirmation depends on selected mode |
| Official SDK 2.3.1 | Streamable HTTP | Actual resource discovery/OAuth and native externally signed vote from M3 | No hosted private key or `submit_prepared` |
| Codex CLI 0.162.0-alpha.17.2 | stdio via private companion | Actual app-server read→prepare→protected signing→irreversible native confirmation | Foreground terminal unlock; same-user private socket |
| Codex CLI 0.162.0-alpha.17.2 | HTTP OAuth | Actual discovery/PKCE/browser-equivalent fresh account proof/read/prepare/external signature→native confirmation | Exact fixed loopback callback; separately approved companion |
| Other harnesses, model inference, production HTTP | — | Unrun | Unavailable until their own qualification |

The genuine Codex test repeats from the frozen three archives installed without sibling source imports and relocated outside the development checkout. It checks one native vote per transport, no Root/delegate/password in output and removes its owned OAuth cache through the actual CLI logout. No inference turn or coding delegation starts. Human, mixed and guarded-agent native fixtures retain their own participant modes; the platform DAO is not converted.

Failures informed the implementation: native background job control stopped direct terminal unlock; the foreground companion fixes that boundary without passing passwords to the harness. The first remote driver expected the wrong completion notification; the installed app-server schema supplied the actual method. A repeat vote initially missed the published member/ballot lookup and failed only on chain; a regression now requests that bounded lookup and returns an allowlisted diagnostic before a new packet. Pending protected submission takes precedence over preparing another intent, preserving lost-response reconciliation. Four shared-IP journeys exhausted the original 30-request budget; the bounded local budget is 120 per five minutes, with 2000 limiter slots. Error bodies share the bounded byte reader while recognized error codes remain failures.

Package tests 12/7 files; real native/SQL pairing plus journeys 8/2; frozen-artifact journeys 4/1; core/package/frontend strict types, core lint/docs passed. Browser and final consumer regression results are appended after their runs; do not infer their completion from this draft.

Final producer checks: native 3/1, hosted HTTP integration 2/1, protocol/access 5/2, OAuth/artifact checks 4/2 passed. Core lint/build/docs and a byte comparison of all 110 frozen public SDK files passed. Frontend 334/56 units, types/lint/build passed with the existing Docs chunk warning. Browser final mobile retirement assertion remains pending at this producer commit; it is not yet a complete M4 gate. A new C3 RED test intentionally imports the not-yet-implemented directory and is excluded from this M4 commit.

Correction after the producer commit: the shell used for the final build/byte check did not stop after a TypeScript error in the new browser fixture optional property. The byte comparison passed, but that final build did not. Replace explicit `undefined` with an omitted optional artifact property, rerun strict checks, and retain this correction. Earlier types passed before that fixture addition. Desktop setup/revocation passed; the mobile test must open the existing Menu before selecting the sidebar route. The final rerun also verifies the native session is absent, beyond its relay response.
