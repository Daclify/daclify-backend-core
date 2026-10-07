import { createHash } from 'node:crypto';
import { ABI, Serializer } from '@wharfkit/antelope';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const REPOSITORIES = [
  'daclify-backend-core',
  'daclify-backend-modules',
  'daclify-frontend',
] as const;

const HELD_CHECKS = [
  'live SMTP deliverability and Telegram provider/client qualification',
  'real Anchor and EOA wallet-client qualification',
  'OpenBao durable production signing, audit, recovery and isolation qualification',
  'selected production chain protocol-feature and authority verification',
  'Stripe sandbox Connect OAuth/v2 onboarding, direct charge, refund and dispute qualification',
  'Stripe sandbox graduated subscriptions, invoice lifecycle and native capacity qualification',
  'independent operator browser cookie/CORS and wallet-client qualification',
  'immutable published artifact verification',
] as const;

const HashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const RepositorySchema = z.object({
  name: z.enum(REPOSITORIES),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  version: z.string().min(1),
  lockfileSha256: HashSchema,
});
const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  publication: z.literal('refused'),
  qualified: z.literal(false),
  reason: z.string().min(1),
  repositories: z.array(RepositorySchema).length(3),
  toolchain: z.object({
    cdt: z.literal('4.1.1'),
    spring: z.literal('1.2.2'),
    node: z.string().min(1),
  }),
  interfaceVersion: z.literal(1),
  artifacts: z.object({
    runtimeCodeHash: HashSchema,
    runtimeAbiSha256: HashSchema,
    runtimeRawAbiSha256: HashSchema,
    documentationSha256: HashSchema,
  }),
  moduleCapabilities: z.array(z.string().min(1)).min(1),
  moduleCodeHashes: z.record(z.string(), HashSchema),
  checks: z.object({
    held: z.array(z.string().min(1)).min(1),
    recordedPasses: z.array(z.string()),
  }),
});
export type ReleaseManifest = z.infer<typeof ManifestSchema>;

export interface ManifestInput {
  repositories: readonly z.infer<typeof RepositorySchema>[];
  artifacts: ReleaseManifest['artifacts'];
  moduleCapabilities: readonly string[];
  moduleCodeHashes?: Readonly<Record<string, string>>;
  recordedPasses?: readonly string[];
  publication?: string;
  qualified?: boolean;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pin(message: string): never {
  throw new Error(`MANIFEST_PIN: ${message}`);
}

export function buildReleaseManifest(input: ManifestInput): ReleaseManifest {
  const names = new Set(input.repositories.map((repository) => repository.name));
  if (input.repositories.length !== REPOSITORIES.length || names.size !== REPOSITORIES.length)
    pin('the manifest must pin each repository once');
  for (const name of REPOSITORIES) if (!names.has(name)) pin(`missing repository ${name}`);
  if (input.moduleCapabilities.length === 0) pin('module capabilities are missing');
  const parsed = ManifestSchema.safeParse({
    schemaVersion: 1,
    publication: 'refused',
    qualified: false,
    reason:
      'Publication is refused. Held checks and pinned artifact verification are not a qualified release.',
    repositories: [...input.repositories],
    toolchain: { cdt: '4.1.1', spring: '1.2.2', node: process.versions.node },
    interfaceVersion: 1,
    artifacts: input.artifacts,
    moduleCapabilities: [...input.moduleCapabilities],
    moduleCodeHashes: { ...(input.moduleCodeHashes ?? {}) },
    checks: {
      held: [...HELD_CHECKS],
      recordedPasses: [...(input.recordedPasses ?? [])],
    },
  });
  if (!parsed.success) pin(parsed.error.issues.map((issue) => issue.message).join('; '));
  return parsed.data;
}

export function publishRelease(_manifest: ReleaseManifest): never {
  throw new Error(
    'PUBLICATION_REFUSED: the release manifest records pins and refuses publication until the held checks pass.',
  );
}

function sha256(file: string): string {
  if (!existsSync(file)) pin(`missing artifact ${file}`);
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function gitCommit(cwd: string): string {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) pin(`commit at ${cwd}`);
  return commit;
}

function packageVersion(file: string, expectedName: string): string {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (
    !record(parsed) ||
    parsed.name !== expectedName ||
    typeof parsed.version !== 'string' ||
    parsed.version.length === 0
  )
    pin(`package identity in ${file}`);
  return parsed.version;
}

function modulePins(modulesRoot: string): {
  capabilities: string[];
  hashes: Record<string, string>;
} {
  const contracts = path.join(modulesRoot, 'contracts');
  const capabilities = readdirSync(contracts, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'common' && entry.name !== 'vendor')
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(contracts, name, `${name}.cpp`)))
    .sort();
  if (capabilities.length === 0) pin('module capabilities are missing');
  const hashes: Record<string, string> = {};
  for (const name of capabilities)
    hashes[
      name === 'grants' ? 'grants-rounds' : name === 'endorse' ? 'endorsement-admission' : name
    ] = sha256(path.join(modulesRoot, '.artifacts', 'contracts', `${name}.wasm`));
  return {
    capabilities: capabilities.map((name) =>
      name === 'grants' ? 'grants-rounds' : name === 'endorse' ? 'endorsement-admission' : name,
    ),
    hashes,
  };
}

export function loadCheckoutManifest(coreRoot: string): ReleaseManifest {
  const workspace = path.dirname(path.resolve(coreRoot));
  const modulesRoot = path.join(workspace, 'daclify-backend-modules');
  const frontendRoot = path.join(workspace, 'daclify-frontend');
  const toolchain: unknown = JSON.parse(
    readFileSync(path.join(coreRoot, 'docs/evidence/toolchain.json'), 'utf8'),
  );
  if (
    !record(toolchain) ||
    toolchain.compiler !== 'Antelope CDT 4.1.1' ||
    toolchain.nativeRuntime !== 'Antelope Spring 1.2.2'
  )
    pin('toolchain record');
  const modules = modulePins(modulesRoot);
  return buildReleaseManifest({
    repositories: [
      {
        name: 'daclify-backend-core',
        commit: gitCommit(coreRoot),
        version: packageVersion(path.join(coreRoot, 'package.json'), '@daclify/backend-core'),
        lockfileSha256: sha256(path.join(coreRoot, 'package-lock.json')),
      },
      {
        name: 'daclify-backend-modules',
        commit: gitCommit(modulesRoot),
        version: packageVersion(path.join(modulesRoot, 'package.json'), '@daclify/modules'),
        lockfileSha256: sha256(path.join(modulesRoot, 'package-lock.json')),
      },
      {
        name: 'daclify-frontend',
        commit: gitCommit(frontendRoot),
        version: packageVersion(path.join(frontendRoot, 'package.json'), '@daclify/frontend'),
        lockfileSha256: sha256(path.join(frontendRoot, 'package-lock.json')),
      },
    ],
    artifacts: {
      runtimeCodeHash: sha256(path.join(coreRoot, '.artifacts', 'contracts', 'runtime.wasm')),
      runtimeAbiSha256: sha256(path.join(coreRoot, '.artifacts', 'contracts', 'runtime.abi')),
      runtimeRawAbiSha256: createHash('sha256')
        .update(
          Serializer.encode({
            object: ABI.from(
              readFileSync(path.join(coreRoot, '.artifacts', 'contracts', 'runtime.abi'), 'utf8'),
            ),
          }).array,
        )
        .digest('hex'),
      documentationSha256: sha256(path.join(coreRoot, 'docs', 'generated', 'reference.json')),
    },
    moduleCapabilities: modules.capabilities,
    moduleCodeHashes: modules.hashes,
  });
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const manifest = loadCheckoutManifest(process.cwd());
  console.log(JSON.stringify(manifest, null, 2));
  if (process.argv.includes('--publish')) publishRelease(manifest);
}
