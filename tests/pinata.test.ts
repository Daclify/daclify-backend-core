import { afterEach, describe, it, expect, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import { PinataStorage } from '../services/api/src/content/pinata.js';
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
