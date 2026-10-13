import { communityServerInfo } from './server-info.js';
import { McpServer } from '@modelcontextprotocol/server';
import type { CommunityTools } from './tools.js';
export function createStdioServer(tools: CommunityTools): McpServer {
  const server = new McpServer(communityServerInfo);
  tools.register(server);
  return server;
}
