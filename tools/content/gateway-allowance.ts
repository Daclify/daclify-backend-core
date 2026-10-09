// Registers an operator-attested period; never charges a provider or a DAO.
import '../../services/api/src/load-local-env.js';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { GatewayFundingSchema } from '../../protocol/storage.js';
import { registerGatewayAllowance } from '../../services/api/src/content/gateway-allowance.js';
const args = process.argv.slice(2),
  path = args.find((arg) => !arg.startsWith('--'));
if (
  !path ||
  args.some((arg) => arg.startsWith('--') && arg !== '--apply') ||
  args.length !== (args.includes('--apply') ? 2 : 1)
)
  throw new Error('Usage: gateway-allowance funding.json [--apply]');
const bytes = await readFile(path);
if (bytes.length > 4096) throw new Error('GATEWAY_FUNDING_FILE_SIZE');
const value = GatewayFundingSchema.parse(JSON.parse(bytes.toString('utf8')));
if (args.includes('--apply')) {
  if (!process.env.DATABASE_URL) throw new Error('GATEWAY_DATABASE_REQUIRED');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await registerGatewayAllowance(pool, value);
  } catch {
    throw new Error('GATEWAY_ALLOWANCE_REGISTRATION_FAILED');
  } finally {
    await pool.end();
  }
}
process.stdout.write(
  JSON.stringify(
    {
      mode: args.includes('--apply') ? 'registered' : 'plan',
      allowance: value.id,
      providerScope: value.providerScope,
      gateway: value.gateway,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      byteLimit: value.byteLimit,
      requestLimit: value.requestLimit,
      qualification:
        'operator-attested; provider funding/access controls require separate verification',
    },
    null,
    2,
  ) + '\n',
);
