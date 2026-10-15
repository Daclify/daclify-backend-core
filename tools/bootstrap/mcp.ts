// Dependency-free: source-only checkouts need these released peers before npm ci can run.
import { readFileSync, mkdirSync, writeFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const core = resolve(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
const modules = resolve(process.argv[3] ?? join(dirname(core), 'daclify-backend-modules'));
const companion = join(core, 'packages/community-mcp');
function record(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
function object(input: unknown): Record<string, unknown> {
  if (!record(input)) throw Error('MCP_PACKAGE_INVALID');
  return input;
}
const manifest = object(JSON.parse(readFileSync(join(companion, 'package.json'), 'utf8')));
const peers = object(manifest.peerDependencies);
const dependencies = object(manifest.devDependencies);
const lock = object(
  object(JSON.parse(readFileSync(join(companion, 'package-lock.json'), 'utf8'))).packages,
);
for (const [name, root, prefix, relative] of [
  ['@daclify/core-protocol', core, 'daclify-core-protocol', '../../.artifacts/'],
  ['@daclify/modules', modules, 'daclify-modules', '../../../daclify-backend-modules/.artifacts/'],
]) {
  if (!name || !root || !prefix || !relative) throw Error('MCP_PACKAGE_INVALID');
  const version = peers[name];
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
    throw Error('MCP_RELEASE_PINS');
  const filename = `${prefix}-${version}.tgz`;
  const dependency = `file:${relative}${filename}`;
  const pin = object(lock[`node_modules/${name}`]);
  if (
    dependencies[name] !== dependency ||
    pin.resolved !== dependency ||
    pin.version !== version ||
    typeof pin.integrity !== 'string' ||
    !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(pin.integrity)
  )
    throw Error('MCP_RELEASE_PINS');
  const bytes = readFileSync(join(companion, 'vendor', filename));
  if ('sha512-' + createHash('sha512').update(bytes).digest('base64') !== pin.integrity)
    throw Error('MCP_RELEASE_INTEGRITY');
  const target = join(root, '.artifacts', filename);
  mkdirSync(dirname(target), { recursive: true });
  try {
    writeFileSync(target, bytes, { flag: 'wx' });
  } catch (cause) {
    if (!(cause instanceof Error) || !('code' in cause) || cause.code !== 'EEXIST') throw cause;
    if (!lstatSync(target).isFile() || !readFileSync(target).equals(bytes))
      throw Error('MCP_RELEASE_IMMUTABLE');
  }
}
