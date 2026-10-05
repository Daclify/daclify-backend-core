# Daclify V2 Foundation Readiness Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` for these tasks. Delegation requires explicit authorization. Each checkbox is a future action. This plan contains read-only checks and disposable characterization probes; it does not authorize production transactions, account-key rotation, migration or application implementation.

**Goal:** Establish the reproducible baseline and evidence required to write the first bounded V2 code plans without guessing deployed authority, custody compatibility or cross-runtime behavior.

**Architecture:** Keep the six legacy repositories as evidence inputs and use the created private frontend, backend core services, and backend modules repositories. Use disposable artifacts for compiler/emulator characterization and an internal decision packet for custody, privacy, governance weights and settlement. Execute runtime/key-provider prototypes in separately scoped sandbox packages after selecting their actual tools and APIs. The continuous-session/final-user-review workflow is defined by the companion release policy.

**Tech Stack:** Existing Git/Python/Node tooling, current C++ compiler for characterization, the verified installed Boid VERT package, public read-only native RPC, and primary provider/runtime documentation.

This is the first part of WP01: baseline, characterization and bounded prototype specifications. Completing it does not close WP01's custody or cross-runtime feasibility gates; those gates require the specified sandbox prototypes to run successfully before their dependent implementation packages start.

## Task 1 Record the source baseline

**Files:** Read the six legacy repositories. Create `daclify-backend-core/docs/evidence/baseline.json` and `daclify-backend-core/docs/evidence/baseline.md` when the core V2 repository line is established. Until then, retain outputs under a disposable task directory and link them from the planning review.

- [ ] **Step 1: Read applicable instructions and current worktree state.** Search the workspace/repository ancestors for `AGENTS.md` and established documentation conventions. Preserve user changes and record uncommitted work before any future checkout.
- [ ] **Step 2: Produce the baseline with this read-only command.**

```bash
python3 - <<'PY'
from pathlib import Path
import json, shutil, subprocess
root = Path('/Users/seth/Documents/GitHub/Daclify')
names = ['daclifyfrontend', 'daclifycore', 'daclifymodules',
         'daclifyhub', 'www-landing-page', 'custom-ui-components']
records = []
for name in names:
    path = root / name
    def git(*args):
        return subprocess.check_output(['git', '-C', str(path), *args], text=True).strip()
    records.append({'repository': name, 'head': git('rev-parse', 'HEAD'),
                    'status': git('status', '--short'),
                    'last_commit': git('log', '-1', '--format=%h %ad %s', '--date=short')})
tools = {}
for executable in ('node', 'npm', 'python3', 'cdt-cpp', 'nodeos', 'cleos', 'docker'):
    tools[executable] = shutil.which(executable)
print(json.dumps({'root_repository_exists': (root / '.git').exists(),
                  'repositories': records, 'tools': tools}, indent=2))
PY
```

Expected: structured repository/tool data. Compare it with the evidence register; different revisions or a dirty status become an explicit baseline update, never a reason to discard work.

- [ ] **Step 3: Read the existing build/test configuration and compare advertised scripts with actual suites.** Use `rg --files` and targeted source reads. Do not execute deployment scripts or print private-key/configuration contents.
- [ ] **Step 4: Record source versus deployed-state uncertainty.** Copy the evidence classifications from the companion register into the baseline; mark the frontend build as existing-install evidence and VERT as partial runtime coverage.
- [ ] **Step 5: Review and commit only the new baseline files once the V2 core repository line exists.** Preserve the legacy revision references; no root repository or legacy commit is created merely to satisfy a documentation convention.

## Task 2 Characterize deployed interfaces through read-only RPC

**Files:** Create `daclify-backend-core/docs/evidence/telos-service-api.json`, `daclify-backend-core/docs/evidence/native-interface-check.json` and a deployment inventory listing accounts selected by the DAO owner. Do not infer production ownership from a local configuration entry.

- [ ] **Step 1: Read the supplied Telos service schema, then inspect the public EVM ABI and native chain identity through separate verified native RPC endpoints.** The Swagger page at `https://api.telos.net/v1/docs/index.html` loads `https://api.telos.net/v1/docs/json`. It documents service endpoints rather than the `/v1/chain` methods used below.

```bash
python3 - <<'PY'
import json, urllib.request
service_api = 'https://api.telos.net'
native_endpoints = ['https://mainnet.telos.net', 'https://telos.eu.eosamsterdam.net']
try:
    schema = json.load(urllib.request.urlopen(service_api + '/v1/docs/json', timeout=10))
    print(json.dumps({'endpoint_kind': 'telos_service_api', 'endpoint': service_api,
                      'openapi': schema.get('openapi'), 'info': schema.get('info'),
                      'servers': schema.get('servers'),
                      'documented_paths': sorted(schema.get('paths', {}))}))
except Exception as error:
    print(json.dumps({'endpoint_kind': 'telos_service_api',
                      'endpoint': service_api, 'error': str(error)}))
def query(endpoint, action, body):
    request = urllib.request.Request(
        endpoint + '/v1/chain/' + action,
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json',
                 'User-Agent': 'Daclify-ReadOnly-Review'}, method='POST')
    return json.load(urllib.request.urlopen(request, timeout=10))
for endpoint in native_endpoints:
    try:
        info = query(endpoint, 'get_info', {})
        abi = query(endpoint, 'get_abi', {'account_name': 'eosio.evm'}).get('abi')
        if not isinstance(abi, dict):
            raise ValueError('Endpoint returned no ABI')
        print(json.dumps({'endpoint': endpoint,
            'chain_id': info.get('chain_id'),
            'head_block_num': info.get('head_block_num'),
            'last_irreversible_block_num': info.get('last_irreversible_block_num'),
            'head_block_time': info.get('head_block_time'),
            'actions': [a['name'] for a in abi.get('actions', [])],
            'tables': [t['name'] for t in abi.get('tables', [])]}))
    except Exception as error:
        print(json.dumps({'endpoint': endpoint, 'error': str(error)}))
PY
```

Expected: the discovered service schema and separate native endpoint observations or explicit errors. During this revision, the service schema exposed 32 paths and native `get_info`/`get_abi` calls against `api.telos.net` returned 404. Verify chain identity and freshness at execution. An ABI lookup is an interface observation, not a security result. Do not invoke the documented registration/account-creation/faucet/testnet-control routes during read-only inventory; some service routes can change state even when their HTTP method is GET.

- [ ] **Step 2: Obtain actual legacy deployment account names from verified project/operator records.** For each, collect its code/ABI reference, permission graph, linked permissions, asset balances and outstanding liabilities at a recorded chain/block reference using documented chain methods.
- [ ] **Step 3: Compare deployed artifacts with local revisions.** Label mismatches and unknown code provenance; do not automatically update a deployment.
- [ ] **Step 4: Inventory suspect key use without recording key values.** Record source file locations and potentially affected permissions. Authorized owners decide live key rotation and sponsor permission changes separately from this plan.
- [ ] **Step 5: Save the inventory with public references and redacted secret fields.** A failed endpoint is an observation; use another verified source rather than fabricating missing deployment information.

## Task 3 Characterize the local C++ and VERT path

**Files:** Disposable `probe.cpp`, `probe.wasm`, `probe.abi`, `probe.cjs` and build/test output. Later create `daclify-backend-core/docs/evidence/toolchain.md` and the selected native integration harness specification.

- [ ] **Step 1: Record compiler version and distinguish the installed development compiler from the production candidate.**

```bash
cdt-cpp --version
```

Expected: actual installed version; the investigation observed `5.0.0-dev1`. Verify official release/runtime requirements before choosing the production toolchain.

- [ ] **Step 2: Create this disposable characterization contract.**

```cpp
#include <eosio/eosio.hpp>
using namespace eosio;

CONTRACT probe : public contract {
public:
    using contract::contract;

    TABLE state {
        name owner;
        uint64_t value;
        uint64_t primary_key() const { return owner.value; }
    };
    using states = multi_index<"states"_n, state>;

    ACTION setvalue(name owner, uint64_t value) {
        require_auth(owner);
        states rows(get_self(), get_self().value);
        const auto found = rows.find(owner.value);
        if (found == rows.end()) {
            rows.emplace(owner, [&](auto& row) {
                row.owner = owner;
                row.value = value;
            });
        } else {
            rows.modify(found, same_payer, [&](auto& row) {
                row.value = value;
            });
        }
    }
};
```

Use a new disposable directory, set `DACLIFY_PROBE_DIR` to its path, and compile there:

```bash
cdt-cpp "$DACLIFY_PROBE_DIR/probe.cpp" -o "$DACLIFY_PROBE_DIR/probe.wasm" --abigen
```

Expected: WASM and ABI artifacts or an explicit compiler failure. Record warnings. A successful development-compiler build does not choose that compiler for production.

- [ ] **Step 3: Create this characterization test using the verified installed package interface.**

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Blockchain } = require(
  '/Users/seth/Documents/GitHub/animuslabs/boid-worker/node_modules/@proton/vert'
);

async function main() {
  const chain = new Blockchain();
  const alice = chain.createAccount('alice');
  chain.createAccount('bob');
  const probe = chain.createAccount({
    name: 'probe',
    abi: JSON.parse(fs.readFileSync(path.join(__dirname, 'probe.abi'), 'utf8')),
    wasm: fs.readFileSync(path.join(__dirname, 'probe.wasm')),
  });
  await assert.rejects(
    probe.actions.setvalue(['alice', 7]).send('bob@active'),
    /missing required authority/
  );
  await probe.actions.setvalue(['alice', 7]).send('alice@active');
  const row = probe.tables.states().getTableRow(alice.toBigInt());
  assert.equal(row.owner, 'alice');
  assert.equal(row.value, 7);
  console.log('Characterization: authorized state write and unauthorized rejection verified');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
```

Run:

```bash
node "$DACLIFY_PROBE_DIR/probe.cjs"
```

Expected: actual assertions pass and exit status zero. A missing package or changed API is a prerequisite failure to investigate. When establishing V2's permanent suite, use its pinned workspace dependency rather than this machine-specific Boid path.

- [ ] **Step 4: Specify the native-chain tests VERT cannot satisfy.** The required fixture includes real native accounts, owner/active/code permission graphs, successful and denied inline actions, `check_permission_authorization`, token notification forwarding, resource limits, transaction rollback and artifact verification.
- [ ] **Step 5: Select the target runtime release from Telos/Antelope primary sources, then write the exact container/chain startup and test commands in WP02's execution plan.** Do not guess a node image/tag, a protocol feature or a runtime command flag. Run a real native permission test before calling the permanent harness ready.

## Task 4 Freeze the identity and confidentiality decision packet

**Files:** Create `daclify-backend-core/docs/decisions/{custody,identity,privacy}.md` containing the following selected/proposed state and evidence requirements.

- [ ] **Step 1: Record the selected product requirement.** Both user-controlled and managed recovery modes are first-release requirements. Separate signing-key recovery from document-key custody. Mark operator-excluding private DAOs as incompatible with operator-recoverable decryption keys.
- [ ] **Step 2: Define the user-controlled prototype outcomes.** Generate separate keys; encrypt and persist the vault; unlock on supported desktop/mobile browsers; restore on a fresh device; test loss of social login and loss of recovery credential; test Telegram webview fallback; confirm no plaintext key export/log/storage path. Passkeys remain a capability until demonstrated.
- [ ] **Step 3: Define managed-provider selection evidence.** Verify supported signing curves/formats and wrapping, separation of app database and key authority, authenticated intent/step-up, auditable recovery, export/exit, quota/expiry access and real unit cost. Select the provider from those measured outcomes, not from an assumed API.
- [ ] **Step 4: Define contract authorization cases.** Wrong target/DAO/member, stale instruction, replay, parallel nonce reuse, wallet-binding takeover, recovered-key revocation and managed session overreach must fail. Preserve the same member identity across credential/custody transitions.
- [ ] **Step 5: Record privacy-history defaults for review.** Ordinary collaboration preset: full history; restricted-project preset: future only. Require explicit acknowledgement, epoch rotation on removal and tests showing historic disclosure cannot be revoked.
- [ ] **Step 6: Write the bounded sandbox implementation plans for the two custody prototypes.** These must name actual provider/library interfaces and supported-client tests before their code is written. They are prerequisites to WP04, not licence to store production keys during the readiness task.

## Task 5 Freeze asset, governance and settlement boundaries

**Files:** Create `daclify-backend-core/docs/decisions/{governance-weights,deployment,settlement}.md` using the record definitions in the architecture specification.

- [ ] **Step 1: Record native assets separately from governance credits.** Asset identity includes chain/contract/identifier/precision; credits are DAO-scoped and nonwithdrawable. Nontransferability is a proposed default pending explicit preference.
- [ ] **Step 2: Select native governance checkpoint/locking policy.** Demonstrate how transfer, staking, credit changes and linked credentials cannot duplicate active-ballot weight. Define canonical weighting for bridged representations.
- [ ] **Step 3: Record shared and independent authority diagrams.** Include owner/active/code grants, per-DAO balances/vaults, module capabilities, upgrade signers and an exit path. The Hub has no governance grant.
- [ ] **Step 4: Specify the Telos runtime experiment.** Use disposable vault/request fixtures to observe native-to-EVM success/revert/gas behavior, EVM-to-native validated state submission, request refund/admin deletion, replay and retry. Record actual atomicity; do not infer it from a shared underlying chain.
- [ ] **Step 5: Fix payment verification terminology.** DAO-confirmed, attested and contract-verified are distinct. A transaction hash is a reference; a verified settlement binds success/finality, chain, vault, asset/amount, recipient and obligation. Authenticated roots are mandatory for inclusion-proof verification.
- [ ] **Step 6: Write WP15's bounded sandbox plan after the deployed runtime surface is matched to source.** Keep arbitrary EVM-to-native synchronous calls unclaimed until demonstrated. Keep other-chain support outside first-release critical path.

## Task 6 Review readiness and open the next bounded package

**Files:** Create `daclify-backend-core/docs/evidence/readiness-review.md` and the concrete WP02 execution plan when its prerequisites are satisfied.

- [ ] **Step 1: Check requirement coverage against the master plan and package list.** Both custody modes, privacy admission, internal/native/EVM identities, tokens, both deployment modes, Decide/Works/payroll, Pinata-backed durable storage, monetization, version/migration management, generated contextual product documentation, extensive invariant/regression tests and future adapters have named packages and tests.
- [ ] **Step 2: Resolve contradictions and test assumptions.** Verify proposed versus selected defaults, actual tool versions, error/output claims, permission owners and fallback paths. Link failed/unrun checks honestly.
- [ ] **Step 3: Set readiness gates.** WP02 establishes the three independent repository lines, per-repository CI, versioned protocol/SDK artifacts and harness after toolchain/schema decisions; WP04 waits for both custody prototypes; WP15 waits for the cross-runtime prototype. Frontend uses Vue/Vite, Vue Router, Pinia and explicit `vue-tsc` checks without Quasar. Failure of one future-chain prototype need not stop native DAO foundation work.
- [ ] **Step 4: Estimate the next package using evidence and available team capacity.** Record the owner, assumptions, expected artifacts, independent review scope and actual acceptance commands. Do not invent a full-platform completion date.
- [ ] **Step 5: Review the final documentation diff and retain the execution checkpoint.** Record the decision packet and continue into the next ready package during the implementation session; internal readiness review does not require a separate user-approval turn. Ask only for material missing decisions/access, continuing independent work. The user reviews the complete code afterward. Production deployments, authority/key changes and asset migration remain separate expressly authorized actions.

## Definition of readiness

The baseline is reproducible; proposed schemas and authorities are coherent; tools and runtime limitations are recorded; high-risk custody and settlement assumptions have concrete sandbox plans and measured evidence before their dependent packages start; every product requirement has an owner package and acceptance criterion. A compiling toy contract or a readable ABI alone is not completion of native authorization, custody or EVM settlement verification.
