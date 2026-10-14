// Disposable loopback qualification only; these keys never leave the local fixture.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  ABI,
  Action,
  APIClient,
  APIError,
  CompressionType,
  PackedTransaction,
  PrivateKey,
  Serializer,
  SignedTransaction,
  Transaction,
} from '@wharfkit/antelope';
import { SYSTEM_ABI } from '../../sdk/system-abi.js';
export const localFixtureRoot = '.artifacts/module-completion-native';
type NativePushResult = Awaited<ReturnType<APIClient['v1']['chain']['push_transaction']>>;
const keySchema = z.record(z.string(), z.object({ privateKey: z.string(), publicKey: z.string() }));
export function localFixture() {
  const network = z
    .strictObject({
      url: z.literal('http://127.0.0.1:21388'),
      chainId: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .parse(JSON.parse(readFileSync(`${localFixtureRoot}/network.json`, 'utf8')));
  const keys = keySchema.parse(JSON.parse(readFileSync(`${localFixtureRoot}/keys.json`, 'utf8'))),
    rpc = new APIClient({ url: network.url });
  let sequence = 0;
  function key(actor: string) {
    const record = keys[actor];
    if (!record) throw Error('LOCAL_FIXTURE_KEY');
    const value = PrivateKey.from(record.privateKey);
    if (value.toPublic().toString() !== record.publicKey) throw Error('LOCAL_FIXTURE_KEY');
    return value;
  }
  async function push(actions: Action[]): Promise<NativePushResult> {
    const info = await rpc.v1.chain.get_info();
    if (info.chain_id.toString() !== network.chainId) throw Error('LOCAL_FIXTURE_DOMAIN');
    const tx = Transaction.from({ ...info.getTransactionHeader(120 + (sequence++ % 60)), actions });
    const signers = new Set(
      actions.flatMap((action) => action.authorization.map((auth) => auth.actor.toString())),
    );
    try {
      return await rpc.v1.chain.push_transaction(
        PackedTransaction.fromSigned(
          SignedTransaction.from({
            ...tx,
            signatures: [...signers].map((actor) =>
              key(actor).signDigest(tx.signingDigest(info.chain_id)),
            ),
          }),
          CompressionType.zlib,
        ),
      );
    } catch (cause) {
      const result = z
        .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
        .safeParse(cause instanceof APIError ? cause.response.json : undefined);
      const message = result.success
        ? result.data.error.details.map((row) => row.message).join('\n')
        : 'Local fixture request rejected';
      throw Error(
        actions.map((action) => `${action.account}::${action.name}`).join(',') + ': ' + message,
      );
    }
  }
  function action(
    account: string,
    name: string,
    data: Uint8Array,
    actor = account,
    permission = 'active',
  ) {
    return Action.from({ account, name, data, authorization: [{ actor, permission }] });
  }
  function system(name: string, data: object, actor: string) {
    return action(
      'eosio',
      name,
      Serializer.encode({ abi: ABI.from(SYSTEM_ABI), type: name, object: data }).array,
      actor,
    );
  }
  async function deploy(account: string, path: string) {
    await push([
      system(
        'setcode',
        { account, vmtype: 0, vmversion: 0, code: readFileSync(path + '.wasm') },
        account,
      ),
    ]);
    await push([
      system(
        'setabi',
        {
          account,
          abi: Serializer.encode({ object: ABI.from(readFileSync(path + '.abi', 'utf8')) }).array,
        },
        account,
      ),
    ]);
  }
  return { network, rpc, key, push, action, system, deploy };
}
