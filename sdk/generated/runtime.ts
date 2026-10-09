// Generated from compiled C++ ABI. Regenerate with npm run codegen; do not edit.
import type { ABI } from '@wharfkit/antelope';
export const runtimeAbiHash = '0e5d9e4f52d9b6a5e47343c3da22ec658e2a11b73262b11af0a7fd4696fa9601';
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
      "name": "admission_policy",
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
          "name": "mode",
          "type": "uint8"
        },
        {
          "name": "source",
          "type": "name"
        },
        {
          "name": "threshold",
          "type": "uint8"
        },
        {
          "name": "allow_agents",
          "type": "bool"
        },
        {
          "name": "admin_override",
          "type": "bool"
        }
      ]
    },
    {
      "name": "admitfrom",
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
          "name": "application_id",
          "type": "uint64"
        },
        {
          "name": "revision",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "adoptram",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "claims",
          "type": "bool"
        },
        {
          "name": "limit",
          "type": "uint32"
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
      "name": "archapprove",
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
          "name": "manifest_commitment",
          "type": "checksum256"
        },
        {
          "name": "descriptor_commitment",
          "type": "checksum256"
        },
        {
          "name": "backup_commitment",
          "type": "checksum256"
        },
        {
          "name": "retention_seconds",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "archattest",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "manifest",
          "type": "archive_manifest_descriptor"
        },
        {
          "name": "manifest_cid",
          "type": "string"
        },
        {
          "name": "manifest_bytes",
          "type": "uint32"
        },
        {
          "name": "manifest_commitment",
          "type": "checksum256"
        },
        {
          "name": "backup_commitment",
          "type": "checksum256"
        },
        {
          "name": "retention_seconds",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "archive_anchor",
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
          "name": "manifest",
          "type": "archive_manifest_descriptor"
        },
        {
          "name": "manifest_cid",
          "type": "string"
        },
        {
          "name": "manifest_bytes",
          "type": "uint32"
        },
        {
          "name": "manifest_commitment",
          "type": "checksum256"
        },
        {
          "name": "descriptor_commitment",
          "type": "checksum256"
        },
        {
          "name": "backup_commitment",
          "type": "checksum256"
        },
        {
          "name": "verifier",
          "type": "name"
        },
        {
          "name": "attestation_transaction",
          "type": "checksum256"
        },
        {
          "name": "approval_transaction",
          "type": "checksum256"
        },
        {
          "name": "retention_seconds",
          "type": "uint32"
        },
        {
          "name": "attested_at",
          "type": "uint32"
        },
        {
          "name": "approved_by",
          "type": "uint64"
        },
        {
          "name": "approved_at",
          "type": "uint32"
        },
        {
          "name": "revoked",
          "type": "bool"
        }
      ]
    },
    {
      "name": "archive_chunk_descriptor",
      "base": "",
      "fields": [
        {
          "name": "domain",
          "type": "archive_domain"
        },
        {
          "name": "root",
          "type": "checksum256"
        },
        {
          "name": "cid",
          "type": "string"
        },
        {
          "name": "bytes",
          "type": "uint32"
        },
        {
          "name": "commitment",
          "type": "checksum256"
        },
        {
          "name": "first_key",
          "type": "uint64"
        },
        {
          "name": "last_key",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "archive_domain",
      "base": "",
      "fields": [
        {
          "name": "format_version",
          "type": "uint16"
        },
        {
          "name": "chain_id",
          "type": "checksum256"
        },
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "source",
          "type": "name"
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
          "name": "schema_hash",
          "type": "checksum256"
        },
        {
          "name": "table",
          "type": "name"
        },
        {
          "name": "scope",
          "type": "uint64"
        },
        {
          "name": "chunk_ordinal",
          "type": "uint32"
        },
        {
          "name": "leaf_count",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "archive_family_descriptor",
      "base": "",
      "fields": [
        {
          "name": "kind",
          "type": "string"
        },
        {
          "name": "parent_id",
          "type": "uint64"
        },
        {
          "name": "table",
          "type": "name"
        },
        {
          "name": "scope",
          "type": "uint64"
        },
        {
          "name": "schema_hash",
          "type": "checksum256"
        },
        {
          "name": "records",
          "type": "uint64"
        },
        {
          "name": "chunks",
          "type": "archive_chunk_descriptor[]"
        }
      ]
    },
    {
      "name": "archive_file_reference",
      "base": "",
      "fields": [
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
          "name": "bytes",
          "type": "uint64"
        },
        {
          "name": "commitment",
          "type": "checksum256"
        },
        {
          "name": "envelope_version",
          "type": "uint8"
        },
        {
          "name": "key_epoch",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "archive_manifest_descriptor",
      "base": "",
      "fields": [
        {
          "name": "format_version",
          "type": "uint16"
        },
        {
          "name": "chain_id",
          "type": "checksum256"
        },
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "source",
          "type": "name"
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
          "name": "block_number",
          "type": "uint32"
        },
        {
          "name": "block_id",
          "type": "checksum256"
        },
        {
          "name": "timestamp",
          "type": "string"
        },
        {
          "name": "families",
          "type": "archive_family_descriptor[]"
        },
        {
          "name": "files",
          "type": "archive_file_reference[]"
        }
      ]
    },
    {
      "name": "archive_policy",
      "base": "",
      "fields": [
        {
          "name": "verifier",
          "type": "name"
        },
        {
          "name": "minimum_retention_seconds",
          "type": "uint32"
        },
        {
          "name": "pruning_enabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "archive_position",
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
          "name": "archive_id",
          "type": "uint64"
        },
        {
          "name": "chunk_ordinal",
          "type": "uint32"
        },
        {
          "name": "pruned",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "archive_prune_proof",
      "base": "",
      "fields": [
        {
          "name": "primary_key",
          "type": "uint64"
        },
        {
          "name": "siblings",
          "type": "checksum256[]"
        }
      ]
    },
    {
      "name": "archrevoke",
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
          "name": "manifest_commitment",
          "type": "checksum256"
        },
        {
          "name": "descriptor_commitment",
          "type": "checksum256"
        },
        {
          "name": "backup_commitment",
          "type": "checksum256"
        },
        {
          "name": "retention_seconds",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "archstep",
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
          "name": "archive_id",
          "type": "uint64"
        },
        {
          "name": "chunk_ordinal",
          "type": "uint32"
        },
        {
          "name": "start",
          "type": "uint32"
        },
        {
          "name": "count",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "authproof",
      "base": "",
      "fields": [
        {
          "name": "account",
          "type": "name"
        },
        {
          "name": "intent",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "backfilldocs",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "limit",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "beginram",
      "base": "",
      "fields": [
        {
          "name": "sources",
          "type": "ram_migration_source[]"
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
      "name": "capacity_receipt",
      "base": "",
      "fields": [
        {
          "name": "id",
          "type": "uint64"
        },
        {
          "name": "receipt",
          "type": "checksum256"
        },
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "members",
          "type": "uint32"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "revoked",
          "type": "bool"
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
      "name": "checkrampool",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        }
      ]
    },
    {
      "name": "clearholds",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "recipient",
          "type": "uint64"
        },
        {
          "name": "limit",
          "type": "uint32"
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
      "name": "dao_capacity",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "members",
          "type": "uint32"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "receipt",
          "type": "checksum256"
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
      "name": "docref",
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
          "name": "table",
          "type": "name"
        },
        {
          "name": "source_id",
          "type": "uint64"
        },
        {
          "name": "slot",
          "type": "uint8"
        },
        {
          "name": "document_id",
          "type": "uint64"
        },
        {
          "name": "version",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "docscanstep",
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
          "name": "table",
          "type": "name"
        },
        {
          "name": "start",
          "type": "uint64"
        },
        {
          "name": "next",
          "type": "uint64"
        },
        {
          "name": "complete",
          "type": "bool"
        },
        {
          "name": "scanned",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "docsrc",
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
          "name": "tables",
          "type": "name[]"
        }
      ]
    },
    {
      "name": "document_clock",
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
          "name": "created_at",
          "type": "uint32"
        },
        {
          "name": "legacy",
          "type": "bool"
        },
        {
          "name": "row_hash",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "document_head",
      "base": "",
      "fields": [
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
      "name": "document_reference",
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
          "name": "table",
          "type": "name"
        },
        {
          "name": "source_id",
          "type": "uint64"
        },
        {
          "name": "slot",
          "type": "uint8"
        },
        {
          "name": "document_id",
          "type": "uint64"
        },
        {
          "name": "version",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "document_scan",
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
          "name": "table",
          "type": "name"
        },
        {
          "name": "code_hash",
          "type": "checksum256"
        },
        {
          "name": "cursor",
          "type": "uint64"
        },
        {
          "name": "complete",
          "type": "bool"
        }
      ]
    },
    {
      "name": "document_source",
      "base": "",
      "fields": [
        {
          "name": "source",
          "type": "name"
        },
        {
          "name": "code_hash",
          "type": "checksum256"
        },
        {
          "name": "tables",
          "type": "name[]"
        }
      ]
    },
    {
      "name": "document_state",
      "base": "",
      "fields": [
        {
          "name": "id",
          "type": "uint64"
        },
        {
          "name": "high_water",
          "type": "uint64"
        },
        {
          "name": "cursor",
          "type": "uint64"
        },
        {
          "name": "complete",
          "type": "bool"
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
      "name": "evm_binding_record",
      "base": "",
      "fields": [
        {
          "name": "member_id",
          "type": "uint64"
        },
        {
          "name": "chain_id",
          "type": "uint64"
        },
        {
          "name": "address",
          "type": "checksum160"
        },
        {
          "name": "epoch",
          "type": "uint64"
        },
        {
          "name": "active",
          "type": "bool"
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
      "name": "finance_receipt",
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
          "name": "obligation_id",
          "type": "uint64"
        },
        {
          "name": "recipient",
          "type": "uint64"
        },
        {
          "name": "destination",
          "type": "name"
        },
        {
          "name": "token_contract",
          "type": "name"
        },
        {
          "name": "quantity",
          "type": "asset"
        },
        {
          "name": "at",
          "type": "uint32"
        },
        {
          "name": "transaction_id",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "finishram",
      "base": "",
      "fields": [
        {
          "name": "reference",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "fulfilram",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "reference",
          "type": "checksum256"
        },
        {
          "name": "policy_revision",
          "type": "uint64"
        },
        {
          "name": "maximum",
          "type": "asset"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "purchases",
          "type": "ram_purchase[]"
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
      "name": "govhosted",
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
          "name": "free_members",
          "type": "uint32"
        },
        {
          "name": "settler",
          "type": "name"
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
      "name": "govpayfees",
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
          "name": "bps",
          "type": "uint16"
        }
      ]
    },
    {
      "name": "govresources",
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
          "name": "expected_revision",
          "type": "uint64"
        },
        {
          "name": "native_ram_bps",
          "type": "uint16"
        },
        {
          "name": "card_ram_bps",
          "type": "uint16"
        },
        {
          "name": "included_activity_bytes",
          "type": "uint64"
        },
        {
          "name": "identity_bytes_per_slot",
          "type": "uint64"
        },
        {
          "name": "quote_lifetime_seconds",
          "type": "uint32"
        },
        {
          "name": "storage_free_bytes",
          "type": "uint64"
        },
        {
          "name": "storage_unit_bytes",
          "type": "uint64"
        },
        {
          "name": "storage_monthly_usd",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "govseatfee",
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
          "name": "first_usd",
          "type": "uint32"
        },
        {
          "name": "next_usd",
          "type": "uint32"
        },
        {
          "name": "rest_usd",
          "type": "uint32"
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
      "name": "grantdaoram",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "reference",
          "type": "uint64"
        },
        {
          "name": "activity",
          "type": "uint64"
        },
        {
          "name": "identity",
          "type": "uint64"
        },
        {
          "name": "completion",
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
      "name": "hosted_policy",
      "base": "",
      "fields": [
        {
          "name": "free_members",
          "type": "uint32"
        },
        {
          "name": "settler",
          "type": "name"
        }
      ]
    },
    {
      "name": "inheritram",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "activity_headroom",
          "type": "uint64"
        },
        {
          "name": "identity_headroom",
          "type": "uint64"
        },
        {
          "name": "completion_headroom",
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
      "name": "initramobs",
      "base": "",
      "fields": []
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
      "name": "linkevm",
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
          "name": "evm_chain_id",
          "type": "uint64"
        },
        {
          "name": "address",
          "type": "checksum160"
        },
        {
          "name": "epoch",
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
          "name": "proof",
          "type": "bytes"
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
      "name": "orderfree",
      "base": "",
      "fields": [
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
      "name": "orderram",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "reference",
          "type": "checksum256"
        },
        {
          "name": "policy_revision",
          "type": "uint64"
        },
        {
          "name": "maximum",
          "type": "asset"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "purchases",
          "type": "ram_purchase[]"
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
      "name": "payment_policy",
      "base": "",
      "fields": [
        {
          "name": "bps",
          "type": "uint16"
        },
        {
          "name": "revision",
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
      "name": "prunedocs",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "archive_id",
          "type": "uint64"
        },
        {
          "name": "chunk_ordinal",
          "type": "uint32"
        },
        {
          "name": "start",
          "type": "uint32"
        },
        {
          "name": "proofs",
          "type": "archive_prune_proof[]"
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
      "name": "ram_acquisition",
      "base": "",
      "fields": [
        {
          "name": "receiver",
          "type": "name"
        },
        {
          "name": "quantity",
          "type": "asset"
        },
        {
          "name": "minimum_bytes",
          "type": "uint64"
        },
        {
          "name": "before_bytes",
          "type": "uint64"
        },
        {
          "name": "acquired_bytes",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_allocation",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "purchased_bytes",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_auto_policy",
      "base": "",
      "fields": [
        {
          "name": "enabled",
          "type": "bool"
        },
        {
          "name": "policy_revision",
          "type": "uint64"
        },
        {
          "name": "offers",
          "type": "ram_offer[]"
        }
      ]
    },
    {
      "name": "ram_card_receipt",
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
          "name": "reference",
          "type": "checksum256"
        },
        {
          "name": "operational_bps",
          "type": "uint16"
        },
        {
          "name": "fulfiller",
          "type": "name"
        }
      ]
    },
    {
      "name": "ram_completion_hold",
      "base": "",
      "fields": [
        {
          "name": "id",
          "type": "uint64"
        },
        {
          "name": "recipient",
          "type": "uint64"
        },
        {
          "name": "ready",
          "type": "bool"
        },
        {
          "name": "padding",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "ram_counter",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "identity",
          "type": "uint64"
        },
        {
          "name": "activity",
          "type": "uint64"
        },
        {
          "name": "retained",
          "type": "uint64"
        },
        {
          "name": "platform",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_dao_limit",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "activity",
          "type": "uint64"
        },
        {
          "name": "identity",
          "type": "uint64"
        },
        {
          "name": "completion",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_entitlement",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "policy_revision",
          "type": "uint64"
        },
        {
          "name": "identity_per_slot",
          "type": "uint64"
        },
        {
          "name": "slots",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "ram_grant_receipt",
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
          "name": "payer",
          "type": "name"
        },
        {
          "name": "reference",
          "type": "uint64"
        },
        {
          "name": "activity",
          "type": "uint64"
        },
        {
          "name": "identity",
          "type": "uint64"
        },
        {
          "name": "completion",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_inherited_capacity",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "activity",
          "type": "uint64"
        },
        {
          "name": "identity",
          "type": "uint64"
        },
        {
          "name": "completion",
          "type": "uint64"
        },
        {
          "name": "activity_headroom",
          "type": "uint64"
        },
        {
          "name": "identity_headroom",
          "type": "uint64"
        },
        {
          "name": "completion_headroom",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_migration_cursor",
      "base": "",
      "fields": [
        {
          "name": "table",
          "type": "name"
        },
        {
          "name": "cursor",
          "type": "uint64"
        },
        {
          "name": "advanced",
          "type": "bool"
        },
        {
          "name": "complete",
          "type": "bool"
        }
      ]
    },
    {
      "name": "ram_migration_overlay",
      "base": "",
      "fields": [
        {
          "name": "id",
          "type": "uint64"
        },
        {
          "name": "table",
          "type": "name"
        },
        {
          "name": "row",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_migration_source",
      "base": "",
      "fields": [
        {
          "name": "account",
          "type": "name"
        },
        {
          "name": "kind",
          "type": "uint8"
        },
        {
          "name": "code_hash",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "ram_migration_state",
      "base": "",
      "fields": [
        {
          "name": "active",
          "type": "bool"
        },
        {
          "name": "globals_complete",
          "type": "bool"
        },
        {
          "name": "advanced",
          "type": "bool"
        },
        {
          "name": "dao_cursor",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_observer_config",
      "base": "",
      "fields": [
        {
          "name": "meter_bytes",
          "type": "uint64"
        },
        {
          "name": "runtime_hash",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "ram_offer",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "activity",
          "type": "uint64"
        },
        {
          "name": "completion",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_operator_reserve",
      "base": "",
      "fields": [
        {
          "name": "available",
          "type": "asset"
        }
      ]
    },
    {
      "name": "ram_order",
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
          "name": "reference",
          "type": "checksum256"
        },
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "treasury",
          "type": "name"
        },
        {
          "name": "policy_revision",
          "type": "uint64"
        },
        {
          "name": "fee_bps",
          "type": "uint16"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "maximum",
          "type": "asset"
        },
        {
          "name": "spent",
          "type": "asset"
        },
        {
          "name": "platform_fee",
          "type": "asset"
        },
        {
          "name": "received",
          "type": "asset"
        },
        {
          "name": "purchases",
          "type": "ram_acquisition[]"
        },
        {
          "name": "funded",
          "type": "bool"
        },
        {
          "name": "settled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "ram_payer_owner",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        }
      ]
    },
    {
      "name": "ram_payer_pool",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "quota_bytes",
          "type": "uint64"
        },
        {
          "name": "baseline_bytes",
          "type": "uint64"
        },
        {
          "name": "platform_headroom",
          "type": "uint64"
        },
        {
          "name": "source_hash",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "ram_payment_intent",
      "base": "",
      "fields": [
        {
          "name": "order",
          "type": "ram_order"
        },
        {
          "name": "transaction_id",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "ram_purchase",
      "base": "",
      "fields": [
        {
          "name": "receiver",
          "type": "name"
        },
        {
          "name": "quantity",
          "type": "asset"
        },
        {
          "name": "minimum_bytes",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "ram_source",
      "base": "",
      "fields": [
        {
          "name": "account",
          "type": "name"
        },
        {
          "name": "code_hash",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "ramadjust",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "category",
          "type": "uint8"
        },
        {
          "name": "added",
          "type": "uint64"
        },
        {
          "name": "removed",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "rebindramobs",
      "base": "",
      "fields": [
        {
          "name": "expected_old_hash",
          "type": "checksum256"
        },
        {
          "name": "expected_new_hash",
          "type": "checksum256"
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
      "name": "resource_policy",
      "base": "",
      "fields": [
        {
          "name": "schema_version",
          "type": "uint16"
        },
        {
          "name": "revision",
          "type": "uint64"
        },
        {
          "name": "native_ram_bps",
          "type": "uint16"
        },
        {
          "name": "card_ram_bps",
          "type": "uint16"
        },
        {
          "name": "included_activity_bytes",
          "type": "uint64"
        },
        {
          "name": "identity_bytes_per_slot",
          "type": "uint64"
        },
        {
          "name": "quote_lifetime_seconds",
          "type": "uint32"
        },
        {
          "name": "grace_seconds",
          "type": "uint32"
        },
        {
          "name": "storage_free_bytes",
          "type": "uint64"
        },
        {
          "name": "storage_unit_bytes",
          "type": "uint64"
        },
        {
          "name": "storage_monthly_usd",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "restoredoc",
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
          "name": "original",
          "type": "document_record"
        }
      ]
    },
    {
      "name": "resumecap",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "receipt",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "revokecap",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "receipt",
          "type": "checksum256"
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
      "name": "scanram",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "table",
          "type": "name"
        },
        {
          "name": "limit",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "sealram",
      "base": "",
      "fields": [
        {
          "name": "limit",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "seat_policy",
      "base": "",
      "fields": [
        {
          "name": "first_usd",
          "type": "uint32"
        },
        {
          "name": "next_usd",
          "type": "uint32"
        },
        {
          "name": "rest_usd",
          "type": "uint32"
        },
        {
          "name": "revision",
          "type": "uint64"
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
      "name": "setadmit",
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
          "name": "enabled",
          "type": "bool"
        },
        {
          "name": "source",
          "type": "name"
        },
        {
          "name": "threshold",
          "type": "uint8"
        },
        {
          "name": "allow_agents",
          "type": "bool"
        },
        {
          "name": "admin_override",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setarchcfg",
      "base": "",
      "fields": [
        {
          "name": "verifier",
          "type": "name"
        },
        {
          "name": "minimum_retention_seconds",
          "type": "uint32"
        },
        {
          "name": "pruning_enabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setcapacity",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "member_limit",
          "type": "uint32"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "receipt",
          "type": "checksum256"
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
      "name": "sethosted",
      "base": "",
      "fields": [
        {
          "name": "free_members",
          "type": "uint32"
        },
        {
          "name": "settler",
          "type": "name"
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
      "name": "setramauto",
      "base": "",
      "fields": [
        {
          "name": "enabled",
          "type": "bool"
        },
        {
          "name": "offers",
          "type": "ram_offer[]"
        }
      ]
    },
    {
      "name": "setramcode",
      "base": "",
      "fields": [
        {
          "name": "account",
          "type": "name"
        },
        {
          "name": "code_hash",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "setrampool",
      "base": "",
      "fields": [
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "expected_quota",
          "type": "uint64"
        },
        {
          "name": "baseline_bytes",
          "type": "uint64"
        },
        {
          "name": "platform_headroom",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "setresources",
      "base": "",
      "fields": [
        {
          "name": "native_ram_bps",
          "type": "uint16"
        },
        {
          "name": "card_ram_bps",
          "type": "uint16"
        },
        {
          "name": "included_activity_bytes",
          "type": "uint64"
        },
        {
          "name": "identity_bytes_per_slot",
          "type": "uint64"
        },
        {
          "name": "quote_lifetime_seconds",
          "type": "uint32"
        },
        {
          "name": "storage_free_bytes",
          "type": "uint64"
        },
        {
          "name": "storage_unit_bytes",
          "type": "uint64"
        },
        {
          "name": "storage_monthly_usd",
          "type": "uint32"
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
      "name": "submitevm",
      "base": "",
      "fields": [
        {
          "name": "request",
          "type": "instruction"
        },
        {
          "name": "evm_chain_id",
          "type": "uint64"
        },
        {
          "name": "address",
          "type": "checksum160"
        },
        {
          "name": "binding_epoch",
          "type": "uint64"
        },
        {
          "name": "proof",
          "type": "bytes"
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
      "name": "unlinkevm",
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
      "name": "unlinknat",
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
      "name": "admitfrom",
      "type": "admitfrom",
      "ricardian_contract": ""
    },
    {
      "name": "adoptram",
      "type": "adoptram",
      "ricardian_contract": ""
    },
    {
      "name": "approveob",
      "type": "approveob",
      "ricardian_contract": ""
    },
    {
      "name": "archapprove",
      "type": "archapprove",
      "ricardian_contract": ""
    },
    {
      "name": "archattest",
      "type": "archattest",
      "ricardian_contract": ""
    },
    {
      "name": "archrevoke",
      "type": "archrevoke",
      "ricardian_contract": ""
    },
    {
      "name": "archstep",
      "type": "archstep",
      "ricardian_contract": ""
    },
    {
      "name": "authproof",
      "type": "authproof",
      "ricardian_contract": ""
    },
    {
      "name": "backfilldocs",
      "type": "backfilldocs",
      "ricardian_contract": ""
    },
    {
      "name": "beginram",
      "type": "beginram",
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
      "name": "checkrampool",
      "type": "checkrampool",
      "ricardian_contract": ""
    },
    {
      "name": "clearholds",
      "type": "clearholds",
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
      "name": "docref",
      "type": "docref",
      "ricardian_contract": ""
    },
    {
      "name": "docscanstep",
      "type": "docscanstep",
      "ricardian_contract": ""
    },
    {
      "name": "docsrc",
      "type": "docsrc",
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
      "name": "finishram",
      "type": "finishram",
      "ricardian_contract": ""
    },
    {
      "name": "fulfilram",
      "type": "fulfilram",
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
      "name": "govhosted",
      "type": "govhosted",
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
      "name": "govpayfees",
      "type": "govpayfees",
      "ricardian_contract": ""
    },
    {
      "name": "govresources",
      "type": "govresources",
      "ricardian_contract": ""
    },
    {
      "name": "govseatfee",
      "type": "govseatfee",
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
      "name": "grantdaoram",
      "type": "grantdaoram",
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
      "name": "inheritram",
      "type": "inheritram",
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
      "name": "initramobs",
      "type": "initramobs",
      "ricardian_contract": ""
    },
    {
      "name": "linkevm",
      "type": "linkevm",
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
      "name": "orderfree",
      "type": "orderfree",
      "ricardian_contract": ""
    },
    {
      "name": "orderram",
      "type": "orderram",
      "ricardian_contract": ""
    },
    {
      "name": "payob",
      "type": "payob",
      "ricardian_contract": ""
    },
    {
      "name": "prunedocs",
      "type": "prunedocs",
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
      "name": "ramadjust",
      "type": "ramadjust",
      "ricardian_contract": ""
    },
    {
      "name": "rebindramobs",
      "type": "rebindramobs",
      "ricardian_contract": ""
    },
    {
      "name": "reserve",
      "type": "reserve",
      "ricardian_contract": ""
    },
    {
      "name": "restoredoc",
      "type": "restoredoc",
      "ricardian_contract": ""
    },
    {
      "name": "resumecap",
      "type": "resumecap",
      "ricardian_contract": ""
    },
    {
      "name": "revokecap",
      "type": "revokecap",
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
      "name": "scanram",
      "type": "scanram",
      "ricardian_contract": ""
    },
    {
      "name": "sealram",
      "type": "sealram",
      "ricardian_contract": ""
    },
    {
      "name": "setactive",
      "type": "setactive",
      "ricardian_contract": ""
    },
    {
      "name": "setadmit",
      "type": "setadmit",
      "ricardian_contract": ""
    },
    {
      "name": "setarchcfg",
      "type": "setarchcfg",
      "ricardian_contract": ""
    },
    {
      "name": "setcapacity",
      "type": "setcapacity",
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
      "name": "sethosted",
      "type": "sethosted",
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
      "name": "setramauto",
      "type": "setramauto",
      "ricardian_contract": ""
    },
    {
      "name": "setramcode",
      "type": "setramcode",
      "ricardian_contract": ""
    },
    {
      "name": "setrampool",
      "type": "setrampool",
      "ricardian_contract": ""
    },
    {
      "name": "setresources",
      "type": "setresources",
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
      "name": "submitevm",
      "type": "submitevm",
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
      "name": "unlinkevm",
      "type": "unlinkevm",
      "ricardian_contract": ""
    },
    {
      "name": "unlinknat",
      "type": "unlinknat",
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
      "name": "admpolicies",
      "type": "admission_policy",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "archcfg",
      "type": "archive_policy",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "archives",
      "type": "archive_anchor",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "archpos",
      "type": "archive_position",
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
      "name": "capcfg",
      "type": "hosted_policy",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "capreceipts",
      "type": "capacity_receipt",
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
      "name": "daocaps",
      "type": "dao_capacity",
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
      "name": "docclocks",
      "type": "document_clock",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "docheads",
      "type": "document_head",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "docrefs",
      "type": "document_reference",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "docscan",
      "type": "document_scan",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "docsrcs",
      "type": "document_source",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "docstate",
      "type": "document_state",
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
      "name": "evmbindings",
      "type": "evm_binding_record",
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
      "name": "paycfg",
      "type": "payment_policy",
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
      "name": "ramalloc",
      "type": "ram_allocation",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramauto",
      "type": "ram_auto_policy",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramcards",
      "type": "ram_card_receipt",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramclmholds",
      "type": "ram_completion_hold",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramcursors",
      "type": "ram_migration_cursor",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramentitle",
      "type": "ram_entitlement",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramgrants",
      "type": "ram_grant_receipt",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramholds",
      "type": "ram_completion_hold",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "raminherit",
      "type": "ram_inherited_capacity",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramintent",
      "type": "ram_payment_intent",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramlimits",
      "type": "ram_dao_limit",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "rammigrate",
      "type": "ram_migration_state",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "rammigsrcs",
      "type": "ram_migration_source",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramobs",
      "type": "ram_observer_config",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramorders",
      "type": "ram_order",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramoverlays",
      "type": "ram_migration_overlay",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "rampayer",
      "type": "ram_payer_owner",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "rampools",
      "type": "ram_payer_pool",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramreserve",
      "type": "ram_operator_reserve",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramsources",
      "type": "ram_source",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "ramstats",
      "type": "ram_counter",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "receipts",
      "type": "finance_receipt",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "resourcecfg",
      "type": "resource_policy",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "seatcfg",
      "type": "seat_policy",
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
export interface admission_policy {
  dao_id: string;
  revision: string;
  mode: number;
  source: string;
  threshold: number;
  allow_agents: boolean;
  admin_override: boolean;
}
export interface admitfrom {
  dao_id: string;
  source: string;
  application_id: string;
  revision: string;
}
export interface adoptram {
  dao_id: string;
  claims: boolean;
  limit: number;
}
export interface approveob {
  dao_id: string;
  source: string;
  source_id: string;
}
export interface archapprove {
  runtime: string;
  dao_id: string;
  member_id: string;
  manifest_commitment: string;
  descriptor_commitment: string;
  backup_commitment: string;
  retention_seconds: number;
}
export interface archattest {
  dao_id: string;
  manifest: archive_manifest_descriptor;
  manifest_cid: string;
  manifest_bytes: number;
  manifest_commitment: string;
  backup_commitment: string;
  retention_seconds: number;
}
export interface archive_anchor {
  id: string;
  dao_id: string;
  manifest: archive_manifest_descriptor;
  manifest_cid: string;
  manifest_bytes: number;
  manifest_commitment: string;
  descriptor_commitment: string;
  backup_commitment: string;
  verifier: string;
  attestation_transaction: string;
  approval_transaction: string;
  retention_seconds: number;
  attested_at: number;
  approved_by: string;
  approved_at: number;
  revoked: boolean;
}
export interface archive_chunk_descriptor {
  domain: archive_domain;
  root: string;
  cid: string;
  bytes: number;
  commitment: string;
  first_key: string;
  last_key: string;
}
export interface archive_domain {
  format_version: number;
  chain_id: string;
  runtime: string;
  dao_id: string;
  source: string;
  code_hash: string;
  abi_hash: string;
  schema_hash: string;
  table: string;
  scope: string;
  chunk_ordinal: number;
  leaf_count: number;
}
export interface archive_family_descriptor {
  kind: string;
  parent_id: string;
  table: string;
  scope: string;
  schema_hash: string;
  records: string;
  chunks: archive_chunk_descriptor[];
}
export interface archive_file_reference {
  document_id: string;
  version: number;
  cid: string;
  bytes: string;
  commitment: string;
  envelope_version: number;
  key_epoch: string;
}
export interface archive_manifest_descriptor {
  format_version: number;
  chain_id: string;
  runtime: string;
  dao_id: string;
  source: string;
  code_hash: string;
  abi_hash: string;
  block_number: number;
  block_id: string;
  timestamp: string;
  families: archive_family_descriptor[];
  files: archive_file_reference[];
}
export interface archive_policy {
  verifier: string;
  minimum_retention_seconds: number;
  pruning_enabled: boolean;
}
export interface archive_position {
  id: string;
  dao_id: string;
  archive_id: string;
  chunk_ordinal: number;
  pruned: number;
}
export interface archive_prune_proof {
  primary_key: string;
  siblings: string[];
}
export interface archrevoke {
  runtime: string;
  dao_id: string;
  member_id: string;
  manifest_commitment: string;
  descriptor_commitment: string;
  backup_commitment: string;
  retention_seconds: number;
}
export interface archstep {
  dao_id: string;
  source: string;
  archive_id: string;
  chunk_ordinal: number;
  start: number;
  count: number;
}
export interface authproof {
  account: string;
  intent: string;
}
export interface backfilldocs {
  dao_id: string;
  limit: number;
}
export interface beginram {
  sources: ram_migration_source[];
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
export interface capacity_receipt {
  id: string;
  receipt: string;
  dao_id: string;
  members: number;
  expires: number;
  revoked: boolean;
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
export interface checkrampool {
  payer: string;
}
export interface clearholds {
  dao_id: string;
  recipient: string;
  limit: number;
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
export interface dao_capacity {
  dao_id: string;
  members: number;
  expires: number;
  receipt: string;
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
export interface docref {
  dao_id: string;
  source: string;
  table: string;
  source_id: string;
  slot: number;
  document_id: string;
  version: number;
}
export interface docscanstep {
  dao_id: string;
  source: string;
  table: string;
  start: string;
  next: string;
  complete: boolean;
  scanned: number;
}
export interface docsrc {
  dao_id: string;
  source: string;
  tables: string[];
}
export interface document_clock {
  id: string;
  document_id: string;
  version: number;
  created_at: number;
  legacy: boolean;
  row_hash: string;
}
export interface document_head {
  document_id: string;
  version: number;
  author: string;
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
export interface document_reference {
  id: string;
  source: string;
  table: string;
  source_id: string;
  slot: number;
  document_id: string;
  version: number;
}
export interface document_scan {
  id: string;
  source: string;
  table: string;
  code_hash: string;
  cursor: string;
  complete: boolean;
}
export interface document_source {
  source: string;
  code_hash: string;
  tables: string[];
}
export interface document_state {
  id: string;
  high_water: string;
  cursor: string;
  complete: boolean;
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
export interface evm_binding_record {
  member_id: string;
  chain_id: string;
  address: string;
  epoch: string;
  active: boolean;
}
export interface fee_config {
  third_party_bps: number;
  first_party_bps: number;
  treasury: string;
  token_contract: string;
  token_symbol: string;
  names: string;
}
export interface finance_receipt {
  id: string;
  kind: number;
  obligation_id: string;
  recipient: string;
  destination: string;
  token_contract: string;
  quantity: string;
  at: number;
  transaction_id: string;
}
export interface finishram {
  reference: string;
}
export interface fulfilram {
  dao_id: string;
  reference: string;
  policy_revision: string;
  maximum: string;
  expires: number;
  purchases: ram_purchase[];
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
export interface govhosted {
  runtime: string;
  dao_id: string;
  member_id: string;
  free_members: number;
  settler: string;
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
export interface govpayfees {
  runtime: string;
  dao_id: string;
  member_id: string;
  bps: number;
}
export interface govresources {
  runtime: string;
  dao_id: string;
  member_id: string;
  expected_revision: string;
  native_ram_bps: number;
  card_ram_bps: number;
  included_activity_bytes: string;
  identity_bytes_per_slot: string;
  quote_lifetime_seconds: number;
  storage_free_bytes: string;
  storage_unit_bytes: string;
  storage_monthly_usd: number;
}
export interface govseatfee {
  runtime: string;
  dao_id: string;
  member_id: string;
  first_usd: number;
  next_usd: number;
  rest_usd: number;
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
export interface grantdaoram {
  dao_id: string;
  payer: string;
  reference: string;
  activity: string;
  identity: string;
  completion: string;
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
export interface hosted_policy {
  free_members: number;
  settler: string;
}
export interface inheritram {
  dao_id: string;
  payer: string;
  activity_headroom: string;
  identity_headroom: string;
  completion_headroom: string;
}
export interface init {
  chain_id: string;
}
export interface initgov {
  dao_id: string;
  settings: gov_settings;
}
export interface initramobs {

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
export interface linkevm {
  runtime: string;
  dao_id: string;
  member_id: string;
  evm_chain_id: string;
  address: string;
  epoch: string;
  nonce: string;
  expires: number;
  proof: string;
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
export interface orderfree {
  reference: string;
  creator: string;
}
export interface orderram {
  dao_id: string;
  payer: string;
  reference: string;
  policy_revision: string;
  maximum: string;
  expires: number;
  purchases: ram_purchase[];
}
export interface participant_record {
  id: string;
  kind: number;
  operator_label: string;
  revoked: boolean;
  credential_epoch: string;
}
export interface payment_policy {
  bps: number;
  revision: string;
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
export interface prunedocs {
  dao_id: string;
  archive_id: string;
  chunk_ordinal: number;
  start: number;
  proofs: archive_prune_proof[];
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
export interface ram_acquisition {
  receiver: string;
  quantity: string;
  minimum_bytes: string;
  before_bytes: string;
  acquired_bytes: string;
}
export interface ram_allocation {
  payer: string;
  purchased_bytes: string;
}
export interface ram_auto_policy {
  enabled: boolean;
  policy_revision: string;
  offers: ram_offer[];
}
export interface ram_card_receipt {
  id: string;
  dao_id: string;
  reference: string;
  operational_bps: number;
  fulfiller: string;
}
export interface ram_completion_hold {
  id: string;
  recipient: string;
  ready: boolean;
  padding: string;
}
export interface ram_counter {
  payer: string;
  identity: string;
  activity: string;
  retained: string;
  platform: string;
}
export interface ram_dao_limit {
  payer: string;
  activity: string;
  identity: string;
  completion: string;
}
export interface ram_entitlement {
  payer: string;
  policy_revision: string;
  identity_per_slot: string;
  slots: number;
}
export interface ram_grant_receipt {
  id: string;
  dao_id: string;
  payer: string;
  reference: string;
  activity: string;
  identity: string;
  completion: string;
}
export interface ram_inherited_capacity {
  payer: string;
  activity: string;
  identity: string;
  completion: string;
  activity_headroom: string;
  identity_headroom: string;
  completion_headroom: string;
}
export interface ram_migration_cursor {
  table: string;
  cursor: string;
  advanced: boolean;
  complete: boolean;
}
export interface ram_migration_overlay {
  id: string;
  table: string;
  row: string;
}
export interface ram_migration_source {
  account: string;
  kind: number;
  code_hash: string;
}
export interface ram_migration_state {
  active: boolean;
  globals_complete: boolean;
  advanced: boolean;
  dao_cursor: string;
}
export interface ram_observer_config {
  meter_bytes: string;
  runtime_hash: string;
}
export interface ram_offer {
  payer: string;
  activity: string;
  completion: string;
}
export interface ram_operator_reserve {
  available: string;
}
export interface ram_order {
  id: string;
  dao_id: string;
  reference: string;
  payer: string;
  treasury: string;
  policy_revision: string;
  fee_bps: number;
  expires: number;
  maximum: string;
  spent: string;
  platform_fee: string;
  received: string;
  purchases: ram_acquisition[];
  funded: boolean;
  settled: boolean;
}
export interface ram_payer_owner {
  runtime: string;
}
export interface ram_payer_pool {
  payer: string;
  quota_bytes: string;
  baseline_bytes: string;
  platform_headroom: string;
  source_hash: string;
}
export interface ram_payment_intent {
  order: ram_order;
  transaction_id: string;
}
export interface ram_purchase {
  receiver: string;
  quantity: string;
  minimum_bytes: string;
}
export interface ram_source {
  account: string;
  code_hash: string;
}
export interface ramadjust {
  dao_id: string;
  payer: string;
  category: number;
  added: string;
  removed: string;
}
export interface rebindramobs {
  expected_old_hash: string;
  expected_new_hash: string;
}
export interface reserve {
  dao_id: string;
  source: string;
  source_id: string;
  recipient: string;
  quantity: string;
  due: number;
}
export interface resource_policy {
  schema_version: number;
  revision: string;
  native_ram_bps: number;
  card_ram_bps: number;
  included_activity_bytes: string;
  identity_bytes_per_slot: string;
  quote_lifetime_seconds: number;
  grace_seconds: number;
  storage_free_bytes: string;
  storage_unit_bytes: string;
  storage_monthly_usd: number;
}
export interface restoredoc {
  runtime: string;
  dao_id: string;
  member_id: string;
  original: document_record;
}
export interface resumecap {
  dao_id: string;
  receipt: string;
}
export interface revokecap {
  dao_id: string;
  receipt: string;
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
export interface scanram {
  dao_id: string;
  table: string;
  limit: number;
}
export interface sealram {
  limit: number;
}
export interface seat_policy {
  first_usd: number;
  next_usd: number;
  rest_usd: number;
  revision: string;
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
export interface setadmit {
  runtime: string;
  dao_id: string;
  member_id: string;
  enabled: boolean;
  source: string;
  threshold: number;
  allow_agents: boolean;
  admin_override: boolean;
}
export interface setarchcfg {
  verifier: string;
  minimum_retention_seconds: number;
  pruning_enabled: boolean;
}
export interface setcapacity {
  dao_id: string;
  member_limit: number;
  expires: number;
  receipt: string;
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
export interface sethosted {
  free_members: number;
  settler: string;
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
export interface setramauto {
  enabled: boolean;
  offers: ram_offer[];
}
export interface setramcode {
  account: string;
  code_hash: string;
}
export interface setrampool {
  payer: string;
  expected_quota: string;
  baseline_bytes: string;
  platform_headroom: string;
}
export interface setresources {
  native_ram_bps: number;
  card_ram_bps: number;
  included_activity_bytes: string;
  identity_bytes_per_slot: string;
  quote_lifetime_seconds: number;
  storage_free_bytes: string;
  storage_unit_bytes: string;
  storage_monthly_usd: number;
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
export interface submitevm {
  request: instruction;
  evm_chain_id: string;
  address: string;
  binding_epoch: string;
  proof: string;
}
export interface submitnat {
  request: instruction;
}
export interface submitsess {
  request: instruction;
  session_id: string;
  sig: string;
}
export interface unlinkevm {
  runtime: string;
  dao_id: string;
  member_id: string;
}
export interface unlinknat {
  runtime: string;
  dao_id: string;
  member_id: string;
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
  admitfrom: admitfrom;
  adoptram: adoptram;
  approveob: approveob;
  archapprove: archapprove;
  archattest: archattest;
  archrevoke: archrevoke;
  archstep: archstep;
  authproof: authproof;
  backfilldocs: backfilldocs;
  beginram: beginram;
  cancelob: cancelob;
  cardcreate: cardcreate;
  checkrampool: checkrampool;
  clearholds: clearholds;
  commitepoch: commitepoch;
  confirmext: confirmext;
  createdao: createdao;
  createpaid: createpaid;
  delsession: delsession;
  docref: docref;
  docscanstep: docscanstep;
  docsrc: docsrc;
  enroll: enroll;
  enrollagent: enrollagent;
  finishram: finishram;
  fulfilram: fulfilram;
  govcreate: govcreate;
  govfees: govfees;
  govhosted: govhosted;
  govlist: govlist;
  govlock: govlock;
  govmodcopy: govmodcopy;
  govpayfees: govpayfees;
  govresources: govresources;
  govseatfee: govseatfee;
  govunlist: govunlist;
  govunlock: govunlock;
  grantcredit: grantcredit;
  grantdaoram: grantdaoram;
  grantkey: grantkey;
  guardpause: guardpause;
  guardrecover: guardrecover;
  guardrevoke: guardrevoke;
  inheritram: inheritram;
  init: init;
  initgov: initgov;
  initramobs: initramobs;
  linkevm: linkevm;
  linknative: linknative;
  listmod: listmod;
  modconfig: modconfig;
  ordercreate: ordercreate;
  orderfree: orderfree;
  orderram: orderram;
  payob: payob;
  prunedocs: prunedocs;
  putdoc: putdoc;
  putjson: putjson;
  ramadjust: ramadjust;
  rebindramobs: rebindramobs;
  reserve: reserve;
  restoredoc: restoredoc;
  resumecap: resumecap;
  revokecap: revokecap;
  rotateepoch: rotateepoch;
  rotatekey: rotatekey;
  scanram: scanram;
  sealram: sealram;
  setactive: setactive;
  setadmit: setadmit;
  setarchcfg: setarchcfg;
  setcapacity: setcapacity;
  setcreate: setcreate;
  setcredits: setcredits;
  setcrrate: setcrrate;
  setdaogov: setdaogov;
  setfees: setfees;
  setgov: setgov;
  sethosted: sethosted;
  setmeta: setmeta;
  setmodcopy: setmodcopy;
  setmodule: setmodule;
  setoracle: setoracle;
  setpolicy: setpolicy;
  setprofile: setprofile;
  setramauto: setramauto;
  setramcode: setramcode;
  setrampool: setrampool;
  setresources: setresources;
  setroles: setroles;
  submit: submit;
  submitevm: submitevm;
  submitnat: submitnat;
  submitsess: submitsess;
  unlinkevm: unlinkevm;
  unlinknat: unlinknat;
  unlistmod: unlistmod;
  unstake: unstake;
  withdraw: withdraw;
}
