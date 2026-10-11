import { createHash, createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { Pool } from 'pg';
import { z } from 'zod';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import { authChain } from './auth-chain.js';
import { RecoveryBackupSchema, type RecoveryBackup } from '../../protocol/recovery.js';
import { VERSION } from '../../protocol/base.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error('Owned loopback browser test database required');
const pool = new Pool({ connectionString: url }),
  uiPort = z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .parse(process.env.DACLIFY_TEST_UI_PORT ?? 5198),
  port = z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .parse(process.env.DACLIFY_TEST_API_PORT ?? 3028);
const origin = `http://127.0.0.1:${uiPort}`,
  master = randomBytes(32),
  copies = new Map<string, string>(),
  mail = new Map<string, string>();
let failStorage = false;
const recovery = {
  assistedQualified: true,
  qualifiedWallets: [],
  passkeysQualified: false,
  keys: {
    async wrap(_name: string, bytes: Uint8Array) {
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', master, iv);
      return (
        'vault:v1:' +
        Buffer.concat([iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]).toString(
          'base64',
        )
      );
    },
    async unwrap(_name: string, value: string) {
      const bytes = Buffer.from(value.slice(9), 'base64'),
        cipher = createDecipheriv('aes-256-gcm', master, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(-16));
      return Uint8Array.from(
        Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]),
      );
    },
  },
  store: {
    async write(record: RecoveryBackup) {
      if (failStorage) throw new Error('Fixture storage outage');
      const bytes = JSON.stringify(record);
      copies.set(record.context.id, bytes);
      return {
        storeId: 'owned-browser-fixture',
        reference: record.context.id,
        commitment: createHash('sha256').update(bytes).digest('hex'),
        verifiedAt: new Date().toISOString(),
      };
    },
    async read(receipt: { reference: string }) {
      const bytes = copies.get(receipt.reference);
      if (!bytes) throw new Error('Fixture copy missing');
      return RecoveryBackupSchema.parse(JSON.parse(bytes));
    },
  },
};
await migrate(pool);
const botToken = '12345:owned-browser-fixture',
  oidcKeys = await generateKeyPair('RS256');
const app = await createServer(
  pool,
  {
    ...authChain,
    network: async () => ({
      ...(await authChain.network()),
      coreVersion: VERSION,
      environment: 'testnet' as const,
    }),
  },
  origin,
  {
    recovery,
    // The owned Vite proxy shares loopback; keep aggregate limits and ignore forwarded identities.
    trustedProxyIps: [],
    sharedProxyIps: ['127.0.0.1'],
    signIn: {
      environment: 'local',
      deliverEmail: async (to, code) => {
        mail.set(to, code);
      },
    },
    providers: {
      telegram: {
        botToken,
        botUsername: 'owned_fixture_bot',
        oidc: {
          clientId: '12345',
          clientSecret: 'owned-browser-fixture',
          redirectUri: `http://127.0.0.1:${port}/v1/sign-in/telegram/oidc/callback`,
          key: oidcKeys.publicKey,
          fetch: async (_url, input) => {
            const nonce = z.instanceof(URLSearchParams).parse(input?.body).get('code');
            return new Response(
              JSON.stringify({
                id_token: await new SignJWT({ nonce })
                  .setProtectedHeader({ alg: 'RS256' })
                  .setIssuer('https://oauth.telegram.org')
                  .setAudience('12345')
                  .setSubject(String(100000000 + Math.floor(Math.random() * 100000000)))
                  .setIssuedAt()
                  .setExpirationTime('5m')
                  .sign(oidcKeys.privateKey),
              }),
              { status: 200 },
            );
          },
        },
      },
    },
  },
);
// These controls exist only in this owned disposable test process, never in the application.
app.get('/fixture/code', async (request) => {
  const { email } = z.strictObject({ email: z.email() }).parse(request.query);
  return { code: mail.get(email) ?? null };
});
app.get('/fixture/telegram-proof', async () => {
  const fields = new URLSearchParams({
    user: JSON.stringify({
      id: 100000000 + Math.floor(Math.random() * 100000000),
      first_name: 'Owned fixture',
    }),
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: crypto.randomUUID(),
  });
  const check = Array.from(fields.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  fields.set(
    'hash',
    createHmac('sha256', createHmac('sha256', 'WebAppData').update(botToken).digest())
      .update(check)
      .digest('hex'),
  );
  return { proof: fields.toString() };
});
app.post('/fixture/options', async (request) => {
  const input = z
    .strictObject({ assisted: z.boolean().optional(), failStorage: z.boolean().optional() })
    .parse(request.body);
  if (input.assisted !== undefined) recovery.assistedQualified = input.assisted;
  if (input.failStorage !== undefined) failStorage = input.failStorage;
  return { updated: true };
});
app.get('/fixture/state', async (request) => {
  const { email } = z.strictObject({ email: z.email() }).parse(request.query);
  const row = (
    await pool.query<{
      id: string;
      signing_key: string;
      encryption_key: unknown;
      assisted_ever: boolean;
    }>(
      'SELECT a.id,a.signing_key,a.encryption_key,r.assisted_ever FROM accounts a JOIN credentials c ON c.account_id=a.id LEFT JOIN vault_recovery_state r ON r.account_id=a.id WHERE c.provider_key=$1',
      ['email:' + email],
    )
  ).rows[0];
  return row ?? null;
});
app.post('/fixture/quarantine', async (request) => {
  const { email } = z.strictObject({ email: z.email() }).parse(request.body);
  await pool.query(
    'UPDATE vault_recovery_methods SET quarantined=true WHERE account_id=(SELECT account_id FROM credentials WHERE provider_key=$1)',
    ['email:' + email],
  );
  return { updated: true };
});
await app.listen({ host: '127.0.0.1', port });
console.log(`Owned signup browser fixture listening on loopback port ${port}.`);
async function close() {
  await app.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
