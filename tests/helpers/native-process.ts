import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import {
  ABI,
  Action,
  APIClient,
  APIError,
  PrivateKey,
  Serializer,
  SignedTransaction,
  Transaction,
  type Authority,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { SYSTEM_ABI } from '../../sdk/system-abi.js';

const SupportedSchema = z.array(
  z.object({
    feature_digest: z.string(),
    dependencies: z.array(z.string()),
    specification: z.array(z.object({ name: z.string(), value: z.string() })),
  }),
);
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 100));
export type NativePushResult = Awaited<ReturnType<APIClient['v1']['chain']['push_transaction']>>;

// Each caller owns a fresh process, genesis, localhost port and disposable signers.
export async function nativeProcess() {
  const binary = process.env.DACLIFY_NATIVE_NODEOS ?? 'nodeos';
  const libs = process.env.DACLIFY_NATIVE_LIBS ?? '';
  const environment = { PATH: process.env.PATH ?? '/usr/bin', LD_LIBRARY_PATH: libs };
  const version = execFileSync(binary, ['--version'], {
    env: environment,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  if (version !== 'v1.2.2') throw new Error('PINNED_NATIVE_RUNTIME_REQUIRED');
  const directory = mkdtempSync(join(tmpdir(), 'daclify-authority-fixture-'));
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('FIXTURE_LOCAL_PORT');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  const rootKey = PrivateKey.generate('K1');
  writeFileSync(
    join(directory, 'genesis.json'),
    JSON.stringify({
      initial_timestamp: new Date().toISOString().replace(/Z$/, ''),
      initial_key: rootKey.toPublic().toString(),
    }),
    { mode: 0o600 },
  );
  writeFileSync(
    join(directory, 'config.ini'),
    [
      'producer-name = eosio',
      `signature-provider = ${rootKey.toPublic()}=KEY:${rootKey}`,
      'enable-stale-production = true',
    ].join('\n'),
    { mode: 0o600 },
  );
  const log = openSync(join(directory, 'node.log'), 'w', 0o600);
  const child = spawn(
    binary,
    [
      '--data-dir',
      join(directory, 'data'),
      '--config-dir',
      directory,
      '--genesis-json',
      join(directory, 'genesis.json'),
      '--http-server-address',
      `127.0.0.1:${port}`,
      '--p2p-listen-endpoint',
      '127.0.0.1:0',
      '--plugin',
      'eosio::chain_api_plugin',
      '--plugin',
      'eosio::producer_plugin',
      '--plugin',
      'eosio::producer_api_plugin',
      '--wasm-runtime',
      'eos-vm',
      '--chain-state-db-size-mb',
      '256',
      '--chain-state-db-guard-size-mb',
      '8',
      '--max-body-size',
      '8388608',
    ],
    { env: environment, stdio: ['ignore', log, log] },
  );
  closeSync(log);
  let spawnError = false;
  child.on('error', () => {
    spawnError = true;
  });
  const url = `http://127.0.0.1:${port}`;
  const api = new APIClient({
    url,
    fetch: (input, options) =>
      fetch(input, { ...options, signal: AbortSignal.timeout(10000), redirect: 'error' }),
  });
  async function stop() {
    if (child.exitCode === null && child.signalCode === null && !spawnError) {
      const ended = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      try {
        await ended;
      } finally {
        clearTimeout(timer);
      }
    }
    await rm(directory, { recursive: true, force: true });
  }
  try {
    let ready = false;
    for (let count = 0; count < 150; count++) {
      if (spawnError || child.exitCode !== null) throw new Error('NATIVE_PROCESS_START_FAILED');
      try {
        const info = await api.v1.chain.get_info();
        if (info.head_block_num.toNumber() > 1) {
          ready = true;
          break;
        }
      } catch {
        /* The owned process has not opened its port yet. */
      }
      await pause();
    }
    if (!ready) throw new Error('NATIVE_PROCESS_NOT_READY');
    const info = await api.v1.chain.get_info();
    const chainId = info.chain_id;
    const keys = new Map<string, PrivateKey>([['eosio', rootKey]]);
    let sequence = 0;
    async function push(actions: Action[], signers: PrivateKey[]): Promise<NativePushResult> {
      if (child.exitCode !== null || spawnError) throw new Error('OWNED_NATIVE_PROCESS_REQUIRED');
      const head = await api.v1.chain.get_info();
      if (!head.chain_id.equals(chainId)) throw new Error('FIXTURE_CHAIN_MISMATCH');
      const transaction = Transaction.from({
        ...head.getTransactionHeader(120 + (sequence++ % 60)),
        actions,
      });
      try {
        return await api.v1.chain.push_transaction(
          SignedTransaction.from({
            ...transaction,
            signatures: signers.map((key) => key.signDigest(transaction.signingDigest(chainId))),
          }),
        );
      } catch (cause) {
        if (cause instanceof APIError) {
          const code = cause.details
            .map((detail) => detail.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1])
            .find(Boolean);
          if (code) throw new Error(code);
          const selfAuthorization =
            cause.name === 'subjective_block_production_exception' &&
            cause.details.some(
              (detail) =>
                detail.message === 'Authorization failure with inline action sent to self',
            );
          const authorization =
            selfAuthorization ||
            [
              'unsatisfied_authorization',
              'irrelevant_auth_exception',
              'missing_auth_exception',
            ].includes(cause.name);
          throw new Error(
            (authorization ? 'NATIVE_AUTH_REJECTED:' : 'NATIVE_REJECTED:') + cause.name,
          );
        }
        throw new Error('NATIVE_TRANSACTION_REJECTED');
      }
    }
    function key(account: string) {
      const signer = keys.get(account);
      if (!signer) throw new Error('DISPOSABLE_SIGNER_REQUIRED');
      return signer;
    }
    function action(
      account: string,
      name: string,
      object: object,
      authorization: readonly { actor: string; permission: string }[],
      abi: ABI,
    ) {
      return Action.from({
        account,
        name,
        authorization: [...authorization],
        data: Serializer.encode({ abi, type: name, object }),
      });
    }
    function system(name: string, data: object, account = 'eosio', permission = 'active') {
      return action('eosio', name, data, [{ actor: account, permission }], ABI.from(SYSTEM_ABI));
    }
    async function create(account: string) {
      if (keys.has(account)) throw new Error('FIXTURE_ACCOUNT_EXISTS');
      const signer = PrivateKey.generate('K1');
      const authority = {
        threshold: 1,
        keys: [{ key: signer.toPublic(), weight: 1 }],
        accounts: [],
        waits: [],
      };
      await push(
        [
          system('newaccount', {
            creator: 'eosio',
            name: account,
            owner: authority,
            active: authority,
          }),
        ],
        [rootKey],
      );
      keys.set(account, signer);
    }
    async function deploy(account: string, path: string) {
      const abi = ABI.from(readFileSync(path + '.abi', 'utf8'));
      await push(
        [
          system(
            'setcode',
            { account, vmtype: 0, vmversion: 0, code: readFileSync(path + '.wasm') },
            account,
          ),
          system('setabi', { account, abi: Serializer.encode({ object: abi }) }, account),
        ],
        [key(account)],
      );
      return abi;
    }
    async function update(
      account: string,
      permission: string,
      parent: string,
      auth: Authority,
      signer = key(account),
      authorization = 'owner',
    ) {
      await push(
        [system('updateauth', { account, permission, parent, auth }, account, authorization)],
        [signer],
      );
    }
    async function producer(name: string, object: object): Promise<unknown> {
      const response = await fetch(url + '/v1/producer/' + name, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(object),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('FIXTURE_FEATURE_RPC');
      return response.json();
    }
    const supported = SupportedSchema.parse(await producer('get_supported_protocol_features', {}));
    const features = new Map(
      supported.flatMap((feature) =>
        feature.specification
          .filter((spec) => spec.name === 'builtin_feature_codename')
          .map((spec) => [spec.value, feature] as const),
      ),
    );
    async function activated(digest: string) {
      const result = await api.v1.chain.get_activated_protocol_features({ limit: 100 });
      return result.activated_protocol_features.some(
        (feature) => feature.feature_digest.toString() === digest,
      );
    }
    async function wait(digest: string) {
      for (let count = 0; count < 100; count++) {
        if (await activated(digest)) return;
        await pause();
      }
      throw new Error('FIXTURE_FEATURE_TIMEOUT');
    }
    const preactivate = features.get('PREACTIVATE_FEATURE');
    if (!preactivate) throw new Error('FIXTURE_PREACTIVATE_REQUIRED');
    await producer('schedule_protocol_feature_activations', {
      protocol_features_to_activate: [preactivate.feature_digest],
    });
    await wait(preactivate.feature_digest);
    const boot = await deploy('eosio', '.artifacts/contracts/boot');
    const byDigest = new Map(supported.map((feature) => [feature.feature_digest, feature]));
    async function activate(digest: string) {
      if (await activated(digest)) return;
      const feature = byDigest.get(digest);
      if (!feature) throw new Error('FIXTURE_FEATURE_REQUIRED');
      for (const dependency of feature.dependencies) await activate(dependency);
      await push(
        [
          action(
            'eosio',
            'activate',
            { feature_digest: digest },
            [{ actor: 'eosio', permission: 'active' }],
            boot,
          ),
        ],
        [rootKey],
      );
      await wait(digest);
    }
    for (const name of [
      'GET_SENDER',
      'GET_CODE_HASH',
      'CRYPTO_PRIMITIVES',
      'CONFIGURABLE_WASM_LIMITS2',
      'RAM_RESTRICTIONS',
      'RESTRICT_ACTION_TO_SELF',
    ]) {
      const feature = features.get(name);
      if (!feature) throw new Error('FIXTURE_FEATURE_REQUIRED');
      await activate(feature.feature_digest);
    }
    return {
      api,
      url,
      chainId: chainId.toString(),
      key,
      create,
      deploy,
      action,
      system,
      update,
      push,
      stop,
      featureDigests: new Map(
        [...features].map(([name, feature]) => [name, feature.feature_digest]),
      ),
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

export type NativeProcess = Awaited<ReturnType<typeof nativeProcess>>;
