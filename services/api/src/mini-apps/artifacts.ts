import { createHash } from 'node:crypto';
import { open, lstat, type FileHandle } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  MiniAppReleaseManifestSchema,
  type MiniAppReleaseManifest,
} from '../../../../protocol/mini-apps.js';
const integrity = () => new Error('MINI_APP_ARTIFACT_INTEGRITY');
export function miniAppReleaseId(input: unknown): string {
  const { version, coreVersion, modulesVersion, packageLockHash, files } =
    MiniAppReleaseManifestSchema.parse(input);
  return createHash('sha256')
    .update(JSON.stringify({ version, coreVersion, modulesVersion, packageLockHash, files }))
    .digest('hex');
}
type ArtifactName = MiniAppReleaseManifest['files'][number]['name'];
export class MiniAppArtifacts {
  private constructor(
    readonly directory: string,
    readonly manifest: MiniAppReleaseManifest,
    readonly manifestBytes: Buffer,
    readonly manifestHash: string,
    private readonly archives: readonly MiniAppArtifacts[] = [],
  ) {}
  static async load(
    directory: string,
    archiveDirectories: unknown = [],
  ): Promise<MiniAppArtifacts> {
    const parsedDirectories = z
      .array(z.string().startsWith('/').max(4096))
      .max(8)
      .safeParse(archiveDirectories);
    if (!parsedDirectories.success) throw integrity();
    const path = resolve(directory, 'manifest.json');
    const info = await lstat(path);
    if (!info.isFile() || info.size < 1 || info.size > 65536) throw integrity();
    const handle = await open(path, 'r');
    let bytes: Buffer;
    try {
      bytes = await handle.readFile();
    } finally {
      await handle.close();
    }
    if (bytes.length !== info.size || bytes.length > 65536) throw integrity();
    const parsed = MiniAppReleaseManifestSchema.safeParse(JSON.parse(bytes.toString('utf8')));
    if (!parsed.success || miniAppReleaseId(parsed.data) !== parsed.data.releaseId)
      throw integrity();
    const artifacts = new MiniAppArtifacts(
      resolve(directory),
      parsed.data,
      bytes,
      createHash('sha256').update(bytes).digest('hex'),
      await Promise.all(parsedDirectories.data.map((archive) => MiniAppArtifacts.load(archive))),
    );
    const releaseIds = [
      artifacts.manifest.releaseId,
      ...artifacts.archives.map((archive) => archive.manifest.releaseId),
    ];
    if (new Set(releaseIds).size !== releaseIds.length) throw integrity();
    for (const file of parsed.data.files) {
      const handle = await artifacts.openFile(file.name);
      await handle.close();
    }
    return artifacts;
  }
  findRelease(releaseId: string): MiniAppArtifacts | undefined {
    return this.manifest.releaseId === releaseId
      ? this
      : this.archives.find((archive) => archive.manifest.releaseId === releaseId);
  }
  async openFile(name: ArtifactName): Promise<FileHandle> {
    const file = this.manifest.files.find((file) => file.name === name);
    if (!file) throw integrity();
    const path = resolve(this.directory, name);
    const info = await lstat(path);
    if (!info.isFile() || info.size !== file.bytes) throw integrity();
    const handle = await open(path, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== file.bytes) throw integrity();
      const hash = createHash('sha256');
      let total = 0;
      for await (const bytes of handle.createReadStream({ autoClose: false, start: 0 })) {
        total += bytes.length;
        if (total > file.bytes) throw integrity();
        hash.update(bytes);
      }
      if (total !== file.bytes || hash.digest('hex') !== file.sha256) throw integrity();
      return handle;
    } catch (error) {
      await handle.close();
      throw error;
    }
  }
}
