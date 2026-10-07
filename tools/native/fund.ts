import { FixtureContainerSchema } from './network.js';
// Fund a test DAO using synthetic tokens on the fixed, disposable local chain.
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  ABI,
  APIClient,
  Action,
  Serializer,
  Transaction,
  SignedTransaction,
} from '@wharfkit/antelope';
import { IdSchema } from '../../protocol/base.js';
import { fixtureKey } from './keys.js';
const daoId = IdSchema.parse(process.argv[2]);
if (process.argv.length !== 3) throw new Error('Expected one local fixture DAO ID');
const network = z
  .object({
    container: FixtureContainerSchema,
    url: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/),
    chainId: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .parse(JSON.parse(await readFile('.artifacts/native/network.json', 'utf8')));
const api = new APIClient({ url: network.url });
const info = await api.v1.chain.get_info();
if (info.chain_id.toString() !== network.chainId) throw new Error('Fixture chain mismatch');
const data = Serializer.encode({
  abi: ABI.from(await readFile('.artifacts/contracts/testtoken.abi', 'utf8')),
  type: 'transfer',
  object: { from: 'alice', to: 'daclifycore', quantity: '25.0000 TLOS', memo: `dao:${daoId}` },
}).array;
const transaction = Transaction.from({
  ...info.getTransactionHeader(60),
  actions: [
    Action.from({
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: 'alice', permission: 'active' }],
      data,
    }),
  ],
});
await api.v1.chain.push_transaction(
  SignedTransaction.from({
    ...transaction,
    signatures: [fixtureKey('alice').signDigest(transaction.signingDigest(info.chain_id))],
  }),
);
console.log('Funded a DAO with synthetic tokens on the disposable local chain.');
