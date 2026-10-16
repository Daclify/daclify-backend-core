import { afterEach, expect, it, vi } from 'vitest';
import {
  isPublicAddress,
  probeReadiness,
  type ProbeDependencies,
} from '../services/api/src/mini-apps/probe.js';
import { miniBinding } from './helpers/mini-app-store.js';
import { MiniAppConnectionSchema, AppReadinessSchema } from '../protocol/mini-apps.js';
import { MiniAppArtifacts, miniAppReleaseId } from '../services/api/src/mini-apps/artifacts.js';
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildMiniAppStarter } from '../tools/release/mini-app-starter.js';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { VERSION } from '../protocol/base.js';
import { VERSION as MODULES_VERSION } from '@daclify/modules';
import { createServer as portServer } from 'node:net';
import { once } from 'node:events';
import { request as httpsRequest } from 'node:https';
afterEach(() => vi.useRealTimers());

it('rejects tampered manifest identifiers and changed artifact bytes before serving them', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mini-release-'));
  const bytes = Buffer.from('synthetic immutable artifact');
  const body = {
    version: 1 as const,
    coreVersion: '0.14.0-alpha.9',
    modulesVersion: '0.10.0-alpha.7',
    packageLockHash: 'cd'.repeat(32),
    files: ['core.tgz', 'modules.tgz', 'starter.tgz'].map((name) => ({
      name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })),
  };
  const manifest = { ...body, releaseId: '00'.repeat(32) };
  manifest.releaseId = miniAppReleaseId(manifest);
  try {
    for (const file of body.files) await writeFile(join(directory, file.name), bytes);
    await writeFile(
      join(directory, 'manifest.json'),
      JSON.stringify({ ...manifest, releaseId: 'ff'.repeat(32) }),
    );
    await expect(MiniAppArtifacts.load(directory)).rejects.toThrow('MINI_APP_ARTIFACT_INTEGRITY');
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
    await expect(MiniAppArtifacts.load(directory, [directory])).rejects.toThrow(
      'MINI_APP_ARTIFACT_INTEGRITY',
    );
    await expect(
      MiniAppArtifacts.load(
        directory,
        Array.from({ length: 9 }, () => directory),
      ),
    ).rejects.toThrow('MINI_APP_ARTIFACT_INTEGRITY');
    const artifacts = await MiniAppArtifacts.load(directory);
    await writeFile(join(directory, 'starter.tgz'), 'tampered');
    await expect(artifacts.openFile('starter.tgz')).rejects.toThrow('MINI_APP_ARTIFACT_INTEGRITY');
    await expect(MiniAppArtifacts.load(directory)).rejects.toThrow('MINI_APP_ARTIFACT_INTEGRITY');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('retains sixteen distinct mini-app cohorts and refuses an unbounded archive list', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mini-retained-'));
  const bytes = Buffer.from('immutable archive fixture');
  const manifests = [];
  const directories = [];
  try {
    for (let index = 0; index < 18; index++) {
      const path = join(directory, String(index));
      await mkdir(path);
      const manifest = {
        version: 1 as const,
        coreVersion: `0.15.0-alpha.${index}`,
        modulesVersion: '0.10.0-alpha.41',
        packageLockHash: 'cd'.repeat(32),
        releaseId: '00'.repeat(32),
        files: ['core.tgz', 'modules.tgz', 'starter.tgz'].map((name) => ({
          name,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        })),
      };
      manifest.releaseId = miniAppReleaseId(manifest);
      for (const file of manifest.files) await writeFile(join(path, file.name), bytes);
      await writeFile(join(path, 'manifest.json'), JSON.stringify(manifest));
      manifests.push(manifest);
      directories.push(path);
    }
    const active = directories[0];
    if (!active) throw new Error('FIXTURE_DIRECTORY');
    const retained = await MiniAppArtifacts.load(active, directories.slice(1, 17));
    for (const manifest of manifests.slice(0, 17)) {
      const release = retained.findRelease(manifest.releaseId);
      expect(release?.manifest).toEqual(manifest);
      if (!release) throw new Error('RETAINED_RELEASE_MISSING');
      const handle = await release.openFile('starter.tgz');
      try {
        expect(await handle.readFile()).toEqual(bytes);
      } finally {
        await handle.close();
      }
    }
    await expect(MiniAppArtifacts.load(active, directories.slice(1))).rejects.toThrow(
      'MINI_APP_ARTIFACT_INTEGRITY',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('builds a clean installable starter with exact vendored public dependency versions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mini-starter-build-'));
  try {
    const release = await buildMiniAppStarter({
      coreArchive: resolve('.artifacts/daclify-core-protocol-' + VERSION + '.tgz'),
      modulesArchive: resolve(
        '../daclify-backend-modules/.artifacts/daclify-modules-' + MODULES_VERSION + '.tgz',
      ),
      outputDirectory: join(directory, 'releases'),
    });
    const install = join(directory, 'install');
    await mkdir(install);
    await promisify(execFile)('tar', [
      '-xzf',
      join(release.directory, 'starter.tgz'),
      '-C',
      install,
    ]);
    await promisify(execFile)('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: install,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    const dependencies = await promisify(execFile)(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import { VERSION as core } from '@daclify/core-protocol'; import { VERSION as modules } from '@daclify/modules'; process.stdout.write(JSON.stringify({core,modules}));",
      ],
      { cwd: install, timeout: 15000 },
    );
    expect(JSON.parse(dependencies.stdout)).toEqual({ core: VERSION, modules: MODULES_VERSION });
    const bundle = {
      version: 1,
      binding: miniBinding,
      callbackUrl: 'https://app.example/callback',
      frontendOrigin: 'https://daclify.example',
      activityAccount: 'activity',
      releaseId: release.manifest.releaseId,
      coreVersion: VERSION,
      modulesVersion: MODULES_VERSION,
      manifestHash: release.manifestHash,
      starterUrl:
        'https://issuer.example/v1/mini-apps/releases/' +
        release.manifest.releaseId +
        '/files/starter.tgz',
      diagnostics: {
        version: 1,
        checks: [
          { stage: 'configuration', status: 'passed', codes: [] },
          { stage: 'readiness', status: 'not-run', codes: ['APP_CHECK_REQUIRED'] },
          { stage: 'identity', status: 'not-run', codes: ['APP_LOGIN_REQUIRED'] },
          { stage: 'event', status: 'not-run', codes: ['APP_NATIVE_EVENT_REQUIRED'] },
        ],
      },
    };
    await writeFile(join(install, 'connection.json'), JSON.stringify(bundle));
    await promisify(execFile)(process.execPath, ['configure.mjs', 'connection.json'], {
      cwd: install,
      timeout: 15000,
    });
    await promisify(execFile)('npm', ['run', 'build'], {
      cwd: install,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const key = join(directory, 'key.pem'),
      certificate = join(directory, 'certificate.pem');
    await promisify(execFile)(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost',
        '-keyout',
        key,
        '-out',
        certificate,
      ],
      { timeout: 15000, maxBuffer: 65536 },
    );
    const port = portServer();
    port.listen(0, '127.0.0.1');
    await once(port, 'listening');
    const address = port.address();
    if (!address || typeof address === 'string') throw new Error('FIXTURE_PORT');
    await new Promise<void>((resolve, reject) =>
      port.close((error) => (error ? reject(error) : resolve())),
    );
    const env = {
      ...process.env,
      NODE_ENV: 'development',
      DACLIFY_ISSUER: miniBinding.issuer,
      DACLIFY_FRONTEND_ORIGIN: bundle.frontendOrigin,
      DACLIFY_CLIENT_ID: miniBinding.clientId,
      DACLIFY_CHAIN_ID: miniBinding.chainId,
      DACLIFY_RUNTIME: miniBinding.runtime,
      DACLIFY_DAO_ID: miniBinding.daoId,
      DACLIFY_APP_ID: miniBinding.appId,
      DACLIFY_ACTIVITY_ACCOUNT: bundle.activityAccount,
      MINI_APP_ORIGIN: 'https://app.example',
      MINI_APP_DB: join(install, 'data/app.sqlite'),
      MINI_APP_CLEANUP_EXCLUSIONS_DIRECTORY: join(directory, 'separate-cleanup-exclusions'),
      MINI_APP_MAX_BACKUP_AGE_SECONDS: '86400',
      MINI_APP_TLS_KEY: key,
      MINI_APP_TLS_CERT: certificate,
      MINI_APP_PORT: String(address.port),
    };
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'examples/community-mini-app/server.ts'],
      { cwd: install, env, stdio: 'ignore' },
    );
    try {
      const ca = await readFile(certificate);
      let result: { status: number; bytes: Buffer } | undefined;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          result = await new Promise((resolve, reject) => {
            const pending = httpsRequest(
              'https://localhost:' + address.port + '/.well-known/daclify-mini-app.json',
              { ca },
              (response) => {
                const chunks: Buffer[] = [];
                response.on('data', (bytes: Buffer) => chunks.push(bytes));
                response.on('error', reject);
                response.on('end', () =>
                  resolve({ status: response.statusCode ?? 0, bytes: Buffer.concat(chunks) }),
                );
              },
            );
            pending.on('error', reject);
            pending.end();
          });
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      expect(result?.status, result?.bytes.toString('utf8')).toBe(200);
      if (!result) throw new Error('FIXTURE_READINESS');
      expect(AppReadinessSchema.parse(JSON.parse(result.bytes.toString('utf8'))).binding).toEqual(
        miniBinding,
      );
    } finally {
      if (child.exitCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGTERM');
        await exited;
      }
    }
    const ephemeral = await promisify(execFile)(
      process.execPath,
      ['--import', 'tsx', 'examples/community-mini-app/server.ts'],
      {
        cwd: install,
        env: { ...env, NODE_ENV: 'production', MINI_APP_PERSISTENT_VOLUME: '0' },
        timeout: 3000,
        maxBuffer: 65536,
      },
    ).then(
      () => {
        throw new Error('FIXTURE_EXPECTED_STORAGE_REFUSAL');
      },
      (error) => {
        if (typeof error !== 'object' || error === null || !('stderr' in error)) throw error;
        return String(error.stderr);
      },
    );
    expect(ephemeral).toContain('APP_STORAGE_PERSISTENCE');
    expect((await MiniAppArtifacts.load(release.directory)).manifest.packageLockHash).toBe(
      release.manifest.packageLockHash,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 90000);

it('refuses local, private, reserved, mapped and malformed addresses in both families', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '172.31.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '192.0.2.1',
    '198.18.0.1',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
    '2002:7f00:1::',
    'not-an-ip',
  ])
    expect(isPublicAddress(address), address).toBe(false);
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])
    expect(isPublicAddress(address), address).toBe(true);
});
const url = new URL('https://app.example/.well-known/daclify-mini-app.json');
const good = new TextEncoder().encode(JSON.stringify({ version: 1, binding: miniBinding }));
it('pins one validated DNS result and rejects a mixed private resolution before transport', async () => {
  let lookups = 0;
  const addresses: string[] = [];
  const deps: ProbeDependencies = {
    lookup: async () =>
      ++lookups === 1 ? [{ address: '1.1.1.1', family: 4 }] : [{ address: '127.0.0.1', family: 4 }],
    request: async (_url, address) => {
      addresses.push(address.address);
      return { status: 200, bytes: good };
    },
  };
  expect((await probeReadiness(url, miniBinding, deps)).status).toBe('passed');
  expect(lookups).toBe(1);
  expect(addresses).toEqual(['1.1.1.1']);
  const unsafe: ProbeDependencies = {
    ...deps,
    lookup: async () => [
      { address: '1.1.1.1', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ],
    request: async () => {
      throw new Error('FIXTURE_TRANSPORT_MUST_NOT_RUN');
    },
  };
  expect((await probeReadiness(url, miniBinding, unsafe)).codes).toEqual(['APP_ENDPOINT_ADDRESS']);
});
it('refuses redirects, wrong app bindings and oversized success or error responses', async () => {
  for (const response of [
    { status: 302, bytes: good },
    {
      status: 200,
      bytes: new TextEncoder().encode(
        JSON.stringify({ version: 1, binding: { ...miniBinding, daoId: '2' } }),
      ),
    },
    { status: 200, bytes: new Uint8Array(65537) },
    { status: 500, bytes: new Uint8Array(65537) },
  ]) {
    const deps: ProbeDependencies = {
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      request: async () => response,
    };
    expect((await probeReadiness(url, miniBinding, deps)).status).toBe('failed');
  }
});
it('bounds DNS and response waiting to five seconds and aborts pending transport', async () => {
  vi.useFakeTimers();
  let aborted = false;
  const deps: ProbeDependencies = {
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    request: async (_url, _address, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            aborted = true;
            reject(new Error('fixture aborted'));
          },
          { once: true },
        );
      }),
  };
  const pending = probeReadiness(url, miniBinding, deps);
  await vi.advanceTimersByTimeAsync(5000);
  expect((await pending).codes).toEqual(['APP_ENDPOINT_TIMEOUT']);
  expect(aborted).toBe(true);
  const stalled = probeReadiness(url, miniBinding, {
    ...deps,
    lookup: async () => new Promise(() => {}),
  });
  await vi.advanceTimersByTimeAsync(5000);
  expect((await stalled).codes).toEqual(['APP_ENDPOINT_TIMEOUT']);
});
it('rejects unsafe URL credentials, ports, schemes and paths before network access', async () => {
  const deps: ProbeDependencies = {
    lookup: async () => {
      throw new Error('FIXTURE_DNS_MUST_NOT_RUN');
    },
    request: async () => {
      throw new Error('FIXTURE_TRANSPORT_MUST_NOT_RUN');
    },
  };
  for (const value of [
    'http://app.example/.well-known/daclify-mini-app.json',
    'https://user:secret@app.example/.well-known/daclify-mini-app.json',
    'https://app.example:8080/.well-known/daclify-mini-app.json',
    'https://app.example/admin',
    'https://app.example/.well-known/daclify-mini-app.json?token=secret',
  ])
    expect((await probeReadiness(new URL(value), miniBinding, deps)).codes).toEqual([
      'APP_ENDPOINT_URL',
    ]);
});
it('keeps configuration, readiness, verified identity and confirmed events as separate facts', () => {
  expect(
    MiniAppConnectionSchema.safeParse({
      version: 1,
      binding: miniBinding,
      callbackUrl: 'https://app.example/callback',
      frontendOrigin: 'https://daclify.example',
      activityAccount: 'activity',
      releaseId: 'ab'.repeat(32),
      coreVersion: '0.14.0-alpha.9',
      modulesVersion: '0.10.0-alpha.7',
      manifestHash: 'cd'.repeat(32),
      starterUrl:
        'https://issuer.example/v1/mini-apps/releases/' + 'ab'.repeat(32) + '/files/starter.tgz',
      diagnostics: {
        version: 1,
        checks: [
          { stage: 'configuration', status: 'passed', codes: [] },
          { stage: 'readiness', status: 'not-run', codes: ['APP_CHECK_REQUIRED'] },
          { stage: 'identity', status: 'not-run', codes: ['APP_LOGIN_REQUIRED'] },
          { stage: 'event', status: 'not-run', codes: ['APP_NATIVE_EVENT_REQUIRED'] },
        ],
      },
    }).success,
  ).toBe(true);
});
