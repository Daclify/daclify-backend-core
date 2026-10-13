import { createServer, createConnection, type Socket } from 'node:net';
import { lstat, chmod, unlink } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import type { CommunityTools } from './tools.js';
import { createStdioServer } from './stdio.js';
const invalid = () => Error('MCP_COMPANION_PRIVATE');
async function privateDirectory(path: string) {
  if (!isAbsolute(path) || Buffer.byteLength(path) > 100 || process.getuid === undefined)
    throw invalid();
  const directory = await lstat(dirname(path));
  if (
    !directory.isDirectory() ||
    directory.uid !== process.getuid() ||
    (directory.mode & 0o777) !== 0o700
  )
    throw invalid();
}
export async function connectCompanion(path: string): Promise<Socket> {
  await privateDirectory(path);
  const info = await lstat(path);
  if (!info.isSocket() || info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o600)
    throw invalid();
  const socket = createConnection(path);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  return socket;
}
export async function serveCompanion(tools: CommunityTools, path: string) {
  await privateDirectory(path);
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    if (sockets.size >= 4) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.setTimeout(600000, () => socket.destroy());
    const handle = serveStdio(() => createStdioServer(tools), {
      transport: new StdioServerTransport(socket, socket, { maxBufferSize: 32768 }),
      maxSubscriptions: 16,
      onerror: () => socket.destroy(),
    });
    socket.on('error', () => socket.destroy());
    socket.on('close', () => {
      sockets.delete(socket);
      void handle.close().catch(() => undefined);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, resolve);
  });
  await chmod(path, 0o600);
  const owned = await lstat(path);
  return {
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      const current = await lstat(path).catch(() => undefined);
      if (current?.ino === owned.ino && current.dev === owned.dev) await unlink(path);
    },
  };
}
