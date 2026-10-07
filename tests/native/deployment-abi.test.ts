import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ABI } from '@wharfkit/antelope';
import { encodeContractAbi, encodeSystem } from '../../tools/deploy/actions.js';
import { nativePush, researchRpc } from '../helpers/native-research.js';
it('accepts the deployment ABI codec on the owned native system action and reads it back', async () => {
  const text = readFileSync('.artifacts/contracts/permprobe.abi', 'utf8');
  await nativePush(
    'eosio',
    'setabi',
    encodeSystem('setabi', { account: 'permprobe', abi: encodeContractAbi(text) }),
    'permprobe',
  );
  const actual = (await researchRpc.v1.chain.get_abi('permprobe')).abi;
  expect(actual).toBeDefined();
  const normalized: unknown = JSON.parse(JSON.stringify(actual)),
    expected: unknown = JSON.parse(JSON.stringify(ABI.from(text)));
  expect(normalized).toEqual(expected);
});
