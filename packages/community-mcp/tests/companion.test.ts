import { it, expect } from 'vitest';
import { mkdtemp, lstat, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveCompanion, connectCompanion } from '../src/companion.js';
import { createCommunityTools } from '../src/tools.js';
it('serves a private local socket and refuses a public directory or socket', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-mcp-companion-')),
    socket = join(directory, 'companion.sock');
  try {
    const host = await serveCompanion(
      createCommunityTools({
        read: async () => ({ memberId: '1' }),
        prepare: async () => {
          throw Error('unused');
        },
        submitSigned: async () => {
          throw Error('unused');
        },
      }),
      socket,
    );
    expect((await lstat(socket)).mode & 0o777).toBe(0o600);
    const connected = await connectCompanion(socket);
    connected.destroy();
    await chmod(socket, 0o666);
    await expect(connectCompanion(socket)).rejects.toThrow('MCP_COMPANION_PRIVATE');
    await chmod(socket, 0o600);
    await host.close();
    await expect(lstat(socket)).rejects.toThrow();
    await chmod(directory, 0o755);
    await expect(
      serveCompanion(
        createCommunityTools({
          read: async () => ({}),
          prepare: async () => {
            throw Error('unused');
          },
          submitSigned: async () => {
            throw Error('unused');
          },
        }),
        socket,
      ),
    ).rejects.toThrow('MCP_COMPANION_PRIVATE');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
