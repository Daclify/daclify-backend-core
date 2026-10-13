import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  McpReleaseIdentitySchema,
  McpReleaseManifestSchema,
  McpArtifactNameSchema,
  type McpReleaseManifestSchema as Manifest,
} from '../../../../protocol/mcp.js';
import { z } from 'zod';
const invalid = () => Error('MCP_ARTIFACT_INTEGRITY');
export function mcpReleaseId(input: unknown) {
  const value = McpReleaseIdentitySchema.parse(input);
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export class McpArtifacts {
  private constructor(
    readonly directory: string,
    readonly manifest: z.infer<typeof Manifest>,
    readonly manifestBytes: Buffer,
    readonly manifestHash: string,
    private readonly archives: readonly McpArtifacts[] = [],
  ) {}
  static async load(directory: string, archiveDirectories: unknown = []): Promise<McpArtifacts> {
    const directories = z
      .array(z.string().startsWith('/').max(4096))
      .max(8)
      .safeParse(archiveDirectories);
    if (!directories.success) throw invalid();
    const path = resolve(directory, 'manifest.json'),
      info = await lstat(path);
    if (!info.isFile() || info.size < 1 || info.size > 65536) throw invalid();
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      bytes = await handle.readFile();
    } finally {
      await handle.close();
    }
    if (bytes.length !== info.size) throw invalid();
    const manifest = McpReleaseManifestSchema.parse(JSON.parse(bytes.toString())),
      { releaseId, ...identity } = manifest;
    if (mcpReleaseId(identity) !== releaseId) throw invalid();
    const result = new McpArtifacts(
      resolve(directory),
      manifest,
      bytes,
      createHash('sha256').update(bytes).digest('hex'),
      await Promise.all(directories.data.map((archive) => McpArtifacts.load(archive))),
    );
    const ids = [releaseId, ...result.archives.map((archive) => archive.manifest.releaseId)];
    if (new Set(ids).size !== ids.length) throw invalid();
    for (const file of manifest.files) {
      const opened = await result.openFile(file.name);
      await opened.close();
    }
    return result;
  }
  findRelease(releaseId: string): McpArtifacts | undefined {
    return this.manifest.releaseId === releaseId
      ? this
      : this.archives.find((archive) => archive.manifest.releaseId === releaseId);
  }
  async openFile(input: unknown) {
    const name = McpArtifactNameSchema.parse(input),
      file = this.manifest.files.find((value) => value.name === name);
    if (!file) throw invalid();
    const handle = await open(
      resolve(this.directory, name),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size !== file.bytes) throw invalid();
      const hash = createHash('sha256');
      let count = 0;
      for await (const bytes of handle.createReadStream({ autoClose: false, start: 0 })) {
        count += bytes.length;
        if (count > file.bytes) throw invalid();
        hash.update(bytes);
      }
      if (count !== file.bytes || hash.digest('hex') !== file.sha256) throw invalid();
      return handle;
    } catch (cause) {
      await handle.close();
      throw cause;
    }
  }
}
