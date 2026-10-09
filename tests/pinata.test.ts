import { afterEach, describe, it, expect, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import { PinataStorage } from '../services/api/src/content/pinata.js';
import { GatewayAllowance } from '../services/api/src/content/gateway-allowance.js';
import { Pool } from 'pg';
const bytes = new TextEncoder().encode('Synthetic content fixture');
const cid = CID.createV1(
  0x55,
  create(0x12, createHash('sha256').update(bytes).digest()),
).toString();
const providerId = randomUUID();
const uploadId = randomUUID();
const provider = new PinataStorage('fixture-token-only', 'https://example.mypinata.cloud');
afterEach(() => vi.unstubAllGlobals());
describe('Pinata adapter fault fixtures (not live provider evidence)', () => {
  it('reserves allowance before each upstream read and retains reservations on failure', async () => {
    const pool = new Pool();
    const allowance = new GatewayAllowance(pool, 'fixture', 'https://example.mypinata.cloud', null);
    const reserve = vi.spyOn(allowance, 'reserve').mockResolvedValue();
    const guarded = new PinataStorage(
      'fixture-token-only',
      'https://example.mypinata.cloud',
      'gateway-fixture-only',
      allowance,
    );
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      expect(reserve).toHaveBeenCalledWith(bytes.length);
      return new Response('provider failure', { status: 503 });
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(guarded.retrieve(cid, bytes.length)).rejects.toThrow('CONTENT_UNAVAILABLE');
    expect(reserve).toHaveBeenCalledTimes(1);
    reserve.mockRejectedValueOnce(new Error('CONTENT_GATEWAY_ALLOWANCE_EXHAUSTED'));
    await expect(guarded.retrieve(cid, bytes.length)).rejects.toThrow(
      'CONTENT_GATEWAY_ALLOWANCE_EXHAUSTED',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      () => new PinataStorage('fixture', 'https://example.mypinata.cloud', undefined, allowance),
    ).toThrow('CONTENT_GATEWAY_KEY_REQUIRED');
    await pool.end();
  });
  it('finds only Daclify-owned pins for an exact CID and rejects truncated or mismatched inventory', async () => {
    const response = {
      data: {
        files: [
          {
            id: providerId,
            cid,
            size: bytes.length,
            number_of_files: 1,
            keyvalues: { daclify_upload: uploadId },
          },
        ],
        next_page_token: null,
      },
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(response)));
    vi.stubGlobal('fetch', fetcher);
    expect(await provider.findCid(cid)).toEqual([{ id: providerId, cid, size: bytes.length }]);
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get('cid')).toBe(cid);
    for (const data of [
      { ...response.data, next_page_token: 'more' },
      {
        ...response.data,
        files: [
          {
            ...response.data.files[0],
            cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
        ],
      },
    ]) {
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ data })));
      await expect(provider.findCid(cid)).rejects.toThrow('PINATA_RESPONSE_INVALID');
    }
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { ...response.data, files: [{ ...response.data.files[0], keyvalues: {} }] },
        }),
      ),
    );
    expect(await provider.findCid(cid)).toEqual([]);
  });
  it('uploads portable public bytes with a fixed CID profile and generic metadata', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { id: providerId, cid, size: bytes.length, number_of_files: 1 } }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await provider.upload(uploadId, bytes)).toEqual({
      id: providerId,
      cid,
      size: bytes.length,
    });
    const call = fetcher.mock.calls[0];
    expect(call?.[0]).toBe('https://uploads.pinata.cloud/v3/files');
    const body = call?.[1]?.body;
    if (!(body instanceof FormData)) throw new Error('Expected multipart body');
    expect(body.get('network')).toBe('public');
    expect(body.get('cid_version')).toBe('v1');
    expect(body.get('name')).toBe(`daclify-${uploadId}.bin`);
    expect(body.get('keyvalues')).toBe(JSON.stringify({ daclify_upload: uploadId }));
    const file = body.get('file');
    if (!(file instanceof File)) throw new Error('Expected bounded file');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
  });
  it('rejects an invalid provider CID and mismatching upload size', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: providerId, cid: 'pending', size: bytes.length, number_of_files: 1 },
          }),
        ),
      ),
    );
    await expect(provider.upload(uploadId, bytes)).rejects.toThrow('PINATA_RESPONSE_INVALID');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: providerId, cid, size: bytes.length + 1, number_of_files: 1 },
          }),
        ),
      ),
    );
    await expect(provider.upload(uploadId, bytes)).rejects.toThrow('PINATA_RESPONSE_INVALID');
  });
  it('retrieves exactly the expected bytes without following redirects', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(Uint8Array.from(bytes)));
    vi.stubGlobal('fetch', fetcher);
    expect(await provider.retrieve(cid, bytes.length)).toEqual(bytes);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://example.mypinata.cloud/ipfs/${cid}`);
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error');
  });
  it('keeps a gateway key in the server header and never sends the API JWT to the gateway', async () => {
    const guarded = new PinataStorage(
      'api-fixture-only',
      'https://example.mypinata.cloud',
      'gateway-fixture-only',
    );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(Uint8Array.from(bytes)));
    vi.stubGlobal('fetch', fetcher);
    expect(await guarded.retrieve(cid, bytes.length)).toEqual(bytes);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://example.mypinata.cloud/ipfs/${cid}`);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({
      'x-pinata-gateway-token': 'gateway-fixture-only',
    });
    for (const key of ['', 'bad\r\nheader', 'with space', 'x'.repeat(4097)])
      expect(
        () => new PinataStorage('api-fixture-only', 'https://example.mypinata.cloud', key),
      ).toThrow('CONTENT_GATEWAY_KEY');
    fetcher.mockResolvedValueOnce(new Response('private gateway key detail', { status: 401 }));
    await expect(guarded.retrieve(cid, bytes.length)).rejects.toThrow(/^CONTENT_UNAVAILABLE$/);
  });
  it('bounds gateway reads even when content length is omitted or inaccurate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () => new Response(Uint8Array.from(bytes))),
    );
    await expect(provider.retrieve(cid, bytes.length - 1)).rejects.toThrow('CONTENT_SIZE');
    await expect(provider.retrieve(cid, bytes.length + 1)).rejects.toThrow('CONTENT_SIZE');
  });
  it('redacts provider error details and requires a secure configured gateway', async () => {
    expect(() => new PinataStorage('fixture', 'http://gateway.example')).toThrow('CONTENT_GATEWAY');
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('private vendor detail fixture-token-only', { status: 401 }),
        ),
    );
    await expect(provider.upload(uploadId, bytes)).rejects.toThrow(/^PINATA_UNAVAILABLE$/);
  });
});

it('confirms a provider ID directly and requires absence after a delete acknowledgment', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ data: { id: providerId, cid, size: bytes.length, number_of_files: 1 } }),
    );
  vi.stubGlobal('fetch', fetcher);
  expect(await provider.file(providerId)).toEqual({ id: providerId, cid, size: bytes.length });
  fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
  expect(await provider.file(providerId)).toBeNull();
  for (const code of [401, 403, 429, 500]) {
    fetcher.mockResolvedValueOnce(new Response('private provider detail', { status: code }));
    await expect(provider.file(providerId)).rejects.toThrow('PINATA_UNAVAILABLE');
  }
  fetcher
    .mockResolvedValueOnce(Response.json({ data: null }))
    .mockResolvedValueOnce(
      Response.json({ data: { id: providerId, cid, size: bytes.length, number_of_files: 1 } }),
    );
  await expect(provider.remove(providerId)).rejects.toThrow('PINATA_REMOVAL_PENDING');
  fetcher
    .mockResolvedValueOnce(Response.json({ data: null }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  await provider.remove(providerId);
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe(
    'https://api.pinata.cloud/v3/files/public/' + providerId,
  );
  expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBeUndefined();
});

it('follows Pinata terminal cursors to prove complete upload and CID inventory', async () => {
  const file = {
    id: providerId,
    cid,
    size: bytes.length,
    number_of_files: 1,
    keyvalues: { daclify_upload: uploadId },
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { files: [file], next_page_token: 'terminal-cursor' } })),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { files: [], next_page_token: null } })),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { files: [file], next_page_token: 'cid-terminal' } })),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { files: [], next_page_token: null } })),
    );
  vi.stubGlobal('fetch', fetcher);
  const expected = [{ id: providerId, cid, size: bytes.length }];
  expect(await provider.find(uploadId)).toEqual(expected);
  expect(new URL(String(fetcher.mock.calls[1]?.[0])).searchParams.get('pageToken')).toBe(
    'terminal-cursor',
  );
  expect(await provider.findCid(cid)).toEqual(expected);
  expect(new URL(String(fetcher.mock.calls[3]?.[0])).searchParams.get('pageToken')).toBe(
    'cid-terminal',
  );
});
it('rejects cursor loops, duplicate IDs and more than ten provider objects without reporting partial ownership', async () => {
  const file = {
    id: providerId,
    cid,
    size: bytes.length,
    number_of_files: 1,
    keyvalues: { daclify_upload: uploadId },
  };
  for (const second of [
    { files: [], next_page_token: 'same' },
    { files: [file], next_page_token: null },
    {
      files: Array.from({ length: 10 }, () => ({ ...file, id: randomUUID() })),
      next_page_token: null,
    },
  ]) {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { files: [file], next_page_token: 'same' } })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: second })));
    vi.stubGlobal('fetch', fetcher);
    await expect(provider.find(uploadId)).rejects.toThrow('PINATA_RESPONSE_INVALID');
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
  }
});
it('bounds an endless sequence of distinct empty cursors', async () => {
  let sequence = 0;
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ data: { files: [], next_page_token: 'cursor-' + sequence++ } }),
        ),
    );
  vi.stubGlobal('fetch', fetcher);
  await expect(provider.find(uploadId)).rejects.toThrow('PINATA_RESPONSE_INVALID');
  expect(fetcher).toHaveBeenCalledTimes(11);
});
