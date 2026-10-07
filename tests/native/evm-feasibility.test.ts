import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { APIClient, Action, ABI, Transaction, SignedTransaction } from '@wharfkit/antelope';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { activateFixtureFeatures } from '../../tools/native/features.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { fixtureKey } from '../../tools/native/keys.js';
const network = z
  .object({
    url: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/),
    chainId: z.string(),
    container: z.literal('daclify-research-native'),
  })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const rpc = new APIClient({ url: network.url }),
  abi = ABI.from(readFileSync('.artifacts/contracts/permprobe.abi', 'utf8'));
// Public, disposable private scalar 1 has the independently known Ethereum address below.
const scalar = new Uint8Array(32);
scalar[31] = 1;
const address = '7e5f4552091a69125d5dfcb7b8c2659029395bdf';
async function push(digest: string, signature: string, expected = address) {
  const info = await rpc.v1.chain.get_info(),
    transaction = Transaction.from({
      ...info.getTransactionHeader(60),
      actions: [
        Action.from(
          {
            account: 'permprobe',
            name: 'evmproof',
            authorization: [{ actor: 'alice', permission: 'active' }],
            data: { digest, signature, expected },
          },
          abi,
        ),
      ],
    });
  return rpc.v1.chain.push_transaction(
    SignedTransaction.from({
      ...transaction,
      signatures: [fixtureKey('alice').signDigest(transaction.signingDigest(network.chainId))],
    }),
  );
}
it('qualifies native K1 recovery and Keccak with independent address and adversarial forms', async () => {
  unlockFixtureWallet(network.container);
  await activateFixtureFeatures(network.container, network.url);
  execFileSync(
    'docker',
    [
      'exec',
      network.container,
      'cleos',
      '--wallet-url',
      'http://127.0.0.1:8900',
      'set',
      'contract',
      'permprobe',
      '/work/.artifacts/contracts',
      'permprobe.wasm',
      'permprobe.abi',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const cpu: number[] = [];
  for (let index = 0; index < 4; index++) {
    const digest = createHash('sha256').update(`independent-intrinsic-vector-${index}`).digest();
    const recovered = secp256k1.sign(digest, scalar, { prehash: false, format: 'recovered' });
    const ethereum = Buffer.concat([
      Buffer.from(recovered.subarray(1)),
      Buffer.from([(recovered[0] ?? 0) + 27]),
    ]);
    const result = await push(digest.toString('hex'), ethereum.toString('hex'));
    const receipt = z
      .object({
        processed: z.object({ receipt: z.object({ cpu_usage_us: z.number().nonnegative() }) }),
      })
      .parse(JSON.parse(JSON.stringify(result)));
    cpu.push(receipt.processed.receipt.cpu_usage_us);
    if (index === 0) {
      await expect(push('00'.repeat(32), ethereum.toString('hex'))).rejects.toThrow();
      await expect(
        push(digest.toString('hex'), ethereum.toString('hex'), '00'.repeat(20)),
      ).rejects.toThrow();
      await expect(
        push(digest.toString('hex'), ethereum.subarray(0, 64).toString('hex')),
      ).rejects.toThrow();
      const bad = Buffer.from(ethereum);
      bad[64] = 29;
      await expect(push(digest.toString('hex'), bad.toString('hex'))).rejects.toThrow();
      const high = Buffer.from(ethereum);
      high.fill(255, 32, 64);
      await expect(push(digest.toString('hex'), high.toString('hex'))).rejects.toThrow();
    }
  }
  writeFileSync(
    '.artifacts/native/evm-spike-evidence.json',
    JSON.stringify(
      {
        fixture: network.container,
        chainId: network.chainId,
        toolchain: 'CDT 4.1.1 / Spring 1.2.2',
        intrinsics: ['k1_recover', 'sha3 (keccak=1)'],
        validVectors: cpu.length,
        negativeVectors: 5,
        cpuMicroseconds: cpu,
        productionQualified: false,
      },
      null,
      2,
    ) + '\n',
  );
  expect(cpu).toHaveLength(4);
});
