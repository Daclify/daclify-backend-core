import { readFileSync } from 'node:fs';
import { Blockchain, type Account } from '@proton/vert';
import { API, ABI, PermissionLevel } from '@greymass/eosio';
import { z } from 'zod';
const AbiSchema = z.object({
  version: z.string(),
  types: z.array(z.object({ new_type_name: z.string(), type: z.string() })),
  structs: z.array(
    z.object({
      name: z.string(),
      base: z.string(),
      fields: z.array(z.object({ name: z.string(), type: z.string() })),
    }),
  ),
  actions: z.array(
    z.object({ name: z.string(), type: z.string(), ricardian_contract: z.string() }),
  ),
  tables: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      index_type: z.string(),
      key_names: z.array(z.string()),
      key_types: z.array(z.string()),
    }),
  ),
});
export function loadContract(chain: Blockchain, name: string, artifact: string): Account {
  const abi = AbiSchema.parse(JSON.parse(readFileSync(`${artifact}.abi`, 'utf8')));
  const account = chain.createAccount({
    name,
    abi,
    wasm: readFileSync(`${artifact}.wasm`),
    enableInline: true,
  });
  account.setPermissions([
    ...account.permissions,
    API.v1.AccountPermission.from({
      perm_name: 'execctx',
      parent: 'active',
      required_auth: {
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: name, permission: 'eosio.code' }, weight: 1 }],
      },
    }),
  ]);
  // VERT 0.3.24 leaves compiler-rt 128-bit shifts unimplemented. Supply arithmetic,
  // not authorization/cryptography mocks; matching real-native cases remain required.
  const recreate = account.recreateVm.bind(account);
  account.recreateVm = async () => {
    const pending = recreate(),
      vm = account.vm;
    if (!vm) throw new Error('VERT_VM_REQUIRED');
    const imports: unknown = vm.imports;
    if (
      typeof imports !== 'object' ||
      imports === null ||
      !('env' in imports) ||
      typeof imports.env !== 'object' ||
      imports.env === null
    )
      throw new Error('VERT_IMPORTS_REQUIRED');
    for (const operation of ['__ashlti3', '__ashrti3', '__lshrti3'])
      Reflect.set(
        imports.env,
        operation,
        (pointer: number, low: bigint, high: bigint, shift: number) => {
          if (!Number.isInteger(shift) || shift < 0 || shift > 127)
            throw new Error('VERT_SHIFT_RANGE');
          const value = (BigInt.asUintN(64, high) << 64n) | BigInt.asUintN(64, low);
          const result = BigInt.asUintN(
            128,
            operation === '__ashlti3'
              ? value << BigInt(shift)
              : operation === '__ashrti3'
                ? BigInt.asIntN(128, value) >> BigInt(shift)
                : value >> BigInt(shift),
          );
          const memory = new DataView(vm.memory.buffer);
          memory.setBigUint64(pointer, result & ((1n << 64n) - 1n), true);
          memory.setBigUint64(pointer + 8, result >> 64n, true);
        },
      );
    await pending;
    // VERT omits the parent transaction on inline contexts; inherit its real encoded bytes.
    const apply = vm.apply.bind(vm);
    vm.apply = (context) => {
      if (!context.transaction) {
        const transaction = chain.actionTraces.find((trace) => trace.transaction)?.transaction;
        if (!transaction) throw new Error('VERT_TRANSACTION_REQUIRED');
        context.transaction = transaction;
      }
      return apply(context);
    };
  };
  return account;
}
export function contractAbi(path: string): ABI {
  return ABI.from(readFileSync(`${path}.abi`, 'utf8'));
}
export function allowFixtureInheritedAuth(
  chain: Blockchain,
  accountName: string,
  runtimeName: string,
): void {
  // VERT does not propagate a parent's supplied authority into an inline action.
  // State-transition fixtures bridge that emulator gap; native tests check real incoming consent.
  const account = chain.accounts[accountName];
  if (!account) throw new Error('FIXTURE_ACCOUNT_REQUIRED');
  account.setPermissions([
    ...account.permissions.filter((permission) => permission.perm_name.toString() !== 'active'),
    API.v1.AccountPermission.from({
      perm_name: 'active',
      parent: 'owner',
      required_auth: {
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: runtimeName, permission: 'eosio.code' }, weight: 1 }],
      },
    }),
  ]);
}
export async function send(
  account: Account,
  action: string,
  data: object | unknown[],
  auth?: string | string[],
): Promise<void> {
  const method = account.actions[action];
  if (!method) throw new Error(`Missing ABI action ${action}`);
  await method(data).send(
    Array.isArray(auth) ? auth.map((value) => PermissionLevel.from(value)) : auth,
  );
}
export function row(account: Account, table: string, scope: bigint, id: bigint): unknown {
  const accessor = account.tables[table];
  if (!accessor) throw new Error(`Missing ABI table ${table}`);
  return accessor(scope).getTableRow(id);
}
