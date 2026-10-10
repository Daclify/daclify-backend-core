import { afterEach, expect, it, vi } from 'vitest';
import { OpenBaoCustody } from '../services/custody/openbao.js';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('uses only the pre-provisioned encryption path and reads a renewed token on each operation', async () => {
  let token = 'first-disposable-token';
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({ data: { ciphertext: 'vault:v1:YWJj' } }));
  vi.stubGlobal('fetch', fetcher);
  const provider = new OpenBaoCustody('https://key-service.example.test', async () => token);
  await provider.wrapExisting('recovery-v1', new Uint8Array(32));
  token = 'renewed-disposable-token';
  await provider.wrapExisting('recovery-v1', new Uint8Array(32));
  expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
    'https://key-service.example.test/v1/transit/encrypt/content-recovery-v1',
    'https://key-service.example.test/v1/transit/encrypt/content-recovery-v1',
  ]);
  expect(
    fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('X-Vault-Token')),
  ).toEqual(['first-disposable-token', 'renewed-disposable-token']);
});
