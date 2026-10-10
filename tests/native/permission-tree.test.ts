import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ABI, Authority, PrivateKey, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { SYSTEM_ABI } from '../../sdk/system-abi.js';
import { nativeProcess, type NativeProcess } from '../helpers/native-process.js';
let owned: NativeProcess | undefined;
const probe = ABI.from(readFileSync('.artifacts/contracts/authorityprobe.abi', 'utf8'));
const systemAbi = ABI.from(SYSTEM_ABI);
let sequence = 0;
const fixture = () => {
  if (!owned) throw new Error('NATIVE_FIXTURE_REQUIRED');
  return owned;
};
beforeAll(async () => {
  owned = await nativeProcess();
  for (const account of ['runner', 'recovery', 'execone', 'exectwo', 'outsider'])
    await owned.create(account);
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
function delegated(
  accounts: readonly { actor: string; permission: string; weight: number }[],
  threshold = 1,
) {
  const authority = Authority.from({
    threshold,
    keys: [],
    waits: [],
    accounts: accounts.map(({ actor, permission, weight }) => ({
      permission: { actor, permission },
      weight,
    })),
  });
  authority.sort();
  return authority;
}
const executives = () => [fixture().key('execone'), fixture().key('exectwo')];
async function tree(codeWeight = 2) {
  const f = fixture(),
    index = sequence++,
    suffix = String.fromCharCode(97 + Math.floor(index / 26), 97 + (index % 26));
  const core = 'auth' + suffix,
    module = 'mod' + suffix;
  await f.create(core);
  await f.create(module);
  await f.deploy(core, '.artifacts/contracts/authorityprobe');
  await f.deploy(module, '.artifacts/contracts/authorityprobe');
  const active = delegated(
    [
      { actor: 'execone', permission: 'active', weight: 1 },
      { actor: 'exectwo', permission: 'active', weight: 1 },
      ...(codeWeight ? [{ actor: core, permission: 'eosio.code', weight: codeWeight }] : []),
    ],
    2,
  );
  const service = PrivateKey.generate('K1');
  await f.update(
    core,
    'execctx',
    'active',
    delegated([{ actor: core, permission: 'eosio.code', weight: 1 }]),
  );
  await f.update(
    core,
    'service',
    'active',
    Authority.from({
      threshold: 1,
      keys: [{ key: service.toPublic(), weight: 1 }],
      accounts: [],
      waits: [],
    }),
  );
  await f.update(core, 'active', 'owner', active);
  await f.update(
    core,
    'owner',
    '',
    delegated([{ actor: 'recovery', permission: 'active', weight: 1 }]),
  );
  await f.update(
    module,
    'active',
    'owner',
    delegated([
      { actor: core, permission: 'active', weight: 1 },
      { actor: module, permission: 'eosio.code', weight: 1 },
    ]),
  );
  await f.update(
    module,
    'owner',
    '',
    delegated([{ actor: core, permission: 'active', weight: 1 }]),
  );
  return { core, module, active, service };
}
type Tree = Awaited<ReturnType<typeof tree>>;
async function authority(account: string, name: string) {
  const row = (await fixture().api.v1.chain.get_account(account)).permissions.find(
    (row) => row.perm_name.toString() === name,
  );
  if (!row) throw new Error('FIXTURE_PERMISSION_MISSING');
  return Serializer.objectify(row);
}
function update(state: Tree, permission = 'active', auth = state.active, authorization = 'active') {
  return fixture().system(
    'updateauth',
    { account: state.core, permission, parent: permission === 'owner' ? '' : 'owner', auth },
    state.core,
    authorization,
  );
}
function abiChange(account: string, permission = 'active') {
  return fixture().system(
    'setabi',
    { account, abi: Serializer.encode({ object: probe }) },
    account,
    permission,
  );
}
async function inline(
  caller: string,
  actor: string,
  permission: string,
  name: string,
  object: object,
) {
  const f = fixture();
  return f.push(
    [
      f.action(
        caller,
        'call',
        {
          actor,
          permission,
          target: 'eosio',
          action_name: name,
          data: Serializer.encode({ abi: systemAbi, type: name, object }),
        },
        [{ actor: 'runner', permission: 'active' }],
        probe,
      ),
    ],
    [f.key('runner')],
  );
}
async function lockUpgrade(state: Tree) {
  await fixture().push(
    ['setcode', 'setabi'].map((type) =>
      fixture().system(
        'linkauth',
        { account: state.module, code: 'eosio', type, requirement: 'owner' },
        state.module,
        'owner',
      ),
    ),
    executives(),
  );
}
async function marks(account: string) {
  const rows = await fixture().api.v1.chain.get_table_rows({
    code: account,
    scope: account,
    table: 'marks',
    limit: 1,
  });
  return z
    .array(z.object({ value: z.union([z.number(), z.string()]) }))
    .parse(rows.rows)
    .map((row) => String(row.value));
}
it('retains creator-only recovery and a genuine two-executive active authority', async () => {
  const state = await tree();
  expect(await authority(state.core, 'owner')).toMatchObject({
    parent: '',
    required_auth: {
      threshold: 1,
      keys: [],
      accounts: [{ permission: { actor: 'recovery', permission: 'active' }, weight: 1 }],
    },
  });
  expect(await authority(state.core, 'active')).toMatchObject({
    parent: 'owner',
    required_auth: {
      threshold: 2,
      keys: [],
      accounts: [
        { permission: { actor: state.core, permission: 'eosio.code' }, weight: 2 },
        { permission: { actor: 'execone', permission: 'active' }, weight: 1 },
        { permission: { actor: 'exectwo', permission: 'active' }, weight: 1 },
      ],
    },
  });
});
it.each(['execone', 'exectwo', 'outsider'])(
  '%s alone cannot upgrade core through active',
  async (account) => {
    const state = await tree();
    await expect(fixture().push([abiChange(state.core)], [fixture().key(account)])).rejects.toThrow(
      'NATIVE_AUTH_REJECTED',
    );
  },
);
it('allows executive quorum to execute a real core ABI upgrade', async () => {
  const state = await tree();
  await fixture().push([abiChange(state.core)], executives());
  expect(
    (await fixture().api.v1.chain.get_abi(state.core)).abi?.actions.map((action) =>
      action.name.toString(),
    ),
  ).toContain('touch');
});
it.each(['execone', 'outsider'])(
  '%s cannot replace the actual core WASM alone',
  async (account) => {
    const state = await tree(),
      f = fixture();
    const code = readFileSync('.artifacts/contracts/permprobe.wasm');
    await expect(
      f.push(
        [f.system('setcode', { account: state.core, vmtype: 0, vmversion: 0, code }, state.core)],
        [f.key(account)],
      ),
    ).rejects.toThrow('NATIVE_AUTH_REJECTED');
    expect((await f.api.v1.chain.get_code(state.core)).code_hash.toString()).toBe(
      createHash('sha256')
        .update(readFileSync('.artifacts/contracts/authorityprobe.wasm'))
        .digest('hex'),
    );
  },
);
it('replaces actual core WASM through executive active quorum', async () => {
  const state = await tree(),
    f = fixture(),
    code = readFileSync('.artifacts/contracts/permprobe.wasm');
  await f.push(
    [f.system('setcode', { account: state.core, vmtype: 0, vmversion: 0, code }, state.core)],
    executives(),
  );
  expect((await f.api.v1.chain.get_code(state.core)).code_hash.toString()).toBe(
    createHash('sha256').update(code).digest('hex'),
  );
});
it('blocks managed own-code replacement and accepts the same WASM through delegated owner quorum', async () => {
  const state = await tree(),
    f = fixture(),
    code = readFileSync('.artifacts/contracts/permprobe.wasm');
  await lockUpgrade(state);
  const object = { account: state.module, vmtype: 0, vmversion: 0, code };
  await expect(inline(state.module, state.module, 'active', 'setcode', object)).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
  await f.push([f.system('setcode', object, state.module, 'owner')], executives());
  expect((await f.api.v1.chain.get_code(state.module)).code_hash.toString()).toBe(
    createHash('sha256').update(code).digest('hex'),
  );
});
it('allows creator recovery to replace active without executive signatures', async () => {
  const state = await tree(),
    replacement = delegated([{ actor: 'outsider', permission: 'active', weight: 1 }]);
  await fixture().push(
    [update(state, 'active', replacement, 'owner')],
    [fixture().key('recovery')],
  );
  expect(await authority(state.core, 'active')).toMatchObject({
    required_auth: {
      threshold: 1,
      accounts: [{ permission: { actor: 'outsider', permission: 'active' }, weight: 1 }],
    },
  });
  await expect(fixture().push([abiChange(state.core)], executives())).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
});
it('allows executive quorum to update its own active while preserving creator owner', async () => {
  const state = await tree(),
    before = await authority(state.core, 'owner');
  const replacement = delegated([
    { actor: 'exectwo', permission: 'active', weight: 1 },
    { actor: state.core, permission: 'eosio.code', weight: 1 },
  ]);
  await fixture().push([update(state, 'active', replacement)], executives());
  expect(await authority(state.core, 'owner')).toEqual(before);
  await fixture().push([abiChange(state.core)], [fixture().key('exectwo')]);
  await expect(fixture().push([abiChange(state.core)], [fixture().key('execone')])).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
});
it('rejects executive quorum attempting to replace creator owner through active', async () => {
  const state = await tree(),
    before = await authority(state.core, 'owner');
  await expect(
    fixture().push([update(state, 'owner', state.active)], executives()),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
  expect(await authority(state.core, 'owner')).toEqual(before);
});
it('allows own code at quorum weight to synchronize active with a creator-only owner', async () => {
  const state = await tree(),
    before = await authority(state.core, 'owner');
  const replacement = delegated([
    { actor: 'exectwo', permission: 'active', weight: 1 },
    { actor: state.core, permission: 'eosio.code', weight: 1 },
  ]);
  await inline(state.core, state.core, 'active', 'updateauth', {
    account: state.core,
    permission: 'active',
    parent: 'owner',
    auth: replacement,
  });
  expect(await authority(state.core, 'owner')).toEqual(before);
  await fixture().push([abiChange(state.core)], [fixture().key('exectwo')]);
});
it.each([0, 1])(
  'rejects code-only active synchronization at weight %i under a threshold of two',
  async (weight) => {
    const state = await tree(weight),
      before = await authority(state.core, 'active');
    await expect(
      inline(state.core, state.core, 'active', 'updateauth', {
        account: state.core,
        permission: 'active',
        parent: 'owner',
        auth: state.active,
      }),
    ).rejects.toThrow('NATIVE_AUTH_REJECTED');
    expect(await authority(state.core, 'active')).toEqual(before);
  },
);
it('rejects runtime code attempting to update creator-only owner', async () => {
  const state = await tree(),
    before = await authority(state.core, 'owner');
  await expect(
    inline(state.core, state.core, 'owner', 'updateauth', {
      account: state.core,
      permission: 'owner',
      parent: '',
      auth: state.active,
    }),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
  expect(await authority(state.core, 'owner')).toEqual(before);
});
it('rejects execctx against default active until the specific action is linked', async () => {
  const state = await tree();
  const invoke = () =>
    inline(state.core, state.core, 'execctx', 'setabi', {
      account: state.core,
      abi: Serializer.encode({ object: probe }),
    });
  await expect(invoke()).rejects.toThrow('NATIVE_AUTH_REJECTED');
  await fixture().push(
    [
      fixture().system(
        'linkauth',
        { account: state.core, code: 'eosio', type: 'setabi', requirement: 'execctx' },
        state.core,
        'owner',
      ),
    ],
    [fixture().key('recovery')],
  );
  await invoke();
});
it('does not let external executive keys impersonate a code-only execctx declaration', async () => {
  const state = await tree();
  await fixture().push(
    [
      fixture().system(
        'linkauth',
        { account: state.core, code: 'eosio', type: 'setabi', requirement: 'execctx' },
        state.core,
        'owner',
      ),
    ],
    [fixture().key('recovery')],
  );
  await expect(fixture().push([abiChange(state.core, 'execctx')], executives())).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
  await fixture().push([abiChange(state.core)], executives());
});
it('allows a scoped service key only after its exact action link exists', async () => {
  const state = await tree(),
    f = fixture();
  const touch = () =>
    f.push(
      [
        f.action(
          state.core,
          'touch',
          { value: 42 },
          [{ actor: state.core, permission: 'service' }],
          probe,
        ),
      ],
      [state.service],
    );
  await expect(touch()).rejects.toThrow('NATIVE_AUTH_REJECTED');
  expect(await marks(state.core)).toEqual([]);
  await f.push(
    [
      f.system(
        'linkauth',
        { account: state.core, code: state.core, type: 'touch', requirement: 'service' },
        state.core,
        'owner',
      ),
    ],
    [f.key('recovery')],
  );
  await touch();
  expect(await marks(state.core)).toEqual(['42']);
});
it.each(['active', 'service'])(
  'rejects service credentials upgrading core with %s authorization',
  async (permission) => {
    const state = await tree();
    await expect(
      fixture().push([abiChange(state.core, permission)], [state.service]),
    ).rejects.toThrow('NATIVE_AUTH_REJECTED');
  },
);
it('rejects a service credential changing core active', async () => {
  const state = await tree();
  await expect(
    fixture().push([update(state, 'active', state.active, 'service')], [state.service]),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
});
it('rejects the managed contract bootstrap key after delegation', async () => {
  const state = await tree();
  await expect(
    fixture().push([abiChange(state.module)], [fixture().key(state.module)]),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
});
it('lets executive quorum upgrade a managed contract through its delegated owner', async () => {
  const state = await tree();
  await lockUpgrade(state);
  await expect(
    fixture().push([abiChange(state.module, 'owner')], [fixture().key('execone')]),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
  await fixture().push([abiChange(state.module, 'owner')], executives());
});
it('blocks own-code upgrades on a managed account once code and ABI are owner-linked', async () => {
  const state = await tree();
  await lockUpgrade(state);
  await expect(
    inline(state.module, state.module, 'active', 'setabi', {
      account: state.module,
      abi: Serializer.encode({ object: probe }),
    }),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
});
it('demonstrates why an unlinked managed upgrade is exposed to its own active code', async () => {
  const state = await tree();
  await inline(state.module, state.module, 'active', 'setabi', {
    account: state.module,
    abi: Serializer.encode({ object: probe }),
  });
  await lockUpgrade(state);
  await expect(
    inline(state.module, state.module, 'active', 'setabi', {
      account: state.module,
      abi: Serializer.encode({ object: probe }),
    }),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
});
it('lets runtime code satisfy delegated managed owner without granting that power to module code', async () => {
  const state = await tree();
  await lockUpgrade(state);
  await inline(state.core, state.module, 'owner', 'setabi', {
    account: state.module,
    abi: Serializer.encode({ object: probe }),
  });
  await expect(
    inline(state.module, state.module, 'owner', 'setabi', {
      account: state.module,
      abi: Serializer.encode({ object: probe }),
    }),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
});
it('does not let unrelated code borrow a runtime eosio.code grant', async () => {
  const state = await tree();
  await expect(
    inline(state.module, state.core, 'active', 'setabi', {
      account: state.core,
      abi: Serializer.encode({ object: probe }),
    }),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
});
it('rolls back a native active update when a later contract action fails', async () => {
  const state = await tree(),
    f = fixture(),
    before = await authority(state.core, 'active');
  const replacement = delegated([{ actor: 'outsider', permission: 'active', weight: 1 }]);
  await expect(
    f.push(
      [
        update(state, 'active', replacement),
        f.action(state.core, 'reject', {}, [{ actor: 'runner', permission: 'active' }], probe),
      ],
      [...executives(), f.key('runner')],
    ),
  ).rejects.toThrow('PROBE_ROLLBACK');
  expect(await authority(state.core, 'active')).toEqual(before);
  await f.push([abiChange(state.core)], executives());
});
it('runs independent owned nodes without sharing peer ports or chain identities', async () => {
  const second = await nativeProcess();
  try {
    expect(second.chainId).not.toBe(fixture().chainId);
    expect(second.url).not.toBe(fixture().url);
  } finally {
    await second.stop();
  }
});

it.each(['linkauth', 'unlinkauth'] as const)(
  'module code cannot weaken owner-linked upgrades using %s',
  async (name) => {
    const state = await tree();
    await lockUpgrade(state);
    const object =
      name === 'linkauth'
        ? { account: state.module, code: 'eosio', type: 'setabi', requirement: 'active' }
        : { account: state.module, code: 'eosio', type: 'setabi' };
    await expect(inline(state.module, state.module, 'active', name, object)).rejects.toThrow(
      'NATIVE_AUTH_REJECTED',
    );
    const owner = (await fixture().api.v1.chain.get_account(state.module)).permissions.find(
      (row) => row.perm_name.toString() === 'owner',
    );
    expect(
      owner?.linked_actions?.some(
        (link) => link.account.toString() === 'eosio' && link.action?.toString() === 'setabi',
      ),
    ).toBe(true);
  },
);
