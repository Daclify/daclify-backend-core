import { expect, it } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { APIClient, PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { encodeDecide, DecideTableSchemas, ModuleCodeHashes } from '@daclify/modules/sdk';
import { ModulePermissions } from '@daclify/modules';
import {
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeTableSchemas,
  RuntimeCodeHash,
} from '../../sdk/index.js';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { fundResourceFixture } from '../../tools/native/resource-funding.js';
import { contextPermissionPlan } from '../../tools/deploy/permissions.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const api = new APIClient({ url: network.url });
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
function cleos(args: string[]) {
  try {
    const output = execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--wallet-url',
        'http://127.0.0.1:8900',
        ...args,
        ...(args[0] === 'push' ? ['--force-unique', '-j'] : []),
      ],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (args[0] === 'push') {
      const value: unknown = JSON.parse(output);
      executedChainResult(
        value,
        z.object({ transaction_id: z.string() }).parse(value).transaction_id,
      );
    }
  } catch (cause) {
    const parsed = z
      .object({ stderr: z.string().optional(), stdout: z.string().optional() })
      .safeParse(cause);
    let code = parsed.success
      ? parsed.data.stderr?.match(/assertion failure with message: ([A-Z_]{1,80})/)?.[1]
      : undefined;
    if (!code && parsed.success && parsed.data.stdout) {
      try {
        const body: unknown = JSON.parse(parsed.data.stdout);
        const failure = z
          .object({
            processed: z.object({
              except: z.object({
                stack: z.array(z.object({ data: z.object({ s: z.string().optional() }) })),
              }),
            }),
          })
          .safeParse(body);
        if (failure.success)
          code = failure.data.processed.except.stack
            .map((entry) => entry.data.s)
            .find((value) => value !== undefined && /^[A-Z_]{1,80}$/.test(value));
      } catch {
        // Malformed fixture replies remain redacted rather than exposing raw command output.
      }
    }
    throw new Error('OWNED_ELECTION_ACTION_REJECTED' + (code ? ':' + code : ''));
  }
}
function push(account: string, name: string, fields: unknown[], actor = account) {
  cleos(['push', 'action', account, name, JSON.stringify(fields), '-p', actor + '@active']);
}
async function rows(code: string, scope: string, table: string) {
  const result = await api.v1.chain.get_table_rows({ code, scope, table, json: true, limit: 100 });
  if (result.more) throw new Error('ELECTION_COVERAGE_REQUIRED');
  return result.rows;
}
const now = async () =>
  Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
async function waitUntil(timestamp: number) {
  for (let attempt = 0; (await now()) < timestamp; attempt++) {
    if (attempt >= 320) throw new Error('ELECTION_FIXTURE_CLOCK');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
it.each([false, true])(
  'finalizes eight maximum-title seats at both native payer limits, adopted old election=%s',
  async (legacy) => {
    expect((await api.v1.chain.get_info()).chain_id.toString()).toBe(network.chainId);
    unlockFixtureWallet(network.container);
    await fundResourceFixture();
    const suffix = Array.from(randomBytes(6), (byte) =>
      '12345abcdefghijklmnopqrstuvwxyz'.charAt(byte % 31),
    ).join('');
    const runtime = 'ramctl' + suffix,
      decide = 'rmelec' + suffix,
      keys = Array.from({ length: 8 }, () => PrivateKey.generate('K1'));
    const oldCoreHash = hash('.artifacts/observed-upgrade/runtime.wasm'),
      oldDecideHash = hash('.artifacts/observed-upgrade/decide.wasm');
    expect(oldCoreHash).toBe('5a7d037c3e9557b123edfaedbc1248b9a01f8c27f85c11f99d1e63acd5dd3c1a');
    expect(oldDecideHash).toBe('9f3512f832aafcfed993e1b89681a16df8af50b6a84eecdca156d26e7be67df9');
    expect(hash('.artifacts/contracts/runtime.wasm')).toBe(RuntimeCodeHash);
    expect(hash('.artifacts/controller-modules/decide.wasm')).toBe(ModuleCodeHashes.decide);
    const used = async (account: string) =>
      BigInt((await api.v1.chain.get_account(account)).ram_usage.toString());
    const install = (account: string, directory: string, contract: string) =>
      cleos([
        'set',
        'contract',
        account,
        '/work/' + directory,
        contract + '.wasm',
        contract + '.abi',
        '-p',
        account + '@active',
      ]);
    for (const account of [runtime, decide]) {
      const pub = fixtureKey('alice').toPublic().toString();
      cleos([
        'system',
        'newaccount',
        'alice',
        account,
        pub,
        pub,
        '--buy-ram-bytes',
        '16384',
        '--stake-net',
        '10.0000 TLOS',
        '--stake-cpu',
        '10.0000 TLOS',
      ]);
      push('eosio', 'setacctram', [account, 16777216], 'eosio');
      install(
        account,
        legacy
          ? '.artifacts/observed-upgrade'
          : account === runtime
            ? '.artifacts/contracts'
            : '.artifacts/controller-modules',
        account === runtime ? 'runtime' : 'decide',
      );
      cleos([
        'set',
        'account',
        'permission',
        account,
        'active',
        '--add-code',
        '-p',
        account + '@active',
      ]);
    }
    const permissions = contextPermissionPlan(runtime, [{ id: 'decide', account: decide }]);
    cleos([
      'set',
      'account',
      'permission',
      runtime,
      permissions.permission,
      JSON.stringify(permissions.authority),
      permissions.parent,
      '-p',
      runtime + '@active',
    ]);
    for (const link of permissions.links)
      cleos([
        'set',
        'action',
        'permission',
        runtime,
        link.account,
        link.action,
        permissions.permission,
        '-p',
        runtime + '@active',
      ]);
    push(runtime, 'init', [network.chainId]);
    push(runtime, 'initramobs', []);
    const register = (codeHash: string) => {
      push(runtime, 'setramcode', [decide, codeHash]);
      push(runtime, 'setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', '']);
      push(runtime, 'listmod', [
        decide,
        'alice',
        0,
        1,
        '0.0000 TLOS',
        codeHash,
        'Owned election completion',
      ]);
    };
    register(legacy ? oldDecideHash : ModuleCodeHashes.decide);
    push(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice');
    push(
      runtime,
      'initgov',
      [
        1,
        {
          participant_mode: 0,
          decide,
          guardian: 'alice',
          kind: 0,
          duration: 60,
          quorum: 5000,
          approval: 5001,
          governed_works: false,
          max_commitment: 100000,
          daily_commitment: 300000,
        },
      ],
      'alice',
    );
    for (const [index, key] of keys.entries())
      push(
        runtime,
        'enroll',
        [1, index + 1, '', key.toPublic().toString(), 'owned election credential', 0],
        'alice',
      );
    const enable = (codeHash: string) =>
      push(
        runtime,
        'setmodule',
        [1, decide, 1, ModulePermissions.decide.actions, ModulePermissions.decide.grants, codeHash],
        'alice',
      );
    enable(legacy ? oldDecideHash : ModuleCodeHashes.decide);
    async function act(target: string, action: string, data: Uint8Array, memberId = '1') {
      const member = z
          .array(RuntimeTableSchemas.members)
          .parse(await rows(runtime, '1', 'members'))
          .find((person) => person.id === memberId),
        key = keys[Number(memberId) - 1];
      if (!member || !key) throw new Error('ELECTION_MEMBER_REQUIRED');
      const request = makeInstruction(
        { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
        memberId,
        member.nonce,
        (await now()) + 120,
        target,
        action,
        data,
      );
      push(runtime, 'submit', [request, key.signDigest(instructionDigest(request)).toString()]);
    }
    const actor = (member_id = '1') => ({ runtime, dao_id: '1', member_id });
    await act(
      runtime,
      'putjson',
      encodeAction('putjson', {
        ...actor(),
        document_id: '1',
        version: 1,
        value: '{}',
        envelope_version: 0,
        key_epoch: '0',
      }),
    );
    const start = await now(),
      title = 'Maximum native election '.padEnd(80, 'x');
    await act(
      decide,
      'newelect',
      encodeDecide('newelect', {
        ...actor(),
        election_id: '1',
        title,
        document_id: '1',
        document_version: 1,
        nomination_close: start + 8,
        term_start: start + 180,
        term_end: start + 3600,
        seats: 8,
      }),
    );
    for (let id = 1; id <= 8; id++)
      await act(
        decide,
        'nominate',
        encodeDecide('nominate', { ...actor(String(id)), election_id: '1', active: true }),
        String(id),
      );
    await waitUntil(start + 8);
    await act(decide, 'startelect', encodeDecide('startelect', { ...actor(), election_id: '1' }));
    for (let id = 1; id <= 8; id++)
      await act(
        decide,
        'vote',
        encodeDecide('vote', { ...actor(String(id)), ballot_id: '1', choice: id }),
        String(id),
      );
    const ballot = z
      .array(DecideTableSchemas.ballots)
      .parse(await rows(decide, runtime, 'ballots'))[0];
    if (!ballot) throw new Error('ELECTION_BALLOT_REQUIRED');
    if (legacy) {
      const original = {
        members: await rows(runtime, '1', 'members'),
        elections: await rows(decide, runtime, 'elections'),
        ballots: await rows(decide, runtime, 'ballots'),
      };
      install(runtime, '.artifacts/contracts', 'runtime');
      push(runtime, 'rebindramobs', [oldCoreHash, RuntimeCodeHash]);
      install(decide, '.artifacts/controller-modules', 'decide');
      register(ModuleCodeHashes.decide);
      enable(ModuleCodeHashes.decide);
      await expect(async () => push(decide, 'checkquota', [runtime, 1], runtime)).rejects.toThrow(
        'RAM_ELECTION_HOLD_REQUIRED',
      );
      push(decide, 'scanram', [runtime, 'adoptelect', 1], runtime);
      expect({
        members: await rows(runtime, '1', 'members'),
        elections: await rows(decide, runtime, 'elections'),
        ballots: await rows(decide, runtime, 'ballots'),
      }).toEqual(original);
    }
    push(decide, 'checkquota', [runtime, 1], runtime);
    const holdRows = await rows(decide, runtime, 'termholds');
    expect(holdRows).toHaveLength(1);
    expect(await rows(decide, runtime, 'terms')).toHaveLength(0);
    const counters = async () => {
      const totals = new Map<string, bigint>([
        [runtime, 0n],
        [decide, 0n],
      ]);
      for (const scope of ['0', '1'])
        for (const row of z
          .array(RuntimeTableSchemas.ramstats)
          .parse(await rows(runtime, scope, 'ramstats')))
          totals.set(
            row.payer,
            (totals.get(row.payer) ?? 0n) +
              BigInt(row.identity) +
              BigInt(row.activity) +
              BigInt(row.retained) +
              BigInt(row.platform),
          );
      const observer = z
        .array(RuntimeTableSchemas.ramobs)
        .parse(await rows(runtime, runtime, 'ramobs'))[0];
      if (!observer) throw new Error('ELECTION_OBSERVER_REQUIRED');
      totals.set(runtime, (totals.get(runtime) ?? 0n) + BigInt(observer.meter_bytes));
      return totals;
    };
    if (legacy) {
      const beforeRetry = await counters();
      push(decide, 'scanram', [runtime, 'adoptelect', 1], runtime);
      expect(await counters()).toEqual(beforeRetry);
      expect(await rows(decide, runtime, 'termholds')).toEqual(holdRows);
    }
    await waitUntil(ballot.closes);
    const beforeNative = new Map(
        await Promise.all(
          [runtime, decide].map(async (account) => [account, await used(account)] as const),
        ),
      ),
      beforeCounters = await counters();
    try {
      for (const [account, bytes] of beforeNative)
        push('eosio', 'setacctram', [account, Number(bytes)], 'eosio');
      for (const [account, bytes] of beforeNative) expect(await used(account)).toBe(bytes);
      push(decide, 'finalize', [runtime, 1, 1], 'relay');
      const terms = z.array(DecideTableSchemas.terms).parse(await rows(decide, runtime, 'terms'));
      expect(terms).toHaveLength(8);
      expect(terms.map((term) => term.member_id).sort()).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
      ]);
      for (const term of terms)
        expect(term).toMatchObject({ dao_id: '1', election_id: '1', title, recalled: false });
      expect(await rows(decide, runtime, 'termholds')).toHaveLength(0);
      expect(
        z.array(DecideTableSchemas.ballots).parse(await rows(decide, runtime, 'ballots'))[0],
      ).toMatchObject({ status: 1 });
      const afterCounters = await counters(),
        nativeDelta: Record<string, string> = {};
      for (const [account, bytes] of beforeNative) {
        const after = await used(account);
        expect(after).toBeLessThanOrEqual(bytes);
        nativeDelta[account] = (after - bytes).toString();
        expect(after - bytes).toBe(
          (afterCounters.get(account) ?? 0n) - (beforeCounters.get(account) ?? 0n),
        );
      }
      const after = {
        terms: await rows(decide, runtime, 'terms'),
        members: await rows(runtime, '1', 'members'),
        native: await Promise.all([runtime, decide].map(used)),
      };
      await expect(async () => push(decide, 'finalize', [runtime, 1, 1], 'relay')).rejects.toThrow(
        'BALLOT_FINALIZED',
      );
      expect({
        terms: await rows(decide, runtime, 'terms'),
        members: await rows(runtime, '1', 'members'),
        native: await Promise.all([runtime, decide].map(used)),
      }).toEqual(after);
      writeFileSync(
        '.artifacts/native-election-completion' + (legacy ? '-legacy' : '') + '.json',
        JSON.stringify(
          {
            fixture: network,
            legacy,
            runtime,
            decide,
            oldCoreHash,
            oldDecideHash,
            runtimeCodeHash: RuntimeCodeHash,
            decideCodeHash: ModuleCodeHashes.decide,
            seats: 8,
            titleBytes: 80,
            nativeDelta,
            exactBothPhysicalQuotas: true,
            adoptionPreservesOriginalState: legacy,
            qualifiedPublicDeployment: false,
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      for (const account of [runtime, decide])
        push('eosio', 'setacctram', [account, 16777216], 'eosio');
    }
  },
  120000,
);
