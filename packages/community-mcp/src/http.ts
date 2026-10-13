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
    const server = new McpServer({ name: 'daclify-community', version: '0.1.0-alpha.4' });
    createCommunityTools(access(context)).register(server);
    return server;
  });
}
