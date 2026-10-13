import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createStdioServer } from '../src/stdio.js';
import { createCommunityTools } from '../src/tools.js';
await serveStdio(() =>
  createStdioServer(
    createCommunityTools({
      read: async () => ({ daos: [] }),
      prepare: async () => {
        throw Error('Fixture rejection');
      },
      submitSigned: async () => {
        throw Error('Fixture rejection');
      },
    }),
  ),
);
