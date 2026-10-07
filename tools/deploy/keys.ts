import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrivateKey, PublicKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { deploymentAccounts, CORE_ROOT, type DeployEnvironment } from './environment.js';

const StoredKeySchema = z.object({
  account: z.string(),
  publicKey: z.string(),
  privateKey: z.string(),
});
const KeyFileSchema = z.object({
  environment: z.enum(['develop', 'production', 'testnet']),
  accounts: z.array(StoredKeySchema),
});

export interface ActiveKey {
  account: string;
  publicKey: string;
  privateKey: PrivateKey;
}

export function keyFilePath(environment: DeployEnvironment['name']): string {
  return path.join(CORE_ROOT, '.artifacts', 'deploy', `${environment}-keys.json`);
}

export function activeAuthority(account: string, publicKey: string, inlineCode: boolean) {
  return {
    threshold: 1,
    keys: [{ key: publicKey, weight: 1 }],
    accounts: inlineCode
      ? [{ permission: { actor: account, permission: 'eosio.code' }, weight: 1 }]
      : [],
    waits: [],
  };
}

export function ownerAuthority(publicKey: string) {
  return { threshold: 1, keys: [{ key: publicKey, weight: 1 }], accounts: [], waits: [] };
}

// Owner stays the deployer key. Active keys are generated once and kept in the gitignored file.
export function loadOrCreateActiveKeys(
  environment: DeployEnvironment,
  file = keyFilePath(environment.name),
): ActiveKey[] {
  mkdirSync(path.dirname(file), { recursive: true });
  let stored: z.infer<typeof KeyFileSchema> = { environment: environment.name, accounts: [] };
  try {
    stored = KeyFileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw new Error('DEPLOY_KEY_FILE_INVALID');
    }
  }
  if (stored.environment !== environment.name) throw new Error('DEPLOY_KEY_FILE_INVALID');
  const byAccount = new Map(stored.accounts.map((row) => [row.account, row]));
  const resolved: ActiveKey[] = [];
  for (const account of deploymentAccounts(environment)) {
    const existing = byAccount.get(account.name);
    if (existing) {
      const key = PrivateKey.from(existing.privateKey);
      if (key.toPublic().toString() !== existing.publicKey)
        throw new Error('DEPLOY_KEY_FILE_INVALID');
      resolved.push({ account: account.name, publicKey: existing.publicKey, privateKey: key });
      continue;
    }
    const created = PrivateKey.generate('K1');
    const row = {
      account: account.name,
      publicKey: created.toPublic().toString(),
      privateKey: created.toString(),
    };
    stored.accounts.push(row);
    resolved.push({ account: account.name, publicKey: row.publicKey, privateKey: created });
  }
  writeFileSync(
    file,
    JSON.stringify({ environment: environment.name, accounts: stored.accounts }),
    {
      mode: 0o600,
    },
  );
  chmodSync(file, 0o600);
  return resolved;
}

export function deployerKey(): PrivateKey {
  const value = process.env.DEPLOYER_PRIVATE_KEY;
  if (!value) throw new Error('DEPLOYER_PRIVATE_KEY_MISSING');
  try {
    return PrivateKey.from(value);
  } catch {
    throw new Error('DEPLOYER_PRIVATE_KEY_INVALID');
  }
}

export function publicKeyOf(key: PrivateKey): PublicKey {
  return key.toPublic();
}
