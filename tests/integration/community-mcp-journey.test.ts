import { z } from 'zod';
import { McpOAuthRoutes, McpSetupRoutes } from '../../protocol/mcp.js';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { mcpFixture } from '../helpers/mcp-fixture.js';
import { LocalCommunityClient } from '../../packages/community-mcp/src/local-client.js';
import { ProtectedCommunitySigner } from '../../packages/community-mcp/src/signer.js';
import { createCommunityTools } from '../../packages/community-mcp/src/tools.js';
import { PreparedInstructionSchema, SubmissionResultSchema } from '../../protocol/mcp.js';
import { encodeDecide, DecideTableSchemas } from '@daclify/modules/sdk';
let fixture: Awaited<ReturnType<typeof mcpFixture>>;
beforeAll(async () => {
  fixture = await mcpFixture();
}, 90000);
afterAll(async () => {
  await fixture?.stop();
});
it.each([0, 1, 2] as const)(
  'connects participant mode %s with protected preparation/signing and native revocation',
  async (mode) => {
    const current = await fixture.paired(mode),
      client = new LocalCommunityClient({
        version: 1,
        api: fixture.api,
        grantToken: current.grant.token,
        delegateKey: current.delegate.toString(),
        grantId: current.grant.grant.id,
      }),
      tools = createCommunityTools(
        client,
        new ProtectedCommunitySigner(client, current.delegate.toString()),
      ),
      ballot = String(932001 + mode);
    expect(await tools.call('get_membership', {})).toMatchObject({ memberId: '1', active: true });
    await current.dao.act(
      'decide',
      'open',
      encodeDecide('open', {
        ...current.dao.actor(),
        ballot_id: ballot,
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    const prepared = PreparedInstructionSchema.parse(
      await tools.call('prepare_vote', { pollId: ballot, optionId: '1' }),
    );
    const result = SubmissionResultSchema.parse(await tools.call('submit_prepared', prepared));
    expect(result.state).toBe('submitted');
    expect(JSON.stringify(prepared)).not.toContain(current.root.toString());
    expect(JSON.stringify(await tools.call('get_membership', {}))).not.toContain(
      current.delegate.toString(),
    );
    await expect(tools.call('prepare_vote', { pollId: ballot, optionId: '0' })).rejects.toThrow(
      'MCP_VOTE_UNAVAILABLE',
    );
    const nextBallot = String(932101 + mode);
    await current.dao.act(
      'decide',
      'open',
      encodeDecide('open', {
        ...current.dao.actor(),
        ballot_id: nextBallot,
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    const next = PreparedInstructionSchema.parse(
      await tools.call('prepare_vote', { pollId: nextBallot, optionId: '0' }),
    );
    await fixture.native.call(
      'daclifycore',
      'guardpause',
      {
        dao_id: current.dao.daoId,
        until: Math.floor(Date.now() / 1000) + 60,
        reason: 'cd'.repeat(32),
      },
      'alice',
    );
    await expect(tools.call('submit_prepared', next)).rejects.toThrow();
    await expect(client.status()).rejects.toThrow();
  },
);

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { saveCredentials } from '../../packages/community-mcp/src/credentials.js';
it('uses the installed Codex app-server client and a separate trusted terminal controller for real native submission', async () => {
  const current = await fixture.paired(),
    directory = await mkdtemp(join(tmpdir(), 'owned-codex-mcp-')),
    password = 'Owned synthetic MCP terminal password';
  try {
    await current.dao.act(
      'decide',
      'open',
      encodeDecide('open', {
        ...current.dao.actor(),
        ballot_id: '939001',
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    await current.dao.act(
      'decide',
      'open',
      encodeDecide('open', {
        ...current.dao.actor(),
        ballot_id: '939002',
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    const credentials = join(directory, 'delegate.json');
    await saveCredentials(
      credentials,
      {
        version: 1,
        api: fixture.api,
        grantToken: current.grant.token,
        delegateKey: current.delegate.toString(),
        grantId: current.grant.grant.id,
      },
      password,
    );
    const configuration = join(directory, 'controller.json');
    await writeFile(
      configuration,
      JSON.stringify({
        cwd: directory,
        api: fixture.api,
        args: [
          process.env.MCP_HARNESS_CLI ?? resolve('packages/community-mcp/dist/src/cli.js'),
          'bridge',
          '--socket',
          join(directory, 'companion.sock'),
        ],
        serveArgs: [
          process.env.MCP_HARNESS_CLI ?? resolve('packages/community-mcp/dist/src/cli.js'),
          'serve',
          '--credentials',
          credentials,
          '--socket',
          join(directory, 'companion.sock'),
        ],
        password,
        intent: { pollId: '939001', optionId: '1' },
        remoteIntent: { pollId: '939002', optionId: '0' },
      }),
      { mode: 0o600 },
    );
    const stdout = await new Promise<string>((resolveDone, reject) => {
      const child = spawn('python3', ['tests/helpers/codex-mcp-driver.py', configuration], {
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
        client = new LocalCommunityClient({
          version: 1,
          api: fixture.api,
          grantToken: current.grant.token,
          delegateKey: current.delegate.toString(),
          grantId: current.grant.grant.id,
        }),
        signer = new ProtectedCommunitySigner(client, current.delegate.toString());
      let pending = '',
        output = '',
        diagnostics = '';
      const deadline = setTimeout(() => {
        child.kill('SIGTERM');
        reject(Error('HARNESS_DEADLINE'));
      }, 150000);
      child.stderr.on('data', (data: Buffer) => {
        diagnostics += data.toString();
        if (diagnostics.length > 65536) {
          child.kill();
          reject(Error('HARNESS_OUTPUT_LIMIT'));
        }
      });
      child.stdout.on('data', (data: Buffer) => {
        pending += data.toString();
        if (pending.length > 65536) {
          child.kill();
          reject(Error('HARNESS_OUTPUT_LIMIT'));
        }
        let index;
        while ((index = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, index);
          pending = pending.slice(index + 1);
          void (async () => {
            const envelope = z.object({ kind: z.string().optional() }).parse(JSON.parse(line));
            if (envelope.kind === 'consent-request') {
              const input = z.object({ requestId: z.uuid() }).parse(JSON.parse(line));
              await fixture.oauth.consent(current.account.account, input.requestId);
              const approved = await current.approve('/v1/mcp/oauth/approve', {
                id: input.requestId,
                dao: current.dao.reference,
                memberId: '1',
                nativeScopes: ['vote'],
                localGrantId: current.grant.grant.id,
              });
              const redirect = McpOAuthRoutes.mcpOAuthApprove.response.parse(approved.json());
              child.stdin.write(JSON.stringify(redirect) + '\n');
            } else if (envelope.kind === 'external-signature-request') {
              const input = z
                .object({ prepared: PreparedInstructionSchema })
                .parse(JSON.parse(line));
              child.stdin.write(
                JSON.stringify({ signature: await signer.signPrepared(input.prepared) }) + '\n',
              );
            } else output = line;
          })().catch((error) => {
            child.kill();
            reject(error);
          });
        }
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        clearTimeout(deadline);
        if (code !== 0) reject(Error('HARNESS_FAILED ' + diagnostics));
        else resolveDone(output);
      });
    });
    const result: unknown = JSON.parse(stdout);
    expect(result).toMatchObject({
      client: 'codex-cli',
      memberId: '1',
      result: { state: 'submitted' },
      remoteResult: { state: 'submitted' },
      remoteMemberId: '1',
    });
    expect(stdout).not.toContain(password);
    expect(stdout).not.toContain(current.root.toString());
    expect(stdout).not.toContain(current.delegate.toString());
    const votes = await fixture.native.api.v1.chain.get_table_rows({
      code: 'decide',
      scope: 'daclifycore',
      table: 'votes',
      limit: 100,
    });
    const records = z.array(DecideTableSchemas.votes).parse(votes.rows);
    for (const ballot of ['939001', '939002'])
      expect(
        records.filter((value) => value.ballot === ballot && value.member === '1'),
      ).toHaveLength(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 180000);

it('authenticates the actual Claude Code CLI with exact localhost callback and native member consent', async () => {
  const client = process.env.DACLIFY_CLAUDE_CLI;
  if (!client) throw Error('ACTUAL_CLAUDE_CLI_REQUIRED');
  const current = await fixture.paired(),
    directory = await mkdtemp(join(tmpdir(), 'owned-claude-mcp-'));
  try {
    const configuration = join(directory, 'controller.json');
    await writeFile(configuration, JSON.stringify({ cwd: directory, api: fixture.api, client }), {
      mode: 0o600,
    });
    const stdout = await new Promise<string>((resolveDone, reject) => {
      const child = spawn('python3', ['tests/helpers/claude-mcp-driver.py', configuration], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let pending = '',
        output = '',
        diagnostics = '';
      const deadline = setTimeout(() => {
        child.kill();
        reject(Error('CLAUDE_HARNESS_DEADLINE'));
      }, 120000);
      child.stderr.on('data', (data: Buffer) => {
        diagnostics += data.toString();
        if (diagnostics.length > 65536) {
          child.kill();
          reject(Error('CLAUDE_OUTPUT_LIMIT'));
        }
      });
      child.stdout.on('data', (data: Buffer) => {
        pending += data.toString();
        if (pending.length > 65536) {
          child.kill();
          reject(Error('CLAUDE_OUTPUT_LIMIT'));
          return;
        }
        let index;
        while ((index = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, index);
          pending = pending.slice(index + 1);
          void (async () => {
            const envelope = z.object({ kind: z.string().optional() }).parse(JSON.parse(line));
            if (envelope.kind === 'consent-request') {
              const request = z.object({ requestId: z.uuid() }).parse(JSON.parse(line));
              await fixture.oauth.consent(current.account.account, request.requestId);
              const approved = await current.approve('/v1/mcp/oauth/approve', {
                id: request.requestId,
                dao: current.dao.reference,
                memberId: '1',
                nativeScopes: ['vote'],
                localGrantId: null,
              });
              child.stdin.write(
                JSON.stringify(McpOAuthRoutes.mcpOAuthApprove.response.parse(approved.json())) +
                  '\n',
              );
            } else output = line;
          })().catch((error: unknown) => {
            child.kill();
            reject(error);
          });
        }
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        clearTimeout(deadline);
        if (code !== 0) reject(Error('CLAUDE_HARNESS_FAILED ' + diagnostics));
        else resolveDone(output);
      });
    });
    expect(JSON.parse(stdout)).toMatchObject({
      client: 'claude-code',
      connected: true,
      callback: 'http://localhost:35839/callback',
      inferenceRun: false,
    });
    expect(stdout).not.toContain(current.root.toString());
    expect(stdout).not.toContain(current.delegate.toString());
    const families = await fixture.pool.query<{ id: string; context: unknown }>(
      "SELECT id,context FROM mcp_oauth_families WHERE account_id=$1 AND context->>'clientId'=$2",
      [current.account.account.id, 'claude-owned-fixture'],
    );
    expect(families.rows).toHaveLength(1);
    const family = z
      .object({
        id: z.uuid(),
        context: z.object({
          scopes: z.array(z.string()),
          sessionId: z.null(),
          delegatePublicKey: z.null(),
        }),
      })
      .parse(families.rows[0]);
    expect(family.context.scopes).toEqual(['daclify:read', 'daclify:prepare']);
    await current.approve(McpSetupRoutes.mcpRevokeFamily.path, { id: family.id });
    const revoked = await fixture.pool.query<{ revoked: boolean }>(
      'SELECT revoked_at IS NOT NULL AS revoked FROM mcp_oauth_families WHERE id=$1',
      [family.id],
    );
    expect(revoked.rows[0]?.revoked).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 150000);
