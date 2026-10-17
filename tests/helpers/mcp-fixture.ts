import { EncryptionPrivateKeySchema, EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { createHash, randomBytes, generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { Pool } from 'pg';
import { z } from 'zod';
import { migrate } from '../../services/api/src/store.js';
import { nativeContracts, nativeModules } from './native-contracts.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { McpPairings } from '../../services/api/src/mcp/pairing.js';
import { McpOAuth } from '../../services/api/src/mcp/oauth.js';
import { createServer } from '../../services/api/src/server.js';
import {
  ApiRoutes,
  AccountControlChallengeSchema,
  McpPairingRoutes,
} from '../../protocol/index.js';
import { encodeAction } from '../../sdk/index.js';
export async function mcpFixture() {
  const source = process.env.DATABASE_URL;
  if (
    !source ||
    new URL(source).hostname !== '127.0.0.1' ||
    !new URL(source).pathname.endsWith('_test')
  )
    throw Error('Owned test database required');
  const pool = new Pool({ connectionString: source });
  await migrate(pool);
  const native = await nativeContracts(),
    api = 'http://127.0.0.1:35819',
    frontend = 'https://app.example';
  const chain = new NativeChainGateway(
      {
        rpcUrl: native.url,
        chainId: native.chainId,
        runtime: 'daclifycore',
        hub: 'daclifyhub',
        environment: 'local',
        relayActor: 'relay',
        relayKey: native.key('relay'),
        modules: nativeModules,
      },
      pool,
    ),
    pairings = new McpPairings(pool, chain, api, frontend),
    oauth = new McpOAuth(pairings, [
      { clientId: 'codex-owned-fixture', redirectUris: ['http://127.0.0.1:35829/callback'] },
      { clientId: 'claude-owned-fixture', redirectUris: ['http://localhost:35839/callback'] },
    ]);
  const server = await createServer(pool, chain, frontend, {
    apiOrigin: api,
    mcpPairings: pairings,
    mcpOAuth: oauth,
  });
  server.addHook('onError', async (_request, _reply, error) => {
    const diagnostic = z.object({ code: z.string().optional() }).safeParse(error);
    console.error({
      fixtureErrorType: error.name,
      fixtureErrorMessage: /^[A-Z_]{1,80}$/.test(error.message) ? error.message : undefined,
      fixtureErrorStack: error.stack
        ?.split('\n')
        .filter((line) => line.startsWith('    at '))
        .slice(0, 4),
      fixtureErrorCode: diagnostic.success ? diagnostic.data.code : undefined,
    });
  });
  await server.listen({ host: '127.0.0.1', port: 35819 });
  async function paired(
    mode: 0 | 1 | 2 = 0,
    recipientKeys: readonly string[] = [],
    privacy: 0 | 1 | 2 = 0,
    scopes: ('proposal' | 'vote' | 'review')[] = ['vote'],
  ) {
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }),
      encryptionKey = EncryptionPublicKeySchema.parse(pair.publicKey.export({ format: 'jwk' })),
      encryptionPrivateKey = EncryptionPrivateKeySchema.parse(
        pair.privateKey.export({ format: 'jwk' }),
      ),
      dao = await native.dummyDao(
        'alice',
        false,
        mode,
        [JSON.stringify(encryptionKey), ...recipientKeys],
        privacy,
      ),
      firstKey = dao.keys[0];
    if (!firstKey) throw Error('Root fixture absent');
    const root = firstKey;
    const challengeResponse = await server.inject({
        method: 'POST',
        url: ApiRoutes.challenge.path,
        headers: { origin: frontend },
        payload: { signingKey: root.toPublic().toString(), encryptionKey },
      }),
      challenge = ApiRoutes.challenge.response.parse(challengeResponse.json());
    const login = await server.inject({
      method: 'POST',
      url: ApiRoutes.login.path,
      headers: { origin: frontend },
      payload: {
        challengeId: challenge.id,
        signature: root.signMessage(new TextEncoder().encode(challenge.message)).toString(),
        encryptionKey,
      },
    });
    if (login.statusCode !== 200) throw Error('Fixture login failed');
    const account = ApiRoutes.login.response.parse(login.json()),
      headers = {
        origin: frontend,
        cookie: login.cookies.map((value) => value.name + '=' + value.value).join('; '),
        'x-csrf-token': account.csrfToken,
      };
    const delegate = PrivateKey.generate('K1'),
      verifier = randomBytes(32).toString('base64url'),
      request = await pairings.begin({
        dao: dao.reference,
        memberId: '1',
        scopes,
        delegatePublicKey: delegate.toPublic().toString(),
        codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
      }),
      consent = await pairings.consent(account.account, request.id);
    await dao.act(
      'daclifycore',
      'addsession',
      encodeAction('addsession', {
        ...dao.actor(),
        session_id: '701',
        signing_key: delegate.toPublic().toString(),
        expires: consent.grantExpires,
        permissions: consent.permissions,
      }),
    );
    async function approve(path: string, body: unknown) {
      const response = await server.inject({
        method: 'POST',
        url: '/v1/account/control',
        headers,
        payload: {
          path,
          bodyHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
        },
      });
      if (response.statusCode !== 200) throw Error('Fixture control failed');
      const control = AccountControlChallengeSchema.parse(response.json());
      const approved = await server.inject({
        method: 'POST',
        url: path,
        headers: {
          ...headers,
          'content-type': 'application/json',
          'x-account-intent-id': control.id,
          'x-account-signature': root
            .signMessage(new TextEncoder().encode(control.message))
            .toString(),
        },
        payload: JSON.stringify(body),
      });
      if (approved.statusCode !== 200)
        throw Error('Fixture approval refused ' + approved.statusCode);
      return approved;
    }
    await approve(McpPairingRoutes.mcpApprove.path, {
      id: request.id,
      dao: dao.reference,
      memberId: '1',
      scopes,
      sessionId: '701',
      mode: 'autonomous',
    });
    const grant = await pairings.redeem(request.id, verifier);
    return { dao, root, delegate, account, headers, grant, approve, encryptionPrivateKey };
  }
  return {
    api,
    frontend,
    pool,
    native,
    chain,
    pairings,
    oauth,
    server,
    paired,
    stop: async () => {
      await server.close();
      await native.stop();
      await pool.end();
    },
  };
}
