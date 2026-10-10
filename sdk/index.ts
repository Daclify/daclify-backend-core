import { ABI, Serializer, Checksum256, Action } from '@wharfkit/antelope';
import { RamQuoteSchema, type RamQuote } from '../protocol/resources.js';
import {
  type DaoRef,
  DaoRefSchema,
  IdSchema,
  Uint64Schema,
  NativeAccountSchema,
  AssetRefSchema,
  NativeIdentitySchema,
  type AssetRef,
  type NativeIdentity,
} from '../protocol/index.js';
import { runtimeAbi, type RuntimeActions, type instruction } from './generated/runtime.js';
export { RuntimeCodeHash, RuntimeRawAbiHash } from './generated/releases.js';
export { runtimeAbi, runtimeAbiHash } from './generated/runtime.js';
export type { RuntimeActions, instruction } from './generated/runtime.js';
export { RuntimeActionSchemas, RuntimeTableSchemas } from './generated/schemas.js';
export { governanceSettings } from './dao.js';
export * from './recovery.js';
export {
  nameSellerAction,
  namePurchaseActions,
  nameCreationPermissionActions,
  namesAbi,
  NamesCodeHash,
} from './names.js';
export {
  bindingTypedData,
  governanceTypedData,
  evmTypedDigest,
  canonicalEvmSignature,
  type EvmBinding,
} from './evm.js';
const abi = ABI.from(runtimeAbi);
export function nativeTokenOpenAction(
  value: AssetRef,
  selected: NativeIdentity,
  destination: string,
): Action {
  const token = AssetRefSchema.parse(value),
    wallet = NativeIdentitySchema.parse(selected);
  NativeAccountSchema.parse(destination);
  if (wallet.chainId !== token.chainId || wallet.account !== destination)
    throw new Error('PAYOUT_WALLET_REQUIRED');
  const tokenAbi = ABI.from({
    version: 'eosio::abi/1.2',
    structs: [
      {
        name: 'open',
        base: '',
        fields: [
          { name: 'owner', type: 'name' },
          { name: 'symbol', type: 'symbol' },
          { name: 'ram_payer', type: 'name' },
        ],
      },
    ],
    actions: [{ name: 'open', type: 'open', ricardian_contract: '' }],
  });
  return Action.from(
    {
      account: token.contract,
      name: 'open',
      authorization: [{ actor: wallet.account, permission: wallet.permission }],
      data: {
        owner: destination,
        symbol: token.precision + ',' + token.symbol,
        ram_payer: wallet.account,
      },
    },
    tokenAbi,
  );
}
export function nativeRamActions(value: RamQuote): Action[] {
  const quote = RamQuoteSchema.parse(value),
    authorization = [{ actor: quote.order.payer, permission: 'active' }];
  const transferAbi = ABI.from({
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
    Action.from({
      account: quote.dao.contract,
      name: 'orderram',
      authorization,
      data: encodeAction('orderram', quote.order),
    }),
    Action.from(
      {
        account: 'eosio.token',
        name: 'transfer',
        authorization,
        data: {
          from: quote.order.payer,
          to: quote.dao.contract,
          quantity: quote.order.maximum,
          memo: 'ram:' + quote.order.reference,
        },
      },
      transferAbi,
    ),
  ];
}
export function encodeAction<K extends keyof RuntimeActions>(
  name: K,
  args: RuntimeActions[K],
): Uint8Array {
  return Serializer.encode({ abi, type: name, object: args }).array;
}
export function instructionDigest(request: instruction): Checksum256 {
  return Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
}
export function makeInstruction(
  domain: DaoRef,
  member: string,
  nonce: string,
  expires: number,
  target: string,
  action: string,
  data: Uint8Array,
): instruction {
  DaoRefSchema.parse(domain);
  IdSchema.parse(member);
  Uint64Schema.parse(nonce);
  NativeAccountSchema.parse(target);
  NativeAccountSchema.parse(action);
  if (!Number.isInteger(expires) || expires < 0 || expires > 0xffffffff)
    throw new Error('Invalid expiry');
  return {
    version: domain.interfaceVersion,
    chain_id: domain.chainId,
    deployment: domain.contract,
    dao_id: domain.daoId,
    member_id: member,
    nonce,
    expires,
    target,
    action,
    data: Array.from(data, (byte) => byte.toString(16).padStart(2, '0')).join(''),
  };
}

export { handoverOwnerActions, nativeOwnershipSetupActions } from './executives.js';
