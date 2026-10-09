import { beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { APIClient } from '@wharfkit/antelope';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { fundResourceFixture } from '../../tools/native/resource-funding.js';
import { TelosTokenSources } from '../../tools/qualification/telos-token-snapshot.js';
import { contextPermissionPlan } from '../../tools/deploy/permissions.js';
import {
  RuntimeTableSchemas,
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeCodeHash,
} from '../../sdk/index.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
describe.each([
  {
    name: 'reference',
    directory: '.artifacts/reference-token',
    file: 'reference',
    codeHash: 'ea1bd149e28f21420450b6c7b2c5be600ef9922e44c383fa4489b025aac0eb46',
  },
  {
    name: 'deployed Telos',
    directory: '.artifacts/public-telos-token/mainnet',
    file: 'token',
    codeHash: TelosTokenSources[0].codeHash,
  },
])('$name token', (fixture) => {
  const suffix = Array.from(randomBytes(6), (byte) =>
      '12345abcdefghijklmnopqrstuvwxyz'.charAt(byte % 31),
    ).join(''),
    token = 'rmtokn' + suffix,
    sender = 'rmpayr' + suffix,
    receiver = 'rmrcvr' + suffix,
    opened = 'rmopen' + suffix;
  function cleos(args: string[]) {
    try {
      const text = execFileSync(
        'docker',
        [
          'exec',
          network.container,
          'cleos',
          '--wallet-url',
          'http://127.0.0.1:8900',
          ...args,
          ...(args[0] === 'push' ? ['-j', '--force-unique'] : []),
        ],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      if (args[0] === 'push') {
        const data: unknown = JSON.parse(text);
        executedChainResult(
          data,
          z.object({ transaction_id: z.string() }).parse(data).transaction_id,
        );
      }
    } catch (error) {
      const detail = z.object({ stderr: z.string().optional() }).safeParse(error);
      const code = detail.success
        ? detail.data.stderr?.match(/assertion failure with message: ([A-Z_]{1,80})/)?.[1]
        : undefined;
      if (code) throw new Error('OWNED_TOKEN_PROBE_REJECTED:' + code);
      const output = z.object({ stdout: z.string().optional() }).safeParse(error);
      if (output.success && output.data.stdout) {
        const value: unknown = JSON.parse(output.data.stdout);
        const failure = z
          .object({
            processed: z.object({
              except: z.object({
                name: z.string(),
                message: z.string().optional(),
                stack: z
                  .array(z.object({ data: z.object({ s: z.string().optional() }) }))
                  .optional(),
              }),
            }),
          })
          .safeParse(value);
        if (failure.success) {
          const exception = failure.data.processed.except;
          const reason =
            [exception.message, ...(exception.stack?.map((entry) => entry.data.s) ?? [])].find(
              (value) => value !== undefined && /^[A-Z_]{1,80}$/.test(value),
            ) ?? exception.message?.match(/assertion failure with message: ([A-Z_]{1,80})/)?.[1];
          throw new Error('OWNED_TOKEN_PROBE_REJECTED: ' + (reason ?? exception.name));
        }
      }
      throw new Error('OWNED_TOKEN_PROBE_REJECTED');
    }
  }
  function action(name: string, data: object, actor: string) {
    cleos(['push', 'action', token, name, JSON.stringify(data), '-p', actor + '@active']);
  }
  async function used(account: string) {
    const response = await fetch(network.url + '/v1/chain/get_account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_name: account }),
    });
    if (!response.ok) throw new Error('OWNED_TOKEN_PROBE_QUERY');
    return z
      .object({ ram_usage: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
      .parse(await response.json()).ram_usage;
  }
  async function balancePayer(owner: string) {
    const response = await fetch(network.url + '/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: token,
        scope: owner,
        table: 'accounts',
        json: true,
        show_payer: true,
      }),
    });
    if (!response.ok) throw new Error('OWNED_TOKEN_PROBE_QUERY');
    return z
      .object({
        rows: z.tuple([z.object({ data: z.object({ balance: z.string() }), payer: z.string() })]),
        more: z.literal(false),
      })
      .parse(await response.json()).rows[0].payer;
  }
  let sourceCommit = '';
  beforeAll(async () => {
    const infoResponse = await fetch(network.url + '/v1/chain/get_info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(z.object({ chain_id: z.string() }).parse(await infoResponse.json()).chain_id).toBe(
      network.chainId,
    );
    if (
      createHash('sha256')
        .update(readFileSync(fixture.directory + '/' + fixture.file + '.wasm'))
        .digest('hex') !== fixture.codeHash
    )
      throw new Error('TOKEN_FIXTURE_CODE_PIN');
    if (fixture.name === 'reference') {
      sourceCommit = z
        .object({ commit: z.literal('c526479a48370981a1e9f0ac6b3bb0e4f737afa2') })
        .parse(
          JSON.parse(readFileSync('.artifacts/reference-token/source-pins.json', 'utf8')),
        ).commit;
    } else
      for (const pin of TelosTokenSources) {
        const path = '.artifacts/public-telos-token/' + pin.environment;
        z.object({
          environment: z.literal(pin.environment),
          source: z.literal(pin.source),
          chainId: z.literal(pin.chainId),
          codeHash: z.literal(pin.codeHash),
          rawAbiHash: z.literal(pin.rawAbiHash),
        }).parse(JSON.parse(readFileSync(path + '/provenance.json', 'utf8')));
        if (
          createHash('sha256')
            .update(readFileSync(path + '/token.wasm'))
            .digest('hex') !== pin.codeHash ||
          createHash('sha256')
            .update(readFileSync(path + '/token.raw.abi'))
            .digest('hex') !== pin.rawAbiHash
        )
          throw new Error('TOKEN_FIXTURE_CODE_PIN');
      }
    unlockFixtureWallet(network.container);
    await fundResourceFixture();
    for (const account of [token, sender, receiver, opened]) {
      cleos([
        'system',
        'newaccount',
        'alice',
        account,
        fixtureKey('alice').toPublic().toString(),
        fixtureKey('alice').toPublic().toString(),
        '--buy-ram-bytes',
        '16384',
        '--stake-net',
        '10.0000 TLOS',
        '--stake-cpu',
        '10.0000 TLOS',
      ]);
      // Finite managed quotas isolate token billing without exhausting the owned RAM-market budget.
      cleos([
        'push',
        'action',
        'eosio',
        'setacctram',
        JSON.stringify([account, 1048576]),
        '-p',
        'eosio@active',
      ]);
    }
    cleos([
      'set',
      'contract',
      token,
      '/work/' + fixture.directory,
      fixture.file + '.wasm',
      fixture.file + '.abi',
      '-p',
      token + '@active',
    ]);
    if (fixture.name !== 'reference') {
      // JSON ABI decoding/repacking changes optional extensions; retain the deployed raw bytes.
      cleos([
        'push',
        'action',
        'eosio',
        'setabi',
        JSON.stringify([token, readFileSync(fixture.directory + '/token.raw.abi').toString('hex')]),
        '-p',
        token + '@active',
      ]);
      const api = new APIClient({ url: network.url });
      expect((await api.v1.chain.get_raw_abi(token)).abi_hash.toString()).toBe(
        TelosTokenSources[0].rawAbiHash,
      );
      expect((await api.v1.chain.get_code(token)).code_hash.toString()).toBe(fixture.codeHash);
    }
    action('create', { issuer: 'alice', maximum_supply: '1000000.0000 RAMT' }, token);
    action('issue', { to: 'alice', quantity: '100.0000 RAMT', memo: 'owned calibration' }, 'alice');
    action(
      'transfer',
      { from: 'alice', to: sender, quantity: '10.0000 RAMT', memo: 'owned calibration' },
      'alice',
    );
  }, 60000);
  it('measures sender-paid first balances, existing source payer transfer, recipient reopening and preopened payouts on the pinned token binary', async () => {
    const accounts = [sender, receiver, opened, token],
      snapshot = async () =>
        Object.fromEntries(
          await Promise.all(accounts.map(async (account) => [account, await used(account)])),
        ),
      before = await snapshot();
    action(
      'transfer',
      { from: sender, to: receiver, quantity: '1.0000 RAMT', memo: 'first receiver' },
      sender,
    );
    const first = await snapshot();
    // 128 existing-source row bytes change payer; 128 new balance + 112 scope header are sender paid.
    expect((first[sender] ?? 0) - (before[sender] ?? 0)).toBe(368);
    expect(first[receiver]).toBe(before[receiver]);
    action(
      'transfer',
      { from: sender, to: receiver, quantity: '1.0000 RAMT', memo: 'existing receiver' },
      sender,
    );
    const second = await snapshot();
    expect(second).toEqual(first);
    action(
      'transfer',
      { from: receiver, to: sender, quantity: '2.0000 RAMT', memo: 'return before closing' },
      receiver,
    );
    const returned = await snapshot();
    expect((returned[sender] ?? 0) - (second[sender] ?? 0)).toBe(-128);
    expect((returned[receiver] ?? 0) - (second[receiver] ?? 0)).toBe(128);
    action('close', { owner: receiver, symbol: '4,RAMT' }, receiver);
    const closed = await snapshot();
    expect((closed[sender] ?? 0) - (returned[sender] ?? 0)).toBe(-112);
    expect((closed[receiver] ?? 0) - (returned[receiver] ?? 0)).toBe(-128);
    action('open', { owner: opened, symbol: '4,RAMT', ram_payer: opened }, opened);
    const preopened = await snapshot();
    action(
      'transfer',
      { from: sender, to: opened, quantity: '1.0000 RAMT', memo: 'receiver-funded row' },
      sender,
    );
    expect(await snapshot()).toEqual(preopened);
    writeFileSync(
      fixture.name === 'reference'
        ? '.artifacts/native-token-ram.json'
        : '.artifacts/native-telos-token-ram.json',
      JSON.stringify(
        {
          ...(fixture.name === 'reference'
            ? { sourceCommit }
            : { publicSources: TelosTokenSources }),
          codeHash: createHash('sha256')
            .update(readFileSync(fixture.directory + '/' + fixture.file + '.wasm'))
            .digest('hex'),
          token,
          sender,
          receiver,
          opened,
          before,
          first,
          second,
          returned,
          closed,
          preopened,
          firstSenderDeltaBytes: 368,
          limits: [
            fixture.name === 'reference'
              ? 'Owned native fixture and pinned official reference token.'
              : 'Pinned deployed Telos token bytes on owned Spring; not public-chain execution.',
            'Direct token actions calibrate external payer behavior; integrated Daclify exits are tested separately.',
            'Receiver transfer/close can move or release sender-paid bytes outside Daclify callbacks.',
          ],
        },
        null,
        2,
      ) + '\n',
    );
  }, 60000);

  it.each([false, true])(
    'preserves unprepared payments and reconciles full-quota exits, legacy sender=%s',
    async (legacy) => {
      const paymentSuffix = Array.from(randomBytes(6), (byte) =>
        '12345abcdefghijklmnopqrstuvwxyz'.charAt(byte % 31),
      ).join('');
      const runtime = 'rmcore' + paymentSuffix,
        receiver = 'rmrcvr' + paymentSuffix;
      for (const [account, bytes] of [
        [runtime, '16777216'],
        [receiver, '262144'],
      ] as const) {
        cleos([
          'system',
          'newaccount',
          'alice',
          account,
          fixtureKey('alice').toPublic().toString(),
          fixtureKey('alice').toPublic().toString(),
          '--buy-ram-bytes',
          '16384',
          '--stake-net',
          '10.0000 TLOS',
          '--stake-cpu',
          '10.0000 TLOS',
        ]);
        cleos([
          'push',
          'action',
          'eosio',
          'setacctram',
          JSON.stringify([account, Number(bytes)]),
          '-p',
          'eosio@active',
        ]);
      }
      for (const [account, contract] of [
        [runtime, 'runtime'],
        [sender, 'modrelay'],
      ] as const) {
        cleos([
          'set',
          'contract',
          account,
          '/work/.artifacts/contracts',
          contract + '.wasm',
          contract + '.abi',
          '-p',
          account + '@active',
        ]);
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
      const permission = contextPermissionPlan(runtime, []);
      cleos([
        'set',
        'account',
        'permission',
        runtime,
        permission.permission,
        JSON.stringify(permission.authority),
        permission.parent,
        '-p',
        runtime + '@active',
      ]);
      for (const action of ['withdraw', 'unstake'])
        cleos([
          'set',
          'action',
          'permission',
          runtime,
          runtime,
          action,
          permission.permission,
          '-p',
          runtime + '@active',
        ]);
      const core = (name: string, data: unknown[], actor: string | string[] = runtime) =>
        cleos([
          'push',
          'action',
          runtime,
          name,
          JSON.stringify(data),
          ...(Array.isArray(actor) ? actor : [actor]).flatMap((account) => [
            '-p',
            account + '@active',
          ]),
        ]);
      const source = (name: string, data: unknown[]) =>
        cleos(['push', 'action', sender, name, JSON.stringify(data), '-p', sender + '@active']);
      const sourceHash = createHash('sha256')
        .update(readFileSync('.artifacts/contracts/modrelay.wasm'))
        .digest('hex');
      core('init', [network.chainId]);
      core('initramobs', []);
      core('setramcode', [sender, sourceHash]);
      core('setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', '']);
      core('listmod', [
        sender,
        'alice',
        0,
        1,
        '0.0000 TLOS',
        sourceHash,
        'Owned receipt calibration',
      ]);
      core('createdao', [1, 'alice', '{}', 0, token, '4,RAMT'], 'alice');
      core(
        'enroll',
        [1, 1, '', fixtureKey('alice').toPublic().toString(), 'owned receipt calibration', 0],
        'alice',
      );
      core('setmodule', [1, sender, 1, [], ['reserve', 'approve'], sourceHash], 'alice');
      core(
        'enroll',
        [1, 2, sender, fixtureKey('bob').toPublic().toString(), 'owned native stake', 0],
        ['alice', sender],
      );
      core(
        'enroll',
        [1, 3, receiver, fixtureKey('relay').toPublic().toString(), 'owned native payment', 0],
        ['alice', receiver],
      );
      if (!legacy)
        action('open', { owner: runtime, symbol: '4,RAMT', ram_payer: runtime }, runtime);
      action(
        'transfer',
        { from: 'alice', to: runtime, quantity: '2.0000 RAMT', memo: 'dao:1' },
        'alice',
      );
      if (legacy) action('open', { owner: runtime, symbol: '4,RAMT', ram_payer: runtime }, runtime);
      expect(await balancePayer(runtime)).toBe(legacy ? 'alice' : runtime);
      source('reserve', [runtime, 1, 1, 1, '1.0000 RAMT', 0]);
      source('approveob', [runtime, 1, 1]);
      source('reserve', [runtime, 1, 2, 3, '1.0000 RAMT', 0]);
      source('approveob', [runtime, 1, 2]);
      action(
        'transfer',
        { from: sender, to: runtime, quantity: '1.0000 RAMT', memo: 'stake:1:2' },
        sender,
      );
      const accepted = await used(runtime);
      core('payob', [1, sender, 1], 'alice');
      const claimed = await used(runtime);
      expect(claimed).toBeLessThan(accepted);
      let withdrawn: number, physicalBeforeWithdrawal: number, accountedExitDelta: bigint;
      try {
        cleos([
          'push',
          'action',
          'eosio',
          'setacctram',
          JSON.stringify([runtime, claimed + 1024]),
          '-p',
          'eosio@active',
        ]);
        physicalBeforeWithdrawal = await used(runtime);
        cleos([
          'push',
          'action',
          'eosio',
          'setacctram',
          JSON.stringify([runtime, physicalBeforeWithdrawal]),
          '-p',
          'eosio@active',
        ]);
        expect(await used(runtime)).toBe(physicalBeforeWithdrawal);
        const api = new APIClient({ url: network.url });
        const rows = async (table: string, scope = '1') => {
          const result = await api.v1.chain.get_table_rows({
            code: runtime,
            scope,
            table,
            json: true,
            limit: 100,
          });
          if (result.more) throw new Error('TOKEN_PROBE_COVERAGE_REQUIRED');
          return result.rows;
        };
        const member = async (id = '1') => {
          const person = z
            .array(RuntimeTableSchemas.members)
            .parse(await rows('members'))
            .find((person) => person.id === id);
          if (!person) throw new Error('TOKEN_PROBE_MEMBER_REQUIRED');
          return person;
        };
        const state = async () => ({
          members: await rows('members'),
          obligations: await rows('obligations'),
          daos: await rows('daos', runtime),
          holds: await rows('ramholds'),
          receipts: await rows('receipts'),
          stats: await rows('ramstats'),
          usage: await used(runtime),
        });
        const accounted = async () => {
          let total = 0n;
          for (const scope of ['0', '1'])
            for (const row of z
              .array(RuntimeTableSchemas.ramstats)
              .parse(await rows('ramstats', scope)))
              if (row.payer === runtime)
                total +=
                  BigInt(row.identity) +
                  BigInt(row.activity) +
                  BigInt(row.retained) +
                  BigInt(row.platform);
          const observer = z
            .array(RuntimeTableSchemas.ramobs)
            .parse(await rows('ramobs', runtime))[0];
          if (!observer) throw new Error('TOKEN_PROBE_OBSERVER_REQUIRED');
          return total + BigInt(observer.meter_bytes);
        };
        const exit = async (kind: 'withdraw' | 'unstake', id: string, quantity: string) => {
          const person = await member(id),
            info = await api.v1.chain.get_info();
          const request = makeInstruction(
            { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
            id,
            person.nonce,
            Math.floor(info.head_block_time.toMilliseconds() / 1000) + 120,
            runtime,
            kind,
            encodeAction(kind, {
              runtime,
              dao_id: '1',
              member_id: id,
              destination: receiver,
              quantity,
            }),
          );
          core('submit', [
            request,
            fixtureKey(id === '2' ? 'bob' : 'alice')
              .signDigest(instructionDigest(request))
              .toString(),
          ]);
        };
        const beforeFailure = await state();
        await expect(exit('withdraw', '1', '1.0000 RAMT')).rejects.toThrow(
          'PAYOUT_TOKEN_ROW_REQUIRED',
        );
        await expect(exit('unstake', '2', '1.0000 RAMT')).rejects.toThrow(
          'PAYOUT_TOKEN_ROW_REQUIRED',
        );
        expect(() => core('payob', [1, sender, 2], 'alice')).toThrow('PAYOUT_TOKEN_ROW_REQUIRED');
        expect(await state()).toEqual(beforeFailure);
        const receiverBeforeOpen = await used(receiver);
        action('open', { owner: receiver, symbol: '4,RAMT', ram_payer: receiver }, receiver);
        expect((await used(receiver)) - receiverBeforeOpen).toBe(240);
        expect(await used(runtime)).toBe(physicalBeforeWithdrawal);
        action('close', { owner: receiver, symbol: '4,RAMT' }, receiver);
        await expect(exit('withdraw', '1', '1.0000 RAMT')).rejects.toThrow(
          'PAYOUT_TOKEN_ROW_REQUIRED',
        );
        await expect(exit('unstake', '2', '1.0000 RAMT')).rejects.toThrow(
          'PAYOUT_TOKEN_ROW_REQUIRED',
        );
        expect(() => core('payob', [1, sender, 2], 'alice')).toThrow('PAYOUT_TOKEN_ROW_REQUIRED');
        expect(await state()).toEqual(beforeFailure);
        action('open', { owner: receiver, symbol: '4,RAMT', ram_payer: receiver }, receiver);
        const receiverAtWithdrawal = await used(receiver),
          tokenAtWithdrawal = await used(token);
        const accountedBefore = await accounted();
        await expect(exit('withdraw', '1', '0.2500 RAMT')).rejects.toThrow('ram_usage_exceeded');
        expect(await used(runtime)).toBe(physicalBeforeWithdrawal);
        expect(await state()).toEqual(beforeFailure);
        await exit('withdraw', '1', '1.0000 RAMT');
        withdrawn = await used(runtime);
        accountedExitDelta = (await accounted()) - accountedBefore;
        expect(withdrawn).toBeLessThan(claimed);
        expect(BigInt(withdrawn - physicalBeforeWithdrawal)).toBe(
          accountedExitDelta + (legacy ? 128n : 0n),
        );
        expect(await balancePayer(runtime)).toBe(runtime);
        expect(await used(receiver)).toBe(receiverAtWithdrawal);
        expect(await used(token)).toBe(tokenAtWithdrawal);
        expect(await member()).toMatchObject({ claim: '0', nonce: '1' });
        const afterClaim = await used(runtime),
          afterClaimAccounted = await accounted();
        await exit('unstake', '2', '1.0000 RAMT');
        expect(await member('2')).toMatchObject({ stake: '0', nonce: '1' });
        expect(await used(runtime)).toBe(afterClaim);
        core('payob', [1, sender, 2], 'alice');
        expect(
          z
            .array(RuntimeTableSchemas.obligations)
            .parse(await rows('obligations'))
            .find((row) => row.id === '2')?.status,
        ).toBe(2);
        expect(() => core('payob', [1, sender, 2], 'alice')).toThrow('NOT_PAYABLE');
        expect(BigInt((await used(runtime)) - afterClaim)).toBe(
          (await accounted()) - afterClaimAccounted,
        );
        expect(await used(receiver)).toBe(receiverAtWithdrawal);
        expect(await used(token)).toBe(tokenAtWithdrawal);
      } finally {
        cleos([
          'push',
          'action',
          'eosio',
          'setacctram',
          JSON.stringify([runtime, 16777216]),
          '-p',
          'eosio@active',
        ]);
      }
      writeFileSync(
        '.artifacts/native-' +
          (fixture.name === 'reference' ? 'reference' : 'telos') +
          (legacy ? '-legacy' : '') +
          '-claim.json',
        JSON.stringify(
          {
            runtime,
            token,
            source: fixture.name,
            legacySender: legacy,
            senderPayerChangeBytes: legacy ? 128 : 0,
            accountedExitDeltaBytes: accountedExitDelta.toString(),
            receiver,
            runtimeCodeHash: RuntimeCodeHash,
            tokenCodeHash: createHash('sha256')
              .update(readFileSync(fixture.directory + '/' + fixture.file + '.wasm'))
              .digest('hex'),
            acceptedBytes: accepted,
            claimBytes: claimed,
            withdrawnBytes: withdrawn,
            settlementDeltaBytes: claimed - accepted,
            fullClaimDeltaBytes: withdrawn - physicalBeforeWithdrawal,
            physicalQuotaAtWithdrawalBytes: physicalBeforeWithdrawal,
            managedQuotaControlBytes: physicalBeforeWithdrawal - claimed,
            partialWithdrawalRejectedAtPhysicalQuota: true,
            missingAndClosedReceiverPreservesState: true,
            receiverFundedPreparationBytes: 240,
            recipientAndTokenRamUnchangedAtPayout: true,
            nativeExitReconcilesCountersAndExternalPayerChange: true,
            stakeAndDirectObligationMissingRowRollback: true,
            signedStakeExitAndOnceOnlyNativePayment: true,
            limitations: [
              fixture.name === 'reference'
                ? 'Pinned official reference token only.'
                : 'Pinned deployed Telos binary on owned Spring; public transactions and arbitrary tokens remain unqualified.',
              'Owned accounts use finite managed quotas for billing/exhaustion; this does not qualify RAM purchases, which reject managed accounts.',
              legacy
                ? 'A pre-existing donor-funded row shifts 128 bytes to runtime; reconcile this as operator overhead, never a historical DAO invoice.'
                : 'The runtime row is opened by the operator before funding; no sender payer change occurs.',
              'This new observed claim does not qualify every historical token/module lifecycle or public deployment.',
            ],
          },
          null,
          2,
        ) + '\n',
      );
    },
    60000,
  );
});
