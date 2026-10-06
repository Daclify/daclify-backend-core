// Generated from producer-owned guides, compiled ABI and API schemas.
import type {HelpBundle} from '../docs.js';
export const CoreHelpBundle={
  "producer": "core",
  "packageVersion": "0.3.0-alpha.1",
  "interfaceVersion": 1,
  "topics": [
    {
      "id": "privacy",
      "title": "What encryption protects",
      "paragraphs": [
        "Private DAO documents are encrypted in the browser before they reach Pinata or the public IPFS network. Signing and document decryption use separate keys.",
        "Memberships, voting activity, outcomes, balances, timing, and content hashes remain visible on a public blockchain. This release does not provide anonymous governance.",
        "Removing a member rotates the key for future content. It cannot erase plaintext or old keys the member already kept. Re-pinning preserves ciphertext, not confidentiality after a key compromise."
      ]
    },
    {
      "id": "accounts",
      "title": "Two clearly labelled account modes",
      "paragraphs": [
        "User-controlled accounts keep encrypted signing and decryption keys in your browser. Recovery requires an encrypted kit and a separate recovery credential. Social login alone cannot recover these keys.",
        "Managed recovery delegates signing and decryption recovery to an operator. OpenBao is the tested open-source candidate; production use requires an isolated custody service, audit logs, access controls, and tested recovery.",
        "An internal account does not need a native account. Linking a native account requires proof from that account and preserves your DAO member identity."
      ]
    },
    {
      "id": "deployments",
      "title": "Shared or independent deployment",
      "paragraphs": [
        "Shared DAOs have separate scopes in a common runtime. The operator controls contract upgrades and on-chain authority; member permissions do not remove this operator trust.",
        "Independent DAOs deploy and administer their own Antelope C++ runtime and compatible modules. Their owner controls upgrade keys, resource funding, and deployment permissions.",
        "The hub lists deployments and advertised interface versions. A listing is not a security audit, code endorsement, or transfer of governance authority."
      ]
    },
    {
      "id": "modules",
      "title": "Configure modules, keep core rights",
      "paragraphs": [
        "Module manifests declare version compatibility, configuration schemas, permissions, and contextual help. A DAO must explicitly grant contract capabilities.",
        "Decide provides governance ballots. Works provides proposals, milestones, and review. Payroll schedules bounded payment obligations. Contract authorization remains the source of truth.",
        "Core governance is free. Operations tiers may charge for optional integrations, automation, or resource capacity. Expiry must not block approved liabilities, withdrawals, exports, or key recovery."
      ]
    },
    {
      "id": "treasury",
      "title": "Treasury and backed obligations",
      "paragraphs": [
        "A native asset is identified by chain, token contract, symbol, and precision. Matching a symbol alone is insufficient.",
        "Funds move from available to reserved when an obligation is created. Review approves it. Settlement either transfers native tokens or credits a backed internal claim.",
        "Approved liabilities remain payable after module removal or subscription expiry. Offboarded members retain financial exit rights. Internal governance credits are not redeemable treasury balances.",
        "The treasury view shows reserved, approved, settled and cancelled obligations. A signed-in user can request settlement of an already approved, due obligation; the contract chooses its recorded recipient and amount. This does not require reinstalling the source module. Existing internal claims and governance stake can be withdrawn through a signed instruction to an existing native payout account.",
        "An administrator can record one DAO-confirmed external payment statement with a signed instruction. It names the chain, payer and reference, and it must repeat the approved obligation’s recipient and exact asset amount. Reusing that reference for another obligation is rejected. The record does not move a balance, mark the obligation paid, or block later native settlement. Attested and contract-verified external settlement are separate and are not implemented. A direct runtime key cannot create this record.",
        "This release supports one configured native treasury asset per DAO. Governance stake deposits currently require the member’s linked native account and the stake memo shown in the treasury. Walletless members can use internal governance credits. Claim-to-stake conversion and multi-asset treasury accounting are not implemented."
      ]
    },
    {
      "id": "providers",
      "title": "Configure external services",
      "paragraphs": [
        "Pinata credentials stay on the backend. Upload limits, quotas, replay protection, and content checks run before a reference is published. No Pinata account is configured in the current local fixture.",
        "Google requires an OAuth client and exact redirect origin. Validate issuer, audience, nonce, expiry, signature, and the immutable subject identifier. Never merge accounts by matching email. Linking requires the current session. A provider session identifies the linked account and does not unwrap a user-controlled vault.",
        "Telegram Mini Apps require a configured bot. The backend validates signed initialization data and freshness. A Telegram identity alone does not decrypt a user-controlled vault.",
        "Configured hosted storage runs a bounded reconciliation worker using PostgreSQL leases. Uncertain or duplicate provider results retain their allocated budget and can require operator review. Automated unpinning, retention guarantees and measured paid allowances are not offered by this development release."
      ]
    },
    {
      "id": "recovery",
      "title": "Recover without changing identity",
      "paragraphs": [
        "Keep your encrypted recovery kit and separate credential in different safe places. The kit contains ciphertext and public keys, never plaintext signing keys.",
        "Recovery restores the same signing and decryption identities on a fresh device. Rotating a signing key is a separate authorized on-chain process; it must preserve balances and memberships.",
        "Managed recovery is explicitly operator-assisted. Production availability depends on verified custody access policies and restore procedures."
      ]
    },
    {
      "id": "documents",
      "title": "Documents that survive transaction history gaps",
      "paragraphs": [
        "Small JSON documents are stored directly in contract tables. Larger files use immutable IPFS CIDs and a separate SHA-256 commitment of retrieved bytes. Document IDs have contiguous, permanent version histories.",
        "The 4096-byte inline limit includes the complete stored JSON. For private content it includes the encrypted envelope, so the available plaintext space is smaller. Members can create documents; only their author or an administrator can publish later versions.",
        "Hosted file uploads have a 5 MiB stored-byte limit and use a bounded backend path with an explicit storage allowance. Private filenames and file contents are encrypted before upload; encoding reduces the maximum original size. Upload and verify the file, then sign its permanent contract record. Keep the request ID to resume after a reload or lost response. The backend retrieves the stored bytes and checks their separate SHA-256 commitment; a matching CID or on-chain record alone does not establish byte verification.",
        "Private documents use a committed key for each DAO epoch. Initialization stores the commitment and the creator’s encrypted grant atomically. An administrator can grant that epoch to admitted members. Different recipients, DAO deployments and document versions have distinct encryption domains.",
        "Changing membership or rotating an epoch protects future content after the next key is initialized. Old grants and disclosed plaintext remain accessible to anyone who kept the old key. A client checks content integrity and the epoch commitment before decryption.",
        "Download checks the recorded byte count and commitment before opening a file. A private download also checks the DAO epoch commitment and decrypts in your browser. Previous file versions remain downloadable from version history. A saved plaintext download is not erased when your vault locks. The local disk fixture is labelled explicitly and does not establish live Pinata or public IPFS availability."
      ]
    },
    {
      "id": "members",
      "title": "Stable members, explicit roles",
      "paragraphs": [
        "Each DAO records internal members with separate signing and encryption keys. A linked native account is a credential of the existing member rather than a second voting identity.",
        "Administrators assign administrator and reviewer roles. The final active administrator cannot be demoted or removed. Reviewers can review contributions within the Works policy; contribution authors cannot approve their own work.",
        "Governance credits are nontransferable units. Their issuance and removal require DAO authority and stop while an active ballot has locked weights. Removing access preserves recorded balances and accepted payment rights.",
        "Encrypted DAOs rotate the future-content epoch when a member is deactivated. Remaining authorized members need grants for the new committed key. Deactivation cannot revoke earlier keys or erase exported history."
      ]
    },
    {
      "id": "service-payment",
      "title": "Pay for a hosted service",
      "paragraphs": [
        "A card payment uses Stripe Checkout at the price configured for this service. The application does not ask you to type an amount. Returning from the card page does not by itself record the payment. The service records a receipt only after Stripe reports that the checkout was paid.",
        "That receipt belongs to the signed-in account. It does not change votes, permissions, withdrawals, treasury obligations, or the storage allowance. Basic governance stays free.",
        "A TLOS payment for the same hosted service is quoted from the Delphi tlosusd median plus 20 percent and is paid to the billing account. Extra TLOS is a tip. The chain watcher that would match that transfer to an account is not part of this release, so a TLOS transfer does not create the card receipt and does not change DAO rights."
      ]
    },
    {
      "id": "dao-presets",
      "title": "Choose a DAO purpose without changing its identity model",
      "paragraphs": [
        "Community, NGO / grants, gaming guild, team / cooperative and custom presets configure initial modules and a resolved governance snapshot. Human, mixed and guarded-agent participation are independent choices. Presets do not establish legal or charitable status, implement a game engine, or verify operator independence.",
        "Creation installs the required reviewed modules and governance policy atomically. It refuses missing deployments or mismatched module code. A new preset version never changes an existing DAO automatically. Existing schema-1 metadata stays readable; schema 2 records purpose, preset version, participant mode and initial settings.",
        "All ballots use the saved weight, duration, quorum and approval. Credit or stake voting needs eligible balances before opening. Governance credits are not money. Treasury token, document privacy and deployment choice remain separate.",
        "Administrators retain admission, role, credit, module and policy powers. Native DAO ownership and contract upgrade authority remain separate and can bypass application rules. Review who controls those native accounts; a guardian that also owns the DAO has additional owner powers. Independent deployment is still prepared through the deployment kit, not one-click provisioning.",
        "Purpose labels and basic presets are free. Hosted service billing does not authorise governance. Private documents can be encrypted, but DAO identity, purpose, memberships, votes, balances and transaction metadata remain public."
      ]
    },
    {
      "id": "dao-governance",
      "title": "Saved ballot policy, budgets and funding authority",
      "paragraphs": [
        "The contract stores a policy revision, participant mode, configured Decide deployment, exact ballot settings, governed Works funding flag, guardian account and commitment limits. These fields enforce rules; descriptive metadata cannot authorise an action.",
        "The maximum applies to each milestone or payroll installment when reserved. The daily maximum counts newly reserved amounts in the UTC chain day. It is a commitment budget, not a limit on payments due that day. Cancelled commitments do not replenish the daily allowance. Zero disables a limit in human or mixed DAOs; guarded-agent DAOs require both limits.",
        "An administrator can edit ballot settings and commitment limits through a signed instruction only when no ballot is active. The revision advances and pending funding plans from an older revision become unexecutable; open a new vote. Participant mode, guardian identity and Decide account cannot be silently replaced through this action.",
        "A guardian pause blocks new reservations, approvals, obligation payments and ordinary agent instructions. Each pause instruction lasts at most 24 hours and can be renewed. Existing obligations remain recorded and settle after expiry. Already assigned claims and stake retain withdrawal paths unless the agent credential itself is revoked. Subscription expiry is separate from an emergency pause.",
        "Legacy DAOs have no policy until an explicit signed administrator adoption. The old DAO, member, ballot, project and milestone table layouts remain unchanged; policies and agent/credential state use additional tables. Supported upgrade paths need old-row serialization checks and real native permission links."
      ]
    },
    {
      "id": "agents",
      "title": "Registered agents and disclosed human emergency controls",
      "paragraphs": [
        "An agent is a declared participant with a signing key and separate encryption public key. The chain verifies credentials, not whether a model or a human chose an action. Operator labels are declarations; multiple keys do not prove multiple independent operators. Admission and voting allocation must address this trust assumption.",
        "Agent-only creation enrolls the supplied agent public identity as first administrator. The human sponsor does not receive a membership. The guardian is a native account outside ordinary voting membership; configuring it does not give it document keys. Native ownership and upgrade powers must still be reviewed.",
        "Root signing credentials retain member and administrator authority. Delegate routine work to action-scoped keys: up to 16 stored credentials per member, up to 16 target/action permissions per credential, and a maximum seven-day expiry. Delete expired or revoked entries to free slots. Module permissions pin the installed module code. Scoped credentials cannot administer policies or members, spend claims, or delegate further authority.",
        "Submit scoped requests through submitsess or the relay API with session_id. Root requests use submit. Both share the member nonce, signed DAO/chain/runtime/action domain and short instruction expiry. Login by a scoped key does not turn it into a root member or grant decryption access.",
        "Scoped voting can authorise funding and a Works review scope can make an already funded obligation payable when the member is an authorised reviewer. The publishing credential offered here grants neither permission. Treat every delegated permission as authority, not merely an API convenience.",
        "Guardians can revoke an agent and recover its signing identity. Recovery can impersonate the recovered agent. It invalidates earlier delegated credentials and clears the native-account binding, while preserving member identity, credits, claims, stake and encryption keys. It cannot recover old encrypted content without the required decryption credentials. Signing-key rotation also invalidates existing scoped credentials.",
        "On-chain signing recovery does not migrate an old HTTP account, social-provider links or a protected signer's configuration. Authenticate the replacement signer separately and retain the existing document decryption credentials.",
        "Keep keys in a protected signer, not model prompts or logs. Encryption before IPFS publication does not protect plaintext later sent to a model provider. This release is provider-neutral and does not include LLM hosting, operator-independence verification or a qualified production custody service. The SDK example publishes a supplied public JSON document, not an autonomous decision engine."
      ]
    },
    {
      "id": "marketplace",
      "title": "Module catalogue and Telos names",
      "paragraphs": [
        "Modules that a DAO can turn on are listed in the runtime catalogue. A listing is stored only when it accepts the platform fee rule. A DAO cannot enable a module that is missing from that catalogue or whose code no longer matches the listing.",
        "A first-party module is published by the platform treasury. Its usage charge, when one is set, is kept at the first-party rate stored in the runtime fee configuration. A third-party module is published by someone else. Its usage charge pays the platform the third-party rate in that same configuration, and the rest goes to the publisher. The rate can be changed later. The next payment uses the rate that is current, not the rate from the day the module was listed.",
        "The Telos nameservice sells new native accounts from its own contract. A 12-character name without a dot uses the basic tier. Its dollar price is stored on chain. When a TLOS conversion rate is stored beside it, the TLOS price is that dollar amount converted at the rate plus the quote premium. The account is created with the CPU, NET, and RAM stored on that tier. A name that contains a dot can be sold only when the longest suffix is connected. The suffix owner sets the price in TLOS or dollars with regsuffix. Each sale raises that price by the bump rate, and the platform keeps the third-party rate. A shorter name without a dot uses the premium tier. Someone can still list one exact name with regname. Prices, suffixes, fee rates, and completed sales stay on chain, so a new server can read them after the application database is gone. A Daclify DAO admin changes the platform cut, the bump, and the quote premium with govfees after the runtime links that DAO. Until then the runtime account can change them.",
        "Card checkout uses the dollar amount stored on chain for that name. The browser creates the new account keys and does not send the private keys to the server. After the card payment is confirmed, the names contract records the sale and creates the account. A card session that never reaches the chain remains with the card processor. Returning from the card page does not by itself create the account. If the on-chain price changes before confirmation, the account is not created."
      ]
    },
    {
      "id": "creation-fees",
      "title": "DAO creation fees and payment",
      "paragraphs": [
        "Shared DAO setup costs $20 USD. Independent setup costs $50 USD plus blockchain RAM, CPU, NET and native account costs charged separately. These are initial defaults; the linked Daclify DAO administrators can change the on-chain policy. Core governance remains free after setup; optional modules and hosted services have their own charges.",
        "TLOS quotes convert the USD setup fee using a fresh on-chain USD-per-TLOS rate and a 20% premium, rounded up to four decimals. Each quote expires in 15 minutes. Send the exact amount to the displayed runtime using the displayed create: memo and token contract. Overpayments and expired quotes are rejected atomically. The operator publishes the conversion observations and is trusted for their accuracy.",
        "Card checkout captures the order price in USD. Only a signed Stripe webhook for the stored checkout, account, currency and amount can attest payment. Returning from checkout is not payment proof. The native settler is trusted for off-chain card settlement. Hosted-service receipts cannot pay a DAO setup fee.",
        "Orders are bound to the signed-in account and immutable setup. Check and resume an existing order after a lost response; paid orders create at most one shared DAO. Creation, initial governance, enrollment and module installation run in one transaction, so a failed setup leaves the paid order available to retry. Keep the order ID for support. Refunds and chargebacks require operator handling.",
        "Independent self-service provisioning is unavailable. The application displays its setup price but refuses checkout until a provisioner and blockchain resource quote exist. Use the reviewed deployment kit; do not send a shared setup payment for an independent deployment.",
        "Before enabling paid creation, a native operator configures setfees and setcreate (2000 shared USD cents, 5000 independent USD cents, 2000 premium basis points, relay settler), verifies the fee treasury and installs callback permission links. Bootstrap the platform DAO before setting creation fees, or create it with a paid order. Link it with setgov. setcrrate requires a fresh positive observation and native runtime authority. npm run price:tlos -- testnet --creation-rate reads Delphi and prints an unsigned update for review; it sends no transaction. Arrange operator updates often enough that observations remain less than 15 minutes old. A stale or future observation refuses new TLOS quotes.",
        "API clients prepare with POST /v1/dao-orders, read GET /v1/dao-orders/:id, start card checkout with POST /v1/dao-orders/:id/checkout and create/reconcile with POST /v1/dao-orders/:id/fulfill. The former POST /v1/daos free-creation endpoint now returns HTTP 409 CREATION_PAYMENT_REQUIRED and never creates a DAO. Update clients to the paid order flow."
      ]
    },
    {
      "id": "platform",
      "title": "Daclify DAO and platform status",
      "paragraphs": [
        "The Daclify DAO page reads the platform DAO reference from the runtime market configuration. A native operator first creates and enrolls that DAO and links it with setgov. Before that link, the page reports that platform governance is unconfigured. It does not guess a DAO by its name.",
        "Active administrators of the linked DAO can sign creation fee and settler changes, commission and names policy changes, first-party module registration, catalogue removal and first-party module descriptions. These are administrator actions, not automatic execution of a member ballot. Use the DAO workspace for proposals, voting, members and treasury. Native upgrade, fee treasury and oracle authorities remain with the operator.",
        "Module registration checks the on-chain code hash, accepted fee rule and asset identity. Removing a catalogue entry prevents new installations but does not erase existing DAO installations, pending work or financial exit rights. Publishers retain control over their third-party listings and prices.",
        "Status displays the selected network, actual chain ID and head blocks, runtime and module hashes, public permission authorities, resources, on-chain fee and governance configuration, database migrations and safe provider configuration flags. Missing services are labelled unconfigured. Module hash checks verify the pinned SDK artifact; unpinned runtime and hub hashes are displayed without claiming they are verified.",
        "Configured providers are not evidence of successful live integration or a qualified production release. Pinata, Stripe, Google, Telegram and managed recovery require their own configuration and acceptance checks. Public status excludes credentials, private keys, DSNs, account records and raw internal errors."
      ]
    }
  ],
  "schemaVersion": 1,
  "contracts": [
    {
      "name": "runtime",
      "abiVersion": "eosio::abi/1.2",
      "sourceAbiHash": "3a68bd2f500e84f7662487a9e452ef408c60ccef392f33239e5252c4673c4b14",
      "actions": [
        {
          "name": "addmember",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "signing_key",
              "type": "public_key"
            },
            {
              "name": "encryption_key",
              "type": "string"
            },
            {
              "name": "custody",
              "type": "uint8"
            },
            {
              "name": "kind",
              "type": "uint8"
            },
            {
              "name": "operator_label",
              "type": "string"
            }
          ]
        },
        {
          "name": "addsession",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "session_id",
              "type": "uint64"
            },
            {
              "name": "signing_key",
              "type": "public_key"
            },
            {
              "name": "expires",
              "type": "uint32"
            },
            {
              "name": "permissions",
              "type": "session_permission[]"
            }
          ]
        },
        {
          "name": "approveob",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "source",
              "type": "name"
            },
            {
              "name": "source_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "cancelob",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "source",
              "type": "name"
            },
            {
              "name": "source_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "cardcreate",
          "fields": [
            {
              "name": "reference",
              "type": "checksum256"
            },
            {
              "name": "usd_cents",
              "type": "uint32"
            },
            {
              "name": "checkout_reference",
              "type": "checksum256"
            },
            {
              "name": "paid_at",
              "type": "uint32"
            }
          ]
        },
        {
          "name": "commitepoch",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "epoch",
              "type": "uint64"
            },
            {
              "name": "commitment",
              "type": "checksum256"
            },
            {
              "name": "self_grant",
              "type": "string"
            }
          ]
        },
        {
          "name": "confirmext",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "obligation_id",
              "type": "uint64"
            },
            {
              "name": "chain",
              "type": "string"
            },
            {
              "name": "payer",
              "type": "string"
            },
            {
              "name": "recipient",
              "type": "uint64"
            },
            {
              "name": "quantity",
              "type": "asset"
            },
            {
              "name": "reference",
              "type": "checksum256"
            }
          ]
        },
        {
          "name": "createdao",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "owner",
              "type": "name"
            },
            {
              "name": "metadata",
              "type": "string"
            },
            {
              "name": "privacy",
              "type": "uint8"
            },
            {
              "name": "token_contract",
              "type": "name"
            },
            {
              "name": "token_symbol",
              "type": "symbol"
            }
          ]
        },
        {
          "name": "createpaid",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "owner",
              "type": "name"
            },
            {
              "name": "metadata",
              "type": "string"
            },
            {
              "name": "privacy",
              "type": "uint8"
            },
            {
              "name": "token_contract",
              "type": "name"
            },
            {
              "name": "token_symbol",
              "type": "symbol"
            },
            {
              "name": "reference",
              "type": "checksum256"
            },
            {
              "name": "creator",
              "type": "public_key"
            }
          ]
        },
        {
          "name": "delsession",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "session_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "enroll",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "native_account",
              "type": "name"
            },
            {
              "name": "signing_key",
              "type": "public_key"
            },
            {
              "name": "encryption_key",
              "type": "string"
            },
            {
              "name": "custody",
              "type": "uint8"
            }
          ]
        },
        {
          "name": "enrollagent",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "native_account",
              "type": "name"
            },
            {
              "name": "signing_key",
              "type": "public_key"
            },
            {
              "name": "encryption_key",
              "type": "string"
            },
            {
              "name": "custody",
              "type": "uint8"
            },
            {
              "name": "operator_label",
              "type": "string"
            }
          ]
        },
        {
          "name": "govcreate",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "shared_usd",
              "type": "uint32"
            },
            {
              "name": "independent_usd",
              "type": "uint32"
            },
            {
              "name": "premium_bps",
              "type": "uint16"
            },
            {
              "name": "settler",
              "type": "name"
            }
          ]
        },
        {
          "name": "govfees",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "third_party_bps",
              "type": "uint16"
            },
            {
              "name": "first_party_bps",
              "type": "uint16"
            },
            {
              "name": "bump_bps",
              "type": "uint16"
            },
            {
              "name": "quote_premium_bps",
              "type": "uint16"
            }
          ]
        },
        {
          "name": "govlist",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "price",
              "type": "asset"
            },
            {
              "name": "code_hash",
              "type": "checksum256"
            },
            {
              "name": "title",
              "type": "string"
            }
          ]
        },
        {
          "name": "govlock",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "source",
              "type": "name"
            },
            {
              "name": "source_id",
              "type": "uint64"
            },
            {
              "name": "expires",
              "type": "uint32"
            }
          ]
        },
        {
          "name": "govmodcopy",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "summary",
              "type": "string"
            },
            {
              "name": "detail",
              "type": "string"
            }
          ]
        },
        {
          "name": "govunlist",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "account",
              "type": "name"
            }
          ]
        },
        {
          "name": "govunlock",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "source",
              "type": "name"
            },
            {
              "name": "source_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "grantcredit",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "quantity",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "grantkey",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "recipient",
              "type": "uint64"
            },
            {
              "name": "epoch",
              "type": "uint64"
            },
            {
              "name": "envelope",
              "type": "string"
            }
          ]
        },
        {
          "name": "guardpause",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "until",
              "type": "uint32"
            },
            {
              "name": "reason",
              "type": "checksum256"
            }
          ]
        },
        {
          "name": "guardrecover",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "signing_key",
              "type": "public_key"
            }
          ]
        },
        {
          "name": "guardrevoke",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "init",
          "fields": [
            {
              "name": "chain_id",
              "type": "checksum256"
            }
          ]
        },
        {
          "name": "initgov",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "settings",
              "type": "gov_settings"
            }
          ]
        },
        {
          "name": "linknative",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "account",
              "type": "name"
            }
          ]
        },
        {
          "name": "listmod",
          "fields": [
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "publisher",
              "type": "name"
            },
            {
              "name": "party",
              "type": "uint8"
            },
            {
              "name": "accepts_fee_rule",
              "type": "uint8"
            },
            {
              "name": "price",
              "type": "asset"
            },
            {
              "name": "code_hash",
              "type": "checksum256"
            },
            {
              "name": "title",
              "type": "string"
            }
          ]
        },
        {
          "name": "modconfig",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "version",
              "type": "uint16"
            },
            {
              "name": "actions",
              "type": "name[]"
            },
            {
              "name": "grants",
              "type": "name[]"
            },
            {
              "name": "code_hash",
              "type": "checksum256"
            }
          ]
        },
        {
          "name": "ordercreate",
          "fields": [
            {
              "name": "reference",
              "type": "checksum256"
            },
            {
              "name": "creator",
              "type": "public_key"
            },
            {
              "name": "deployment",
              "type": "uint8"
            },
            {
              "name": "method",
              "type": "uint8"
            }
          ]
        },
        {
          "name": "payob",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "source",
              "type": "name"
            },
            {
              "name": "source_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "putdoc",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "document_id",
              "type": "uint64"
            },
            {
              "name": "version",
              "type": "uint32"
            },
            {
              "name": "cid",
              "type": "string"
            },
            {
              "name": "metadata",
              "type": "string"
            },
            {
              "name": "commitment",
              "type": "checksum256"
            },
            {
              "name": "bytes",
              "type": "uint32"
            },
            {
              "name": "envelope_version",
              "type": "uint16"
            },
            {
              "name": "key_epoch",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "putjson",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "document_id",
              "type": "uint64"
            },
            {
              "name": "version",
              "type": "uint32"
            },
            {
              "name": "value",
              "type": "string"
            },
            {
              "name": "envelope_version",
              "type": "uint16"
            },
            {
              "name": "key_epoch",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "reserve",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "source",
              "type": "name"
            },
            {
              "name": "source_id",
              "type": "uint64"
            },
            {
              "name": "recipient",
              "type": "uint64"
            },
            {
              "name": "quantity",
              "type": "asset"
            },
            {
              "name": "due",
              "type": "uint32"
            }
          ]
        },
        {
          "name": "rotateepoch",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "rotatekey",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "signing_key",
              "type": "public_key"
            }
          ]
        },
        {
          "name": "setactive",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "target",
              "type": "uint64"
            },
            {
              "name": "active",
              "type": "bool"
            }
          ]
        },
        {
          "name": "setcreate",
          "fields": [
            {
              "name": "shared_usd",
              "type": "uint32"
            },
            {
              "name": "independent_usd",
              "type": "uint32"
            },
            {
              "name": "premium_bps",
              "type": "uint16"
            },
            {
              "name": "settler",
              "type": "name"
            }
          ]
        },
        {
          "name": "setcredits",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "target",
              "type": "uint64"
            },
            {
              "name": "quantity",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "setcrrate",
          "fields": [
            {
              "name": "median",
              "type": "uint64"
            },
            {
              "name": "precision",
              "type": "uint8"
            },
            {
              "name": "observed_at",
              "type": "uint32"
            }
          ]
        },
        {
          "name": "setdaogov",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "settings",
              "type": "gov_settings"
            }
          ]
        },
        {
          "name": "setfees",
          "fields": [
            {
              "name": "third_party_bps",
              "type": "uint16"
            },
            {
              "name": "first_party_bps",
              "type": "uint16"
            },
            {
              "name": "treasury",
              "type": "name"
            },
            {
              "name": "token_contract",
              "type": "name"
            },
            {
              "name": "token_symbol",
              "type": "symbol"
            },
            {
              "name": "names",
              "type": "name"
            }
          ]
        },
        {
          "name": "setgov",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "setmeta",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "metadata",
              "type": "string"
            }
          ]
        },
        {
          "name": "setmodcopy",
          "fields": [
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "summary",
              "type": "string"
            },
            {
              "name": "detail",
              "type": "string"
            }
          ]
        },
        {
          "name": "setmodule",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "version",
              "type": "uint16"
            },
            {
              "name": "actions",
              "type": "name[]"
            },
            {
              "name": "grants",
              "type": "name[]"
            },
            {
              "name": "code_hash",
              "type": "checksum256"
            }
          ]
        },
        {
          "name": "setoracle",
          "fields": [
            {
              "name": "median",
              "type": "uint64"
            },
            {
              "name": "quoted_precision",
              "type": "uint8"
            },
            {
              "name": "observed_at",
              "type": "uint32"
            }
          ]
        },
        {
          "name": "setpolicy",
          "fields": [
            {
              "name": "bump_bps",
              "type": "uint16"
            },
            {
              "name": "quote_premium_bps",
              "type": "uint16"
            }
          ]
        },
        {
          "name": "setprofile",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "account_name",
              "type": "name"
            },
            {
              "name": "profile",
              "type": "string"
            }
          ]
        },
        {
          "name": "setroles",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "target",
              "type": "uint64"
            },
            {
              "name": "admin",
              "type": "bool"
            },
            {
              "name": "reviewer",
              "type": "bool"
            }
          ]
        },
        {
          "name": "submit",
          "fields": [
            {
              "name": "request",
              "type": "instruction"
            },
            {
              "name": "sig",
              "type": "signature"
            }
          ]
        },
        {
          "name": "submitnat",
          "fields": [
            {
              "name": "request",
              "type": "instruction"
            }
          ]
        },
        {
          "name": "submitsess",
          "fields": [
            {
              "name": "request",
              "type": "instruction"
            },
            {
              "name": "session_id",
              "type": "uint64"
            },
            {
              "name": "sig",
              "type": "signature"
            }
          ]
        },
        {
          "name": "unlistmod",
          "fields": [
            {
              "name": "account",
              "type": "name"
            }
          ]
        },
        {
          "name": "unstake",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "destination",
              "type": "name"
            },
            {
              "name": "quantity",
              "type": "asset"
            }
          ]
        },
        {
          "name": "withdraw",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "destination",
              "type": "name"
            },
            {
              "name": "quantity",
              "type": "asset"
            }
          ]
        }
      ],
      "tables": [
        {
          "name": "actors",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "kind",
              "type": "uint8"
            },
            {
              "name": "operator_label",
              "type": "string"
            },
            {
              "name": "revoked",
              "type": "bool"
            },
            {
              "name": "credential_epoch",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "budgets",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "day",
              "type": "uint32"
            },
            {
              "name": "committed",
              "type": "int64"
            }
          ]
        },
        {
          "name": "catalogue",
          "fields": [
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "publisher",
              "type": "name"
            },
            {
              "name": "party",
              "type": "uint8"
            },
            {
              "name": "complies",
              "type": "uint8"
            },
            {
              "name": "price",
              "type": "asset"
            },
            {
              "name": "code_hash",
              "type": "checksum256"
            },
            {
              "name": "title",
              "type": "string"
            }
          ]
        },
        {
          "name": "createcfg",
          "fields": [
            {
              "name": "shared_usd",
              "type": "uint32"
            },
            {
              "name": "independent_usd",
              "type": "uint32"
            },
            {
              "name": "premium_bps",
              "type": "uint16"
            },
            {
              "name": "settler",
              "type": "name"
            },
            {
              "name": "median",
              "type": "uint64"
            },
            {
              "name": "precision",
              "type": "uint8"
            },
            {
              "name": "observed_at",
              "type": "uint32"
            }
          ]
        },
        {
          "name": "createords",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "reference",
              "type": "checksum256"
            },
            {
              "name": "creator",
              "type": "public_key"
            },
            {
              "name": "deployment",
              "type": "uint8"
            },
            {
              "name": "method",
              "type": "uint8"
            },
            {
              "name": "usd_cents",
              "type": "uint32"
            },
            {
              "name": "tlos_due",
              "type": "asset"
            },
            {
              "name": "created_at",
              "type": "uint32"
            },
            {
              "name": "expires",
              "type": "uint32"
            },
            {
              "name": "paid",
              "type": "bool"
            },
            {
              "name": "used",
              "type": "bool"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "card_reference",
              "type": "checksum256"
            }
          ]
        },
        {
          "name": "daos",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "owner",
              "type": "name"
            },
            {
              "name": "metadata",
              "type": "string"
            },
            {
              "name": "privacy",
              "type": "uint8"
            },
            {
              "name": "token_contract",
              "type": "name"
            },
            {
              "name": "token_symbol",
              "type": "symbol"
            },
            {
              "name": "credit_supply",
              "type": "uint64"
            },
            {
              "name": "member_count",
              "type": "uint64"
            },
            {
              "name": "max_member",
              "type": "uint64"
            },
            {
              "name": "active_ballots",
              "type": "uint32"
            },
            {
              "name": "available",
              "type": "int64"
            },
            {
              "name": "reserved",
              "type": "int64"
            },
            {
              "name": "claims",
              "type": "int64"
            },
            {
              "name": "staked",
              "type": "int64"
            },
            {
              "name": "eligible_credits",
              "type": "uint64"
            },
            {
              "name": "eligible_stake",
              "type": "int64"
            },
            {
              "name": "admin_count",
              "type": "uint32"
            },
            {
              "name": "key_epoch",
              "type": "uint64"
            },
            {
              "name": "history_policy",
              "type": "uint8"
            }
          ]
        },
        {
          "name": "documents",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "document_id",
              "type": "uint64"
            },
            {
              "name": "version",
              "type": "uint32"
            },
            {
              "name": "author",
              "type": "uint64"
            },
            {
              "name": "cid",
              "type": "string"
            },
            {
              "name": "metadata",
              "type": "string"
            },
            {
              "name": "commitment",
              "type": "checksum256"
            },
            {
              "name": "bytes",
              "type": "uint32"
            },
            {
              "name": "envelope_version",
              "type": "uint16"
            },
            {
              "name": "key_epoch",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "epochs",
          "fields": [
            {
              "name": "epoch",
              "type": "uint64"
            },
            {
              "name": "commitment",
              "type": "checksum256"
            },
            {
              "name": "creator",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "evidence",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "obligation_id",
              "type": "uint64"
            },
            {
              "name": "recipient",
              "type": "uint64"
            },
            {
              "name": "quantity",
              "type": "asset"
            },
            {
              "name": "chain",
              "type": "string"
            },
            {
              "name": "payer",
              "type": "string"
            },
            {
              "name": "reference",
              "type": "checksum256"
            },
            {
              "name": "mode",
              "type": "uint8"
            }
          ]
        },
        {
          "name": "feecfg",
          "fields": [
            {
              "name": "third_party_bps",
              "type": "uint16"
            },
            {
              "name": "first_party_bps",
              "type": "uint16"
            },
            {
              "name": "treasury",
              "type": "name"
            },
            {
              "name": "token_contract",
              "type": "name"
            },
            {
              "name": "token_symbol",
              "type": "symbol"
            },
            {
              "name": "names",
              "type": "name"
            }
          ]
        },
        {
          "name": "govlocks",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "source",
              "type": "name"
            },
            {
              "name": "source_id",
              "type": "uint64"
            },
            {
              "name": "expires",
              "type": "uint32"
            },
            {
              "name": "active",
              "type": "bool"
            }
          ]
        },
        {
          "name": "govpolicies",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "revision",
              "type": "uint64"
            },
            {
              "name": "config",
              "type": "gov_settings"
            }
          ]
        },
        {
          "name": "guards",
          "fields": [
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "paused_until",
              "type": "uint32"
            },
            {
              "name": "reason",
              "type": "checksum256"
            }
          ]
        },
        {
          "name": "keygrants",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "epoch",
              "type": "uint64"
            },
            {
              "name": "recipient",
              "type": "uint64"
            },
            {
              "name": "grantor",
              "type": "uint64"
            },
            {
              "name": "envelope",
              "type": "string"
            }
          ]
        },
        {
          "name": "members",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "native_account",
              "type": "name"
            },
            {
              "name": "signing_key",
              "type": "public_key"
            },
            {
              "name": "encryption_key",
              "type": "string"
            },
            {
              "name": "custody",
              "type": "uint8"
            },
            {
              "name": "nonce",
              "type": "uint64"
            },
            {
              "name": "credits",
              "type": "uint64"
            },
            {
              "name": "active",
              "type": "bool"
            },
            {
              "name": "admin",
              "type": "bool"
            },
            {
              "name": "reviewer",
              "type": "bool"
            },
            {
              "name": "stake",
              "type": "int64"
            },
            {
              "name": "claim",
              "type": "int64"
            },
            {
              "name": "join_epoch",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "mktcfg",
          "fields": [
            {
              "name": "bump_bps",
              "type": "uint16"
            },
            {
              "name": "quote_premium_bps",
              "type": "uint16"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            }
          ]
        },
        {
          "name": "modcopy",
          "fields": [
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "summary",
              "type": "string"
            },
            {
              "name": "detail",
              "type": "string"
            }
          ]
        },
        {
          "name": "modpays",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "modaccount",
              "type": "name"
            },
            {
              "name": "payer",
              "type": "name"
            },
            {
              "name": "publisher",
              "type": "name"
            },
            {
              "name": "gross",
              "type": "asset"
            },
            {
              "name": "platform_fee",
              "type": "asset"
            },
            {
              "name": "publisher_share",
              "type": "asset"
            },
            {
              "name": "party",
              "type": "uint8"
            },
            {
              "name": "bps",
              "type": "uint16"
            }
          ]
        },
        {
          "name": "modules",
          "fields": [
            {
              "name": "account",
              "type": "name"
            },
            {
              "name": "version",
              "type": "uint16"
            },
            {
              "name": "actions",
              "type": "name[]"
            },
            {
              "name": "grants",
              "type": "name[]"
            },
            {
              "name": "code_hash",
              "type": "checksum256"
            }
          ]
        },
        {
          "name": "obligations",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "source",
              "type": "name"
            },
            {
              "name": "source_id",
              "type": "uint64"
            },
            {
              "name": "recipient",
              "type": "uint64"
            },
            {
              "name": "quantity",
              "type": "asset"
            },
            {
              "name": "due",
              "type": "uint32"
            },
            {
              "name": "status",
              "type": "uint8"
            }
          ]
        },
        {
          "name": "profiles",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "dao_id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "account_name",
              "type": "name"
            },
            {
              "name": "profile",
              "type": "string"
            }
          ]
        },
        {
          "name": "sessions",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "member_id",
              "type": "uint64"
            },
            {
              "name": "signing_key",
              "type": "public_key"
            },
            {
              "name": "expires",
              "type": "uint32"
            },
            {
              "name": "credential_epoch",
              "type": "uint64"
            },
            {
              "name": "permissions",
              "type": "session_permission[]"
            }
          ]
        },
        {
          "name": "settings",
          "fields": [
            {
              "name": "chain_id",
              "type": "checksum256"
            },
            {
              "name": "interface_version",
              "type": "uint16"
            }
          ]
        }
      ]
    },
    {
      "name": "hub",
      "abiVersion": "eosio::abi/1.2",
      "sourceAbiHash": "ae70e5f0f7af1f1a9ded1b8ce193c5e6cab1808799f4e11c7e9ad160518e3cf7",
      "actions": [
        {
          "name": "regdeploy",
          "fields": [
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "owner",
              "type": "name"
            },
            {
              "name": "chain_id",
              "type": "checksum256"
            },
            {
              "name": "interface_version",
              "type": "uint16"
            },
            {
              "name": "code_hash",
              "type": "checksum256"
            },
            {
              "name": "abi_hash",
              "type": "checksum256"
            },
            {
              "name": "metadata",
              "type": "string"
            },
            {
              "name": "listed",
              "type": "bool"
            }
          ]
        }
      ],
      "tables": [
        {
          "name": "deployments",
          "fields": [
            {
              "name": "id",
              "type": "uint64"
            },
            {
              "name": "runtime",
              "type": "name"
            },
            {
              "name": "owner",
              "type": "name"
            },
            {
              "name": "chain_id",
              "type": "checksum256"
            },
            {
              "name": "interface_version",
              "type": "uint16"
            },
            {
              "name": "code_hash",
              "type": "checksum256"
            },
            {
              "name": "abi_hash",
              "type": "checksum256"
            },
            {
              "name": "metadata",
              "type": "string"
            },
            {
              "name": "listed",
              "type": "bool"
            }
          ]
        }
      ]
    }
  ],
  "api": [
    {
      "method": "GET",
      "path": "/v1/platform/status",
      "response": {
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
                "const": 2000
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
      },
      "helpTopic": "platform"
    },
    {
      "method": "POST",
      "path": "/v1/dao-orders",
      "input": {
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
              "tlos"
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
      },
      "response": {
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
              "tlos"
            ]
          },
          "usdCents": {
            "type": "integer",
            "exclusiveMinimum": 0,
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
      },
      "helpTopic": "creation-fees"
    },
    {
      "method": "GET",
      "path": "/v1/dao-orders/:id",
      "response": {
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
              "tlos"
            ]
          },
          "usdCents": {
            "type": "integer",
            "exclusiveMinimum": 0,
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
      },
      "helpTopic": "creation-fees"
    },
    {
      "method": "POST",
      "path": "/v1/dao-orders/:id/checkout",
      "input": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "response": {
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
      },
      "helpTopic": "creation-fees"
    },
    {
      "method": "POST",
      "path": "/v1/dao-orders/:id/fulfill",
      "input": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "response": {
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
              "tlos"
            ]
          },
          "usdCents": {
            "type": "integer",
            "exclusiveMinimum": 0,
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
      },
      "helpTopic": "creation-fees"
    },
    {
      "method": "GET",
      "path": "/v1/dao-presets",
      "response": {
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
      },
      "helpTopic": "dao-presets"
    },
    {
      "method": "GET",
      "path": "/v1/daos/:id/governance",
      "response": {
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
          }
        },
        "required": [
          "dao",
          "policy",
          "actors",
          "sessions",
          "guardian",
          "budget"
        ],
        "additionalProperties": false
      },
      "helpTopic": "dao-governance"
    },
    {
      "method": "GET",
      "path": "/v1/network",
      "response": {
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
      },
      "helpTopic": "deployments"
    },
    {
      "method": "GET",
      "path": "/v1/daos",
      "response": {
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
          }
        },
        "required": [
          "daos"
        ],
        "additionalProperties": false
      },
      "helpTopic": "deployments"
    },
    {
      "method": "GET",
      "path": "/v1/daos/:id/content",
      "response": {
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
          "members": {
            "maxItems": 5000,
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
            "maxItems": 1000,
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
            "maxItems": 1000,
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
            "maxItems": 1000,
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
          "members",
          "documents",
          "keyGrants",
          "epochs"
        ],
        "additionalProperties": false
      },
      "helpTopic": "documents"
    },
    {
      "method": "GET",
      "path": "/v1/daos/:id",
      "response": {
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
      },
      "helpTopic": "deployments"
    },
    {
      "method": "GET",
      "path": "/v1/daos/:id/treasury",
      "response": {
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
          }
        },
        "required": [
          "dao",
          "obligations",
          "evidence"
        ],
        "additionalProperties": false
      },
      "helpTopic": "treasury"
    },
    {
      "method": "POST",
      "path": "/v1/treasury/settle",
      "input": {
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
      },
      "response": {
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
      },
      "helpTopic": "treasury"
    },
    {
      "method": "GET",
      "path": "/v1/storage",
      "response": {
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
      },
      "helpTopic": "providers"
    },
    {
      "method": "POST",
      "path": "/v1/uploads",
      "input": {
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
      },
      "response": {
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
      },
      "helpTopic": "documents"
    },
    {
      "method": "GET",
      "path": "/v1/uploads/:requestId",
      "response": {
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
      },
      "helpTopic": "documents"
    },
    {
      "method": "POST",
      "path": "/v1/uploads/:requestId/reconcile",
      "input": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "default": {},
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "response": {
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
      },
      "helpTopic": "documents"
    },
    {
      "method": "GET",
      "path": "/v1/daos/:id/documents/:documentId/:version/content",
      "response": {
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
      },
      "helpTopic": "documents"
    },
    {
      "method": "POST",
      "path": "/v1/auth/challenge",
      "input": {
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
      },
      "response": {
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
      },
      "helpTopic": "accounts"
    },
    {
      "method": "POST",
      "path": "/v1/auth/login",
      "input": {
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
      },
      "response": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "account": {
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
      },
      "helpTopic": "accounts"
    },
    {
      "method": "GET",
      "path": "/v1/me",
      "response": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "account": {
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
          }
        },
        "required": [
          "account"
        ],
        "additionalProperties": false
      },
      "helpTopic": "accounts"
    },
    {
      "method": "GET",
      "path": "/v1/me/memberships",
      "response": {
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
      },
      "helpTopic": "members"
    },
    {
      "method": "POST",
      "path": "/v1/auth/logout",
      "input": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "default": {},
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "response": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "null"
      },
      "helpTopic": "accounts"
    },
    {
      "method": "POST",
      "path": "/v1/auth/providers/link",
      "input": {
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
      },
      "response": {
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
      },
      "helpTopic": "providers"
    },
    {
      "method": "POST",
      "path": "/v1/auth/providers/login",
      "input": {
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
      },
      "response": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "account": {
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
      },
      "helpTopic": "providers"
    },
    {
      "method": "POST",
      "path": "/v1/auth/providers/unlink",
      "input": {
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
      },
      "response": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "null"
      },
      "helpTopic": "providers"
    },
    {
      "method": "POST",
      "path": "/v1/daos",
      "input": {
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
      },
      "response": {
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
      },
      "helpTopic": "creation-fees"
    },
    {
      "method": "POST",
      "path": "/v1/relay",
      "input": {
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
      },
      "response": {
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
      },
      "helpTopic": "modules"
    }
  ],
  "modules": []
} satisfies HelpBundle;
