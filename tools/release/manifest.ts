import { createHash } from 'node:crypto';
import { ABI, Serializer } from '@wharfkit/antelope';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const REPOSITORIES = [
  'daclify-backend-core',
  'daclify-backend-modules',
  'daclify-frontend',
] as const;

export const ReleaseChecks: Readonly<Record<string, string>> = Object.freeze({
  social: 'live SMTP deliverability and Telegram provider/client qualification',
  wallets: 'real Anchor and EOA wallet-client qualification',
  custody: 'OpenBao durable production signing, audit, recovery and isolation qualification',
  chain: 'selected production chain protocol-feature and authority verification',
  connect:
    'Stripe sandbox Connect OAuth/v2 onboarding, direct charge, refund and dispute qualification',
  subscriptions:
    'Stripe sandbox graduated subscriptions, invoice lifecycle and native capacity qualification',
  independent: 'independent operator browser cookie/CORS and wallet-client qualification',
  artifacts: 'immutable packed artifact and consumer-installation verification',
  ram: 'target-chain RAM conservation, module completion bounds and external token-row ownership qualification',
  migration:
    'supported old-release and already-observed adoption, pending executable-work drain and recovery qualification',
  billing:
    'Stripe sandbox RAM fulfilment and prepaid storage payment/grace lifecycle qualification',
  content:
    'separate Pinata account ownership, gateway funding/access controls, retention compensation and live delivery qualification',
});
const HELD_CHECKS = Object.values(ReleaseChecks);

const HashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const CheckSchema = z.string().refine((id) => Object.hasOwn(ReleaseChecks, id));
const EvidenceReferenceSchema = z.strictObject({
  id: CheckSchema,
  path: z.string().min(1).max(1024),
  sha256: HashSchema,
});
const EvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  subject: HashSchema,
  checks: z.array(EvidenceReferenceSchema).max(64),
});
const ReportBase = z.strictObject({
  schemaVersion: z.literal(1),
  check: CheckSchema,
  subject: HashSchema,
  status: z.literal('passed'),
  assertions: z.int().positive(),
  failed: z.literal(0),
  skipped: z.literal(0),
});
const ReportSchema = z.discriminatedUnion('method', [
  ReportBase.extend({ method: z.literal('command'), exitCode: z.literal(0) }),
  ReportBase.extend({ method: z.literal('operator'), reviewer: z.string().min(1).max(256) }),
]);
const RepositorySchema = z.object({
  name: z.enum(REPOSITORIES),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  version: z.string().min(1),
  lockfileSha256: HashSchema,
});
const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  publication: z.enum(['refused', 'eligible']),
  qualified: z.boolean(),
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
    corePackageSha256: HashSchema,
    modulesPackageSha256: HashSchema,
    frontendBuildSha256: HashSchema,
    sdkBuildSha256: HashSchema,
  }),
  moduleCapabilities: z.array(z.string().min(1)).min(1),
  moduleCodeHashes: z.record(z.string(), HashSchema),
  moduleAbiSha256: z.record(z.string(), HashSchema),
  checks: z.object({
    held: z.array(z.string().min(1)),
    recordedPasses: z.array(z.string()),
    evidence: z.array(EvidenceReferenceSchema).max(64).default([]),
    subject: HashSchema.optional(),
  }),
});
export type ReleaseManifest = z.infer<typeof ManifestSchema>;

export interface ManifestInput {
  repositories: readonly z.infer<typeof RepositorySchema>[];
  artifacts: ReleaseManifest['artifacts'];
  moduleCapabilities: readonly string[];
  moduleCodeHashes?: Readonly<Record<string, string>>;
  moduleAbiSha256?: Readonly<Record<string, string>>;
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
    moduleAbiSha256: { ...(input.moduleAbiSha256 ?? {}) },
    checks: {
      held: [...HELD_CHECKS],
      recordedPasses: [...(input.recordedPasses ?? [])],
    },
  });
  if (!parsed.success) pin(parsed.error.issues.map((issue) => issue.message).join('; '));
  return parsed.data;
}

export function releaseSubject(manifest: ReleaseManifest): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        repositories: [...manifest.repositories].sort((a, b) => a.name.localeCompare(b.name)),
        toolchain: manifest.toolchain,
        interfaceVersion: manifest.interfaceVersion,
        artifacts: manifest.artifacts,
        moduleCapabilities: [...manifest.moduleCapabilities].sort(),
        moduleAbiSha256: Object.fromEntries(
          Object.entries(manifest.moduleAbiSha256).sort(([a], [b]) => a.localeCompare(b)),
        ),
        moduleCodeHashes: Object.fromEntries(
          Object.entries(manifest.moduleCodeHashes).sort(([a], [b]) => a.localeCompare(b)),
        ),
      }),
    )
    .digest('hex');
}
export function qualifyRelease(
  manifest: ReleaseManifest,
  evidenceRoot: string,
  value: unknown,
): ReleaseManifest {
  try {
    const base = ManifestSchema.parse(manifest),
      evidence = EvidenceSchema.parse(value),
      subject = releaseSubject(base);
    if (
      base.moduleCapabilities.some(
        (id) => !base.moduleCodeHashes[id] || !base.moduleAbiSha256[id],
      ) ||
      evidence.subject !== subject ||
      evidence.checks.length !== HELD_CHECKS.length ||
      new Set(evidence.checks.map((check) => check.id)).size !== HELD_CHECKS.length
    )
      throw new Error();
    const root = realpathSync(evidenceRoot);
    for (const check of evidence.checks) {
      if (path.isAbsolute(check.path) || check.path.includes('\0')) throw new Error();
      const file = realpathSync(path.resolve(root, check.path)),
        relative = path.relative(root, file);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error();
      const stat = statSync(file);
      if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error();
      const bytes = readFileSync(file);
      if (createHash('sha256').update(bytes).digest('hex') !== check.sha256) throw new Error();
      const report = ReportSchema.parse(JSON.parse(bytes.toString('utf8')));
      if (report.subject !== subject || report.check !== check.id) throw new Error();
    }
    return ManifestSchema.parse({
      ...base,
      publication: 'eligible',
      qualified: true,
      reason:
        'All required source-bound reports were verified; packaging is eligible. This is not publication or deployment authorization.',
      checks: {
        held: [],
        recordedPasses: evidence.checks.map((check) => ReleaseChecks[check.id]),
        evidence: evidence.checks,
        subject,
      },
    });
  } catch {
    throw new Error(
      'RELEASE_EVIDENCE: required source-bound reports are missing, stale, failed or invalid.',
    );
  }
}
// Eligibility is an operator-reviewed evidence snapshot; packaging verifies the reports again.
export function publishRelease(manifest: ReleaseManifest): void {
  const result = ManifestSchema.safeParse(manifest);
  if (
    !result.success ||
    result.data.publication !== 'eligible' ||
    !result.data.qualified ||
    result.data.checks.subject !== releaseSubject(result.data) ||
    result.data.moduleCapabilities.some(
      (id) => !result.data.moduleCodeHashes[id] || !result.data.moduleAbiSha256[id],
    ) ||
    result.data.checks.held.length ||
    result.data.checks.evidence.length !== HELD_CHECKS.length ||
    new Set(result.data.checks.evidence.map((check) => check.id)).size !== HELD_CHECKS.length
  )
    throw new Error(
      'PUBLICATION_REFUSED: all required source-bound qualification reports must pass.',
    );
}

function sha256(file: string): string {
  if (!existsSync(file)) pin(`missing artifact ${file}`);
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function treeHash(root: string, directories: string[]): string {
  const digest = createHash('sha256');
  function visit(relative: string): void {
    const file = path.join(root, relative),
      stat = lstatSync(file);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(file).sort()) visit(path.join(relative, entry));
    } else if (stat.isFile()) {
      digest.update(relative.split(path.sep).join('/') + '\0');
      digest.update(sha256(file) + '\0');
    } else pin('unsupported artifact file');
  }
  for (const directory of directories.sort()) visit(directory);
  return digest.digest('hex');
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
  abiHashes: Record<string, string>;
} {
  const contracts = path.join(modulesRoot, 'contracts');
  const capabilities = readdirSync(contracts, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'common' && entry.name !== 'vendor')
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(contracts, name, `${name}.cpp`)))
    .sort();
  if (capabilities.length === 0) pin('module capabilities are missing');
  const hashes: Record<string, string> = {};
  const abiHashes: Record<string, string> = {};
  for (const name of capabilities) {
    const id =
      name === 'grants' ? 'grants-rounds' : name === 'endorse' ? 'endorsement-admission' : name;
    abiHashes[id] = sha256(path.join(modulesRoot, '.artifacts', 'contracts', `${name}.abi`));
    hashes[
      name === 'grants' ? 'grants-rounds' : name === 'endorse' ? 'endorsement-admission' : name
    ] = sha256(path.join(modulesRoot, '.artifacts', 'contracts', `${name}.wasm`));
  }
  return {
    abiHashes,
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
      corePackageSha256: sha256(
        path.join(
          coreRoot,
          '.artifacts',
          `daclify-core-protocol-${packageVersion(path.join(coreRoot, 'sdk/public-package.json'), '@daclify/core-protocol')}.tgz`,
        ),
      ),
      modulesPackageSha256: sha256(
        path.join(
          modulesRoot,
          '.artifacts',
          `daclify-modules-${packageVersion(path.join(modulesRoot, 'package.json'), '@daclify/modules')}.tgz`,
        ),
      ),
      frontendBuildSha256: treeHash(frontendRoot, ['dist']),
      sdkBuildSha256: treeHash(coreRoot, ['dist/protocol', 'dist/sdk']),
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
    moduleAbiSha256: modules.abiHashes,
  });
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const flags = process.argv.slice(2);
  let manifest = loadCheckoutManifest(process.cwd());
  if (flags.length === 2 && flags[0] === '--evidence' && flags[1]) {
    const file = path.resolve(flags[1]);
    if (statSync(file).size > 256 * 1024) throw new Error('RELEASE_EVIDENCE_TOO_LARGE');
    manifest = qualifyRelease(manifest, path.dirname(file), JSON.parse(readFileSync(file, 'utf8')));
    publishRelease(manifest);
  } else if (flags.length)
    throw new Error('RELEASE_ARGUMENTS: use --evidence <bundle.json> or no arguments.');
  console.log(JSON.stringify({ ...manifest, subject: releaseSubject(manifest) }, null, 2));
}
