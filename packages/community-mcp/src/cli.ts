#!/usr/bin/env node
import {connectCompanion,serveCompanion} from './companion.js';
import { readFile, unlink } from 'node:fs/promises';
import { createWriteStream, openSync } from 'node:fs';
import { ReadStream } from 'node:tty';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import {
  McpDiagnosticCodeSchema,
  McpLocalConfigurationSchema,
  McpPairingInputSchema,
  McpPairingRoutes,
} from '@daclify/core-protocol';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { saveCredentials, loadCredentials } from './credentials.js';
import { LocalCommunityClient, mcpRequest } from './local-client.js';
import { ProtectedCommunitySigner } from './signer.js';
import { createCommunityTools } from './tools.js';
import { createStdioServer } from './stdio.js';
export const PairConfigurationSchema = McpLocalConfigurationSchema;
async function trustedPrompt(prompt: string, secret = false): Promise<string> {
  const input = new ReadStream(openSync('/dev/tty', 'r+'));
  const output = createWriteStream('/dev/tty');
  if (secret) {
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    try {
      return await new Promise<string>((resolve, reject) => {
        let result = '';
        input.on('data', (bytes: Buffer) => {
          for (const byte of bytes) {
            if (byte === 3) {
              reject(Error('MCP_CANCELLED'));
              return;
            }
            if (byte === 13 || byte === 10) {
              resolve(result);
              return;
            }
            if (byte === 127) {
              result = result.slice(0, -1);
            } else if (byte >= 32 && byte < 127 && result.length < 1024) {
              result += String.fromCharCode(byte);
            }
          }
        });
      });
    } finally {
      input.setRawMode(false);
      input.destroy();
      output.write('\n');
      output.end();
    }
  }
  const reader = createInterface({ input, output });
  try {
    return await reader.question(prompt);
  } finally {
    reader.close();
    input.destroy();
    output.end();
  }
}
export async function main(args: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: { credentials: { type: 'string' }, config: { type: 'string' },socket:{type:'string'} },
  });
  const command = z.enum(['pair', 'serve', 'bridge', 'status', 'revoke']).parse(positionals[0]);
  if(command==='bridge'){const socket=await connectCompanion(z.string().min(1).max(100).parse(values.socket));process.stdin.pipe(socket);socket.pipe(process.stdout);socket.on('error',()=>{process.stderr.write('Daclify companion connection failed.\n');process.exitCode=1;});socket.on('close',()=>process.stdin.destroy());return;}
  const file = z.string().min(1).max(4096).parse(values.credentials);
  if (!isAbsolute(file)) throw Error('MCP_CREDENTIALS');
  if (command === 'pair') {
    const configPath = z.string().min(1).parse(values.config);
    const raw = await readFile(configPath);
    if (raw.length > 8192) throw Error('MCP_CONFIG');
    const config = PairConfigurationSchema.parse(JSON.parse(raw.toString()));
    const key = PrivateKey.generate('K1'),
      verifier = randomBytes(32).toString('base64url');
    const pairing = McpPairingRoutes.mcpPair.response.parse(
      await mcpRequest(
        config.api,
        McpPairingRoutes.mcpPair.path,
        McpPairingInputSchema.parse({
          dao: config.dao,
          memberId: config.memberId,
          scopes: config.scopes,
          ...(config.app ? { app: config.app } : {}),
          delegatePublicKey: key.toPublic().toString(),
          codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
        }),
      ),
    );
    const consent = new URL(pairing.consentUrl);
    if (
      consent.origin !== config.frontend ||
      consent.pathname !== '/mcp/consent' ||
      consent.searchParams.get('request') !== pairing.id ||
      consent.username ||
      consent.password ||
      consent.hash
    )
      throw Error('MCP_CONSENT_ORIGIN');
    process.stderr.write('Approve this connection in Daclify: ' + consent.toString() + '\n');
    while (Date.parse(pairing.expires) > Date.now()) {
      try {
        const result = McpPairingRoutes.mcpRedeem.response.parse(
          await mcpRequest(config.api, McpPairingRoutes.mcpRedeem.path.replace(':id', pairing.id), {
            codeVerifier: verifier,
          }),
        );
        if (
          result.grant.memberId !== config.memberId ||
          JSON.stringify(result.grant.dao) !== JSON.stringify(config.dao) ||
          result.grant.delegatePublicKey !== key.toPublic().toString() ||
          JSON.stringify(result.grant.scopes) !== JSON.stringify(config.scopes)
        )
          throw Error('MCP_CONTEXT_CHANGED');
        const password = await trustedPrompt(
          'Encrypt local delegate (at least 16 characters): ',
          true,
        );
        await saveCredentials(
          file,
          {
            version: 1,
            api: config.api,
            grantToken: result.token,
            delegateKey: key.toString(),
            grantId: result.grant.id,
          },
          password,
        );
        if(values.socket)process.stderr.write('Start a trusted foreground companion with serve --credentials '+file+' --socket '+values.socket+' before connecting the harness.\n');
        process.stdout.write(
          JSON.stringify(
            {
              mcpServers: {
                daclify: {
                  command: process.execPath,
                  args: [fileURLToPath(import.meta.url),...(values.socket?['bridge','--socket',values.socket]:['serve','--credentials',file])],
                },
              },
            },
            null,
            2,
          ) + '\n',
        );
        return;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'MCP_APPROVAL_PENDING') throw error;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    }
    throw Error('MCP_PAIRING_EXPIRED');
  }
  const password = await trustedPrompt('Unlock local Daclify delegate: ', true),
    credentials = await loadCredentials(file, password);
  const client = new LocalCommunityClient(credentials, async (prepared) => {
    const answer = await trustedPrompt(
      'Approve ' +
        JSON.stringify({
          dao: prepared.request.dao_id,
          member: prepared.request.member_id,
          scope: prepared.scope,
          target: prepared.request.target,
          digest: prepared.digest,
          intent: prepared.intent,
        }) +
        '? Type approve: ',
    );
    if (answer !== 'approve') throw Error('MCP_CONFIRMATION_REFUSED');
  });
  if (command === 'status') {
    process.stdout.write(JSON.stringify(await client.status()) + '\n');
    return;
  }
  if (command === 'revoke') {
    await client.revoke();
    await unlink(file);
    process.stdout.write(
      'Connection revoked; remove the native session in Daclify to retire any independent delegate copies.\n',
    );
    return;
  }
  await client.status();
  if(values.socket){
    const host=await serveCompanion(createCommunityTools(client,new ProtectedCommunitySigner(client,credentials.delegateKey)),values.socket);
    process.stderr.write('Daclify companion ready. Connect the harness through its private socket reference.\n');
    const stop=()=>void host.close().catch(()=>{process.exitCode=1;});process.once('SIGINT',stop);process.once('SIGTERM',stop);return;
  }
  await serveStdio(
    () =>
      createStdioServer(
        createCommunityTools(client, new ProtectedCommunitySigner(client, credentials.delegateKey)),
      ),
    {
      onerror: () =>
        process.stderr.write('Daclify MCP transport failed; credentials are redacted.\n'),
    },
  );
}
if (import.meta.main)
  await main(process.argv.slice(2)).catch(cause => {
    const code=McpDiagnosticCodeSchema.safeParse(cause instanceof Error?cause.message:'');if(code.success)process.stderr.write('Daclify MCP: '+code.data+'\n');
    process.stderr.write(
      'Daclify MCP could not continue. Check consent, current permissions, the encrypted credential file and trusted terminal access. No private diagnostic is printed.\n',
    );
    process.exitCode = 1;
  });
