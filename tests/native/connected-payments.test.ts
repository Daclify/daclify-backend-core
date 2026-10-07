import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { PrivateKey, APIClient, Checksum256 } from '@wharfkit/antelope';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import {
  makeInstruction,
  instructionDigest,
  encodeAction,
  RuntimeCodeHash,
  RuntimeRawAbiHash,
  type RuntimeActions,
} from '../../sdk/index.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-payments-native' || network.url !== 'http://127.0.0.1:20388')
  throw new Error('Owned payment fixture required');
const dao = BigInt(Date.now()).toString(),
  other = (BigInt(dao) + 1n).toString(),
  key = PrivateKey.generate('K1');
let nonce = 0;
function push(action: string, data: unknown[], actor: string | string[] = 'alice') {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--wallet-url',
        'http://127.0.0.1:8900',
        'push',
        'action',
        'daclifycore',
        action,
        JSON.stringify(data),
        ...(typeof actor === 'string' ? [actor] : actor).flatMap((a) => ['-p', a + '@active']),
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('NATIVE_PAYMENT_REJECTED');
  }
}
function govern<K extends keyof RuntimeActions>(action: K, values: RuntimeActions[K]) {
  const instruction = makeInstruction(
    { chainId: network.chainId, contract: 'daclifycore', daoId: dao, interfaceVersion: 1 },
    '1',
    String(nonce),
    Math.floor(Date.now() / 1000) + 300,
    'daclifycore',
    action,
    encodeAction(action, values),
  );
  push('submit', [instruction, key.signDigest(instructionDigest(instruction)).toString()], 'relay');
  nonce++;
}
beforeAll(() => {
  unlockFixtureWallet(network.container);
  configureFixtureContext(network.container);
  push('setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''], 'daclifycore');
  push('sethosted', [10, 'relay'], 'daclifycore');
  for (const id of [dao, other]) {
    const reference = Checksum256.hash(new TextEncoder().encode(id)).toString();
    push('orderfree', [reference, key.toPublic().toString()], 'relay');
    push(
      'createpaid',
      [id, 'alice', '{}', 0, 'eosio.token', '4,TLOS', reference, key.toPublic().toString()],
      ['alice', 'relay'],
    );
    push('enroll', [id, 1, '', key.toPublic().toString(), 'fixture-encryption', 0]);
  }
  push('setgov', [dao], 'daclifycore');
});
it('matches the SDK to deployed WASM and binary ABI on Spring', async () => {
  const api = new APIClient({ url: network.url });
  const info = await api.v1.chain.get_info();
  expect(info.chain_id.toString()).toBe(network.chainId);
  const response = await fetch(network.url + '/v1/chain/get_raw_abi', {
    method: 'POST',
    body: JSON.stringify({ account_name: 'daclifycore' }),
  });
  const raw = z
    .object({ code_hash: z.string(), abi_hash: z.string() })
    .parse(await response.json());
  expect(raw).toEqual({ code_hash: RuntimeCodeHash, abi_hash: RuntimeRawAbiHash });
});
it('enforces native governance, capacity settlement and free order authority', () => {
  expect(() => push('govpayfees', ['daclifycore', dao, 1, 500], 'bob')).toThrow(
    'NATIVE_PAYMENT_REJECTED',
  );
  govern('govpayfees', { runtime: 'daclifycore', dao_id: dao, member_id: '1', bps: 500 });
  govern('govseatfee', {
    runtime: 'daclifycore',
    dao_id: dao,
    member_id: '1',
    first_usd: 100,
    next_usd: 50,
    rest_usd: 20,
  });
  for (let id = 2; id <= 10; id++)
    push('enroll', [other, id, '', PrivateKey.generate('K1').toPublic().toString(), 'fixture', 0]);
  const enroll = () =>
    push('enroll', [other, 11, '', PrivateKey.generate('K1').toPublic().toString(), 'fixture', 0]);
  expect(enroll).toThrow('NATIVE_PAYMENT_REJECTED');
  const receipt = Checksum256.hash(new TextEncoder().encode('capacity' + dao)).toString(),
    end = Math.floor(Date.now() / 1000) + 3600;
  expect(() => push('setcapacity', [other, 11, end, receipt], 'bob')).toThrow(
    'NATIVE_PAYMENT_REJECTED',
  );
  push('setcapacity', [other, 11, end, receipt], 'relay');
  enroll();
  push('revokecap', [other, receipt], 'relay');
  expect(() => push('setcapacity', [other, 11, end, receipt], 'relay')).toThrow(
    'NATIVE_PAYMENT_REJECTED',
  );
  expect(() => push('resumecap', [other, receipt], 'bob')).toThrow('NATIVE_PAYMENT_REJECTED');
  push('resumecap', [other, receipt], 'relay');
  expect(() =>
    push(
      'orderfree',
      [
        Checksum256.hash(new TextEncoder().encode('order' + dao)).toString(),
        key.toPublic().toString(),
      ],
      'bob',
    ),
  ).toThrow('NATIVE_PAYMENT_REJECTED');
  push(
    'orderfree',
    [
      Checksum256.hash(new TextEncoder().encode('order' + dao)).toString(),
      key.toPublic().toString(),
    ],
    'relay',
  );
});
