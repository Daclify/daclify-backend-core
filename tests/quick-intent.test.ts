import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey, Bytes } from '@wharfkit/antelope';
import { QuickBallotRoutes } from '@daclify/modules';
import { encodeQuickBallot } from '@daclify/modules/sdk';
import { QuickBallotArchiveInputSchema } from '@daclify/modules/archive';
import { NativeQuickBallots } from '../services/api/src/quick-ballots/chain.js';
import {
  quickAccountIdentity,
  quickAccountRequest,
  encodeQuickAnchor,
  QuickAuthCodeHash,
} from '../sdk/quick-accounts.js';
import { QuickAccountPreparedSchema } from '../protocol/quick-accounts.js';
afterEach(() => vi.restoreAllMocks());
function fixture() {
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL('./fixtures/quick-ballots/archive-snapshot.json', import.meta.url),
      'utf8',
    ),
  );
  const snapshot = QuickBallotArchiveInputSchema.omit({ kind: true, rows: true })
    .passthrough()
    .parse(raw);
  const key = PrivateKey.generate('K1'),
    anchor = { kind: 'key' as const, publicKey: key.toPublic().toString() };
  const context = {
    chainId: snapshot.dao.chainId,
    runtime: snapshot.dao.contract,
    source: snapshot.source.account,
    authority: 'quickauth',
    authorityCodeHash: QuickAuthCodeHash,
    sourceCodeHash: snapshot.source.codeHash,
    gateway: { actor: 'gateway', permission: 'active' },
    anchor,
    identity: quickAccountIdentity(snapshot.dao.chainId, snapshot.dao.contract, anchor),
    frozen: true,
    record: {
      id: '1',
      identity: quickAccountIdentity(snapshot.dao.chainId, snapshot.dao.contract, anchor),
      approval: { kind: 3, credential: '' },
      epoch: '1',
      nonce: '0',
      active: true,
      deactivated_at: 0,
    },
  };
  const chain = new NativeQuickBallots(
    {
      rpcUrl: 'http://127.0.0.1:18888',
      chainId: context.chainId,
      runtime: context.runtime,
      source: context.source,
      authority: context.authority,
      gateway: context.gateway,
    },
    { key, resources: async () => {}, confirm: async () => {} },
  );
  const ballot = { ...snapshot.ballot, closed_at: 0, prepared: false, pruned: false };
  vi.spyOn(chain, 'detail').mockImplementation(async () =>
    QuickBallotRoutes.quickDetail.response.parse({
      runtime: context.runtime,
      chainId: context.chainId,
      source: context.source,
      ballot,
      grants: null,
    }),
  );
  vi.spyOn(chain, 'ownResponse').mockResolvedValue({ response: null });
  vi.spyOn(chain, 'needsAdvance').mockResolvedValue(false);
  function prepared(overrides = {}) {
    const payload = {
      actor: {
        runtime: context.runtime,
        authority: context.authority,
        account_id: '1',
        credential: encodeQuickAnchor(anchor),
      },
      ballot_id: ballot.id,
      expected_revision: '0',
      ciphertext: '00'.repeat(192),
      proof: '00'.repeat(128),
      receipt: '',
      ...overrides,
    };
    const expires = Math.floor(Date.now() / 1000) + 120;
    return QuickAccountPreparedSchema.parse({
      ...quickAccountRequest(
        context,
        {
          operation: 'submit',
          action: 'respond',
          data: Bytes.from(encodeQuickBallot('respond', payload)).hexString,
          useDefault: false,
        },
        expires,
      ),
      context,
      id: '00000000-0000-4000-8000-000000000001',
      expiresAt: new Date(expires * 1000).toISOString(),
    });
  }
  return { chain, ballot, prepared, context };
}
it('rejects a stale revision and changed actor before requesting a signature', async () => {
  const f = fixture();
  await expect(f.chain.validatePreparation(f.prepared())).resolves.toBeUndefined();
  await expect(f.chain.validatePreparation(f.prepared({ expected_revision: '1' }))).rejects.toThrow(
    'QUICK_REVISION',
  );
  await expect(
    f.chain.validatePreparation(
      f.prepared({
        actor: {
          runtime: f.context.runtime,
          authority: f.context.authority,
          account_id: '9',
          credential: encodeQuickAnchor(f.context.anchor),
        },
      }),
    ),
  ).rejects.toThrow('QUICK_ACTOR');
});
it('rejects closed and full ballots before creating a prepared operation', async () => {
  const f = fixture();
  f.ballot.closed_at = 1;
  await expect(f.chain.validatePreparation(f.prepared())).rejects.toThrow('QUICK_CLOSED');
  f.ballot.closed_at = 0;
  f.ballot.identities = 5000;
  await expect(f.chain.validatePreparation(f.prepared())).rejects.toThrow('QUICK_CAPACITY');
});
