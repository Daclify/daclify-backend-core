# Proposal: optional Telos Privacy payments for Daclify

**Date:** 2026-10-16. **Status:** research proposal; no integration, deployment or asset movement authorized by this document. Requested separately from [Daclify content encryption](../superpowers/specs/2026-10-16-maximum-content-privacy-design.md).

## Proposed decision

Investigate Telos Privacy as an optional payment rail, starting with user-controlled shielded accounts and a tightly bounded recipient-payment pilot. Keep Daclify's existing native treasury, voting, liabilities and claims authoritative until a separately reviewed settlement design proves once-only reconciliation. Do not market this integration as hidden DAO membership, private native governance or a fully confidential treasury.

The immediate deliverable is an evidence-backed feasibility spike with no community funds. The decision to ship a payment adapter follows its results, rather than assuming an EVM privacy pool can execute current Antelope DAO contracts privately.

## What the current primary sources establish

Telos documents zkTelos pools for WTLOS and USDC.e on EVM chain 40, with deposit, shielded transfer and withdrawal operations. This establishes a candidate token-payment integration, not a general encrypted-contract runtime. [Telos Privacy overview](https://docs.telos.net/privacy/), [architecture](https://docs.telos.net/privacy/technical/architecture/).

The published pool proxy addresses are `0xB5340818eE78D6221f631495346E2e55DA5BcA58` for WTLOS and `0xe47A4F0099cA16d61C678Dc75911F91e11deDAa3` for USDC.e. The docs describe upgradeable proxies. Treat addresses as research inputs: independently check chain ID, bytecode, implementation slots, upgrade owners, token contracts and verifier hashes at a recorded block before use. No bytecode or authority verification was performed for this proposal. [Deployed contracts](https://docs.telos.net/privacy/contracts/).

The security documentation explicitly exposes deposit source/amount and withdrawal destination/amount, while protecting internal transfer details. Thus a public DAO depositing a salary-sized amount may still disclose the originating payment and allow timing/amount correlation. Pool participation and traffic do not become invisible. [Privacy limitations](https://docs.telos.net/privacy/compliance/).

Direct deposits accept tokens from another contract and queue a credit to a shielded address. The documentation lists a `directDeposit(address,uint256,string)` example. This is a useful integration candidate, but its exact deployed ABI, events, refunds and queue behavior require verification. A public call cannot make its visible calldata and token transfer disappear after queue processing. [Direct deposits](https://docs.telos.net/privacy/direct-deposits/).

Shielded accounts use a spending key separate from the public EVM address. Telos describes wallet-signature derivation or an independent mnemonic, and fresh receiving addresses. Daclify must qualify exact derivation and recovery against the deployed wallet/SDK, without reusing governance proofs or sending spending material to the API. [Shielded accounts](https://docs.telos.net/privacy/shielded-accounts/).

The client guide identifies `zkbob-client-js`, local proving, proving assets, and an account-less inspection mode. Its snippets include placeholders and framework assumptions; they are not a production integration recipe or a verified package pin. [Client SDK](https://docs.telos.net/privacy/developer/sdk/).

The relayer API returns asynchronous jobs and publishes pool synchronization data. Its `/proof_tx` debug endpoint sends secret inputs to the server and must never be used for user funds. The docs do not establish a qualified Daclify relayer endpoint, limits, uptime or chain-41 deployment. [Relayer API](https://docs.telos.net/privacy/developer/relayer-api/).

## Privacy that each candidate actually provides

| Candidate | Benefit | What remains public / unresolved |
| --- | --- | --- |
| Connect a personal shielded account | User can receive and transfer within the pool using their own spending key | Pool entry/exit, network metadata and Daclify's existing public memberships |
| Pay a DAO obligation into a recipient's shielded address | Protects subsequent in-pool activity and avoids exposing a reused public recipient address | Current native obligation already records recipient member ID/amount; direct-deposit input and source transfer may also be visible |
| Maintain a shielded DAO balance | Could support transfers from inside the pool | Current SDK's single spending key is not DAO voting/multisig authority; key custody, executive turnover and approved settlement proofs need a new design |
| Private DAO membership/voting | No automatic benefit from the token pools | Requires different circuits/authorization and commitments; outside the payment pilot |

The maximum useful first claim is **payment into a shielded account with explicit public entry information**, not private salary amount, anonymous recipient or secret native treasury. Do not attach a public member-to-shielded-address directory. A recipient submits their chosen destination through an authenticated encrypted channel and reviews the disclosure before payment.

## Proposed stages

### P0 — qualify dependencies without credentials

Pin the actual Telos deployment/source revisions, proxy authorities and verifier/parameter hashes. Confirm whether a supported testnet exists. Obtain the operational relayer URL from verified configuration/source; do not use a documentation example URL as proof of service. Fetch fee/limit/status information in account-less mode with timeouts and response bounds. Measure supported token decimals and pool-unit conversion using integer arithmetic and round-trip tests, rather than copying the example's 9-decimal assumption to both assets.

Review inherited zkBob audit scope against Telos modifications, the trusted-setup artifacts and deployed verifier inputs. Document pause, denylist, upgrade, fee, queue-cancellation, relayer censorship and emergency-withdrawal behavior from source. General statements about non-custody or compliance do not establish these implementation details.

### P1 — local or qualified-testnet owned account spike

Use disposable accounts and assets only. Build proofs locally in an isolated browser worker; pin and verify WASM/proving assets and benchmark first-load size, peak memory and proof time on desktop/mobile. Fail closed on missing local proving; never fall back to remote secret-input proving.

Verify supported EOA and contract-wallet behavior, deterministic derivation, changes of wallet/network/origin, key export, fresh-device recovery and loss. Shielded keys remain independent from Daclify signing/document keys, with explicit encrypted local persistence and lock behavior. No key material in backend logs, analytics, service workers or ordinary app backups.

Exercise deposit, internal transfer, withdrawal, rescan and recovery after local-state loss. Compare actual calldata/events/token transfers against the privacy claim. Tampered parameters, invalid proofs, stale roots, reorgs, rejected jobs and unavailable relayers must fail safely. A mocked successful job is not pool verification.

### P2 — recipient payment adapter, conditional on P0/P1

Define a producer-owned payment intent binding full DAO/runtime identity, approved obligation, asset and exact amount, destination commitment, expiry and user consent. Before signing, disclose public amounts, member linkage, native/EVM boundary and fees. Recipient address commitments must use randomness and domain separation; never publish low-entropy plaintext hashes as privacy.

Keep stages explicit: `prepared`, `submitted`, `queued`, `credited`, `refund-pending`, `refunded` and `failed`, with legal transitions and durable idempotency. A mined EVM transaction or relayer job alone does not prove that the intended recipient has a spendable shielded credit. Require verified finality and an exact, independently validated settlement receipt/proof before consuming the obligation. A browser confirmation or operator assertion cannot cancel a native claim.

For native TLOS obligations, separately prove native-to-EVM conversion, token custody and cross-runtime settlement/refund behavior. Shared native ownership must not merge DAO balances. Do not mark a native claim paid simply because a user made an unrelated EVM deposit. If the required cross-runtime evidence is unavailable, leave this adapter disabled and limit the pilot to personal shielded-account support.

### P3 — confidential DAO treasury research, separate decision

Study threshold-controlled shielded spending, governed recipient/amount proofs, solvency/reservation commitments, executive succession, emergency exits and selective audit disclosure. Never give each executive the same unrestricted spending key and call that multisig. A service holding that key would introduce custody. This stage requires a reviewed threat model and protocol evidence before a product implementation plan.

## Daclify integration boundaries

- **Core:** verified provider configuration/capability discovery, bounded public status, payment-intent/receipt schemas, durable idempotent jobs and independent finality checks. Store no spending key or private witness. Keep native liabilities until settlement is proven.
- **Frontend:** optional client-side account/receipt/proof flows, lazy-loaded proving worker, destination/fee/disclosure review and existing account/network context guards. A native Anchor pairing alone does not prove control of an EVM shielded account.
- **Modules:** Works/payroll consume approved settlement capabilities only; proof rejection and feature removal preserve outstanding claims. No module can bypass approved amounts, recipients or once-only settlement.
- **MCP/AI:** may report public capability or job state when authorized; cannot receive spending keys, private witnesses, viewing keys or decrypted payment histories. Remote agent custody requires its own explicit product policy.

## Evidence required for a release proposal

1. Recorded source/deployment/authority/parameter hashes, exact SDK/license/dependency review and a qualified endpoint/network matrix.
2. Real owned-fixture proof/transaction/recovery results, actual privacy observations and unavailable/skipped cases.
3. Measured browser bundle/WASM download, proof memory/time, synchronization cost, gas/relayer fees and queue behavior. No invented performance numbers or fixed delivery estimate before the spike.
4. Demonstrated no-duplicate payment, preserved native claims through every partial failure, exact decimals and provable refund/settlement finality.
5. Independent review of the Daclify adapter, cross-runtime custody and proof boundaries. Upstream audit history alone does not audit this integration.

## Open external facts and recommendation

Still unverified: a supported privacy testnet, authoritative relayer endpoints, exact live proxy administrators, Telos-specific audit coverage, eligible production limits, full wallet matrix and sufficient cross-runtime settlement evidence. Resolving these may require information from Telos; this document does not authorize contacting anyone.

Proceed with P0 research and an owned local/testnet P1 spike after design review. Keep payments disabled until the required evidence exists. Continue native content encryption independently so privacy improvements do not depend on this external payment rail. No production-fund movement, automatic asset migration or promise of legal compliance follows from this proposal.
