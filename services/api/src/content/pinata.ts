import { readBoundedResponse } from '../http.js';
import type { ContentProvider, PinnedFile } from './provider.js';
import { z } from 'zod';
import { CidSchema } from '../../../../protocol/base.js';
import { ApiError } from '../errors.js';
import { MAX_HOSTED_CONTENT_BYTES } from '../../../../protocol/storage.js';
import type { GatewayAllowance } from './gateway-allowance.js';
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
  #gatewayKey: string | undefined;
  constructor(
    jwt: string,
    gateway: string,
    gatewayKey?: string,
    private readonly allowance?: GatewayAllowance,
  ) {
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
    if (gatewayKey !== undefined && !/^[\x21-\x7e]{1,4096}$/.test(gatewayKey))
      throw new Error('CONTENT_GATEWAY_KEY');
    this.#gatewayKey = gatewayKey;
    if (allowance && !gatewayKey) throw new Error('CONTENT_GATEWAY_KEY_REQUIRED');
  }
  async #request(url: string, init: RequestInit = {}, allowNotFound = false): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { authorization: `Bearer ${this.#jwt}` },
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok && !(allowNotFound && response.status === 404))
        throw new ApiError('PINATA_UNAVAILABLE', 503);
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
  async #list(params: URLSearchParams): Promise<z.infer<typeof ListedFileSchema>[]> {
    const files: z.infer<typeof ListedFileSchema>[] = [];
    const ids = new Set<string>(),
      cursors = new Set<string>();
    for (let page = 0; page <= 10; page++) {
      const parsed = z
        .object({
          data: z.object({
            files: z.array(ListedFileSchema).max(10),
            next_page_token: z.string().max(4096).nullable().optional(),
          }),
        })
        .safeParse(
          await vendorJson(
            await this.#request(`https://api.pinata.cloud/v3/files/public?${params}`),
          ),
        );
      if (!parsed.success || files.length + parsed.data.data.files.length > 10)
        throw new ApiError('PINATA_RESPONSE_INVALID', 502);
      for (const file of parsed.data.data.files) {
        if (ids.has(file.id)) throw new ApiError('PINATA_RESPONSE_INVALID', 502);
        ids.add(file.id);
        files.push(file);
      }
      const cursor = parsed.data.data.next_page_token;
      // Pinata can return a last-row cursor even when the next page is empty.
      if (!cursor) return files;
      if (cursors.has(cursor)) throw new ApiError('PINATA_RESPONSE_INVALID', 502);
      cursors.add(cursor);
      params.set('pageToken', cursor);
    }
    throw new ApiError('PINATA_RESPONSE_INVALID', 502);
  }
  async find(uploadId: string): Promise<PinnedFile[]> {
    z.uuid().parse(uploadId);
    const files = await this.#list(
      new URLSearchParams({ 'keyvalues[daclify_upload]': uploadId, limit: '10' }),
    );
    if (files.some((file) => file.keyvalues.daclify_upload !== uploadId))
      throw new ApiError('PINATA_RESPONSE_INVALID', 502);
    return files.map((file) => ({ id: file.id, cid: file.cid, size: file.size }));
  }
  async findCid(cid: string): Promise<PinnedFile[]> {
    CidSchema.parse(cid);
    const files = await this.#list(new URLSearchParams({ cid, limit: '10' }));
    if (files.some((file) => file.cid !== cid)) throw new ApiError('PINATA_RESPONSE_INVALID', 502);
    return files
      .filter((file) => z.uuid().safeParse(file.keyvalues.daclify_upload).success)
      .map((file) => ({ id: file.id, cid: file.cid, size: file.size }));
  }
  async retrieve(cid: string, expectedBytes: number): Promise<Uint8Array> {
    CidSchema.parse(cid);
    if (
      !Number.isInteger(expectedBytes) ||
      expectedBytes < 1 ||
      expectedBytes > MAX_HOSTED_CONTENT_BYTES
    )
      throw new ApiError('CONTENT_SIZE');
    await this.allowance?.reserve(expectedBytes);
    try {
      const response = await fetch(`${this.#gateway}/ipfs/${cid}`, {
        headers: this.#gatewayKey ? { 'x-pinata-gateway-token': this.#gatewayKey } : {},
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
  async file(providerId: string): Promise<PinnedFile | null> {
    z.uuid().parse(providerId);
    const response = await this.#request(
      `https://api.pinata.cloud/v3/files/public/${providerId}`,
      {},
      true,
    );
    if (response.status === 404) return null;
    const parsed = z.object({ data: FileSchema }).safeParse(await vendorJson(response));
    if (!parsed.success || parsed.data.data.id !== providerId)
      throw new ApiError('PINATA_RESPONSE_INVALID', 502);
    const file = parsed.data.data;
    return { id: file.id, cid: file.cid, size: file.size };
  }
  async remove(providerId: string): Promise<void> {
    z.uuid().parse(providerId);
    await this.#request(
      `https://api.pinata.cloud/v3/files/public/${providerId}`,
      { method: 'DELETE' },
      true,
    );
    if (await this.file(providerId)) throw new ApiError('PINATA_REMOVAL_PENDING', 503);
  }
}
