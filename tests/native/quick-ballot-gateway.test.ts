import { afterAll, expect, it } from 'vitest';
import { ABI, Checksum256, Serializer, Transaction } from '@wharfkit/antelope';
import { nativeProcess, type NativeProcess } from '../helpers/native-process.js';
import { NativeQuickBallots } from '../../services/api/src/quick-ballots/chain.js';
import {
  quickAuthAbi,
  encodeQuickAnchor,
  quickAccountDigest,
  quickAccountIdentity,
  quickAccountRequest,
  quickAccountAction,
} from '../../sdk/quick-accounts.js';
import { QuickAccountAnchorSchema } from '../../protocol/quick-accounts.js';

let f: NativeProcess | undefined;
afterAll(async () => {
  await f?.stop();
});
it('qualifies exact native pins and looks up a canonical account through its actual identity index', async () => {
  const owned = (f = await nativeProcess()),
    runtime = 'daclifycore1',
    authority = 'quickauth',
    source = 'quickvote';
  const bls = owned.featureDigests.get('BLS_PRIMITIVES2');
  if (!bls) throw Error('BLS_REQUIRED');
  await owned.activate(bls);
  for (const name of [runtime, authority, source, 'gateway', 'alice']) await owned.create(name);
  const core = await owned.deploy(runtime, '.artifacts/contracts/runtime');
  const auth = await owned.deploy(authority, '.artifacts/contracts/quickauth');
  const vote = await owned.deploy(
    source,
    '../daclify-backend-modules/.artifacts/contracts/quickvote',
  );
  const sourceHash = (await owned.api.v1.chain.get_raw_abi(source)).code_hash.toString();
  const push = (account: string, name: string, data: object, actors: string[], abi: ABI) =>
    owned.push(
      [
        owned.action(
          account,
          name,
          data,
          actors.map((actor) => ({ actor, permission: 'active' })),
          abi,
        ),
      ],
      actors.map((actor) => owned.key(actor)),
    );
  await push(runtime, 'init', { chain_id: owned.chainId }, [runtime], core);
  await push(
    authority,
    'qconfig',
    {
      runtime,
      source,
      code_hash: sourceHash,
      gateway: { actor: 'gateway', permission: 'active' },
      maximum: 5000,
    },
    [runtime, authority],
    auth,
  );
  await push(
    source,
    'init',
    {
      runtime,
      authority,
      authority_hash: (await owned.api.v1.chain.get_raw_abi(authority)).code_hash.toString(),
    },
    [runtime, source],
    vote,
  );
  const anchor = QuickAccountAnchorSchema.parse({
    kind: 'key',
    publicKey: owned.key('alice').toPublic().toString(),
  });
  const request = {
    version: 1,
    chain_id: owned.chainId,
    runtime,
    authority,
    anchor: encodeQuickAnchor(anchor),
    account_id: '0',
    epoch: '0',
    expires: Math.floor(Date.now() / 1000) + 120,
  };
  await push(
    authority,
    'qregister',
    {
      request,
      proof: Serializer.encode({
        object: owned.key('alice').signDigest(quickAccountDigest('qregister', request)),
      }).hexString,
    },
    ['gateway'],
    ABI.from(quickAuthAbi),
  );
  const gateway = new NativeQuickBallots(
    {
      rpcUrl: owned.url,
      chainId: owned.chainId,
      runtime,
      authority,
      source,
      gateway: { actor: 'gateway', permission: 'active' },
    },
    {
      key: owned.key('gateway'),
      resources: async () => {},
      confirm: async (block) => {
        for (let n = 0; n < 100; n++) {
          if ((await owned.api.v1.chain.get_info()).last_irreversible_block_num.toNumber() >= block)
            return;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw Error('FIXTURE_FINALITY');
      },
    },
  );
  expect((await gateway.configuration()).sourceCodeHash).toBe(sourceHash);
  const identity = quickAccountIdentity(owned.chainId, runtime, anchor);
  expect(await gateway.account(identity)).toMatchObject({ id: '1', identity, active: true });
  expect(
    await gateway.account(Checksum256.hash(new TextEncoder().encode('not-an-account')).toString()),
  ).toBeNull();
  const record = await gateway.account(identity);
  if (!record) throw Error('FIXTURE_ACCOUNT');
  const nativeAnchor = QuickAccountAnchorSchema.parse({
    kind: 'native',
    account: 'alice',
    permission: 'active',
  });
  const nativeContext = {
    ...(await gateway.configuration()),
    anchor: nativeAnchor,
    identity: quickAccountIdentity(owned.chainId, runtime, nativeAnchor),
    frozen: true,
    record: null,
  };
  const registration = quickAccountRequest(
    nativeContext,
    { operation: 'register' },
    Math.floor(Date.now() / 1000) + 120,
  );
  const nativePrepared = {
    ...registration,
    id: '00000000-0000-4000-8000-000000000002',
    context: nativeContext,
    expiresAt: new Date((Math.floor(Date.now() / 1000) + 120) * 1000).toISOString(),
  };
  const nativeAction = quickAccountAction(nativePrepared, { proof: '', incoming: '' });
  const info = await owned.api.v1.chain.get_info();
  const transaction = Transaction.from({
    ...info.getTransactionHeader(60),
    actions: [nativeAction],
  });
  const nativeProof = {
    packedTransaction: Serializer.encode({ object: transaction }).hexString,
    signatures: [
      owned.key('alice').signDigest(transaction.signingDigest(owned.chainId)).toString(),
    ],
  };
  const nativePacket = await gateway.prepareSubmission(
    nativePrepared,
    { proof: '', incoming: '' },
    nativeProof,
  );
  expect(await gateway.submit(nativePrepared, nativePacket)).toEqual({
    transactionId: nativePacket.transactionId,
  });
  expect(await gateway.account(nativeContext.identity)).toMatchObject({ active: true });
  const wrong = Transaction.from({
    ...info.getTransactionHeader(60),
    actions: [nativeAction, nativeAction],
  });
  await expect(
    gateway.prepareSubmission(
      nativePrepared,
      { proof: '', incoming: '' },
      {
        packedTransaction: Serializer.encode({ object: wrong }).hexString,
        signatures: nativeProof.signatures,
      },
    ),
  ).rejects.toThrow('QUICK_NATIVE_PACKET');
  const context = { ...(await gateway.configuration()), anchor, identity, frozen: true, record };
  const operation = quickAccountRequest(
    context,
    { operation: 'deactivate', useDefault: false },
    Math.floor(Date.now() / 1000) + 120,
  );
  if (operation.action !== 'qdeactivate') throw Error('FIXTURE_OPERATION');
  const prepared = {
    id: '00000000-0000-4000-8000-000000000001',
    context,
    expiresAt: new Date(operation.request.expires * 1000).toISOString(),
    ...operation,
  };
  const proof = Serializer.encode({
    object: owned.key('alice').signDigest(quickAccountDigest('qdeactivate', operation.request)),
  }).hexString;
  const packet = await gateway.prepareSubmission(prepared, { proof, incoming: '' });
  expect(await gateway.submit(prepared, packet)).toEqual({ transactionId: packet.transactionId });
  expect(await gateway.account(identity)).toMatchObject({ active: false });
  expect((await gateway.reconcile(prepared, packet)).state).toBe('confirmed');
});
