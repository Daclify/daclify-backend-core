import { APIClient, PrivateKey } from '@wharfkit/antelope';
import { expect, it } from 'vitest';
import { readContactIdentity } from '../services/api/src/contact-identity.js';

const old = PrivateKey.generate('K1').toPublic().toString();
const current = PrivateKey.generate('K1').toPublic().toString();
const root = { id: '7', dao_id: '1', origin_key: old, signing_key: current };
function rpc(pages: unknown[]) {
  return new APIClient({
    url: 'https://rpc.example',
    fetch: async () => {
      if (!pages.length) throw Error('Unexpected RPC');
      return new Response(JSON.stringify(pages.shift()), { status: 200 });
    },
  });
}
it('resolves a retired key directly to the latest root without walking intermediate recoveries', async () => {
  const api = rpc([
    { rows: [{ id: '3', dao_id: '1', signing_key: old, identity_id: '7' }], more: false },
    { rows: [root], more: false },
  ]);
  expect(await readContactIdentity(api, 'daclifycore', old)).toEqual(root);
});
it('resolves a current recovered key and leaves an unrecovered key without invented continuity', async () => {
  expect(
    await readContactIdentity(
      rpc([
        { rows: [], more: false },
        { rows: [root], more: false },
      ]),
      'daclifycore',
      current,
    ),
  ).toEqual(root);
  expect(
    await readContactIdentity(
      rpc([
        { rows: [], more: false },
        { rows: [], more: false },
      ]),
      'daclifycore',
      old,
    ),
  ).toBeNull();
});
it.each(
  [
    [{ rows: [{ id: '3', dao_id: '1', signing_key: current, identity_id: '7' }], more: false }],
    [
      { rows: [{ id: '3', dao_id: '1', signing_key: old, identity_id: '7' }], more: false },
      { rows: [], more: false },
    ],
    [
      { rows: [{ id: '3', dao_id: '1', signing_key: old, identity_id: '7' }], more: false },
      { rows: [{ ...root, id: '8' }], more: false },
    ],
    [{ rows: [], more: true }],
    [{ rows: [{ signing_key: old }], more: false }],
  ].map((pages) => ({ pages })),
)(
  'rejects malformed, mismatched or incomplete native continuity evidence (%#)',
  async ({ pages }) => {
    await expect(readContactIdentity(rpc(pages), 'daclifycore', old)).rejects.toMatchObject({
      code: 'CHAIN_RESPONSE_INVALID',
      statusCode: 503,
    });
  },
);
