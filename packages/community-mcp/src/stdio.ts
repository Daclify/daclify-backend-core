import { McpServer } from '@modelcontextprotocol/server';
import type { CommunityTools } from './tools.js';
export function createStdioServer(tools: CommunityTools): McpServer {
  const server = new McpServer({ name: 'daclify-community', version: '0.1.0-alpha.4' });
  tools.register(server);
  return server;
}
