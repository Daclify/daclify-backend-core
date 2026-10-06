# DAO presets and guarded agents

This feature is on the codex/dao-presets-governance branch in all three repositories. It is a development prerelease, not a qualified production release.

Purpose and participants are independent. Choose community, NGO/grants, gaming guild, team/cooperative or custom; then choose human, mixed or guarded-agent participation. Presets initialise modules and an explicitly confirmed policy. They do not certify charitable status, game ownership, model behaviour or operator independence.

## Creation and authority

The API creates the DAO, saves its policy, enrols its founder and installs the required code-verified modules in one transaction. Missing required deployments fail creation. Agent-only creation takes public agent signing/encryption keys; the human sponsor receives no voting membership. Signing and encryption remain separate.

The shared native bootstrap owner retains native owner powers, and the runtime account controls upgrades. A saved policy does not remove those powers. Administrators control admission, roles, credits, module installation and policy edits. The human guardian account has a separate pause/revocation/recovery role. If a guardian is also a native owner or controls upgrade keys, it has those additional powers too.

Guardians can pause new commitments and obligation payouts for at most 24 hours per instruction, renew a pause, revoke an agent or recover a revoked agent signing identity. Recovery can impersonate that agent; it clears the native binding and invalidates previous scoped credentials without changing balances or encryption keys. It cannot decrypt previous documents without the corresponding keys. The UI prepares unsigned native guardian transactions for review and external signing; a Daclify session does not sign native guardian authority.

Guardian recovery changes the on-chain signing identity. It does not migrate an old HTTP account, social-provider links or an operator's signer configuration. The new signer must authenticate separately; retained encrypted documents still require their original decryption credentials.

## Policy and funding

Every ballot must match the saved weight, duration, quorum and approval. Policy changes require a signed administrator instruction and no active ballots. Each revision invalidates older pending Works funding plans; open a new vote. Participant mode, guardian and Decide account are not editable through an ordinary policy update.

The per-milestone/installment cap and UTC-day cap apply when new obligations are reserved. They are commitment limits, not same-day payout limits. Cancellation does not refund a day's allowance. Guarded-agent DAOs require both limits and governed Works funding.

Works funding votes pin one project and all milestone records, module code, DAO/runtime, policy revision and a seven-day execution window after close. Only a passed finalized vote reserves funds. Execution is once-only and atomic. It does not approve a deliverable; contributor evidence and independent member review remain separate. Distinct keys do not establish independent operators.

## Programmatic accounts

The generated SDK exposes addmember, addsession, delsession, submitsess and guardian action encoders. Sessions allow at most 16 stored credentials per member, 16 target/action permissions per credential and seven days of lifetime. Root and delegated requests share the member nonce. Routine scopes exclude administration, withdrawals and further delegation; module scopes pin code. Delete old entries to free slots.

A Works review scope can approve delivery within the member's existing reviewer authority, making a funded obligation payable. Voting scopes can vote for funding. These are consequential permissions: the publishing-only example and UI credential do not grant them. The governance API currently refuses snapshots above 5,000 credentials rather than returning a partial authority view; larger sets need pagination.

The examples/agent-publish.ts script demonstrates a scoped login and signed public JSON publication through the API. It uses the pinned public protocol, not private service imports. Supply the DACLIFY_AGENT_* variables named in the script through protected local configuration; never put signing keys in a prompt, repository, command history or logs. The API must permit the script's declared origin. The example refuses private DAOs and prints only a transaction receipt. It is not an autonomous decision engine or a custody provider.

Large content continues to use IPFS/Pinata. Encrypt private content before publication; sending decrypted content to a model provider is a separate disclosure. Existing production custody/provider and deployment qualifications remain open.

## Compatibility and merge

Metadata schema 1 remains readable. Schema 2 preserves the resolved initial preset snapshot. Core adds govpolicies, actors, sessions, guards and budgets; Decide adds executions. Existing DAO/member/ballot/project/milestone layouts remain unchanged. Native execution requires links for the new core callbacks and Decide openwork. The updated local fixture permission tooling demonstrates these links; a real deployment needs a separately prepared, reviewed permission plan. No production permission changes are performed by this branch.

The public packages and application advance together to 0.2.0-alpha.1. Additive API response fields and capabilities can break strict 0.1 clients even though native interface version 1 and existing table encodings remain unchanged. Upgrade API consumers and their pinned protocol/module artifacts together; this branch does not qualify old HTTP client compatibility or a production migration.

Merge core, modules and frontend together, resolve source conflicts first, then regenerate ABI SDKs, code hashes, references and package locks with the development bootstrap. Do not choose one side of generated-file conflicts as the final artifact. Align the prerelease version with other branches before publishing. Existing release gates remain in force.

Likely overlaps with the concurrent marketplace work: runtime actions and common records, native-chain and server, API client and generated docs/SDKs. This branch does not alter the marketplace, billing, naming or legacy repositories.

The isolated native fixture uses daclify-dao-presets-native on port 19888 and a separate PostgreSQL container on port 16432. Original agents' containers and worktrees are untouched. Core's regular unit suite, module WASM tests, new native/API flows and browser presets have separate evidence; an emulator check is not a native check.
