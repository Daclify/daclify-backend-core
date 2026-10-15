// Generated from compiled C++ ABI. Regenerate with npm run codegen; do not edit.
import type { ABI } from '@wharfkit/antelope';
export const quickauthAbiHash = 'e2a8f74aa227dff447fb38ed85965cbb6180c445f23ec2f4c30f123159652ae9';
export const quickauthAbi = {
  "version": "eosio::abi/1.2",
  "types": [],
  "structs": [
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
      "name": "permission_level",
      "base": "",
      "fields": [
        {
          "name": "actor",
          "type": "name"
        },
        {
          "name": "permission",
          "type": "name"
        }
      ]
    },
    {
      "name": "qconfig",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
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
          "name": "gateway",
          "type": "permission_level"
        },
        {
          "name": "maximum",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "qdeactivate",
      "base": "",
      "fields": [
        {
          "name": "request",
          "type": "quick_control"
        },
        {
          "name": "proof",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "qdefault",
      "base": "",
      "fields": [
        {
          "name": "request",
          "type": "quick_default"
        },
        {
          "name": "proof",
          "type": "bytes"
        },
        {
          "name": "incoming",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "qprune",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "ids",
          "type": "uint64[]"
        }
      ]
    },
    {
      "name": "qregister",
      "base": "",
      "fields": [
        {
          "name": "request",
          "type": "quick_registration"
        },
        {
          "name": "proof",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "qsubmit",
      "base": "",
      "fields": [
        {
          "name": "request",
          "type": "quick_instruction"
        },
        {
          "name": "proof",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "quick_account",
      "base": "",
      "fields": [
        {
          "name": "id",
          "type": "uint64"
        },
        {
          "name": "identity",
          "type": "checksum256"
        },
        {
          "name": "approval",
          "type": "quick_anchor"
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
          "name": "active",
          "type": "bool"
        },
        {
          "name": "deactivated_at",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "quick_anchor",
      "base": "",
      "fields": [
        {
          "name": "kind",
          "type": "uint8"
        },
        {
          "name": "credential",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "quick_configuration",
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
          "name": "code_hash",
          "type": "checksum256"
        },
        {
          "name": "gateway",
          "type": "permission_level"
        },
        {
          "name": "maximum",
          "type": "uint32"
        },
        {
          "name": "records",
          "type": "uint32"
        },
        {
          "name": "next_id",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "quick_control",
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
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "authority",
          "type": "name"
        },
        {
          "name": "anchor",
          "type": "quick_anchor"
        },
        {
          "name": "account_id",
          "type": "uint64"
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
          "name": "use_default",
          "type": "bool"
        }
      ]
    },
    {
      "name": "quick_default",
      "base": "",
      "fields": [
        {
          "name": "control",
          "type": "quick_control"
        },
        {
          "name": "method",
          "type": "quick_anchor"
        }
      ]
    },
    {
      "name": "quick_instruction",
      "base": "",
      "fields": [
        {
          "name": "control",
          "type": "quick_control"
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
          "name": "code_hash",
          "type": "checksum256"
        },
        {
          "name": "data",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "quick_registration",
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
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "authority",
          "type": "name"
        },
        {
          "name": "anchor",
          "type": "quick_anchor"
        },
        {
          "name": "account_id",
          "type": "uint64"
        },
        {
          "name": "epoch",
          "type": "uint64"
        },
        {
          "name": "expires",
          "type": "uint32"
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
    }
  ],
  "actions": [
    {
      "name": "checkmig",
      "type": "checkmig",
      "ricardian_contract": ""
    },
    {
      "name": "qconfig",
      "type": "qconfig",
      "ricardian_contract": ""
    },
    {
      "name": "qdeactivate",
      "type": "qdeactivate",
      "ricardian_contract": ""
    },
    {
      "name": "qdefault",
      "type": "qdefault",
      "ricardian_contract": ""
    },
    {
      "name": "qprune",
      "type": "qprune",
      "ricardian_contract": ""
    },
    {
      "name": "qregister",
      "type": "qregister",
      "ricardian_contract": ""
    },
    {
      "name": "qsubmit",
      "type": "qsubmit",
      "ricardian_contract": ""
    },
    {
      "name": "scanram",
      "type": "scanram",
      "ricardian_contract": ""
    }
  ],
  "tables": [
    {
      "name": "closechecks",
      "type": "closure_check",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "qaccounts",
      "type": "quick_account",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "qcfg",
      "type": "quick_configuration",
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
    }
  ],
  "variants": [],
  "ricardian_clauses": [],
  "action_results": []
} satisfies ABI.Def;
export interface checkmig {
  runtime: string;
  kind: number;
}
export interface closure_check {
  dao_id: string;
  code_hash: string;
  closing_at: number;
  stage: number;
  cursor: string;
  complete: boolean;
}
export interface permission_level {
  actor: string;
  permission: string;
}
export interface qconfig {
  runtime: string;
  source: string;
  code_hash: string;
  gateway: permission_level;
  maximum: number;
}
export interface qdeactivate {
  request: quick_control;
  proof: string;
}
export interface qdefault {
  request: quick_default;
  proof: string;
  incoming: string;
}
export interface qprune {
  runtime: string;
  ids: string[];
}
export interface qregister {
  request: quick_registration;
  proof: string;
}
export interface qsubmit {
  request: quick_instruction;
  proof: string;
}
export interface quick_account {
  id: string;
  identity: string;
  approval: quick_anchor;
  epoch: string;
  nonce: string;
  active: boolean;
  deactivated_at: number;
}
export interface quick_anchor {
  kind: number;
  credential: string;
}
export interface quick_configuration {
  id: string;
  source: string;
  code_hash: string;
  gateway: permission_level;
  maximum: number;
  records: number;
  next_id: string;
}
export interface quick_control {
  version: number;
  chain_id: string;
  runtime: string;
  authority: string;
  anchor: quick_anchor;
  account_id: string;
  epoch: string;
  nonce: string;
  expires: number;
  use_default: boolean;
}
export interface quick_default {
  control: quick_control;
  method: quick_anchor;
}
export interface quick_instruction {
  control: quick_control;
  target: string;
  action: string;
  code_hash: string;
  data: string;
}
export interface quick_registration {
  version: number;
  chain_id: string;
  runtime: string;
  authority: string;
  anchor: quick_anchor;
  account_id: string;
  epoch: string;
  expires: number;
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
export interface scanram {
  runtime: string;
  table: string;
  limit: number;
}
export interface QuickauthActions {
  checkmig: checkmig;
  qconfig: qconfig;
  qdeactivate: qdeactivate;
  qdefault: qdefault;
  qprune: qprune;
  qregister: qregister;
  qsubmit: qsubmit;
  scanram: scanram;
}
