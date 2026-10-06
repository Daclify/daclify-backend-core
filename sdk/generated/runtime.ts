// Generated from compiled C++ ABI. Regenerate with npm run codegen; do not edit.
import type { ABI } from '@wharfkit/antelope';
export const runtimeAbiHash = '3a68bd2f500e84f7662487a9e452ef408c60ccef392f33239e5252c4673c4b14';
export const runtimeAbi = {
  "version": "eosio::abi/1.2",
  "types": [],
  "structs": [
    {
      "name": "addmember",
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "name": "budget_record",
      "base": "",
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
      "name": "cancelob",
      "base": "",
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
      "base": "",
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
      "name": "catalogue_record",
      "base": "",
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
      "name": "commitepoch",
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "name": "creation_order",
      "base": "",
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
      "name": "creation_policy",
      "base": "",
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
      "name": "dao_record",
      "base": "",
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
      "name": "delsession",
      "base": "",
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
      "name": "document_record",
      "base": "",
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
      "name": "enroll",
      "base": "",
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
      "base": "",
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
      "name": "epoch_record",
      "base": "",
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
      "name": "evidence_record",
      "base": "",
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
      "name": "fee_config",
      "base": "",
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
      "name": "gov_policy_record",
      "base": "",
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
      "name": "gov_settings",
      "base": "",
      "fields": [
        {
          "name": "participant_mode",
          "type": "uint8"
        },
        {
          "name": "decide",
          "type": "name"
        },
        {
          "name": "guardian",
          "type": "name"
        },
        {
          "name": "kind",
          "type": "uint8"
        },
        {
          "name": "duration",
          "type": "uint32"
        },
        {
          "name": "quorum",
          "type": "uint16"
        },
        {
          "name": "approval",
          "type": "uint16"
        },
        {
          "name": "governed_works",
          "type": "bool"
        },
        {
          "name": "max_commitment",
          "type": "int64"
        },
        {
          "name": "daily_commitment",
          "type": "int64"
        }
      ]
    },
    {
      "name": "govcreate",
      "base": "",
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
      "name": "governance_lock",
      "base": "",
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
      "name": "govfees",
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "name": "guardian_record",
      "base": "",
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
      "name": "guardpause",
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
      "fields": [
        {
          "name": "chain_id",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "initgov",
      "base": "",
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
      "name": "instruction",
      "base": "",
      "fields": [
        {
          "name": "version",
          "type": "uint16"
        },
        {
          "name": "chain_id",
          "type": "checksum256"
        },
        {
          "name": "deployment",
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
          "name": "nonce",
          "type": "uint64"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "target",
          "type": "name"
        },
        {
          "name": "action",
          "type": "name"
        },
        {
          "name": "data",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "key_grant_record",
      "base": "",
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
      "name": "linknative",
      "base": "",
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
      "base": "",
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
      "name": "market_policy",
      "base": "",
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
      "name": "member_record",
      "base": "",
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
      "name": "modconfig",
      "base": "",
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
      "name": "modcopy_record",
      "base": "",
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
      "name": "modpay_record",
      "base": "",
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
      "name": "module_record",
      "base": "",
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
      "name": "obligation_record",
      "base": "",
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
      "name": "ordercreate",
      "base": "",
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
      "name": "participant_record",
      "base": "",
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
      "name": "payob",
      "base": "",
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
      "name": "profile_record",
      "base": "",
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
      "name": "putdoc",
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "name": "session_permission",
      "base": "",
      "fields": [
        {
          "name": "target",
          "type": "name"
        },
        {
          "name": "action",
          "type": "name"
        },
        {
          "name": "code_hash",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "session_record",
      "base": "",
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
      "name": "setactive",
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "setmeta",
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "base": "",
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
      "name": "settings",
      "base": "",
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
    },
    {
      "name": "submit",
      "base": "",
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
      "base": "",
      "fields": [
        {
          "name": "request",
          "type": "instruction"
        }
      ]
    },
    {
      "name": "submitsess",
      "base": "",
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
      "base": "",
      "fields": [
        {
          "name": "account",
          "type": "name"
        }
      ]
    },
    {
      "name": "unstake",
      "base": "",
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
      "base": "",
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
  "actions": [
    {
      "name": "addmember",
      "type": "addmember",
      "ricardian_contract": ""
    },
    {
      "name": "addsession",
      "type": "addsession",
      "ricardian_contract": ""
    },
    {
      "name": "approveob",
      "type": "approveob",
      "ricardian_contract": ""
    },
    {
      "name": "cancelob",
      "type": "cancelob",
      "ricardian_contract": ""
    },
    {
      "name": "cardcreate",
      "type": "cardcreate",
      "ricardian_contract": ""
    },
    {
      "name": "commitepoch",
      "type": "commitepoch",
      "ricardian_contract": ""
    },
    {
      "name": "confirmext",
      "type": "confirmext",
      "ricardian_contract": ""
    },
    {
      "name": "createdao",
      "type": "createdao",
      "ricardian_contract": ""
    },
    {
      "name": "createpaid",
      "type": "createpaid",
      "ricardian_contract": ""
    },
    {
      "name": "delsession",
      "type": "delsession",
      "ricardian_contract": ""
    },
    {
      "name": "enroll",
      "type": "enroll",
      "ricardian_contract": ""
    },
    {
      "name": "enrollagent",
      "type": "enrollagent",
      "ricardian_contract": ""
    },
    {
      "name": "govcreate",
      "type": "govcreate",
      "ricardian_contract": ""
    },
    {
      "name": "govfees",
      "type": "govfees",
      "ricardian_contract": ""
    },
    {
      "name": "govlist",
      "type": "govlist",
      "ricardian_contract": ""
    },
    {
      "name": "govlock",
      "type": "govlock",
      "ricardian_contract": ""
    },
    {
      "name": "govmodcopy",
      "type": "govmodcopy",
      "ricardian_contract": ""
    },
    {
      "name": "govunlist",
      "type": "govunlist",
      "ricardian_contract": ""
    },
    {
      "name": "govunlock",
      "type": "govunlock",
      "ricardian_contract": ""
    },
    {
      "name": "grantcredit",
      "type": "grantcredit",
      "ricardian_contract": ""
    },
    {
      "name": "grantkey",
      "type": "grantkey",
      "ricardian_contract": ""
    },
    {
      "name": "guardpause",
      "type": "guardpause",
      "ricardian_contract": ""
    },
    {
      "name": "guardrecover",
      "type": "guardrecover",
      "ricardian_contract": ""
    },
    {
      "name": "guardrevoke",
      "type": "guardrevoke",
      "ricardian_contract": ""
    },
    {
      "name": "init",
      "type": "init",
      "ricardian_contract": ""
    },
    {
      "name": "initgov",
      "type": "initgov",
      "ricardian_contract": ""
    },
    {
      "name": "linknative",
      "type": "linknative",
      "ricardian_contract": ""
    },
    {
      "name": "listmod",
      "type": "listmod",
      "ricardian_contract": ""
    },
    {
      "name": "modconfig",
      "type": "modconfig",
      "ricardian_contract": ""
    },
    {
      "name": "ordercreate",
      "type": "ordercreate",
      "ricardian_contract": ""
    },
    {
      "name": "payob",
      "type": "payob",
      "ricardian_contract": ""
    },
    {
      "name": "putdoc",
      "type": "putdoc",
      "ricardian_contract": ""
    },
    {
      "name": "putjson",
      "type": "putjson",
      "ricardian_contract": ""
    },
    {
      "name": "reserve",
      "type": "reserve",
      "ricardian_contract": ""
    },
    {
      "name": "rotateepoch",
      "type": "rotateepoch",
      "ricardian_contract": ""
    },
    {
      "name": "rotatekey",
      "type": "rotatekey",
      "ricardian_contract": ""
    },
    {
      "name": "setactive",
      "type": "setactive",
      "ricardian_contract": ""
    },
    {
      "name": "setcreate",
      "type": "setcreate",
      "ricardian_contract": ""
    },
    {
      "name": "setcredits",
      "type": "setcredits",
      "ricardian_contract": ""
    },
    {
      "name": "setcrrate",
      "type": "setcrrate",
      "ricardian_contract": ""
    },
    {
      "name": "setdaogov",
      "type": "setdaogov",
      "ricardian_contract": ""
    },
    {
      "name": "setfees",
      "type": "setfees",
      "ricardian_contract": ""
    },
    {
      "name": "setgov",
      "type": "setgov",
      "ricardian_contract": ""
    },
    {
      "name": "setmeta",
      "type": "setmeta",
      "ricardian_contract": ""
    },
    {
      "name": "setmodcopy",
      "type": "setmodcopy",
      "ricardian_contract": ""
    },
    {
      "name": "setmodule",
      "type": "setmodule",
      "ricardian_contract": ""
    },
    {
      "name": "setoracle",
      "type": "setoracle",
      "ricardian_contract": ""
    },
    {
      "name": "setpolicy",
      "type": "setpolicy",
      "ricardian_contract": ""
    },
    {
      "name": "setprofile",
      "type": "setprofile",
      "ricardian_contract": ""
    },
    {
      "name": "setroles",
      "type": "setroles",
      "ricardian_contract": ""
    },
    {
      "name": "submit",
      "type": "submit",
      "ricardian_contract": ""
    },
    {
      "name": "submitnat",
      "type": "submitnat",
      "ricardian_contract": ""
    },
    {
      "name": "submitsess",
      "type": "submitsess",
      "ricardian_contract": ""
    },
    {
      "name": "unlistmod",
      "type": "unlistmod",
      "ricardian_contract": ""
    },
    {
      "name": "unstake",
      "type": "unstake",
      "ricardian_contract": ""
    },
    {
      "name": "withdraw",
      "type": "withdraw",
      "ricardian_contract": ""
    }
  ],
  "tables": [
    {
      "name": "actors",
      "type": "participant_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "budgets",
      "type": "budget_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "catalogue",
      "type": "catalogue_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "createcfg",
      "type": "creation_policy",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "createords",
      "type": "creation_order",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "daos",
      "type": "dao_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "documents",
      "type": "document_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "epochs",
      "type": "epoch_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "evidence",
      "type": "evidence_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "feecfg",
      "type": "fee_config",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "govlocks",
      "type": "governance_lock",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "govpolicies",
      "type": "gov_policy_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "guards",
      "type": "guardian_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "keygrants",
      "type": "key_grant_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "members",
      "type": "member_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "mktcfg",
      "type": "market_policy",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "modcopy",
      "type": "modcopy_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "modpays",
      "type": "modpay_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "modules",
      "type": "module_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "obligations",
      "type": "obligation_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "profiles",
      "type": "profile_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "sessions",
      "type": "session_record",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "settings",
      "type": "settings",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    }
  ],
  "variants": [],
  "ricardian_clauses": [],
  "action_results": []
} satisfies ABI.Def;
export interface addmember {
  runtime: string;
  dao_id: string;
  member_id: string;
  signing_key: string;
  encryption_key: string;
  custody: number;
  kind: number;
  operator_label: string;
}
export interface addsession {
  runtime: string;
  dao_id: string;
  member_id: string;
  session_id: string;
  signing_key: string;
  expires: number;
  permissions: session_permission[];
}
export interface approveob {
  dao_id: string;
  source: string;
  source_id: string;
}
export interface budget_record {
  dao_id: string;
  day: number;
  committed: string;
}
export interface cancelob {
  dao_id: string;
  source: string;
  source_id: string;
}
export interface cardcreate {
  reference: string;
  usd_cents: number;
  checkout_reference: string;
  paid_at: number;
}
export interface catalogue_record {
  account: string;
  publisher: string;
  party: number;
  complies: number;
  price: string;
  code_hash: string;
  title: string;
}
export interface commitepoch {
  runtime: string;
  dao_id: string;
  member_id: string;
  epoch: string;
  commitment: string;
  self_grant: string;
}
export interface confirmext {
  runtime: string;
  dao_id: string;
  member_id: string;
  obligation_id: string;
  chain: string;
  payer: string;
  recipient: string;
  quantity: string;
  reference: string;
}
export interface createdao {
  dao_id: string;
  owner: string;
  metadata: string;
  privacy: number;
  token_contract: string;
  token_symbol: string;
}
export interface createpaid {
  dao_id: string;
  owner: string;
  metadata: string;
  privacy: number;
  token_contract: string;
  token_symbol: string;
  reference: string;
  creator: string;
}
export interface creation_order {
  id: string;
  reference: string;
  creator: string;
  deployment: number;
  method: number;
  usd_cents: number;
  tlos_due: string;
  created_at: number;
  expires: number;
  paid: boolean;
  used: boolean;
  dao_id: string;
  card_reference: string;
}
export interface creation_policy {
  shared_usd: number;
  independent_usd: number;
  premium_bps: number;
  settler: string;
  median: string;
  precision: number;
  observed_at: number;
}
export interface dao_record {
  id: string;
  owner: string;
  metadata: string;
  privacy: number;
  token_contract: string;
  token_symbol: string;
  credit_supply: string;
  member_count: string;
  max_member: string;
  active_ballots: number;
  available: string;
  reserved: string;
  claims: string;
  staked: string;
  eligible_credits: string;
  eligible_stake: string;
  admin_count: number;
  key_epoch: string;
  history_policy: number;
}
export interface delsession {
  runtime: string;
  dao_id: string;
  member_id: string;
  session_id: string;
}
export interface document_record {
  id: string;
  document_id: string;
  version: number;
  author: string;
  cid: string;
  metadata: string;
  commitment: string;
  bytes: number;
  envelope_version: number;
  key_epoch: string;
}
export interface enroll {
  dao_id: string;
  member_id: string;
  native_account: string;
  signing_key: string;
  encryption_key: string;
  custody: number;
}
export interface enrollagent {
  dao_id: string;
  member_id: string;
  native_account: string;
  signing_key: string;
  encryption_key: string;
  custody: number;
  operator_label: string;
}
export interface epoch_record {
  epoch: string;
  commitment: string;
  creator: string;
}
export interface evidence_record {
  id: string;
  dao_id: string;
  obligation_id: string;
  recipient: string;
  quantity: string;
  chain: string;
  payer: string;
  reference: string;
  mode: number;
}
export interface fee_config {
  third_party_bps: number;
  first_party_bps: number;
  treasury: string;
  token_contract: string;
  token_symbol: string;
  names: string;
}
export interface gov_policy_record {
  dao_id: string;
  revision: string;
  config: gov_settings;
}
export interface gov_settings {
  participant_mode: number;
  decide: string;
  guardian: string;
  kind: number;
  duration: number;
  quorum: number;
  approval: number;
  governed_works: boolean;
  max_commitment: string;
  daily_commitment: string;
}
export interface govcreate {
  runtime: string;
  dao_id: string;
  member_id: string;
  shared_usd: number;
  independent_usd: number;
  premium_bps: number;
  settler: string;
}
export interface governance_lock {
  id: string;
  source: string;
  source_id: string;
  expires: number;
  active: boolean;
}
export interface govfees {
  runtime: string;
  dao_id: string;
  member_id: string;
  third_party_bps: number;
  first_party_bps: number;
  bump_bps: number;
  quote_premium_bps: number;
}
export interface govlist {
  runtime: string;
  dao_id: string;
  member_id: string;
  account: string;
  price: string;
  code_hash: string;
  title: string;
}
export interface govlock {
  dao_id: string;
  source: string;
  source_id: string;
  expires: number;
}
export interface govmodcopy {
  runtime: string;
  dao_id: string;
  member_id: string;
  account: string;
  summary: string;
  detail: string;
}
export interface govunlist {
  runtime: string;
  dao_id: string;
  member_id: string;
  account: string;
}
export interface govunlock {
  dao_id: string;
  source: string;
  source_id: string;
}
export interface grantcredit {
  dao_id: string;
  member_id: string;
  quantity: string;
}
export interface grantkey {
  runtime: string;
  dao_id: string;
  member_id: string;
  recipient: string;
  epoch: string;
  envelope: string;
}
export interface guardian_record {
  dao_id: string;
  paused_until: number;
  reason: string;
}
export interface guardpause {
  dao_id: string;
  until: number;
  reason: string;
}
export interface guardrecover {
  dao_id: string;
  member_id: string;
  signing_key: string;
}
export interface guardrevoke {
  dao_id: string;
  member_id: string;
}
export interface init {
  chain_id: string;
}
export interface initgov {
  dao_id: string;
  settings: gov_settings;
}
export interface instruction {
  version: number;
  chain_id: string;
  deployment: string;
  dao_id: string;
  member_id: string;
  nonce: string;
  expires: number;
  target: string;
  action: string;
  data: string;
}
export interface key_grant_record {
  id: string;
  epoch: string;
  recipient: string;
  grantor: string;
  envelope: string;
}
export interface linknative {
  runtime: string;
  dao_id: string;
  member_id: string;
  account: string;
}
export interface listmod {
  account: string;
  publisher: string;
  party: number;
  accepts_fee_rule: number;
  price: string;
  code_hash: string;
  title: string;
}
export interface market_policy {
  bump_bps: number;
  quote_premium_bps: number;
  dao_id: string;
}
export interface member_record {
  id: string;
  native_account: string;
  signing_key: string;
  encryption_key: string;
  custody: number;
  nonce: string;
  credits: string;
  active: boolean;
  admin: boolean;
  reviewer: boolean;
  stake: string;
  claim: string;
  join_epoch: string;
}
export interface modconfig {
  runtime: string;
  dao_id: string;
  member_id: string;
  account: string;
  version: number;
  actions: string[];
  grants: string[];
  code_hash: string;
}
export interface modcopy_record {
  account: string;
  summary: string;
  detail: string;
}
export interface modpay_record {
  id: string;
  modaccount: string;
  payer: string;
  publisher: string;
  gross: string;
  platform_fee: string;
  publisher_share: string;
  party: number;
  bps: number;
}
export interface module_record {
  account: string;
  version: number;
  actions: string[];
  grants: string[];
  code_hash: string;
}
export interface obligation_record {
  id: string;
  source: string;
  source_id: string;
  recipient: string;
  quantity: string;
  due: number;
  status: number;
}
export interface ordercreate {
  reference: string;
  creator: string;
  deployment: number;
  method: number;
}
export interface participant_record {
  id: string;
  kind: number;
  operator_label: string;
  revoked: boolean;
  credential_epoch: string;
}
export interface payob {
  dao_id: string;
  source: string;
  source_id: string;
}
export interface profile_record {
  id: string;
  dao_id: string;
  member_id: string;
  account_name: string;
  profile: string;
}
export interface putdoc {
  runtime: string;
  dao_id: string;
  member_id: string;
  document_id: string;
  version: number;
  cid: string;
  metadata: string;
  commitment: string;
  bytes: number;
  envelope_version: number;
  key_epoch: string;
}
export interface putjson {
  runtime: string;
  dao_id: string;
  member_id: string;
  document_id: string;
  version: number;
  value: string;
  envelope_version: number;
  key_epoch: string;
}
export interface reserve {
  dao_id: string;
  source: string;
  source_id: string;
  recipient: string;
  quantity: string;
  due: number;
}
export interface rotateepoch {
  runtime: string;
  dao_id: string;
  member_id: string;
}
export interface rotatekey {
  runtime: string;
  dao_id: string;
  member_id: string;
  signing_key: string;
}
export interface session_permission {
  target: string;
  action: string;
  code_hash: string;
}
export interface session_record {
  id: string;
  member_id: string;
  signing_key: string;
  expires: number;
  credential_epoch: string;
  permissions: session_permission[];
}
export interface setactive {
  runtime: string;
  dao_id: string;
  member_id: string;
  target: string;
  active: boolean;
}
export interface setcreate {
  shared_usd: number;
  independent_usd: number;
  premium_bps: number;
  settler: string;
}
export interface setcredits {
  runtime: string;
  dao_id: string;
  member_id: string;
  target: string;
  quantity: string;
}
export interface setcrrate {
  median: string;
  precision: number;
  observed_at: number;
}
export interface setdaogov {
  runtime: string;
  dao_id: string;
  member_id: string;
  settings: gov_settings;
}
export interface setfees {
  third_party_bps: number;
  first_party_bps: number;
  treasury: string;
  token_contract: string;
  token_symbol: string;
  names: string;
}
export interface setgov {
  dao_id: string;
}
export interface setmeta {
  runtime: string;
  dao_id: string;
  member_id: string;
  metadata: string;
}
export interface setmodcopy {
  account: string;
  summary: string;
  detail: string;
}
export interface setmodule {
  dao_id: string;
  account: string;
  version: number;
  actions: string[];
  grants: string[];
  code_hash: string;
}
export interface setoracle {
  median: string;
  quoted_precision: number;
  observed_at: number;
}
export interface setpolicy {
  bump_bps: number;
  quote_premium_bps: number;
}
export interface setprofile {
  runtime: string;
  dao_id: string;
  member_id: string;
  account_name: string;
  profile: string;
}
export interface setroles {
  runtime: string;
  dao_id: string;
  member_id: string;
  target: string;
  admin: boolean;
  reviewer: boolean;
}
export interface settings {
  chain_id: string;
  interface_version: number;
}
export interface submit {
  request: instruction;
  sig: string;
}
export interface submitnat {
  request: instruction;
}
export interface submitsess {
  request: instruction;
  session_id: string;
  sig: string;
}
export interface unlistmod {
  account: string;
}
export interface unstake {
  runtime: string;
  dao_id: string;
  member_id: string;
  destination: string;
  quantity: string;
}
export interface withdraw {
  runtime: string;
  dao_id: string;
  member_id: string;
  destination: string;
  quantity: string;
}
export interface RuntimeActions {
  addmember: addmember;
  addsession: addsession;
  approveob: approveob;
  cancelob: cancelob;
  cardcreate: cardcreate;
  commitepoch: commitepoch;
  confirmext: confirmext;
  createdao: createdao;
  createpaid: createpaid;
  delsession: delsession;
  enroll: enroll;
  enrollagent: enrollagent;
  govcreate: govcreate;
  govfees: govfees;
  govlist: govlist;
  govlock: govlock;
  govmodcopy: govmodcopy;
  govunlist: govunlist;
  govunlock: govunlock;
  grantcredit: grantcredit;
  grantkey: grantkey;
  guardpause: guardpause;
  guardrecover: guardrecover;
  guardrevoke: guardrevoke;
  init: init;
  initgov: initgov;
  linknative: linknative;
  listmod: listmod;
  modconfig: modconfig;
  ordercreate: ordercreate;
  payob: payob;
  putdoc: putdoc;
  putjson: putjson;
  reserve: reserve;
  rotateepoch: rotateepoch;
  rotatekey: rotatekey;
  setactive: setactive;
  setcreate: setcreate;
  setcredits: setcredits;
  setcrrate: setcrrate;
  setdaogov: setdaogov;
  setfees: setfees;
  setgov: setgov;
  setmeta: setmeta;
  setmodcopy: setmodcopy;
  setmodule: setmodule;
  setoracle: setoracle;
  setpolicy: setpolicy;
  setprofile: setprofile;
  setroles: setroles;
  submit: submit;
  submitnat: submitnat;
  submitsess: submitsess;
  unlistmod: unlistmod;
  unstake: unstake;
  withdraw: withdraw;
}
