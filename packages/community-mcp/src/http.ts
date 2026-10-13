import { communityServerInfo } from './server-info.js';
import {
  createMcpHandler,
  McpServer,
  type McpHttpHandler,
  type McpRequestContext,
} from '@modelcontextprotocol/server';
import type { CommunityAccess } from '@daclify/core-protocol/community-agent';
import { createCommunityTools } from './tools.js';
export function createMcpHttpHandler(
  access: (context: McpRequestContext) => CommunityAccess,
): McpHttpHandler {
  return createMcpHandler((context) => {
    const server = new McpServer(communityServerInfo);
    createCommunityTools(access(context)).register(server, { oauth: true });
    return server;
  });
}
