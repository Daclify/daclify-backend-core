import { FixtureContainerSchema } from './network.js';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
const SupportedSchema = z.array(
  z.object({
    feature_digest: z.string().regex(/^[0-9a-f]{64}$/),
    dependencies: z.array(z.string().regex(/^[0-9a-f]{64}$/)),
    specification: z.array(z.object({ name: z.string(), value: z.string() })),
  }),
);
const ActivatedSchema = z.object({
  activated_protocol_features: z.array(z.object({ feature_digest: z.string() })),
});
async function rpc(url: string, path: string, body: object): Promise<unknown> {
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Local protocol feature RPC failed');
  return response.json();
}
export async function activateFixtureFeatures(
  container: string,
  endpoint = 'http://127.0.0.1:18888',
  extraFeatures: readonly (
    'BLOCKCHAIN_PARAMETERS' | 'CONFIGURABLE_WASM_LIMITS2' | 'SAVANNA'
  )[] = [],
): Promise<void> {
  FixtureContainerSchema.parse(container);
  const url = z
    .string()
    .regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/)
    .parse(endpoint);
  const supported = SupportedSchema.parse(
    await rpc(url, '/v1/producer/get_supported_protocol_features', {}),
  );
  const features = new Map(
    supported.flatMap((f) =>
      f.specification
        .filter((s) => s.name === 'builtin_feature_codename')
        .map((s) => [s.value, f.feature_digest] as const),
    ),
  );
  async function activated(digest: string) {
    return ActivatedSchema.parse(
      await rpc(url, '/v1/chain/get_activated_protocol_features', { limit: 100 }),
    ).activated_protocol_features.some((f) => f.feature_digest === digest);
  }
  async function wait(digest: string) {
    for (let i = 0; i < 60; i++) {
      if (await activated(digest)) return;
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error('Local protocol activation timed out');
  }
  const preactivate = features.get('PREACTIVATE_FEATURE');
  const sender = features.get('GET_SENDER');
  const codeHash = features.get('GET_CODE_HASH');
  const crypto = features.get('CRYPTO_PRIMITIVES');
  if (!preactivate || !sender || !codeHash || !crypto)
    throw new Error('Required native protocol features unavailable');
  if (!(await activated(preactivate))) {
    await rpc(url, '/v1/producer/schedule_protocol_feature_activations', {
      protocol_features_to_activate: [preactivate],
    });
    await wait(preactivate);
  }
  const pending: string[] = [];
  if (!(await activated(sender))) pending.push(sender);
  if (!(await activated(codeHash))) pending.push(codeHash);
  if (!(await activated(crypto))) pending.push(crypto);
  const required = new Map(supported.map((feature) => [feature.feature_digest, feature]));
  const visiting = new Set<string>();
  async function queue(digest: string): Promise<void> {
    if (pending.includes(digest) || (await activated(digest))) return;
    if (visiting.has(digest)) throw new Error('System protocol feature dependency cycle');
    const feature = required.get(digest);
    if (!feature) throw new Error('System protocol feature dependency unavailable');
    visiting.add(digest);
    for (const dependency of feature.dependencies) await queue(dependency);
    visiting.delete(digest);
    pending.push(digest);
  }
  for (const feature of extraFeatures) {
    const digest = features.get(feature);
    if (!digest) throw new Error('Required system protocol feature unavailable');
    await queue(digest);
  }
  if (pending.length === 0) return;
  function cleos(args: string[]) {
    try {
      execFileSync(
        'docker',
        ['exec', container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
    } catch {
      throw new Error('Local bootstrap action failed');
    }
  }
  // The boot contract is already on eosio once GET_SENDER has been activated.
  if (pending.includes(sender)) {
    cleos([
      'set',
      'contract',
      'eosio',
      '/work/.artifacts/contracts',
      'boot.wasm',
      'boot.abi',
      '-p',
      'eosio@active',
    ]);
  }
  for (const digest of pending) {
    cleos(['push', 'action', 'eosio', 'activate', JSON.stringify([digest]), '-p', 'eosio@active']);
    await wait(digest);
  }
}
