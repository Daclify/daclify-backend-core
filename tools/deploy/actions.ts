import { ABI, Serializer } from '@wharfkit/antelope';
import { SYSTEM_ABI } from './system-abi.js';
import { activeAuthority, ownerAuthority } from './keys.js';

const abi = ABI.from(SYSTEM_ABI);
export function encodeContractAbi(text: string): Uint8Array {
  return Serializer.encode({ object: ABI.from(text) }).array;
}

export function encodeSystem(type: string, object: object): Uint8Array {
  return Serializer.encode({ abi, type, object }).array;
}

export function decodeSystem(type: string, data: Uint8Array): unknown {
  return Serializer.decode({ abi, data, type });
}

export function creationActions(input: {
  creator: string;
  account: string;
  ownerKey: string;
  activeKey: string;
  inlineCode: boolean;
  resourceModel: 'bare' | 'telos';
  ramBytes: number;
  cpuStake: string;
  netStake: string;
}): { account: 'eosio'; name: string; type: string; object: object }[] {
  const actions: { account: 'eosio'; name: string; type: string; object: object }[] = [
    {
      account: 'eosio',
      name: 'newaccount',
      type: 'newaccount',
      object: {
        creator: input.creator,
        name: input.account,
        owner: ownerAuthority(input.ownerKey),
        active: activeAuthority(input.account, input.activeKey, input.inlineCode),
      },
    },
  ];
  if (input.resourceModel === 'bare') return actions;
  actions.push({
    account: 'eosio',
    name: 'buyrambytes',
    type: 'buyrambytes',
    object: { payer: input.creator, receiver: input.account, bytes: input.ramBytes },
  });
  if (input.cpuStake !== '0.0000 TLOS' || input.netStake !== '0.0000 TLOS') {
    actions.push({
      account: 'eosio',
      name: 'delegatebw',
      type: 'delegatebw',
      object: {
        from: input.creator,
        receiver: input.account,
        stake_net_quantity: input.netStake,
        stake_cpu_quantity: input.cpuStake,
        transfer: false,
      },
    });
  }
  return actions;
}
