import { execFileSync } from 'node:child_process';
import { z } from 'zod';
export function unlockFixtureWallet(container: string): void {
  z.enum(['daclify-v2-native', 'daclify-dao-presets-native']).parse(container);
  try {
    const base = ['exec', container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', 'wallet'];
    const wallets = execFileSync('docker', [...base, 'list'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (wallets.includes('default *')) return;
    const password = z
      .string()
      .regex(/^PW[A-Za-z0-9]+$/)
      .parse(
        execFileSync('docker', ['exec', container, 'cat', '/tmp/wallet-password'], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim(),
      );
    execFileSync('docker', [...base, 'unlock', '--password', password], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('Local fixture wallet unlock failed; secret-bearing arguments are redacted.');
  }
}
