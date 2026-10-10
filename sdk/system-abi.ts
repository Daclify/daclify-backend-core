export const SYSTEM_ABI = {
  version: 'eosio::abi/1.2',
  types: [],
  structs: [
    {
      name: 'permission_level',
      base: '',
      fields: [
        { name: 'actor', type: 'name' },
        { name: 'permission', type: 'name' },
      ],
    },
    {
      name: 'key_weight',
      base: '',
      fields: [
        { name: 'key', type: 'public_key' },
        { name: 'weight', type: 'uint16' },
      ],
    },
    {
      name: 'permission_level_weight',
      base: '',
      fields: [
        { name: 'permission', type: 'permission_level' },
        { name: 'weight', type: 'uint16' },
      ],
    },
    {
      name: 'wait_weight',
      base: '',
      fields: [
        { name: 'wait_sec', type: 'uint32' },
        { name: 'weight', type: 'uint16' },
      ],
    },
    {
      name: 'authority',
      base: '',
      fields: [
        { name: 'threshold', type: 'uint32' },
        { name: 'keys', type: 'key_weight[]' },
        { name: 'accounts', type: 'permission_level_weight[]' },
        { name: 'waits', type: 'wait_weight[]' },
      ],
    },
    {
      name: 'linkauth',
      base: '',
      fields: [
        { name: 'account', type: 'name' },
        { name: 'code', type: 'name' },
        { name: 'type', type: 'name' },
        { name: 'requirement', type: 'name' },
      ],
    },
    {
      name: 'unlinkauth',
      base: '',
      fields: [
        { name: 'account', type: 'name' },
        { name: 'code', type: 'name' },
        { name: 'type', type: 'name' },
      ],
    },
    {
      name: 'updateauth',
      base: '',
      fields: [
        { name: 'account', type: 'name' },
        { name: 'permission', type: 'name' },
        { name: 'parent', type: 'name' },
        { name: 'auth', type: 'authority' },
      ],
    },
    {
      name: 'newaccount',
      base: '',
      fields: [
        { name: 'creator', type: 'name' },
        { name: 'name', type: 'name' },
        { name: 'owner', type: 'authority' },
        { name: 'active', type: 'authority' },
      ],
    },
    {
      name: 'buyrambytes',
      base: '',
      fields: [
        { name: 'payer', type: 'name' },
        { name: 'receiver', type: 'name' },
        { name: 'bytes', type: 'uint32' },
      ],
    },
    {
      name: 'delegatebw',
      base: '',
      fields: [
        { name: 'from', type: 'name' },
        { name: 'receiver', type: 'name' },
        { name: 'stake_net_quantity', type: 'asset' },
        { name: 'stake_cpu_quantity', type: 'asset' },
        { name: 'transfer', type: 'bool' },
      ],
    },
    {
      name: 'setcode',
      base: '',
      fields: [
        { name: 'account', type: 'name' },
        { name: 'vmtype', type: 'uint8' },
        { name: 'vmversion', type: 'uint8' },
        { name: 'code', type: 'bytes' },
      ],
    },
    {
      name: 'setabi',
      base: '',
      fields: [
        { name: 'account', type: 'name' },
        { name: 'abi', type: 'bytes' },
      ],
    },
  ],
  actions: [
    { name: 'updateauth', type: 'updateauth', ricardian_contract: '' },
    { name: 'linkauth', type: 'linkauth', ricardian_contract: '' },
  ],
  tables: [],
};
