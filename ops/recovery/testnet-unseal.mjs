// Explicit single-host testnet convenience. Never use these retained shares on mainnet.
import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = '/data/daclify-runtime/recovery-testnet';
assert.equal(process.env.NETWORK_ENVIRONMENT, 'testnet');
assert.equal(
  process.env.CHAIN_ID,
  '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
);
const file = root + '/operator/initialization.json';
let metadata;
try {
  metadata = await stat(file);
} catch (error) {
  if (error.code === 'ENOENT') process.exit(0); // First start precedes initialization.
  throw new Error('TESTNET_UNSEAL_UNAVAILABLE');
}
assert.ok(metadata.isFile() && (metadata.mode & 0o077) === 0 && metadata.size < 65536);
const init = JSON.parse(await readFile(file, 'utf8'));
assert.ok(Array.isArray(init.keys_base64) && init.keys_base64.length === 5);
const address = 'https://127.0.0.1:18200';
let ready = false;
for (let attempt = 0; attempt < 80; attempt++) {
  try {
    const health = await fetch(address + '/v1/sys/health', { signal: AbortSignal.timeout(1000) });
    if (health.status === 200) process.exit(0);
    if (health.status === 503) {
      ready = true;
      break;
    }
  } catch {
    /* Wait for the local listener during service startup. */
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!ready) throw new Error('TESTNET_UNSEAL_UNAVAILABLE');
for (const key of init.keys_base64.slice(0, 3)) {
  assert.equal(typeof key, 'string');
  const response = await fetch(address + '/v1/sys/unseal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('TESTNET_UNSEAL_UNAVAILABLE');
}
for (let attempt = 0; attempt < 80; attempt++) {
  if (
    (await fetch(address + '/v1/sys/health', { signal: AbortSignal.timeout(1000) })).status === 200
  )
    process.exit(0);
  await new Promise((resolve) => setTimeout(resolve, 100));
}
throw new Error('TESTNET_UNSEAL_UNAVAILABLE');
