import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrivateKey } from '@wharfkit/antelope';
import { afterEach, describe, expect, it } from 'vitest';
import { creationActions, decodeSystem, encodeSystem } from '../tools/deploy/actions.js';
import { loadEnvironment, parseEnvironment } from '../tools/deploy/environment.js';
import { loadOrCreateActiveKeys } from '../tools/deploy/keys.js';
import { planDeployment, type AccountView } from '../tools/deploy/plan.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('deployment environments', () => {
  it('keeps develop on the fixture and production on the we accounts', async () => {
    const develop = await loadEnvironment('develop');
    const production = await loadEnvironment('production');
    expect(develop.accounts.map((account) => account.name)).toEqual([
      'daclifycore',
      'daclifyhub',
      'decide',
      'works',
      'payroll',
      'relay',
      'fees',
    ]);
    expect(production.accounts.map((account) => account.name)).toEqual([
      'core.we',
      'hub.we',
      'decide.we',
      'works.we',
      'payroll.we',
      'relay.we',
      'fees.we',
    ]);
    expect(production.creatorAccount).toBe('we');
    expect(production.chainId).toBe(
      '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
    );
    expect(develop.resourceModel).toBe('bare');
    expect(production.oracle.premiumBps).toBe(2000);
  });

  it('keeps testnet on ordinary 12-character Telos names and the production resources', async () => {
    const testnet = await loadEnvironment('testnet');
    const production = await loadEnvironment('production');
    expect(testnet.resourceModel).toBe('telos');
    expect(testnet.creatorAccount).toBe('3boidanimus3');
    expect(testnet.chainId).toBe(
      '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
    );
    expect(testnet.rpcUrl).toBe('https://testnet.telos.caleos.io');
    expect(testnet.accounts.map((account) => account.name)).toEqual([
      'daclifycore1',
      'daclifyhubv1',
      'daclifydecid',
      'daclifyworks',
      'daclifypayr1',
      'daclifyrelay',
      'daclifyfees1',
    ]);
    const names = [testnet.creatorAccount, ...testnet.accounts.map((account) => account.name)];
    expect(names.every((name) => /^[a-z1-5]{12}$/.test(name))).toBe(true);
    const resources = (
      accounts: typeof testnet.accounts,
    ): Omit<(typeof testnet.accounts)[number], 'name'>[] =>
      accounts.map((account) => ({
        ramBytes: account.ramBytes,
        cpuStake: account.cpuStake,
        netStake: account.netStake,
        contract: account.contract,
        inlineCode: account.inlineCode,
      }));
    expect(resources(testnet.accounts)).toEqual(resources(production.accounts));
    expect(testnet.oracle).toMatchObject({
      contract: 'delphioracle',
      pair: 'tlosusd',
      maxAgeSeconds: 900,
      premiumBps: 2000,
    });
  });

  it('rejects a premium name in the testnet profile', () => {
    const text = readFileSync(
      new URL('../tools/deploy/environments/testnet.json', import.meta.url),
      'utf8',
    );
    expect(() => parseEnvironment(JSON.parse(text.replace('"3boidanimus3"', '"we"')))).toThrow(
      'DEPLOY_ENVIRONMENT_INVALID',
    );
    expect(() => parseEnvironment(JSON.parse(text.replace('"daclifycore1"', '"core.we"')))).toThrow(
      'DEPLOY_ENVIRONMENT_INVALID',
    );
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || !('accounts' in parsed)) {
      throw new Error('testnet profile');
    }
    const accounts = parsed.accounts;
    if (!Array.isArray(accounts) || accounts.length < 2) throw new Error('testnet profile');
    const first = accounts[0];
    const second = accounts[1];
    if (
      typeof first !== 'object' ||
      first === null ||
      typeof second !== 'object' ||
      second === null ||
      !('name' in first) ||
      !('name' in second)
    ) {
      throw new Error('testnet profile');
    }
    const duplicated = structuredClone(parsed);
    if (
      typeof duplicated !== 'object' ||
      duplicated === null ||
      !('accounts' in duplicated) ||
      !Array.isArray(duplicated.accounts)
    ) {
      throw new Error('testnet profile');
    }
    const duplicatedFirst = duplicated.accounts[0];
    const duplicatedSecond = duplicated.accounts[1];
    if (
      typeof duplicatedFirst !== 'object' ||
      duplicatedFirst === null ||
      typeof duplicatedSecond !== 'object' ||
      duplicatedSecond === null
    ) {
      throw new Error('testnet profile');
    }
    Object.assign(duplicatedSecond, { name: first.name });
    expect(() => parseEnvironment(duplicated)).toThrow('DEPLOY_ENVIRONMENT_INVALID');
    const reordered = structuredClone(parsed);
    if (
      typeof reordered !== 'object' ||
      reordered === null ||
      !('accounts' in reordered) ||
      !Array.isArray(reordered.accounts)
    ) {
      throw new Error('testnet profile');
    }
    const reorderedAccounts = reordered.accounts;
    const swap = reorderedAccounts[0];
    reorderedAccounts[0] = reorderedAccounts[1];
    reorderedAccounts[1] = swap;
    expect(() => parseEnvironment(reordered)).toThrow('DEPLOY_ENVIRONMENT_INVALID');
  });

  it('plans creation, RAM top-up, and contract install without repeating an installed contract', async () => {
    const production = await loadEnvironment('production');
    const views = new Map<string, AccountView>(
      production.accounts.map((account) => [
        account.name,
        account.name === 'fees.we'
          ? { exists: false, ramQuota: 0, ramUsage: 0, hasCode: false }
          : {
              exists: true,
              ramQuota: account.name === 'core.we' ? 1000 : account.ramBytes,
              ramUsage: 10,
              hasCode: account.contract !== null,
            },
      ]),
    );
    const changes = planDeployment(production, views, true);
    expect(changes.find((change) => change.account === 'fees.we')?.action).toBe('create');
    expect(
      changes.some((change) => change.account === 'fees.we' && change.action === 'set-contract'),
    ).toBe(false);
    expect(changes.find((change) => change.account === 'core.we')).toMatchObject({
      action: 'buyram',
    });
    expect(
      changes.some((change) => change.account === 'decide.we' && change.action === 'set-contract'),
    ).toBe(false);
  });

  it('encodes a Telos account creation and stores active keys outside the plan', async () => {
    const production = await loadEnvironment('production');
    const runtime = production.accounts[0];
    if (!runtime) throw new Error('missing runtime');
    const owner = PrivateKey.generate('K1');
    const active = PrivateKey.generate('K1');
    const actions = creationActions({
      creator: 'we',
      account: runtime.name,
      ownerKey: owner.toPublic().toString(),
      activeKey: active.toPublic().toString(),
      inlineCode: true,
      resourceModel: 'telos',
      ramBytes: runtime.ramBytes,
      cpuStake: runtime.cpuStake,
      netStake: runtime.netStake,
    });
    expect(actions.map((action) => action.name)).toEqual([
      'newaccount',
      'buyrambytes',
      'delegatebw',
    ]);
    const buyram = actions[1];
    if (!buyram) throw new Error('missing buyram');
    const created = decodeSystem('buyrambytes', encodeSystem(buyram.type, buyram.object));
    expect(JSON.parse(JSON.stringify(created))).toEqual({
      payer: 'we',
      receiver: 'core.we',
      bytes: 8388608,
    });
    const directory = mkdtempSync(path.join(tmpdir(), 'daclify-deploy-'));
    directories.push(directory);
    const file = path.join(directory, 'production-keys.json');
    const first = loadOrCreateActiveKeys(production, file);
    const second = loadOrCreateActiveKeys(production, file);
    expect(second.map((row) => row.publicKey)).toEqual(first.map((row) => row.publicKey));
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(file).size).toBeGreaterThan(0);
  });
});
