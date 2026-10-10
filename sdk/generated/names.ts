// Generated from compiled C++ ABI. Regenerate with npm run codegen; do not edit.
import type { ABI } from '@wharfkit/antelope';
export const namesAbiHash = '739308f575543610825db64ac6187eaadb4e7a8000b2b10ade975eb321db6c0c';
export const namesAbi = {
  "version": "eosio::abi/1.2",
  "types": [],
  "structs": [
    {
      "name": "checkprofit",
      "base": "",
      "fields": [
        {
          "name": "sale_id",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "closepay",
      "base": "",
      "fields": [
        {
          "name": "sale_id",
          "type": "uint64"
        }
      ]
    },
    {
      "name": "delname",
      "base": "",
      "fields": [
        {
          "name": "seller",
          "type": "name"
        },
        {
          "name": "account_name",
          "type": "name"
        }
      ]
    },
    {
      "name": "delsuffix",
      "base": "",
      "fields": [
        {
          "name": "suffix",
          "type": "name"
        }
      ]
    },
    {
      "name": "editname",
      "base": "",
      "fields": [
        {
          "name": "seller",
          "type": "name"
        },
        {
          "name": "account_name",
          "type": "name"
        },
        {
          "name": "price",
          "type": "asset"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "accepts_fee_rule",
          "type": "uint8"
        }
      ]
    },
    {
      "name": "fulfill",
      "base": "",
      "fields": [
        {
          "name": "settler",
          "type": "name"
        },
        {
          "name": "account_name",
          "type": "name"
        },
        {
          "name": "owner_key",
          "type": "public_key"
        },
        {
          "name": "active_key",
          "type": "public_key"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "reference",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "fulfillnet",
      "base": "",
      "fields": [
        {
          "name": "settler",
          "type": "name"
        },
        {
          "name": "account_name",
          "type": "name"
        },
        {
          "name": "owner_key",
          "type": "public_key"
        },
        {
          "name": "active_key",
          "type": "public_key"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "net_usd_cents",
          "type": "uint32"
        },
        {
          "name": "reference",
          "type": "checksum256"
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
        },
        {
          "name": "settler",
          "type": "name"
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
      "name": "intend",
      "base": "",
      "fields": [
        {
          "name": "buyer",
          "type": "name"
        },
        {
          "name": "account_name",
          "type": "name"
        },
        {
          "name": "owner_key",
          "type": "public_key"
        },
        {
          "name": "active_key",
          "type": "public_key"
        }
      ]
    },
    {
      "name": "intent_row",
      "base": "",
      "fields": [
        {
          "name": "buyer",
          "type": "name"
        },
        {
          "name": "account_name",
          "type": "name"
        },
        {
          "name": "owner_key",
          "type": "public_key"
        },
        {
          "name": "active_key",
          "type": "public_key"
        },
        {
          "name": "expires",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "listing_row",
      "base": "",
      "fields": [
        {
          "name": "account_name",
          "type": "name"
        },
        {
          "name": "seller",
          "type": "name"
        },
        {
          "name": "price",
          "type": "asset"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "accepts",
          "type": "uint8"
        },
        {
          "name": "sold",
          "type": "uint8"
        }
      ]
    },
    {
      "name": "namescfg",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "settler",
          "type": "name"
        },
        {
          "name": "treasury",
          "type": "name"
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
      "name": "policy_row",
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
      "name": "profit_check",
      "base": "",
      "fields": [
        {
          "name": "sale_id",
          "type": "uint64"
        },
        {
          "name": "before_balance",
          "type": "int64"
        },
        {
          "name": "gross_units",
          "type": "int64"
        },
        {
          "name": "net_usd_cents",
          "type": "uint32"
        },
        {
          "name": "minimum_usd_cents",
          "type": "uint32"
        },
        {
          "name": "median",
          "type": "uint64"
        },
        {
          "name": "quoted_precision",
          "type": "uint8"
        },
        {
          "name": "rail",
          "type": "uint8"
        }
      ]
    },
    {
      "name": "profit_row",
      "base": "",
      "fields": [
        {
          "name": "version",
          "type": "uint8"
        },
        {
          "name": "minimum_usd_cents",
          "type": "uint32"
        },
        {
          "name": "card_fee_bps",
          "type": "uint16"
        },
        {
          "name": "card_fixed_usd_cents",
          "type": "uint32"
        },
        {
          "name": "fee_observed_at",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "provision_row",
      "base": "",
      "fields": [
        {
          "name": "id",
          "type": "uint64"
        },
        {
          "name": "version",
          "type": "uint8"
        },
        {
          "name": "party",
          "type": "uint8"
        },
        {
          "name": "treasury",
          "type": "name"
        },
        {
          "name": "resource_cost",
          "type": "asset"
        },
        {
          "name": "seller_share",
          "type": "asset"
        },
        {
          "name": "resource_cents",
          "type": "uint32"
        },
        {
          "name": "net_cents",
          "type": "uint32"
        },
        {
          "name": "seller_cents",
          "type": "uint32"
        },
        {
          "name": "state",
          "type": "uint8"
        }
      ]
    },
    {
      "name": "regname",
      "base": "",
      "fields": [
        {
          "name": "seller",
          "type": "name"
        },
        {
          "name": "account_name",
          "type": "name"
        },
        {
          "name": "price",
          "type": "asset"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "accepts_fee_rule",
          "type": "uint8"
        }
      ]
    },
    {
      "name": "regsuffix",
      "base": "",
      "fields": [
        {
          "name": "suffix",
          "type": "name"
        },
        {
          "name": "price",
          "type": "asset"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "accepts_fee_rule",
          "type": "uint8"
        }
      ]
    },
    {
      "name": "sale_row",
      "base": "",
      "fields": [
        {
          "name": "id",
          "type": "uint64"
        },
        {
          "name": "account_name",
          "type": "name"
        },
        {
          "name": "payer",
          "type": "name"
        },
        {
          "name": "seller",
          "type": "name"
        },
        {
          "name": "owner_key",
          "type": "public_key"
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
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "platform_cents",
          "type": "uint32"
        },
        {
          "name": "bps",
          "type": "uint16"
        },
        {
          "name": "rail",
          "type": "uint8"
        },
        {
          "name": "reference",
          "type": "checksum256"
        }
      ]
    },
    {
      "name": "setoracle",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        },
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
          "name": "runtime",
          "type": "name"
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
      "name": "setprofit",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
        },
        {
          "name": "version",
          "type": "uint8"
        },
        {
          "name": "minimum_usd_cents",
          "type": "uint32"
        },
        {
          "name": "card_fee_bps",
          "type": "uint16"
        },
        {
          "name": "card_fixed_usd_cents",
          "type": "uint32"
        },
        {
          "name": "fee_observed_at",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "setrates",
      "base": "",
      "fields": [
        {
          "name": "runtime",
          "type": "name"
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
        }
      ]
    },
    {
      "name": "setsettler",
      "base": "",
      "fields": [
        {
          "name": "settler",
          "type": "name"
        }
      ]
    },
    {
      "name": "settier",
      "base": "",
      "fields": [
        {
          "name": "kind",
          "type": "uint8"
        },
        {
          "name": "price",
          "type": "asset"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "ram_bytes",
          "type": "uint32"
        },
        {
          "name": "net_stake",
          "type": "asset"
        },
        {
          "name": "cpu_stake",
          "type": "asset"
        }
      ]
    },
    {
      "name": "suffix_row",
      "base": "",
      "fields": [
        {
          "name": "suffix",
          "type": "name"
        },
        {
          "name": "seller",
          "type": "name"
        },
        {
          "name": "price",
          "type": "asset"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "accepts",
          "type": "uint8"
        },
        {
          "name": "sales_count",
          "type": "uint32"
        }
      ]
    },
    {
      "name": "tier_row",
      "base": "",
      "fields": [
        {
          "name": "kind",
          "type": "uint8"
        },
        {
          "name": "price",
          "type": "asset"
        },
        {
          "name": "usd_cents",
          "type": "uint32"
        },
        {
          "name": "ram_bytes",
          "type": "uint32"
        },
        {
          "name": "net_stake",
          "type": "asset"
        },
        {
          "name": "cpu_stake",
          "type": "asset"
        }
      ]
    }
  ],
  "actions": [
    {
      "name": "checkprofit",
      "type": "checkprofit",
      "ricardian_contract": ""
    },
    {
      "name": "closepay",
      "type": "closepay",
      "ricardian_contract": ""
    },
    {
      "name": "delname",
      "type": "delname",
      "ricardian_contract": ""
    },
    {
      "name": "delsuffix",
      "type": "delsuffix",
      "ricardian_contract": ""
    },
    {
      "name": "editname",
      "type": "editname",
      "ricardian_contract": ""
    },
    {
      "name": "fulfill",
      "type": "fulfill",
      "ricardian_contract": ""
    },
    {
      "name": "fulfillnet",
      "type": "fulfillnet",
      "ricardian_contract": ""
    },
    {
      "name": "init",
      "type": "init",
      "ricardian_contract": ""
    },
    {
      "name": "intend",
      "type": "intend",
      "ricardian_contract": ""
    },
    {
      "name": "regname",
      "type": "regname",
      "ricardian_contract": ""
    },
    {
      "name": "regsuffix",
      "type": "regsuffix",
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
      "name": "setprofit",
      "type": "setprofit",
      "ricardian_contract": ""
    },
    {
      "name": "setrates",
      "type": "setrates",
      "ricardian_contract": ""
    },
    {
      "name": "setsettler",
      "type": "setsettler",
      "ricardian_contract": ""
    },
    {
      "name": "settier",
      "type": "settier",
      "ricardian_contract": ""
    }
  ],
  "tables": [
    {
      "name": "intents",
      "type": "intent_row",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "namelist",
      "type": "listing_row",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "namescfg",
      "type": "namescfg",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "policy",
      "type": "policy_row",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "profitcfg",
      "type": "profit_row",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "profitcheck",
      "type": "profit_check",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "saleprov",
      "type": "provision_row",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "sales",
      "type": "sale_row",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "suffixes",
      "type": "suffix_row",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    },
    {
      "name": "tiers",
      "type": "tier_row",
      "index_type": "i64",
      "key_names": [],
      "key_types": []
    }
  ],
  "variants": [],
  "ricardian_clauses": [],
  "action_results": []
} satisfies ABI.Def;
export interface checkprofit {
  sale_id: string;
}
export interface closepay {
  sale_id: string;
}
export interface delname {
  seller: string;
  account_name: string;
}
export interface delsuffix {
  suffix: string;
}
export interface editname {
  seller: string;
  account_name: string;
  price: string;
  usd_cents: number;
  accepts_fee_rule: number;
}
export interface fulfill {
  settler: string;
  account_name: string;
  owner_key: string;
  active_key: string;
  usd_cents: number;
  reference: string;
}
export interface fulfillnet {
  settler: string;
  account_name: string;
  owner_key: string;
  active_key: string;
  usd_cents: number;
  net_usd_cents: number;
  reference: string;
}
export interface init {
  runtime: string;
  settler: string;
  token_contract: string;
  token_symbol: string;
}
export interface intend {
  buyer: string;
  account_name: string;
  owner_key: string;
  active_key: string;
}
export interface intent_row {
  buyer: string;
  account_name: string;
  owner_key: string;
  active_key: string;
  expires: number;
}
export interface listing_row {
  account_name: string;
  seller: string;
  price: string;
  usd_cents: number;
  accepts: number;
  sold: number;
}
export interface namescfg {
  runtime: string;
  settler: string;
  treasury: string;
  third_party_bps: number;
  first_party_bps: number;
  token_contract: string;
  token_symbol: string;
}
export interface policy_row {
  bump_bps: number;
  quote_premium_bps: number;
  median: string;
  quoted_precision: number;
  observed_at: number;
}
export interface profit_check {
  sale_id: string;
  before_balance: string;
  gross_units: string;
  net_usd_cents: number;
  minimum_usd_cents: number;
  median: string;
  quoted_precision: number;
  rail: number;
}
export interface profit_row {
  version: number;
  minimum_usd_cents: number;
  card_fee_bps: number;
  card_fixed_usd_cents: number;
  fee_observed_at: number;
}
export interface provision_row {
  id: string;
  version: number;
  party: number;
  treasury: string;
  resource_cost: string;
  seller_share: string;
  resource_cents: number;
  net_cents: number;
  seller_cents: number;
  state: number;
}
export interface regname {
  seller: string;
  account_name: string;
  price: string;
  usd_cents: number;
  accepts_fee_rule: number;
}
export interface regsuffix {
  suffix: string;
  price: string;
  usd_cents: number;
  accepts_fee_rule: number;
}
export interface sale_row {
  id: string;
  account_name: string;
  payer: string;
  seller: string;
  owner_key: string;
  gross: string;
  platform_fee: string;
  usd_cents: number;
  platform_cents: number;
  bps: number;
  rail: number;
  reference: string;
}
export interface setoracle {
  runtime: string;
  median: string;
  quoted_precision: number;
  observed_at: number;
}
export interface setpolicy {
  runtime: string;
  bump_bps: number;
  quote_premium_bps: number;
}
export interface setprofit {
  runtime: string;
  version: number;
  minimum_usd_cents: number;
  card_fee_bps: number;
  card_fixed_usd_cents: number;
  fee_observed_at: number;
}
export interface setrates {
  runtime: string;
  third_party_bps: number;
  first_party_bps: number;
  treasury: string;
  token_contract: string;
  token_symbol: string;
}
export interface setsettler {
  settler: string;
}
export interface settier {
  kind: number;
  price: string;
  usd_cents: number;
  ram_bytes: number;
  net_stake: string;
  cpu_stake: string;
}
export interface suffix_row {
  suffix: string;
  seller: string;
  price: string;
  usd_cents: number;
  accepts: number;
  sales_count: number;
}
export interface tier_row {
  kind: number;
  price: string;
  usd_cents: number;
  ram_bytes: number;
  net_stake: string;
  cpu_stake: string;
}
export interface NamesActions {
  checkprofit: checkprofit;
  closepay: closepay;
  delname: delname;
  delsuffix: delsuffix;
  editname: editname;
  fulfill: fulfill;
  fulfillnet: fulfillnet;
  init: init;
  intend: intend;
  regname: regname;
  regsuffix: regsuffix;
  setoracle: setoracle;
  setpolicy: setpolicy;
  setprofit: setprofit;
  setrates: setrates;
  setsettler: setsettler;
  settier: settier;
}
