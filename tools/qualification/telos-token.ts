// Downloads pinned public code only; all signed qualification stays on the owned loopback chain.
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { readBoundedResponse } from '../../services/api/src/http.js';
import { ChainIdSchema } from '../../protocol/base.js';
import { HostedBytesSchema } from '../../protocol/storage.js';
import { TelosTokenSources, validateTokenSnapshot } from './telos-token-snapshot.js';
for (const pin of TelosTokenSources) {
  async function post(action: string, body: object): Promise<unknown> {
    const response = await fetch(pin.source + '/v1/chain/' + action, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error('TELOS_TOKEN_SOURCE_UNAVAILABLE:' + pin.environment + ':' + action);
    return JSON.parse(
      new TextDecoder().decode(await readBoundedResponse(response, 4 * 1024 * 1024)),
    );
  }
  const info = z.object({
    chain_id: ChainIdSchema,
    head_block_num: z.number().int().nonnegative(),
  });
  const code = z.object({ code_hash: ChainIdSchema });
  const before = info.parse(await post('get_info', {}));
  const beforeCode = code.parse(await post('get_code_hash', { account_name: 'eosio.token' }));
  const raw = z
    .object({
      account_name: z.literal('eosio.token'),
      wasm: HostedBytesSchema,
      abi: HostedBytesSchema,
    })
    .parse(await post('get_raw_code_and_abi', { account_name: 'eosio.token' }));
  const afterCode = code.parse(await post('get_code_hash', { account_name: 'eosio.token' }));
  const after = info.parse(await post('get_info', {}));
  const wasm = Buffer.from(raw.wasm, 'base64'),
    rawAbi = Buffer.from(raw.abi, 'base64');
  const abi = validateTokenSnapshot(pin, {
    beforeChainId: before.chain_id,
    afterChainId: after.chain_id,
    beforeCodeHash: beforeCode.code_hash,
    afterCodeHash: afterCode.code_hash,
    wasm,
    rawAbi,
  });
  const directory = '.artifacts/public-telos-token/' + pin.environment;
  mkdirSync(directory, { recursive: true });
  writeFileSync(directory + '/token.wasm', wasm);
  writeFileSync(directory + '/token.abi', JSON.stringify(abi));
  writeFileSync(directory + '/token.raw.abi', rawAbi);
  const provenance = {
    ...pin,
    account: 'eosio.token',
    downloadedAt: new Date().toISOString(),
    observedStartBlock: before.head_block_num,
    observedEndBlock: after.head_block_num,
    wasmBytes: wasm.length,
  };
  writeFileSync(directory + '/provenance.json', JSON.stringify(provenance, null, 2) + '\n');
  console.log(JSON.stringify(provenance));
}
