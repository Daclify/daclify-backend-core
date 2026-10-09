import { createHash } from 'node:crypto';
import { ABI, Serializer } from '@wharfkit/antelope';
export const TelosTokenSources = [
  {
    environment: 'mainnet',
    source: 'https://mainnet.telos.net',
    chainId: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
    codeHash: 'e7aa90a489446616f9bf0f1d0368f849722c7d36054d910e8f378ce9d2b618f1',
    rawAbiHash: 'fb8452c70aa203505592aef25b696acaa1aee58805888cc9aae024b4c03af91e',
  },
  {
    environment: 'testnet',
    source: 'https://testnet.telos.caleos.io',
    chainId: '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
    codeHash: 'e7aa90a489446616f9bf0f1d0368f849722c7d36054d910e8f378ce9d2b618f1',
    rawAbiHash: 'fb8452c70aa203505592aef25b696acaa1aee58805888cc9aae024b4c03af91e',
  },
] as const;
export function validateTokenSnapshot(
  pin: { chainId: string; codeHash: string; rawAbiHash: string },
  snapshot: {
    beforeChainId: string;
    afterChainId: string;
    beforeCodeHash: string;
    afterCodeHash: string;
    wasm: Uint8Array;
    rawAbi: Uint8Array;
  },
): ABI {
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  if (
    snapshot.beforeChainId !== pin.chainId ||
    snapshot.afterChainId !== pin.chainId ||
    snapshot.beforeCodeHash !== pin.codeHash ||
    snapshot.afterCodeHash !== pin.codeHash ||
    hash(snapshot.wasm) !== pin.codeHash ||
    hash(snapshot.rawAbi) !== pin.rawAbiHash ||
    Buffer.from(snapshot.wasm.subarray(0, 8)).toString('hex') !== '0061736d01000000'
  )
    throw new Error('TELOS_TOKEN_SNAPSHOT_CHANGED');
  return Serializer.decode({ data: snapshot.rawAbi, type: ABI });
}
