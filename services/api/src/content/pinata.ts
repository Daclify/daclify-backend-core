import { readBoundedResponse } from '../http.js';
import type { ContentProvider, PinnedFile } from './provider.js';
import { z } from 'zod';
import { CidSchema } from '../../../../protocol/base.js';
import { ApiError } from '../errors.js';
import { MAX_HOSTED_CONTENT_BYTES } from '../../../../protocol/storage.js';
const FileSchema = z.object({
  id: z.uuid(),
  cid: CidSchema,
  size: z.int().min(1).max(MAX_HOSTED_CONTENT_BYTES),
  number_of_files: z.literal(1),
});
const ListedFileSchema = FileSchema.extend({ keyvalues: z.record(z.string(), z.string()) });
async function vendorJson(response: Response): Promise<unknown> {
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await readBoundedResponse(response, 256 * 1024),
      ),
    );
  } catch {
    throw new ApiError('PINATA_RESPONSE_INVALID', 502);
  }
}
export class PinataStorage implements ContentProvider {
  #jwt: string;
  #gateway: string;
  constructor(jwt: string, gateway: string) {
    try {
      const url = new URL(gateway);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        throw new Error();
      this.#gateway = url.origin;
    } catch {
      throw new Error('CONTENT_GATEWAY');
    }
    if (!jwt || /[\r\n]/.test(jwt)) throw new Error('PINATA_CONFIGURATION');
    this.#jwt = jwt;
  }
  async #request(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { authorization: `Bearer ${this.#jwt}` },
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new ApiError('PINATA_UNAVAILABLE', 503);
      return response;
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw new ApiError('PINATA_UNAVAILABLE', 503);
    }
  }
  async upload(uploadId: string, bytes: Uint8Array): Promise<PinnedFile> {
    z.uuid().parse(uploadId);
    if (!bytes.length || bytes.length > MAX_HOSTED_CONTENT_BYTES)
      throw new ApiError('CONTENT_SIZE');
    const name = `daclify-${uploadId}.bin`;
    const body = new FormData();
    body.set(
      'file',
      new File([Uint8Array.from(bytes)], name, { type: 'application/octet-stream' }),
    );
    body.set('network', 'public');
    body.set('name', name);
    body.set('cid_version', 'v1');
    body.set('keyvalues', JSON.stringify({ daclify_upload: uploadId }));
    const parsed = z
      .object({ data: FileSchema })
      .safeParse(
        await vendorJson(
          await this.#request('https://uploads.pinata.cloud/v3/files', { method: 'POST', body }),
        ),
      );
    if (!parsed.success || parsed.data.data.size !== bytes.length)
      throw new ApiError('PINATA_RESPONSE_INVALID', 502);
    const file = parsed.data.data;
    return { id: file.id, cid: file.cid, size: file.size };
  }
  async find(uploadId: string): Promise<PinnedFile[]> {
    z.uuid().parse(uploadId);
    const params = new URLSearchParams({ 'keyvalues[daclify_upload]': uploadId, limit: '10' });
    const parsed = z
      .object({
        data: z.object({
          files: z.array(ListedFileSchema).max(10),
          next_page_token: z.string().nullable().optional(),
        }),
      })
      .safeParse(
        await vendorJson(await this.#request(`https://api.pinata.cloud/v3/files/public?${params}`)),
      );
    if (
      !parsed.success ||
      parsed.data.data.next_page_token ||
      parsed.data.data.files.some((file) => file.keyvalues.daclify_upload !== uploadId)
    )
      throw new ApiError('PINATA_RESPONSE_INVALID', 502);
    return parsed.data.data.files.map((file) => ({ id: file.id, cid: file.cid, size: file.size }));
  }
  async retrieve(cid: string, expectedBytes: number): Promise<Uint8Array> {
    CidSchema.parse(cid);
    if (
      !Number.isInteger(expectedBytes) ||
      expectedBytes < 1 ||
      expectedBytes > MAX_HOSTED_CONTENT_BYTES
    )
      throw new ApiError('CONTENT_SIZE');
    try {
      const response = await fetch(`${this.#gateway}/ipfs/${cid}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new ApiError('CONTENT_UNAVAILABLE', 503);
      const bytes = await readBoundedResponse(response, expectedBytes);
      if (bytes.length !== expectedBytes) throw new ApiError('CONTENT_SIZE', 502);
      return bytes;
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw new ApiError('CONTENT_UNAVAILABLE', 503);
    }
  }
  async remove(providerId: string): Promise<void> {
    z.uuid().parse(providerId);
    try {
      const response = await fetch(`https://api.pinata.cloud/v3/files/public/${providerId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${this.#jwt}` },
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok && response.status !== 404) throw new ApiError('PINATA_UNAVAILABLE', 503);
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw new ApiError('PINATA_UNAVAILABLE', 503);
    }
  }
}
