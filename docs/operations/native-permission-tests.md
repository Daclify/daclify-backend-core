# Run native permission and dummy DAO tests

From backend core, run `npm run test:native:permissions`. These tests start and stop their own Spring 1.2.2 nodes. They require the real compiled binaries in core `.artifacts/contracts` and the five module binaries in the sibling modules `.artifacts/contracts`. Missing artifacts or a missing/wrong node version fail the run.

The owned suite includes Names listing safety, seller RAM, a 102-entry inventory and keyed later quotes, real Relay operator orders and dummy Fees treasury transfers, circular creator/executive delegation through core owner/active, and Hub hash registration. It also includes Names oracle scope, observations, executive quorum and revocation in `tests/native/names-oracle-permission.test.ts`. It uses the actual Names binary; it needs no shared Docker Names fixture.

The suite covers creator recovery, executive quorum, code/ABI upgrades, parent/child permission links, code weights, service isolation, actual policy-2 handover and legacy-policy upgrade refusal, strict incoming-wallet consent, replay, module sender/grant/code checks, cross-DAO isolation, rollback and a complete Grants/Decide/Works/Payroll payout flow. A ballot genuinely waits for its 60-second chain deadline. Each node has a distinct generated genesis, disposable signers, private temporary configuration and random loopback HTTP/P2P ports; the suite never selects an existing or public chain.

## Pinned tools without Docker

The canonical [Dockerfile](../../tools/build/Dockerfile) pins these official Linux amd64 archives:

| Tool         | Archive                                                                                                                          | SHA256                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| CDT 4.1.1    | [cdt_4.1.1-1_amd64.deb](https://github.com/AntelopeIO/cdt/releases/download/v4.1.1/cdt_4.1.1-1_amd64.deb)                        | d946e6b64f297442d19e486401aa49f956080b07a1fa6335f29976106175b588 |
| Spring 1.2.2 | [antelope-spring_1.2.2_amd64.deb](https://github.com/AntelopeIO/spring/releases/download/v1.2.2/antelope-spring_1.2.2_amd64.deb) | 531ed1c965f94dd7732f5e900401f132170769c45b7589819a0ba1336627687a |

Verify the downloaded archive checksums before use. Extract them to an owned directory using `dpkg-deb -x`; host installation or a persistent node service is unnecessary. The extracted node is `spring/usr/bin/nodeos`, and the compiler is `cdt/usr/opt/cdt/4.1.1/bin/cdt-cpp`. Supply the host's libatomic shared library or an extracted compatible libatomic1 directory if needed.

For the extracted tools used in the dated review on this VM:

```sh
DACLIFY_CDT_BINARY=/data/daclify-runtime/toolchain-review/cdt/usr/opt/cdt/4.1.1/bin/cdt-cpp \
DACLIFY_NATIVE_LIBS=/data/daclify-runtime/toolchain-review/libs/usr/lib/x86_64-linux-gnu \
npm run build:contracts

npm run codegen

DACLIFY_CDT_BINARY=/data/daclify-runtime/toolchain-review/cdt/usr/opt/cdt/4.1.1/bin/cdt-cpp \
DACLIFY_NATIVE_LIBS=/data/daclify-runtime/toolchain-review/libs/usr/lib/x86_64-linux-gnu \
npm run build:legacy-ownership

DACLIFY_NATIVE_NODEOS=/data/daclify-runtime/toolchain-review/spring/usr/bin/nodeos \
DACLIFY_NATIVE_LIBS=/data/daclify-runtime/toolchain-review/libs/usr/lib/x86_64-linux-gnu \
npm run test:native:permissions
```

Use your own extracted paths elsewhere. Without DACLIFY_CDT_BINARY, the existing contract build uses its pinned Docker image. Without DACLIFY_NATIVE_NODEOS, the new tests look for nodeos on PATH. Both paths verify the pinned tool version. The compiler rebuild includes authorityprobe as a test fixture; it is absent from production deployment profiles and the catalogue.

## Scope of evidence

The module workflows use the actual policy-2 contract handover, including seven managed accounts and quorum-weighted code. The authority-probe fixture separately checks native primitives and adversarial code behavior, including attempts to relax or unlink owner-protected upgrades. The legacy fixture rebuilds the pinned preceding core revision 8a2c5f9 and checks real persisted table compatibility, refusal of controller mutations, and a real unstake after upgrading. Run build:legacy-ownership once before the suite; the artifact hash is checked. Lifecycle tests genuinely wait for executive expiry and election deadlines.

The six required native features include RAM_RESTRICTIONS and RESTRICT_ACTION_TO_SELF, matching the observed public testnet authorization rules. Dummy token/account fixtures do not qualify Telos system resource pricing, live providers, external custody or browser wallet/multisig signing. Those remain separate suites and operational checks. The [dated audit](../evidence/2026-10-10-testnet-permission-review.md) records exact results and boundaries.
