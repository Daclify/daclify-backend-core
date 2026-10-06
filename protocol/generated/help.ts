// Generated from producer-owned guides, compiled ABI and API schemas.
import type {HelpBundle} from '../docs.js';
export const CoreHelpBundle={
  "producer": "core",
  "packageVersion": "0.1.0-alpha.1",
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
    }
  ],
  "schemaVersion": 1,
  "contracts": [
    {
      "name": "runtime",
      "abiVersion": "eosio::abi/1.2",
      "sourceAbiHash": "0dc54e3ec8dd514577c4b11d10530c16e0bdc35ce76e0ae0e69d851d12e366b0",
      "actions": [
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
          "name": "init",
          "fields": [
            {
              "name": "chain_id",
              "type": "checksum256"
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
      "method": "POST",
      "path": "/v1/relay",
      "input": {
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
