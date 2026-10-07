import { FixtureContainerSchema } from './network.js';
// Admit a synthetic browser member to a DAO owned by the local fixture account.
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { APIClient, Action, Transaction, SignedTransaction } from '@wharfkit/antelope';
import { IdSchema } from '../../protocol/base.js';
import { SigningPublicKeySchema, EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { encodeAction } from '../../sdk/index.js';
import { fixtureKey } from './keys.js';
import { unlockFixtureWallet } from './wallet.js';
import { configureFixtureContext } from './permissions.js';
const input = z
  .strictObject({
    daoId: IdSchema,
    memberId: IdSchema,
    signingKey: SigningPublicKeySchema,
    encryptionKey: EncryptionPublicKeySchema,
  })
  .parse(JSON.parse(process.argv[2] ?? ''));
if (process.argv.length !== 3) throw new Error('Expected one public fixture enrollment object');
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
const data = encodeAction('enroll', {
  dao_id: input.daoId,
  member_id: input.memberId,
  native_account: '',
  signing_key: input.signingKey,
  encryption_key: JSON.stringify(input.encryptionKey),
  custody: 0,
});
const transaction = Transaction.from({
  ...info.getTransactionHeader(60),
  actions: [
    Action.from({
      account: 'daclifycore',
      name: 'enroll',
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
unlockFixtureWallet(network.container);
configureFixtureContext(network.container);
console.log(
  'Admitted a synthetic browser member on the disposable local chain and applied its documented fixture action links.',
);
