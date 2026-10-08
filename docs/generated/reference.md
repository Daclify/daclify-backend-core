# Daclify core reference

Package 0.7.0-alpha.1 · interface 1.

Generated from compiled ABI and canonical API schemas. Field layout does not describe all contract business rules; read the matching explanatory guides.

## What encryption protects

Private DAO documents are encrypted in the browser before they reach Pinata or the public IPFS network. Signing and document decryption use separate keys.

Memberships, voting activity, outcomes, balances, timing, and content hashes remain visible on a public blockchain. This release does not provide anonymous governance.

Deactivating a member advances the epoch for future content; an authorized administrator must initialize its new key and grants. This cannot erase plaintext or old keys the member already kept. Re-pinning preserves ciphertext, not confidentiality after a key compromise.

## Two clearly labelled account modes

Sign in with your Daclify keys or a previously paired supported email, Telegram, passkey, Telos Zero account or Telos EVM wallet. A currently activated on-chain wallet can also reconstruct wallet-only access after the service database is lost. Signing in and recovering service access do not create membership or grant new permissions in a DAO. Provider availability depends on server configuration; complete Google browser login remains unfinished.

Adding or removing a sign-in method requires a fresh proof from existing Daclify keys or an already verified paired wallet, plus proof of the incoming credential. Review the exact credential before confirming. Removal revokes sessions opened with that credential; history is available in Account → Sign-in.

A paired native or EVM wallet can authorize governance after explicit activation for the same member in each DAO. It adds no member or voting weight. Private documents still require the separate encryption keys.

User-controlled accounts keep encrypted signing and decryption keys in your browser. Recovery requires the encrypted kit and its separate recovery credential. Social login and publicly visible wallet signatures cannot recover or derive these keys.

Managed recovery delegates signing and decryption recovery to an operator. OpenBao remains the open-source candidate; production custody is gated on isolated service, audit, provider and recovery qualification.

Accounts with vault keys can share Account → Keys → Public join identity with a DAO administrator. Never share recovery kits or their credentials. A saved service-to-member association can survive DAO signing-key rotation while its database exists; a lost mapping cannot make an old signing key current again. Current chain permissions and wallet bindings remain authoritative.

## Choose how to operate your DAO

Shared contracts and hosting: create a DAO free with 10 active member slots. Daclify runs the contracts and server; the operator retains contract upgrade authority. Additional capacity needs an administrator-approved monthly subscription. Storage, AI and blockchain resources are separate.

Your contracts and server: operate your Antelope C++ deployment and backend, and use the Daclify frontend with an explicitly approved operator connection. Contact Daclify for pricing. You own deployment keys, server configuration, backups and blockchain resources.

Your complete DAO portal: operate contracts, backend and frontend. Publish public DAO metadata and an HTTPS portal URL in the Hub; its card links to your portal. Contact Daclify for pricing. The Hub does not receive your private keys, database or Stripe credentials.

Owner-authorized Hub registrations advertise the chain, runtime, reviewed code and raw ABI hashes, interface version, operator and per-DAO portal mode. Registration is discovery, not a security audit or endorsement. Service accounts and social-login pairings belong to each operator; an advertised API is not automatic single sign-on.

Daclify Connect lets either hosted or independent operators use their own merchant account through the central payment service. Fully standalone Stripe requires an independently operated backend and frontend; those payments do not automatically remit Daclify commission.

## Configure modules, keep core rights

Module manifests declare version compatibility, configuration schemas, permissions, and contextual help. A DAO must explicitly grant contract capabilities.

Decide provides governance ballots. Works provides proposals, milestones, and review. Payroll schedules bounded payment obligations. Contract authorization remains the source of truth.

Core governance is free. Operations tiers may charge for optional integrations, automation, or resource capacity. Expiry must not block approved liabilities, withdrawals, exports, or key recovery.

## Treasury and backed obligations

A native asset is identified by chain, token contract, symbol, and precision. Matching a symbol alone is insufficient.

Funds move from available to reserved when an obligation is created. Review approves it. Settlement either transfers native tokens or credits a backed internal claim.

Approved liabilities remain payable after module removal or subscription expiry. Offboarded members retain financial exit rights. Internal governance credits are not redeemable treasury balances.

The treasury view shows reserved, approved, settled and cancelled obligations. A signed-in user can request settlement of an already approved, due obligation; the contract chooses its recorded recipient and amount. This does not require reinstalling the source module. Existing internal claims and governance stake can be withdrawn through a signed instruction to an existing native payout account.

An administrator can record one DAO-confirmed external payment statement with a signed instruction. It names the chain, payer and reference, and it must repeat the approved obligation’s recipient and exact asset amount. Reusing that reference for another obligation is rejected. The record does not move a balance, mark the obligation paid, or block later native settlement. Attested and contract-verified external settlement are separate and are not implemented. A direct runtime key cannot create this record.

This release supports one configured native treasury asset per DAO. Governance stake deposits currently require the member’s linked native account and the stake memo shown in the treasury. Walletless members can use internal governance credits. Claim-to-stake conversion and multi-asset treasury accounting are not implemented.

## Configure external services

Email codes are delivered only when the server configures SMTP. Codes expire, have bounded guesses, are browser-bound, and a resend invalidates earlier codes. Local revealed pairing codes are a development fixture; they cannot sign in from another browser.

Telegram website sign-in uses OIDC with state, nonce, PKCE and verified current JWKS signatures. Mini App initData and legacy widget data use separately verified bot proofs. Untrusted profile or wallet connection data is never authentication.

Telegram OIDC subjects use an oidc: namespace. Numeric widget/Mini App IDs are not automatically merged with OIDC identities. Pair each method explicitly from your existing account.

Website login restores the initiating frontend origin and local return destination. A Telegram callback consumes one browser-bound attempt and stores no provider token in frontend URLs. Configure a real Telegram client/bot and test a real client before qualification.

Telos Zero login currently supports active permission with direct weighted keys, including a real threshold; delegated accounts, waits and other permission structures are rejected. The UI adapter supports Anchor through pinned WharfKit 4.0.2; real wallet-client qualification remains separate.

Telos EVM EOA login uses server-issued ERC-4361 messages. Direct DAO governance uses different EIP-712 signed bytes and on-chain K1/Keccak primitives. Chains 40/41 are supported; ERC-1271 wallets, EVM assets/payouts and cross-chain settlement are unavailable.

## Recover keys and blockchain access

User-controlled signing and P-256 decryption private keys are encrypted in this browser’s local vault and downloaded recovery kit. The password protects the local envelope; the separate recovery credential protects the recovery envelope. Both use PBKDF2-SHA256 with 600,000 iterations and AES-256-GCM. The API stores public keys, not these private keys or your vault password.

The contracts retain DAO membership, permissions, balances, document CIDs, key-epoch commitments and per-member encrypted epoch-key grants. Large encrypted document bytes are on IPFS. A recovered original decryption key opens its surviving grants and ciphertext; a wallet signature or a replacement encryption key cannot decrypt old content. Keep the encrypted kit and recovery credential in separate safe places and retain durable IPFS pins or a content export.

After losing the service database, connect a Telos Zero wallet or supported Telos EVM EOA and sign a fresh browser-bound challenge. The API verifies wallet control and finds current bindings in the configured runtime. It reconstructs wallet-only service access with no claimed vault keys, no new membership or creation fee. Each DAO’s current binding and permissions are checked again. Matching public signing keys in another DAO do not grant wallet access there.

A recovered wallet profile has a new service ID; the chain membership ID stays unchanged. Restore the original encrypted kit and confirm with the wallet to attach your proved vault identity to that same recovered profile. You can instead create new keys for new DAOs; new keys do not recover old private documents or change existing contract keys. Both current wallet control and incoming signing-key possession are required. An already registered vault identity is not silently merged with another service profile.

Google, Telegram and email pairings, passkey public credentials, wallet sign-in pairings and service sessions are PostgreSQL records. Blockchain governance bindings are separate. These pairing metadata columns are not application-encrypted. Restrict database access and encrypt off-host backups. Lost social pairings require a verified database restore or explicit re-pairing after recovering control. Do not publish email addresses, Telegram IDs or raw provider tokens on the public chain. Restore does not make an old session or provider proof fresh.

For a ten-member DAO, one recovered administrator can manage the existing DAO again, but their kit restores only their own keys and access. Every other member must recover independently. An ordinary member remains an ordinary member. Losing a server does not lose login pairings if a verified database backup survives; if all database copies are lost, pair those methods again after recovering your own control.

An old kit may still decrypt old documents after its signing key was rotated on chain, but that old signing key alone no longer authorizes governance. Use a surviving current wallet or other current control path. Human-member signing-key rotation requires that member’s authorization; another administrator’s kit cannot reset it. New vault keys do not replace the member’s existing encryption identity.

Wallet-only profiles must retain a blockchain control credential. Removing the last one is rejected transactionally. Unlinking or revoking a governance binding on chain removes the corresponding access; an old service pairing does not restore it. Inactive memberships do not gain new governance rights; existing exit rights remain governed by the contract.

Operators need encrypted off-host PostgreSQL backups, a separate secret/configuration backup, retained provider and IPFS credentials, and tested restore drills. Revoke all restored sessions and pending login/control challenges before exposing a restored API. A stale backup can restore removed social pairings; reconfirm them if revocation history is uncertain. Jobs and payment records need reconciliation with the chain and provider before workers resume.

Managed signing and decryption recovery remain unqualified and unavailable. OpenBao is a candidate, not a working production recovery guarantee. If every wallet key, vault recovery path and independent backup is lost, Daclify cannot manufacture the missing secrets.

## Documents that survive transaction history gaps

Small JSON documents are stored directly in contract tables. Larger files use immutable IPFS CIDs and a separate SHA-256 commitment of retrieved bytes. Document IDs have contiguous, permanent version histories.

The 4096-byte inline limit includes the complete stored JSON. For private content it includes the encrypted envelope, so the available plaintext space is smaller. Members can create documents; only their author or an administrator can publish later versions.

Hosted file uploads have a 5 MiB stored-byte limit and use a bounded backend path with an explicit storage allowance. Private filenames and file contents are encrypted before upload; encoding reduces the maximum original size. Upload and verify the file, then sign its permanent contract record. Keep the request ID to resume after a reload or lost response. The backend retrieves the stored bytes and checks their separate SHA-256 commitment; a matching CID or on-chain record alone does not establish byte verification.

Private documents use a committed key for each DAO epoch. Initialization stores the commitment and the creator’s encrypted grant atomically. An administrator can grant that epoch to admitted members. Different recipients, DAO deployments and document versions have distinct encryption domains.

Changing membership or rotating an epoch protects future content after the next key is initialized. Old grants and disclosed plaintext remain accessible to anyone who kept the old key. A client checks content integrity and the epoch commitment before decryption.

Download checks the recorded byte count and commitment before opening a file. A private download also checks the DAO epoch commitment and decrypts in your browser. Previous file versions remain downloadable from version history. A saved plaintext download is not erased when your vault locks. The local disk fixture is labelled explicitly and does not establish live Pinata or public IPFS availability.

Changing DAO deployment, account, member identity or privacy clears document drafts and decrypted views. Late responses from a previous context are discarded. Content histories are read in scoped pages with advancing cursors; a large DAO does not fail merely because it exceeds the former row ceiling.

## Stable members, explicit roles

Each DAO records internal members with separate signing and encryption keys. A linked native account is a credential of the existing member rather than a second voting identity.

Administrators assign administrator and reviewer roles. The final active administrator cannot be demoted or removed. Reviewers can review contributions within the Works policy; contribution authors cannot approve their own work.

Governance credits are nontransferable units. Their issuance and removal require DAO authority and stop while an active ballot has locked weights. Removing access preserves recorded balances and accepted payment rights.

Encrypted DAOs rotate the future-content epoch when a member is deactivated. Remaining authorized members need grants for the new committed key. Deactivation cannot revoke earlier keys or erase exported history.

In Members, an active administrator pastes the applicant’s public join identity and signs admission. Confirm the keys through a trusted channel first. Then select the admitted member to assign roles and governance credits; grant an encryption epoch separately for private documents. Admission never makes an applicant an administrator automatically. Managed admission remains unavailable in this deployment.

## Pay for a hosted service

A card payment uses Stripe Checkout at the price configured for this service. The application does not ask you to type an amount. Returning from the card page does not by itself record the payment. The service records a receipt only after Stripe reports that the checkout was paid.

That receipt belongs to the signed-in account. It does not change votes, permissions, withdrawals, treasury obligations, or the storage allowance. Basic governance stays free.

A TLOS payment for the same hosted service is quoted from the Delphi tlosusd median plus 20 percent and is paid to the billing account. Extra TLOS is a tip. The chain watcher that would match that transfer to an account is not part of this release, so a TLOS transfer does not create the card receipt and does not change DAO rights.

## Choose a DAO purpose without changing its identity model

Community, NGO / grants, gaming guild, team / cooperative and custom presets configure initial modules and a resolved governance snapshot. Human, mixed and guarded-agent participation are independent choices. Presets do not establish legal or charitable status, implement a game engine, or verify operator independence.

Creation installs the required reviewed modules and governance policy atomically. It refuses missing deployments or mismatched module code. A new preset version never changes an existing DAO automatically. Existing schema-1 metadata stays readable; schema 2 records purpose, preset version, participant mode and initial settings.

All ballots use the saved weight, duration, quorum and approval. Credit or stake voting needs eligible balances before opening. Governance credits are not money. Treasury token, document privacy and deployment choice remain separate.

Administrators retain admission, role, credit, module and policy powers. Native DAO ownership and contract upgrade authority remain separate and can bypass application rules. Review who controls those native accounts; a guardian that also owns the DAO has additional owner powers. Independent deployment is still prepared through the deployment kit, not one-click provisioning.

Purpose labels and basic presets are free. Hosted service billing does not authorise governance. Private documents can be encrypted, but DAO identity, purpose, memberships, votes, balances and transaction metadata remain public.

## Saved ballot policy, budgets and funding authority

The contract stores a policy revision, participant mode, configured Decide deployment, exact ballot settings, governed Works funding flag, guardian account and commitment limits. These fields enforce rules; descriptive metadata cannot authorise an action.

The maximum applies to each milestone or payroll installment when reserved. The daily maximum counts newly reserved amounts in the UTC chain day. It is a commitment budget, not a limit on payments due that day. Cancelled commitments do not replenish the daily allowance. Zero disables a limit in human or mixed DAOs; guarded-agent DAOs require both limits.

An administrator can edit ballot settings and commitment limits through a signed instruction only when no ballot is active. The revision advances and pending funding plans from an older revision become unexecutable; open a new vote. Participant mode, guardian identity and Decide account cannot be silently replaced through this action.

A guardian pause blocks new reservations, approvals, obligation payments and ordinary agent instructions. Each pause instruction lasts at most 24 hours and can be renewed. Existing obligations remain recorded and settle after expiry. Already assigned claims and stake retain withdrawal paths unless the agent credential itself is revoked. Subscription expiry is separate from an emergency pause.

Legacy DAOs have no policy until an explicit signed administrator adoption. The old DAO, member, ballot, project and milestone table layouts remain unchanged; policies and agent/credential state use additional tables. Supported upgrade paths need old-row serialization checks and real native permission links.

## Registered agents and disclosed human emergency controls

An agent is a declared participant with a signing key and separate encryption public key. The chain verifies credentials, not whether a model or a human chose an action. Operator labels are declarations; multiple keys do not prove multiple independent operators. Admission and voting allocation must address this trust assumption.

Agent-only creation enrolls the supplied agent public identity as first administrator. The human sponsor does not receive a membership. The guardian is a native account outside ordinary voting membership; configuring it does not give it document keys. Native ownership and upgrade powers must still be reviewed.

Root signing credentials retain member and administrator authority. Delegate routine work to action-scoped keys: up to 16 stored credentials per member, up to 16 target/action permissions per credential, and a maximum seven-day expiry. Delete expired or revoked entries to free slots. Module permissions pin the installed module code. Scoped credentials cannot administer policies or members, spend claims, or delegate further authority.

Submit scoped requests through submitsess or the relay API with session_id. Root requests use submit. Both share the member nonce, signed DAO/chain/runtime/action domain and short instruction expiry. Login by a scoped key does not turn it into a root member or grant decryption access.

Scoped voting can authorise funding and a Works review scope can make an already funded obligation payable when the member is an authorised reviewer. The publishing credential offered here grants neither permission. Treat every delegated permission as authority, not merely an API convenience.

Guardians can revoke an agent and recover its signing identity. Recovery can impersonate the recovered agent. It invalidates earlier delegated credentials and clears the native-account binding, while preserving member identity, credits, claims, stake and encryption keys. It cannot recover old encrypted content without the required decryption credentials. Signing-key rotation also invalidates existing scoped credentials.

On-chain signing recovery does not migrate an old HTTP account, social-provider links or a protected signer's configuration. Authenticate the replacement signer separately and retain the existing document decryption credentials.

Keep keys in a protected signer, not model prompts or logs. Encryption before IPFS publication does not protect plaintext later sent to a model provider. This release is provider-neutral and does not include LLM hosting, operator-independence verification or a qualified production custody service. The SDK example publishes a supplied public JSON document, not an autonomous decision engine.

## Module catalogue and Telos names

Modules that a DAO can turn on are listed in the runtime catalogue. A listing is stored only when it accepts the platform fee rule. A DAO cannot enable a module that is missing from that catalogue or whose code no longer matches the listing.

A first-party module is published by the platform treasury. Its usage charge, when one is set, is kept at the first-party rate stored in the runtime fee configuration. A third-party module is published by someone else. Its usage charge pays the platform the third-party rate in that same configuration, and the rest goes to the publisher. The rate can be changed later. The next payment uses the rate that is current, not the rate from the day the module was listed.

The Telos nameservice sells new native accounts from its own contract. A 12-character name without a dot uses the basic tier. Its dollar price is stored on chain. When a TLOS conversion rate is stored beside it, the TLOS price is that dollar amount converted at the rate plus the quote premium. The account is created with the CPU, NET, and RAM stored on that tier. A name that contains a dot can be sold only when the longest suffix is connected. The suffix owner sets the price in TLOS or dollars with regsuffix. Each sale raises that price by the bump rate, and the platform keeps the third-party rate. A shorter name without a dot uses the premium tier. Someone can still list one exact name with regname. Prices, suffixes, fee rates, and completed sales stay on chain, so a new server can read them after the application database is gone. A Daclify DAO admin changes the platform cut, the bump, and the quote premium with govfees after the runtime links that DAO. Until then the runtime account can change them.

Card checkout uses the dollar amount stored on chain for that name. The browser creates the new account keys and does not send the private keys to the server. After the card payment is confirmed, the names contract records the sale and creates the account. A card session that never reaches the chain remains with the card processor. Returning from the card page does not by itself create the account. If the on-chain price changes before confirmation, the account is not created.

## Free creation and approved hosting capacity

Shared creation is free and includes 10 active governance member slots. Human and agent governance identities each use one slot; pairing Telegram, email or wallets does not add another member or slot.

Monthly paid slots use graduated rates: the first 40 additional slots cost $1 each, the next 200 cost $0.50 each, and remaining additional slots cost $0.20 each. Total capacity 11 costs $1/month; 50 costs $40; 250 costs $140; 1,000 costs $290. Administrators choose capacity and explicitly approve the price. The service never automatically bills a DAO for joining members.

Existing subscriptions retain the accepted price schedule and included allowance. Daclify DAO can govern rates for new agreements. Accepting current pricing is a separate explicit administrator action. Blockchain, storage and AI allowances remain separate.

Independent deployment options show Contact for pricing; they have no public setup price or self-service deployment checkout. Shared setup promo codes were superseded by free creation.

Previously captured card or TLOS creation orders retain their immutable quoted price and once-only fulfillment. Their original TLOS quote may include the agreed 20% conversion premium. Creating a new free DAO does not refund or cancel an earlier paid order.

## Daclify DAO and platform status

The Daclify DAO page reads the platform DAO reference from the runtime market configuration. A native operator first creates and enrolls that DAO and links it with setgov. Before that link, the page reports that platform governance is unconfigured. It does not guess a DAO by its name.

Active administrators of the linked DAO can sign creation fee and settler changes, commission and names policy changes, first-party module registration, catalogue removal and first-party module descriptions. These are administrator actions, not automatic execution of a member ballot. Use the DAO workspace for proposals, voting, members and treasury. Native upgrade, fee treasury and oracle authorities remain with the operator.

Module registration checks the on-chain code hash, accepted fee rule and asset identity. Removing a catalogue entry prevents new installations but does not erase existing DAO installations, pending work or financial exit rights. Publishers retain control over their third-party listings and prices.

Status displays the selected network, actual chain ID and head blocks, runtime and module hashes, public permission authorities, resources, on-chain fee and governance configuration, database migrations and safe provider configuration flags. Missing services are labelled unconfigured. Module hash checks verify the pinned SDK artifact; unpinned runtime and hub hashes are displayed without claiming they are verified.

Configured providers are not evidence of successful live integration or a qualified production release. Pinata, Stripe, Google, Telegram and managed recovery require their own configuration and acceptance checks. Public status excludes credentials, private keys, DSNs, account records and raw internal errors.

Status starts with user-facing capabilities and distinguishes configured services from qualified live integrations. Expand Technical platform details to inspect hashes, authorities, resources and migration state.

## Find and identify a DAO

The directory covers the configured native runtime. Search, purpose, membership and sort filters are in the URL so a view can be shared or restored. A membership match includes chain, runtime, DAO and active member state.

Display metadata version 3 adds a brief public summary and optional public PNG/JPEG/WebP logo and cover references. Images are capped at 2 MiB each and include their CID, MIME, byte size and SHA-256 commitment. Hosted retrieval validates the bytes; unavailable images fall back to the original Daclify card.

DAO purpose and original setup remain immutable. All directory text and image references are public, including a DAO with encrypted document contents. Choose a sparse listing if needed. Deployment labels describe configuration; they are not audit certifications.

## Reconcile spending and export records

Treasury reports separate approved/reserved obligations, settled obligations, current internal claims and actual native cashflow. An internal claim credit and its later withdrawal are one settled expense, with withdrawal shown as cashflow. Do not add these different metrics together. Amounts use exact integer base units with the native token contract, symbol and precision.

New runtime receipts record internal claim credits, native obligation payments and claim withdrawals atomically with their ledger transition and native transaction ID. Existing settlements before the receipt upgrade retain an unknown destination classification. The receipt history starts at the upgrade; it cannot reconstruct earlier withdrawals or prove all-time external cashflow.

Reports read live paged chain tables, not an atomic historical snapshot. The export records chain/runtime/DAO/read times, completeness, reconciliation gaps and receipt coverage. A failed/truncated source is labelled unavailable; refresh if the ledger changes during reading. An unverified module prevents complete module provenance, while ordinary claims remain accessible.

A DAO-confirmed external payment statement is evidence asserted by that DAO. It does not settle a native obligation and is not proof of external-chain finality. Native receipts describe the runtime transaction; RPC trust and chain finality remain separate operating assumptions.

Basic complete JSON/CSV exports are free and do not require an Operations subscription. CSV cells neutralize spreadsheet formulas. Exports include public document IDs/CIDs/commitments and agreement references, never narrative/private titles, decrypted bodies or credentials. Export after offboarding or hosted entitlement expiry preserves payment, recovery and financial rights.

## Use the matching release and enabled modules

Core, module and frontend packages are versioned together at 0.7.0-alpha.1. Documentation displays its package version and warns when the selected DAO deployment does not match. Module actions remain unavailable when the installed frontend SDK differs from the deployed module version or code hash.

A DAO administrator enables optional modules in Workspace → Modules. Grants rounds requires Works and Decide; funded awards continue through Works delivery, independent review and Treasury settlement. Enable Endorsement admission before configuring an opt-in member endorsement rule in Members. Representative elections are available in Decide and confer term labels, without administrator or spending powers.

Contract upgrades preserve balances, approved liabilities, old documents and existing identities. Changed module code invalidates old execution pins; review a new proposal rather than changing the terms of an existing vote. Complete spending exports remain available and mark missing historical receipts or document references as incomplete.

Version 0.7 adds free shared creation, graduated capacity subscriptions, optional Connect merchant receipts and independent portal routing. It requires the matching runtime WASM/ABI, execctx permission links and migrations 016–021. Earlier table layouts and module WASM are retained. Follow the repository upgrade-0.7 and connected-payments runbooks; older recovery behavior still applies. Use matching API/frontend/protocol/help artifacts, review permissions and immutable hashes, and qualify live providers, wallet clients, backups and proxy trust before enabling a hosted service. Local fixture passes do not qualify production managed custody.

## Shared hosting and graduated member capacity

Create free with 10 active member slots. Administrators approve additional paid capacity. Paid slot ranges are 1–40 at 100 USD cents each, 41–240 at 50 cents each, and 241 onward at 20 cents each per month. The lower price applies only to slots in its band. A shared runtime currently supports at most 5,000 active members per DAO.

An agreement captures the complete on-chain price policy, included slots and approved quantity. Existing subscriptions retain that schedule, including when capacity changes, until an administrator explicitly accepts current pricing. The UI displays included slots, approved paid slots, total capacity, monthly charge and pending changes.

A checkout redirect is not payment proof. Signed webhooks trigger current Stripe invoice/payment verification; a durable PostgreSQL job then attests a once-only capacity receipt to the runtime. The configured settler is trusted to attest off-chain payments. A lost chain response is retried with the same receipt.

Upgrades use payment-dependent subscription updates with immediate prorated invoices. Capacity is granted only after verified payment. Decreases take effect for future bills without unused-period credits; already-paid capacity remains through its period. Cancellation stops renewal and keeps paid capacity until expiry.

Payment failure or expiry prevents admissions and reactivations above the effective allowance. Existing memberships, votes, withdrawals, liabilities, keys and documents remain usable. Fully refunded or unresolved disputed hosting payments stop future admissions supported by that receipt after reconciliation; older receipts cannot revoke a newer period.

Monthly hosting uses card billing on Daclify’s Stripe account, separately from DAO Connect module payments. TLOS recurring hosting is not implemented. Stripe processing, tax obligations, provider availability and real-network settlement require separate qualification. Provider mocks are not live certification.

Back up PostgreSQL billing agreements and provider mappings along with sign-in pairings. On-chain receipts preserve the current member allowance but do not reconstruct Stripe customer or subscription records. See Disaster recovery.

## DAO merchant payments and Daclify Connect

Each DAO accepting card payments needs its own Stripe merchant account. An active administrator can connect an eligible existing account through OAuth or create a new full-dashboard account through Stripe-hosted onboarding. Stripe collects identity, business and payout details; the DAO completes those steps itself. Creating a DAO does not create a verified merchant automatically.

Daclify Connect processes approved module products as direct charges on the DAO merchant account. Stripe processing fees are separate. The default Daclify application commission is 5%; Daclify DAO governs the rate. Zero commission is supported. Orders capture their price and fee policy, so subsequent changes do not alter them.

Commission applies only to eligible module checkouts created through this integration. It does not apply automatically to native treasury transfers, outside payments, DAO setup or shared-hosting subscriptions. A module-labelled product is a payment receipt; it does not install a contract, mint native credit or automatically grant membership or module entitlements.

Only current administrators with a fresh signing proof can manage merchant setup, products, refunds and operator credentials. Buyers can see their own orders; current administrators can see DAO orders. Public catalogues disclose only active product information.

Payment status is reconciled from Stripe’s current checkout, PaymentIntent and charge on the captured merchant account. Signed notifications are mode-checked, replay-checked and serialized per event. Browser returns and pasted transaction IDs grant nothing. Refunds are bounded and repeat safely using their original request ID. Failed or uncertain provider operations require reconciliation rather than a new charge or refund request.

Onboarding links expire and may be used once; resume from DAO payment settings. Returning to Daclify does not prove onboarding is complete. Charges and payouts must both be enabled. Disconnecting blocks new checkouts and revokes broker credentials. Existing receipts remain on their original merchant account.

Connect needs separate test/live client IDs and webhook secrets, the platform’s Stripe credentials and a registered API callback URL. Live charges stay disabled unless explicitly enabled. Accounts v2/full-dashboard eligibility, regional availability, fees, refunds and payout responsibility must be checked in a real Stripe sandbox before production.

## Independent operators and Hub registration

Independent DAOs own their contracts and server. They can either use the reviewed Daclify app with an explicitly approved compatible operator API, or use their own frontend and publish an external HTTPS portal link in the Hub. Each listing states its operator; a Hub record is not endorsement.

Register public version-1 metadata with the owning native account. It lists operator, DAO IDs, titles, descriptions, purposes, privacy labels, portal modes and optional module deployment names. The Hub reader uses the configured chain RPC and never fetches an advertised API server-side. No private documents, keys, provider tokens or invented membership statistics belong in the registry.

To use Daclify Connect, the independent DAO still owns its Stripe merchant account. Its server receives a DAO-scoped broker credential, returned once and stored only on that server. The central service retains platform Stripe credentials and applies the governed fee. A changed administrator role or revoked credential removes broker access.

Fully standalone Stripe is for operators running both their own backend and frontend. Those credentials remain outside Daclify. The Hub presents public information and links to the portal; it cannot automatically take commission from payments it does not process.

Do not transfer Daclify session cookies, social provider credentials, recovery kits or decrypted vault keys to another operator. Signing in to a different service is a separate audience-bound authentication step; current on-chain membership determines governance rights. Pairing records are local to that operator’s database and need its own backups.

## Source and license

Copyright 2026 Daclify contributors. Daclify application code, smart contracts, SDKs and first-party modules are licensed under AGPL-3.0-only. You may use, modify and redistribute them under that license. The software comes without warranty; third-party files retain their own licenses.

If you distribute covered binaries, provide corresponding source. If you run a modified version that supports network interaction, prominently offer its corresponding source to those users. Provide the actual deployed version and relevant build and installation scripts; an upstream link alone does not cover local modifications. Keep private keys, provider secrets and user data out of source archives.

Fork improvements can be reused in Daclify under AGPL with their notices retained. Contributors keep their copyright; the license does not require a pull request or transfer ownership. Private changes with neither distribution nor network interaction need not be published.

Commercial hosting, subscriptions and paid services are allowed. Independently developed modules and services need a compatibility review; putting code in another repository does not automatically exempt a combined work. No trademark permission is granted to present a fork as the official Daclify service.

## runtime contract

Source ABI JSON SHA-256: `6773df839f6a21a75bc13a8d7f6ad74dce5c1f78334477e6c7b74f6310fe5651`.

### Action: addmember

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| signing_key | public_key |
| encryption_key | string |
| custody | uint8 |
| kind | uint8 |
| operator_label | string |

### Action: addsession

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| session_id | uint64 |
| signing_key | public_key |
| expires | uint32 |
| permissions | session_permission[] |

### Action: admitfrom

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| application_id | uint64 |
| revision | uint64 |

### Action: approveob

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |

### Action: authproof

| Field | ABI type |
| --- | --- |
| account | name |
| intent | checksum256 |

### Action: cancelob

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |

### Action: cardcreate

| Field | ABI type |
| --- | --- |
| reference | checksum256 |
| usd_cents | uint32 |
| checkout_reference | checksum256 |
| paid_at | uint32 |

### Action: commitepoch

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| epoch | uint64 |
| commitment | checksum256 |
| self_grant | string |

### Action: confirmext

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| obligation_id | uint64 |
| chain | string |
| payer | string |
| recipient | uint64 |
| quantity | asset |
| reference | checksum256 |

### Action: createdao

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| owner | name |
| metadata | string |
| privacy | uint8 |
| token_contract | name |
| token_symbol | symbol |

### Action: createpaid

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| owner | name |
| metadata | string |
| privacy | uint8 |
| token_contract | name |
| token_symbol | symbol |
| reference | checksum256 |
| creator | public_key |

### Action: delsession

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| session_id | uint64 |

### Action: enroll

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| member_id | uint64 |
| native_account | name |
| signing_key | public_key |
| encryption_key | string |
| custody | uint8 |

### Action: enrollagent

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| member_id | uint64 |
| native_account | name |
| signing_key | public_key |
| encryption_key | string |
| custody | uint8 |
| operator_label | string |

### Action: govcreate

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| shared_usd | uint32 |
| independent_usd | uint32 |
| premium_bps | uint16 |
| settler | name |

### Action: govfees

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| third_party_bps | uint16 |
| first_party_bps | uint16 |
| bump_bps | uint16 |
| quote_premium_bps | uint16 |

### Action: govhosted

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| free_members | uint32 |
| settler | name |

### Action: govlist

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| account | name |
| price | asset |
| code_hash | checksum256 |
| title | string |

### Action: govlock

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |
| expires | uint32 |

### Action: govmodcopy

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| account | name |
| summary | string |
| detail | string |

### Action: govpayfees

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| bps | uint16 |

### Action: govseatfee

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| first_usd | uint32 |
| next_usd | uint32 |
| rest_usd | uint32 |

### Action: govunlist

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| account | name |

### Action: govunlock

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |

### Action: grantcredit

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| member_id | uint64 |
| quantity | uint64 |

### Action: grantkey

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| recipient | uint64 |
| epoch | uint64 |
| envelope | string |

### Action: guardpause

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| until | uint32 |
| reason | checksum256 |

### Action: guardrecover

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| member_id | uint64 |
| signing_key | public_key |

### Action: guardrevoke

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| member_id | uint64 |

### Action: init

| Field | ABI type |
| --- | --- |
| chain_id | checksum256 |

### Action: initgov

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| settings | gov_settings |

### Action: initramobs

| Field | ABI type |
| --- | --- |


### Action: linkevm

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| evm_chain_id | uint64 |
| address | checksum160 |
| epoch | uint64 |
| nonce | uint64 |
| expires | uint32 |
| proof | bytes |

### Action: linknative

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| account | name |

### Action: listmod

| Field | ABI type |
| --- | --- |
| account | name |
| publisher | name |
| party | uint8 |
| accepts_fee_rule | uint8 |
| price | asset |
| code_hash | checksum256 |
| title | string |

### Action: modconfig

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| account | name |
| version | uint16 |
| actions | name[] |
| grants | name[] |
| code_hash | checksum256 |

### Action: ordercreate

| Field | ABI type |
| --- | --- |
| reference | checksum256 |
| creator | public_key |
| deployment | uint8 |
| method | uint8 |

### Action: orderfree

| Field | ABI type |
| --- | --- |
| reference | checksum256 |
| creator | public_key |

### Action: payob

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |

### Action: putdoc

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| document_id | uint64 |
| version | uint32 |
| cid | string |
| metadata | string |
| commitment | checksum256 |
| bytes | uint32 |
| envelope_version | uint16 |
| key_epoch | uint64 |

### Action: putjson

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| document_id | uint64 |
| version | uint32 |
| value | string |
| envelope_version | uint16 |
| key_epoch | uint64 |

### Action: ramadjust

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| payer | name |
| category | uint8 |
| added | uint64 |
| removed | uint64 |

### Action: reserve

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |
| recipient | uint64 |
| quantity | asset |
| due | uint32 |

### Action: resumecap

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| receipt | checksum256 |

### Action: revokecap

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| receipt | checksum256 |

### Action: rotateepoch

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |

### Action: rotatekey

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| signing_key | public_key |

### Action: setactive

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| target | uint64 |
| active | bool |

### Action: setadmit

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| enabled | bool |
| source | name |
| threshold | uint8 |
| allow_agents | bool |
| admin_override | bool |

### Action: setcapacity

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| member_limit | uint32 |
| expires | uint32 |
| receipt | checksum256 |

### Action: setcreate

| Field | ABI type |
| --- | --- |
| shared_usd | uint32 |
| independent_usd | uint32 |
| premium_bps | uint16 |
| settler | name |

### Action: setcredits

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| target | uint64 |
| quantity | uint64 |

### Action: setcrrate

| Field | ABI type |
| --- | --- |
| median | uint64 |
| precision | uint8 |
| observed_at | uint32 |

### Action: setdaogov

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| settings | gov_settings |

### Action: setfees

| Field | ABI type |
| --- | --- |
| third_party_bps | uint16 |
| first_party_bps | uint16 |
| treasury | name |
| token_contract | name |
| token_symbol | symbol |
| names | name |

### Action: setgov

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |

### Action: sethosted

| Field | ABI type |
| --- | --- |
| free_members | uint32 |
| settler | name |

### Action: setmeta

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| metadata | string |

### Action: setmodcopy

| Field | ABI type |
| --- | --- |
| account | name |
| summary | string |
| detail | string |

### Action: setmodule

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| account | name |
| version | uint16 |
| actions | name[] |
| grants | name[] |
| code_hash | checksum256 |

### Action: setoracle

| Field | ABI type |
| --- | --- |
| median | uint64 |
| quoted_precision | uint8 |
| observed_at | uint32 |

### Action: setpolicy

| Field | ABI type |
| --- | --- |
| bump_bps | uint16 |
| quote_premium_bps | uint16 |

### Action: setprofile

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| account_name | name |
| profile | string |

### Action: setramcode

| Field | ABI type |
| --- | --- |
| account | name |
| code_hash | checksum256 |

### Action: setroles

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| target | uint64 |
| admin | bool |
| reviewer | bool |

### Action: submit

| Field | ABI type |
| --- | --- |
| request | instruction |
| sig | signature |

### Action: submitevm

| Field | ABI type |
| --- | --- |
| request | instruction |
| evm_chain_id | uint64 |
| address | checksum160 |
| binding_epoch | uint64 |
| proof | bytes |

### Action: submitnat

| Field | ABI type |
| --- | --- |
| request | instruction |

### Action: submitsess

| Field | ABI type |
| --- | --- |
| request | instruction |
| session_id | uint64 |
| sig | signature |

### Action: unlinkevm

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |

### Action: unlinknat

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |

### Action: unlistmod

| Field | ABI type |
| --- | --- |
| account | name |

### Action: unstake

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| destination | name |
| quantity | asset |

### Action: withdraw

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| destination | name |
| quantity | asset |

### Table: actors

| Field | ABI type |
| --- | --- |
| id | uint64 |
| kind | uint8 |
| operator_label | string |
| revoked | bool |
| credential_epoch | uint64 |

### Table: admpolicies

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| revision | uint64 |
| mode | uint8 |
| source | name |
| threshold | uint8 |
| allow_agents | bool |
| admin_override | bool |

### Table: budgets

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| day | uint32 |
| committed | int64 |

### Table: capcfg

| Field | ABI type |
| --- | --- |
| free_members | uint32 |
| settler | name |

### Table: capreceipts

| Field | ABI type |
| --- | --- |
| id | uint64 |
| receipt | checksum256 |
| dao_id | uint64 |
| members | uint32 |
| expires | uint32 |
| revoked | bool |

### Table: catalogue

| Field | ABI type |
| --- | --- |
| account | name |
| publisher | name |
| party | uint8 |
| complies | uint8 |
| price | asset |
| code_hash | checksum256 |
| title | string |

### Table: createcfg

| Field | ABI type |
| --- | --- |
| shared_usd | uint32 |
| independent_usd | uint32 |
| premium_bps | uint16 |
| settler | name |
| median | uint64 |
| precision | uint8 |
| observed_at | uint32 |

### Table: createords

| Field | ABI type |
| --- | --- |
| id | uint64 |
| reference | checksum256 |
| creator | public_key |
| deployment | uint8 |
| method | uint8 |
| usd_cents | uint32 |
| tlos_due | asset |
| created_at | uint32 |
| expires | uint32 |
| paid | bool |
| used | bool |
| dao_id | uint64 |
| card_reference | checksum256 |

### Table: daocaps

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| members | uint32 |
| expires | uint32 |
| receipt | checksum256 |

### Table: daos

| Field | ABI type |
| --- | --- |
| id | uint64 |
| owner | name |
| metadata | string |
| privacy | uint8 |
| token_contract | name |
| token_symbol | symbol |
| credit_supply | uint64 |
| member_count | uint64 |
| max_member | uint64 |
| active_ballots | uint32 |
| available | int64 |
| reserved | int64 |
| claims | int64 |
| staked | int64 |
| eligible_credits | uint64 |
| eligible_stake | int64 |
| admin_count | uint32 |
| key_epoch | uint64 |
| history_policy | uint8 |

### Table: documents

| Field | ABI type |
| --- | --- |
| id | uint64 |
| document_id | uint64 |
| version | uint32 |
| author | uint64 |
| cid | string |
| metadata | string |
| commitment | checksum256 |
| bytes | uint32 |
| envelope_version | uint16 |
| key_epoch | uint64 |

### Table: epochs

| Field | ABI type |
| --- | --- |
| epoch | uint64 |
| commitment | checksum256 |
| creator | uint64 |

### Table: evidence

| Field | ABI type |
| --- | --- |
| id | uint64 |
| dao_id | uint64 |
| obligation_id | uint64 |
| recipient | uint64 |
| quantity | asset |
| chain | string |
| payer | string |
| reference | checksum256 |
| mode | uint8 |

### Table: evmbindings

| Field | ABI type |
| --- | --- |
| member_id | uint64 |
| chain_id | uint64 |
| address | checksum160 |
| epoch | uint64 |
| active | bool |

### Table: feecfg

| Field | ABI type |
| --- | --- |
| third_party_bps | uint16 |
| first_party_bps | uint16 |
| treasury | name |
| token_contract | name |
| token_symbol | symbol |
| names | name |

### Table: govlocks

| Field | ABI type |
| --- | --- |
| id | uint64 |
| source | name |
| source_id | uint64 |
| expires | uint32 |
| active | bool |

### Table: govpolicies

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| revision | uint64 |
| config | gov_settings |

### Table: guards

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| paused_until | uint32 |
| reason | checksum256 |

### Table: keygrants

| Field | ABI type |
| --- | --- |
| id | uint64 |
| epoch | uint64 |
| recipient | uint64 |
| grantor | uint64 |
| envelope | string |

### Table: members

| Field | ABI type |
| --- | --- |
| id | uint64 |
| native_account | name |
| signing_key | public_key |
| encryption_key | string |
| custody | uint8 |
| nonce | uint64 |
| credits | uint64 |
| active | bool |
| admin | bool |
| reviewer | bool |
| stake | int64 |
| claim | int64 |
| join_epoch | uint64 |

### Table: mktcfg

| Field | ABI type |
| --- | --- |
| bump_bps | uint16 |
| quote_premium_bps | uint16 |
| dao_id | uint64 |

### Table: modcopy

| Field | ABI type |
| --- | --- |
| account | name |
| summary | string |
| detail | string |

### Table: modpays

| Field | ABI type |
| --- | --- |
| id | uint64 |
| modaccount | name |
| payer | name |
| publisher | name |
| gross | asset |
| platform_fee | asset |
| publisher_share | asset |
| party | uint8 |
| bps | uint16 |

### Table: modules

| Field | ABI type |
| --- | --- |
| account | name |
| version | uint16 |
| actions | name[] |
| grants | name[] |
| code_hash | checksum256 |

### Table: obligations

| Field | ABI type |
| --- | --- |
| id | uint64 |
| source | name |
| source_id | uint64 |
| recipient | uint64 |
| quantity | asset |
| due | uint32 |
| status | uint8 |

### Table: paycfg

| Field | ABI type |
| --- | --- |
| bps | uint16 |
| revision | uint64 |

### Table: profiles

| Field | ABI type |
| --- | --- |
| id | uint64 |
| dao_id | uint64 |
| member_id | uint64 |
| account_name | name |
| profile | string |

### Table: ramobs

| Field | ABI type |
| --- | --- |
| meter_bytes | uint64 |
| runtime_hash | checksum256 |

### Table: ramsources

| Field | ABI type |
| --- | --- |
| account | name |
| code_hash | checksum256 |

### Table: ramstats

| Field | ABI type |
| --- | --- |
| payer | name |
| identity | uint64 |
| activity | uint64 |
| retained | uint64 |
| platform | uint64 |

### Table: receipts

| Field | ABI type |
| --- | --- |
| id | uint64 |
| kind | uint8 |
| obligation_id | uint64 |
| recipient | uint64 |
| destination | name |
| token_contract | name |
| quantity | asset |
| at | uint32 |
| transaction_id | checksum256 |

### Table: seatcfg

| Field | ABI type |
| --- | --- |
| first_usd | uint32 |
| next_usd | uint32 |
| rest_usd | uint32 |
| revision | uint64 |

### Table: sessions

| Field | ABI type |
| --- | --- |
| id | uint64 |
| member_id | uint64 |
| signing_key | public_key |
| expires | uint32 |
| credential_epoch | uint64 |
| permissions | session_permission[] |

### Table: settings

| Field | ABI type |
| --- | --- |
| chain_id | checksum256 |
| interface_version | uint16 |

## hub contract

Source ABI JSON SHA-256: `ae70e5f0f7af1f1a9ded1b8ce193c5e6cab1808799f4e11c7e9ad160518e3cf7`.

### Action: regdeploy

| Field | ABI type |
| --- | --- |
| runtime | name |
| owner | name |
| chain_id | checksum256 |
| interface_version | uint16 |
| code_hash | checksum256 |
| abi_hash | checksum256 |
| metadata | string |
| listed | bool |

### Table: deployments

| Field | ABI type |
| --- | --- |
| id | uint64 |
| runtime | name |
| owner | name |
| chain_id | checksum256 |
| interface_version | uint16 |
| code_hash | checksum256 |
| abi_hash | checksum256 |
| metadata | string |
| listed | bool |

## POST /v1/account/vault/challenge

Guide: recovery.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "signingKey": {
      "type": "string",
      "maxLength": 128
    },
    "encryptionKey": {
      "type": "object",
      "properties": {
        "kty": {
          "type": "string",
          "const": "EC"
        },
        "crv": {
          "type": "string",
          "const": "P-256"
        },
        "x": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{43}$"
        },
        "y": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{43}$"
        }
      },
      "required": [
        "kty",
        "crv",
        "x",
        "y"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "signingKey",
    "encryptionKey"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "message": {
      "type": "string",
      "maxLength": 2048
    },
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "id",
    "message",
    "expires"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/vault

Guide: recovery.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "signature": {
      "type": "string",
      "minLength": 1,
      "maxLength": 160
    }
  },
  "required": [
    "id",
    "signature"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## GET /v1/platform/status

Guide: platform.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "checkedAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    },
    "apiVersion": {
      "type": "string"
    },
    "moduleVersion": {
      "type": "string"
    },
    "chain": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "network": {
              "type": "object",
              "properties": {
                "chainId": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{64}$"
                },
                "rpcUrl": {
                  "type": "string",
                  "format": "uri"
                },
                "runtime": {
                  "type": "string"
                },
                "hub": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "environment": {
                  "type": "string",
                  "enum": [
                    "local",
                    "testnet",
                    "mainnet"
                  ]
                },
                "interfaceVersion": {
                  "type": "number",
                  "const": 1
                },
                "coreVersion": {
                  "type": "string"
                },
                "capabilities": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": [
                "chainId",
                "rpcUrl",
                "runtime",
                "hub",
                "environment",
                "interfaceVersion",
                "coreVersion",
                "capabilities"
              ],
              "additionalProperties": false
            },
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "chainMatches": {
              "type": "boolean"
            },
            "headBlock": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9007199254740991
            },
            "irreversibleBlock": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9007199254740991
            },
            "headTime": {
              "type": "string"
            },
            "contracts": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "account": {
                    "type": "string"
                  },
                  "moduleId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "codeHash": {
                    "anyOf": [
                      {
                        "type": "string",
                        "pattern": "^[0-9a-f]{64}$"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "expectedHash": {
                    "anyOf": [
                      {
                        "type": "string",
                        "pattern": "^[0-9a-f]{64}$"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "verified": {
                    "type": "boolean"
                  },
                  "ramBytes": {
                    "anyOf": [
                      {
                        "type": "integer",
                        "minimum": -1,
                        "maximum": 9007199254740991
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "ramUsed": {
                    "anyOf": [
                      {
                        "type": "number",
                        "minimum": 0
                      },
                      {
                        "type": "null"
                      }
                    ]
                  },
                  "permissions": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string"
                        },
                        "parent": {
                          "type": "string"
                        },
                        "threshold": {
                          "type": "integer",
                          "minimum": -9007199254740991,
                          "maximum": 9007199254740991
                        },
                        "keys": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "key": {
                                "type": "string"
                              },
                              "weight": {
                                "type": "integer",
                                "minimum": -9007199254740991,
                                "maximum": 9007199254740991
                              }
                            },
                            "required": [
                              "key",
                              "weight"
                            ],
                            "additionalProperties": false
                          }
                        },
                        "accounts": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "actor": {
                                "type": "string"
                              },
                              "permission": {
                                "type": "string"
                              },
                              "weight": {
                                "type": "integer",
                                "minimum": -9007199254740991,
                                "maximum": 9007199254740991
                              }
                            },
                            "required": [
                              "actor",
                              "permission",
                              "weight"
                            ],
                            "additionalProperties": false
                          }
                        },
                        "waits": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "seconds": {
                                "type": "integer",
                                "minimum": -9007199254740991,
                                "maximum": 9007199254740991
                              },
                              "weight": {
                                "type": "integer",
                                "minimum": -9007199254740991,
                                "maximum": 9007199254740991
                              }
                            },
                            "required": [
                              "seconds",
                              "weight"
                            ],
                            "additionalProperties": false
                          }
                        }
                      },
                      "required": [
                        "name",
                        "parent",
                        "threshold",
                        "keys",
                        "accounts",
                        "waits"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "account",
                  "moduleId",
                  "codeHash",
                  "expectedHash",
                  "verified",
                  "ramBytes",
                  "ramUsed",
                  "permissions"
                ],
                "additionalProperties": false
              }
            },
            "catalogue": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "account": {
                    "type": "string",
                    "maxLength": 13
                  },
                  "publisher": {
                    "type": "string",
                    "maxLength": 13
                  },
                  "party": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 255
                  },
                  "complies": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 255
                  },
                  "price": {
                    "type": "string",
                    "maxLength": 64,
                    "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                  },
                  "code_hash": {
                    "type": "string",
                    "pattern": "^[0-9a-f]{64}$"
                  },
                  "title": {
                    "type": "string",
                    "maxLength": 16384
                  }
                },
                "required": [
                  "account",
                  "publisher",
                  "party",
                  "complies",
                  "price",
                  "code_hash",
                  "title"
                ],
                "additionalProperties": false
              }
            },
            "fees": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "third_party_bps": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 65535
                    },
                    "first_party_bps": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 65535
                    },
                    "treasury": {
                      "type": "string",
                      "maxLength": 13
                    },
                    "token_contract": {
                      "type": "string",
                      "maxLength": 13
                    },
                    "token_symbol": {
                      "type": "string",
                      "pattern": "^(0|[1-9][0-9]?),[A-Z]{1,7}$"
                    },
                    "names": {
                      "type": "string",
                      "maxLength": 13
                    }
                  },
                  "required": [
                    "third_party_bps",
                    "first_party_bps",
                    "treasury",
                    "token_contract",
                    "token_symbol",
                    "names"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "market": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "bump_bps": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 65535
                    },
                    "quote_premium_bps": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 65535
                    },
                    "dao_id": {
                      "type": "string",
                      "maxLength": 20
                    }
                  },
                  "required": [
                    "bump_bps",
                    "quote_premium_bps",
                    "dao_id"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "creation": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "shared_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "independent_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "premium_bps": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 65535
                    },
                    "settler": {
                      "type": "string",
                      "maxLength": 13
                    },
                    "median": {
                      "type": "string",
                      "maxLength": 20
                    },
                    "precision": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 255
                    },
                    "observed_at": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    }
                  },
                  "required": [
                    "shared_usd",
                    "independent_usd",
                    "premium_bps",
                    "settler",
                    "median",
                    "precision",
                    "observed_at"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "hosting": {
              "default": null,
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "free_members": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "settler": {
                      "type": "string",
                      "maxLength": 13
                    }
                  },
                  "required": [
                    "free_members",
                    "settler"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "seatPricing": {
              "default": null,
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "first_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "next_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "rest_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "revision": {
                      "type": "string",
                      "maxLength": 20
                    }
                  },
                  "required": [
                    "first_usd",
                    "next_usd",
                    "rest_usd",
                    "revision"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "paymentPolicy": {
              "default": null,
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "bps": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 65535
                    },
                    "revision": {
                      "type": "string",
                      "maxLength": 20
                    }
                  },
                  "required": [
                    "bps",
                    "revision"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "runtimeSettings": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "chain_id": {
                      "type": "string",
                      "pattern": "^[0-9a-f]{64}$"
                    },
                    "interface_version": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 65535
                    }
                  },
                  "required": [
                    "chain_id",
                    "interface_version"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "rateFresh": {
              "type": "boolean"
            },
            "platformDao": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "chainId": {
                      "type": "string",
                      "pattern": "^[0-9a-f]{64}$"
                    },
                    "contract": {
                      "type": "string",
                      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                    },
                    "daoId": {
                      "type": "string",
                      "maxLength": 20
                    },
                    "interfaceVersion": {
                      "type": "number",
                      "const": 1
                    }
                  },
                  "required": [
                    "chainId",
                    "contract",
                    "daoId",
                    "interfaceVersion"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "sharedAvailable": {
              "type": "boolean"
            },
            "independentAvailable": {
              "type": "boolean",
              "const": false
            }
          },
          "required": [
            "network",
            "chainId",
            "chainMatches",
            "headBlock",
            "irreversibleBlock",
            "headTime",
            "contracts",
            "catalogue",
            "fees",
            "market",
            "creation",
            "hosting",
            "seatPricing",
            "paymentPolicy",
            "runtimeSettings",
            "rateFresh",
            "platformDao",
            "sharedAvailable",
            "independentAvailable"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "rpc": {
      "type": "string",
      "enum": [
        "reachable",
        "unavailable",
        "unconfigured"
      ]
    },
    "database": {
      "type": "object",
      "properties": {
        "state": {
          "type": "string",
          "enum": [
            "reachable",
            "unavailable"
          ]
        },
        "migrations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "namespace": {
                "type": "string"
              },
              "name": {
                "type": "string"
              },
              "appliedAt": {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
              }
            },
            "required": [
              "namespace",
              "name",
              "appliedAt"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "state",
        "migrations"
      ],
      "additionalProperties": false
    },
    "limits": {
      "type": "object",
      "properties": {
        "sponsoredWritesPerAccount": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "sponsoredWritesGlobal": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "windowMs": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        "uploadBytes": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        }
      },
      "required": [
        "sponsoredWritesPerAccount",
        "sponsoredWritesGlobal",
        "windowMs",
        "uploadBytes"
      ],
      "additionalProperties": false
    },
    "services": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "configured": {
            "type": "boolean"
          },
          "qualification": {
            "type": "string",
            "enum": [
              "local-fixture",
              "not-qualified"
            ]
          },
          "detail": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "configured",
          "qualification",
          "detail"
        ],
        "additionalProperties": false
      }
    },
    "defaults": {
      "type": "object",
      "properties": {
        "sharedUsdCents": {
          "type": "number",
          "const": 0
        },
        "independentUsdCents": {
          "type": "number",
          "const": 5000
        },
        "tlosPremiumBps": {
          "type": "number",
          "const": 2000
        }
      },
      "required": [
        "sharedUsdCents",
        "independentUsdCents",
        "tlosPremiumBps"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "checkedAt",
    "apiVersion",
    "moduleVersion",
    "chain",
    "rpc",
    "database",
    "limits",
    "services",
    "defaults"
  ],
  "additionalProperties": false
}
```

## POST /v1/dao-orders

Guide: creation-fees.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "deployment": {
      "type": "string",
      "enum": [
        "shared",
        "independent"
      ]
    },
    "method": {
      "type": "string",
      "enum": [
        "card",
        "tlos",
        "free"
      ]
    },
    "request": {
      "type": "object",
      "properties": {
        "metadata": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                }
              },
              "required": [
                "schemaVersion",
                "title"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 2
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                },
                "purpose": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "setup": {
                  "type": "object",
                  "properties": {
                    "presetId": {
                      "type": "string",
                      "enum": [
                        "community",
                        "ngo-grants",
                        "gaming-guild",
                        "team",
                        "custom"
                      ]
                    },
                    "presetVersion": {
                      "type": "number",
                      "const": 1
                    },
                    "participantMode": {
                      "type": "string",
                      "enum": [
                        "humans",
                        "mixed",
                        "agents-guarded"
                      ]
                    },
                    "governance": {
                      "type": "object",
                      "properties": {
                        "weight": {
                          "type": "string",
                          "enum": [
                            "member",
                            "credit",
                            "native-stake"
                          ]
                        },
                        "duration": {
                          "type": "integer",
                          "minimum": 60,
                          "maximum": 2592000
                        },
                        "quorumBasisPoints": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 10000
                        },
                        "approvalBasisPoints": {
                          "type": "integer",
                          "minimum": 5001,
                          "maximum": 10000
                        },
                        "governedWorks": {
                          "type": "boolean"
                        },
                        "maxCommitment": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "dailyCommitment": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "guardian": {
                          "anyOf": [
                            {
                              "type": "string",
                              "const": ""
                            },
                            {
                              "type": "string",
                              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                            }
                          ]
                        }
                      },
                      "required": [
                        "weight",
                        "duration",
                        "quorumBasisPoints",
                        "approvalBasisPoints",
                        "governedWorks",
                        "maxCommitment",
                        "dailyCommitment",
                        "guardian"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "presetId",
                    "presetVersion",
                    "participantMode",
                    "governance"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "purpose",
                "setup"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 3
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                },
                "purpose": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "setup": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "presetId": {
                          "type": "string",
                          "enum": [
                            "community",
                            "ngo-grants",
                            "gaming-guild",
                            "team",
                            "custom"
                          ]
                        },
                        "presetVersion": {
                          "type": "number",
                          "const": 1
                        },
                        "participantMode": {
                          "type": "string",
                          "enum": [
                            "humans",
                            "mixed",
                            "agents-guarded"
                          ]
                        },
                        "governance": {
                          "type": "object",
                          "properties": {
                            "weight": {
                              "type": "string",
                              "enum": [
                                "member",
                                "credit",
                                "native-stake"
                              ]
                            },
                            "duration": {
                              "type": "integer",
                              "minimum": 60,
                              "maximum": 2592000
                            },
                            "quorumBasisPoints": {
                              "type": "integer",
                              "minimum": 1,
                              "maximum": 10000
                            },
                            "approvalBasisPoints": {
                              "type": "integer",
                              "minimum": 5001,
                              "maximum": 10000
                            },
                            "governedWorks": {
                              "type": "boolean"
                            },
                            "maxCommitment": {
                              "type": "string",
                              "maxLength": 20
                            },
                            "dailyCommitment": {
                              "type": "string",
                              "maxLength": 20
                            },
                            "guardian": {
                              "anyOf": [
                                {
                                  "type": "string",
                                  "const": ""
                                },
                                {
                                  "type": "string",
                                  "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                                }
                              ]
                            }
                          },
                          "required": [
                            "weight",
                            "duration",
                            "quorumBasisPoints",
                            "approvalBasisPoints",
                            "governedWorks",
                            "maxCommitment",
                            "dailyCommitment",
                            "guardian"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "presetId",
                        "presetVersion",
                        "participantMode",
                        "governance"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "branding": {
                  "type": "object",
                  "properties": {
                    "summary": {
                      "type": "string",
                      "maxLength": 280
                    },
                    "logo": {
                      "type": "object",
                      "properties": {
                        "cid": {
                          "type": "string",
                          "maxLength": 128
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 2097152
                        },
                        "mediaType": {
                          "type": "string",
                          "enum": [
                            "image/png",
                            "image/jpeg",
                            "image/webp"
                          ]
                        },
                        "commitment": {
                          "type": "string",
                          "pattern": "^[0-9a-f]{64}$"
                        }
                      },
                      "required": [
                        "cid",
                        "bytes",
                        "mediaType",
                        "commitment"
                      ],
                      "additionalProperties": false
                    },
                    "cover": {
                      "type": "object",
                      "properties": {
                        "cid": {
                          "type": "string",
                          "maxLength": 128
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 2097152
                        },
                        "mediaType": {
                          "type": "string",
                          "enum": [
                            "image/png",
                            "image/jpeg",
                            "image/webp"
                          ]
                        },
                        "commitment": {
                          "type": "string",
                          "pattern": "^[0-9a-f]{64}$"
                        }
                      },
                      "required": [
                        "cid",
                        "bytes",
                        "mediaType",
                        "commitment"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "additionalProperties": false
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "purpose",
                "setup",
                "branding"
              ],
              "additionalProperties": false
            }
          ]
        },
        "privacy": {
          "type": "string",
          "enum": [
            "public",
            "encrypted-managed-allowed",
            "encrypted-user-controlled"
          ]
        },
        "token": {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "symbol": {
              "type": "string",
              "pattern": "^[A-Z]{1,7}$"
            },
            "precision": {
              "type": "integer",
              "minimum": 0,
              "maximum": 18
            }
          },
          "required": [
            "chainId",
            "contract",
            "symbol",
            "precision"
          ],
          "additionalProperties": false
        },
        "setup": {
          "type": "object",
          "properties": {
            "presetId": {
              "type": "string",
              "enum": [
                "community",
                "ngo-grants",
                "gaming-guild",
                "team",
                "custom"
              ]
            },
            "presetVersion": {
              "type": "number",
              "const": 1
            },
            "participantMode": {
              "type": "string",
              "enum": [
                "humans",
                "mixed",
                "agents-guarded"
              ]
            },
            "governance": {
              "type": "object",
              "properties": {
                "weight": {
                  "type": "string",
                  "enum": [
                    "member",
                    "credit",
                    "native-stake"
                  ]
                },
                "duration": {
                  "type": "integer",
                  "minimum": 60,
                  "maximum": 2592000
                },
                "quorumBasisPoints": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 10000
                },
                "approvalBasisPoints": {
                  "type": "integer",
                  "minimum": 5001,
                  "maximum": 10000
                },
                "governedWorks": {
                  "type": "boolean"
                },
                "maxCommitment": {
                  "type": "string",
                  "maxLength": 20
                },
                "dailyCommitment": {
                  "type": "string",
                  "maxLength": 20
                },
                "guardian": {
                  "anyOf": [
                    {
                      "type": "string",
                      "const": ""
                    },
                    {
                      "type": "string",
                      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                    }
                  ]
                }
              },
              "required": [
                "weight",
                "duration",
                "quorumBasisPoints",
                "approvalBasisPoints",
                "governedWorks",
                "maxCommitment",
                "dailyCommitment",
                "guardian"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "presetId",
            "presetVersion",
            "participantMode",
            "governance"
          ],
          "additionalProperties": false
        },
        "foundingAgent": {
          "type": "object",
          "properties": {
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            },
            "operator": {
              "type": "string",
              "minLength": 1,
              "maxLength": 64,
              "pattern": "^[\\x20-\\x7e]+$"
            }
          },
          "required": [
            "signingKey",
            "encryptionKey",
            "operator"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "metadata",
        "privacy",
        "token"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "requestId",
    "deployment",
    "method",
    "request"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "network": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "rpcUrl": {
          "type": "string",
          "format": "uri"
        },
        "runtime": {
          "type": "string"
        },
        "hub": {
          "type": [
            "string",
            "null"
          ]
        },
        "environment": {
          "type": "string",
          "enum": [
            "local",
            "testnet",
            "mainnet"
          ]
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        },
        "coreVersion": {
          "type": "string"
        },
        "capabilities": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "chainId",
        "rpcUrl",
        "runtime",
        "hub",
        "environment",
        "interfaceVersion",
        "coreVersion",
        "capabilities"
      ],
      "additionalProperties": false
    },
    "setup": {
      "type": "object",
      "properties": {
        "metadata": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 2
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                },
                "purpose": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "setup": {
                  "type": "object",
                  "properties": {
                    "presetId": {
                      "type": "string",
                      "enum": [
                        "community",
                        "ngo-grants",
                        "gaming-guild",
                        "team",
                        "custom"
                      ]
                    },
                    "presetVersion": {
                      "type": "number",
                      "const": 1
                    },
                    "participantMode": {
                      "type": "string",
                      "enum": [
                        "humans",
                        "mixed",
                        "agents-guarded"
                      ]
                    },
                    "governance": {
                      "type": "object",
                      "properties": {
                        "weight": {
                          "type": "string",
                          "enum": [
                            "member",
                            "credit",
                            "native-stake"
                          ]
                        },
                        "duration": {
                          "type": "integer",
                          "minimum": 60,
                          "maximum": 2592000
                        },
                        "quorumBasisPoints": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 10000
                        },
                        "approvalBasisPoints": {
                          "type": "integer",
                          "minimum": 5001,
                          "maximum": 10000
                        },
                        "governedWorks": {
                          "type": "boolean"
                        },
                        "maxCommitment": {
                          "type": "string"
                        },
                        "dailyCommitment": {
                          "type": "string"
                        },
                        "guardian": {
                          "anyOf": [
                            {
                              "type": "string",
                              "const": ""
                            },
                            {
                              "type": "string",
                              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                            }
                          ]
                        }
                      },
                      "required": [
                        "weight",
                        "duration",
                        "quorumBasisPoints",
                        "approvalBasisPoints",
                        "governedWorks",
                        "maxCommitment",
                        "dailyCommitment",
                        "guardian"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "presetId",
                    "presetVersion",
                    "participantMode",
                    "governance"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description",
                "purpose",
                "setup"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 3
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                },
                "purpose": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "setup": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "presetId": {
                          "type": "string",
                          "enum": [
                            "community",
                            "ngo-grants",
                            "gaming-guild",
                            "team",
                            "custom"
                          ]
                        },
                        "presetVersion": {
                          "type": "number",
                          "const": 1
                        },
                        "participantMode": {
                          "type": "string",
                          "enum": [
                            "humans",
                            "mixed",
                            "agents-guarded"
                          ]
                        },
                        "governance": {
                          "type": "object",
                          "properties": {
                            "weight": {
                              "type": "string",
                              "enum": [
                                "member",
                                "credit",
                                "native-stake"
                              ]
                            },
                            "duration": {
                              "type": "integer",
                              "minimum": 60,
                              "maximum": 2592000
                            },
                            "quorumBasisPoints": {
                              "type": "integer",
                              "minimum": 1,
                              "maximum": 10000
                            },
                            "approvalBasisPoints": {
                              "type": "integer",
                              "minimum": 5001,
                              "maximum": 10000
                            },
                            "governedWorks": {
                              "type": "boolean"
                            },
                            "maxCommitment": {
                              "type": "string"
                            },
                            "dailyCommitment": {
                              "type": "string"
                            },
                            "guardian": {
                              "anyOf": [
                                {
                                  "type": "string",
                                  "const": ""
                                },
                                {
                                  "type": "string",
                                  "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                                }
                              ]
                            }
                          },
                          "required": [
                            "weight",
                            "duration",
                            "quorumBasisPoints",
                            "approvalBasisPoints",
                            "governedWorks",
                            "maxCommitment",
                            "dailyCommitment",
                            "guardian"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "presetId",
                        "presetVersion",
                        "participantMode",
                        "governance"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "branding": {
                  "type": "object",
                  "properties": {
                    "summary": {
                      "type": "string",
                      "maxLength": 280
                    },
                    "logo": {
                      "type": "object",
                      "properties": {
                        "cid": {
                          "type": "string",
                          "maxLength": 128
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 2097152
                        },
                        "mediaType": {
                          "type": "string",
                          "enum": [
                            "image/png",
                            "image/jpeg",
                            "image/webp"
                          ]
                        },
                        "commitment": {
                          "type": "string",
                          "pattern": "^[0-9a-f]{64}$"
                        }
                      },
                      "required": [
                        "cid",
                        "bytes",
                        "mediaType",
                        "commitment"
                      ],
                      "additionalProperties": false
                    },
                    "cover": {
                      "type": "object",
                      "properties": {
                        "cid": {
                          "type": "string",
                          "maxLength": 128
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 2097152
                        },
                        "mediaType": {
                          "type": "string",
                          "enum": [
                            "image/png",
                            "image/jpeg",
                            "image/webp"
                          ]
                        },
                        "commitment": {
                          "type": "string",
                          "pattern": "^[0-9a-f]{64}$"
                        }
                      },
                      "required": [
                        "cid",
                        "bytes",
                        "mediaType",
                        "commitment"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "additionalProperties": false
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description",
                "purpose",
                "setup",
                "branding"
              ],
              "additionalProperties": false
            }
          ]
        },
        "privacy": {
          "type": "string",
          "enum": [
            "public",
            "encrypted-managed-allowed",
            "encrypted-user-controlled"
          ]
        },
        "token": {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "symbol": {
              "type": "string",
              "pattern": "^[A-Z]{1,7}$"
            },
            "precision": {
              "type": "integer",
              "minimum": 0,
              "maximum": 18
            }
          },
          "required": [
            "chainId",
            "contract",
            "symbol",
            "precision"
          ],
          "additionalProperties": false
        },
        "setup": {
          "type": "object",
          "properties": {
            "presetId": {
              "type": "string",
              "enum": [
                "community",
                "ngo-grants",
                "gaming-guild",
                "team",
                "custom"
              ]
            },
            "presetVersion": {
              "type": "number",
              "const": 1
            },
            "participantMode": {
              "type": "string",
              "enum": [
                "humans",
                "mixed",
                "agents-guarded"
              ]
            },
            "governance": {
              "type": "object",
              "properties": {
                "weight": {
                  "type": "string",
                  "enum": [
                    "member",
                    "credit",
                    "native-stake"
                  ]
                },
                "duration": {
                  "type": "integer",
                  "minimum": 60,
                  "maximum": 2592000
                },
                "quorumBasisPoints": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 10000
                },
                "approvalBasisPoints": {
                  "type": "integer",
                  "minimum": 5001,
                  "maximum": 10000
                },
                "governedWorks": {
                  "type": "boolean"
                },
                "maxCommitment": {
                  "type": "string"
                },
                "dailyCommitment": {
                  "type": "string"
                },
                "guardian": {
                  "anyOf": [
                    {
                      "type": "string",
                      "const": ""
                    },
                    {
                      "type": "string",
                      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                    }
                  ]
                }
              },
              "required": [
                "weight",
                "duration",
                "quorumBasisPoints",
                "approvalBasisPoints",
                "governedWorks",
                "maxCommitment",
                "dailyCommitment",
                "guardian"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "presetId",
            "presetVersion",
            "participantMode",
            "governance"
          ],
          "additionalProperties": false
        },
        "foundingAgent": {
          "type": "object",
          "properties": {
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            },
            "operator": {
              "type": "string",
              "minLength": 1,
              "maxLength": 64,
              "pattern": "^[\\x20-\\x7e]+$"
            }
          },
          "required": [
            "signingKey",
            "encryptionKey",
            "operator"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "metadata",
        "privacy",
        "token"
      ],
      "additionalProperties": false
    },
    "creator": {
      "type": "object",
      "properties": {
        "signingKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionKey": {
          "type": "object",
          "properties": {
            "kty": {
              "type": "string",
              "const": "EC"
            },
            "crv": {
              "type": "string",
              "const": "P-256"
            },
            "x": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{43}$"
            },
            "y": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{43}$"
            }
          },
          "required": [
            "kty",
            "crv",
            "x",
            "y"
          ],
          "additionalProperties": false
        },
        "custody": {
          "type": "string",
          "enum": [
            "user-controlled",
            "managed"
          ]
        }
      },
      "required": [
        "signingKey",
        "encryptionKey",
        "custody"
      ],
      "additionalProperties": false
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "deployment": {
      "type": "string",
      "enum": [
        "shared",
        "independent"
      ]
    },
    "method": {
      "type": "string",
      "enum": [
        "card",
        "tlos",
        "free"
      ]
    },
    "usdCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "tlosAmount": {
      "type": [
        "string",
        "null"
      ]
    },
    "recipient": {
      "type": "string"
    },
    "tokenContract": {
      "type": "string"
    },
    "memo": {
      "type": "string"
    },
    "expires": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "state": {
      "type": "string",
      "enum": [
        "awaiting-payment",
        "expired",
        "paid",
        "created"
      ]
    },
    "dao": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "daoId": {
              "type": "string",
              "maxLength": 20
            },
            "interfaceVersion": {
              "type": "number",
              "const": 1
            }
          },
          "required": [
            "chainId",
            "contract",
            "daoId",
            "interfaceVersion"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "checkoutUrl": {
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "network",
    "setup",
    "creator",
    "requestId",
    "deployment",
    "method",
    "usdCents",
    "tlosAmount",
    "recipient",
    "tokenContract",
    "memo",
    "expires",
    "state",
    "dao",
    "checkoutUrl"
  ],
  "additionalProperties": false
}
```

## GET /v1/dao-orders/:id

Guide: creation-fees.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "network": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "rpcUrl": {
          "type": "string",
          "format": "uri"
        },
        "runtime": {
          "type": "string"
        },
        "hub": {
          "type": [
            "string",
            "null"
          ]
        },
        "environment": {
          "type": "string",
          "enum": [
            "local",
            "testnet",
            "mainnet"
          ]
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        },
        "coreVersion": {
          "type": "string"
        },
        "capabilities": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "chainId",
        "rpcUrl",
        "runtime",
        "hub",
        "environment",
        "interfaceVersion",
        "coreVersion",
        "capabilities"
      ],
      "additionalProperties": false
    },
    "setup": {
      "type": "object",
      "properties": {
        "metadata": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 2
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                },
                "purpose": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "setup": {
                  "type": "object",
                  "properties": {
                    "presetId": {
                      "type": "string",
                      "enum": [
                        "community",
                        "ngo-grants",
                        "gaming-guild",
                        "team",
                        "custom"
                      ]
                    },
                    "presetVersion": {
                      "type": "number",
                      "const": 1
                    },
                    "participantMode": {
                      "type": "string",
                      "enum": [
                        "humans",
                        "mixed",
                        "agents-guarded"
                      ]
                    },
                    "governance": {
                      "type": "object",
                      "properties": {
                        "weight": {
                          "type": "string",
                          "enum": [
                            "member",
                            "credit",
                            "native-stake"
                          ]
                        },
                        "duration": {
                          "type": "integer",
                          "minimum": 60,
                          "maximum": 2592000
                        },
                        "quorumBasisPoints": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 10000
                        },
                        "approvalBasisPoints": {
                          "type": "integer",
                          "minimum": 5001,
                          "maximum": 10000
                        },
                        "governedWorks": {
                          "type": "boolean"
                        },
                        "maxCommitment": {
                          "type": "string"
                        },
                        "dailyCommitment": {
                          "type": "string"
                        },
                        "guardian": {
                          "anyOf": [
                            {
                              "type": "string",
                              "const": ""
                            },
                            {
                              "type": "string",
                              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                            }
                          ]
                        }
                      },
                      "required": [
                        "weight",
                        "duration",
                        "quorumBasisPoints",
                        "approvalBasisPoints",
                        "governedWorks",
                        "maxCommitment",
                        "dailyCommitment",
                        "guardian"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "presetId",
                    "presetVersion",
                    "participantMode",
                    "governance"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description",
                "purpose",
                "setup"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 3
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                },
                "purpose": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "setup": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "presetId": {
                          "type": "string",
                          "enum": [
                            "community",
                            "ngo-grants",
                            "gaming-guild",
                            "team",
                            "custom"
                          ]
                        },
                        "presetVersion": {
                          "type": "number",
                          "const": 1
                        },
                        "participantMode": {
                          "type": "string",
                          "enum": [
                            "humans",
                            "mixed",
                            "agents-guarded"
                          ]
                        },
                        "governance": {
                          "type": "object",
                          "properties": {
                            "weight": {
                              "type": "string",
                              "enum": [
                                "member",
                                "credit",
                                "native-stake"
                              ]
                            },
                            "duration": {
                              "type": "integer",
                              "minimum": 60,
                              "maximum": 2592000
                            },
                            "quorumBasisPoints": {
                              "type": "integer",
                              "minimum": 1,
                              "maximum": 10000
                            },
                            "approvalBasisPoints": {
                              "type": "integer",
                              "minimum": 5001,
                              "maximum": 10000
                            },
                            "governedWorks": {
                              "type": "boolean"
                            },
                            "maxCommitment": {
                              "type": "string"
                            },
                            "dailyCommitment": {
                              "type": "string"
                            },
                            "guardian": {
                              "anyOf": [
                                {
                                  "type": "string",
                                  "const": ""
                                },
                                {
                                  "type": "string",
                                  "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                                }
                              ]
                            }
                          },
                          "required": [
                            "weight",
                            "duration",
                            "quorumBasisPoints",
                            "approvalBasisPoints",
                            "governedWorks",
                            "maxCommitment",
                            "dailyCommitment",
                            "guardian"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "presetId",
                        "presetVersion",
                        "participantMode",
                        "governance"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "branding": {
                  "type": "object",
                  "properties": {
                    "summary": {
                      "type": "string",
                      "maxLength": 280
                    },
                    "logo": {
                      "type": "object",
                      "properties": {
                        "cid": {
                          "type": "string",
                          "maxLength": 128
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 2097152
                        },
                        "mediaType": {
                          "type": "string",
                          "enum": [
                            "image/png",
                            "image/jpeg",
                            "image/webp"
                          ]
                        },
                        "commitment": {
                          "type": "string",
                          "pattern": "^[0-9a-f]{64}$"
                        }
                      },
                      "required": [
                        "cid",
                        "bytes",
                        "mediaType",
                        "commitment"
                      ],
                      "additionalProperties": false
                    },
                    "cover": {
                      "type": "object",
                      "properties": {
                        "cid": {
                          "type": "string",
                          "maxLength": 128
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 2097152
                        },
                        "mediaType": {
                          "type": "string",
                          "enum": [
                            "image/png",
                            "image/jpeg",
                            "image/webp"
                          ]
                        },
                        "commitment": {
                          "type": "string",
                          "pattern": "^[0-9a-f]{64}$"
                        }
                      },
                      "required": [
                        "cid",
                        "bytes",
                        "mediaType",
                        "commitment"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "additionalProperties": false
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description",
                "purpose",
                "setup",
                "branding"
              ],
              "additionalProperties": false
            }
          ]
        },
        "privacy": {
          "type": "string",
          "enum": [
            "public",
            "encrypted-managed-allowed",
            "encrypted-user-controlled"
          ]
        },
        "token": {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "symbol": {
              "type": "string",
              "pattern": "^[A-Z]{1,7}$"
            },
            "precision": {
              "type": "integer",
              "minimum": 0,
              "maximum": 18
            }
          },
          "required": [
            "chainId",
            "contract",
            "symbol",
            "precision"
          ],
          "additionalProperties": false
        },
        "setup": {
          "type": "object",
          "properties": {
            "presetId": {
              "type": "string",
              "enum": [
                "community",
                "ngo-grants",
                "gaming-guild",
                "team",
                "custom"
              ]
            },
            "presetVersion": {
              "type": "number",
              "const": 1
            },
            "participantMode": {
              "type": "string",
              "enum": [
                "humans",
                "mixed",
                "agents-guarded"
              ]
            },
            "governance": {
              "type": "object",
              "properties": {
                "weight": {
                  "type": "string",
                  "enum": [
                    "member",
                    "credit",
                    "native-stake"
                  ]
                },
                "duration": {
                  "type": "integer",
                  "minimum": 60,
                  "maximum": 2592000
                },
                "quorumBasisPoints": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 10000
                },
                "approvalBasisPoints": {
                  "type": "integer",
                  "minimum": 5001,
                  "maximum": 10000
                },
                "governedWorks": {
                  "type": "boolean"
                },
                "maxCommitment": {
                  "type": "string"
                },
                "dailyCommitment": {
                  "type": "string"
                },
                "guardian": {
                  "anyOf": [
                    {
                      "type": "string",
                      "const": ""
                    },
                    {
                      "type": "string",
                      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                    }
                  ]
                }
              },
              "required": [
                "weight",
                "duration",
                "quorumBasisPoints",
                "approvalBasisPoints",
                "governedWorks",
                "maxCommitment",
                "dailyCommitment",
                "guardian"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "presetId",
            "presetVersion",
            "participantMode",
            "governance"
          ],
          "additionalProperties": false
        },
        "foundingAgent": {
          "type": "object",
          "properties": {
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            },
            "operator": {
              "type": "string",
              "minLength": 1,
              "maxLength": 64,
              "pattern": "^[\\x20-\\x7e]+$"
            }
          },
          "required": [
            "signingKey",
            "encryptionKey",
            "operator"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "metadata",
        "privacy",
        "token"
      ],
      "additionalProperties": false
    },
    "creator": {
      "type": "object",
      "properties": {
        "signingKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionKey": {
          "type": "object",
          "properties": {
            "kty": {
              "type": "string",
              "const": "EC"
            },
            "crv": {
              "type": "string",
              "const": "P-256"
            },
            "x": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{43}$"
            },
            "y": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{43}$"
            }
          },
          "required": [
            "kty",
            "crv",
            "x",
            "y"
          ],
          "additionalProperties": false
        },
        "custody": {
          "type": "string",
          "enum": [
            "user-controlled",
            "managed"
          ]
        }
      },
      "required": [
        "signingKey",
        "encryptionKey",
        "custody"
      ],
      "additionalProperties": false
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "deployment": {
      "type": "string",
      "enum": [
        "shared",
        "independent"
      ]
    },
    "method": {
      "type": "string",
      "enum": [
        "card",
        "tlos",
        "free"
      ]
    },
    "usdCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "tlosAmount": {
      "type": [
        "string",
        "null"
      ]
    },
    "recipient": {
      "type": "string"
    },
    "tokenContract": {
      "type": "string"
    },
    "memo": {
      "type": "string"
    },
    "expires": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "state": {
      "type": "string",
      "enum": [
        "awaiting-payment",
        "expired",
        "paid",
        "created"
      ]
    },
    "dao": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "daoId": {
              "type": "string",
              "maxLength": 20
            },
            "interfaceVersion": {
              "type": "number",
              "const": 1
            }
          },
          "required": [
            "chainId",
            "contract",
            "daoId",
            "interfaceVersion"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "checkoutUrl": {
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "network",
    "setup",
    "creator",
    "requestId",
    "deployment",
    "method",
    "usdCents",
    "tlosAmount",
    "recipient",
    "tokenContract",
    "memo",
    "expires",
    "state",
    "dao",
    "checkoutUrl"
  ],
  "additionalProperties": false
}
```

## POST /v1/dao-orders/:id/checkout

Guide: creation-fees.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": [
    "url"
  ],
  "additionalProperties": false
}
```

## POST /v1/dao-orders/:id/fulfill

Guide: creation-fees.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "network": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "rpcUrl": {
          "type": "string",
          "format": "uri"
        },
        "runtime": {
          "type": "string"
        },
        "hub": {
          "type": [
            "string",
            "null"
          ]
        },
        "environment": {
          "type": "string",
          "enum": [
            "local",
            "testnet",
            "mainnet"
          ]
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        },
        "coreVersion": {
          "type": "string"
        },
        "capabilities": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "chainId",
        "rpcUrl",
        "runtime",
        "hub",
        "environment",
        "interfaceVersion",
        "coreVersion",
        "capabilities"
      ],
      "additionalProperties": false
    },
    "setup": {
      "type": "object",
      "properties": {
        "metadata": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 2
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                },
                "purpose": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "setup": {
                  "type": "object",
                  "properties": {
                    "presetId": {
                      "type": "string",
                      "enum": [
                        "community",
                        "ngo-grants",
                        "gaming-guild",
                        "team",
                        "custom"
                      ]
                    },
                    "presetVersion": {
                      "type": "number",
                      "const": 1
                    },
                    "participantMode": {
                      "type": "string",
                      "enum": [
                        "humans",
                        "mixed",
                        "agents-guarded"
                      ]
                    },
                    "governance": {
                      "type": "object",
                      "properties": {
                        "weight": {
                          "type": "string",
                          "enum": [
                            "member",
                            "credit",
                            "native-stake"
                          ]
                        },
                        "duration": {
                          "type": "integer",
                          "minimum": 60,
                          "maximum": 2592000
                        },
                        "quorumBasisPoints": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 10000
                        },
                        "approvalBasisPoints": {
                          "type": "integer",
                          "minimum": 5001,
                          "maximum": 10000
                        },
                        "governedWorks": {
                          "type": "boolean"
                        },
                        "maxCommitment": {
                          "type": "string"
                        },
                        "dailyCommitment": {
                          "type": "string"
                        },
                        "guardian": {
                          "anyOf": [
                            {
                              "type": "string",
                              "const": ""
                            },
                            {
                              "type": "string",
                              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                            }
                          ]
                        }
                      },
                      "required": [
                        "weight",
                        "duration",
                        "quorumBasisPoints",
                        "approvalBasisPoints",
                        "governedWorks",
                        "maxCommitment",
                        "dailyCommitment",
                        "guardian"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "presetId",
                    "presetVersion",
                    "participantMode",
                    "governance"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description",
                "purpose",
                "setup"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 3
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "description": {
                  "default": "",
                  "type": "string",
                  "maxLength": 4000
                },
                "purpose": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "setup": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "presetId": {
                          "type": "string",
                          "enum": [
                            "community",
                            "ngo-grants",
                            "gaming-guild",
                            "team",
                            "custom"
                          ]
                        },
                        "presetVersion": {
                          "type": "number",
                          "const": 1
                        },
                        "participantMode": {
                          "type": "string",
                          "enum": [
                            "humans",
                            "mixed",
                            "agents-guarded"
                          ]
                        },
                        "governance": {
                          "type": "object",
                          "properties": {
                            "weight": {
                              "type": "string",
                              "enum": [
                                "member",
                                "credit",
                                "native-stake"
                              ]
                            },
                            "duration": {
                              "type": "integer",
                              "minimum": 60,
                              "maximum": 2592000
                            },
                            "quorumBasisPoints": {
                              "type": "integer",
                              "minimum": 1,
                              "maximum": 10000
                            },
                            "approvalBasisPoints": {
                              "type": "integer",
                              "minimum": 5001,
                              "maximum": 10000
                            },
                            "governedWorks": {
                              "type": "boolean"
                            },
                            "maxCommitment": {
                              "type": "string"
                            },
                            "dailyCommitment": {
                              "type": "string"
                            },
                            "guardian": {
                              "anyOf": [
                                {
                                  "type": "string",
                                  "const": ""
                                },
                                {
                                  "type": "string",
                                  "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                                }
                              ]
                            }
                          },
                          "required": [
                            "weight",
                            "duration",
                            "quorumBasisPoints",
                            "approvalBasisPoints",
                            "governedWorks",
                            "maxCommitment",
                            "dailyCommitment",
                            "guardian"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "presetId",
                        "presetVersion",
                        "participantMode",
                        "governance"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "branding": {
                  "type": "object",
                  "properties": {
                    "summary": {
                      "type": "string",
                      "maxLength": 280
                    },
                    "logo": {
                      "type": "object",
                      "properties": {
                        "cid": {
                          "type": "string",
                          "maxLength": 128
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 2097152
                        },
                        "mediaType": {
                          "type": "string",
                          "enum": [
                            "image/png",
                            "image/jpeg",
                            "image/webp"
                          ]
                        },
                        "commitment": {
                          "type": "string",
                          "pattern": "^[0-9a-f]{64}$"
                        }
                      },
                      "required": [
                        "cid",
                        "bytes",
                        "mediaType",
                        "commitment"
                      ],
                      "additionalProperties": false
                    },
                    "cover": {
                      "type": "object",
                      "properties": {
                        "cid": {
                          "type": "string",
                          "maxLength": 128
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 2097152
                        },
                        "mediaType": {
                          "type": "string",
                          "enum": [
                            "image/png",
                            "image/jpeg",
                            "image/webp"
                          ]
                        },
                        "commitment": {
                          "type": "string",
                          "pattern": "^[0-9a-f]{64}$"
                        }
                      },
                      "required": [
                        "cid",
                        "bytes",
                        "mediaType",
                        "commitment"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "additionalProperties": false
                }
              },
              "required": [
                "schemaVersion",
                "title",
                "description",
                "purpose",
                "setup",
                "branding"
              ],
              "additionalProperties": false
            }
          ]
        },
        "privacy": {
          "type": "string",
          "enum": [
            "public",
            "encrypted-managed-allowed",
            "encrypted-user-controlled"
          ]
        },
        "token": {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "symbol": {
              "type": "string",
              "pattern": "^[A-Z]{1,7}$"
            },
            "precision": {
              "type": "integer",
              "minimum": 0,
              "maximum": 18
            }
          },
          "required": [
            "chainId",
            "contract",
            "symbol",
            "precision"
          ],
          "additionalProperties": false
        },
        "setup": {
          "type": "object",
          "properties": {
            "presetId": {
              "type": "string",
              "enum": [
                "community",
                "ngo-grants",
                "gaming-guild",
                "team",
                "custom"
              ]
            },
            "presetVersion": {
              "type": "number",
              "const": 1
            },
            "participantMode": {
              "type": "string",
              "enum": [
                "humans",
                "mixed",
                "agents-guarded"
              ]
            },
            "governance": {
              "type": "object",
              "properties": {
                "weight": {
                  "type": "string",
                  "enum": [
                    "member",
                    "credit",
                    "native-stake"
                  ]
                },
                "duration": {
                  "type": "integer",
                  "minimum": 60,
                  "maximum": 2592000
                },
                "quorumBasisPoints": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 10000
                },
                "approvalBasisPoints": {
                  "type": "integer",
                  "minimum": 5001,
                  "maximum": 10000
                },
                "governedWorks": {
                  "type": "boolean"
                },
                "maxCommitment": {
                  "type": "string"
                },
                "dailyCommitment": {
                  "type": "string"
                },
                "guardian": {
                  "anyOf": [
                    {
                      "type": "string",
                      "const": ""
                    },
                    {
                      "type": "string",
                      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                    }
                  ]
                }
              },
              "required": [
                "weight",
                "duration",
                "quorumBasisPoints",
                "approvalBasisPoints",
                "governedWorks",
                "maxCommitment",
                "dailyCommitment",
                "guardian"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "presetId",
            "presetVersion",
            "participantMode",
            "governance"
          ],
          "additionalProperties": false
        },
        "foundingAgent": {
          "type": "object",
          "properties": {
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            },
            "operator": {
              "type": "string",
              "minLength": 1,
              "maxLength": 64,
              "pattern": "^[\\x20-\\x7e]+$"
            }
          },
          "required": [
            "signingKey",
            "encryptionKey",
            "operator"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "metadata",
        "privacy",
        "token"
      ],
      "additionalProperties": false
    },
    "creator": {
      "type": "object",
      "properties": {
        "signingKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionKey": {
          "type": "object",
          "properties": {
            "kty": {
              "type": "string",
              "const": "EC"
            },
            "crv": {
              "type": "string",
              "const": "P-256"
            },
            "x": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{43}$"
            },
            "y": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{43}$"
            }
          },
          "required": [
            "kty",
            "crv",
            "x",
            "y"
          ],
          "additionalProperties": false
        },
        "custody": {
          "type": "string",
          "enum": [
            "user-controlled",
            "managed"
          ]
        }
      },
      "required": [
        "signingKey",
        "encryptionKey",
        "custody"
      ],
      "additionalProperties": false
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "deployment": {
      "type": "string",
      "enum": [
        "shared",
        "independent"
      ]
    },
    "method": {
      "type": "string",
      "enum": [
        "card",
        "tlos",
        "free"
      ]
    },
    "usdCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "tlosAmount": {
      "type": [
        "string",
        "null"
      ]
    },
    "recipient": {
      "type": "string"
    },
    "tokenContract": {
      "type": "string"
    },
    "memo": {
      "type": "string"
    },
    "expires": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "state": {
      "type": "string",
      "enum": [
        "awaiting-payment",
        "expired",
        "paid",
        "created"
      ]
    },
    "dao": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "daoId": {
              "type": "string",
              "maxLength": 20
            },
            "interfaceVersion": {
              "type": "number",
              "const": 1
            }
          },
          "required": [
            "chainId",
            "contract",
            "daoId",
            "interfaceVersion"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "checkoutUrl": {
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "network",
    "setup",
    "creator",
    "requestId",
    "deployment",
    "method",
    "usdCents",
    "tlosAmount",
    "recipient",
    "tokenContract",
    "memo",
    "expires",
    "state",
    "dao",
    "checkoutUrl"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/reports/spending

Guide: spending-reports.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "schemaVersion": {
      "type": "number",
      "const": 1
    },
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "asset": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "symbol": {
          "type": "string",
          "pattern": "^[A-Z]{1,7}$"
        },
        "precision": {
          "type": "integer",
          "minimum": 0,
          "maximum": 18
        }
      },
      "required": [
        "chainId",
        "contract",
        "symbol",
        "precision"
      ],
      "additionalProperties": false
    },
    "read": {
      "type": "object",
      "properties": {
        "startedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        },
        "completedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        },
        "atomic": {
          "type": "boolean",
          "const": false
        }
      },
      "required": [
        "startedAt",
        "completedAt",
        "atomic"
      ],
      "additionalProperties": false
    },
    "complete": {
      "type": "boolean"
    },
    "issues": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "treasury-unavailable",
          "content-unavailable",
          "modules-unavailable",
          "module-records-unavailable",
          "document-reference-unavailable",
          "reconciliation-changed"
        ]
      }
    },
    "receiptCoverage": {
      "type": "string",
      "enum": [
        "since-receipt-upgrade",
        "unavailable"
      ]
    },
    "summary": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "available": {
              "type": "string",
              "maxLength": 20
            },
            "reserved": {
              "type": "string",
              "maxLength": 20
            },
            "claims": {
              "type": "string",
              "maxLength": 20
            },
            "settledObligations": {
              "type": "string",
              "maxLength": 40,
              "pattern": "^(0|[1-9][0-9]*)$"
            },
            "externalCashflow": {
              "type": "string",
              "maxLength": 40,
              "pattern": "^(0|[1-9][0-9]*)$"
            },
            "legacyUnknownSettlements": {
              "type": "string",
              "maxLength": 40,
              "pattern": "^(0|[1-9][0-9]*)$"
            }
          },
          "required": [
            "available",
            "reserved",
            "claims",
            "settledObligations",
            "externalCashflow",
            "legacyUnknownSettlements"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "obligations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "source": {
            "type": "string",
            "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
          },
          "sourceId": {
            "type": "string",
            "maxLength": 20
          },
          "beneficiary": {
            "type": "string",
            "maxLength": 20
          },
          "amount": {
            "type": "string",
            "maxLength": 20
          },
          "due": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "state": {
            "type": "string",
            "enum": [
              "reserved",
              "approved",
              "settled",
              "cancelled"
            ]
          },
          "settlement": {
            "type": "string",
            "enum": [
              "pending",
              "internal-claim",
              "native-payment",
              "legacy-unknown"
            ]
          },
          "receiptId": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 20
              },
              {
                "type": "null"
              }
            ]
          },
          "category": {
            "type": "string",
            "enum": [
              "works",
              "payroll",
              "other"
            ]
          },
          "projectId": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 20
              },
              {
                "type": "null"
              }
            ]
          },
          "agreementTerms": {
            "anyOf": [
              {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              {
                "type": "null"
              }
            ]
          },
          "documents": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "maxLength": 20
                },
                "version": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 9007199254740991
                },
                "cid": {
                  "type": "string"
                },
                "commitment": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{64}$"
                },
                "encrypted": {
                  "type": "boolean"
                }
              },
              "required": [
                "id",
                "version",
                "cid",
                "commitment",
                "encrypted"
              ],
              "additionalProperties": false
            }
          },
          "statements": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "maxLength": 20
                },
                "dao_id": {
                  "type": "string",
                  "maxLength": 20
                },
                "obligation_id": {
                  "type": "string",
                  "maxLength": 20
                },
                "recipient": {
                  "type": "string",
                  "maxLength": 20
                },
                "quantity": {
                  "type": "string",
                  "maxLength": 64,
                  "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                },
                "chain": {
                  "type": "string",
                  "maxLength": 16384
                },
                "payer": {
                  "type": "string",
                  "maxLength": 16384
                },
                "reference": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{64}$"
                },
                "mode": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 255
                }
              },
              "required": [
                "id",
                "dao_id",
                "obligation_id",
                "recipient",
                "quantity",
                "chain",
                "payer",
                "reference",
                "mode"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "id",
          "source",
          "sourceId",
          "beneficiary",
          "amount",
          "due",
          "state",
          "settlement",
          "receiptId",
          "category",
          "projectId",
          "agreementTerms",
          "documents",
          "statements"
        ],
        "additionalProperties": false
      }
    },
    "claimBalances": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "member": {
            "type": "string",
            "maxLength": 20
          },
          "amount": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "member",
          "amount"
        ],
        "additionalProperties": false
      }
    },
    "receipts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "kind": {
            "type": "integer",
            "minimum": 0,
            "maximum": 255
          },
          "obligation_id": {
            "type": "string",
            "maxLength": 20
          },
          "recipient": {
            "type": "string",
            "maxLength": 20
          },
          "destination": {
            "type": "string",
            "maxLength": 13
          },
          "token_contract": {
            "type": "string",
            "maxLength": 13
          },
          "quantity": {
            "type": "string",
            "maxLength": 64,
            "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
          },
          "at": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4294967295
          },
          "transaction_id": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          }
        },
        "required": [
          "id",
          "kind",
          "obligation_id",
          "recipient",
          "destination",
          "token_contract",
          "quantity",
          "at",
          "transaction_id"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "schemaVersion",
    "dao",
    "asset",
    "read",
    "complete",
    "issues",
    "receiptCoverage",
    "summary",
    "obligations",
    "claimBalances",
    "receipts"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/reports/spending/csv

Guide: spending-reports.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "format": {
      "type": "string",
      "const": "csv"
    },
    "content": {
      "type": "string",
      "maxLength": 16777216
    }
  },
  "required": [
    "format",
    "content"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/branding/:slot

Guide: dao-discovery.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "content": {
      "type": "string",
      "minLength": 4,
      "maxLength": 6990508
    },
    "mediaType": {
      "type": "string",
      "enum": [
        "image/png",
        "image/jpeg",
        "image/webp"
      ]
    }
  },
  "required": [
    "content",
    "mediaType"
  ],
  "additionalProperties": false
}
```

## GET /v1/dao-presets

Guide: dao-presets.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "presets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "enum": [
              "community",
              "ngo-grants",
              "gaming-guild",
              "team",
              "custom"
            ]
          },
          "version": {
            "type": "number",
            "const": 1
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "modules": {
            "maxItems": 16,
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9-]{0,31}$"
            }
          },
          "governance": {
            "type": "object",
            "properties": {
              "weight": {
                "type": "string",
                "enum": [
                  "member",
                  "credit",
                  "native-stake"
                ]
              },
              "duration": {
                "type": "integer",
                "minimum": 60,
                "maximum": 2592000
              },
              "quorumBasisPoints": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              },
              "approvalBasisPoints": {
                "type": "integer",
                "minimum": 5001,
                "maximum": 10000
              },
              "governedWorks": {
                "type": "boolean"
              },
              "maxCommitment": {
                "type": "string"
              },
              "dailyCommitment": {
                "type": "string"
              },
              "guardian": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": ""
                  },
                  {
                    "type": "string",
                    "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                  }
                ]
              }
            },
            "required": [
              "weight",
              "duration",
              "quorumBasisPoints",
              "approvalBasisPoints",
              "governedWorks",
              "maxCommitment",
              "dailyCommitment",
              "guardian"
            ],
            "additionalProperties": false
          },
          "helpTopic": {
            "type": "string",
            "const": "dao-presets"
          }
        },
        "required": [
          "id",
          "version",
          "title",
          "description",
          "modules",
          "governance",
          "helpTopic"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "presets"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/governance

Guide: dao-governance.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "policy": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "config": {
              "type": "object",
              "properties": {
                "participant_mode": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 255
                },
                "decide": {
                  "type": "string",
                  "maxLength": 13
                },
                "guardian": {
                  "type": "string",
                  "maxLength": 13
                },
                "kind": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 255
                },
                "duration": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 4294967295
                },
                "quorum": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 65535
                },
                "approval": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 65535
                },
                "governed_works": {
                  "type": "boolean"
                },
                "max_commitment": {
                  "type": "string",
                  "maxLength": 20
                },
                "daily_commitment": {
                  "type": "string",
                  "maxLength": 20
                }
              },
              "required": [
                "participant_mode",
                "decide",
                "guardian",
                "kind",
                "duration",
                "quorum",
                "approval",
                "governed_works",
                "max_commitment",
                "daily_commitment"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "dao_id",
            "revision",
            "config"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "actors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "kind": {
            "type": "integer",
            "minimum": 0,
            "maximum": 255
          },
          "operator_label": {
            "type": "string",
            "maxLength": 16384
          },
          "revoked": {
            "type": "boolean"
          },
          "credential_epoch": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "id",
          "kind",
          "operator_label",
          "revoked",
          "credential_epoch"
        ],
        "additionalProperties": false
      }
    },
    "sessions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "member_id": {
            "type": "string",
            "maxLength": 20
          },
          "signing_key": {
            "type": "string",
            "maxLength": 128
          },
          "expires": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4294967295
          },
          "credential_epoch": {
            "type": "string",
            "maxLength": 20
          },
          "permissions": {
            "maxItems": 64,
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "target": {
                  "type": "string",
                  "maxLength": 13
                },
                "action": {
                  "type": "string",
                  "maxLength": 13
                },
                "code_hash": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{64}$"
                }
              },
              "required": [
                "target",
                "action",
                "code_hash"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "id",
          "member_id",
          "signing_key",
          "expires",
          "credential_epoch",
          "permissions"
        ],
        "additionalProperties": false
      }
    },
    "guardian": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "paused_until": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "reason": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            }
          },
          "required": [
            "dao_id",
            "paused_until",
            "reason"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "budget": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "day": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "committed": {
              "type": "string",
              "maxLength": 20
            }
          },
          "required": [
            "dao_id",
            "day",
            "committed"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "admission": {
      "default": null,
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "mode": {
              "type": "integer",
              "minimum": 0,
              "maximum": 255
            },
            "source": {
              "type": "string",
              "maxLength": 13
            },
            "threshold": {
              "type": "integer",
              "minimum": 0,
              "maximum": 255
            },
            "allow_agents": {
              "type": "boolean"
            },
            "admin_override": {
              "type": "boolean"
            }
          },
          "required": [
            "dao_id",
            "revision",
            "mode",
            "source",
            "threshold",
            "allow_agents",
            "admin_override"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "dao",
    "policy",
    "actors",
    "sessions",
    "guardian",
    "budget",
    "admission"
  ],
  "additionalProperties": false
}
```

## GET /v1/network

Guide: deployments.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "rpcUrl": {
      "type": "string",
      "format": "uri"
    },
    "runtime": {
      "type": "string"
    },
    "hub": {
      "type": [
        "string",
        "null"
      ]
    },
    "environment": {
      "type": "string",
      "enum": [
        "local",
        "testnet",
        "mainnet"
      ]
    },
    "interfaceVersion": {
      "type": "number",
      "const": 1
    },
    "coreVersion": {
      "type": "string"
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "chainId",
    "rpcUrl",
    "runtime",
    "hub",
    "environment",
    "interfaceVersion",
    "coreVersion",
    "capabilities"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos

Guide: deployments.

No request body.

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "after": {
      "type": "string",
      "maxLength": 20
    }
  },
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "daos": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "reference": {
            "type": "object",
            "properties": {
              "chainId": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              "contract": {
                "type": "string",
                "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
              },
              "daoId": {
                "type": "string",
                "maxLength": 20
              },
              "interfaceVersion": {
                "type": "number",
                "const": 1
              }
            },
            "required": [
              "chainId",
              "contract",
              "daoId",
              "interfaceVersion"
            ],
            "additionalProperties": false
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "privacy": {
            "type": "string",
            "enum": [
              "public",
              "encrypted-managed-allowed",
              "encrypted-user-controlled"
            ]
          },
          "owner": {
            "type": "string"
          },
          "token": {
            "type": "object",
            "properties": {
              "chainId": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              "contract": {
                "type": "string",
                "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
              },
              "symbol": {
                "type": "string",
                "pattern": "^[A-Z]{1,7}$"
              },
              "precision": {
                "type": "integer",
                "minimum": 0,
                "maximum": 18
              }
            },
            "required": [
              "chainId",
              "contract",
              "symbol",
              "precision"
            ],
            "additionalProperties": false
          },
          "members": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "available": {
            "type": "string",
            "maxLength": 20
          },
          "reserved": {
            "type": "string",
            "maxLength": 20
          },
          "claims": {
            "type": "string",
            "maxLength": 20
          },
          "keyEpoch": {
            "type": "string",
            "maxLength": 20
          },
          "purpose": {
            "type": "string",
            "enum": [
              "community",
              "ngo-grants",
              "gaming-guild",
              "team",
              "custom"
            ]
          },
          "participantMode": {
            "type": "string",
            "enum": [
              "humans",
              "mixed",
              "agents-guarded"
            ]
          },
          "setup": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "presetId": {
                    "type": "string",
                    "enum": [
                      "community",
                      "ngo-grants",
                      "gaming-guild",
                      "team",
                      "custom"
                    ]
                  },
                  "presetVersion": {
                    "type": "number",
                    "const": 1
                  },
                  "participantMode": {
                    "type": "string",
                    "enum": [
                      "humans",
                      "mixed",
                      "agents-guarded"
                    ]
                  },
                  "governance": {
                    "type": "object",
                    "properties": {
                      "weight": {
                        "type": "string",
                        "enum": [
                          "member",
                          "credit",
                          "native-stake"
                        ]
                      },
                      "duration": {
                        "type": "integer",
                        "minimum": 60,
                        "maximum": 2592000
                      },
                      "quorumBasisPoints": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 10000
                      },
                      "approvalBasisPoints": {
                        "type": "integer",
                        "minimum": 5001,
                        "maximum": 10000
                      },
                      "governedWorks": {
                        "type": "boolean"
                      },
                      "maxCommitment": {
                        "type": "string"
                      },
                      "dailyCommitment": {
                        "type": "string"
                      },
                      "guardian": {
                        "anyOf": [
                          {
                            "type": "string",
                            "const": ""
                          },
                          {
                            "type": "string",
                            "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                          }
                        ]
                      }
                    },
                    "required": [
                      "weight",
                      "duration",
                      "quorumBasisPoints",
                      "approvalBasisPoints",
                      "governedWorks",
                      "maxCommitment",
                      "dailyCommitment",
                      "guardian"
                    ],
                    "additionalProperties": false
                  }
                },
                "required": [
                  "presetId",
                  "presetVersion",
                  "participantMode",
                  "governance"
                ],
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          },
          "branding": {
            "type": "object",
            "properties": {
              "summary": {
                "type": "string",
                "maxLength": 280
              },
              "logo": {
                "type": "object",
                "properties": {
                  "cid": {
                    "type": "string",
                    "maxLength": 128
                  },
                  "bytes": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 2097152
                  },
                  "mediaType": {
                    "type": "string",
                    "enum": [
                      "image/png",
                      "image/jpeg",
                      "image/webp"
                    ]
                  },
                  "commitment": {
                    "type": "string",
                    "pattern": "^[0-9a-f]{64}$"
                  }
                },
                "required": [
                  "cid",
                  "bytes",
                  "mediaType",
                  "commitment"
                ],
                "additionalProperties": false
              },
              "cover": {
                "type": "object",
                "properties": {
                  "cid": {
                    "type": "string",
                    "maxLength": 128
                  },
                  "bytes": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 2097152
                  },
                  "mediaType": {
                    "type": "string",
                    "enum": [
                      "image/png",
                      "image/jpeg",
                      "image/webp"
                    ]
                  },
                  "commitment": {
                    "type": "string",
                    "pattern": "^[0-9a-f]{64}$"
                  }
                },
                "required": [
                  "cid",
                  "bytes",
                  "mediaType",
                  "commitment"
                ],
                "additionalProperties": false
              }
            },
            "additionalProperties": false
          }
        },
        "required": [
          "reference",
          "title",
          "description",
          "privacy",
          "owner",
          "token",
          "members",
          "available",
          "reserved",
          "claims",
          "keyEpoch"
        ],
        "additionalProperties": false
      }
    },
    "next": {
      "default": null,
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "daos",
    "next"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/content

Guide: documents.

No request body.

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "members": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "string",
          "const": "done"
        }
      ]
    },
    "documents": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "string",
          "const": "done"
        }
      ]
    },
    "keyGrants": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "string",
          "const": "done"
        }
      ]
    },
    "epochs": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "string",
          "const": "done"
        }
      ]
    }
  },
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "next": {
      "default": {
        "members": null,
        "documents": null,
        "keyGrants": null,
        "epochs": null
      },
      "type": "object",
      "properties": {
        "members": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 20
            },
            {
              "type": "null"
            }
          ]
        },
        "documents": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 20
            },
            {
              "type": "null"
            }
          ]
        },
        "keyGrants": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 20
            },
            {
              "type": "null"
            }
          ]
        },
        "epochs": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 20
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "members",
        "documents",
        "keyGrants",
        "epochs"
      ],
      "additionalProperties": false
    },
    "members": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "native_account": {
            "type": "string",
            "maxLength": 13
          },
          "signing_key": {
            "type": "string",
            "maxLength": 128
          },
          "encryption_key": {
            "type": "string",
            "maxLength": 16384
          },
          "custody": {
            "type": "integer",
            "minimum": 0,
            "maximum": 255
          },
          "nonce": {
            "type": "string",
            "maxLength": 20
          },
          "credits": {
            "type": "string",
            "maxLength": 20
          },
          "active": {
            "type": "boolean"
          },
          "admin": {
            "type": "boolean"
          },
          "reviewer": {
            "type": "boolean"
          },
          "stake": {
            "type": "string",
            "maxLength": 20
          },
          "claim": {
            "type": "string",
            "maxLength": 20
          },
          "join_epoch": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "id",
          "native_account",
          "signing_key",
          "encryption_key",
          "custody",
          "nonce",
          "credits",
          "active",
          "admin",
          "reviewer",
          "stake",
          "claim",
          "join_epoch"
        ],
        "additionalProperties": false
      }
    },
    "documents": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "document_id": {
            "type": "string",
            "maxLength": 20
          },
          "version": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4294967295
          },
          "author": {
            "type": "string",
            "maxLength": 20
          },
          "cid": {
            "type": "string",
            "maxLength": 16384
          },
          "metadata": {
            "type": "string",
            "maxLength": 16384
          },
          "commitment": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          },
          "bytes": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4294967295
          },
          "envelope_version": {
            "type": "integer",
            "minimum": 0,
            "maximum": 65535
          },
          "key_epoch": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "id",
          "document_id",
          "version",
          "author",
          "cid",
          "metadata",
          "commitment",
          "bytes",
          "envelope_version",
          "key_epoch"
        ],
        "additionalProperties": false
      }
    },
    "keyGrants": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "epoch": {
            "type": "string",
            "maxLength": 20
          },
          "recipient": {
            "type": "string",
            "maxLength": 20
          },
          "grantor": {
            "type": "string",
            "maxLength": 20
          },
          "envelope": {
            "type": "string",
            "maxLength": 16384
          }
        },
        "required": [
          "id",
          "epoch",
          "recipient",
          "grantor",
          "envelope"
        ],
        "additionalProperties": false
      }
    },
    "epochs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "epoch": {
            "type": "string",
            "maxLength": 20
          },
          "commitment": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          },
          "creator": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "epoch",
          "commitment",
          "creator"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "dao",
    "next",
    "members",
    "documents",
    "keyGrants",
    "epochs"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id

Guide: deployments.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "reference": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "privacy": {
      "type": "string",
      "enum": [
        "public",
        "encrypted-managed-allowed",
        "encrypted-user-controlled"
      ]
    },
    "owner": {
      "type": "string"
    },
    "token": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "symbol": {
          "type": "string",
          "pattern": "^[A-Z]{1,7}$"
        },
        "precision": {
          "type": "integer",
          "minimum": 0,
          "maximum": 18
        }
      },
      "required": [
        "chainId",
        "contract",
        "symbol",
        "precision"
      ],
      "additionalProperties": false
    },
    "members": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "available": {
      "type": "string",
      "maxLength": 20
    },
    "reserved": {
      "type": "string",
      "maxLength": 20
    },
    "claims": {
      "type": "string",
      "maxLength": 20
    },
    "keyEpoch": {
      "type": "string",
      "maxLength": 20
    },
    "purpose": {
      "type": "string",
      "enum": [
        "community",
        "ngo-grants",
        "gaming-guild",
        "team",
        "custom"
      ]
    },
    "participantMode": {
      "type": "string",
      "enum": [
        "humans",
        "mixed",
        "agents-guarded"
      ]
    },
    "setup": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "presetId": {
              "type": "string",
              "enum": [
                "community",
                "ngo-grants",
                "gaming-guild",
                "team",
                "custom"
              ]
            },
            "presetVersion": {
              "type": "number",
              "const": 1
            },
            "participantMode": {
              "type": "string",
              "enum": [
                "humans",
                "mixed",
                "agents-guarded"
              ]
            },
            "governance": {
              "type": "object",
              "properties": {
                "weight": {
                  "type": "string",
                  "enum": [
                    "member",
                    "credit",
                    "native-stake"
                  ]
                },
                "duration": {
                  "type": "integer",
                  "minimum": 60,
                  "maximum": 2592000
                },
                "quorumBasisPoints": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 10000
                },
                "approvalBasisPoints": {
                  "type": "integer",
                  "minimum": 5001,
                  "maximum": 10000
                },
                "governedWorks": {
                  "type": "boolean"
                },
                "maxCommitment": {
                  "type": "string"
                },
                "dailyCommitment": {
                  "type": "string"
                },
                "guardian": {
                  "anyOf": [
                    {
                      "type": "string",
                      "const": ""
                    },
                    {
                      "type": "string",
                      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                    }
                  ]
                }
              },
              "required": [
                "weight",
                "duration",
                "quorumBasisPoints",
                "approvalBasisPoints",
                "governedWorks",
                "maxCommitment",
                "dailyCommitment",
                "guardian"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "presetId",
            "presetVersion",
            "participantMode",
            "governance"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "branding": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string",
          "maxLength": 280
        },
        "logo": {
          "type": "object",
          "properties": {
            "cid": {
              "type": "string",
              "maxLength": 128
            },
            "bytes": {
              "type": "integer",
              "minimum": 1,
              "maximum": 2097152
            },
            "mediaType": {
              "type": "string",
              "enum": [
                "image/png",
                "image/jpeg",
                "image/webp"
              ]
            },
            "commitment": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            }
          },
          "required": [
            "cid",
            "bytes",
            "mediaType",
            "commitment"
          ],
          "additionalProperties": false
        },
        "cover": {
          "type": "object",
          "properties": {
            "cid": {
              "type": "string",
              "maxLength": 128
            },
            "bytes": {
              "type": "integer",
              "minimum": 1,
              "maximum": 2097152
            },
            "mediaType": {
              "type": "string",
              "enum": [
                "image/png",
                "image/jpeg",
                "image/webp"
              ]
            },
            "commitment": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            }
          },
          "required": [
            "cid",
            "bytes",
            "mediaType",
            "commitment"
          ],
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "reference",
    "title",
    "description",
    "privacy",
    "owner",
    "token",
    "members",
    "available",
    "reserved",
    "claims",
    "keyEpoch"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/treasury

Guide: treasury.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "obligations": {
      "maxItems": 5000,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "source": {
            "type": "string",
            "maxLength": 13
          },
          "source_id": {
            "type": "string",
            "maxLength": 20
          },
          "recipient": {
            "type": "string",
            "maxLength": 20
          },
          "quantity": {
            "type": "string",
            "maxLength": 64,
            "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
          },
          "due": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4294967295
          },
          "status": {
            "type": "integer",
            "minimum": 0,
            "maximum": 255
          }
        },
        "required": [
          "id",
          "source",
          "source_id",
          "recipient",
          "quantity",
          "due",
          "status"
        ],
        "additionalProperties": false
      }
    },
    "evidence": {
      "maxItems": 5000,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "dao_id": {
            "type": "string",
            "maxLength": 20
          },
          "obligation_id": {
            "type": "string",
            "maxLength": 20
          },
          "recipient": {
            "type": "string",
            "maxLength": 20
          },
          "quantity": {
            "type": "string",
            "maxLength": 64,
            "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
          },
          "chain": {
            "type": "string",
            "maxLength": 16384
          },
          "payer": {
            "type": "string",
            "maxLength": 16384
          },
          "reference": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          },
          "mode": {
            "type": "integer",
            "minimum": 0,
            "maximum": 255
          }
        },
        "required": [
          "id",
          "dao_id",
          "obligation_id",
          "recipient",
          "quantity",
          "chain",
          "payer",
          "reference",
          "mode"
        ],
        "additionalProperties": false
      }
    },
    "receipts": {
      "default": [],
      "maxItems": 5000,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "kind": {
            "type": "integer",
            "minimum": 0,
            "maximum": 255
          },
          "obligation_id": {
            "type": "string",
            "maxLength": 20
          },
          "recipient": {
            "type": "string",
            "maxLength": 20
          },
          "destination": {
            "type": "string",
            "maxLength": 13
          },
          "token_contract": {
            "type": "string",
            "maxLength": 13
          },
          "quantity": {
            "type": "string",
            "maxLength": 64,
            "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
          },
          "at": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4294967295
          },
          "transaction_id": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          }
        },
        "required": [
          "id",
          "kind",
          "obligation_id",
          "recipient",
          "destination",
          "token_contract",
          "quantity",
          "at",
          "transaction_id"
        ],
        "additionalProperties": false
      }
    },
    "receiptsAvailable": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "dao",
    "obligations",
    "evidence",
    "receipts",
    "receiptsAvailable"
  ],
  "additionalProperties": false
}
```

## POST /v1/treasury/settle

Guide: treasury.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "source": {
      "type": "string",
      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
    },
    "sourceId": {
      "type": "string",
      "maxLength": 20
    }
  },
  "required": [
    "dao",
    "source",
    "sourceId"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "state": {
          "type": "string",
          "const": "settled"
        },
        "transactionId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        }
      },
      "required": [
        "state",
        "transactionId"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "state": {
          "type": "string",
          "const": "already-settled"
        }
      },
      "required": [
        "state"
      ],
      "additionalProperties": false
    }
  ]
}
```

## GET /v1/storage

Guide: providers.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": [
        "pinata",
        "local-fixture"
      ]
    },
    "configured": {
      "type": "boolean"
    },
    "uploadLimit": {
      "type": "number",
      "const": 5242880
    }
  },
  "required": [
    "provider",
    "configured",
    "uploadLimit"
  ],
  "additionalProperties": false
}
```

## POST /v1/uploads

Guide: documents.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "schemaVersion": {
      "type": "number",
      "const": 1
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "documentId": {
      "type": "string",
      "maxLength": 20
    },
    "version": {
      "type": "integer",
      "minimum": 1,
      "maximum": 4294967295
    },
    "metadata": {
      "type": "string",
      "maxLength": 4096
    },
    "commitment": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "bytes": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5242880
    },
    "envelopeVersion": {
      "anyOf": [
        {
          "type": "number",
          "const": 0
        },
        {
          "type": "number",
          "const": 1
        }
      ]
    },
    "keyEpoch": {
      "type": "string",
      "maxLength": 20
    },
    "content": {
      "type": "string",
      "minLength": 4,
      "maxLength": 6990508
    }
  },
  "required": [
    "schemaVersion",
    "requestId",
    "dao",
    "documentId",
    "version",
    "metadata",
    "commitment",
    "bytes",
    "envelopeVersion",
    "keyEpoch",
    "content"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "schemaVersion": {
      "type": "number",
      "const": 1
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "documentId": {
      "type": "string",
      "maxLength": 20
    },
    "version": {
      "type": "integer",
      "minimum": 1,
      "maximum": 4294967295
    },
    "metadata": {
      "type": "string",
      "maxLength": 4096
    },
    "commitment": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "bytes": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5242880
    },
    "envelopeVersion": {
      "anyOf": [
        {
          "type": "number",
          "const": 0
        },
        {
          "type": "number",
          "const": 1
        }
      ]
    },
    "keyEpoch": {
      "type": "string",
      "maxLength": 20
    },
    "cid": {
      "type": "string",
      "maxLength": 128
    }
  },
  "required": [
    "schemaVersion",
    "requestId",
    "dao",
    "documentId",
    "version",
    "metadata",
    "commitment",
    "bytes",
    "envelopeVersion",
    "keyEpoch",
    "cid"
  ],
  "additionalProperties": false
}
```

## GET /v1/uploads/:requestId

Guide: documents.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "state": {
      "type": "string",
      "enum": [
        "reserved",
        "uploaded",
        "verified",
        "published",
        "failed"
      ]
    },
    "document": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "type": "number",
          "const": 1
        },
        "requestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "dao": {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "daoId": {
              "type": "string",
              "maxLength": 20
            },
            "interfaceVersion": {
              "type": "number",
              "const": 1
            }
          },
          "required": [
            "chainId",
            "contract",
            "daoId",
            "interfaceVersion"
          ],
          "additionalProperties": false
        },
        "documentId": {
          "type": "string",
          "maxLength": 20
        },
        "version": {
          "type": "integer",
          "minimum": 1,
          "maximum": 4294967295
        },
        "metadata": {
          "type": "string",
          "maxLength": 4096
        },
        "commitment": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "bytes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5242880
        },
        "envelopeVersion": {
          "anyOf": [
            {
              "type": "number",
              "const": 0
            },
            {
              "type": "number",
              "const": 1
            }
          ]
        },
        "keyEpoch": {
          "type": "string",
          "maxLength": 20
        },
        "cid": {
          "type": "string",
          "maxLength": 128
        }
      },
      "required": [
        "schemaVersion",
        "requestId",
        "dao",
        "documentId",
        "version",
        "metadata",
        "commitment",
        "bytes",
        "envelopeVersion",
        "keyEpoch",
        "cid"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "requestId",
    "state"
  ],
  "additionalProperties": false
}
```

## POST /v1/uploads/:requestId/reconcile

Guide: documents.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "default": {},
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "state": {
      "type": "string",
      "enum": [
        "reserved",
        "uploaded",
        "verified",
        "published",
        "failed"
      ]
    },
    "document": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "type": "number",
          "const": 1
        },
        "requestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "dao": {
          "type": "object",
          "properties": {
            "chainId": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "contract": {
              "type": "string",
              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
            },
            "daoId": {
              "type": "string",
              "maxLength": 20
            },
            "interfaceVersion": {
              "type": "number",
              "const": 1
            }
          },
          "required": [
            "chainId",
            "contract",
            "daoId",
            "interfaceVersion"
          ],
          "additionalProperties": false
        },
        "documentId": {
          "type": "string",
          "maxLength": 20
        },
        "version": {
          "type": "integer",
          "minimum": 1,
          "maximum": 4294967295
        },
        "metadata": {
          "type": "string",
          "maxLength": 4096
        },
        "commitment": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "bytes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5242880
        },
        "envelopeVersion": {
          "anyOf": [
            {
              "type": "number",
              "const": 0
            },
            {
              "type": "number",
              "const": 1
            }
          ]
        },
        "keyEpoch": {
          "type": "string",
          "maxLength": 20
        },
        "cid": {
          "type": "string",
          "maxLength": 128
        }
      },
      "required": [
        "schemaVersion",
        "requestId",
        "dao",
        "documentId",
        "version",
        "metadata",
        "commitment",
        "bytes",
        "envelopeVersion",
        "keyEpoch",
        "cid"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "requestId",
    "state"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/documents/:documentId/:version/content

Guide: documents.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "content": {
      "type": "string",
      "minLength": 4,
      "maxLength": 6990508
    }
  },
  "required": [
    "content"
  ],
  "additionalProperties": false
}
```

## POST /v1/auth/challenge

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "signingKey": {
      "type": "string",
      "maxLength": 128
    }
  },
  "required": [
    "signingKey"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "message": {
      "type": "string",
      "maxLength": 2048
    },
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "id",
    "message",
    "expires"
  ],
  "additionalProperties": false
}
```

## POST /v1/auth/login

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "challengeId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "signature": {
      "type": "string",
      "maxLength": 160
    },
    "encryptionKey": {
      "type": "object",
      "properties": {
        "kty": {
          "type": "string",
          "const": "EC"
        },
        "crv": {
          "type": "string",
          "const": "P-256"
        },
        "x": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{43}$"
        },
        "y": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{43}$"
        }
      },
      "required": [
        "kty",
        "crv",
        "x",
        "y"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "challengeId",
    "signature",
    "encryptionKey"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## GET /v1/me

Guide: accounts.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    }
  },
  "required": [
    "account"
  ],
  "additionalProperties": false
}
```

## GET /v1/me/memberships

Guide: members.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "memberships": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "dao": {
            "type": "object",
            "properties": {
              "chainId": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              "contract": {
                "type": "string",
                "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
              },
              "daoId": {
                "type": "string",
                "maxLength": 20
              },
              "interfaceVersion": {
                "type": "number",
                "const": 1
              }
            },
            "required": [
              "chainId",
              "contract",
              "daoId",
              "interfaceVersion"
            ],
            "additionalProperties": false
          },
          "memberId": {
            "type": "string",
            "maxLength": 20
          },
          "nonce": {
            "type": "string",
            "maxLength": 20
          },
          "active": {
            "type": "boolean"
          },
          "admin": {
            "type": "boolean"
          },
          "reviewer": {
            "type": "boolean"
          },
          "credits": {
            "type": "string",
            "maxLength": 20
          },
          "claim": {
            "type": "string",
            "maxLength": 20
          },
          "stake": {
            "type": "string",
            "maxLength": 20
          },
          "nativeAccount": {
            "type": "string"
          },
          "custody": {
            "type": "string",
            "enum": [
              "user-controlled",
              "managed"
            ]
          },
          "signingKey": {
            "type": "string",
            "maxLength": 128
          }
        },
        "required": [
          "dao",
          "memberId",
          "nonce",
          "active",
          "admin",
          "reviewer",
          "credits",
          "claim",
          "stake",
          "nativeAccount",
          "custody"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "memberships"
  ],
  "additionalProperties": false
}
```

## POST /v1/auth/logout

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "default": {},
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "null"
}
```

## POST /v1/auth/providers/link

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": [
        "google",
        "telegram"
      ]
    },
    "proof": {
      "type": "string",
      "minLength": 1,
      "maxLength": 16384
    },
    "nonce": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256
    }
  },
  "required": [
    "provider",
    "proof"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": [
        "google",
        "telegram"
      ]
    },
    "subject": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255
    }
  },
  "required": [
    "provider",
    "subject"
  ],
  "additionalProperties": false
}
```

## POST /v1/auth/providers/login

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": [
        "google",
        "telegram"
      ]
    },
    "proof": {
      "type": "string",
      "minLength": 1,
      "maxLength": 16384
    },
    "nonce": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256
    }
  },
  "required": [
    "provider",
    "proof"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## POST /v1/auth/providers/unlink

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": [
        "google",
        "telegram"
      ]
    },
    "subject": {
      "type": "string",
      "pattern": "^[\\x21-\\x7e]{1,255}$"
    }
  },
  "required": [
    "provider",
    "subject"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "null"
}
```

## POST /v1/daos

Guide: creation-fees.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "metadata": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            },
            "description": {
              "default": "",
              "type": "string",
              "maxLength": 4000
            }
          },
          "required": [
            "schemaVersion",
            "title"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 2
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            },
            "description": {
              "default": "",
              "type": "string",
              "maxLength": 4000
            },
            "purpose": {
              "type": "string",
              "enum": [
                "community",
                "ngo-grants",
                "gaming-guild",
                "team",
                "custom"
              ]
            },
            "setup": {
              "type": "object",
              "properties": {
                "presetId": {
                  "type": "string",
                  "enum": [
                    "community",
                    "ngo-grants",
                    "gaming-guild",
                    "team",
                    "custom"
                  ]
                },
                "presetVersion": {
                  "type": "number",
                  "const": 1
                },
                "participantMode": {
                  "type": "string",
                  "enum": [
                    "humans",
                    "mixed",
                    "agents-guarded"
                  ]
                },
                "governance": {
                  "type": "object",
                  "properties": {
                    "weight": {
                      "type": "string",
                      "enum": [
                        "member",
                        "credit",
                        "native-stake"
                      ]
                    },
                    "duration": {
                      "type": "integer",
                      "minimum": 60,
                      "maximum": 2592000
                    },
                    "quorumBasisPoints": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 10000
                    },
                    "approvalBasisPoints": {
                      "type": "integer",
                      "minimum": 5001,
                      "maximum": 10000
                    },
                    "governedWorks": {
                      "type": "boolean"
                    },
                    "maxCommitment": {
                      "type": "string",
                      "maxLength": 20
                    },
                    "dailyCommitment": {
                      "type": "string",
                      "maxLength": 20
                    },
                    "guardian": {
                      "anyOf": [
                        {
                          "type": "string",
                          "const": ""
                        },
                        {
                          "type": "string",
                          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                        }
                      ]
                    }
                  },
                  "required": [
                    "weight",
                    "duration",
                    "quorumBasisPoints",
                    "approvalBasisPoints",
                    "governedWorks",
                    "maxCommitment",
                    "dailyCommitment",
                    "guardian"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "presetId",
                "presetVersion",
                "participantMode",
                "governance"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "schemaVersion",
            "title",
            "purpose",
            "setup"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 3
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            },
            "description": {
              "default": "",
              "type": "string",
              "maxLength": 4000
            },
            "purpose": {
              "type": "string",
              "enum": [
                "community",
                "ngo-grants",
                "gaming-guild",
                "team",
                "custom"
              ]
            },
            "setup": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "presetId": {
                      "type": "string",
                      "enum": [
                        "community",
                        "ngo-grants",
                        "gaming-guild",
                        "team",
                        "custom"
                      ]
                    },
                    "presetVersion": {
                      "type": "number",
                      "const": 1
                    },
                    "participantMode": {
                      "type": "string",
                      "enum": [
                        "humans",
                        "mixed",
                        "agents-guarded"
                      ]
                    },
                    "governance": {
                      "type": "object",
                      "properties": {
                        "weight": {
                          "type": "string",
                          "enum": [
                            "member",
                            "credit",
                            "native-stake"
                          ]
                        },
                        "duration": {
                          "type": "integer",
                          "minimum": 60,
                          "maximum": 2592000
                        },
                        "quorumBasisPoints": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 10000
                        },
                        "approvalBasisPoints": {
                          "type": "integer",
                          "minimum": 5001,
                          "maximum": 10000
                        },
                        "governedWorks": {
                          "type": "boolean"
                        },
                        "maxCommitment": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "dailyCommitment": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "guardian": {
                          "anyOf": [
                            {
                              "type": "string",
                              "const": ""
                            },
                            {
                              "type": "string",
                              "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                            }
                          ]
                        }
                      },
                      "required": [
                        "weight",
                        "duration",
                        "quorumBasisPoints",
                        "approvalBasisPoints",
                        "governedWorks",
                        "maxCommitment",
                        "dailyCommitment",
                        "guardian"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "presetId",
                    "presetVersion",
                    "participantMode",
                    "governance"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "branding": {
              "type": "object",
              "properties": {
                "summary": {
                  "type": "string",
                  "maxLength": 280
                },
                "logo": {
                  "type": "object",
                  "properties": {
                    "cid": {
                      "type": "string",
                      "maxLength": 128
                    },
                    "bytes": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 2097152
                    },
                    "mediaType": {
                      "type": "string",
                      "enum": [
                        "image/png",
                        "image/jpeg",
                        "image/webp"
                      ]
                    },
                    "commitment": {
                      "type": "string",
                      "pattern": "^[0-9a-f]{64}$"
                    }
                  },
                  "required": [
                    "cid",
                    "bytes",
                    "mediaType",
                    "commitment"
                  ],
                  "additionalProperties": false
                },
                "cover": {
                  "type": "object",
                  "properties": {
                    "cid": {
                      "type": "string",
                      "maxLength": 128
                    },
                    "bytes": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 2097152
                    },
                    "mediaType": {
                      "type": "string",
                      "enum": [
                        "image/png",
                        "image/jpeg",
                        "image/webp"
                      ]
                    },
                    "commitment": {
                      "type": "string",
                      "pattern": "^[0-9a-f]{64}$"
                    }
                  },
                  "required": [
                    "cid",
                    "bytes",
                    "mediaType",
                    "commitment"
                  ],
                  "additionalProperties": false
                }
              },
              "additionalProperties": false
            }
          },
          "required": [
            "schemaVersion",
            "title",
            "purpose",
            "setup",
            "branding"
          ],
          "additionalProperties": false
        }
      ]
    },
    "privacy": {
      "type": "string",
      "enum": [
        "public",
        "encrypted-managed-allowed",
        "encrypted-user-controlled"
      ]
    },
    "token": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "symbol": {
          "type": "string",
          "pattern": "^[A-Z]{1,7}$"
        },
        "precision": {
          "type": "integer",
          "minimum": 0,
          "maximum": 18
        }
      },
      "required": [
        "chainId",
        "contract",
        "symbol",
        "precision"
      ],
      "additionalProperties": false
    },
    "setup": {
      "type": "object",
      "properties": {
        "presetId": {
          "type": "string",
          "enum": [
            "community",
            "ngo-grants",
            "gaming-guild",
            "team",
            "custom"
          ]
        },
        "presetVersion": {
          "type": "number",
          "const": 1
        },
        "participantMode": {
          "type": "string",
          "enum": [
            "humans",
            "mixed",
            "agents-guarded"
          ]
        },
        "governance": {
          "type": "object",
          "properties": {
            "weight": {
              "type": "string",
              "enum": [
                "member",
                "credit",
                "native-stake"
              ]
            },
            "duration": {
              "type": "integer",
              "minimum": 60,
              "maximum": 2592000
            },
            "quorumBasisPoints": {
              "type": "integer",
              "minimum": 1,
              "maximum": 10000
            },
            "approvalBasisPoints": {
              "type": "integer",
              "minimum": 5001,
              "maximum": 10000
            },
            "governedWorks": {
              "type": "boolean"
            },
            "maxCommitment": {
              "type": "string",
              "maxLength": 20
            },
            "dailyCommitment": {
              "type": "string",
              "maxLength": 20
            },
            "guardian": {
              "anyOf": [
                {
                  "type": "string",
                  "const": ""
                },
                {
                  "type": "string",
                  "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                }
              ]
            }
          },
          "required": [
            "weight",
            "duration",
            "quorumBasisPoints",
            "approvalBasisPoints",
            "governedWorks",
            "maxCommitment",
            "dailyCommitment",
            "guardian"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "presetId",
        "presetVersion",
        "participantMode",
        "governance"
      ],
      "additionalProperties": false
    },
    "foundingAgent": {
      "type": "object",
      "properties": {
        "signingKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionKey": {
          "type": "object",
          "properties": {
            "kty": {
              "type": "string",
              "const": "EC"
            },
            "crv": {
              "type": "string",
              "const": "P-256"
            },
            "x": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{43}$"
            },
            "y": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{43}$"
            }
          },
          "required": [
            "kty",
            "crv",
            "x",
            "y"
          ],
          "additionalProperties": false
        },
        "operator": {
          "type": "string",
          "minLength": 1,
          "maxLength": 64,
          "pattern": "^[\\x20-\\x7e]+$"
        }
      },
      "required": [
        "signingKey",
        "encryptionKey",
        "operator"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "metadata",
    "privacy",
    "token"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "const": "CREATION_PAYMENT_REQUIRED"
    },
    "message": {
      "type": "string",
      "const": "Prepare and pay a DAO creation order first."
    }
  },
  "required": [
    "code",
    "message"
  ],
  "additionalProperties": false
}
```

## POST /v1/relay

Guide: modules.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "request": {
          "type": "object",
          "properties": {
            "version": {
              "type": "integer",
              "minimum": 0,
              "maximum": 65535
            },
            "chain_id": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "deployment": {
              "type": "string",
              "maxLength": 13
            },
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "member_id": {
              "type": "string",
              "maxLength": 20
            },
            "nonce": {
              "type": "string",
              "maxLength": 20
            },
            "expires": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "target": {
              "type": "string",
              "maxLength": 13
            },
            "action": {
              "type": "string",
              "maxLength": 13
            },
            "data": {
              "type": "string",
              "maxLength": 32768,
              "pattern": "^(?:[0-9a-f]{2})*$"
            }
          },
          "required": [
            "version",
            "chain_id",
            "deployment",
            "dao_id",
            "member_id",
            "nonce",
            "expires",
            "target",
            "action",
            "data"
          ],
          "additionalProperties": false
        },
        "sig": {
          "type": "string",
          "maxLength": 160
        }
      },
      "required": [
        "request",
        "sig"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "request": {
          "type": "object",
          "properties": {
            "version": {
              "type": "integer",
              "minimum": 0,
              "maximum": 65535
            },
            "chain_id": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "deployment": {
              "type": "string",
              "maxLength": 13
            },
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "member_id": {
              "type": "string",
              "maxLength": 20
            },
            "nonce": {
              "type": "string",
              "maxLength": 20
            },
            "expires": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "target": {
              "type": "string",
              "maxLength": 13
            },
            "action": {
              "type": "string",
              "maxLength": 13
            },
            "data": {
              "type": "string",
              "maxLength": 32768,
              "pattern": "^(?:[0-9a-f]{2})*$"
            }
          },
          "required": [
            "version",
            "chain_id",
            "deployment",
            "dao_id",
            "member_id",
            "nonce",
            "expires",
            "target",
            "action",
            "data"
          ],
          "additionalProperties": false
        },
        "session_id": {
          "type": "string",
          "maxLength": 20
        },
        "sig": {
          "type": "string",
          "maxLength": 160
        }
      },
      "required": [
        "request",
        "session_id",
        "sig"
      ],
      "additionalProperties": false
    }
  ]
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "transactionId": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    }
  },
  "required": [
    "transactionId"
  ],
  "additionalProperties": false
}
```

## GET /v1/hosting/status

Guide: providers.

No request body.

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "string",
      "minLength": 1,
      "maxLength": 512
    }
  },
  "required": [
    "dao"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "pricing": {
      "type": "object",
      "properties": {
        "freeSlots": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5000
        },
        "rates": {
          "type": "object",
          "properties": {
            "first_usd": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "next_usd": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "rest_usd": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            }
          },
          "required": [
            "first_usd",
            "next_usd",
            "rest_usd",
            "revision"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "freeSlots",
        "rates"
      ],
      "additionalProperties": false
    },
    "activeMembers": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5000
    },
    "effectiveCapacity": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    },
    "expires": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "receipt": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "exempt": {
      "type": "boolean"
    },
    "configured": {
      "type": "boolean"
    },
    "subscription": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "requestId": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "state": {
              "type": "string",
              "enum": [
                "pending",
                "active",
                "past-due",
                "canceling",
                "ended",
                "review"
              ]
            },
            "extraSlots": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4999
            },
            "pricing": {
              "type": "object",
              "properties": {
                "freeSlots": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 5000
                },
                "rates": {
                  "type": "object",
                  "properties": {
                    "first_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "next_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "rest_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "revision": {
                      "type": "string",
                      "maxLength": 20
                    }
                  },
                  "required": [
                    "first_usd",
                    "next_usd",
                    "rest_usd",
                    "revision"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "freeSlots",
                "rates"
              ],
              "additionalProperties": false
            },
            "monthlyUsdCents": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9007199254740991
            },
            "checkoutUrl": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "uri"
                },
                {
                  "type": "null"
                }
              ]
            },
            "invoiceUrl": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "uri"
                },
                {
                  "type": "null"
                }
              ]
            },
            "pendingChange": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "requestId": {
                      "type": "string",
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                    },
                    "extraSlots": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4999
                    },
                    "pricing": {
                      "type": "object",
                      "properties": {
                        "freeSlots": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 5000
                        },
                        "rates": {
                          "type": "object",
                          "properties": {
                            "first_usd": {
                              "type": "integer",
                              "minimum": 0,
                              "maximum": 4294967295
                            },
                            "next_usd": {
                              "type": "integer",
                              "minimum": 0,
                              "maximum": 4294967295
                            },
                            "rest_usd": {
                              "type": "integer",
                              "minimum": 0,
                              "maximum": 4294967295
                            },
                            "revision": {
                              "type": "string",
                              "maxLength": 20
                            }
                          },
                          "required": [
                            "first_usd",
                            "next_usd",
                            "rest_usd",
                            "revision"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "freeSlots",
                        "rates"
                      ],
                      "additionalProperties": false
                    },
                    "monthlyUsdCents": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    }
                  },
                  "required": [
                    "requestId",
                    "extraSlots",
                    "pricing",
                    "monthlyUsdCents"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "id",
            "requestId",
            "state",
            "extraSlots",
            "pricing",
            "monthlyUsdCents",
            "checkoutUrl",
            "invoiceUrl",
            "pendingChange"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "dao",
    "pricing",
    "activeMembers",
    "effectiveCapacity",
    "expires",
    "receipt",
    "exempt",
    "configured",
    "subscription"
  ],
  "additionalProperties": false
}
```

## POST /v1/hosting/change

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "extraSlots": {
      "type": "integer",
      "minimum": 0,
      "maximum": 4999
    },
    "pricingHash": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "monthlyUsdCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 499900000
    },
    "acceptCurrentPricing": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "dao",
    "requestId",
    "extraSlots",
    "pricingHash",
    "monthlyUsdCents"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "pricing": {
      "type": "object",
      "properties": {
        "freeSlots": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5000
        },
        "rates": {
          "type": "object",
          "properties": {
            "first_usd": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "next_usd": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "rest_usd": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            }
          },
          "required": [
            "first_usd",
            "next_usd",
            "rest_usd",
            "revision"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "freeSlots",
        "rates"
      ],
      "additionalProperties": false
    },
    "activeMembers": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5000
    },
    "effectiveCapacity": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    },
    "expires": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "receipt": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "exempt": {
      "type": "boolean"
    },
    "configured": {
      "type": "boolean"
    },
    "subscription": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "requestId": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "state": {
              "type": "string",
              "enum": [
                "pending",
                "active",
                "past-due",
                "canceling",
                "ended",
                "review"
              ]
            },
            "extraSlots": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4999
            },
            "pricing": {
              "type": "object",
              "properties": {
                "freeSlots": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 5000
                },
                "rates": {
                  "type": "object",
                  "properties": {
                    "first_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "next_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "rest_usd": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4294967295
                    },
                    "revision": {
                      "type": "string",
                      "maxLength": 20
                    }
                  },
                  "required": [
                    "first_usd",
                    "next_usd",
                    "rest_usd",
                    "revision"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "freeSlots",
                "rates"
              ],
              "additionalProperties": false
            },
            "monthlyUsdCents": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9007199254740991
            },
            "checkoutUrl": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "uri"
                },
                {
                  "type": "null"
                }
              ]
            },
            "invoiceUrl": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "uri"
                },
                {
                  "type": "null"
                }
              ]
            },
            "pendingChange": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "requestId": {
                      "type": "string",
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                    },
                    "extraSlots": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 4999
                    },
                    "pricing": {
                      "type": "object",
                      "properties": {
                        "freeSlots": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 5000
                        },
                        "rates": {
                          "type": "object",
                          "properties": {
                            "first_usd": {
                              "type": "integer",
                              "minimum": 0,
                              "maximum": 4294967295
                            },
                            "next_usd": {
                              "type": "integer",
                              "minimum": 0,
                              "maximum": 4294967295
                            },
                            "rest_usd": {
                              "type": "integer",
                              "minimum": 0,
                              "maximum": 4294967295
                            },
                            "revision": {
                              "type": "string",
                              "maxLength": 20
                            }
                          },
                          "required": [
                            "first_usd",
                            "next_usd",
                            "rest_usd",
                            "revision"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "freeSlots",
                        "rates"
                      ],
                      "additionalProperties": false
                    },
                    "monthlyUsdCents": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    }
                  },
                  "required": [
                    "requestId",
                    "extraSlots",
                    "pricing",
                    "monthlyUsdCents"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "id",
            "requestId",
            "state",
            "extraSlots",
            "pricing",
            "monthlyUsdCents",
            "checkoutUrl",
            "invoiceUrl",
            "pendingChange"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "dao",
    "pricing",
    "activeMembers",
    "effectiveCapacity",
    "expires",
    "receipt",
    "exempt",
    "configured",
    "subscription"
  ],
  "additionalProperties": false
}
```

## GET /v1/payments/status

Guide: providers.

No request body.

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "string",
      "minLength": 1,
      "maxLength": 512
    }
  },
  "required": [
    "dao"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "configured": {
      "type": "boolean"
    },
    "accountId": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^acct_[A-Za-z0-9]+$"
        },
        {
          "type": "null"
        }
      ]
    },
    "accountKind": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "oauth",
            "v2"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "state": {
      "type": "string",
      "enum": [
        "not-connected",
        "pending",
        "ready",
        "restricted",
        "disconnected"
      ]
    },
    "chargesEnabled": {
      "type": "boolean"
    },
    "payoutsEnabled": {
      "type": "boolean"
    },
    "policy": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "basisPoints": {
              "default": 500,
              "type": "integer",
              "minimum": 0,
              "maximum": 9999
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            }
          },
          "required": [
            "basisPoints",
            "revision"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "products": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "dao": {
            "type": "object",
            "properties": {
              "chainId": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              "contract": {
                "type": "string",
                "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
              },
              "daoId": {
                "type": "string",
                "maxLength": 20
              },
              "interfaceVersion": {
                "type": "number",
                "const": 1
              }
            },
            "required": [
              "chainId",
              "contract",
              "daoId",
              "interfaceVersion"
            ],
            "additionalProperties": false
          },
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          },
          "moduleId": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{0,63}$"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "amountMinor": {
            "type": "integer",
            "minimum": 50,
            "maximum": 99999999
          },
          "active": {
            "default": true,
            "type": "boolean"
          },
          "currency": {
            "type": "string",
            "const": "usd"
          }
        },
        "required": [
          "dao",
          "id",
          "moduleId",
          "title",
          "amountMinor",
          "active",
          "currency"
        ],
        "additionalProperties": false
      }
    },
    "brokerConfigured": {
      "type": "boolean"
    },
    "merchantSetupUrl": {
      "default": null,
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "dao",
    "configured",
    "accountId",
    "accountKind",
    "state",
    "chargesEnabled",
    "payoutsEnabled",
    "policy",
    "products",
    "brokerConfigured",
    "merchantSetupUrl"
  ],
  "additionalProperties": false
}
```

## GET /v1/payments/catalogue

Guide: providers.

No request body.

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "string",
      "minLength": 1,
      "maxLength": 512
    }
  },
  "required": [
    "dao"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "enabled": {
      "type": "boolean"
    },
    "policy": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "basisPoints": {
              "default": 500,
              "type": "integer",
              "minimum": 0,
              "maximum": 9999
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            }
          },
          "required": [
            "basisPoints",
            "revision"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "products": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "dao": {
            "type": "object",
            "properties": {
              "chainId": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              "contract": {
                "type": "string",
                "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
              },
              "daoId": {
                "type": "string",
                "maxLength": 20
              },
              "interfaceVersion": {
                "type": "number",
                "const": 1
              }
            },
            "required": [
              "chainId",
              "contract",
              "daoId",
              "interfaceVersion"
            ],
            "additionalProperties": false
          },
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          },
          "moduleId": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{0,63}$"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "amountMinor": {
            "type": "integer",
            "minimum": 50,
            "maximum": 99999999
          },
          "active": {
            "default": true,
            "type": "boolean"
          },
          "currency": {
            "type": "string",
            "const": "usd"
          }
        },
        "required": [
          "dao",
          "id",
          "moduleId",
          "title",
          "amountMinor",
          "active",
          "currency"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "dao",
    "enabled",
    "policy",
    "products"
  ],
  "additionalProperties": false
}
```

## POST /v1/payments/onboard

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "mode": {
      "type": "string",
      "enum": [
        "existing",
        "new",
        "resume"
      ]
    }
  },
  "required": [
    "dao",
    "mode"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": [
    "url"
  ],
  "additionalProperties": false
}
```

## POST /v1/payments/product

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "moduleId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{0,63}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "amountMinor": {
      "type": "integer",
      "minimum": 50,
      "maximum": 99999999
    },
    "active": {
      "default": true,
      "type": "boolean"
    }
  },
  "required": [
    "dao",
    "id",
    "moduleId",
    "title",
    "amountMinor"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "moduleId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{0,63}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "amountMinor": {
      "type": "integer",
      "minimum": 50,
      "maximum": 99999999
    },
    "active": {
      "default": true,
      "type": "boolean"
    },
    "currency": {
      "type": "string",
      "const": "usd"
    }
  },
  "required": [
    "dao",
    "id",
    "moduleId",
    "title",
    "amountMinor",
    "active",
    "currency"
  ],
  "additionalProperties": false
}
```

## POST /v1/payments/checkout

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "productId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    }
  },
  "required": [
    "dao",
    "productId",
    "requestId"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "productId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "title": {
      "type": "string"
    },
    "moduleId": {
      "type": "string"
    },
    "amountMinor": {
      "type": "integer",
      "minimum": 50,
      "maximum": 99999999
    },
    "currency": {
      "type": "string",
      "const": "usd"
    },
    "applicationFeeMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "policy": {
      "type": "object",
      "properties": {
        "basisPoints": {
          "default": 500,
          "type": "integer",
          "minimum": 0,
          "maximum": 9999
        },
        "revision": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "basisPoints",
        "revision"
      ],
      "additionalProperties": false
    },
    "state": {
      "type": "string",
      "enum": [
        "pending",
        "open",
        "paid",
        "failed",
        "expired"
      ]
    },
    "checkoutUrl": {
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    },
    "refundedMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "dispute": {
      "type": "string",
      "enum": [
        "none",
        "open",
        "won",
        "lost"
      ]
    }
  },
  "required": [
    "id",
    "dao",
    "productId",
    "title",
    "moduleId",
    "amountMinor",
    "currency",
    "applicationFeeMinor",
    "policy",
    "state",
    "checkoutUrl",
    "refundedMinor",
    "dispute"
  ],
  "additionalProperties": false
}
```

## GET /v1/payments/orders/:id

Guide: providers.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "productId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "title": {
      "type": "string"
    },
    "moduleId": {
      "type": "string"
    },
    "amountMinor": {
      "type": "integer",
      "minimum": 50,
      "maximum": 99999999
    },
    "currency": {
      "type": "string",
      "const": "usd"
    },
    "applicationFeeMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "policy": {
      "type": "object",
      "properties": {
        "basisPoints": {
          "default": 500,
          "type": "integer",
          "minimum": 0,
          "maximum": 9999
        },
        "revision": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "basisPoints",
        "revision"
      ],
      "additionalProperties": false
    },
    "state": {
      "type": "string",
      "enum": [
        "pending",
        "open",
        "paid",
        "failed",
        "expired"
      ]
    },
    "checkoutUrl": {
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    },
    "refundedMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "dispute": {
      "type": "string",
      "enum": [
        "none",
        "open",
        "won",
        "lost"
      ]
    }
  },
  "required": [
    "id",
    "dao",
    "productId",
    "title",
    "moduleId",
    "amountMinor",
    "currency",
    "applicationFeeMinor",
    "policy",
    "state",
    "checkoutUrl",
    "refundedMinor",
    "dispute"
  ],
  "additionalProperties": false
}
```

## POST /v1/payments/refund

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "orderId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "amountMinor": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 99999999
    }
  },
  "required": [
    "dao",
    "orderId",
    "requestId",
    "amountMinor"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "productId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "title": {
      "type": "string"
    },
    "moduleId": {
      "type": "string"
    },
    "amountMinor": {
      "type": "integer",
      "minimum": 50,
      "maximum": 99999999
    },
    "currency": {
      "type": "string",
      "const": "usd"
    },
    "applicationFeeMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "policy": {
      "type": "object",
      "properties": {
        "basisPoints": {
          "default": 500,
          "type": "integer",
          "minimum": 0,
          "maximum": 9999
        },
        "revision": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "basisPoints",
        "revision"
      ],
      "additionalProperties": false
    },
    "state": {
      "type": "string",
      "enum": [
        "pending",
        "open",
        "paid",
        "failed",
        "expired"
      ]
    },
    "checkoutUrl": {
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    },
    "refundedMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "dispute": {
      "type": "string",
      "enum": [
        "none",
        "open",
        "won",
        "lost"
      ]
    }
  },
  "required": [
    "id",
    "dao",
    "productId",
    "title",
    "moduleId",
    "amountMinor",
    "currency",
    "applicationFeeMinor",
    "policy",
    "state",
    "checkoutUrl",
    "refundedMinor",
    "dispute"
  ],
  "additionalProperties": false
}
```

## POST /v1/payments/operator

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "dao"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "token": {
      "type": "string",
      "pattern": "^dcp_[A-Za-z0-9_-]{43}$"
    }
  },
  "required": [
    "token"
  ],
  "additionalProperties": false
}
```

## POST /v1/payments/operator/revoke

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "dao"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "null"
}
```

## POST /v1/payments/broker/checkout

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "productId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "customerReference": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,128}$"
    }
  },
  "required": [
    "dao",
    "productId",
    "requestId",
    "customerReference"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "productId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "title": {
      "type": "string"
    },
    "moduleId": {
      "type": "string"
    },
    "amountMinor": {
      "type": "integer",
      "minimum": 50,
      "maximum": 99999999
    },
    "currency": {
      "type": "string",
      "const": "usd"
    },
    "applicationFeeMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "policy": {
      "type": "object",
      "properties": {
        "basisPoints": {
          "default": 500,
          "type": "integer",
          "minimum": 0,
          "maximum": 9999
        },
        "revision": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "basisPoints",
        "revision"
      ],
      "additionalProperties": false
    },
    "state": {
      "type": "string",
      "enum": [
        "pending",
        "open",
        "paid",
        "failed",
        "expired"
      ]
    },
    "checkoutUrl": {
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    },
    "refundedMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "dispute": {
      "type": "string",
      "enum": [
        "none",
        "open",
        "won",
        "lost"
      ]
    }
  },
  "required": [
    "id",
    "dao",
    "productId",
    "title",
    "moduleId",
    "amountMinor",
    "currency",
    "applicationFeeMinor",
    "policy",
    "state",
    "checkoutUrl",
    "refundedMinor",
    "dispute"
  ],
  "additionalProperties": false
}
```

## POST /v1/payments/broker/order

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "orderId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    }
  },
  "required": [
    "dao",
    "orderId"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "productId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "title": {
      "type": "string"
    },
    "moduleId": {
      "type": "string"
    },
    "amountMinor": {
      "type": "integer",
      "minimum": 50,
      "maximum": 99999999
    },
    "currency": {
      "type": "string",
      "const": "usd"
    },
    "applicationFeeMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "policy": {
      "type": "object",
      "properties": {
        "basisPoints": {
          "default": 500,
          "type": "integer",
          "minimum": 0,
          "maximum": 9999
        },
        "revision": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "basisPoints",
        "revision"
      ],
      "additionalProperties": false
    },
    "state": {
      "type": "string",
      "enum": [
        "pending",
        "open",
        "paid",
        "failed",
        "expired"
      ]
    },
    "checkoutUrl": {
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    },
    "refundedMinor": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "dispute": {
      "type": "string",
      "enum": [
        "none",
        "open",
        "won",
        "lost"
      ]
    }
  },
  "required": [
    "id",
    "dao",
    "productId",
    "title",
    "moduleId",
    "amountMinor",
    "currency",
    "applicationFeeMinor",
    "policy",
    "state",
    "checkoutUrl",
    "refundedMinor",
    "dispute"
  ],
  "additionalProperties": false
}
```

## POST /v1/payments/broker/status

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "dao"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "dao": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "contract": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "daoId": {
          "type": "string",
          "maxLength": 20
        },
        "interfaceVersion": {
          "type": "number",
          "const": 1
        }
      },
      "required": [
        "chainId",
        "contract",
        "daoId",
        "interfaceVersion"
      ],
      "additionalProperties": false
    },
    "configured": {
      "type": "boolean"
    },
    "accountId": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^acct_[A-Za-z0-9]+$"
        },
        {
          "type": "null"
        }
      ]
    },
    "accountKind": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "oauth",
            "v2"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "state": {
      "type": "string",
      "enum": [
        "not-connected",
        "pending",
        "ready",
        "restricted",
        "disconnected"
      ]
    },
    "chargesEnabled": {
      "type": "boolean"
    },
    "payoutsEnabled": {
      "type": "boolean"
    },
    "policy": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "basisPoints": {
              "default": 500,
              "type": "integer",
              "minimum": 0,
              "maximum": 9999
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            }
          },
          "required": [
            "basisPoints",
            "revision"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "products": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "dao": {
            "type": "object",
            "properties": {
              "chainId": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              "contract": {
                "type": "string",
                "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
              },
              "daoId": {
                "type": "string",
                "maxLength": 20
              },
              "interfaceVersion": {
                "type": "number",
                "const": 1
              }
            },
            "required": [
              "chainId",
              "contract",
              "daoId",
              "interfaceVersion"
            ],
            "additionalProperties": false
          },
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          },
          "moduleId": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{0,63}$"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "amountMinor": {
            "type": "integer",
            "minimum": 50,
            "maximum": 99999999
          },
          "active": {
            "default": true,
            "type": "boolean"
          },
          "currency": {
            "type": "string",
            "const": "usd"
          }
        },
        "required": [
          "dao",
          "id",
          "moduleId",
          "title",
          "amountMinor",
          "active",
          "currency"
        ],
        "additionalProperties": false
      }
    },
    "brokerConfigured": {
      "type": "boolean"
    },
    "merchantSetupUrl": {
      "default": null,
      "anyOf": [
        {
          "type": "string",
          "format": "uri"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "dao",
    "configured",
    "accountId",
    "accountKind",
    "state",
    "chargesEnabled",
    "payoutsEnabled",
    "policy",
    "products",
    "brokerConfigured",
    "merchantSetupUrl"
  ],
  "additionalProperties": false
}
```

## GET /v1/hub/directory

Guide: providers.

No request body.

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "after": {
      "type": "string",
      "maxLength": 20
    }
  },
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "reference": {
            "type": "object",
            "properties": {
              "chainId": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              "contract": {
                "type": "string",
                "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
              },
              "daoId": {
                "type": "string",
                "maxLength": 20
              },
              "interfaceVersion": {
                "type": "number",
                "const": 1
              }
            },
            "required": [
              "chainId",
              "contract",
              "daoId",
              "interfaceVersion"
            ],
            "additionalProperties": false
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "purpose": {
            "type": "string",
            "enum": [
              "community",
              "ngo-grants",
              "gaming-guild",
              "team",
              "custom"
            ]
          },
          "privacy": {
            "type": "string",
            "enum": [
              "public",
              "encrypted-managed-allowed",
              "encrypted-user-controlled"
            ]
          },
          "operator": {
            "type": "string"
          },
          "codeHash": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          },
          "abiHash": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          },
          "portal": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "mode": {
                    "type": "string",
                    "const": "daclify"
                  },
                  "apiOrigin": {
                    "type": "string",
                    "maxLength": 512,
                    "format": "uri"
                  }
                },
                "required": [
                  "mode",
                  "apiOrigin"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "mode": {
                    "type": "string",
                    "const": "external"
                  },
                  "url": {
                    "type": "string",
                    "maxLength": 512,
                    "format": "uri"
                  }
                },
                "required": [
                  "mode",
                  "url"
                ],
                "additionalProperties": false
              }
            ]
          },
          "source": {
            "type": "string",
            "const": "hub-registry"
          },
          "verification": {
            "type": "string",
            "const": "owner-registered"
          }
        },
        "required": [
          "reference",
          "title",
          "description",
          "purpose",
          "privacy",
          "operator",
          "codeHash",
          "abiHash",
          "portal",
          "source",
          "verification"
        ],
        "additionalProperties": false
      }
    },
    "skipped": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "next": {
      "default": null,
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "entries",
    "skipped",
    "next"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/email/login/start

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "minLength": 3,
      "maxLength": 254
    }
  },
  "required": [
    "email"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "delivery": {
      "type": "string",
      "const": "sent"
    }
  },
  "required": [
    "delivery"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/remove

Guide: providers. HTTP 204.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "method": {
      "type": "string",
      "enum": [
        "telegram",
        "email",
        "passkey"
      ]
    },
    "subject": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2048
    }
  },
  "required": [
    "method",
    "subject"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "not": {}
}
```

## POST /v1/account/native/unlink

Guide: accounts. HTTP 204.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    }
  },
  "required": [
    "chainId"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "not": {}
}
```

## POST /v1/account/evm/unlink

Guide: accounts. HTTP 204.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "anyOf": [
        {
          "type": "number",
          "const": 40
        },
        {
          "type": "number",
          "const": 41
        }
      ]
    }
  },
  "required": [
    "chainId"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "not": {}
}
```

## GET /v1/account/history

Guide: accounts.

No request body.

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "before": {
      "type": "string",
      "maxLength": 20
    }
  },
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
          },
          "action": {
            "type": "string",
            "enum": [
              "linked",
              "unlinked",
              "updated"
            ]
          },
          "method": {
            "type": "string",
            "enum": [
              "email",
              "telegram",
              "google",
              "passkey",
              "native",
              "evm"
            ]
          },
          "subject": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2048
          },
          "chainId": {
            "type": [
              "string",
              "null"
            ]
          },
          "at": {
            "type": "string",
            "format": "date-time",
            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
          }
        },
        "required": [
          "id",
          "action",
          "method",
          "subject",
          "chainId",
          "at"
        ],
        "additionalProperties": false
      }
    },
    "next": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "entries",
    "next"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/evm/:member

Guide: providers.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "binding": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "member_id": {
              "type": "string",
              "maxLength": 20
            },
            "chain_id": {
              "type": "string",
              "maxLength": 20
            },
            "address": {
              "type": "string",
              "pattern": "^[0-9a-f]{40}$"
            },
            "epoch": {
              "type": "string",
              "maxLength": 20
            },
            "active": {
              "type": "boolean"
            }
          },
          "required": [
            "member_id",
            "chain_id",
            "address",
            "epoch",
            "active"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "binding"
  ],
  "additionalProperties": false
}
```

## POST /v1/relay/evm

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "request": {
      "type": "object",
      "properties": {
        "version": {
          "type": "integer",
          "minimum": 0,
          "maximum": 65535
        },
        "chain_id": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "deployment": {
          "type": "string",
          "maxLength": 13
        },
        "dao_id": {
          "type": "string",
          "maxLength": 20
        },
        "member_id": {
          "type": "string",
          "maxLength": 20
        },
        "nonce": {
          "type": "string",
          "maxLength": 20
        },
        "expires": {
          "type": "integer",
          "minimum": 0,
          "maximum": 4294967295
        },
        "target": {
          "type": "string",
          "maxLength": 13
        },
        "action": {
          "type": "string",
          "maxLength": 13
        },
        "data": {
          "type": "string",
          "maxLength": 32768,
          "pattern": "^(?:[0-9a-f]{2})*$"
        }
      },
      "required": [
        "version",
        "chain_id",
        "deployment",
        "dao_id",
        "member_id",
        "nonce",
        "expires",
        "target",
        "action",
        "data"
      ],
      "additionalProperties": false
    },
    "evm_chain_id": {
      "type": "string",
      "maxLength": 20
    },
    "address": {
      "type": "string",
      "pattern": "^[0-9a-f]{40}$"
    },
    "binding_epoch": {
      "type": "string",
      "maxLength": 20
    },
    "proof": {
      "type": "string",
      "maxLength": 32768,
      "pattern": "^(?:[0-9a-f]{2})*$"
    }
  },
  "required": [
    "request",
    "evm_chain_id",
    "address",
    "binding_epoch",
    "proof"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "transactionId": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    }
  },
  "required": [
    "transactionId"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/evm/sign-in/challenge

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "purpose": {
      "type": "string",
      "enum": [
        "login",
        "pair"
      ]
    },
    "chainId": {
      "anyOf": [
        {
          "type": "number",
          "const": 40
        },
        {
          "type": "number",
          "const": 41
        }
      ]
    },
    "address": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{40}$"
    }
  },
  "required": [
    "purpose",
    "chainId",
    "address"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "message": {
      "type": "string",
      "maxLength": 2048
    },
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    },
    "chainId": {
      "anyOf": [
        {
          "type": "number",
          "const": 40
        },
        {
          "type": "number",
          "const": 41
        }
      ]
    },
    "address": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{40}$"
    }
  },
  "required": [
    "id",
    "message",
    "expires",
    "chainId",
    "address"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/evm/sign-in/link

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "signature": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{130}$"
    }
  },
  "required": [
    "id",
    "signature"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "anyOf": [
        {
          "type": "number",
          "const": 40
        },
        {
          "type": "number",
          "const": 41
        }
      ]
    },
    "address": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{40}$"
    }
  },
  "required": [
    "chainId",
    "address"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/evm

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "signature": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{130}$"
    }
  },
  "required": [
    "id",
    "signature"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## GET /v1/account/native

Guide: accounts.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "links": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "chainId": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$"
          },
          "account": {
            "type": "string",
            "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
          },
          "permission": {
            "type": "string",
            "const": "active"
          }
        },
        "required": [
          "chainId",
          "account",
          "permission"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "links"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/native/challenge

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "type": "string",
      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
    },
    "permission": {
      "type": "string",
      "const": "active"
    },
    "purpose": {
      "type": "string",
      "enum": [
        "login",
        "pair"
      ]
    }
  },
  "required": [
    "account",
    "permission",
    "purpose"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "message": {
      "type": "string",
      "maxLength": 2048
    },
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    },
    "identity": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "account": {
          "type": "string",
          "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
        },
        "permission": {
          "type": "string",
          "const": "active"
        }
      },
      "required": [
        "chainId",
        "account",
        "permission"
      ],
      "additionalProperties": false
    },
    "runtime": {
      "type": "string",
      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
    }
  },
  "required": [
    "id",
    "message",
    "expires",
    "identity",
    "runtime"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/native/link

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "proof": {
      "type": "object",
      "properties": {
        "packedTransaction": {
          "type": "string",
          "pattern": "^(?:[0-9a-f]{2}){1,4096}$"
        },
        "signatures": {
          "minItems": 1,
          "maxItems": 8,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          }
        }
      },
      "required": [
        "packedTransaction",
        "signatures"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "id",
    "proof"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "account": {
      "type": "string",
      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
    },
    "permission": {
      "type": "string",
      "const": "active"
    }
  },
  "required": [
    "chainId",
    "account",
    "permission"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/native

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "proof": {
      "type": "object",
      "properties": {
        "packedTransaction": {
          "type": "string",
          "pattern": "^(?:[0-9a-f]{2}){1,4096}$"
        },
        "signatures": {
          "minItems": 1,
          "maxItems": 8,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          }
        }
      },
      "required": [
        "packedTransaction",
        "signatures"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "id",
    "proof"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/control

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "enum": [
        "/v1/hosting/change",
        "/v1/payments/onboard",
        "/v1/payments/product",
        "/v1/payments/refund",
        "/v1/payments/operator",
        "/v1/payments/operator/revoke",
        "/v1/account/vault",
        "/v1/auth/providers/link",
        "/v1/auth/providers/unlink",
        "/v1/sign-in/email/confirm",
        "/v1/sign-in/telegram",
        "/v1/sign-in/telegram/oidc/pair/confirm",
        "/v1/sign-in/passkey/register",
        "/v1/sign-in/remove",
        "/v1/account/evm/link",
        "/v1/account/evm/unlink",
        "/v1/account/native/link",
        "/v1/account/native/unlink",
        "/v1/account/evm/sign-in/link"
      ]
    },
    "bodyHash": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    }
  },
  "required": [
    "path",
    "bodyHash"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "message": {
      "type": "string",
      "maxLength": 2048
    },
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "id",
    "message",
    "expires"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/session

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/telegram/oidc/login/start

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "returnTo": {
      "type": "string",
      "maxLength": 2048
    }
  },
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "authorizationUrl": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": [
    "authorizationUrl"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/telegram/oidc/pair/start

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "returnTo": {
      "type": "string",
      "maxLength": 2048
    }
  },
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "authorizationUrl": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": [
    "authorizationUrl"
  ],
  "additionalProperties": false
}
```

## GET /v1/sign-in/telegram/oidc/pair/:id

Guide: providers.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "subject": {
      "type": [
        "string",
        "null"
      ]
    },
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "id",
    "subject",
    "expires"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/telegram/oidc/pair/confirm

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": [
        "google",
        "telegram"
      ]
    },
    "subject": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255
    }
  },
  "required": [
    "provider",
    "subject"
  ],
  "additionalProperties": false
}
```

## GET /v1/profile

Guide: accounts.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "accountName": {
      "type": [
        "string",
        "null"
      ]
    },
    "profile": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "accountName",
    "profile"
  ],
  "additionalProperties": false
}
```

## POST /v1/billing/checkout

Guide: service-payment.

Request fields are not included in this response reference; consult the endpoint implementation.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": [
    "url"
  ],
  "additionalProperties": false
}
```

## GET /v1/billing/receipts

Guide: service-payment.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "receipts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "paid",
              "failed"
            ]
          },
          "currency": {
            "anyOf": [
              {
                "type": "string",
                "pattern": "^[a-z]{3}$"
              },
              {
                "type": "null"
              }
            ]
          },
          "amountMinor": {
            "anyOf": [
              {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              {
                "type": "null"
              }
            ]
          },
          "paymentStatus": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "status",
          "currency",
          "amountMinor",
          "paymentStatus"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "receipts"
  ],
  "additionalProperties": false
}
```

## GET /v1/sign-in/options

Guide: providers.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "telegram": {
      "type": "object",
      "properties": {
        "configured": {
          "type": "boolean"
        },
        "username": {
          "type": [
            "string",
            "null"
          ]
        },
        "oidc": {
          "default": false,
          "type": "boolean"
        },
        "miniApp": {
          "default": false,
          "type": "boolean"
        }
      },
      "required": [
        "configured",
        "username",
        "oidc",
        "miniApp"
      ],
      "additionalProperties": false
    },
    "email": {
      "type": "object",
      "properties": {
        "delivery": {
          "type": "string",
          "enum": [
            "local",
            "mail",
            "unavailable"
          ]
        }
      },
      "required": [
        "delivery"
      ],
      "additionalProperties": false
    },
    "passkey": {
      "type": "object",
      "properties": {
        "rpId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "rpId"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "telegram",
    "email",
    "passkey"
  ],
  "additionalProperties": false
}
```

## GET /v1/sign-in/methods

Guide: providers.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "telegram": {
      "type": "object",
      "properties": {
        "configured": {
          "type": "boolean"
        },
        "username": {
          "type": [
            "string",
            "null"
          ]
        },
        "subjects": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "oidc": {
          "default": false,
          "type": "boolean"
        },
        "miniApp": {
          "default": false,
          "type": "boolean"
        }
      },
      "required": [
        "configured",
        "username",
        "subjects",
        "oidc",
        "miniApp"
      ],
      "additionalProperties": false
    },
    "email": {
      "type": "object",
      "properties": {
        "delivery": {
          "type": "string",
          "enum": [
            "local",
            "mail",
            "unavailable"
          ]
        },
        "subjects": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "delivery",
        "subjects"
      ],
      "additionalProperties": false
    },
    "passkeys": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "id"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "telegram",
    "email",
    "passkeys"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/email/start

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "minLength": 3,
      "maxLength": 254
    }
  },
  "required": [
    "email"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "delivery": {
          "type": "string",
          "const": "local"
        },
        "code": {
          "type": "string",
          "pattern": "^\\d{8}$"
        }
      },
      "required": [
        "delivery",
        "code"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "delivery": {
          "type": "string",
          "const": "sent"
        }
      },
      "required": [
        "delivery"
      ],
      "additionalProperties": false
    }
  ]
}
```

## POST /v1/sign-in/email/confirm

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "minLength": 3,
      "maxLength": 254
    },
    "code": {
      "type": "string",
      "pattern": "^\\d{8}$"
    }
  },
  "required": [
    "email",
    "code"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "subject": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "subject"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/email/login

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "minLength": 3,
      "maxLength": 254
    },
    "code": {
      "type": "string",
      "pattern": "^\\d{8}$"
    }
  },
  "required": [
    "email",
    "code"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/telegram

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "proof": {
      "type": "string",
      "minLength": 1,
      "maxLength": 16384
    }
  },
  "required": [
    "proof"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": [
        "google",
        "telegram"
      ]
    },
    "subject": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255
    }
  },
  "required": [
    "provider",
    "subject"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/telegram/login

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "proof": {
      "type": "string",
      "minLength": 1,
      "maxLength": 16384
    }
  },
  "required": [
    "proof"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/passkey/register/options

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "challenge": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]+$"
    },
    "rp": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "id": {
          "type": "string"
        }
      },
      "required": [
        "name",
        "id"
      ],
      "additionalProperties": false
    },
    "user": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "displayName": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "name",
        "displayName"
      ],
      "additionalProperties": false
    },
    "pubKeyCredParams": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "const": "public-key"
          },
          "alg": {
            "type": "number",
            "const": -7
          }
        },
        "required": [
          "type",
          "alg"
        ],
        "additionalProperties": false
      }
    },
    "timeout": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "attestation": {
      "type": "string",
      "const": "none"
    },
    "authenticatorSelection": {
      "type": "object",
      "properties": {
        "residentKey": {
          "type": "string",
          "const": "required"
        },
        "requireResidentKey": {
          "type": "boolean",
          "const": true
        },
        "userVerification": {
          "type": "string",
          "const": "required"
        }
      },
      "required": [
        "residentKey",
        "requireResidentKey",
        "userVerification"
      ],
      "additionalProperties": false
    },
    "excludeCredentials": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "const": "public-key"
          },
          "id": {
            "type": "string"
          }
        },
        "required": [
          "type",
          "id"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "challenge",
    "rp",
    "user",
    "pubKeyCredParams",
    "timeout",
    "attestation",
    "authenticatorSelection",
    "excludeCredentials"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/passkey/register

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "clientDataJSON": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,16384}$"
    },
    "attestationObject": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,16384}$"
    }
  },
  "required": [
    "clientDataJSON",
    "attestationObject"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/passkey/login/options

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "challenge": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]+$"
    },
    "timeout": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "rpId": {
      "type": "string",
      "minLength": 1
    },
    "userVerification": {
      "type": "string",
      "const": "required"
    }
  },
  "required": [
    "challenge",
    "timeout",
    "rpId",
    "userVerification"
  ],
  "additionalProperties": false
}
```

## POST /v1/sign-in/passkey/login

Guide: providers.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "credentialId": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,2048}$"
    },
    "clientDataJSON": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,16384}$"
    },
    "authenticatorData": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,16384}$"
    },
    "signature": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,16384}$"
    }
  },
  "required": [
    "credentialId",
    "clientDataJSON",
    "authenticatorData",
    "signature"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "account": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "signingKey": {
              "type": "string",
              "maxLength": 128
            },
            "custody": {
              "type": "string",
              "enum": [
                "user-controlled",
                "managed"
              ]
            },
            "encryptionKey": {
              "type": "object",
              "properties": {
                "kty": {
                  "type": "string",
                  "const": "EC"
                },
                "crv": {
                  "type": "string",
                  "const": "P-256"
                },
                "x": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                },
                "y": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{43}$"
                }
              },
              "required": [
                "kty",
                "crv",
                "x",
                "y"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "id",
            "signingKey",
            "custody",
            "encryptionKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "custody": {
              "type": "string",
              "const": "user-controlled"
            },
            "signingKey": {
              "type": "null"
            },
            "encryptionKey": {
              "type": "null"
            }
          },
          "required": [
            "id",
            "custody",
            "signingKey",
            "encryptionKey"
          ],
          "additionalProperties": false
        }
      ]
    },
    "csrfToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "account",
    "csrfToken"
  ],
  "additionalProperties": false
}
```

## GET /v1/account/evm

Guide: accounts.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "links": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "chainId": {
            "anyOf": [
              {
                "type": "number",
                "const": 40
              },
              {
                "type": "number",
                "const": 41
              }
            ]
          },
          "address": {
            "type": "string",
            "pattern": "^0x[0-9a-fA-F]{40}$"
          },
          "controlVerified": {
            "type": "boolean"
          }
        },
        "required": [
          "chainId",
          "address",
          "controlVerified"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "links"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/evm/challenge

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "anyOf": [
        {
          "type": "number",
          "const": 40
        },
        {
          "type": "number",
          "const": 41
        }
      ]
    }
  },
  "required": [
    "chainId"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "anyOf": [
        {
          "type": "number",
          "const": 40
        },
        {
          "type": "number",
          "const": 41
        }
      ]
    },
    "message": {
      "type": "string",
      "minLength": 1
    },
    "expiresAt": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "chainId",
    "message",
    "expiresAt"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/evm/link

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "anyOf": [
        {
          "type": "number",
          "const": 40
        },
        {
          "type": "number",
          "const": 41
        }
      ]
    },
    "address": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{40}$"
    },
    "signature": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{130}$"
    }
  },
  "required": [
    "chainId",
    "address",
    "signature"
  ],
  "additionalProperties": false
}
```

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "chainId": {
      "anyOf": [
        {
          "type": "number",
          "const": 40
        },
        {
          "type": "number",
          "const": 41
        }
      ]
    },
    "address": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{40}$"
    }
  },
  "required": [
    "chainId",
    "address"
  ],
  "additionalProperties": false
}
```

## GET /v1/marketplace

Guide: marketplace.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "configured": {
      "type": "boolean"
    },
    "reason": {
      "type": [
        "string",
        "null"
      ]
    },
    "thirdPartyBps": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "firstPartyBps": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "treasury": {
      "type": [
        "string",
        "null"
      ]
    },
    "modules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "account": {
            "type": "string"
          },
          "publisher": {
            "type": "string"
          },
          "party": {
            "type": "string",
            "enum": [
              "first-party",
              "third-party"
            ]
          },
          "price": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "codeHash": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          },
          "detail": {
            "type": "string"
          }
        },
        "required": [
          "account",
          "publisher",
          "party",
          "price",
          "title",
          "codeHash",
          "summary",
          "detail"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "configured",
    "reason",
    "thirdPartyBps",
    "firstPartyBps",
    "treasury",
    "modules"
  ],
  "additionalProperties": false
}
```

## GET /v1/names

Guide: marketplace.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "configured": {
      "type": "boolean"
    },
    "reason": {
      "type": [
        "string",
        "null"
      ]
    },
    "cardPayments": {
      "type": "boolean"
    },
    "thirdPartyBps": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "firstPartyBps": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "treasury": {
      "type": [
        "string",
        "null"
      ]
    },
    "tiers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "kind": {
            "type": "string",
            "enum": [
              "basic",
              "premium"
            ]
          },
          "price": {
            "type": "string"
          },
          "usdCents": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "ramBytes": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "netStake": {
            "type": "string"
          },
          "cpuStake": {
            "type": "string"
          },
          "tlosQuote": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "kind",
          "price",
          "usdCents",
          "ramBytes",
          "netStake",
          "cpuStake",
          "tlosQuote"
        ],
        "additionalProperties": false
      }
    },
    "listings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "accountName": {
            "type": "string"
          },
          "seller": {
            "type": "string"
          },
          "price": {
            "type": "string"
          },
          "usdCents": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "sold": {
            "type": "boolean"
          }
        },
        "required": [
          "accountName",
          "seller",
          "price",
          "usdCents",
          "sold"
        ],
        "additionalProperties": false
      }
    },
    "suffixes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "suffix": {
            "type": "string"
          },
          "seller": {
            "type": "string"
          },
          "price": {
            "type": "string"
          },
          "usdCents": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "sales": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          }
        },
        "required": [
          "suffix",
          "seller",
          "price",
          "usdCents",
          "sales"
        ],
        "additionalProperties": false
      }
    },
    "bumpBps": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "quotePremiumBps": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "oracleMedian": {
      "type": [
        "string",
        "null"
      ]
    },
    "oraclePrecision": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "oracleObservedAt": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "daoId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "configured",
    "reason",
    "cardPayments",
    "thirdPartyBps",
    "firstPartyBps",
    "treasury",
    "tiers",
    "listings",
    "suffixes",
    "bumpBps",
    "quotePremiumBps",
    "oracleMedian",
    "oraclePrecision",
    "oracleObservedAt",
    "daoId"
  ],
  "additionalProperties": false
}
```

## GET /v1/names/quote

Guide: marketplace.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "accountName": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "basic",
        "premium"
      ]
    },
    "listed": {
      "type": "boolean"
    },
    "seller": {
      "type": "string"
    },
    "party": {
      "type": "string",
      "enum": [
        "first-party",
        "third-party"
      ]
    },
    "price": {
      "type": "string"
    },
    "usdCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "platformBps": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "suffix": {
      "type": [
        "string",
        "null"
      ]
    },
    "bumpBps": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "quotePremiumBps": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "ramBytes": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "netStake": {
      "type": "string"
    },
    "cpuStake": {
      "type": "string"
    },
    "priceFromOracle": {
      "type": "boolean"
    },
    "sales": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "nextPrice": {
      "type": [
        "string",
        "null"
      ]
    },
    "nextUsdCents": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "accountName",
    "kind",
    "listed",
    "seller",
    "party",
    "price",
    "usdCents",
    "platformBps",
    "suffix",
    "bumpBps",
    "quotePremiumBps",
    "ramBytes",
    "netStake",
    "cpuStake",
    "priceFromOracle",
    "sales",
    "nextPrice",
    "nextUsdCents"
  ],
  "additionalProperties": false
}
```

## POST /v1/names/checkout

Guide: marketplace.

Request fields are not included in this response reference; consult the endpoint implementation.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": [
    "url"
  ],
  "additionalProperties": false
}
```

## GET /v1/docs/agent

Guide: providers.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "configured": {
      "type": "boolean"
    }
  },
  "required": [
    "configured"
  ],
  "additionalProperties": false
}
```

## POST /v1/docs/ask

Guide: providers.

Request fields are not included in this response reference; consult the endpoint implementation.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "answered",
        "outside"
      ]
    },
    "topicId": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": [
        "string",
        "null"
      ]
    },
    "answer": {
      "type": "string"
    }
  },
  "required": [
    "status",
    "topicId",
    "title",
    "answer"
  ],
  "additionalProperties": false
}
```
