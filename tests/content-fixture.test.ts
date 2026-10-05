import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalContentFixture } from '../tools/native/content-fixture.js';
describe('explicit local hosted-file fixture', () => {
  it('returns a content-addressed receipt and keeps shared bytes after one reference is removed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'daclify-content-'));
    try {
      const provider = new LocalContentFixture(directory);
      const bytes = Buffer.from('Synthetic downloadable fixture');
      const request = randomUUID();
      const first = await provider.upload(request, bytes);
      const second = await provider.upload(randomUUID(), bytes);
      expect(first.cid).toBe(second.cid);
      expect(await provider.find(request)).toEqual([first]);
      expect(await provider.retrieve(first.cid, bytes.length)).toEqual(bytes);
      await provider.remove(first.id);
      expect(await provider.find(request)).toEqual([]);
      expect(await provider.retrieve(second.cid, bytes.length)).toEqual(bytes);
      await expect(provider.retrieve(second.cid, bytes.length + 1)).rejects.toThrow('CONTENT_SIZE');
      await expect(provider.retrieve('../not-a-cid', bytes.length)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
