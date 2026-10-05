import { execFileSync } from 'node:child_process';
import { z } from 'zod';
const url = 'http://127.0.0.1:18888';
const SupportedSchema = z.array(
  z.object({
    feature_digest: z.string().regex(/^[0-9a-f]{64}$/),
    specification: z.array(z.object({ name: z.string(), value: z.string() })),
  }),
);
const ActivatedSchema = z.object({
  activated_protocol_features: z.array(z.object({ feature_digest: z.string() })),
});
async function rpc(path: string, body: object): Promise<unknown> {
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Local protocol feature RPC failed');
  return response.json();
}
export async function activateFixtureFeatures(container: string): Promise<void> {
  z.literal('daclify-v2-native').parse(container);
  const supported = SupportedSchema.parse(
    await rpc('/v1/producer/get_supported_protocol_features', {}),
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
      await rpc('/v1/chain/get_activated_protocol_features', { limit: 100 }),
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
  if (!preactivate || !sender || !codeHash)
    throw new Error('Required native protocol features unavailable');
  if (!(await activated(preactivate))) {
    await rpc('/v1/producer/schedule_protocol_feature_activations', {
      protocol_features_to_activate: [preactivate],
    });
    await wait(preactivate);
  }
  const pending = [];
  if (!(await activated(sender))) pending.push(sender);
  if (!(await activated(codeHash))) pending.push(codeHash);
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
