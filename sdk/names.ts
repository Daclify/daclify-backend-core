import { ABI, Action, Asset, PublicKey } from '@wharfkit/antelope';
import { NativeAccountSchema } from '../protocol/base.js';
import { namesAbi, type NamesActions } from './generated/names.js';
import { NamesActionSchemas } from './generated/names-schemas.js';
import { SYSTEM_ABI } from './system-abi.js';
import { NameQuoteSchema } from '../protocol/service-api.js';
import type { z } from 'zod';
export { namesAbi } from './generated/names.js';
export { NamesCodeHash } from './generated/names-release.js';
export const NameOracleActions = ['observeprice', 'observefee'] as const;
export function nameOraclePermissionActions(contractInput: string, keyInput: string): Action[] {
  const contract = NativeAccountSchema.parse(contractInput),
    key = PublicKey.from(keyInput);
  const authorization = [{ actor: contract, permission: 'active' }],
    abi = ABI.from(SYSTEM_ABI);
  return [
    Action.from(
      {
        account: 'eosio',
        name: 'updateauth',
        authorization,
        data: {
          account: contract,
          permission: 'oracle',
          parent: 'active',
          auth: { threshold: 1, keys: [{ key, weight: 1 }], accounts: [], waits: [] },
        },
      },
      abi,
    ),
    ...NameOracleActions.map((type) =>
      Action.from(
        {
          account: 'eosio',
          name: 'linkauth',
          authorization,
          data: { account: contract, code: contract, type, requirement: 'oracle' },
        },
        abi,
      ),
    ),
  ];
}
export function nameSellerAction<
  K extends 'regsuffix' | 'regname' | 'editname' | 'delname' | 'delsuffix',
>(contract: string, action: K, value: NamesActions[K]): Action {
  const target = NativeAccountSchema.parse(contract),
    data = NamesActionSchemas[action].parse(value);
  if ('accepts_fee_rule' in data && data.accepts_fee_rule !== 1) throw new Error('FEE_RULE');
  const seller = 'suffix' in data ? data.suffix : data.seller;
  NativeAccountSchema.parse(seller);
  if (seller === target) throw new Error('FEE_ACCOUNT');
  if ('suffix' in data && data.suffix.includes('.')) throw new Error('NATIVE_SUFFIX_REQUIRED');
  if (
    'account_name' in data &&
    (data.account_name.length > 12 ||
      !NativeAccountSchema.safeParse(data.account_name).success ||
      data.account_name.startsWith('.') ||
      data.account_name.endsWith('.') ||
      data.account_name.includes('..') ||
      (data.account_name.includes('.') && data.account_name.split('.').at(-1) !== seller))
  )
    throw new Error('NATIVE_SUFFIX_REQUIRED');
  if (action !== 'delname' && action !== 'delsuffix') {
    const pricing = NamesActionSchemas.regsuffix.or(NamesActionSchemas.regname).parse(value);
    const price = Asset.from(pricing.price);
    const units = BigInt(price.units.toString());
    if (
      price.symbol.toString() !== '4,TLOS' ||
      units < 0n ||
      units > 1000000000000n ||
      pricing.usd_cents > 100000000 ||
      (units === 0n && pricing.usd_cents === 0)
    )
      throw new Error('PRICE');
  }
  return Action.from(
    {
      account: target,
      name: action,
      authorization: [{ actor: seller, permission: 'active' }],
      data,
    },
    ABI.from(namesAbi),
  );
}
// Export for owner review: existing root/active authority is never rewritten.
export function nameCreationPermissionActions(
  sellerInput: string,
  contractInput: string,
): Action[] {
  const seller = NativeAccountSchema.parse(sellerInput),
    contract = NativeAccountSchema.parse(contractInput);
  if (seller === contract) throw new Error('FEE_ACCOUNT');
  const authorization = [{ actor: seller, permission: 'owner' }];
  return [
    Action.from(
      {
        account: 'eosio',
        name: 'updateauth',
        authorization,
        data: {
          account: seller,
          permission: 'namesale',
          parent: 'active',
          auth: {
            threshold: 1,
            keys: [],
            accounts: [{ permission: { actor: contract, permission: 'eosio.code' }, weight: 1 }],
            waits: [],
          },
        },
      },
      ABI.from(SYSTEM_ABI),
    ),
    Action.from(
      {
        account: 'eosio',
        name: 'linkauth',
        authorization,
        data: { account: seller, code: 'eosio', type: 'newaccount', requirement: 'namesale' },
      },
      ABI.from(SYSTEM_ABI),
    ),
  ];
}
export function namePurchaseActions(
  contractInput: string,
  tokenInput: string,
  buyerInput: string,
  value: z.infer<typeof NameQuoteSchema>,
  ownerKey: string,
  activeKey: string,
): Action[] {
  const contract = NativeAccountSchema.parse(contractInput),
    token = NativeAccountSchema.parse(tokenInput),
    buyer = NativeAccountSchema.parse(buyerInput),
    quote = NameQuoteSchema.parse(value),
    price = Asset.from(quote.price);
  if (price.symbol.toString() !== '4,TLOS' || BigInt(price.units.toString()) <= 0n)
    throw new Error('PRICE');
  if (
    !NativeAccountSchema.safeParse(quote.accountName).success ||
    quote.accountName.length > 12 ||
    quote.accountName.includes('..') ||
    quote.accountName.startsWith('.') ||
    quote.accountName.endsWith('.')
  )
    throw new Error('PROFILE_NAME');
  const authorization = [{ actor: buyer, permission: 'active' }];
  const intend = NamesActionSchemas.intend.parse({
    buyer,
    account_name: quote.accountName,
    owner_key: ownerKey,
    active_key: activeKey,
  });
  const transfer = ABI.from({
    version: 'eosio::abi/1.2',
    structs: [
      {
        name: 'transfer',
        base: '',
        fields: [
          { name: 'from', type: 'name' },
          { name: 'to', type: 'name' },
          { name: 'quantity', type: 'asset' },
          { name: 'memo', type: 'string' },
        ],
      },
    ],
    actions: [{ name: 'transfer', type: 'transfer', ricardian_contract: '' }],
  });
  return [
    Action.from(
      { account: contract, name: 'intend', authorization, data: intend },
      ABI.from(namesAbi),
    ),
    Action.from(
      {
        account: token,
        name: 'transfer',
        authorization,
        data: {
          from: buyer,
          to: contract,
          quantity: quote.price,
          memo: `buy:${quote.accountName}`,
        },
      },
      transfer,
    ),
  ];
}
