# Daclify community MCP

Development foundation: core `0.15.0-alpha.11`, modules SDK `0.10.0-alpha.18`, stable MCP server/client `2.3.1`. Native contracts are unchanged. This package has no published registry artifact or qualified harness invocation yet.

`createCommunityTools(access)` exposes `list_daos`, `get_membership`, `list_activity`, `prepare_proposal`, `prepare_activity`, `prepare_vote`, `prepare_review`, and `submit_signed`. Only an explicitly protected local `ProtectedCommunitySigner` enables `submit_prepared`. Tool errors are redacted. No tool accepts arbitrary target/action/data, a private key, SQL, treasury spending, or profile decryption.

The core Node client keeps the account-authentication signer separate from the registered delegate. Trusted SDK callers can share authenticated transport; that transport is never a tool. The module adapter uses released producer-owned schemas, module code hashes and ABI codecs. Proposal settings come from current DAO governance; the model cannot set payout or policy fields. Reviews require a current reviewer and an independent submitted milestone. Public proposals require public DAO output; private evidence is outside this initial inventory.

Routine sessions authorize supported `open`, `vote`, and `review` actions. Activity requires a separate app-bound session with the selected app ID and approved immutable configuration/revision. Each signing/submission checks current member, nonce, guardian, participant credential epoch, session expiry, role, policy and deployment. An unknown delivery freezes new preparation; the trusted harness must persist the original intent and packet before delivery and reconcile its native receipt before starting another event. Process memory alone is not a durable delivery journal.

M1 qualification uses actual MCP SDK client discovery/calls and actual native agent tests. Pairing, encrypted local storage, stdio invocation, hosted OAuth and harness compatibility are the following execution tasks. No production or universal harness compatibility claim follows from the foundation tests.
