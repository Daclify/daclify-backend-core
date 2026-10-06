import { readFileSync } from 'node:fs';
import { Checksum256 } from '@wharfkit/antelope';
import { z } from 'zod';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { collectDeployment } from '../../services/api/src/deployment-check.js';

const args = process.argv.slice(2);
function option(name: string): string | undefined {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith('--'))) throw new Error(`Missing ${name}`);
  return value;
}
const fixture = args.includes('--fixture');
const network = fixture
  ? z
      .object({ url: z.string().url(), chainId: z.string() })
      .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')))
  : undefined;
const rpc = option('--rpc') ?? network?.url;
const chainId = option('--chain-id') ?? network?.chainId;
if (!rpc) throw new Error('Pass --rpc or --fixture');
const accounts: { account: string; expectedHash: string }[] = [];
if (fixture) {
  accounts.push({
    account: 'daclifycore',
    expectedHash: Checksum256.hash(readFileSync('.artifacts/contracts/runtime.wasm')).toString(),
  });
  for (const id of ['decide', 'works', 'payroll'] as const)
    accounts.push({ account: id, expectedHash: ModuleCodeHashes[id] });
}
for (let index = 0; index < args.length; index += 1) {
  if (args[index] !== '--account') continue;
  const value = args[index + 1];
  const split = value?.split('=');
  if (!split || split.length !== 2 || !split[0] || !split[1])
    throw new Error('ACCOUNT_EXPECTATION');
  accounts.push({ account: split[0], expectedHash: split[1] });
}
const report = await collectDeployment(rpc, fetch, accounts, chainId);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
