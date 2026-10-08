// Local disk fixture only. It does not establish Pinata or IPFS availability.
import { mkdir, writeFile, readFile, stat, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { CidSchema } from '../../protocol/base.js';
import { MAX_HOSTED_CONTENT_BYTES } from '../../protocol/storage.js';
import type { ContentProvider, PinnedFile } from '../../services/api/src/content/provider.js';
const RecordSchema = z.strictObject({
  id: z.uuid(),
  uploadId: z.uuid(),
  cid: CidSchema,
  size: z.int().min(1).max(MAX_HOSTED_CONTENT_BYTES),
});
export class LocalContentFixture implements ContentProvider {
  constructor(private readonly directory: string) {}
  async upload(uploadId: string, bytes: Uint8Array): Promise<PinnedFile> {
    z.uuid().parse(uploadId);
    if (!bytes.length || bytes.length > MAX_HOSTED_CONTENT_BYTES) throw new Error('CONTENT_SIZE');
    await mkdir(this.directory, { recursive: true });
    const cid = CID.createV1(0x55, await sha256.digest(bytes)).toString();
    const record = RecordSchema.parse({ id: randomUUID(), uploadId, cid, size: bytes.length });
    await writeFile(join(this.directory, `${cid}.bin`), bytes);
    await writeFile(join(this.directory, `${uploadId}.json`), JSON.stringify(record));
    return { id: record.id, cid, size: record.size };
  }
  async find(uploadId: string): Promise<PinnedFile[]> {
    z.uuid().parse(uploadId);
    try {
      const record = RecordSchema.parse(
        JSON.parse(await readFile(join(this.directory, `${uploadId}.json`), 'utf8')),
      );
      return [{ id: record.id, cid: record.cid, size: record.size }];
    } catch (cause) {
      if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') return [];
      throw cause;
    }
  }
  async retrieve(cid: string, expectedBytes: number): Promise<Uint8Array> {
    CidSchema.parse(cid);
    z.int().min(1).max(MAX_HOSTED_CONTENT_BYTES).parse(expectedBytes);
    const path = join(this.directory, `${cid}.bin`);
    if ((await stat(path)).size !== expectedBytes) throw new Error('CONTENT_SIZE');
    const bytes = await readFile(path);
    if (bytes.length !== expectedBytes) throw new Error('CONTENT_SIZE');
    return bytes;
  }
  async findCid(cid: string): Promise<PinnedFile[]> {
    CidSchema.parse(cid);
    const found: PinnedFile[] = [];
    for (const filename of await readdir(this.directory)) {
      if (!filename.endsWith('.json')) continue;
      const record = RecordSchema.parse(
        JSON.parse(await readFile(join(this.directory, filename), 'utf8')),
      );
      if (record.cid === cid) found.push({ id: record.id, cid, size: record.size });
      if (found.length > 10) throw new Error('CONTENT_INVENTORY_LIMIT');
    }
    return found;
  }
  async remove(providerId: string): Promise<void> {
    z.uuid().parse(providerId);
    for (const filename of await readdir(this.directory)) {
      if (!filename.endsWith('.json')) continue;
      const record = RecordSchema.parse(
        JSON.parse(await readFile(join(this.directory, filename), 'utf8')),
      );
      if (record.id === providerId) await unlink(join(this.directory, filename));
    }
    // Bytes are retained so removing one fixture reference does not destroy shared content.
  }
}
