import { createRequire } from 'node:module';
import { z } from 'zod';
import { McpReleaseIdentitySchema } from '@daclify/core-protocol';
const manifest = z
  .object({
    name: z.literal('@daclify/community-mcp'),
    version: McpReleaseIdentitySchema.shape.mcpVersion,
  })
  .parse(createRequire(import.meta.url)('@daclify/community-mcp/package.json'));
export const communityServerInfo = { name: 'daclify-community', version: manifest.version };
