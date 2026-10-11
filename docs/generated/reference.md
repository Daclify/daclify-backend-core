# Daclify core reference

Package 0.13.0-alpha.3 · interface 1.

Generated from compiled ABI and canonical API schemas. Field layout does not describe all contract business rules; read the matching explanatory guides.

## What encryption protects

Private DAO documents are encrypted in the browser before they reach Pinata or the public IPFS network. Signing and document decryption use separate keys.

Memberships, voting activity, outcomes, balances, timing, and content hashes remain visible on a public blockchain. This release does not provide anonymous governance.

Deactivating a member advances the epoch for future content; an authorized administrator must initialize its new key and grants. This cannot erase plaintext or old keys the member already kept. Re-pinning preserves ciphertext, not confidentiality after a key compromise.

## Two clearly labelled account modes

Daclify-key login signs both your public signing key and public encryption key in a short-lived v3 challenge. The app checks the keys and issuing API before asking the vault to sign. An API/frontend update may require refreshing the app and restarting an in-progress login; your existing account, recovery kit and private keys are preserved.

Sign in with your Daclify keys or a previously paired supported email, Telegram, passkey, Telos Zero account or Telos EVM wallet. A currently activated on-chain wallet can also reconstruct wallet-only access after the service database is lost. Signing in and recovering service access do not create membership or grant new permissions in a DAO. Provider availability depends on server configuration; complete Google browser login remains unfinished.

Adding or removing a sign-in method requires a fresh proof from existing Daclify keys or an already verified paired wallet, plus proof of the incoming credential. Review the exact credential before confirming. Removal revokes sessions opened with that credential; history is available in Account → Sign-in methods → Sign-in changes.

A paired native or EVM wallet can authorize governance after explicit activation for the same member in each DAO. It adds no member or voting weight. Private documents still require the separate encryption keys.

User-controlled accounts keep encrypted signing and decryption keys in your browser. Restore an encrypted kit using either the vault password saved with that kit or its separate recovery code, shown as the recovery credential during setup. Choose a new password for this device; the original signing and decryption keys stay the same. A publicly visible login signature cannot derive these keys. Explicitly enabled full-access methods can restore the original keys on another device, without a vault password.

Managed recovery delegates signing and decryption recovery to an operator. The prepared OpenBao service remains disabled until independent service, audit, backup and restore qualification passes. Users choose full-access methods and consent explicitly to operator recovery authority.

Accounts with vault keys can share Account → Access & recovery → Public join identity with a DAO administrator. Never share recovery kits or their credentials. A saved service-to-member association can survive DAO signing-key rotation while its database exists; a lost mapping cannot make an old signing key current again. Current chain permissions and wallet bindings remain authoritative.

The Users directory reads public DAO membership records, so members appear before they publish a profile. Native accounts shared across DAO memberships appear once, with available published profile details; internal members without a native account or profile appear as Member plus their public member ID. Each card opens its DAO-specific public record. Sign in to keep your own card first and edit your profile or account pairings. The paginated directory reads at most 50 members from one DAO per request; Load more users continues into the next page or DAO. Unpublished profile details remain absent and private service identities are never used for discovery. Your profile is shown first when you sign in; opening another user gives the same public view without your editing and pairing controls.

Open your own user card and choose Edit profile & account to edit your public profile, set avatar/background IPFS CIDs, manage recovery keys, pair sign-in credentials and manage wallet links. A browser signer must be authorized for the selected membership to publish. Email and social contact fields entered in this public profile are public on-chain; they are distinct from private service login pairings.

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

Before any native claim withdrawal, stake exit or direct obligation payment, the receiving account must have an existing balance row for the exact token contract, symbol and precision. In Treasury, choose the native payout account, connect that receiving wallet and use Prepare receiving wallet. It signs the token contract’s open action with the receiving account as owner and RAM payer; it does not pair the wallet, authorize a withdrawal or change the obligation. If the row is missing or closed, payment fails atomically: claims, stake, reserved funds, receipts and signing nonces remain unchanged. Prepare again and retry. Tokens without the qualified standard open/accounts interface need token-specific operator review.

An administrator can record one DAO-confirmed external payment statement with a signed instruction. It names the chain, payer and reference, and it must repeat the approved obligation’s recipient and exact asset amount. Reusing that reference for another obligation is rejected. The record does not move a balance, mark the obligation paid, or block later native settlement. Attested and contract-verified external settlement are separate and are not implemented. A direct runtime key cannot create this record.

This release supports one configured native treasury asset per DAO. Governance stake deposits currently require the member’s linked native account and the stake memo shown in the treasury. Walletless members can use internal governance credits. Claim-to-stake conversion and multi-asset treasury accounting are not implemented.

## Configure external services

Email codes are delivered only when the server configures SMTP. Codes expire, have bounded guesses, are browser-bound, and a resend invalidates earlier codes. Local revealed pairing codes are a development fixture; they cannot sign in from another browser.

Telegram website sign-in uses OIDC with state, nonce, PKCE and verified current JWKS signatures. Mini App initData and legacy widget data use separately verified bot proofs. Untrusted profile or wallet connection data is never authentication.

Telegram OIDC subjects use an oidc: namespace. Numeric widget/Mini App IDs are not automatically merged with OIDC identities. Pair each method explicitly from your existing account.

Website login restores the initiating frontend origin and local return destination. A Telegram callback consumes one browser-bound attempt and stores no provider token in frontend URLs. Configure a real Telegram client/bot and test a real client before qualification.

Telos Zero login currently supports active permission with direct weighted keys, including a real threshold; delegated accounts, waits and other permission structures are rejected. The UI adapter supports Anchor through pinned WharfKit 4.0.2; real wallet-client qualification remains separate.

Telos EVM EOA login uses server-issued ERC-4361 messages. Direct DAO governance uses different EIP-712 signed bytes and on-chain K1/Keccak primitives. Chains 40/41 are supported; ERC-1271 wallets, EVM assets/payouts and cross-chain settlement are unavailable.

To configure Telegram website login for Daclify, register the real HTTPS frontend and exact API callback in BotFather Login Widget. Configure TELEGRAM_OIDC_CLIENT_ID, TELEGRAM_OIDC_CLIENT_SECRET and TELEGRAM_OIDC_REDIRECT_URI together on the backend; the callback path is /v1/sign-in/telegram/oidc/callback. Use RS256. Restart the API. The bot token is separate from the OIDC client secret. OIDC pairing and Mini App launch setup are separate steps; do not share secrets in support chat.

To configure Daclify email delivery, set SMTP_HOST, SMTP_PORT, SMTP_TLS_MODE and SMTP_FROM, with SMTP_USERNAME and SMTP_PASSWORD when required by the provider. Use starttls with port 587 or tls with port 465; testnet and mainnet require TLS. Restart the API and exercise delivery to an actual test mailbox. Setting SMTP fields does not prove deliverability. Never put these credentials in the frontend.

Daclify content hosting uses backend PINATA_JWT, PINATA_STORAGE_SCOPE and CONTENT_GATEWAY together. The storage scope is a stable local ledger label, not a Pinata account or group ID. Use separate Pinata accounts and storage scopes for testnet and mainnet. Private content is encrypted before publication; support cannot recover user-controlled document keys; explicitly consented Daclify-assisted recovery grants operator access to that vault. Provider credentials stay outside source control and support questions.

For a Netlify Daclify testnet frontend, deploy the frontend dev branch, publish dist, and use npm run build -- --mode testnet. Set VITE_NETWORK=testnet and VITE_API_TESTNET to the testnet HTTPS API origin. Production uses VITE_NETWORK=production and VITE_API_PRODUCTION pointing to the mainnet API. VITE variables are public. Configure the backend FRONTEND_ORIGIN and any explicit FRONTEND_ADDITIONAL_ORIGINS to allow the actual frontend origins, then restart the API. Frontend build settings do not select the backend blockchain network.

## Recover keys and blockchain access

In Account → Sign-in methods → Fast sign-in with full access, choose which paired methods may unlock your original signing and private-document keys. Pairing alone grants sign-in only. Once enabled, sign in through that method on another device; no JSON file or vault password is needed. Keys stay in unlocked browser memory and lock when idle. Existing account IDs and DAO rights stay the same.

Wallet-protected recovery uses a separate private unlock signature that the wallet must reproduce; keep it private and never broadcast it. Passkey-protected recovery requires a supported PRF authenticator. Both require actual client qualification. Daclify-assisted recovery can use any supported paired method, including email or Telegram, but explicitly authorizes Daclify to recover signing and document keys. This is off by default and unavailable until independent storage and OpenBao recovery are qualified. Disabling assisted recovery cannot undo past operator access; strict private DAO policy blocks assisted vaults.

If another device is unlocked, request approval from Account → Access & recovery on the new device. Open the QR/link on the unlocked device, compare both verification codes and approve. The encrypted transfer expires in five minutes and can be claimed once. The link contains no unlocking key or polling secret. Recognize the receiving device before approval.

User-controlled signing and P-256 decryption private keys are encrypted in this browser’s local vault and downloaded recovery kit. The kit contains a local envelope protected by the vault password saved when the kit was downloaded and a recovery envelope protected by the separate recovery code. In Account, choose Recover from an encrypted kit, select the original JSON, enter that kit’s vault password or matching recovery code, and choose a new vault password of at least 12 characters. Restore and sign in verifies the original keys and protects them with the new device password. A password change does not update older downloaded kits. Older clients require the separate recovery credential; refresh the app to use password recovery. Both envelopes use PBKDF2-SHA256 with 600,000 iterations and AES-256-GCM. The JSON fallback does not send your password or plaintext private keys to the API.

The contracts retain DAO membership, permissions, balances, document CIDs, key-epoch commitments and per-member encrypted epoch-key grants. Large encrypted document bytes are on IPFS. A recovered original decryption key opens its surviving grants and ciphertext; a public login signature or a replacement encryption key cannot decrypt old content. Keep the encrypted kit and recovery credential in separate safe places and retain durable IPFS pins or a content export.

After losing the service database, connect a Telos Zero wallet or supported Telos EVM EOA and sign a fresh browser-bound challenge. The API verifies wallet control and finds current bindings in the configured runtime. It reconstructs wallet-only service access with no claimed vault keys, no new membership or creation fee. Each DAO’s current binding and permissions are checked again. Matching public signing keys in another DAO do not grant wallet access there.

A recovered wallet profile has a new service ID; the chain membership ID stays unchanged. Restore the original encrypted kit and confirm with the wallet to attach your proved vault identity to that same recovered profile. You can instead create new keys for new DAOs; new keys do not recover old private documents or change existing contract keys. Both current wallet control and incoming signing-key possession are required. An already registered vault identity is not silently merged with another service profile.

Google, Telegram and email pairings, passkey public credentials, wallet sign-in pairings and service sessions are PostgreSQL records. Blockchain governance bindings are separate. These pairing metadata columns are not application-encrypted. Restrict database access and encrypt off-host backups. Lost social pairings require a verified database restore or explicit re-pairing after recovering control. Do not publish email addresses, Telegram IDs or raw provider tokens on the public chain. Restore does not make an old session or provider proof fresh.

For a ten-member DAO, one recovered administrator can manage the existing DAO again, but their kit restores only their own keys and access. Every other member must recover independently. An ordinary member remains an ordinary member. Losing a server does not lose login pairings if a verified database backup survives; if all database copies are lost, pair those methods again after recovering your own control.

An old kit may still decrypt old documents after its signing key was rotated on chain, but that old signing key alone no longer authorizes governance. Use a surviving current wallet or other current control path. Human-member signing-key rotation requires that member’s authorization; another administrator’s kit cannot reset it. New vault keys do not replace the member’s existing encryption identity.

Wallet-only profiles must retain a blockchain control credential. Removing the last one is rejected transactionally. Unlinking or revoking a governance binding on chain removes the corresponding access; an old service pairing does not restore it. Inactive memberships do not gain new governance rights; existing exit rights remain governed by the contract.

Operators need encrypted off-host PostgreSQL backups, a separate secret/configuration backup, retained provider and IPFS credentials, and tested restore drills. Revoke all restored sessions and pending login/control challenges before exposing a restored API. A stale backup can restore removed social pairings; reconfirm them if revocation history is uncertain. Jobs and payment records need reconciliation with the chain and provider before workers resume.

After recovering current administrator access, Resources can rebuild hosted document, public-card and Archive references in bounded batches from surviving chain references and Daclify-owned provider inventory. Every imported object needs verified size and committed bytes. Repeated CIDs count once per DAO; released hosting is not silently resumed. This restores neither Stripe payments nor social pairings and never uploads or deletes a file. Missing original file pins still need your independent copies.

The prepared assisted-recovery service remains disabled until actual independent-host and off-site restore qualification passes. Restore a current database, retained encrypted backup and original key-service material on a replacement host; revoke restored sessions and quarantine full-access methods until current pairing/revocation history is reconciled. A stale snapshot must not revive a revoked pairing. If every wallet key, vault recovery path and independent backup is lost, Daclify cannot manufacture the missing secrets.

## Documents that survive transaction history gaps

Small JSON documents are stored directly in contract tables. Larger files use immutable IPFS CIDs and a separate SHA-256 commitment of retrieved bytes. Document IDs have contiguous, permanent version histories.

The 4096-byte inline limit includes the complete stored JSON. For private content it includes the encrypted envelope, so the available plaintext space is smaller. Members can create documents; only their author or an administrator can publish later versions.

Hosted file uploads have a 5 MiB stored-byte limit and use a bounded backend path with an explicit storage allowance. Private filenames and file contents are encrypted before upload; encoding reduces the maximum original size. Upload and verify the file, then sign its permanent contract record. Keep the request ID to resume after a reload or lost response. The backend retrieves the stored bytes and checks their separate SHA-256 commitment; a matching CID or on-chain record alone does not establish byte verification.

Private documents use a committed key for each DAO epoch. Initialization stores the commitment and the creator’s encrypted grant atomically. An administrator can grant that epoch to admitted members. Different recipients, DAO deployments and document versions have distinct encryption domains.

Changing membership or rotating an epoch protects future content after the next key is initialized. Old grants and disclosed plaintext remain accessible to anyone who kept the old key. A client checks content integrity and the epoch commitment before decryption.

Download checks the recorded byte count and commitment before opening a file. A private download also checks the DAO epoch commitment and decrypts in your browser. Previous file versions remain downloadable from version history. A saved plaintext download is not erased when your vault locks. The local disk fixture is labelled explicitly and does not establish live Pinata or public IPFS availability.

Changing DAO deployment, account, member identity or privacy clears document drafts and decrypted views. Late responses from a previous context are discarded. Content histories are read in scoped pages with advancing cursors; a large DAO does not fail merely because it exceeds the former row ceiling.

Development resource accounting counts each verified CID once per DAO, including hosted versions, branding and archive references. Uncertain uploads and complete unfinished archive exports reserve their bytes. Active members can inspect verified and reserved usage; configured paid subscriptions grant capacity only after verified payment. Automatic deletion remains disabled. Mainnet and testnet use separate Pinata accounts and ownership ledgers.

Storage terms are prepaid calendar months, independent of member-slot subscriptions. A January 31 anniversary uses February’s last day and returns to March 31. An unpaid paid term receives thirty exact days from its original end; retries do not restart that deadline. A future prepaid term does not grant capacity before its start. Recurring paid capacity requires an administrator to approve the exact units, pricing snapshot and monthly amount. Open Resources from DAO Settings or Documents to see measured usage, accepted pricing, paid-through and the original grace deadline. Only current administrators with fresh signing control can approve recurring units. Paid capacity requires authoritative Stripe invoice/payment/charge verification, independently of membership. Reductions begin next period; increases need verified payment and a funded base. Cleanup is disabled by default; Resources reports explicit operator enablement. Live provider qualification remains required.

Native RAM purchases atomically acquire and verify actual quota for approved core/module payers, charge the accepted 5% TLOS markup and refund change. Card RAM orders use a separate funded operator reserve and a 20% operational charge; returning from Checkout grants no capacity. Resources offers both paths when the operator has configured them. Backed allowances, completion holds, bounded migration and explicit per-DAO growth guards are implemented in development; target-chain and live provider qualification remain required.

Resources shows DAO RAM counters by payer across core and supported modules, separated into identity/recovery, activity, retained and platform categories, plus permanent settled purchase credits. Whole-account usage/quota also includes other DAOs and shared infrastructure; it is not the DAO allowance. Disabled observation or mismatched source code leaves the total unknown. Reads are bounded, source-checked live views, not atomic billing snapshots. The displayed enforcement state comes from the chain. Enabling the development guard requires completed legacy adoption and physically backed allocations; it never happens automatically at server startup.

At ordinary RAM exhaustion, use the full available claim for an emergency withdrawal; partial withdrawals need room for their permanent receipt. Accepted financial obligations and elections reserve their bounded completion paths. Accepted Works milestones reserve fixed submission/review reference slots, including migrated pending work. New document contents and uploads still require ordinary RAM and hosting capacity. Purchased RAM is permanent chain capacity, separate from monthly member slots and pinned storage.

## Stable members, explicit roles

Each DAO records internal members with separate signing and encryption keys. A linked native account is a credential of the existing member rather than a second voting identity.

Administrators assign administrator and reviewer roles. The final active administrator cannot be demoted or removed. Reviewers can review contributions within the Works policy; contribution authors cannot approve their own work.

Governance credits are nontransferable units. Their issuance and removal require DAO authority and stop while an active ballot has locked weights. Removing access preserves recorded balances and accepted payment rights.

Encrypted DAOs rotate the future-content epoch when a member is deactivated. Remaining authorized members need grants for the new committed key. Deactivation cannot revoke earlier keys or erase exported history.

In Members, an active administrator pastes the applicant’s public join identity and signs admission. Confirm the keys through a trusted channel first. Then select the admitted member to assign roles and governance credits; grant an encryption epoch separately for private documents. Admission never makes an applicant an administrator automatically. Managed admission remains unavailable in this deployment.

Members displays each public on-chain member record, with published profile cards when available. Switch between cards and list, search names, locations or roles, and filter active/inactive members. The page labels administrator, reviewer, executive and non-voting membership using the connected runtime state. Admission, role changes, credits and private key grants retain their existing separate authorization rules.

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

The Telos nameservice sells new native accounts from its own contract. A 12-character name without a dot uses the basic tier. An enabled minimum-profit policy adjusts first-party basic totals to current RAM, CPU, NET and TLOS costs. Card checkout includes a processing-fee allowance; actual captured payment fees are verified before creation. Native checkout retains the configured conversion premium. If verified net revenue cannot cover actual provisioning costs and the required margin, the chain rolls back creation for payment review. Older deployments without this policy retain their stored dollar price and conversion rules. The account is created with the CPU, NET, and RAM stored on that tier. A name that contains a dot can be sold only when the longest suffix is connected. The suffix owner sets the price in TLOS or dollars with regsuffix. Suffix accounts, including dotted exact listings, must cost at least the current normal basic-account price on each supplied rail. New and edited offers reject a lower price; older offers automatically use the higher current minimum at purchase. Zero leaves a rail unset. Each sale raises the effective price by the bump rate, and the customer payment covers actual RAM and CPU/NET first. Daclify takes the configured third-party percentage of the full sale price; the seller receives the full price minus actual resources and that fee. For a $10 sale with $2 in resources and a 5% fee, resources receive $2, Daclify earns $0.50 and the seller receives $7.50. Insufficient payment rolls back native creation and payouts. A shorter name without a dot uses the premium tier. A seller can list a special exact name or a name under its own suffix with regname. Ordinary 12-character undotted names remain first-party offers; seller listings cannot replace them, including legacy invalid rows. Prices, suffixes, fee rates, and completed sales stay on chain, so a new server can read them after the application database is gone. A Daclify DAO admin changes the platform cut, the bump, and the quote premium with govfees after the runtime links that DAO. Until then the runtime account can change them.

New settlements have a version 1 saleprov receipt recording actual resource cost and seller proceeds. Native settlement conserves the Names reserve: incoming customer TLOS funds resources and payouts. Card fulfillment requires verified proceeds after processing fees; fiat covers the resource expense but cannot replenish TLOS without conversion. Card creation needs TLOS working capital. Third-party card sales remain unavailable until seller routing is implemented. Legacy sale receipts keep their original meaning.

Card checkout uses a fresh quote from the current on-chain tiers, offer and profit policy; a stored inventory reference is not the final payable total. The browser creates the new account keys and does not send the private keys to the server. After the card payment is confirmed, the names contract records the sale and creates the account. A card session that never reaches the chain remains with the card processor. Returning from the card page does not by itself create the account. Fulfillment verifies captured net proceeds against current provisioning costs and required margin; an insufficient payment leaves creation for review.

Names has Find a name and Manage & sell views. Suggestions are not availability guarantees; request a fresh chain quote before payment. Back up distinct owner and active private keys before native-wallet or supported card checkout. Private keys stay in the browser. Existing native accounts are not sold or transferred by this marketplace.

An individual sells through their own native account. A DAO sells through a native account whose owner/active authority is governed by its own executives or quorum. A shared DAO administrator has no authority over the shared runtime account and needs a separate native seller account. Native proceeds go to that seller. Quorum-controlled listings and permission setup are exported as unsigned transactions for review and multisignature approval.

Before selling a suffix or special exact name, the seller owner reviews a namesale child under active, containing only the reviewed names contract eosio.code authority, and links it only to eosio::newaccount. Root owner/active authority is preserved. Existing namesale permissions and newaccount links must be reviewed before replacement. The names contract uses the actual final native suffix as creator; dotted suffix registrations are rejected. A short undotted name still needs the native seller to have won a closed native auction. This delegated child cannot authorize token transfers.

The reviewed names upgrade adds editname, delname and delsuffix for seller-authorized changes. Unsold exact listings may be repriced or removed. Existing sale receipts and created accounts remain unchanged. Removing a suffix stops its future fulfillment; coordinate pending purchases first. Native TLOS purchases are atomic: creation or authorization failure rolls the transfer back. The UI checks the names code hash before requesting any broadcast.

Third-party name card checkout is disabled because this names checkout has no seller merchant routing. Enter a positive TLOS sale price. Daclify Connect for DAO module products does not automatically route native names revenue. First-party basic-name card checkout remains separate and needs its configured billing/fulfillment service. Premium names use native TLOS checkout so a failed namespace/auction claim rolls back payment.

Automatic Names price observations use a dedicated oracle child under the names contract active authority. Only observeprice and observefee are linked to it. The publisher cannot change minimum profit, percentage fees, bump or quote premiums, treasury, contract code or parent authorities. Executive governance can replace or revoke this child. Antelope also lets a child rotate its own key; this does not expand its action scope. Prices must be newer than the last observation and no more than 15 minutes old; fixed card-fee observations remain valid for seven days. An unavailable feed keeps its last valid observation until expiry, after which affected quotes are unavailable. The publisher is trusted for observed prices.

Browsing loads bounded pages of names and suffixes. Load more keeps earlier offers visible; a name quote reads its exact on-chain listing and suffix even when it is outside the current page. New seller listings use the seller account’s RAM, while completed sale history remains on the Names contract.

## Free creation and approved hosting capacity

Shared creation is free and includes 10 active governance member slots. Human and agent governance identities each use one slot; pairing Telegram, email or wallets does not add another member or slot.

Monthly paid slots use graduated rates: the first 40 additional slots cost $1 each, the next 200 cost $0.50 each, and remaining additional slots cost $0.20 each. Total capacity 11 costs $1/month; 50 costs $40; 250 costs $140; 1,000 costs $290. Administrators choose capacity and explicitly approve the price. The service never automatically bills a DAO for joining members.

Existing subscriptions retain the accepted price schedule and included allowance. Daclify DAO can govern rates for new agreements. Accepting current pricing is a separate explicit administrator action. Blockchain, storage and AI allowances remain separate.

Independent deployment options show Contact for pricing; they have no public setup price or self-service deployment checkout. Shared setup promo codes were superseded by free creation.

Previously captured card or TLOS creation orders retain their immutable quoted price and once-only fulfillment. Their original TLOS quote may include the agreed 20% conversion premium. Creating a new free DAO does not refund or cancel an earlier paid order.

At the default published pricing, total approved capacity of 10 costs $0 per month; 11 costs $1; 50 costs $40; 51 costs $40.50; 250 costs $140; 251 costs $140.20; and 1,000 costs $290. These are capacity examples, not live quotations for a particular DAO. Existing subscriptions retain their accepted schedule; consult the app hosting screen for the actual current or accepted price and an exact quote before approving a change.

## Daclify DAO and platform status

The Daclify DAO page reads the platform DAO reference from the runtime market configuration. A native operator first creates and enrolls that DAO and links it with setgov. Before that link, the page reports that platform governance is unconfigured. It does not guess a DAO by its name.

Active administrators of the linked DAO can sign creation fee and settler changes, commission and names policy changes, first-party module registration, catalogue removal and first-party module descriptions. These are administrator actions, not automatic execution of a member ballot. Use the DAO workspace for proposals, voting, members and treasury. Native upgrades follow the separately configured account authorities: policy 2 uses executive quorum through runtime active, with creator owner recovery. Treasury-account permissions and the scoped Names oracle publisher are separate authority configurations; changing a fee policy does not rewrite those permission trees.

Module registration checks the on-chain code hash, accepted fee rule and asset identity. Removing a catalogue entry prevents new installations but does not erase existing DAO installations, pending work or financial exit rights. Publishers retain control over their third-party listings and prices.

Status displays the selected network, actual chain ID and head blocks, runtime and module hashes, public permission authorities, resources, on-chain fee and governance configuration and safe provider configuration flags. Missing services are labelled unconfigured. Module hash checks verify the pinned SDK artifact; unpinned runtime and hub hashes are displayed without claiming they are verified. Database migration listings remain in operator diagnostics and are omitted from the app.

Configured providers are not evidence of successful live integration or a qualified production release. Pinata, Stripe, Google, Telegram and managed recovery require their own configuration and acceptance checks. Public status excludes credentials, private keys, DSNs, account records and raw internal errors.

Status groups information into Overview, Network, Contracts, Fees, Services and AI Daxi Help tabs. Contracts shows code hashes, RAM and public permission weights. AI Daxi Help shows public model names, knowledge version and Daclify/Telos/DAO scope, opens the floating help window and separates app help from Telegram bot configuration. Failed status requests are distinct from missing configuration.

Development resource policy is stored separately in resourcecfg. A linked Daclify DAO administrator can sign govresources to set the native RAM fee, card operational markup, storage allowance, unit price and capacity targets. The expected revision prevents stale overwrites. The launch policy is 5% for TLOS RAM purchases, 20% for card RAM purchases, 100 MB free pinned storage and $1/month per approved extra 1 GB. This policy does not itself buy RAM, fund an included allocation or activate a storage subscription; those services remain under implementation.

The sidebar Daclify DAO entry and its Hub card open the same DAO workspace. The linked governing DAO has a Platform controls tab for fee policy and the module catalogue; ordinary DAOs do not gain platform administration. These controls still require an active administrator and an authorized signer.

## Find and identify a DAO

The directory covers the configured native runtime. Search, purpose, membership and sort filters are in the URL so a view can be shared or restored. A membership match includes chain, runtime, DAO and active member state.

Display metadata version 3 adds a brief public summary and optional public PNG/JPEG/WebP logo and cover references. Images are capped at 2 MiB each and include their CID, MIME, byte size and SHA-256 commitment. Hosted retrieval validates the bytes; unavailable images fall back to the original Daclify card.

In Settings, an active administrator can upload and verify a public logo or cover directly. Confirm that the image is public and unencrypted, even for a private DAO. Verified uploads count toward the DAO's storage allowance immediately. Uploading does not change the on-chain card: review the selection, then sign its update with an authorized signer. An uncertain upload keeps its request ID; retry that request rather than creating another upload.

DAO purpose and original setup remain immutable. All directory text and image references are public, including a DAO with encrypted document contents. Choose a sparse listing if needed. Deployment labels describe configuration; they are not audit certifications.

## Reconcile spending and export records

Treasury reports separate approved/reserved obligations, settled obligations, current internal claims and actual native cashflow. An internal claim credit and its later withdrawal are one settled expense, with withdrawal shown as cashflow. Do not add these different metrics together. Amounts use exact integer base units with the native token contract, symbol and precision.

New runtime receipts record internal claim credits, native obligation payments and claim withdrawals atomically with their ledger transition and native transaction ID. Existing settlements before the receipt upgrade retain an unknown destination classification. The receipt history starts at the upgrade; it cannot reconstruct earlier withdrawals or prove all-time external cashflow.

Reports read live paged chain tables, not an atomic historical snapshot. The export records chain/runtime/DAO/read times, completeness, reconciliation gaps and receipt coverage. A failed/truncated source is labelled unavailable; refresh if the ledger changes during reading. An unverified module prevents complete module provenance, while ordinary claims remain accessible.

A DAO-confirmed external payment statement is evidence asserted by that DAO. It does not settle a native obligation and is not proof of external-chain finality. Native receipts describe the runtime transaction; RPC trust and chain finality remain separate operating assumptions.

Basic complete JSON/CSV exports are free and do not require an Operations subscription. CSV cells neutralize spreadsheet formulas. Exports include public document IDs/CIDs/commitments and agreement references, never narrative/private titles, decrypted bodies or credentials. Export after offboarding or hosted entitlement expiry preserves payment, recovery and financial rights.

## Use the matching release and enabled modules

The current development candidate is core/frontend 0.13.0-alpha.3 with modules SDK 0.9.0-alpha.19 and unchanged module contracts 0.9.0-alpha.5. Contract interface remains 1; vault login uses its separate version-3 challenge binding both signing and encryption keys. Documentation displays its package version and warns when the selected deployment differs. Module actions require the exact compatible installed version and verified code hash.

The candidate adds physically backed per-DAO RAM, native and card acquisition, prepaid pinned storage, bounded Archive export/backup/approval/pruning and original-key recovery. Follow upgrade-0.8, RAM migration and release-qualification runbooks. Preserve old approved executable hashes, member IDs, claims, obligations, key grants and document ciphertext. A package version alone does not prove a deployed contract upgrade. The current audit candidate also fixes seller-paid Names listings, paginated inventory, challenge admission/expiry and rotating Google signing keys. It prepares scoped Relay/Fees authorities and rejects creator/executive delegation back through core owner/active. Follow the current audit remediation guide for coordinated deployment; the earlier upgrade guides retain their version-specific migration procedures.

Release packaging requires twelve complete source/artifact-bound qualification reports and clean reviewed checkouts. Missing, stale or changed evidence rejects; qualifying packaging writes immutable local bytes and performs no registry publication or deployment. Live provider/client and selected public-chain checks remain separate from local tests. Cleanup is opt-in and stays disabled during unverified recovery; production spending, authority changes and cutover require operator review and separate authorization.

## Shared hosting and graduated member capacity

Create free with 10 active member slots. Administrators approve additional paid capacity. The first 40 PAID slots cost 100 USD cents each per month: these are TOTAL member slots 11 through 50. The next 200 PAID slots (paid slots 41 through 240, TOTAL member slots 51 through 250) cost 50 cents each. Further PAID slots (TOTAL member slots 251 onward) cost 20 cents each. The free ten slots do not consume a paid band. The lower price applies only to slots in its band. A shared runtime currently supports at most 5,000 active members per DAO.

At the default published pricing, total approved capacity of 10 costs $0 per month; 11 costs $1; 50 costs $40; 51 costs $40.50; 250 costs $140; 251 costs $140.20; and 1,000 costs $290. These are capacity examples, not live quotations for a particular DAO. Existing subscriptions retain their accepted schedule; consult the app hosting screen for the actual current or accepted price and an exact quote before approving a change.

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

## RAM, hosted storage and archive recovery

Blockchain RAM holds live contract records; IPFS holds pinned files and archive bundles. They are separate resources. Resources shows exact DAO RAM counters and permanent purchased bytes by contract payer. Whole-account figures include other DAOs, code and permissions. An unavailable DAO total is not a zero-byte total.

A visible payer allocation separates identity, activity and completion budgets. Issued grants are backed by the exact native payer account and replay safely. Allocations do not yet enforce growth limits or guarantee completion of outstanding work; those protections require the remaining reserve and migration qualification. Purchased bytes are shown separately from granted capacity.

To buy RAM with TLOS, select a qualified contract payer and minimum byte increase, review native acquisition cost plus one operational fee (5% at launch), then approve the one-time wallet payment. Order and token payment share one transaction. Every actual quota increase is checked; an expired quote, changed policy or unmet minimum rolls the whole purchase back. Sponsoring RAM grants no membership or administration.

Administrators can instead approve a card RAM order when the operator has configured Stripe and funded its separate native reserve. The card rail adds one operational markup (20% at launch), with a $5 minimum total. It does not add the native 5% markup or Connect commission. The exchange-rate observation, byte minimum and exact USD price are disclosed before fresh account-control approval. Complete Stripe checkout, then refresh the saved order. Payment must be verified and provisioning must finish before capacity is credited. An operator outage or low reserve needs reconciliation; checkout return alone proves nothing.

Purchased RAM is permanent and reusable. A refund, dispute or hosting arrears does not automatically sell RAM or erase keys, memberships, nonces, balances or financial claims. Operator RAM reserve deposits are distinct from DAO treasury/stake/claim deposits. Included payer offers require actual funded pools; new obligation receipt holds are physically allocated; local bounded adoption and quota guards are implemented; external token costs and complete release qualification remain gated.

Pinned hosting includes 100 MB (100,000,000 bytes). Each explicitly approved additional 1 GB costs $1 per calendar month at launch. Active files, old versions and archive bundles share this rate; the same CID counts once per DAO. Payment retries do not restart the original paid-term-end plus 30-day grace deadline. Automatic deletion is disabled until guarded cleanup and recovery qualify.

Archive preview and resumable export cover qualified ordinary-poll votes and old unreferenced document versions, at least 90 days after recorded terminal completion or document creation/backfill. Create and independently verify the encrypted backup, obtain a fresh native availability attestation, then sign approval binding the exact manifest, descriptor, backup and delay. Approval does not prune. Each permitted source-owned batch is a separate manual action; revocation stops subsequent batches. Members can browse verified anchored history merged with qualified live rows and recover bundles without the old SQL index. Exports contain no decryption kits, social pairings or original file blobs. A local native ordinary-vote database-loss drill and original-kit recovery of a retained private file passed. A controlled native encrypted-document pruning, empty-database archive/file reconstruction, original-kit decryption and exact-row restore drill passed. Local native quota exhaustion and bounded legacy adoption checks passed. External token-row ownership, the complete old-release lifecycle and live provider qualification still gate production release.

On qualified new deployments, the operator can enable a physically backed included RAM schedule split across core and module payer accounts. Identity capacity uses the DAO’s accepted per-slot rate and is granted only above its permanent maximum previously funded slot count. Monthly renewal, expiry and replacement members do not issue the same grant again. Resources shows these markers separately from current membership entitlement. Quota enforcement remains under qualification. New observed obligations allocate physical receipt holds at acceptance; full claim withdrawals release up to 25 ready holds, while partial withdrawals retain them. Remaining surplus holds can be cleared in bounded batches after the claim is zero. Legacy obligations and external token costs still need qualification.

Receiving wallets fund their own native token balance rows. Operator and fee/publisher wallets must also prepare theirs before receiving runtime payouts. Sender balance-row payer changes remain operator infrastructure: the operator must pre-open the runtime’s token row with its own authority before first funding and qualify existing row-payer state before rollout. A recipient row check alone does not prove arbitrary token contracts cannot charge additional RAM.

## Keep files within your funded storage

Storage is prepaid separately from membership. An unpaid term keeps its original 30-day grace deadline; payment retries do not restart the clock. During grace, reading and export remain available. Cleanup is disabled by default. Resources and Status show whether this operator explicitly enabled guarded cleanup; configuration does not prove provider qualification.

DAO administrators can choose whole verified objects to prioritize within the free allowance. A CID counts once for that DAO even when several document versions, media or archives reference it. Newest objects fill any remaining allowance deterministically. A file retained by another DAO is not unpinned.

The guarded cleanup implementation verifies payment, current references and the original bytes before provider removal. A bounded staging copy permits compensation if payment arrives during removal. Provider uncertainty, lost leases and failed compensation pause cleanup for operator review. Daclify cannot erase blockchain history, third-party IPFS copies or members’ saved plaintext.

Cleanup does not remove identities, social pairings, document decryption keys, signing nonces, balances, payment receipts or purchased RAM. Files whose hosting ends are explicitly unavailable; paying afterward does not promise recovery of deleted content. Live provider qualification and operational enablement are separate release gates.

Archive manifests and chunks form one retention group. Selecting one includes all its dependencies and shared objects count once. A partial bundle is explicitly unavailable; original document files stay separately pinned and normally billed. Hosting recovery can reconstruct complete groups from verified surviving owned pins without inventing payment.

Resources shows notices tied to the original paid/grace dates. Email requires explicit operator SMTP configuration and the current billing administrator’s paired email. Obsolete notices are canceled after renewed funding or administrator removal; a retry can duplicate an email and never resets grace. Missing contacts and delivery failures need operator review. Check Resources even if mail delivery is disabled.

Operator recovery alerts can use a separately configured operations mailbox. They contain incident IDs, never recovery bytes or keys, and do not clear an incident. Email retries stop after 12 attempts for operator review. SMTP delivery and an operator response procedure require qualification before destructive cleanup.

Hosted Pinata reads require a server-only dedicated-gateway key and a separately registered allowance period. The backend reserves expected bytes and a request before every upstream read; concurrent processes share PostgreSQL counters and failed reads retain their reservation. Missing, expired or exhausted allowance blocks gateway reads, including verification, without unpinning files or adding a DAO bandwidth invoice. Status shows the shared allowance. Operator funding is an attestation; actual provider funding and the key restriction must be verified separately. Alternative OR access controls can bypass the key. Public IPFS ciphertext remains available through other providers; unlimited access is not promised.

## Daxi: help with Daclify, Telos and DAOs

Daxi is the helpful Daclify assistant for Daclify usage and setup, the Telos blockchain (Zero and EVM), and DAOs in general. Ask beginner questions without adding a Daclify prefix. Daxi explains concepts, compares documented options and suggests practical next steps. It has a friendly personality with occasional light, dry humour; it does not mock users or force jokes about lost keys or money. Greetings, questions about Daxi and brief on-topic humour are welcome.

When asked your name or what you can help with, introduce yourself as Daxi and offer Daclify setup, Telos Zero/EVM explanations and DAO education. A greeting needs no Daclify keyword. On request, Daxi can offer a gentle DAO joke: We formed a committee to reduce meetings. Its first decision was to schedule another meeting. Humour must not imply a real event or replace useful guidance.

Answers use the bundled Daclify/module guides plus reviewed Telos and DAO learning guides. Those guides include source links and review dates. Daxi is not a live browser or account inspector. Unsupported details, current balances, changing prices and current deployment claims need the app, official documentation or an explorer. General design suggestions are labelled as suggestions, rather than claims of deployed Daclify features. AI can make mistakes; read the cited guide. The app and Telegram share scope and personality.

Enable the app assistant by setting OPENROUTER_API_KEY in the backend environment and restarting the API. There is no separate app enable flag. OPENROUTER_DECISIONS_MODEL defaults to openai/gpt-6-luna-decisions; OPENROUTER_MODEL defaults to openai/gpt-4.1-mini. The selector and answer model are independent. GET /v1/docs/agent reports configuration presence, not valid credits or provider health. Generated documentation remains available without AI. Do not place keys in Netlify VITE variables.

Telegram documentation chat is separate from Telegram login. Set TELEGRAM_DOCS_ENABLED=true, TELEGRAM_DOCS_GROUP_IDS as a JSON array of approved negative group chat ID strings, optional TELEGRAM_DOCS_PRIVATE_CHAT_IDS as a JSON array of approved positive numeric user ID strings, TELEGRAM_DOCS_WEBHOOK_SECRET as a random URL-safe secret of at least 32 characters, and TELEGRAM_DOCS_WEBHOOK_URL as the HTTPS API URL ending /v1/docs/telegram/webhook. The backend also needs TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME without @, OPENROUTER_API_KEY and the real FRONTEND_ORIGIN. Keep the bot a regular member with BotFather privacy mode enabled. Restart the API and register the webhook using npm run telegram:docs:setup -- --confirm with the correct DACLIFY_ENV_FILE. The read-only setup command without --confirm checks membership, privacy and webhook conflicts first. Both chat lists default to empty; enabled chat needs at least one allowed group or private ID. For private-only testing, leave the group list empty, list your own numeric Telegram user ID and start a private chat with the bot before running setup. Group membership/privacy checks apply only when groups are configured.

In an approved Telegram group use /docs@your_bot_username followed by a Daclify, Telos or DAO question; /docs also works when Telegram delivers it to this bot. Reply to the bot answer to ask a follow-up. Replies can use the previous bot answer as context, but only the bundled guide is evidence. In a whitelisted private chat, ask an ordinary Daclify, Telos or DAO question, use /docs or reply to the bot. Private access requires the chat ID to match its human sender and an explicit whitelist entry. Ordinary group conversation, unlisted private chats, other bots, other commands, edited updates and unapproved groups are ignored. Answers stay in the original topic and link to the configured frontend documentation.

Only the requested question and optional previous bot answer, together with public guide text, are sent to OpenRouter. The bot does not scrape the group or persist message bodies. Telegram itself delivers messages according to its privacy mode; the API processes only allowed group commands/replies and questions from whitelisted private users. Do not send recovery kits, passwords, private keys or provider secrets. Update receipts expire after two days; messages older than one day are ignored. Requests share per-server model/concurrency limits with the app, and Telegram also has a per-chat reply limit. Use a provider key budget for an account-wide spend limit.

Telegram delivery is at most once per update in normal operation. A PostgreSQL receipt is claimed before inference and sending to prevent repeat replies and duplicate model calls on webhook retries. A crash or uncertain send can lose a reply; retry /docs manually. There is no automatic repeated send. Use separate bot identities for testnet and mainnet because one bot has one webhook. A webhook conflict is refused rather than silently replacing another integration.

Open Help from the sidebar to use the floating Daxi help window from any page. Drag its title, resize it on desktop, or use arrow keys on the title and the reset/expand buttons. Minimize it and click Help again to resume. The last 100 messages are saved in this browser, separately by service, chain/runtime and account; Clear conversation removes that history. The assistant answers the current question, rather than sending this stored conversation to the model. Never enter keys or private DAO content. Browser history is not an encrypted recovery backup.

## Executive authority, inactivity and wallet handover

Membership, voting eligibility, application administrator roles and native executive office are separate. Wallet pairing alone never appoints an executive. Native executive authority requires an active, non-revoked member in the appointed roster with a paired Telos Zero account. An EVM, email or Telegram pairing is not a native Antelope permission entry. After native handover, the governing DAO’s administrator rights follow its eligible paired executive roster. Shared DAO administrator roles remain separate. App administrator actions are individually signed; native ownership changes require the configured quorum.

Shared DAOs govern their own records. Only the deployment’s governing DAO changes runtime and managed contract account permissions: Daclify DAO on the shared platform, or the governing DAO of an independent runtime. The existing deployment authority appoints initial internal member IDs. Existing data stays readable and retains its prior voting eligibility until changed.

Native ownership policy 2 is explicit. The current runtime owner signs nativeOwnershipSetupActions, naming the governing DAO, creator recovery account, managed contracts, inline-code roles and separate service public key. Setup temporarily links runtime upgrades to owner. nativeHandoverActions returns all temporary owner grants and handover in ONE transaction. Owners review its exact release hashes, account snapshots, creator, executive quorum and policy revision. Never broadcast staging alone. Failure rolls back every action; successful handover removes direct bootstrap keys.

Runtime owner delegates only to creator@active. Runtime active contains eligible paired executives at the configurable quorum and runtime@eosio.code weighted to that quorum. Managed owner and active delegate to runtime active; own code appears in active only for configured inline senders. Runtime upgrades require active; managed upgrades require owner so their own code cannot replace themselves. Creator recovery can override active. Backend service is a separate child of active linked only to six creation/bootstrap actions and cannot control creator or executive wallet authorities. Relay, treasury and settler roles remain separately configured.

The default inactivity timeout is 30 days, configurable from one minute to one year, or disabled with zero. The default native threshold requires all active eligible paired executives. One remaining active executive can control the deployment, including runtime upgrades and active changes; creator-only owner recovery remains separate. When all are inactive, their paired authorities remain as fallback; a returning appointed executive can sign heartbeat to become active and synchronize the effective quorum. Ordinary members and replaced executives cannot claim office with a heartbeat.

Time passing alone cannot rewrite blockchain permissions. syncexec is callable by any signed native payer; refreshgov uses an existing signed member instruction through the app relayer. Member instructions, wallet binding changes and executive heartbeats refresh relevant native authority. The UI shows the last synchronized native threshold separately from recorded activity. A service outage does not prevent direct native refresh or paired-wallet control.

The final eligible paired native executive cannot unlink, deactivate, be revoked or be replaced with a roster without a paired controller after handover. Replace the wallet with linknative using existing member authorization and proof of the incoming wallet in one transaction. If any update fails, the binding, nonce, credential changes and permissions roll back. Removed wallets immediately lose their delegated active authority on a successful chain transaction. Changing an account’s own keys still requires its own native recovery authority.

Login pairing is a service record; DAO wallet binding is on-chain. Sign-in pairing removal or replacement is blocked while the old wallet is still an active native executive binding on this service. First replace or remove the on-chain binding. For independent deployments, verify each deployment separately; removing a sign-in credential does not revoke authority on another operator’s chain or contracts. A failed or unavailable chain check must not silently authorize executive sign-in removal.

An explicitly configured Decide election titled Executives can schedule native executive handover. Other election titles remain representative offices and grant no executive powers. The pinned Decide grant electexec is required. Winning rosters activate at term start through synchronization. With no eligible paired successor, the outgoing roster holds authority; the pending elected roster can activate through synchronization after an eligible successor pairs, while the term is still valid. Expired, recalled, superseded and already consumed results cannot replay an old handover. Recalling the final native controller is blocked until a replacement is available.

Voting eligibility uses setvoter and a separate exclusion table. Excluded members remain members and may retain application access. Decide excludes their member, credit and stake weights from new ballot denominators and rejects their votes. Active ballots block eligibility changes. Native executive inactivity does not automatically remove ordinary voting eligibility.

Native governance depends on reviewed, upgradeable contract code because runtime code has quorum-weighted active delegation and transitive ownership of managed contracts. Explicit owner authority can replace this model, including the safety guards. Keep adequate native RAM and external recovery material; pairing and signing-key recovery do not recover document decryption keys. These mechanisms do not make a compromised client or a malicious authorized executive harmless.

Handover includes expected signer accounts, threshold and executive-policy revision. A changed roster or activity state rejects stale owner approval. Managed executive accounts trust their custody provider with the Daclify signing key; that key can authorize paired-wallet replacement and therefore change native control. Choose user-controlled executive accounts when this authority must not be delegated to a provider.

Unsupported legacy ownership metadata blocks new controller changes until an explicit reviewed migration. Existing financial exits remain available. Native ownership proposals require the exact matching runtime WASM and raw ABI; an old contract may accept extra serialized fields without applying the new policy.

Creator recovery and executive wallet authorities must remain independent of the governed deployment. The runtime rejects owner/active authority that can be satisfied through core owner/active or the configured service key. A governed Relay/Fees account cannot become an independent executive signer through circular delegation. Runtime owner recovery still overrides active quorum when held by the independent creator.

## Smart contracts and permissions

Shared deployments: the Daclify DAO controls platform contract code and native account authorities. Hosted DAO administrators control their own DAO settings, membership and treasury operations through the runtime. Hosting a DAO does not make its members platform contract owners.

For an independent deployment, the DAO configures its own runtime, module accounts, executive roster and service/execution links. Registering an API endpoint or portal with the Hub is discovery only and grants the Hub no treasury or root authority. Sharing a physical module account also shares its upgrade authority; use your own module accounts for independent control.

Before handover, bootstrap owner and active authorities remain with the deployment operator. Appointing an executive requires the current DAO deployment authority. Pairing a native account by an ordinary member does not appoint them. setnativegov fixes the governing DAO, creator, managed accounts, inline-code roles and service key. Current owners approve the staged owner delegations plus handover in one transaction, with an expected creator/policy/signer/threshold/revision snapshot.

After handover, creator@active alone controls runtime owner. Two executives Alice and Bob at 100% quorum give runtime active threshold 2, each wallet weight 1 and runtime@eosio.code weight 2. Runtime code maintains active using active authorization; it cannot update creator-only owner. Native upgrades use active quorum, with owner recovery override. This example describes ownership policy 2 in core 0.13.

A managed module has owner threshold 1 delegated to runtime@active. Its active delegates to runtime@active and its own eosio.code only when it sends inline actions. Hub receives no own-code entry. Managed setcode/setabi are owner-linked, preventing module code from upgrading itself through active. Direct bootstrap keys are removed. External system/token accounts and member wallets keep their own authorities.

Relay and Fees are service accounts, not deployed contracts, when their code hash is zero. Relay submits API and settlement actions; Fees receives platform revenue. Their earlier exclusion from contract handover leaves direct keys until a separately reviewed service-account proposal is applied. That proposal delegates both owner and active to runtime@active and gives only Relay an action-linked operator child. Neither service account needs eosio.code. Status displays current permissions and configured responsibilities, not proposed authority as though already live.

Runtime execctx is a child of active, with threshold 1 and only runtime@eosio.code. Supported member actions are linked to execctx. Runtime service is a separate child of active with the configured service key and selected creation/bootstrap links. A child cannot authorize its parent. Governing-DAO enrollment and module installation still require runtime active authority.

A vault-signed instruction or authenticated linked native-wallet instruction enters Runtime. Runtime checks deployment, DAO, signature, nonce, expiry, member status and allowed action, then calls the module inline under runtime@execctx. The module checks its actual sender, installed action, pinned code hash, member role and agent restrictions.

Callbacks use module@active, authorized inline by that module’s own eosio.code. Runtime additionally checks the actual module sender, current code pin and exact callback grant. Signing directly with a module key or executive quorum cannot counterfeit the inline sender. Public finalization and due settlement read existing authoritative records; relayers cannot invent approval.

Grant example: Grants receives a contributor application and reviewer approval. Decide binds a ballot to the exact application revision, policy and module pins. A passing finalized vote calls Grants and Works to create an accepted project/agreement and reserve Runtime obligations. A contributor submits the milestone, a permitted reviewer approves it, and settlement converts the obligation into the contributor’s claim.

Payroll reserves and settles fixed-term installments through the same Runtime treasury. Endorsement calls the narrowly granted admission callback only after its witness threshold; it does not appoint executives. DAO configuration can exclude ordinary members from voting. Runtime and DAO identifiers isolate balances, module state and callbacks.

A member withdraws an earned claim by signing an instruction; Runtime pays through the configured token contract under its active/code authority. The receiving wallet must prepare its token balance row and cover that RAM. Offboarding does not erase earned claims. Failed inline actions roll back nonces, balances and execution markers. Retrying completed settlement cannot pay twice.

Executive elections and activity refresh can update native control. Only eligible active paired executives contribute signer weight. Inactivity changes authority when a transaction refreshes it; no transaction means no automatic update. The all-inactive fallback retains recovery signers until an eligible executive returns. One remaining active executive can intentionally control the deployment. Last-controller unlinking is blocked; authenticated atomic wallet replacement remains available.

The bundled diagram illustrates the post-handover model for ownership policy 2 in core 0.13; it is not a statement that current live Telos account permissions were changed. Local native integration tests verify signatures, thresholds, all module owners, actual inline callbacks, multiple DAO isolation and complete settlement. VERT verifies compiled-WASM state behavior; neither is evidence of a live provider or network deployment.

Creator recovery and executive wallet authorities must remain independent of the governed deployment. The runtime rejects owner/active authority that can be satisfied through core owner/active or the configured service key. A governed Relay/Fees account cannot become an independent executive signer through circular delegation. Runtime owner recovery still overrides active quorum when held by the independent creator.

## DAOs: purpose, membership and governance

A DAO is an organisation coordinated through shared governance rules, often implemented in smart contracts. Members propose changes, decide who may vote and control a treasury according to those rules. A DAO can serve a community, nonprofit project, cooperative, gaming guild or other shared purpose; it is a coordination model, not automatically a tradable token or a legal entity.

Membership models vary. Token-based voting weights holdings; reputation or contribution models recognise participation; membership-based voting can give eligible members equal votes. Quorum sets required participation, while approval sets the support needed to pass. Delegation gives another participant voting responsibility. Multisig execution requires a configured combination of signers. Passing a vote does not automatically execute arbitrary transactions: the actual contract and execution policy decide that.

General design suggestions: start with a clear purpose, admission rules, voting eligibility, spending limits and a recovery process. A small community may prefer equal-member voting; a grants DAO may pair funding decisions with milestones; a gaming guild may organise shared assets and contributor rewards. Compare these options with your goals rather than assuming a token solves every coordination problem. These are design suggestions, not a claim that every option is implemented in Daclify.

General operational suggestions: publish the decision process, distinguish voters from non-voting contributors and administrators, set explicit terms and inactivity rules where supported, document conflicts of interest and use staged payments for work. Blockchain transparency does not prove project quality. Privacy needs separate encryption and key recovery; a public ledger does not hide membership or transaction metadata. Legal form, taxes, charity status and financial suitability depend on jurisdiction and require appropriate professional advice, not an AI verdict.

Sources:
- DAO education, ethereum.org: <https://ethereum.org/dao/> (reviewed 2026-10-09)

## Telos Zero and Telos EVM explained

Telos provides a native Antelope environment called Telos Zero and an Ethereum-compatible environment called Telos EVM. Zero supports named accounts and C++ smart contracts compiled to WebAssembly. Telos EVM supports Ethereum-style applications and JSON-RPC tools, including Solidity contracts. The official introduction describes EVM as running through a smart contract on Zero; this does not make native and EVM account formats or transaction APIs interchangeable.

TLOS is used across the Telos ecosystem, but native balances, EVM balances and balances on other chains are distinct. Native account names and EVM hexadecimal addresses need the correct wallet and network. Connecting a wallet to an app is different from authorising a transaction. Bridging or depositing requires the correct supported route, destination and network; never infer a payment merely from matching address text.

Daclify governance contracts run on Telos Zero in Antelope C++. Its internal member accounts are different from native Telos accounts. Pairing a Zero or EVM wallet proves control for supported Daclify flows; it does not merge chain balances, automatically create a native account or grant executive office. Whether an external-chain payment or action is supported depends on the installed, verified module.

This is a reviewed introductory guide, not a live network-status or investment feed. Check official documentation and the app Status page for current configuration. Performance headlines, future price predictions and guaranteed fee claims are not verified here.

Sources:
- Telos introduction: <https://docs.telos.net/overview/what-is-telos/introduction/> (reviewed 2026-10-09)
- Telos Zero toolkit: <https://docs.telos.net/zero/telos_zero/> (reviewed 2026-10-09)
- Telos EVM introduction: <https://docs.telos.net/evm/about/introduction/> (reviewed 2026-10-09)

## Telos networks, wallets and explorers

The official Telos network guide lists EVM mainnet chain ID 40 with RPC https://rpc.telos.net and EVM testnet chain ID 41 with RPC https://rpc.testnet.telos.net. TLOS is the network symbol. These are EVM JSON-RPC endpoints, not native Antelope /v1/chain APIs. Network settings can change; the source review date is not proof that an endpoint is reachable now.

An EVM wallet must select the correct chain ID and RPC before interacting. Teloscan is the EVM explorer; Telos Zero has a separate native explorer. A native account wallet uses Zero rather than an Ethereum JSON-RPC network entry. Testnet uses test funds; a successful test transaction is not a mainnet payment.

For Daclify, testnet and production frontend builds select their matching API through deployment environment settings. Wallet network selection does not change the app deployment. Check Status and the wallet transaction network before approving anything. Verify a payment through its actual transaction, recipient, asset, amount and finality, not a browser return message. Never paste a private key or recovery phrase into a help chat.

Sources:
- Telos EVM network information: <https://docs.telos.net/build/network-info/> (reviewed 2026-10-09)
- Telos EVM wallet setup: <https://docs.telos.net/evm/about/setup-a-wallet/> (reviewed 2026-10-09)

## Telos native accounts and permission thresholds

A native Telos account identifies a person, group or smart contract. Authorisation uses named permissions and weighted authorities. An authority threshold must be met by eligible keys, account permissions or configured waits. Accounts normally start with owner and active permissions, and can use additional custom permissions for narrower actions.

Owner is the root recovery authority; active is used for ordinary transactions and sits beneath owner. A multisig authority can require several participants or a weighted combination, rather than one private key. Review the complete authority and parent relationship before changing it: a parent authority can override a child.

In Daclify, a paired wallet alone does not appoint an executive. Internal DAO roles and native contract control are different layers. Shared DAOs use platform-managed contracts. An independent deployment or the Daclify DAO can synchronise an eligible executive quorum to native account authorities after authorised handover. Its inactivity and final-controller rules come from the deployed Daclify contracts; Telos does not automatically implement that policy for every native account.

General operational guidance: review account names, permission names, thresholds and remaining recovery authority before signing a permission change. Keep the approval details visible and use the documented deployment procedure. This guide does not inspect your current account or generate a live permission audit.

Sources:
- Telos accounts and permissions: <https://docs.telos.net/zero/about/accounts/> (reviewed 2026-10-09)

## Telos Zero RAM, CPU and NET

Telos Zero uses RAM, CPU and NET resources. RAM holds persistent account and contract state such as table rows. CPU covers transaction computation; NET covers transaction bandwidth. CPU and NET capacity relate to allocated or staked resources. These native resources are different from EVM gas and from memory or storage on an application server.

A contract can need more RAM as its tables grow. The billed account and contract rules determine who funds those rows. A blockchain does not remove the need to budget state growth. IPFS stores file content separately; a CID on-chain is a reference, not a promise that a file is pinned or retrievable.

For Daclify, Resources separates physical contract RAM, DAO allocations, completion reserves and pinned storage. All enabled modules can contribute to DAO RAM use. Archiving can remove eligible live rows after the required verification, while retained IPFS files remain pinned and billed. Consult the Daclify resource guide for its exact purchase fees, capacity and retention policy; native Telos resource concepts do not define Daclify commercial prices.

Sources:
- Telos resource overview: <https://docs.telos.net/zero/resource-management/overview/> (reviewed 2026-10-09)

## Telos Decide and Works: governance concepts

The documented Telos Decide governance engine hosts ballots, token treasuries, voting methods and committee tools. A publisher chooses a voting token and the rules used to count votes. Its treasury and committee features let applications build on a common governance service.

The documented Telos Works system organises funding proposals into milestones, with community voting and predefined milestone amounts. It illustrates how a project can receive funding in stages rather than a single unrestricted payment.

At a high level, Telos Decide is a chain-wide governance service organised around voting-token treasuries. Daclify Decide works with DAO-scoped Daclify member identities and supports equal active-member, internal-credit or deposited-native-stake voting; a ballot snapshots its eligible denominator and member boundary. Daclify can bind a vote to one Works project under its saved governance policy. These are differences in identity, weight accounting and authorised effects, not a complete API comparison. Consult the matching Daclify Decide guide for its own settings and execution rules.

These are the documented Telos systems, not the same deployed contracts as Daclify Decide and Works. Daclify has its own member identity, voting snapshots, governance policy, project obligations and funding execution. Similar names do not establish action, table, token, fee or permission compatibility. Treat older Telos documentation as an explanation of those systems and verify a current deployment before using it.

General design suggestions: define eligible voters, voting weight, quorum, approval and execution authority before accepting proposals. For work funding, make deliverables and milestone review explicit and keep the amount reserved for the obligation. A ballot result and an actual treasury settlement are different events. Current Telos budgets, fees, proposals or deployment availability are not verified by this educational guide.

Sources:
- Telos Decide: <https://docs.telos.net/zero/governance/decide/> (reviewed 2026-10-09)
- Telos Works: <https://docs.telos.net/zero/governance/works/> (reviewed 2026-10-09)

## runtime contract

Source ABI JSON SHA-256: `a1a4b59c21d460c0e9bbea58f233c82df9eab73b1239719c11bede7e2db0f29f`.

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

### Action: adoptram

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| claims | bool |
| limit | uint32 |

### Action: appoint

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| member_ids | uint64[] |
| inactivity_seconds | uint32 |
| quorum_bps | uint16 |

### Action: approveob

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |

### Action: archapprove

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| manifest_commitment | checksum256 |
| descriptor_commitment | checksum256 |
| backup_commitment | checksum256 |
| retention_seconds | uint32 |

### Action: archattest

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| manifest | archive_manifest_descriptor |
| manifest_cid | string |
| manifest_bytes | uint32 |
| manifest_commitment | checksum256 |
| backup_commitment | checksum256 |
| retention_seconds | uint32 |

### Action: archrevoke

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| manifest_commitment | checksum256 |
| descriptor_commitment | checksum256 |
| backup_commitment | checksum256 |
| retention_seconds | uint32 |

### Action: archstep

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| archive_id | uint64 |
| chunk_ordinal | uint32 |
| start | uint32 |
| count | uint32 |

### Action: authproof

| Field | ABI type |
| --- | --- |
| account | name |
| intent | checksum256 |

### Action: backfilldocs

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| limit | uint32 |

### Action: beginram

| Field | ABI type |
| --- | --- |
| sources | ram_migration_source[] |

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

### Action: checkdaoram

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| payer | name |
| table | name |

### Action: checkrampool

| Field | ABI type |
| --- | --- |
| payer | name |

### Action: clearholds

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| recipient | uint64 |
| limit | uint32 |

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

### Action: docref

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| table | name |
| source_id | uint64 |
| slot | uint8 |
| document_id | uint64 |
| version | uint32 |

### Action: docscanstep

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| table | name |
| start | uint64 |
| next | uint64 |
| complete | bool |
| scanned | uint32 |

### Action: docsrc

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| tables | name[] |

### Action: electexec

| Field | ABI type |
| --- | --- |
| source | name |
| dao_id | uint64 |
| election_id | uint64 |
| member_ids | uint64[] |
| starts | uint32 |
| ends | uint32 |

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

### Action: finishram

| Field | ABI type |
| --- | --- |
| reference | checksum256 |

### Action: fulfilram

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| reference | checksum256 |
| policy_revision | uint64 |
| maximum | asset |
| expires | uint32 |
| purchases | ram_purchase[] |

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

### Action: govresources

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| expected_revision | uint64 |
| native_ram_bps | uint16 |
| card_ram_bps | uint16 |
| included_activity_bytes | uint64 |
| identity_bytes_per_slot | uint64 |
| quote_lifetime_seconds | uint32 |
| storage_free_bytes | uint64 |
| storage_unit_bytes | uint64 |
| storage_monthly_usd | uint32 |

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

### Action: grantdaoram

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| payer | name |
| reference | uint64 |
| activity | uint64 |
| identity | uint64 |
| completion | uint64 |

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

### Action: handover

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| expected_signers | name[] |
| expected_threshold | uint32 |
| expected_revision | uint64 |
| expected_creator | name |
| expected_policy_version | uint16 |

### Action: heartbeat

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |

### Action: inheritram

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| payer | name |
| activity_headroom | uint64 |
| identity_headroom | uint64 |
| completion_headroom | uint64 |

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

### Action: orderram

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| payer | name |
| reference | checksum256 |
| policy_revision | uint64 |
| maximum | asset |
| expires | uint32 |
| purchases | ram_purchase[] |

### Action: payob

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |

### Action: prunedocs

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| archive_id | uint64 |
| chunk_ordinal | uint32 |
| start | uint32 |
| proofs | archive_prune_proof[] |

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

### Action: rebindramobs

| Field | ABI type |
| --- | --- |
| expected_old_hash | checksum256 |
| expected_new_hash | checksum256 |

### Action: recallexec

| Field | ABI type |
| --- | --- |
| source | name |
| dao_id | uint64 |
| election_id | uint64 |
| member_id | uint64 |

### Action: refreshgov

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |

### Action: reserve

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| source | name |
| source_id | uint64 |
| recipient | uint64 |
| quantity | asset |
| due | uint32 |

### Action: restoredoc

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| original | document_record |

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

### Action: scanram

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| table | name |
| limit | uint32 |

### Action: sealram

| Field | ABI type |
| --- | --- |
| limit | uint32 |

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

### Action: setarchcfg

| Field | ABI type |
| --- | --- |
| verifier | name |
| minimum_retention_seconds | uint32 |
| pruning_enabled | bool |

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

### Action: setdaoquota

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| enabled | bool |

### Action: setexecs

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| member_ids | uint64[] |
| inactivity_seconds | uint32 |
| quorum_bps | uint16 |

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

### Action: setnativegov

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| contracts | name[] |
| service_key | public_key |
| creator | name |
| inline_code | name[] |

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

### Action: setramauto

| Field | ABI type |
| --- | --- |
| enabled | bool |
| offers | ram_offer[] |

### Action: setramcode

| Field | ABI type |
| --- | --- |
| account | name |
| code_hash | checksum256 |

### Action: setrampool

| Field | ABI type |
| --- | --- |
| payer | name |
| expected_quota | uint64 |
| baseline_bytes | uint64 |
| platform_headroom | uint64 |

### Action: setresources

| Field | ABI type |
| --- | --- |
| native_ram_bps | uint16 |
| card_ram_bps | uint16 |
| included_activity_bytes | uint64 |
| identity_bytes_per_slot | uint64 |
| quote_lifetime_seconds | uint32 |
| storage_free_bytes | uint64 |
| storage_unit_bytes | uint64 |
| storage_monthly_usd | uint32 |

### Action: setroles

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| target | uint64 |
| admin | bool |
| reviewer | bool |

### Action: setvoter

| Field | ABI type |
| --- | --- |
| runtime | name |
| dao_id | uint64 |
| member_id | uint64 |
| target | uint64 |
| can_vote | bool |

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

### Action: syncexec

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |

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

### Table: archcfg

| Field | ABI type |
| --- | --- |
| verifier | name |
| minimum_retention_seconds | uint32 |
| pruning_enabled | bool |

### Table: archives

| Field | ABI type |
| --- | --- |
| id | uint64 |
| dao_id | uint64 |
| manifest | archive_manifest_descriptor |
| manifest_cid | string |
| manifest_bytes | uint32 |
| manifest_commitment | checksum256 |
| descriptor_commitment | checksum256 |
| backup_commitment | checksum256 |
| verifier | name |
| attestation_transaction | checksum256 |
| approval_transaction | checksum256 |
| retention_seconds | uint32 |
| attested_at | uint32 |
| approved_by | uint64 |
| approved_at | uint32 |
| revoked | bool |

### Table: archpos

| Field | ABI type |
| --- | --- |
| id | uint64 |
| dao_id | uint64 |
| archive_id | uint64 |
| chunk_ordinal | uint32 |
| pruned | uint32 |

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

### Table: docclocks

| Field | ABI type |
| --- | --- |
| id | uint64 |
| document_id | uint64 |
| version | uint32 |
| created_at | uint32 |
| legacy | bool |
| row_hash | checksum256 |

### Table: docheads

| Field | ABI type |
| --- | --- |
| document_id | uint64 |
| version | uint32 |
| author | uint64 |

### Table: docrefs

| Field | ABI type |
| --- | --- |
| id | uint64 |
| source | name |
| table | name |
| source_id | uint64 |
| slot | uint8 |
| document_id | uint64 |
| version | uint32 |

### Table: docscan

| Field | ABI type |
| --- | --- |
| id | uint64 |
| source | name |
| table | name |
| code_hash | checksum256 |
| cursor | uint64 |
| complete | bool |

### Table: docsrcs

| Field | ABI type |
| --- | --- |
| source | name |
| code_hash | checksum256 |
| tables | name[] |

### Table: docstate

| Field | ABI type |
| --- | --- |
| id | uint64 |
| high_water | uint64 |
| cursor | uint64 |
| complete | bool |

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

### Table: execpending

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| election_id | uint64 |
| starts | uint32 |
| ends | uint32 |
| members | uint64[] |

### Table: execpols

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| inactivity_seconds | uint32 |
| quorum_bps | uint16 |
| revision | uint64 |
| last_election_start | uint32 |

### Table: executives

| Field | ABI type |
| --- | --- |
| member_id | uint64 |
| last_active | uint32 |
| office_epoch | uint64 |
| election_id | uint64 |

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

### Table: nativegov

| Field | ABI type |
| --- | --- |
| dao_id | uint64 |
| contracts | name[] |
| service_key | public_key |
| handed_over | bool |
| signers | name[] |
| threshold | uint32 |
| admin_members | uint64[] |
| ownership | native_ownership_policy$ |

### Table: nonvoters

| Field | ABI type |
| --- | --- |
| member_id | uint64 |

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

### Table: ramalloc

| Field | ABI type |
| --- | --- |
| payer | name |
| purchased_bytes | uint64 |

### Table: ramauto

| Field | ABI type |
| --- | --- |
| enabled | bool |
| policy_revision | uint64 |
| offers | ram_offer[] |

### Table: ramcards

| Field | ABI type |
| --- | --- |
| id | uint64 |
| dao_id | uint64 |
| reference | checksum256 |
| operational_bps | uint16 |
| fulfiller | name |

### Table: ramclmholds

| Field | ABI type |
| --- | --- |
| id | uint64 |
| recipient | uint64 |
| ready | bool |
| padding | bytes |

### Table: ramcursors

| Field | ABI type |
| --- | --- |
| table | name |
| cursor | uint64 |
| advanced | bool |
| complete | bool |

### Table: ramentitle

| Field | ABI type |
| --- | --- |
| payer | name |
| policy_revision | uint64 |
| identity_per_slot | uint64 |
| slots | uint32 |

### Table: ramgrants

| Field | ABI type |
| --- | --- |
| id | uint64 |
| dao_id | uint64 |
| payer | name |
| reference | uint64 |
| activity | uint64 |
| identity | uint64 |
| completion | uint64 |

### Table: ramholds

| Field | ABI type |
| --- | --- |
| id | uint64 |
| recipient | uint64 |
| ready | bool |
| padding | bytes |

### Table: raminherit

| Field | ABI type |
| --- | --- |
| payer | name |
| activity | uint64 |
| identity | uint64 |
| completion | uint64 |
| activity_headroom | uint64 |
| identity_headroom | uint64 |
| completion_headroom | uint64 |

### Table: ramintent

| Field | ABI type |
| --- | --- |
| order | ram_order |
| transaction_id | checksum256 |

### Table: ramlimits

| Field | ABI type |
| --- | --- |
| payer | name |
| activity | uint64 |
| identity | uint64 |
| completion | uint64 |

### Table: rammigrate

| Field | ABI type |
| --- | --- |
| active | bool |
| globals_complete | bool |
| advanced | bool |
| dao_cursor | uint64 |

### Table: rammigsrcs

| Field | ABI type |
| --- | --- |
| account | name |
| kind | uint8 |
| code_hash | checksum256 |

### Table: ramobs

| Field | ABI type |
| --- | --- |
| meter_bytes | uint64 |
| runtime_hash | checksum256 |

### Table: ramorders

| Field | ABI type |
| --- | --- |
| id | uint64 |
| dao_id | uint64 |
| reference | checksum256 |
| payer | name |
| treasury | name |
| policy_revision | uint64 |
| fee_bps | uint16 |
| expires | uint32 |
| maximum | asset |
| spent | asset |
| platform_fee | asset |
| received | asset |
| purchases | ram_acquisition[] |
| funded | bool |
| settled | bool |

### Table: ramoverlays

| Field | ABI type |
| --- | --- |
| id | uint64 |
| table | name |
| row | uint64 |

### Table: rampayer

| Field | ABI type |
| --- | --- |
| runtime | name |

### Table: rampools

| Field | ABI type |
| --- | --- |
| payer | name |
| quota_bytes | uint64 |
| baseline_bytes | uint64 |
| platform_headroom | uint64 |
| source_hash | checksum256 |

### Table: ramquota

| Field | ABI type |
| --- | --- |
| enabled | bool |

### Table: ramreserve

| Field | ABI type |
| --- | --- |
| available | asset |

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

### Table: resourcecfg

| Field | ABI type |
| --- | --- |
| schema_version | uint16 |
| revision | uint64 |
| native_ram_bps | uint16 |
| card_ram_bps | uint16 |
| included_activity_bytes | uint64 |
| identity_bytes_per_slot | uint64 |
| quote_lifetime_seconds | uint32 |
| grace_seconds | uint32 |
| storage_free_bytes | uint64 |
| storage_unit_bytes | uint64 |
| storage_monthly_usd | uint32 |

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

## names contract

Source ABI JSON SHA-256: `0e0d996e5ac592ba29a1d1531a575d88d2370d314123b8489326318ed9e0cba8`.

### Action: checkprofit

| Field | ABI type |
| --- | --- |
| sale_id | uint64 |

### Action: closepay

| Field | ABI type |
| --- | --- |
| sale_id | uint64 |

### Action: delname

| Field | ABI type |
| --- | --- |
| seller | name |
| account_name | name |

### Action: delsuffix

| Field | ABI type |
| --- | --- |
| suffix | name |

### Action: editname

| Field | ABI type |
| --- | --- |
| seller | name |
| account_name | name |
| price | asset |
| usd_cents | uint32 |
| accepts_fee_rule | uint8 |

### Action: fulfill

| Field | ABI type |
| --- | --- |
| settler | name |
| account_name | name |
| owner_key | public_key |
| active_key | public_key |
| usd_cents | uint32 |
| reference | checksum256 |

### Action: fulfillnet

| Field | ABI type |
| --- | --- |
| settler | name |
| account_name | name |
| owner_key | public_key |
| active_key | public_key |
| usd_cents | uint32 |
| net_usd_cents | uint32 |
| reference | checksum256 |

### Action: init

| Field | ABI type |
| --- | --- |
| runtime | name |
| settler | name |
| token_contract | name |
| token_symbol | symbol |

### Action: intend

| Field | ABI type |
| --- | --- |
| buyer | name |
| account_name | name |
| owner_key | public_key |
| active_key | public_key |

### Action: observefee

| Field | ABI type |
| --- | --- |
| card_fixed_usd_cents | uint32 |
| observed_at | uint32 |

### Action: observeprice

| Field | ABI type |
| --- | --- |
| median | uint64 |
| quoted_precision | uint8 |
| observed_at | uint32 |

### Action: regname

| Field | ABI type |
| --- | --- |
| seller | name |
| account_name | name |
| price | asset |
| usd_cents | uint32 |
| accepts_fee_rule | uint8 |

### Action: regsuffix

| Field | ABI type |
| --- | --- |
| suffix | name |
| price | asset |
| usd_cents | uint32 |
| accepts_fee_rule | uint8 |

### Action: setoracle

| Field | ABI type |
| --- | --- |
| runtime | name |
| median | uint64 |
| quoted_precision | uint8 |
| observed_at | uint32 |

### Action: setpolicy

| Field | ABI type |
| --- | --- |
| runtime | name |
| bump_bps | uint16 |
| quote_premium_bps | uint16 |

### Action: setprofit

| Field | ABI type |
| --- | --- |
| runtime | name |
| version | uint8 |
| minimum_usd_cents | uint32 |
| card_fee_bps | uint16 |
| card_fixed_usd_cents | uint32 |
| fee_observed_at | uint32 |

### Action: setrates

| Field | ABI type |
| --- | --- |
| runtime | name |
| third_party_bps | uint16 |
| first_party_bps | uint16 |
| treasury | name |
| token_contract | name |
| token_symbol | symbol |

### Action: setsettler

| Field | ABI type |
| --- | --- |
| settler | name |

### Action: settier

| Field | ABI type |
| --- | --- |
| kind | uint8 |
| price | asset |
| usd_cents | uint32 |
| ram_bytes | uint32 |
| net_stake | asset |
| cpu_stake | asset |

### Table: intents

| Field | ABI type |
| --- | --- |
| buyer | name |
| account_name | name |
| owner_key | public_key |
| active_key | public_key |
| expires | uint32 |

### Table: namelist

| Field | ABI type |
| --- | --- |
| account_name | name |
| seller | name |
| price | asset |
| usd_cents | uint32 |
| accepts | uint8 |
| sold | uint8 |

### Table: namescfg

| Field | ABI type |
| --- | --- |
| runtime | name |
| settler | name |
| treasury | name |
| third_party_bps | uint16 |
| first_party_bps | uint16 |
| token_contract | name |
| token_symbol | symbol |

### Table: policy

| Field | ABI type |
| --- | --- |
| bump_bps | uint16 |
| quote_premium_bps | uint16 |
| median | uint64 |
| quoted_precision | uint8 |
| observed_at | uint32 |

### Table: profitcfg

| Field | ABI type |
| --- | --- |
| version | uint8 |
| minimum_usd_cents | uint32 |
| card_fee_bps | uint16 |
| card_fixed_usd_cents | uint32 |
| fee_observed_at | uint32 |

### Table: profitcheck

| Field | ABI type |
| --- | --- |
| sale_id | uint64 |
| before_balance | int64 |
| gross_units | int64 |
| net_usd_cents | uint32 |
| minimum_usd_cents | uint32 |
| median | uint64 |
| quoted_precision | uint8 |
| rail | uint8 |

### Table: saleprov

| Field | ABI type |
| --- | --- |
| id | uint64 |
| version | uint8 |
| party | uint8 |
| treasury | name |
| resource_cost | asset |
| seller_share | asset |
| resource_cents | uint32 |
| net_cents | uint32 |
| seller_cents | uint32 |
| state | uint8 |

### Table: sales

| Field | ABI type |
| --- | --- |
| id | uint64 |
| account_name | name |
| payer | name |
| seller | name |
| owner_key | public_key |
| gross | asset |
| platform_fee | asset |
| usd_cents | uint32 |
| platform_cents | uint32 |
| bps | uint16 |
| rail | uint8 |
| reference | checksum256 |

### Table: suffixes

| Field | ABI type |
| --- | --- |
| suffix | name |
| seller | name |
| price | asset |
| usd_cents | uint32 |
| accepts | uint8 |
| sales_count | uint32 |

### Table: tiers

| Field | ABI type |
| --- | --- |
| kind | uint8 |
| price | asset |
| usd_cents | uint32 |
| ram_bytes | uint32 |
| net_stake | asset |
| cpu_stake | asset |

## POST /v1/account/recovery/device

Guide: recovery.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "recipient": {
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
    "recipient"
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
    "request": {
      "type": "object",
      "properties": {
        "signingPublicKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionPublicKey": {
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
        "version": {
          "type": "number",
          "const": 1
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "accountId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "origin": {
          "type": "string",
          "maxLength": 512,
          "format": "uri"
        },
        "recipient": {
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
        "fingerprint": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "expires": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        }
      },
      "required": [
        "signingPublicKey",
        "encryptionPublicKey",
        "version",
        "id",
        "accountId",
        "origin",
        "recipient",
        "fingerprint",
        "expires"
      ],
      "additionalProperties": false
    },
    "pollToken": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{43}$"
    }
  },
  "required": [
    "request",
    "pollToken"
  ],
  "additionalProperties": false
}
```

## GET /v1/account/recovery/device/:id

Guide: recovery.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "signingPublicKey": {
      "type": "string",
      "maxLength": 128
    },
    "encryptionPublicKey": {
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
    "version": {
      "type": "number",
      "const": 1
    },
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "accountId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "origin": {
      "type": "string",
      "maxLength": 512,
      "format": "uri"
    },
    "recipient": {
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
    "fingerprint": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "signingPublicKey",
    "encryptionPublicKey",
    "version",
    "id",
    "accountId",
    "origin",
    "recipient",
    "fingerprint",
    "expires"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/device/approve

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
    "fingerprint": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "payload": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "ephemeralKey": {
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
        "salt": {
          "type": "string",
          "maxLength": 44
        },
        "envelope": {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "algorithm": {
              "type": "string",
              "const": "AES-256-GCM"
            },
            "iv": {
              "type": "string",
              "maxLength": 16
            },
            "ciphertext": {
              "type": "string",
              "maxLength": 16384
            }
          },
          "required": [
            "version",
            "algorithm",
            "iv",
            "ciphertext"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "version",
        "ephemeralKey",
        "salt",
        "envelope"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "id",
    "fingerprint",
    "payload"
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
    "approved": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "approved"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/device/poll

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
    "pollToken": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{43}$"
    }
  },
  "required": [
    "id",
    "pollToken"
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
    "request": {
      "type": "object",
      "properties": {
        "signingPublicKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionPublicKey": {
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
        "version": {
          "type": "number",
          "const": 1
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "accountId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "origin": {
          "type": "string",
          "maxLength": 512,
          "format": "uri"
        },
        "recipient": {
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
        "fingerprint": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "expires": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        }
      },
      "required": [
        "signingPublicKey",
        "encryptionPublicKey",
        "version",
        "id",
        "accountId",
        "origin",
        "recipient",
        "fingerprint",
        "expires"
      ],
      "additionalProperties": false
    },
    "payload": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "ephemeralKey": {
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
            "salt": {
              "type": "string",
              "maxLength": 44
            },
            "envelope": {
              "type": "object",
              "properties": {
                "version": {
                  "type": "number",
                  "const": 1
                },
                "algorithm": {
                  "type": "string",
                  "const": "AES-256-GCM"
                },
                "iv": {
                  "type": "string",
                  "maxLength": 16
                },
                "ciphertext": {
                  "type": "string",
                  "maxLength": 16384
                }
              },
              "required": [
                "version",
                "algorithm",
                "iv",
                "ciphertext"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "version",
            "ephemeralKey",
            "salt",
            "envelope"
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
    "request",
    "payload"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/device/cancel

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
    "pollToken": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{43}$"
    }
  },
  "required": [
    "id",
    "pollToken"
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
    "cancelled": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "cancelled"
  ],
  "additionalProperties": false
}
```

## GET /v1/account/recovery

Guide: recovery.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "methods": {
      "maxItems": 64,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "credentialKey": {
            "type": "string",
            "minLength": 3,
            "maxLength": 2048,
            "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
          },
          "kind": {
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
          "mode": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "wallet-protected",
                  "passkey-protected",
                  "daclify-assisted"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "availableModes": {
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "wallet-protected",
                "passkey-protected",
                "daclify-assisted"
              ]
            }
          },
          "reason": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 512
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "credentialKey",
          "kind",
          "subject",
          "chainId",
          "mode",
          "availableModes",
          "reason"
        ],
        "additionalProperties": false
      }
    },
    "assistedEver": {
      "type": "boolean"
    },
    "configured": {
      "type": "boolean"
    },
    "reason": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 512
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "methods",
    "assistedEver",
    "configured",
    "reason"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/enable

Guide: recovery.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "context": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "accountId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "origin": {
          "type": "string",
          "maxLength": 512,
          "format": "uri"
        },
        "credentialKey": {
          "type": "string",
          "minLength": 3,
          "maxLength": 2048,
          "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
        },
        "mode": {
          "type": "string",
          "enum": [
            "wallet-protected",
            "passkey-protected",
            "daclify-assisted"
          ]
        },
        "signingPublicKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionPublicKey": {
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
        "salt": {
          "type": "string",
          "maxLength": 44
        }
      },
      "required": [
        "version",
        "id",
        "accountId",
        "origin",
        "credentialKey",
        "mode",
        "signingPublicKey",
        "encryptionPublicKey",
        "salt"
      ],
      "additionalProperties": false
    },
    "envelope": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "algorithm": {
          "type": "string",
          "const": "AES-256-GCM"
        },
        "iv": {
          "type": "string",
          "maxLength": 16
        },
        "ciphertext": {
          "type": "string",
          "maxLength": 16384
        }
      },
      "required": [
        "version",
        "algorithm",
        "iv",
        "ciphertext"
      ],
      "additionalProperties": false
    },
    "clientKeyWrap": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "algorithm": {
          "type": "string",
          "const": "AES-256-GCM"
        },
        "iv": {
          "type": "string",
          "maxLength": 16
        },
        "ciphertext": {
          "type": "string",
          "maxLength": 64
        }
      },
      "required": [
        "version",
        "algorithm",
        "iv",
        "ciphertext"
      ],
      "additionalProperties": false
    },
    "assistedHandoff": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "keyGrant": {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "ephemeralKey": {
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
            "salt": {
              "type": "string",
              "maxLength": 44
            },
            "envelope": {
              "type": "object",
              "properties": {
                "version": {
                  "type": "number",
                  "const": 1
                },
                "algorithm": {
                  "type": "string",
                  "const": "AES-256-GCM"
                },
                "iv": {
                  "type": "string",
                  "maxLength": 16
                },
                "ciphertext": {
                  "type": "string",
                  "maxLength": 64
                }
              },
              "required": [
                "version",
                "algorithm",
                "iv",
                "ciphertext"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "version",
            "ephemeralKey",
            "salt",
            "envelope"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "id",
        "keyGrant"
      ],
      "additionalProperties": false
    },
    "assistedConsent": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "context",
    "envelope"
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
    "methods": {
      "maxItems": 64,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "credentialKey": {
            "type": "string",
            "minLength": 3,
            "maxLength": 2048,
            "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
          },
          "kind": {
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
          "mode": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "wallet-protected",
                  "passkey-protected",
                  "daclify-assisted"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "availableModes": {
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "wallet-protected",
                "passkey-protected",
                "daclify-assisted"
              ]
            }
          },
          "reason": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 512
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "credentialKey",
          "kind",
          "subject",
          "chainId",
          "mode",
          "availableModes",
          "reason"
        ],
        "additionalProperties": false
      }
    },
    "assistedEver": {
      "type": "boolean"
    },
    "configured": {
      "type": "boolean"
    },
    "reason": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 512
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "methods",
    "assistedEver",
    "configured",
    "reason"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/disable

Guide: recovery.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "credentialKey": {
      "type": "string",
      "minLength": 3,
      "maxLength": 2048,
      "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
    },
    "keepKitFallback": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "credentialKey"
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
    "methods": {
      "maxItems": 64,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "credentialKey": {
            "type": "string",
            "minLength": 3,
            "maxLength": 2048,
            "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
          },
          "kind": {
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
          "mode": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "wallet-protected",
                  "passkey-protected",
                  "daclify-assisted"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "availableModes": {
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "wallet-protected",
                "passkey-protected",
                "daclify-assisted"
              ]
            }
          },
          "reason": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 512
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "credentialKey",
          "kind",
          "subject",
          "chainId",
          "mode",
          "availableModes",
          "reason"
        ],
        "additionalProperties": false
      }
    },
    "assistedEver": {
      "type": "boolean"
    },
    "configured": {
      "type": "boolean"
    },
    "reason": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 512
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "methods",
    "assistedEver",
    "configured",
    "reason"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/assisted/options

Guide: recovery.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "context": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "accountId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "origin": {
          "type": "string",
          "maxLength": 512,
          "format": "uri"
        },
        "credentialKey": {
          "type": "string",
          "minLength": 3,
          "maxLength": 2048,
          "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
        },
        "mode": {
          "type": "string",
          "enum": [
            "wallet-protected",
            "passkey-protected",
            "daclify-assisted"
          ]
        },
        "signingPublicKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionPublicKey": {
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
        "salt": {
          "type": "string",
          "maxLength": 44
        }
      },
      "required": [
        "version",
        "id",
        "accountId",
        "origin",
        "credentialKey",
        "mode",
        "signingPublicKey",
        "encryptionPublicKey",
        "salt"
      ],
      "additionalProperties": false
    },
    "assistedConsent": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "context",
    "assistedConsent"
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
    "recipient": {
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
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "id",
    "recipient",
    "expires"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/claim

Guide: recovery.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "grant": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{43}$"
    },
    "recipient": {
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
    "grant",
    "recipient"
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
    "backup": {
      "type": "object",
      "properties": {
        "context": {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "accountId": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "origin": {
              "type": "string",
              "maxLength": 512,
              "format": "uri"
            },
            "credentialKey": {
              "type": "string",
              "minLength": 3,
              "maxLength": 2048,
              "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
            },
            "mode": {
              "type": "string",
              "enum": [
                "wallet-protected",
                "passkey-protected",
                "daclify-assisted"
              ]
            },
            "signingPublicKey": {
              "type": "string",
              "maxLength": 128
            },
            "encryptionPublicKey": {
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
            "salt": {
              "type": "string",
              "maxLength": 44
            }
          },
          "required": [
            "version",
            "id",
            "accountId",
            "origin",
            "credentialKey",
            "mode",
            "signingPublicKey",
            "encryptionPublicKey",
            "salt"
          ],
          "additionalProperties": false
        },
        "envelope": {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "algorithm": {
              "type": "string",
              "const": "AES-256-GCM"
            },
            "iv": {
              "type": "string",
              "maxLength": 16
            },
            "ciphertext": {
              "type": "string",
              "maxLength": 16384
            }
          },
          "required": [
            "version",
            "algorithm",
            "iv",
            "ciphertext"
          ],
          "additionalProperties": false
        },
        "keyWrap": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "client"
                },
                "envelope": {
                  "type": "object",
                  "properties": {
                    "version": {
                      "type": "number",
                      "const": 1
                    },
                    "algorithm": {
                      "type": "string",
                      "const": "AES-256-GCM"
                    },
                    "iv": {
                      "type": "string",
                      "maxLength": 16
                    },
                    "ciphertext": {
                      "type": "string",
                      "maxLength": 64
                    }
                  },
                  "required": [
                    "version",
                    "algorithm",
                    "iv",
                    "ciphertext"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "kind",
                "envelope"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "service"
                },
                "ciphertext": {
                  "type": "string",
                  "maxLength": 8192,
                  "pattern": "^vault:v[1-9][0-9]*:[A-Za-z0-9+/]+={0,2}$"
                }
              },
              "required": [
                "kind",
                "ciphertext"
              ],
              "additionalProperties": false
            }
          ]
        }
      },
      "required": [
        "context",
        "envelope",
        "keyWrap"
      ],
      "additionalProperties": false
    },
    "keyGrant": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "ephemeralKey": {
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
            "salt": {
              "type": "string",
              "maxLength": 44
            },
            "envelope": {
              "type": "object",
              "properties": {
                "version": {
                  "type": "number",
                  "const": 1
                },
                "algorithm": {
                  "type": "string",
                  "const": "AES-256-GCM"
                },
                "iv": {
                  "type": "string",
                  "maxLength": 16
                },
                "ciphertext": {
                  "type": "string",
                  "maxLength": 64
                }
              },
              "required": [
                "version",
                "algorithm",
                "iv",
                "ciphertext"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "version",
            "ephemeralKey",
            "salt",
            "envelope"
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
    "backup",
    "keyGrant"
  ],
  "additionalProperties": false
}
```

## GET /v1/storage/curation

Guide: retention.

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
    "generation": {
      "type": "string",
      "maxLength": 20
    },
    "funding": {
      "type": "object",
      "properties": {
        "state": {
          "type": "string",
          "enum": [
            "free",
            "pending",
            "active",
            "grace",
            "overdue",
            "review"
          ]
        },
        "pricing": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "freeBytes": {
              "type": "string",
              "maxLength": 20
            },
            "unitBytes": {
              "type": "string",
              "maxLength": 20
            },
            "monthlyUnitUsdCents": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99999999
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "freeBytes",
            "unitBytes",
            "monthlyUnitUsdCents"
          ],
          "additionalProperties": false
        },
        "units": {
          "type": "integer",
          "minimum": 0,
          "maximum": 999999
        },
        "paidThrough": {
          "anyOf": [
            {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                },
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                }
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "graceEndsAt": {
          "anyOf": [
            {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                },
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                }
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "uploadCapacityBytes": {
          "type": "string",
          "maxLength": 20
        },
        "retainedCapacityBytes": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "state",
        "pricing",
        "units",
        "paidThrough",
        "graceEndsAt",
        "uploadCapacityBytes",
        "retainedCapacityBytes"
      ],
      "additionalProperties": false
    },
    "cleanup": {
      "type": "string",
      "enum": [
        "disabled",
        "qualified"
      ]
    },
    "bundles": {
      "default": [],
      "maxItems": 10000,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256
          },
          "objectIds": {
            "minItems": 1,
            "maxItems": 33,
            "type": "array",
            "items": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            }
          }
        },
        "required": [
          "key",
          "objectIds"
        ],
        "additionalProperties": false
      }
    },
    "objects": {
      "maxItems": 10000,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          },
          "bytes": {
            "type": "string",
            "maxLength": 20
          },
          "createdAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"
          },
          "cid": {
            "type": "string",
            "maxLength": 128
          },
          "kinds": {
            "minItems": 1,
            "maxItems": 4,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "document-version",
                "branding",
                "media",
                "archive"
              ]
            }
          },
          "selected": {
            "type": "boolean"
          },
          "retained": {
            "type": "boolean"
          },
          "releasedAt": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "bytes",
          "createdAt",
          "cid",
          "kinds",
          "selected",
          "retained",
          "releasedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "dao",
    "generation",
    "funding",
    "cleanup",
    "bundles",
    "objects"
  ],
  "additionalProperties": false
}
```

## POST /v1/storage/retain

Guide: retention.

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
    "generation": {
      "type": "string",
      "maxLength": 20
    },
    "keep": {
      "maxItems": 10000,
      "type": "array",
      "items": {
        "type": "string",
        "format": "uuid",
        "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
      }
    }
  },
  "required": [
    "dao",
    "generation",
    "keep"
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
    "generation": {
      "type": "string",
      "maxLength": 20
    },
    "funding": {
      "type": "object",
      "properties": {
        "state": {
          "type": "string",
          "enum": [
            "free",
            "pending",
            "active",
            "grace",
            "overdue",
            "review"
          ]
        },
        "pricing": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "freeBytes": {
              "type": "string",
              "maxLength": 20
            },
            "unitBytes": {
              "type": "string",
              "maxLength": 20
            },
            "monthlyUnitUsdCents": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99999999
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "freeBytes",
            "unitBytes",
            "monthlyUnitUsdCents"
          ],
          "additionalProperties": false
        },
        "units": {
          "type": "integer",
          "minimum": 0,
          "maximum": 999999
        },
        "paidThrough": {
          "anyOf": [
            {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                },
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                }
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "graceEndsAt": {
          "anyOf": [
            {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                },
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                }
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "uploadCapacityBytes": {
          "type": "string",
          "maxLength": 20
        },
        "retainedCapacityBytes": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "state",
        "pricing",
        "units",
        "paidThrough",
        "graceEndsAt",
        "uploadCapacityBytes",
        "retainedCapacityBytes"
      ],
      "additionalProperties": false
    },
    "cleanup": {
      "type": "string",
      "enum": [
        "disabled",
        "qualified"
      ]
    },
    "bundles": {
      "default": [],
      "maxItems": 10000,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256
          },
          "objectIds": {
            "minItems": 1,
            "maxItems": 33,
            "type": "array",
            "items": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            }
          }
        },
        "required": [
          "key",
          "objectIds"
        ],
        "additionalProperties": false
      }
    },
    "objects": {
      "maxItems": 10000,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          },
          "bytes": {
            "type": "string",
            "maxLength": 20
          },
          "createdAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"
          },
          "cid": {
            "type": "string",
            "maxLength": 128
          },
          "kinds": {
            "minItems": 1,
            "maxItems": 4,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "document-version",
                "branding",
                "media",
                "archive"
              ]
            }
          },
          "selected": {
            "type": "boolean"
          },
          "retained": {
            "type": "boolean"
          },
          "releasedAt": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "bytes",
          "createdAt",
          "cid",
          "kinds",
          "selected",
          "retained",
          "releasedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "dao",
    "generation",
    "funding",
    "cleanup",
    "bundles",
    "objects"
  ],
  "additionalProperties": false
}
```

## POST /v1/resources/ram/card/quote

Guide: resources-and-retention.

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
    "allocations": {
      "minItems": 1,
      "maxItems": 6,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "receiver": {
            "type": "string",
            "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
          },
          "minimumBytes": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "receiver",
          "minimumBytes"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "dao",
    "allocations"
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
    "quote": {
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
        "rail": {
          "type": "string",
          "const": "tlos"
        },
        "baseUnits": {
          "type": "string",
          "maxLength": 20
        },
        "feeUnits": {
          "type": "string",
          "maxLength": 20
        },
        "totalUnits": {
          "type": "string",
          "maxLength": 20
        },
        "feeBps": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10000
        },
        "order": {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "payer": {
              "type": "string",
              "maxLength": 13
            },
            "reference": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "policy_revision": {
              "type": "string",
              "maxLength": 20
            },
            "maximum": {
              "type": "string",
              "maxLength": 64,
              "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
            },
            "expires": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "purchases": {
              "maxItems": 64,
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "receiver": {
                    "type": "string",
                    "maxLength": 13
                  },
                  "quantity": {
                    "type": "string",
                    "maxLength": 64,
                    "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                  },
                  "minimum_bytes": {
                    "type": "string",
                    "maxLength": 20
                  }
                },
                "required": [
                  "receiver",
                  "quantity",
                  "minimum_bytes"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "dao_id",
            "payer",
            "reference",
            "policy_revision",
            "maximum",
            "expires",
            "purchases"
          ],
          "additionalProperties": false
        },
        "systemCodeHash": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "systemRawAbiHash": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "quotedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        }
      },
      "required": [
        "dao",
        "rail",
        "baseUnits",
        "feeUnits",
        "totalUnits",
        "feeBps",
        "order",
        "systemCodeHash",
        "systemRawAbiHash",
        "quotedAt"
      ],
      "additionalProperties": false
    },
    "policy": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "type": "number",
          "const": 1
        },
        "revision": {
          "type": "string",
          "maxLength": 20
        },
        "nativeRamBps": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10000
        },
        "cardRamBps": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10000
        },
        "includedActivityBytes": {
          "type": "string",
          "maxLength": 20
        },
        "identityBytesPerSlot": {
          "type": "string",
          "maxLength": 20
        },
        "quoteLifetimeSeconds": {
          "type": "integer",
          "minimum": 1,
          "maximum": 3600
        },
        "graceSeconds": {
          "type": "number",
          "const": 2592000
        },
        "storage": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "freeBytes": {
              "type": "string",
              "maxLength": 20
            },
            "unitBytes": {
              "type": "string",
              "maxLength": 20
            },
            "monthlyUnitUsdCents": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99999999
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "freeBytes",
            "unitBytes",
            "monthlyUnitUsdCents"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "schemaVersion",
        "revision",
        "nativeRamBps",
        "cardRamBps",
        "includedActivityBytes",
        "identityBytesPerSlot",
        "quoteLifetimeSeconds",
        "graceSeconds",
        "storage"
      ],
      "additionalProperties": false
    },
    "oracle": {
      "type": "object",
      "properties": {
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
        "median",
        "precision",
        "observed_at"
      ],
      "additionalProperties": false
    },
    "baseUsdCents": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 99999999
    },
    "feeUsdCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 99999999
    },
    "totalUsdCents": {
      "type": "integer",
      "minimum": 500,
      "maximum": 99999999
    }
  },
  "required": [
    "quote",
    "policy",
    "oracle",
    "baseUsdCents",
    "feeUsdCents",
    "totalUsdCents"
  ],
  "additionalProperties": false
}
```

## POST /v1/resources/ram/card/checkout

Guide: resources-and-retention.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "quote": {
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
        "rail": {
          "type": "string",
          "const": "tlos"
        },
        "baseUnits": {
          "type": "string",
          "maxLength": 20
        },
        "feeUnits": {
          "type": "string",
          "maxLength": 20
        },
        "totalUnits": {
          "type": "string",
          "maxLength": 20
        },
        "feeBps": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10000
        },
        "order": {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "payer": {
              "type": "string",
              "maxLength": 13
            },
            "reference": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "policy_revision": {
              "type": "string",
              "maxLength": 20
            },
            "maximum": {
              "type": "string",
              "maxLength": 64,
              "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
            },
            "expires": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "purchases": {
              "maxItems": 64,
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "receiver": {
                    "type": "string",
                    "maxLength": 13
                  },
                  "quantity": {
                    "type": "string",
                    "maxLength": 64,
                    "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                  },
                  "minimum_bytes": {
                    "type": "string",
                    "maxLength": 20
                  }
                },
                "required": [
                  "receiver",
                  "quantity",
                  "minimum_bytes"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "dao_id",
            "payer",
            "reference",
            "policy_revision",
            "maximum",
            "expires",
            "purchases"
          ],
          "additionalProperties": false
        },
        "systemCodeHash": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "systemRawAbiHash": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "quotedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        }
      },
      "required": [
        "dao",
        "rail",
        "baseUnits",
        "feeUnits",
        "totalUnits",
        "feeBps",
        "order",
        "systemCodeHash",
        "systemRawAbiHash",
        "quotedAt"
      ],
      "additionalProperties": false
    },
    "policy": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "type": "number",
          "const": 1
        },
        "revision": {
          "type": "string",
          "maxLength": 20
        },
        "nativeRamBps": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10000
        },
        "cardRamBps": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10000
        },
        "includedActivityBytes": {
          "type": "string",
          "maxLength": 20
        },
        "identityBytesPerSlot": {
          "type": "string",
          "maxLength": 20
        },
        "quoteLifetimeSeconds": {
          "type": "integer",
          "minimum": 1,
          "maximum": 3600
        },
        "graceSeconds": {
          "type": "number",
          "const": 2592000
        },
        "storage": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "freeBytes": {
              "type": "string",
              "maxLength": 20
            },
            "unitBytes": {
              "type": "string",
              "maxLength": 20
            },
            "monthlyUnitUsdCents": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99999999
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "freeBytes",
            "unitBytes",
            "monthlyUnitUsdCents"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "schemaVersion",
        "revision",
        "nativeRamBps",
        "cardRamBps",
        "includedActivityBytes",
        "identityBytesPerSlot",
        "quoteLifetimeSeconds",
        "graceSeconds",
        "storage"
      ],
      "additionalProperties": false
    },
    "oracle": {
      "type": "object",
      "properties": {
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
        "median",
        "precision",
        "observed_at"
      ],
      "additionalProperties": false
    },
    "baseUsdCents": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 99999999
    },
    "feeUsdCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 99999999
    },
    "totalUsdCents": {
      "type": "integer",
      "minimum": 500,
      "maximum": 99999999
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "consent": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "quote",
    "policy",
    "oracle",
    "baseUsdCents",
    "feeUsdCents",
    "totalUsdCents",
    "requestId",
    "consent"
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
    "state": {
      "type": "string",
      "enum": [
        "pending",
        "paid",
        "provisioning",
        "settled",
        "review"
      ]
    },
    "approval": {
      "type": "object",
      "properties": {
        "quote": {
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
            "rail": {
              "type": "string",
              "const": "tlos"
            },
            "baseUnits": {
              "type": "string",
              "maxLength": 20
            },
            "feeUnits": {
              "type": "string",
              "maxLength": 20
            },
            "totalUnits": {
              "type": "string",
              "maxLength": 20
            },
            "feeBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "order": {
              "type": "object",
              "properties": {
                "dao_id": {
                  "type": "string",
                  "maxLength": 20
                },
                "payer": {
                  "type": "string",
                  "maxLength": 13
                },
                "reference": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{64}$"
                },
                "policy_revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "maximum": {
                  "type": "string",
                  "maxLength": 64,
                  "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                },
                "expires": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 4294967295
                },
                "purchases": {
                  "maxItems": 64,
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "receiver": {
                        "type": "string",
                        "maxLength": 13
                      },
                      "quantity": {
                        "type": "string",
                        "maxLength": 64,
                        "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                      },
                      "minimum_bytes": {
                        "type": "string",
                        "maxLength": 20
                      }
                    },
                    "required": [
                      "receiver",
                      "quantity",
                      "minimum_bytes"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "dao_id",
                "payer",
                "reference",
                "policy_revision",
                "maximum",
                "expires",
                "purchases"
              ],
              "additionalProperties": false
            },
            "systemCodeHash": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "systemRawAbiHash": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "quotedAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
            }
          },
          "required": [
            "dao",
            "rail",
            "baseUnits",
            "feeUnits",
            "totalUnits",
            "feeBps",
            "order",
            "systemCodeHash",
            "systemRawAbiHash",
            "quotedAt"
          ],
          "additionalProperties": false
        },
        "policy": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "nativeRamBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "cardRamBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "includedActivityBytes": {
              "type": "string",
              "maxLength": 20
            },
            "identityBytesPerSlot": {
              "type": "string",
              "maxLength": 20
            },
            "quoteLifetimeSeconds": {
              "type": "integer",
              "minimum": 1,
              "maximum": 3600
            },
            "graceSeconds": {
              "type": "number",
              "const": 2592000
            },
            "storage": {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "freeBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "unitBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "monthlyUnitUsdCents": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 99999999
                }
              },
              "required": [
                "schemaVersion",
                "revision",
                "freeBytes",
                "unitBytes",
                "monthlyUnitUsdCents"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "nativeRamBps",
            "cardRamBps",
            "includedActivityBytes",
            "identityBytesPerSlot",
            "quoteLifetimeSeconds",
            "graceSeconds",
            "storage"
          ],
          "additionalProperties": false
        },
        "oracle": {
          "type": "object",
          "properties": {
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
            "median",
            "precision",
            "observed_at"
          ],
          "additionalProperties": false
        },
        "baseUsdCents": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 99999999
        },
        "feeUsdCents": {
          "type": "integer",
          "minimum": 0,
          "maximum": 99999999
        },
        "totalUsdCents": {
          "type": "integer",
          "minimum": 500,
          "maximum": 99999999
        },
        "requestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "consent": {
          "type": "boolean",
          "const": true
        }
      },
      "required": [
        "quote",
        "policy",
        "oracle",
        "baseUsdCents",
        "feeUsdCents",
        "totalUsdCents",
        "requestId",
        "consent"
      ],
      "additionalProperties": false
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
    "acquiredBytes": {
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
    "settledAt": {
      "anyOf": [
        {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "id",
    "dao",
    "state",
    "approval",
    "checkoutUrl",
    "acquiredBytes",
    "settledAt"
  ],
  "additionalProperties": false
}
```

## GET /v1/resources/ram/card/orders/:id

Guide: resources-and-retention.

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
    "state": {
      "type": "string",
      "enum": [
        "pending",
        "paid",
        "provisioning",
        "settled",
        "review"
      ]
    },
    "approval": {
      "type": "object",
      "properties": {
        "quote": {
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
            "rail": {
              "type": "string",
              "const": "tlos"
            },
            "baseUnits": {
              "type": "string",
              "maxLength": 20
            },
            "feeUnits": {
              "type": "string",
              "maxLength": 20
            },
            "totalUnits": {
              "type": "string",
              "maxLength": 20
            },
            "feeBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "order": {
              "type": "object",
              "properties": {
                "dao_id": {
                  "type": "string",
                  "maxLength": 20
                },
                "payer": {
                  "type": "string",
                  "maxLength": 13
                },
                "reference": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{64}$"
                },
                "policy_revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "maximum": {
                  "type": "string",
                  "maxLength": 64,
                  "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                },
                "expires": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 4294967295
                },
                "purchases": {
                  "maxItems": 64,
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "receiver": {
                        "type": "string",
                        "maxLength": 13
                      },
                      "quantity": {
                        "type": "string",
                        "maxLength": 64,
                        "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                      },
                      "minimum_bytes": {
                        "type": "string",
                        "maxLength": 20
                      }
                    },
                    "required": [
                      "receiver",
                      "quantity",
                      "minimum_bytes"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "dao_id",
                "payer",
                "reference",
                "policy_revision",
                "maximum",
                "expires",
                "purchases"
              ],
              "additionalProperties": false
            },
            "systemCodeHash": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "systemRawAbiHash": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "quotedAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
            }
          },
          "required": [
            "dao",
            "rail",
            "baseUnits",
            "feeUnits",
            "totalUnits",
            "feeBps",
            "order",
            "systemCodeHash",
            "systemRawAbiHash",
            "quotedAt"
          ],
          "additionalProperties": false
        },
        "policy": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "nativeRamBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "cardRamBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "includedActivityBytes": {
              "type": "string",
              "maxLength": 20
            },
            "identityBytesPerSlot": {
              "type": "string",
              "maxLength": 20
            },
            "quoteLifetimeSeconds": {
              "type": "integer",
              "minimum": 1,
              "maximum": 3600
            },
            "graceSeconds": {
              "type": "number",
              "const": 2592000
            },
            "storage": {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "freeBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "unitBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "monthlyUnitUsdCents": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 99999999
                }
              },
              "required": [
                "schemaVersion",
                "revision",
                "freeBytes",
                "unitBytes",
                "monthlyUnitUsdCents"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "nativeRamBps",
            "cardRamBps",
            "includedActivityBytes",
            "identityBytesPerSlot",
            "quoteLifetimeSeconds",
            "graceSeconds",
            "storage"
          ],
          "additionalProperties": false
        },
        "oracle": {
          "type": "object",
          "properties": {
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
            "median",
            "precision",
            "observed_at"
          ],
          "additionalProperties": false
        },
        "baseUsdCents": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 99999999
        },
        "feeUsdCents": {
          "type": "integer",
          "minimum": 0,
          "maximum": 99999999
        },
        "totalUsdCents": {
          "type": "integer",
          "minimum": 500,
          "maximum": 99999999
        },
        "requestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "consent": {
          "type": "boolean",
          "const": true
        }
      },
      "required": [
        "quote",
        "policy",
        "oracle",
        "baseUsdCents",
        "feeUsdCents",
        "totalUsdCents",
        "requestId",
        "consent"
      ],
      "additionalProperties": false
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
    "acquiredBytes": {
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
    "settledAt": {
      "anyOf": [
        {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "id",
    "dao",
    "state",
    "approval",
    "checkoutUrl",
    "acquiredBytes",
    "settledAt"
  ],
  "additionalProperties": false
}
```

## POST /v1/resources/ram/card/orders/:id/reconcile

Guide: resources-and-retention.

Request fields are not included in this response reference; consult the endpoint implementation.

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
    "state": {
      "type": "string",
      "enum": [
        "pending",
        "paid",
        "provisioning",
        "settled",
        "review"
      ]
    },
    "approval": {
      "type": "object",
      "properties": {
        "quote": {
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
            "rail": {
              "type": "string",
              "const": "tlos"
            },
            "baseUnits": {
              "type": "string",
              "maxLength": 20
            },
            "feeUnits": {
              "type": "string",
              "maxLength": 20
            },
            "totalUnits": {
              "type": "string",
              "maxLength": 20
            },
            "feeBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "order": {
              "type": "object",
              "properties": {
                "dao_id": {
                  "type": "string",
                  "maxLength": 20
                },
                "payer": {
                  "type": "string",
                  "maxLength": 13
                },
                "reference": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{64}$"
                },
                "policy_revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "maximum": {
                  "type": "string",
                  "maxLength": 64,
                  "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                },
                "expires": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 4294967295
                },
                "purchases": {
                  "maxItems": 64,
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "receiver": {
                        "type": "string",
                        "maxLength": 13
                      },
                      "quantity": {
                        "type": "string",
                        "maxLength": 64,
                        "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                      },
                      "minimum_bytes": {
                        "type": "string",
                        "maxLength": 20
                      }
                    },
                    "required": [
                      "receiver",
                      "quantity",
                      "minimum_bytes"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "dao_id",
                "payer",
                "reference",
                "policy_revision",
                "maximum",
                "expires",
                "purchases"
              ],
              "additionalProperties": false
            },
            "systemCodeHash": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "systemRawAbiHash": {
              "type": "string",
              "pattern": "^[0-9a-f]{64}$"
            },
            "quotedAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
            }
          },
          "required": [
            "dao",
            "rail",
            "baseUnits",
            "feeUnits",
            "totalUnits",
            "feeBps",
            "order",
            "systemCodeHash",
            "systemRawAbiHash",
            "quotedAt"
          ],
          "additionalProperties": false
        },
        "policy": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "nativeRamBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "cardRamBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "includedActivityBytes": {
              "type": "string",
              "maxLength": 20
            },
            "identityBytesPerSlot": {
              "type": "string",
              "maxLength": 20
            },
            "quoteLifetimeSeconds": {
              "type": "integer",
              "minimum": 1,
              "maximum": 3600
            },
            "graceSeconds": {
              "type": "number",
              "const": 2592000
            },
            "storage": {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "freeBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "unitBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "monthlyUnitUsdCents": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 99999999
                }
              },
              "required": [
                "schemaVersion",
                "revision",
                "freeBytes",
                "unitBytes",
                "monthlyUnitUsdCents"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "nativeRamBps",
            "cardRamBps",
            "includedActivityBytes",
            "identityBytesPerSlot",
            "quoteLifetimeSeconds",
            "graceSeconds",
            "storage"
          ],
          "additionalProperties": false
        },
        "oracle": {
          "type": "object",
          "properties": {
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
            "median",
            "precision",
            "observed_at"
          ],
          "additionalProperties": false
        },
        "baseUsdCents": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 99999999
        },
        "feeUsdCents": {
          "type": "integer",
          "minimum": 0,
          "maximum": 99999999
        },
        "totalUsdCents": {
          "type": "integer",
          "minimum": 500,
          "maximum": 99999999
        },
        "requestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "consent": {
          "type": "boolean",
          "const": true
        }
      },
      "required": [
        "quote",
        "policy",
        "oracle",
        "baseUsdCents",
        "feeUsdCents",
        "totalUsdCents",
        "requestId",
        "consent"
      ],
      "additionalProperties": false
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
    "acquiredBytes": {
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
    "settledAt": {
      "anyOf": [
        {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "id",
    "dao",
    "state",
    "approval",
    "checkoutUrl",
    "acquiredBytes",
    "settledAt"
  ],
  "additionalProperties": false
}
```

## POST /v1/resources/ram/quote

Guide: resources-and-retention.

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
    "payer": {
      "type": "string",
      "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
    },
    "allocations": {
      "minItems": 1,
      "maxItems": 6,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "receiver": {
            "type": "string",
            "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
          },
          "minimumBytes": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "receiver",
          "minimumBytes"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "dao",
    "payer",
    "allocations"
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
    "rail": {
      "type": "string",
      "const": "tlos"
    },
    "baseUnits": {
      "type": "string",
      "maxLength": 20
    },
    "feeUnits": {
      "type": "string",
      "maxLength": 20
    },
    "totalUnits": {
      "type": "string",
      "maxLength": 20
    },
    "feeBps": {
      "type": "integer",
      "minimum": 0,
      "maximum": 10000
    },
    "order": {
      "type": "object",
      "properties": {
        "dao_id": {
          "type": "string",
          "maxLength": 20
        },
        "payer": {
          "type": "string",
          "maxLength": 13
        },
        "reference": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "policy_revision": {
          "type": "string",
          "maxLength": 20
        },
        "maximum": {
          "type": "string",
          "maxLength": 64,
          "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
        },
        "expires": {
          "type": "integer",
          "minimum": 0,
          "maximum": 4294967295
        },
        "purchases": {
          "maxItems": 64,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "receiver": {
                "type": "string",
                "maxLength": 13
              },
              "quantity": {
                "type": "string",
                "maxLength": 64,
                "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
              },
              "minimum_bytes": {
                "type": "string",
                "maxLength": 20
              }
            },
            "required": [
              "receiver",
              "quantity",
              "minimum_bytes"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "dao_id",
        "payer",
        "reference",
        "policy_revision",
        "maximum",
        "expires",
        "purchases"
      ],
      "additionalProperties": false
    },
    "systemCodeHash": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "systemRawAbiHash": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "quotedAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "dao",
    "rail",
    "baseUnits",
    "feeUnits",
    "totalUnits",
    "feeBps",
    "order",
    "systemCodeHash",
    "systemRawAbiHash",
    "quotedAt"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/ram

Guide: resources-and-retention.

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
    "observation": {
      "type": "string",
      "enum": [
        "active",
        "disabled"
      ]
    },
    "enforcement": {
      "type": "string",
      "enum": [
        "disabled",
        "active"
      ]
    },
    "completionHolds": {
      "default": null,
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "rows": {
              "type": "integer",
              "minimum": 0,
              "maximum": 5000
            },
            "bytes": {
              "type": "string",
              "maxLength": 20
            }
          },
          "required": [
            "rows",
            "bytes"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "policy": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "nativeRamBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "cardRamBps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 10000
            },
            "includedActivityBytes": {
              "type": "string",
              "maxLength": 20
            },
            "identityBytesPerSlot": {
              "type": "string",
              "maxLength": 20
            },
            "quoteLifetimeSeconds": {
              "type": "integer",
              "minimum": 1,
              "maximum": 3600
            },
            "graceSeconds": {
              "type": "number",
              "const": 2592000
            },
            "storage": {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "freeBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "unitBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "monthlyUnitUsdCents": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 99999999
                }
              },
              "required": [
                "schemaVersion",
                "revision",
                "freeBytes",
                "unitBytes",
                "monthlyUnitUsdCents"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "nativeRamBps",
            "cardRamBps",
            "includedActivityBytes",
            "identityBytesPerSlot",
            "quoteLifetimeSeconds",
            "graceSeconds",
            "storage"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
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
    "totalObservedBytes": {
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
    "purchasedBytes": {
      "type": "string",
      "maxLength": 20
    },
    "payers": {
      "minItems": 1,
      "maxItems": 64,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "payer": {
            "type": "string",
            "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
          },
          "moduleId": {
            "anyOf": [
              {
                "type": "string",
                "minLength": 1,
                "maxLength": 64
              },
              {
                "type": "null"
              }
            ]
          },
          "sourceVerified": {
            "type": "boolean"
          },
          "usage": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "identity": {
                    "type": "string",
                    "maxLength": 20
                  },
                  "activity": {
                    "type": "string",
                    "maxLength": 20
                  },
                  "retained": {
                    "type": "string",
                    "maxLength": 20
                  },
                  "platform": {
                    "type": "string",
                    "maxLength": 20
                  }
                },
                "required": [
                  "identity",
                  "activity",
                  "retained",
                  "platform"
                ],
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          },
          "purchasedBytes": {
            "type": "string",
            "maxLength": 20
          },
          "allocation": {
            "default": null,
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "activity": {
                    "type": "string",
                    "maxLength": 20
                  },
                  "identity": {
                    "type": "string",
                    "maxLength": 20
                  },
                  "completion": {
                    "type": "string",
                    "maxLength": 20
                  }
                },
                "required": [
                  "activity",
                  "identity",
                  "completion"
                ],
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          },
          "entitlement": {
            "default": null,
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "policy_revision": {
                    "type": "string",
                    "maxLength": 20
                  },
                  "identity_per_slot": {
                    "type": "string",
                    "maxLength": 20
                  },
                  "slots": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 4294967295
                  }
                },
                "required": [
                  "policy_revision",
                  "identity_per_slot",
                  "slots"
                ],
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          },
          "globalQuotaBytes": {
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
          "globalUsedBytes": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "payer",
          "moduleId",
          "sourceVerified",
          "usage",
          "purchasedBytes",
          "allocation",
          "entitlement",
          "globalQuotaBytes",
          "globalUsedBytes"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "dao",
    "observation",
    "enforcement",
    "completionHolds",
    "policy",
    "read",
    "totalObservedBytes",
    "purchasedBytes",
    "payers"
  ],
  "additionalProperties": false
}
```

## GET /v1/daos/:id/storage

Guide: resources-and-retention.

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
    "capacityBytes": {
      "type": "string",
      "maxLength": 20
    },
    "verifiedBytes": {
      "type": "string",
      "maxLength": 20
    },
    "reservedBytes": {
      "type": "string",
      "maxLength": 20
    },
    "totalBytes": {
      "type": "string",
      "maxLength": 20
    },
    "objects": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "references": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "cleanup": {
      "type": "string",
      "enum": [
        "disabled",
        "qualified"
      ]
    }
  },
  "required": [
    "dao",
    "capacityBytes",
    "verifiedBytes",
    "reservedBytes",
    "totalBytes",
    "objects",
    "references",
    "cleanup"
  ],
  "additionalProperties": false
}
```

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
    "gatewayAllowance": {
      "default": null,
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "unconfigured",
                "unavailable",
                "scheduled",
                "available",
                "exhausted",
                "expired"
              ]
            },
            "startsAt": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
                },
                {
                  "type": "null"
                }
              ]
            },
            "endsAt": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
                },
                {
                  "type": "null"
                }
              ]
            },
            "byteLimit": {
              "type": "string",
              "maxLength": 20
            },
            "reservedBytes": {
              "type": "string",
              "maxLength": 20
            },
            "requestLimit": {
              "type": "string",
              "maxLength": 20
            },
            "requests": {
              "type": "string",
              "maxLength": 20
            },
            "fundingQualification": {
              "type": "string",
              "enum": [
                "unconfigured",
                "operator-attested"
              ]
            }
          },
          "required": [
            "state",
            "startsAt",
            "endsAt",
            "byteLimit",
            "reservedBytes",
            "requestLimit",
            "requests",
            "fundingQualification"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
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
            "resourcePolicy": {
              "default": null,
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "schemaVersion": {
                      "type": "number",
                      "const": 1
                    },
                    "revision": {
                      "type": "string",
                      "maxLength": 20
                    },
                    "nativeRamBps": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 10000
                    },
                    "cardRamBps": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 10000
                    },
                    "includedActivityBytes": {
                      "type": "string",
                      "maxLength": 20
                    },
                    "identityBytesPerSlot": {
                      "type": "string",
                      "maxLength": 20
                    },
                    "quoteLifetimeSeconds": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 3600
                    },
                    "graceSeconds": {
                      "type": "number",
                      "const": 2592000
                    },
                    "storage": {
                      "type": "object",
                      "properties": {
                        "schemaVersion": {
                          "type": "number",
                          "const": 1
                        },
                        "revision": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "freeBytes": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "unitBytes": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "monthlyUnitUsdCents": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 99999999
                        }
                      },
                      "required": [
                        "schemaVersion",
                        "revision",
                        "freeBytes",
                        "unitBytes",
                        "monthlyUnitUsdCents"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "schemaVersion",
                    "revision",
                    "nativeRamBps",
                    "cardRamBps",
                    "includedActivityBytes",
                    "identityBytesPerSlot",
                    "quoteLifetimeSeconds",
                    "graceSeconds",
                    "storage"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "ramReserve": {
              "default": null,
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "available": {
                      "type": "string",
                      "maxLength": 64,
                      "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$"
                    }
                  },
                  "required": [
                    "available"
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
            "resourcePolicy",
            "ramReserve",
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
    "gatewayAllowance",
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

## POST /v1/branding/uploads

Guide: dao-discovery.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
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
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "slot": {
      "type": "string",
      "enum": [
        "logo",
        "cover"
      ]
    },
    "content": {
      "type": "string",
      "minLength": 4,
      "maxLength": 6990508
    },
    "publicConsent": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "bytes",
    "mediaType",
    "commitment",
    "dao",
    "requestId",
    "slot",
    "content",
    "publicConsent"
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
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "slot": {
      "type": "string",
      "enum": [
        "logo",
        "cover"
      ]
    },
    "image": {
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
  "required": [
    "dao",
    "requestId",
    "slot",
    "image"
  ],
  "additionalProperties": false
}
```

## POST /v1/storage/recover

Guide: recovery.

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
    "kind": {
      "type": "string",
      "enum": [
        "document-version",
        "branding",
        "archive"
      ]
    },
    "after": {
      "default": "0",
      "type": "string",
      "maxLength": 20
    }
  },
  "required": [
    "dao",
    "kind"
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
    "kind": {
      "type": "string",
      "enum": [
        "document-version",
        "branding",
        "archive"
      ]
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
    },
    "billingRestored": {
      "type": "boolean",
      "const": false
    },
    "objects": {
      "maxItems": 58,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "referenceKey": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$"
          },
          "cid": {
            "type": "string",
            "maxLength": 128
          },
          "state": {
            "type": "string",
            "enum": [
              "recovered",
              "tracked",
              "external",
              "unavailable",
              "released"
            ]
          }
        },
        "required": [
          "referenceKey",
          "cid",
          "state"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "dao",
    "kind",
    "next",
    "billingRestored",
    "objects"
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
    },
    "executivePolicy": {
      "default": null,
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "inactivity_seconds": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "quorum_bps": {
              "type": "integer",
              "minimum": 0,
              "maximum": 65535
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "last_election_start": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            }
          },
          "required": [
            "dao_id",
            "inactivity_seconds",
            "quorum_bps",
            "revision",
            "last_election_start"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "executives": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "member_id": {
            "type": "string",
            "maxLength": 20
          },
          "last_active": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4294967295
          },
          "office_epoch": {
            "type": "string",
            "maxLength": 20
          },
          "election_id": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "member_id",
          "last_active",
          "office_epoch",
          "election_id"
        ],
        "additionalProperties": false
      }
    },
    "executiveMembers": {
      "default": [],
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
    "excludedVoters": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "member_id": {
            "type": "string",
            "maxLength": 20
          }
        },
        "required": [
          "member_id"
        ],
        "additionalProperties": false
      }
    },
    "nativeGovernance": {
      "default": null,
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "contracts": {
              "maxItems": 64,
              "type": "array",
              "items": {
                "type": "string",
                "maxLength": 13
              }
            },
            "service_key": {
              "type": "string",
              "maxLength": 128
            },
            "handed_over": {
              "type": "boolean"
            },
            "signers": {
              "maxItems": 64,
              "type": "array",
              "items": {
                "type": "string",
                "maxLength": 13
              }
            },
            "threshold": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "admin_members": {
              "maxItems": 64,
              "type": "array",
              "items": {
                "type": "string",
                "maxLength": 20
              }
            },
            "ownership": {
              "type": "object",
              "properties": {
                "policy_version": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 65535
                },
                "creator": {
                  "type": "string",
                  "maxLength": 13
                },
                "inline_code": {
                  "maxItems": 64,
                  "type": "array",
                  "items": {
                    "type": "string",
                    "maxLength": 13
                  }
                }
              },
              "required": [
                "policy_version",
                "creator",
                "inline_code"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "dao_id",
            "contracts",
            "service_key",
            "handed_over",
            "signers",
            "threshold",
            "admin_members"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "nativeSetupEligible": {
      "default": false,
      "type": "boolean"
    },
    "executiveHandover": {
      "default": null,
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "dao_id": {
              "type": "string",
              "maxLength": 20
            },
            "election_id": {
              "type": "string",
              "maxLength": 20
            },
            "starts": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "ends": {
              "type": "integer",
              "minimum": 0,
              "maximum": 4294967295
            },
            "members": {
              "maxItems": 64,
              "type": "array",
              "items": {
                "type": "string",
                "maxLength": 20
              }
            }
          },
          "required": [
            "dao_id",
            "election_id",
            "starts",
            "ends",
            "members"
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
    "admission",
    "executivePolicy",
    "executives",
    "executiveMembers",
    "excludedVoters",
    "nativeGovernance",
    "nativeSetupEligible",
    "executiveHandover"
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

Guide: resources-and-retention.

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

Guide: resources-and-retention.

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

Guide: resources-and-retention.

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

Guide: resources-and-retention.

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

Guide: resources-and-retention.

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

## POST /v1/account/recovery/device

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "recipient": {
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
    "recipient"
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
    "request": {
      "type": "object",
      "properties": {
        "signingPublicKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionPublicKey": {
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
        "version": {
          "type": "number",
          "const": 1
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "accountId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "origin": {
          "type": "string",
          "maxLength": 512,
          "format": "uri"
        },
        "recipient": {
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
        "fingerprint": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "expires": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        }
      },
      "required": [
        "signingPublicKey",
        "encryptionPublicKey",
        "version",
        "id",
        "accountId",
        "origin",
        "recipient",
        "fingerprint",
        "expires"
      ],
      "additionalProperties": false
    },
    "pollToken": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{43}$"
    }
  },
  "required": [
    "request",
    "pollToken"
  ],
  "additionalProperties": false
}
```

## GET /v1/account/recovery/device/:id

Guide: accounts.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "signingPublicKey": {
      "type": "string",
      "maxLength": 128
    },
    "encryptionPublicKey": {
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
    "version": {
      "type": "number",
      "const": 1
    },
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "accountId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "origin": {
      "type": "string",
      "maxLength": 512,
      "format": "uri"
    },
    "recipient": {
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
    "fingerprint": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "signingPublicKey",
    "encryptionPublicKey",
    "version",
    "id",
    "accountId",
    "origin",
    "recipient",
    "fingerprint",
    "expires"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/device/approve

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
    "fingerprint": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "payload": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "ephemeralKey": {
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
        "salt": {
          "type": "string",
          "maxLength": 44
        },
        "envelope": {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "algorithm": {
              "type": "string",
              "const": "AES-256-GCM"
            },
            "iv": {
              "type": "string",
              "maxLength": 16
            },
            "ciphertext": {
              "type": "string",
              "maxLength": 16384
            }
          },
          "required": [
            "version",
            "algorithm",
            "iv",
            "ciphertext"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "version",
        "ephemeralKey",
        "salt",
        "envelope"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "id",
    "fingerprint",
    "payload"
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
    "approved": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "approved"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/device/poll

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
    "pollToken": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{43}$"
    }
  },
  "required": [
    "id",
    "pollToken"
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
    "request": {
      "type": "object",
      "properties": {
        "signingPublicKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionPublicKey": {
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
        "version": {
          "type": "number",
          "const": 1
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "accountId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "origin": {
          "type": "string",
          "maxLength": 512,
          "format": "uri"
        },
        "recipient": {
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
        "fingerprint": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        },
        "expires": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
        }
      },
      "required": [
        "signingPublicKey",
        "encryptionPublicKey",
        "version",
        "id",
        "accountId",
        "origin",
        "recipient",
        "fingerprint",
        "expires"
      ],
      "additionalProperties": false
    },
    "payload": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "ephemeralKey": {
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
            "salt": {
              "type": "string",
              "maxLength": 44
            },
            "envelope": {
              "type": "object",
              "properties": {
                "version": {
                  "type": "number",
                  "const": 1
                },
                "algorithm": {
                  "type": "string",
                  "const": "AES-256-GCM"
                },
                "iv": {
                  "type": "string",
                  "maxLength": 16
                },
                "ciphertext": {
                  "type": "string",
                  "maxLength": 16384
                }
              },
              "required": [
                "version",
                "algorithm",
                "iv",
                "ciphertext"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "version",
            "ephemeralKey",
            "salt",
            "envelope"
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
    "request",
    "payload"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/device/cancel

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
    "pollToken": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{43}$"
    }
  },
  "required": [
    "id",
    "pollToken"
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
    "cancelled": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "cancelled"
  ],
  "additionalProperties": false
}
```

## GET /v1/account/recovery

Guide: accounts.

No request body.

Response:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "methods": {
      "maxItems": 64,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "credentialKey": {
            "type": "string",
            "minLength": 3,
            "maxLength": 2048,
            "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
          },
          "kind": {
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
          "mode": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "wallet-protected",
                  "passkey-protected",
                  "daclify-assisted"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "availableModes": {
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "wallet-protected",
                "passkey-protected",
                "daclify-assisted"
              ]
            }
          },
          "reason": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 512
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "credentialKey",
          "kind",
          "subject",
          "chainId",
          "mode",
          "availableModes",
          "reason"
        ],
        "additionalProperties": false
      }
    },
    "assistedEver": {
      "type": "boolean"
    },
    "configured": {
      "type": "boolean"
    },
    "reason": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 512
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "methods",
    "assistedEver",
    "configured",
    "reason"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/enable

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "context": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "accountId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "origin": {
          "type": "string",
          "maxLength": 512,
          "format": "uri"
        },
        "credentialKey": {
          "type": "string",
          "minLength": 3,
          "maxLength": 2048,
          "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
        },
        "mode": {
          "type": "string",
          "enum": [
            "wallet-protected",
            "passkey-protected",
            "daclify-assisted"
          ]
        },
        "signingPublicKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionPublicKey": {
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
        "salt": {
          "type": "string",
          "maxLength": 44
        }
      },
      "required": [
        "version",
        "id",
        "accountId",
        "origin",
        "credentialKey",
        "mode",
        "signingPublicKey",
        "encryptionPublicKey",
        "salt"
      ],
      "additionalProperties": false
    },
    "envelope": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "algorithm": {
          "type": "string",
          "const": "AES-256-GCM"
        },
        "iv": {
          "type": "string",
          "maxLength": 16
        },
        "ciphertext": {
          "type": "string",
          "maxLength": 16384
        }
      },
      "required": [
        "version",
        "algorithm",
        "iv",
        "ciphertext"
      ],
      "additionalProperties": false
    },
    "clientKeyWrap": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "algorithm": {
          "type": "string",
          "const": "AES-256-GCM"
        },
        "iv": {
          "type": "string",
          "maxLength": 16
        },
        "ciphertext": {
          "type": "string",
          "maxLength": 64
        }
      },
      "required": [
        "version",
        "algorithm",
        "iv",
        "ciphertext"
      ],
      "additionalProperties": false
    },
    "assistedHandoff": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "keyGrant": {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "ephemeralKey": {
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
            "salt": {
              "type": "string",
              "maxLength": 44
            },
            "envelope": {
              "type": "object",
              "properties": {
                "version": {
                  "type": "number",
                  "const": 1
                },
                "algorithm": {
                  "type": "string",
                  "const": "AES-256-GCM"
                },
                "iv": {
                  "type": "string",
                  "maxLength": 16
                },
                "ciphertext": {
                  "type": "string",
                  "maxLength": 64
                }
              },
              "required": [
                "version",
                "algorithm",
                "iv",
                "ciphertext"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "version",
            "ephemeralKey",
            "salt",
            "envelope"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "id",
        "keyGrant"
      ],
      "additionalProperties": false
    },
    "assistedConsent": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "context",
    "envelope"
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
    "methods": {
      "maxItems": 64,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "credentialKey": {
            "type": "string",
            "minLength": 3,
            "maxLength": 2048,
            "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
          },
          "kind": {
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
          "mode": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "wallet-protected",
                  "passkey-protected",
                  "daclify-assisted"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "availableModes": {
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "wallet-protected",
                "passkey-protected",
                "daclify-assisted"
              ]
            }
          },
          "reason": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 512
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "credentialKey",
          "kind",
          "subject",
          "chainId",
          "mode",
          "availableModes",
          "reason"
        ],
        "additionalProperties": false
      }
    },
    "assistedEver": {
      "type": "boolean"
    },
    "configured": {
      "type": "boolean"
    },
    "reason": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 512
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "methods",
    "assistedEver",
    "configured",
    "reason"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/disable

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "credentialKey": {
      "type": "string",
      "minLength": 3,
      "maxLength": 2048,
      "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
    },
    "keepKitFallback": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "credentialKey"
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
    "methods": {
      "maxItems": 64,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "credentialKey": {
            "type": "string",
            "minLength": 3,
            "maxLength": 2048,
            "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
          },
          "kind": {
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
          "mode": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "wallet-protected",
                  "passkey-protected",
                  "daclify-assisted"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "availableModes": {
            "maxItems": 3,
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "wallet-protected",
                "passkey-protected",
                "daclify-assisted"
              ]
            }
          },
          "reason": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 512
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "credentialKey",
          "kind",
          "subject",
          "chainId",
          "mode",
          "availableModes",
          "reason"
        ],
        "additionalProperties": false
      }
    },
    "assistedEver": {
      "type": "boolean"
    },
    "configured": {
      "type": "boolean"
    },
    "reason": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 512
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "methods",
    "assistedEver",
    "configured",
    "reason"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/assisted/options

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "context": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "accountId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "origin": {
          "type": "string",
          "maxLength": 512,
          "format": "uri"
        },
        "credentialKey": {
          "type": "string",
          "minLength": 3,
          "maxLength": 2048,
          "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
        },
        "mode": {
          "type": "string",
          "enum": [
            "wallet-protected",
            "passkey-protected",
            "daclify-assisted"
          ]
        },
        "signingPublicKey": {
          "type": "string",
          "maxLength": 128
        },
        "encryptionPublicKey": {
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
        "salt": {
          "type": "string",
          "maxLength": 44
        }
      },
      "required": [
        "version",
        "id",
        "accountId",
        "origin",
        "credentialKey",
        "mode",
        "signingPublicKey",
        "encryptionPublicKey",
        "salt"
      ],
      "additionalProperties": false
    },
    "assistedConsent": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "context",
    "assistedConsent"
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
    "recipient": {
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
    "expires": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    }
  },
  "required": [
    "id",
    "recipient",
    "expires"
  ],
  "additionalProperties": false
}
```

## POST /v1/account/recovery/claim

Guide: accounts.

Request:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "grant": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{43}$"
    },
    "recipient": {
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
    "grant",
    "recipient"
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
    "backup": {
      "type": "object",
      "properties": {
        "context": {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "accountId": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            "origin": {
              "type": "string",
              "maxLength": 512,
              "format": "uri"
            },
            "credentialKey": {
              "type": "string",
              "minLength": 3,
              "maxLength": 2048,
              "pattern": "^(email|telegram|google|passkey|native|evm):[^\\u0000-\\u001f\\u007f]+$"
            },
            "mode": {
              "type": "string",
              "enum": [
                "wallet-protected",
                "passkey-protected",
                "daclify-assisted"
              ]
            },
            "signingPublicKey": {
              "type": "string",
              "maxLength": 128
            },
            "encryptionPublicKey": {
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
            "salt": {
              "type": "string",
              "maxLength": 44
            }
          },
          "required": [
            "version",
            "id",
            "accountId",
            "origin",
            "credentialKey",
            "mode",
            "signingPublicKey",
            "encryptionPublicKey",
            "salt"
          ],
          "additionalProperties": false
        },
        "envelope": {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "algorithm": {
              "type": "string",
              "const": "AES-256-GCM"
            },
            "iv": {
              "type": "string",
              "maxLength": 16
            },
            "ciphertext": {
              "type": "string",
              "maxLength": 16384
            }
          },
          "required": [
            "version",
            "algorithm",
            "iv",
            "ciphertext"
          ],
          "additionalProperties": false
        },
        "keyWrap": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "client"
                },
                "envelope": {
                  "type": "object",
                  "properties": {
                    "version": {
                      "type": "number",
                      "const": 1
                    },
                    "algorithm": {
                      "type": "string",
                      "const": "AES-256-GCM"
                    },
                    "iv": {
                      "type": "string",
                      "maxLength": 16
                    },
                    "ciphertext": {
                      "type": "string",
                      "maxLength": 64
                    }
                  },
                  "required": [
                    "version",
                    "algorithm",
                    "iv",
                    "ciphertext"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "kind",
                "envelope"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "service"
                },
                "ciphertext": {
                  "type": "string",
                  "maxLength": 8192,
                  "pattern": "^vault:v[1-9][0-9]*:[A-Za-z0-9+/]+={0,2}$"
                }
              },
              "required": [
                "kind",
                "ciphertext"
              ],
              "additionalProperties": false
            }
          ]
        }
      },
      "required": [
        "context",
        "envelope",
        "keyWrap"
      ],
      "additionalProperties": false
    },
    "keyGrant": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "version": {
              "type": "number",
              "const": 1
            },
            "ephemeralKey": {
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
            "salt": {
              "type": "string",
              "maxLength": 44
            },
            "envelope": {
              "type": "object",
              "properties": {
                "version": {
                  "type": "number",
                  "const": 1
                },
                "algorithm": {
                  "type": "string",
                  "const": "AES-256-GCM"
                },
                "iv": {
                  "type": "string",
                  "maxLength": 16
                },
                "ciphertext": {
                  "type": "string",
                  "maxLength": 64
                }
              },
              "required": [
                "version",
                "algorithm",
                "iv",
                "ciphertext"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "version",
            "ephemeralKey",
            "salt",
            "envelope"
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
    "backup",
    "keyGrant"
  ],
  "additionalProperties": false
}
```

## GET /v1/people/members

Guide: accounts.

No request body.

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "daoId": {
      "type": "string",
      "maxLength": 20
    },
    "after": {
      "type": "string",
      "maxLength": 20
    },
    "onlyDao": {
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
    "members": {
      "maxItems": 50,
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
          "active": {
            "type": "boolean"
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
          "profile": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
                  },
                  "fullName": {
                    "type": "string",
                    "maxLength": 80
                  },
                  "location": {
                    "type": "string",
                    "maxLength": 80
                  },
                  "email": {
                    "type": "string",
                    "maxLength": 254
                  },
                  "telegram": {
                    "type": "string",
                    "maxLength": 32
                  },
                  "introduction": {
                    "type": "string",
                    "maxLength": 2000
                  },
                  "motto": {
                    "type": "string",
                    "maxLength": 140
                  },
                  "facebook": {
                    "anyOf": [
                      {
                        "type": "string",
                        "const": ""
                      },
                      {
                        "type": "string",
                        "maxLength": 300,
                        "format": "uri"
                      }
                    ]
                  },
                  "instagram": {
                    "anyOf": [
                      {
                        "type": "string",
                        "const": ""
                      },
                      {
                        "type": "string",
                        "maxLength": 300,
                        "format": "uri"
                      }
                    ]
                  },
                  "youtube": {
                    "anyOf": [
                      {
                        "type": "string",
                        "const": ""
                      },
                      {
                        "type": "string",
                        "maxLength": 300,
                        "format": "uri"
                      }
                    ]
                  },
                  "linkedin": {
                    "anyOf": [
                      {
                        "type": "string",
                        "const": ""
                      },
                      {
                        "type": "string",
                        "maxLength": 300,
                        "format": "uri"
                      }
                    ]
                  },
                  "website": {
                    "anyOf": [
                      {
                        "type": "string",
                        "const": ""
                      },
                      {
                        "type": "string",
                        "maxLength": 300,
                        "format": "uri"
                      }
                    ]
                  },
                  "avatar": {
                    "anyOf": [
                      {
                        "type": "string",
                        "const": ""
                      },
                      {
                        "type": "string",
                        "maxLength": 128
                      }
                    ]
                  },
                  "background": {
                    "anyOf": [
                      {
                        "type": "string",
                        "const": ""
                      },
                      {
                        "type": "string",
                        "maxLength": 128
                      }
                    ]
                  }
                },
                "required": [
                  "name"
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
          "native_account",
          "active",
          "dao",
          "profile"
        ],
        "additionalProperties": false
      }
    },
    "next": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "daoId": {
              "type": "string",
              "maxLength": 20
            },
            "after": {
              "type": "string",
              "maxLength": 20
            }
          },
          "required": [
            "daoId",
            "after"
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
    "members",
    "next"
  ],
  "additionalProperties": false
}
```

## GET /v1/people

Guide: accounts.

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
    },
    "daoId": {
      "type": "string",
      "maxLength": 20
    },
    "memberId": {
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
    "profiles": {
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 20
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
          "memberId": {
            "type": "string",
            "maxLength": 20
          },
          "accountName": {
            "type": "string",
            "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
          },
          "profile": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "pattern": "^[a-z1-5][a-z1-5.]{0,12}$"
              },
              "fullName": {
                "type": "string",
                "maxLength": 80
              },
              "location": {
                "type": "string",
                "maxLength": 80
              },
              "email": {
                "type": "string",
                "maxLength": 254
              },
              "telegram": {
                "type": "string",
                "maxLength": 32
              },
              "introduction": {
                "type": "string",
                "maxLength": 2000
              },
              "motto": {
                "type": "string",
                "maxLength": 140
              },
              "facebook": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": ""
                  },
                  {
                    "type": "string",
                    "maxLength": 300,
                    "format": "uri"
                  }
                ]
              },
              "instagram": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": ""
                  },
                  {
                    "type": "string",
                    "maxLength": 300,
                    "format": "uri"
                  }
                ]
              },
              "youtube": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": ""
                  },
                  {
                    "type": "string",
                    "maxLength": 300,
                    "format": "uri"
                  }
                ]
              },
              "linkedin": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": ""
                  },
                  {
                    "type": "string",
                    "maxLength": 300,
                    "format": "uri"
                  }
                ]
              },
              "website": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": ""
                  },
                  {
                    "type": "string",
                    "maxLength": 300,
                    "format": "uri"
                  }
                ]
              },
              "avatar": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": ""
                  },
                  {
                    "type": "string",
                    "maxLength": 128
                  }
                ]
              },
              "background": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": ""
                  },
                  {
                    "type": "string",
                    "maxLength": 128
                  }
                ]
              }
            },
            "required": [
              "name"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "id",
          "dao",
          "memberId",
          "accountName",
          "profile"
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
    },
    "skipped": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "profiles",
    "next",
    "skipped"
  ],
  "additionalProperties": false
}
```

## GET /v1/storage/billing

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
    "currentPricing": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "freeBytes": {
              "type": "string",
              "maxLength": 20
            },
            "unitBytes": {
              "type": "string",
              "maxLength": 20
            },
            "monthlyUnitUsdCents": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99999999
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "freeBytes",
            "unitBytes",
            "monthlyUnitUsdCents"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "funding": {
      "type": "object",
      "properties": {
        "state": {
          "type": "string",
          "enum": [
            "free",
            "pending",
            "active",
            "grace",
            "overdue",
            "review"
          ]
        },
        "pricing": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "freeBytes": {
              "type": "string",
              "maxLength": 20
            },
            "unitBytes": {
              "type": "string",
              "maxLength": 20
            },
            "monthlyUnitUsdCents": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99999999
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "freeBytes",
            "unitBytes",
            "monthlyUnitUsdCents"
          ],
          "additionalProperties": false
        },
        "units": {
          "type": "integer",
          "minimum": 0,
          "maximum": 999999
        },
        "paidThrough": {
          "anyOf": [
            {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                },
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                }
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "graceEndsAt": {
          "anyOf": [
            {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                },
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                }
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "uploadCapacityBytes": {
          "type": "string",
          "maxLength": 20
        },
        "retainedCapacityBytes": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "state",
        "pricing",
        "units",
        "paidThrough",
        "graceEndsAt",
        "uploadCapacityBytes",
        "retainedCapacityBytes"
      ],
      "additionalProperties": false
    },
    "notices": {
      "default": [],
      "maxItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "stage": {
            "type": "string",
            "enum": [
              "renewal-due",
              "grace-started",
              "grace-ending",
              "hosting-ended",
              "billing-review"
            ]
          },
          "paidThrough": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
              },
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
              }
            ]
          },
          "graceEndsAt": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
              },
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
              }
            ]
          }
        },
        "required": [
          "stage",
          "paidThrough",
          "graceEndsAt"
        ],
        "additionalProperties": false
      }
    },
    "noticeDelivery": {
      "default": false,
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
            "pricing": {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "freeBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "unitBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "monthlyUnitUsdCents": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 99999999
                }
              },
              "required": [
                "schemaVersion",
                "revision",
                "freeBytes",
                "unitBytes",
                "monthlyUnitUsdCents"
              ],
              "additionalProperties": false
            },
            "units": {
              "type": "integer",
              "minimum": 0,
              "maximum": 999999
            },
            "monthlyUsdCents": {
              "type": "integer",
              "minimum": 0,
              "maximum": 99999999
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
            "pending": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "requestId": {
                      "type": "string",
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                    },
                    "pricing": {
                      "type": "object",
                      "properties": {
                        "schemaVersion": {
                          "type": "number",
                          "const": 1
                        },
                        "revision": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "freeBytes": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "unitBytes": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "monthlyUnitUsdCents": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 99999999
                        }
                      },
                      "required": [
                        "schemaVersion",
                        "revision",
                        "freeBytes",
                        "unitBytes",
                        "monthlyUnitUsdCents"
                      ],
                      "additionalProperties": false
                    },
                    "units": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 999999
                    },
                    "monthlyUsdCents": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 99999999
                    },
                    "effectiveAt": {
                      "anyOf": [
                        {
                          "anyOf": [
                            {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                            },
                            {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                            }
                          ]
                        },
                        {
                          "type": "null"
                        }
                      ]
                    }
                  },
                  "required": [
                    "requestId",
                    "pricing",
                    "units",
                    "monthlyUsdCents",
                    "effectiveAt"
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
            "pricing",
            "units",
            "monthlyUsdCents",
            "checkoutUrl",
            "invoiceUrl",
            "pending"
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
    "configured",
    "currentPricing",
    "funding",
    "notices",
    "noticeDelivery",
    "subscription"
  ],
  "additionalProperties": false
}
```

## POST /v1/storage/approve

Guide: providers.

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
    "units": {
      "type": "integer",
      "minimum": 0,
      "maximum": 999999
    },
    "pricingHash": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "monthlyUsdCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 99999999
    },
    "recurringConsent": {
      "type": "boolean"
    },
    "acceptCurrentPricing": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "schemaVersion",
    "requestId",
    "dao",
    "units",
    "pricingHash",
    "monthlyUsdCents",
    "recurringConsent"
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
    "currentPricing": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "freeBytes": {
              "type": "string",
              "maxLength": 20
            },
            "unitBytes": {
              "type": "string",
              "maxLength": 20
            },
            "monthlyUnitUsdCents": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99999999
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "freeBytes",
            "unitBytes",
            "monthlyUnitUsdCents"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "funding": {
      "type": "object",
      "properties": {
        "state": {
          "type": "string",
          "enum": [
            "free",
            "pending",
            "active",
            "grace",
            "overdue",
            "review"
          ]
        },
        "pricing": {
          "type": "object",
          "properties": {
            "schemaVersion": {
              "type": "number",
              "const": 1
            },
            "revision": {
              "type": "string",
              "maxLength": 20
            },
            "freeBytes": {
              "type": "string",
              "maxLength": 20
            },
            "unitBytes": {
              "type": "string",
              "maxLength": 20
            },
            "monthlyUnitUsdCents": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99999999
            }
          },
          "required": [
            "schemaVersion",
            "revision",
            "freeBytes",
            "unitBytes",
            "monthlyUnitUsdCents"
          ],
          "additionalProperties": false
        },
        "units": {
          "type": "integer",
          "minimum": 0,
          "maximum": 999999
        },
        "paidThrough": {
          "anyOf": [
            {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                },
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                }
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "graceEndsAt": {
          "anyOf": [
            {
              "anyOf": [
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                },
                {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                }
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "uploadCapacityBytes": {
          "type": "string",
          "maxLength": 20
        },
        "retainedCapacityBytes": {
          "type": "string",
          "maxLength": 20
        }
      },
      "required": [
        "state",
        "pricing",
        "units",
        "paidThrough",
        "graceEndsAt",
        "uploadCapacityBytes",
        "retainedCapacityBytes"
      ],
      "additionalProperties": false
    },
    "notices": {
      "default": [],
      "maxItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "stage": {
            "type": "string",
            "enum": [
              "renewal-due",
              "grace-started",
              "grace-ending",
              "hosting-ended",
              "billing-review"
            ]
          },
          "paidThrough": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
              },
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
              }
            ]
          },
          "graceEndsAt": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
              },
              {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
              }
            ]
          }
        },
        "required": [
          "stage",
          "paidThrough",
          "graceEndsAt"
        ],
        "additionalProperties": false
      }
    },
    "noticeDelivery": {
      "default": false,
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
            "pricing": {
              "type": "object",
              "properties": {
                "schemaVersion": {
                  "type": "number",
                  "const": 1
                },
                "revision": {
                  "type": "string",
                  "maxLength": 20
                },
                "freeBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "unitBytes": {
                  "type": "string",
                  "maxLength": 20
                },
                "monthlyUnitUsdCents": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 99999999
                }
              },
              "required": [
                "schemaVersion",
                "revision",
                "freeBytes",
                "unitBytes",
                "monthlyUnitUsdCents"
              ],
              "additionalProperties": false
            },
            "units": {
              "type": "integer",
              "minimum": 0,
              "maximum": 999999
            },
            "monthlyUsdCents": {
              "type": "integer",
              "minimum": 0,
              "maximum": 99999999
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
            "pending": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "requestId": {
                      "type": "string",
                      "format": "uuid",
                      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                    },
                    "pricing": {
                      "type": "object",
                      "properties": {
                        "schemaVersion": {
                          "type": "number",
                          "const": 1
                        },
                        "revision": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "freeBytes": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "unitBytes": {
                          "type": "string",
                          "maxLength": 20
                        },
                        "monthlyUnitUsdCents": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 99999999
                        }
                      },
                      "required": [
                        "schemaVersion",
                        "revision",
                        "freeBytes",
                        "unitBytes",
                        "monthlyUnitUsdCents"
                      ],
                      "additionalProperties": false
                    },
                    "units": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 999999
                    },
                    "monthlyUsdCents": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 99999999
                    },
                    "effectiveAt": {
                      "anyOf": [
                        {
                          "anyOf": [
                            {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:Z))$"
                            },
                            {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}(?:Z))$"
                            }
                          ]
                        },
                        {
                          "type": "null"
                        }
                      ]
                    }
                  },
                  "required": [
                    "requestId",
                    "pricing",
                    "units",
                    "monthlyUsdCents",
                    "effectiveAt"
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
            "pricing",
            "units",
            "monthlyUsdCents",
            "checkoutUrl",
            "invoiceUrl",
            "pending"
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
    "configured",
    "currentPricing",
    "funding",
    "notices",
    "noticeDelivery",
    "subscription"
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
        "/v1/resources/ram/card/checkout",
        "/v1/hosting/change",
        "/v1/storage/approve",
        "/v1/payments/onboard",
        "/v1/payments/product",
        "/v1/payments/refund",
        "/v1/payments/operator",
        "/v1/payments/operator/revoke",
        "/v1/account/vault",
        "/v1/account/recovery/enable",
        "/v1/account/recovery/assisted/options",
        "/v1/account/recovery/disable",
        "/v1/account/recovery/device/approve",
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

Query:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "listingsCursor": {
      "type": "string",
      "maxLength": 20
    },
    "suffixesCursor": {
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
    "contract": {
      "default": null,
      "type": [
        "string",
        "null"
      ]
    },
    "tokenContract": {
      "default": null,
      "type": [
        "string",
        "null"
      ]
    },
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
    "listingsNext": {
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
    },
    "suffixesNext": {
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
    "contract",
    "tokenContract",
    "configured",
    "reason",
    "cardPayments",
    "thirdPartyBps",
    "firstPartyBps",
    "treasury",
    "tiers",
    "listings",
    "suffixes",
    "listingsNext",
    "suffixesNext",
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
    },
    "profile": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "const": "Daxi"
        },
        "scope": {
          "type": "array",
          "prefixItems": [
            {
              "type": "string",
              "const": "Daclify"
            },
            {
              "type": "string",
              "const": "Telos"
            },
            {
              "type": "string",
              "const": "DAOs"
            }
          ],
          "items": false,
          "minItems": 3,
          "maxItems": 3
        },
        "answerModel": {
          "type": [
            "string",
            "null"
          ]
        },
        "decisionsModel": {
          "type": [
            "string",
            "null"
          ]
        },
        "knowledgeVersion": {
          "type": "string"
        }
      },
      "required": [
        "name",
        "scope",
        "answerModel",
        "decisionsModel",
        "knowledgeVersion"
      ],
      "additionalProperties": false
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
