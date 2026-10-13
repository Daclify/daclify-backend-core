import { it, expect } from 'vitest';
import { mkdtemp, readFile, chmod, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrivateKey } from '@wharfkit/antelope';
import { saveCredentials, loadCredentials } from '../src/credentials.js';
it('encrypts scoped credentials and rejects wrong passwords and permissive files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daclify-mcp-credentials-')),
    file = join(directory, 'delegate.json');
  try {
    const key = PrivateKey.generate('K1').toString();
    const input = {
      version: 1,
      api: 'https://api.example',
      grantToken: 'x'.repeat(43),
      delegateKey: key,
      grantId: crypto.randomUUID(),
    };
    await saveCredentials(file, input, 'a sufficiently long trusted host password');
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readFile(file, 'utf8')).not.toContain(key);
    expect(await loadCredentials(file, 'a sufficiently long trusted host password')).toEqual(input);
    await expect(loadCredentials(file, 'wrong password')).rejects.toThrow('MCP_CREDENTIALS');
    await chmod(file, 0o644);
    await expect(
      loadCredentials(file, 'a sufficiently long trusted host password'),
    ).rejects.toThrow('MCP_CREDENTIALS');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
