// Disposable loopback characterization, never production qualification.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, readFile, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { OpenBaoCustody } from '../../services/custody/openbao.js';
const binary = z.string().startsWith('/').parse(process.argv[2]);
const directory = await mkdtemp(join(tmpdir(), 'daclify-openbao-lab-'));
const processes: ChildProcess[] = [];
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Loopback port unavailable');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
async function start(name: string, retainedPort?: number) {
  const path = join(directory, name);
  await mkdir(path, { mode: 0o700 });
  await mkdir(join(path, 'data'), { mode: 0o700 });
  const port = retainedPort ?? (await freePort()),
    address = `http://127.0.0.1:${port}`;
  const config = join(path, 'config.hcl');
  await writeFile(
    config,
    `disable_mlock = true\napi_addr = "${address}"\ncluster_addr = "http://127.0.0.1:${port + 1}"\nstorage "raft" { path = "${path}/data" node_id = "recovery-lab" }\nlistener "tcp" { address = "127.0.0.1:${port}" cluster_address = "127.0.0.1:${port + 1}" tls_disable = true }\naudit "file" "recovery" { options { file_path = "${directory}/audit.jsonl" log_raw = "false" } }\n`,
    { mode: 0o600 },
  );
  const log = await open(join(path, 'server.log'), 'wx', 0o600),
    child = spawn(binary, ['server', '-config=' + config], { stdio: ['ignore', log.fd, log.fd] });
  processes.push(child);
  await log.close();
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error('Disposable key service failed to start');
    try {
      if (
        [501, 503].includes(
          (await fetch(address + '/v1/sys/health', { signal: AbortSignal.timeout(1000) })).status,
        )
      )
        return { address, path, child };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Disposable key-service startup timed out');
}
async function request(address: string, path: string, token?: string, data?: unknown) {
  const response = await fetch(address + '/v1/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { 'X-Vault-Token': token } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`OPENBAO_LAB_REQUEST_FAILED: ${path} (${response.status})`);
  return response.status === 204 ? undefined : await response.json();
}
const InitSchema = z.object({ root_token: z.string(), keys_base64: z.array(z.string()).length(1) });
async function init(address: string) {
  const initialized = InitSchema.parse(
    await request(address, 'sys/init', undefined, { secret_shares: 1, secret_threshold: 1 }),
  );
  await request(address, 'sys/unseal', undefined, { key: initialized.keys_base64[0] });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (
      (await fetch(address + '/v1/sys/health', { signal: AbortSignal.timeout(1000) })).status ===
      200
    )
      return initialized;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Disposable unseal readiness timed out');
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => child.once('exit', () => resolve()));
}
try {
  const source = await start('source'),
    secrets = await init(source.address),
    root = secrets.root_token;
  await request(source.address, 'sys/mounts/transit', root, { type: 'transit' });
  await request(source.address, 'transit/keys/content-recovery-v1', root, {
    type: 'aes256-gcm96',
    exportable: false,
    allow_plaintext_backup: false,
  });
  const policy = await readFile('ops/recovery/api-policy.hcl', 'utf8');
  await request(source.address, 'sys/policies/acl/daclify-recovery', root, { policy });
  const issued = z
    .object({ auth: z.object({ client_token: z.string() }) })
    .parse(
      await request(source.address, 'auth/token/create', root, {
        policies: ['daclify-recovery'],
        no_default_policy: true,
        ttl: '1h',
      }),
    );
  const token = issued.auth.client_token,
    provider = new OpenBaoCustody(source.address, token),
    plaintext = crypto.getRandomValues(new Uint8Array(32));
  const wrapped = await provider.wrapExisting('recovery-v1', plaintext);
  assert.deepEqual(await provider.unwrap('recovery-v1', wrapped), plaintext);
  for (const path of [
    'transit/keys/content-recovery-v1',
    'transit/export/encryption-key/content-recovery-v1',
  ]) {
    const response = await fetch(source.address + '/v1/' + path, {
      headers: { 'X-Vault-Token': token },
    });
    assert.equal(response.status, 403);
  }
  await assert.rejects(provider.wrap('forbidden-key', plaintext));
  const audit = await readFile(join(directory, 'audit.jsonl'), 'utf8');
  assert.ok(!audit.includes(Buffer.from(plaintext).toString('base64')));
  const snapshotResponse = await fetch(source.address + '/v1/sys/storage/raft/snapshot', {
    headers: { 'X-Vault-Token': root },
  });
  assert.equal(snapshotResponse.status, 200);
  const snapshot = await snapshotResponse.arrayBuffer();
  await writeFile(join(directory, 'retained.snapshot'), new Uint8Array(snapshot), { mode: 0o600 });
  await stop(source.child);
  await rm(source.path, { recursive: true, force: true });
  await rm(join(directory, 'audit.jsonl'));
  const restored = await start('restored', Number(new URL(source.address).port)),
    temporary = await init(restored.address);
  const response = await fetch(restored.address + '/v1/sys/storage/raft/snapshot-force', {
    method: 'POST',
    headers: { 'X-Vault-Token': temporary.root_token, 'content-type': 'application/octet-stream' },
    body: snapshot,
    signal: AbortSignal.timeout(10000),
  });
  assert.ok(response.ok);
  for (let attempt = 0; attempt < 120; attempt++) {
    await request(restored.address, 'sys/unseal', undefined, { key: secrets.keys_base64[0] }).catch(
      () => {},
    );
    const health = await fetch(restored.address + '/v1/sys/health', {
      signal: AbortSignal.timeout(1000),
    });
    if (health.status === 200) break;
    if (attempt === 119) throw new Error('Restored key service is unavailable');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.deepEqual(
    await new OpenBaoCustody(restored.address, token).unwrap('recovery-v1', wrapped),
    plaintext,
  );
  plaintext.fill(0);
  const report = {
    version: 1,
    status: 'passed',
    kind: 'isolated-openbao-restore',
    providerVersion: '2.7.1',
    storage: 'raft',
    assertions: 8,
    independentHost: false,
    sourceRemoved: true,
    checkedAt: new Date().toISOString(),
  };
  await writeFile(
    resolve('.superpowers/sdd/2026-10-10-passwordless-devices-and-vault-recovery/openbao-lab.json'),
    JSON.stringify(report, null, 2) + '\n',
    { mode: 0o600 },
  );
  console.log(
    'Real OpenBao encryption, restricted policy, audit redaction and destroyed-source snapshot restore passed. This is a local lab.',
  );
} finally {
  await Promise.all(processes.map(stop));
  await rm(directory, { recursive: true, force: true });
}
