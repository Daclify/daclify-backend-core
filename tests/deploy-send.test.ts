import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { deploymentSend } from '../tools/deploy/send.js';

describe('deployment send gate', () => {
  it('sends develop and testnet only with --commit, and production only with --confirm', () => {
    expect(deploymentSend('develop', { commit: false, confirm: false })).toBe(false);
    expect(deploymentSend('develop', { commit: true, confirm: false })).toBe(true);
    expect(deploymentSend('testnet', { commit: false, confirm: false })).toBe(false);
    expect(deploymentSend('testnet', { commit: true, confirm: false })).toBe(true);
    expect(deploymentSend('production', { commit: false, confirm: true })).toBe(true);
    expect(deploymentSend('production', { commit: false, confirm: false })).toBe(false);
  });

  it('refuses to treat testnet or develop as a production confirmation', () => {
    expect(() => deploymentSend('testnet', { commit: false, confirm: true })).toThrow(
      'CONFIRM_IS_PRODUCTION_ONLY',
    );
    expect(() => deploymentSend('develop', { commit: true, confirm: true })).toThrow(
      'CONFIRM_IS_PRODUCTION_ONLY',
    );
    expect(() => deploymentSend('production', { commit: true, confirm: false })).toThrow(
      'PRODUCTION_REQUIRES_CONFIRM',
    );
    expect(() => deploymentSend('production', { commit: true, confirm: true })).toThrow(
      'PRODUCTION_REQUIRES_CONFIRM',
    );
    expect(() => deploymentSend('develop', { commit: false, confirm: true })).toThrow(
      'CONFIRM_IS_PRODUCTION_ONLY',
    );
    expect(() => deploymentSend('testnet', { commit: true, confirm: true })).toThrow(
      'CONFIRM_IS_PRODUCTION_ONLY',
    );
  });

  it('rejects a price argument that is not an environment name or a positive cent amount', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'tools/deploy/price.ts', 'nope'],
      { encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain('PRICE_ARGUMENT');
  });
});
