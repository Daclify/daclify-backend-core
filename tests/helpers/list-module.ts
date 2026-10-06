import { send } from './vert.js';

export async function listFirstParty(
  runtime: Parameters<typeof send>[0],
  module: string,
  codeHash: string,
  runtimeAccount = 'daclifycore',
): Promise<void> {
  await send(
    runtime,
    'setfees',
    [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''],
    `${runtimeAccount}@active`,
  );
  await send(
    runtime,
    'listmod',
    [module, 'alice', 0, 1, '0.0000 TLOS', codeHash, 'First-party module'],
    `${runtimeAccount}@active`,
  );
}
