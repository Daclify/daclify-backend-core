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
  return account;
}
export function contractAbi(path: string): ABI {
  return ABI.from(readFileSync(`${path}.abi`, 'utf8'));
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
