import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'daclify-recovery-backup-test-'));
try {
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072 });
  const source = join(directory, 'source'),
    sealed = join(directory, 'sealed'),
    opened = join(directory, 'opened');
  const pub = join(directory, 'recipient.pem'),
    priv = join(directory, 'offline-private.pem'),
    bytes = randomBytes(300000);
  await writeFile(pub, keys.publicKey.export({ format: 'pem', type: 'spki' }), { mode: 0o600 });
  await writeFile(priv, keys.privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  await writeFile(source, bytes, { mode: 0o600 });
  const run = (...args) =>
    spawnSync(process.execPath, ['ops/recovery/backup.mjs', ...args], { encoding: 'utf8' });
  assert.equal(
    run('encrypt', 'database', source, sealed, pub).status,
    0,
    'Encrypted snapshot command must succeed',
  );
  assert.equal(
    run('decrypt', 'database', sealed, opened, priv).status,
    0,
    'Offline decryption must succeed',
  );
  assert.deepEqual(await readFile(opened), bytes);
  assert.notEqual(
    run('encrypt', 'database', source, sealed, pub).status,
    0,
    'Existing backups must never be overwritten',
  );
  const cipher = await readFile(sealed);
  cipher[cipher.length - 1] ^= 1;
  await writeFile(sealed, cipher);
  const rejected = join(directory, 'rejected');
  assert.notEqual(
    run('decrypt', 'database', sealed, rejected, priv).status,
    0,
    'Tampered snapshots must fail',
  );
  await assert.rejects(access(rejected), 'Unauthenticated plaintext must be removed');
  console.log(
    'Backup round trip, tamper rejection and overwrite protection passed (5 assertions).',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
