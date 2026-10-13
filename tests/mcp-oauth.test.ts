import { DaoRefSchema } from '../protocol/base.js';
import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { validateMcpOAuthClaims } from '../services/api/src/mcp/oauth.js';
it('binds a short-lived MCP token to its own issuer, audience and bounded permission set', () => {
  const now = Math.floor(Date.now() / 1000),
    input = {
      version: 1,
      iss: 'https://api.example/mcp/oauth',
      aud: 'https://api.example/mcp',
      sub: randomUUID(),
      clientId: 'sdk-fixture',
      familyId: randomUUID(),
      dao: {
        chainId: 'ab'.repeat(32),
        contract: 'daclifycore',
        daoId: '18446744073709551615',
        interfaceVersion: 1,
      },
      memberId: '18446744073709551615',
      scopes: ['daclify:read', 'daclify:prepare'],
      nativeScopes: ['vote'],
      iat: now,
      exp: now + 300,
      sessionId: null,
      delegatePublicKey: null,
      credentialEpoch: '1',
    };
  expect(validateMcpOAuthClaims(input, 'https://api.example', now).dao.daoId).toBe(
    '18446744073709551615',
  );
  for (const changed of [
    { aud: 'https://foreign.example/mcp' },
    { iss: 'https://api.example' },
    { exp: now + 301 },
    { exp: now },
    { scopes: ['openid', 'membership'] },
    { nativeScopes: ['withdraw'] },
  ])
    expect(() =>
      validateMcpOAuthClaims({ ...input, ...changed }, 'https://api.example', now),
    ).toThrow();
});

import { McpPreviewSchema, PreparedInstructionSchema } from '../protocol/mcp.js';
import { makeInstruction, instructionDigest } from '../sdk/index.js';
it('keeps an HTTP-only preview outside the signed preparation contract', () => {
  const dao = DaoRefSchema.parse({
      chainId: 'ab'.repeat(32),
      contract: 'daclifycore',
      daoId: '1',
      interfaceVersion: 1,
    }),
    expires = Math.floor(Date.now() / 1000) + 300,
    request = makeInstruction(dao, '1', '0', expires, 'moddecide', 'vote', new Uint8Array());
  const preview = McpPreviewSchema.parse({
    state: 'signer-required',
    intent: { tool: 'prepare_vote', input: { pollId: '1', optionId: '0' } },
    request,
    digest: instructionDigest(request).toString(),
    scope: 'vote',
    codeHash: 'cd'.repeat(32),
    policyRevision: '1',
    expires,
  });
  expect(PreparedInstructionSchema.safeParse(preview).success).toBe(false);
  expect(JSON.stringify(preview)).not.toContain('signingPublicKey');
});
