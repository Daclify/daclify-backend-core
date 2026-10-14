// Generated from compiled C++ ABI. Regenerate with npm run codegen; do not edit.
import type { ABI } from '@wharfkit/antelope';
export const appjoinAbiHash = 'a25412fa02f065a1938112ebbfab000484fc01a05e7fdada0183215607e4f25a';
export const appjoinAbi = {
  "version": "eosio::abi/1.2",
  "types": [],
  "structs": [
    {
      "name": "app_invitation",
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
          "name": "app_id",
          "type": "uint64"
        },
        {
          "name": "app_revision",
          "type": "uint64"
        },
        {
          "name": "policy_revision",
          "type": "uint64"
        },
        {
          "name": "inviter",
          "type": "uint64"
        },
        {
          "name": "token_hash",
          "type": "checksum256"
        },
        {
          "name": "invitation_key",
          "type": "public_key"
        },
        {
          "name": "admin",
          "type": "bool"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "revoked",
          "type": "bool"
        },
        {
          "name": "member_id",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "app_join_policy",
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
          "name": "app_id",
          "type": "uint64"
        },
        {
          "name": "app_revision",
          "type": "uint64"
        },
        {
          "name": "revision",
          "type": "uint64"
        },
        {
          "name": "gateway",
          "type": "name"
        },
        {
          "name": "gateway_permission",
          "type": "name"
        },
        {
          "name": "public_join",
          "type": "bool"
        },
        {
          "name": "enabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "app_join_proof",
      "base": "",
      "fields": [
        {
          "name": "version",
          "type": "uint16"
        },
        {
          "name": "action",
          "type": "name"
        },
        {
          "name": "source",
          "type": "name"
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
          "name": "app_id",
          "type": "uint64"
        },
        {
          "name": "app_revision",
          "type": "uint64"
        },
        {
          "name": "invitation_id",
          "type": "uint64"
        },
        {
          "name": "token_hash",
          "type": "checksum256"
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
          "name": "expires",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "app_join_settings",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "chain_id",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "appadmit",
      "base": "",
      "fields": [
        {
          "name": "proof",
          "type": "app_join_proof"
        },
        {
          "name": "invitation_signature",
          "type": "signature$"
        }
      ]
    },
    {
      "name": "appinvite",
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
          "name": "app_id",
          "type": "uint64"
        },
        {
          "name": "app_revision",
          "type": "uint64"
        },
        {
          "name": "invitation_id",
          "type": "uint64"
        },
        {
          "name": "token_hash",
          "type": "checksum256"
        },
        {
          "name": "invitation_key",
          "type": "public_key"
        },
        {
          "name": "admin",
          "type": "bool"
        },
        {
          "name": "expires",
          "type": "uint32"
        },
        {
          "name": "revoke",
          "type": "bool"
        }
      ]
    },
    {
      "name": "bindrampool",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        }
      ]
    },
    {
      "name": "checkmig",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "kind",
          "type": "uint8"
        }
      ]
    },
    {
      "name": "checkquota",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "dao_id",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "clearclose",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "dao_id",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "closure_check",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
          "type": "uint64"
        },
        {
          "name": "code_hash",
          "type": "checksum256"
        },
        {
          "name": "closing_at",
          "type": "uint32"
        },
        {
          "name": "stage",
          "type": "uint8"
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
      "name": "init",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        }
      ]
    },
    {
      "name": "pruneappinv",
      "base": "",
      "fields": [
        {
          "name": "dao_id",
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
      "name": "scanclose",
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
          "name": "limit",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "scanram",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
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
      "name": "setappjoin",
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
          "name": "app_id",
          "type": "uint64"
        },
        {
          "name": "app_revision",
          "type": "uint64"
        },
        {
          "name": "gateway",
          "type": "name"
        },
        {
          "name": "gateway_permission",
          "type": "name"
        },
        {
          "name": "public_join",
          "type": "bool"
        },
        {
          "name": "enabled",
          "type": "bool"
        }
      ]
    }
  ],
  "actions": [
    {
      "name": "appadmit",
      "type": "appadmit",
      "ricardian_contract": ""
    },
    {
      "name": "appinvite",
      "type": "appinvite",
      "ricardian_contract": ""
    },
    {
      "name": "bindrampool",
      "type": "bindrampool",
      "ricardian_contract": ""
    },
    {
      "name": "checkmig",
      "type": "checkmig",
      "ricardian_contract": ""
    },
    {
      "name": "checkquota",
      "type": "checkquota",
      "ricardian_contract": ""
    },
    {
      "name": "clearclose",
      "type": "clearclose",
      "ricardian_contract": ""
    },
    {
      "name": "init",
      "type": "init",
      "ricardian_contract": ""
    },
    {
      "name": "pruneappinv",
      "type": "pruneappinv",
      "ricardian_contract": ""
    },
    {
      "name": "scanclose",
      "type": "scanclose",
      "ricardian_contract": ""
    },
    {
      "name": "scanram",
      "type": "scanram",
      "ricardian_contract": ""
    },
    {
      "name": "setappjoin",
      "type": "setappjoin",
      "ricardian_contract": ""
    }
  ],
  "tables": [
    {
      "name": "appinvites",
      "type": "app_invitation",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "appjoins",
      "type": "app_join_policy",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "closechecks",
      "type": "closure_check",
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
      "name": "settings",
      "type": "app_join_settings",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    }
  ],
  "variants": [],
  "ricardian_clauses": [],
  "action_results": []
} satisfies ABI.Def;
export interface app_invitation {
  id: string;
  dao_id: string;
  app_id: string;
  app_revision: string;
  policy_revision: string;
  inviter: string;
  token_hash: string;
  invitation_key: string;
  admin: boolean;
  expires: number;
  revoked: boolean;
  member_id: string;
}
export interface app_join_policy {
  id: string;
  dao_id: string;
  app_id: string;
  app_revision: string;
  revision: string;
  gateway: string;
  gateway_permission: string;
  public_join: boolean;
  enabled: boolean;
}
export interface app_join_proof {
  version: number;
  action: string;
  source: string;
  chain_id: string;
  runtime: string;
  dao_id: string;
  app_id: string;
  app_revision: string;
  invitation_id: string;
  token_hash: string;
  signing_key: string;
  encryption_key: string;
  custody: number;
  expires: number;
}
export interface app_join_settings {
  runtime: string;
  chain_id: string;
}
export interface appadmit {
  proof: app_join_proof;
  invitation_signature?: string | undefined;
}
export interface appinvite {
  runtime: string;
  dao_id: string;
  member_id: string;
  app_id: string;
  app_revision: string;
  invitation_id: string;
  token_hash: string;
  invitation_key: string;
  admin: boolean;
  expires: number;
  revoke: boolean;
}
export interface bindrampool {
  runtime: string;
}
export interface checkmig {
  runtime: string;
  kind: number;
}
export interface checkquota {
  runtime: string;
  dao_id: string;
}
export interface clearclose {
  runtime: string;
  dao_id: string;
}
export interface closure_check {
  dao_id: string;
  code_hash: string;
  closing_at: number;
  stage: number;
  cursor: string;
  complete: boolean;
}
export interface init {
  runtime: string;
}
export interface pruneappinv {
  dao_id: string;
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
export interface ram_payer_owner {
  runtime: string;
}
export interface scanclose {
  runtime: string;
  dao_id: string;
  limit: number;
}
export interface scanram {
  runtime: string;
  table: string;
  limit: number;
}
export interface setappjoin {
  runtime: string;
  dao_id: string;
  member_id: string;
  app_id: string;
  app_revision: string;
  gateway: string;
  gateway_permission: string;
  public_join: boolean;
  enabled: boolean;
}
export interface AppjoinActions {
  appadmit: appadmit;
  appinvite: appinvite;
  bindrampool: bindrampool;
  checkmig: checkmig;
  checkquota: checkquota;
  clearclose: clearclose;
  init: init;
  pruneappinv: pruneappinv;
  scanclose: scanclose;
  scanram: scanram;
  setappjoin: setappjoin;
}
