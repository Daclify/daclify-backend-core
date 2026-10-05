// Generated from compiled C++ ABI. Regenerate with npm run codegen; do not edit.
import type { ABI } from '@wharfkit/antelope';
export const runtimeAbiHash = '0dc54e3ec8dd514577c4b11d10530c16e0bdc35ce76e0ae0e69d851d12e366b0';
export const runtimeAbi = {
  "version": "eosio::abi/1.2",
  "types": [],
  "structs": [
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
      "name": "enroll",
      "type": "enroll",
      "ricardian_contract": ""
    },
    {
      "name": "govlock",
      "type": "govlock",
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
      "name": "init",
      "type": "init",
      "ricardian_contract": ""
    },
    {
      "name": "linknative",
      "type": "linknative",
      "ricardian_contract": ""
    },
    {
      "name": "modconfig",
      "type": "modconfig",
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
      "name": "setcredits",
      "type": "setcredits",
      "ricardian_contract": ""
    },
    {
      "name": "setmeta",
      "type": "setmeta",
      "ricardian_contract": ""
    },
    {
      "name": "setmodule",
      "type": "setmodule",
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
      "name": "govlocks",
      "type": "governance_lock",
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
export interface approveob {
  dao_id: string;
  source: string;
  source_id: string;
}
export interface cancelob {
  dao_id: string;
  source: string;
  source_id: string;
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
export interface governance_lock {
  id: string;
  source: string;
  source_id: string;
  expires: number;
  active: boolean;
}
export interface govlock {
  dao_id: string;
  source: string;
  source_id: string;
  expires: number;
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
export interface init {
  chain_id: string;
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
export interface payob {
  dao_id: string;
  source: string;
  source_id: string;
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
export interface setactive {
  runtime: string;
  dao_id: string;
  member_id: string;
  target: string;
  active: boolean;
}
export interface setcredits {
  runtime: string;
  dao_id: string;
  member_id: string;
  target: string;
  quantity: string;
}
export interface setmeta {
  runtime: string;
  dao_id: string;
  member_id: string;
  metadata: string;
}
export interface setmodule {
  dao_id: string;
  account: string;
  version: number;
  actions: string[];
  grants: string[];
  code_hash: string;
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
  approveob: approveob;
  cancelob: cancelob;
  commitepoch: commitepoch;
  confirmext: confirmext;
  createdao: createdao;
  enroll: enroll;
  govlock: govlock;
  govunlock: govunlock;
  grantcredit: grantcredit;
  grantkey: grantkey;
  init: init;
  linknative: linknative;
  modconfig: modconfig;
  payob: payob;
  putdoc: putdoc;
  putjson: putjson;
  reserve: reserve;
  rotateepoch: rotateepoch;
  rotatekey: rotatekey;
  setactive: setactive;
  setcredits: setcredits;
  setmeta: setmeta;
  setmodule: setmodule;
  setroles: setroles;
  submit: submit;
  submitnat: submitnat;
  unstake: unstake;
  withdraw: withdraw;
}
