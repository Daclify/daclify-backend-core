import { expect, it } from 'vitest';
import { APIClient } from '@wharfkit/antelope';
import { z } from 'zod';
import { DecideTableSchemas } from '@daclify/modules/sdk';
import { RuntimeCodeHash } from '../../sdk/index.js';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
it('reads actual native poll markers/index coverage with no resource charge or prune', async () => {
  const api = new APIClient({ url: network.url });
  const scopes = await api.v1.chain.get_table_by_scope({
    code: 'decide',
    table: 'pollends',
    limit: 100,
  });
  if (scopes.more) throw new Error('OWNED_ARCHIVE_FIXTURE_SCOPE_BOUND');
  let runtime: string | undefined;
  for (const row of scopes.rows) {
    const scope = row.scope.toString();
    if (!/^ramobs[a-z1-5]{6}$/.test(scope)) continue;
    const raw = await api.v1.chain.get_raw_abi(scope);
    if (raw.code_hash.toString() !== RuntimeCodeHash) continue;
    const rows = z
      .array(DecideTableSchemas.pollends)
      .parse(
        (
          await api.v1.chain.get_table_rows({
            code: 'decide',
            scope,
            table: 'pollends',
            json: true,
          })
        ).rows,
      );
    if (
      rows.some(
        (value) => value.ballot_id === '1' && value.dao_id === '1' && value.completed_at > 0,
      )
    ) {
      runtime = scope;
      break;
    }
  }
  if (!runtime) throw new Error('RUN_OWNED_RAM_LEDGER_FIXTURE_FIRST');
  const gateway = new NativeChainGateway({
    rpcUrl: network.url,
    chainId: network.chainId,
    runtime,
    hub: null,
    environment: 'local',
    relayActor: 'alice',
    relayKey: fixtureKey('alice'),
    modules: [{ id: 'decide', account: 'decide' }],
  });
  const before = await api.v1.chain.get_account(runtime);
  const result = await gateway.archivePreview({
    dao: { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    ballotIds: ['1'],
    retentionSeconds: 90 * 86400,
  });
  expect(result.pruningAuthorized).toBe(false);
  expect(result.blocked).toEqual([{ parentId: '1', reason: 'retention' }]);
  expect(result.families).toEqual([]);
  const after = await api.v1.chain.get_account(runtime);
  expect(after.ram_usage.toString()).toBe(before.ram_usage.toString());
  expect(after.ram_quota.toString()).toBe(before.ram_quota.toString());
});
