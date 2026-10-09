import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivateKey, Serializer, ABI } from '@wharfkit/antelope';
import { z } from 'zod';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { AccountSchema } from '../protocol/api.js';
import { runtimeAbi, RuntimeCodeHash, RuntimeRawAbiHash } from '../sdk/index.js';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
const chainId = 'ab'.repeat(32);
const gateway = () =>
  new NativeChainGateway({
    chainId,
    rpcUrl: 'http://localhost:18888',
    runtime: 'daclifycore',
    hub: 'daclifyhub',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
    environment: 'local',
  });
afterEach(() => vi.unstubAllGlobals());
describe('native Connect policy and Hub reader', () => {
  it.each([0, 1])(
    'checks independent merchant authorization with native listed=%s',
    async (listed) => {
      const requests: string[] = [];
      const key = PrivateKey.generate('K1');
      const account = AccountSchema.parse({
        id: randomUUID(),
        custody: 'user-controlled',
        signingKey: key.toPublic().toString(),
        encryptionKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
          format: 'jwk',
        }),
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          requests.push(url);
          if (url.endsWith('get_info')) return Response.json({ chain_id: chainId });
          if (url.endsWith('get_raw_abi'))
            return Response.json({
              account_name: 'daoone',
              code_hash: 'ef'.repeat(32),
              abi_hash: RuntimeRawAbiHash,
              abi: Buffer.from(Serializer.encode({ object: ABI.from(runtimeAbi) }).array).toString(
                'base64',
              ),
            });
          return Response.json({
            rows: [
              {
                id: 0,
                runtime: 'daoone',
                owner: 'alice',
                chain_id: chainId,
                interface_version: 1,
                code_hash: RuntimeCodeHash,
                abi_hash: RuntimeRawAbiHash,
                listed,
                metadata: JSON.stringify({
                  schemaVersion: 1,
                  operator: 'Independent operator',
                  daos: [
                    {
                      daoId: '1',
                      title: 'Independent DAO',
                      description: '',
                      portal: { mode: 'daclify', apiOrigin: 'https://api.dao.example' },
                    },
                  ],
                }),
              },
            ],
            more: false,
          });
        }),
      );
      await expect(
        gateway().paymentMemberships(account, {
          chainId,
          contract: 'daoone',
          daoId: '1',
          interfaceVersion: 1,
        }),
      ).rejects.toMatchObject({ code: listed ? 'PAYMENT_POLICY_UNAVAILABLE' : 'PAYMENT_DAO' });
      expect(requests.some((url) => url.endsWith('get_raw_abi'))).toBe(listed === 1);
    },
  );
  it('uses five percent only on a compatible linked platform runtime', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options?: RequestInit) => {
        if (url.endsWith('get_info')) return Response.json({ chain_id: chainId });
        if (url.endsWith('get_raw_abi'))
          return Response.json({
            account_name: 'daclifycore',
            code_hash: RuntimeCodeHash,
            abi_hash: RuntimeRawAbiHash,
            abi: Buffer.from(Serializer.encode({ object: ABI.from(runtimeAbi) }).array).toString(
              'base64',
            ),
          });
        if (url.endsWith('get_abi'))
          return Response.json({ account_name: 'daclifycore', abi: runtimeAbi });
        const data = z
          .object({ table: z.string() })
          .parse(JSON.parse(typeof options?.body === 'string' ? options.body : '{}'));
        return Response.json({
          rows:
            data.table === 'mktcfg'
              ? [{ bump_bps: 2000, quote_premium_bps: 2000, dao_id: '1' }]
              : [],
          more: false,
        });
      }),
    );
    expect(await gateway().paymentPolicy()).toEqual({ basisPoints: 500, revision: '0' });
  });
  it.each([true, 1])(
    'reads listed=%s from native RPC without contacting the registered API',
    async (listed) => {
      const urls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          urls.push(url);
          return Response.json({
            rows: [
              {
                id: '0',
                runtime: 'daoone',
                owner: 'alice',
                chain_id: chainId,
                interface_version: 1,
                code_hash: RuntimeCodeHash,
                abi_hash: RuntimeRawAbiHash,
                listed,
                metadata: JSON.stringify({
                  schemaVersion: 1,
                  operator: 'Their server',
                  daos: [
                    {
                      daoId: '1',
                      title: 'Own DAO',
                      description: 'Independent',
                      portal: { mode: 'external', url: 'https://dao.example' },
                    },
                  ],
                }),
              },
            ],
            more: false,
          });
        }),
      );
      expect((await gateway().hubDirectory()).entries).toHaveLength(1);
      expect(urls.every((url) => url.startsWith('http://localhost:18888/'))).toBe(true);
    },
  );
});
