import { describe, expect, it } from 'vitest';
import { createWindowLimiter } from '../services/api/src/limits.js';
import {
  assessDeployment,
  collectDeployment,
  GET_CODE_HASH_FEATURE,
  resourcesAcceptable,
} from '../services/api/src/deployment-check.js';
import { parseModuleDeployments } from '../services/api/src/deployment-config.js';
import { payrollSettlementAccount } from '../services/api/src/native-chain.js';

const unlimited = { cpuAvailable: -1, netAvailable: -1, ramQuota: -1, ramUsage: 2724 };

describe('sponsored resource limits', () => {
  it('treats a negative chain limit as unlimited and refuses an exhausted account', () => {
    expect(resourcesAcceptable(unlimited)).toBe(true);
    expect(
      resourcesAcceptable({ cpuAvailable: 999, netAvailable: 512, ramQuota: 4096, ramUsage: 1000 }),
    ).toBe(false);
    expect(
      resourcesAcceptable({
        cpuAvailable: 1000,
        netAvailable: 512,
        ramQuota: 4096,
        ramUsage: 3072,
      }),
    ).toBe(true);
  });
  it('stops one account at its window and the process at the global window', () => {
    const admit = createWindowLimiter(2, 1000, 3);
    expect(admit('a', 0)).toBe(true);
    expect(admit('a', 1)).toBe(true);
    expect(admit('a', 2)).toBe(false);
    expect(admit('b', 2)).toBe(true);
    expect(admit('c', 3)).toBe(false);
    expect(admit('a', 2000)).toBe(true);
  });
  it('requires the code-hash feature, the expected chain, and reviewed code with headroom', () => {
    expect(
      assessDeployment({
        chainId: 'ab'.repeat(32),
        expectedChainId: 'ab'.repeat(32),
        featureDigests: [GET_CODE_HASH_FEATURE],
        moreFeatures: false,
        accounts: [
          {
            account: 'payroll',
            actualHash: 'cd'.repeat(32),
            expectedHash: 'cd'.repeat(32),
            resources: unlimited,
          },
        ],
      }).ok,
    ).toBe(true);
    const failed = assessDeployment({
      chainId: 'ab'.repeat(32),
      expectedChainId: '11'.repeat(32),
      featureDigests: [],
      moreFeatures: true,
      accounts: [
        {
          account: 'payroll',
          actualHash: '00'.repeat(32),
          expectedHash: 'cd'.repeat(32),
          resources: { cpuAvailable: 0, netAvailable: 0, ramQuota: 100, ramUsage: 100 },
        },
      ],
    });
    expect(failed.ok).toBe(false);
    expect(failed.failures).toEqual([
      'CHAIN_ID',
      'FEATURE_PAGE',
      'GET_CODE_HASH',
      'CODE_HASH:payroll',
      'RESOURCES:payroll',
    ]);
  });
  it('reads a chain report and fails closed when the feature page is incomplete', async () => {
    const rpc = 'http://127.0.0.1:18888';
    const request: typeof fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body)) as { account_name?: string; limit?: number };
      const path = String(url).slice(rpc.length);
      const payload =
        path === '/v1/chain/get_info'
          ? {
              chain_id: 'ab'.repeat(32),
              head_block_num: 10,
              last_irreversible_block_num: 8,
              server_version_string: 'v1.2.2',
            }
          : path === '/v1/chain/get_activated_protocol_features'
            ? {
                activated_protocol_features: [
                  {
                    feature_digest: GET_CODE_HASH_FEATURE,
                    activation_block_num: 4,
                    specification: [{ name: 'builtin_feature_codename', value: 'GET_CODE_HASH' }],
                  },
                ],
                more: body.limit === 1,
              }
            : path === '/v1/chain/get_code_hash'
              ? { code_hash: 'cd'.repeat(32) }
              : {
                  cpu_limit: { available: -1 },
                  net_limit: { available: -1 },
                  ram_quota: -1,
                  ram_usage: 1,
                };
      return new Response(JSON.stringify(payload), { status: 200 });
    };
    const report = await collectDeployment(
      rpc,
      request,
      [{ account: 'payroll', expectedHash: 'cd'.repeat(32) }],
      'ab'.repeat(32),
    );
    expect(report.ok).toBe(true);
    expect(report.getCodeHash).toMatchObject({ active: true, activationBlockNum: 4 });
    const incomplete = await collectDeployment(
      rpc,
      async (url, init) => {
        const parsed = JSON.parse(String(init?.body)) as { limit?: number };
        const next =
          parsed.limit === undefined ? init : { ...init, body: JSON.stringify({ limit: 1 }) };
        return request(url, next);
      },
      [],
    );
    expect(incomplete.ok).toBe(false);
    expect(incomplete.failures).toContain('FEATURE_PAGE');
  });
  it('parses explicit module deployments and rejects a duplicate or malformed list', () => {
    expect(
      parseModuleDeployments(
        '[{"id":"payroll","account":"payroll"},{"id":"works","account":"works"}]',
      ),
    ).toEqual([
      { id: 'payroll', account: 'payroll' },
      { id: 'works', account: 'works' },
    ]);
    expect(() => parseModuleDeployments('{"id":"payroll"}')).toThrow('MODULE_DEPLOYMENTS_INVALID');
    expect(() =>
      parseModuleDeployments(
        '[{"id":"payroll","account":"payroll"},{"id":"payroll","account":"otherpayroll"}]',
      ),
    ).toThrow('MODULE_DEPLOYMENTS_INVALID');
  });
  it('sends payroll settlement to the payroll contract and leaves other sources on the treasury', () => {
    const modules = [
      { id: 'payroll' as const, account: 'payroll' },
      { id: 'works' as const, account: 'works' },
    ];
    expect(payrollSettlementAccount(modules, 'payroll')).toBe('payroll');
    expect(payrollSettlementAccount(modules, 'works')).toBeUndefined();
    expect(payrollSettlementAccount(undefined, 'payroll')).toBeUndefined();
  });
});
