import { it, expect } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { generateKeyPairSync } from 'node:crypto';
import { McpConnectionSchema, McpToolInputSchemas } from '../protocol/mcp.js';
const dao = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '18446744073709551615',
  interfaceVersion: 1,
};
it('keeps a lossless community binding and public authentication separate from delegated scopes', () => {
  const input = {
    version: 1,
    api: 'https://api.example',
    origin: 'https://app.example',
    dao,
    memberId: '18446744073709551615',
    authentication: {
      signingPublicKey: PrivateKey.generate('K1').toPublic().toString(),
      encryptionPublicKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export(
        { format: 'jwk' },
      ),
    },
    scopes: ['proposal', 'vote'],
  };
  expect(McpConnectionSchema.parse(input).memberId).toBe('18446744073709551615');
  expect(() =>
    McpConnectionSchema.parse({ ...input, rootPrivateKey: PrivateKey.generate('K1').toString() }),
  ).toThrow();
  expect(() => McpConnectionSchema.parse({ ...input, scopes: ['withdraw'] })).toThrow();
  expect(() =>
    McpConnectionSchema.parse({ ...input, dao: { ...dao, daoId: Number(dao.daoId) } }),
  ).toThrow();
});
it('accepts bounded model intents without arbitrary targets, payout fields or private content keys', () => {
  const vote = { pollId: '18446744073709551615', optionId: '1' };
  expect(McpToolInputSchemas.prepare_vote.parse(vote)).toEqual(vote);
  expect(() => McpToolInputSchemas.prepare_vote.parse({ ...vote, target: 'foreign' })).toThrow();
  expect(() =>
    McpToolInputSchemas.prepare_proposal.parse({
      title: 'A community poll',
      description: 'Public discussion',
      options: ['Yes', 'No'],
      durationSeconds: 3600,
      amount: '10000',
    }),
  ).toThrow();
  expect(() =>
    McpToolInputSchemas.prepare_activity.parse({
      appId: '1',
      sourceId: 'ab'.repeat(32),
      sourceRevision: 'cd'.repeat(32),
      eventId: 'ef'.repeat(32),
      signingKey: PrivateKey.generate('K1').toString(),
    }),
  ).toThrow();
});
