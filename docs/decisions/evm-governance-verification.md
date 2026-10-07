# EOA governance verification

Version 1 uses the Antelope CDT `k1_recover` and `keccak` intrinsics. It vendors no cryptographic implementation. Spring must activate CRYPTO_PRIMITIVES and the authorization features used by the runtime; deployment preflight must fail if these are unavailable. Only the disposable research fixture was activated in this session.

The EIP-712 domain is name Daclify, version 1, selected Telos EVM chain 40/41, and salt Keccak(native chain ID || ABI uint256(runtime name)). No fictitious EVM verifying-contract address is supplied. Producer SDK functions define the exact binding and instruction field types. Bindings include DAO/member/address/chain/epoch/nonce/expiry. Instructions include target/action/SHA-256(exact data)/the same member nonce/expiry. Personal-sign/SIWE messages cannot authorize this format.

Ethereum input is r || s || v; v must be 27/28 on-chain. The SDK normalizes wallet v=0/1 and rejects noncanonical/high-S signatures. The intrinsic expects v || r || s and yields the uncompressed public key; the runtime derives the last 20 bytes of Keccak(public-key coordinates). Separate binding tombstones preserve epochs on removal. Current active member, role, guardian pause, module code pin/grant and accounting checks run through the shared instruction validator/dispatcher.

Independent Viem encodings were verified against the SDK and actual compiled C++/Spring. Four primitive vectors and negative signature cases passed. A scalar-1 reference EOA executed setcredits on the disposable native runtime, rejected altered expiry/replay, shared the K1 nonce, and failed after revocation. Local CPU readings are fixture observations, not capacity estimates or a mainnet benchmark. Raw evidence is generated into .artifacts/native; keys are excluded from committed evidence.

VERT 0.3.24 lacks compiler-rt 128-bit shifts; the test helper supplies only those integer operations. It does not replace K1, Keccak or authorization with trusted verification. Real native tests independently qualify the cryptographic/inline behavior.

No real injected wallet/Anchor/Telegram client has been qualified yet. ERC-1271 contract-wallet governance, EVM assets, payouts and bridges remain unavailable. Module UI labels and login success do not prove those capabilities.
