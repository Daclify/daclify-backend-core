import { z } from 'zod';
import { ModuleDeploymentSchema } from '@daclify/modules';
import { NativeAccountSchema } from '../../../protocol/base.js';

function parseProxyIps(value: string | undefined, error: string): string[] {
  try {
    const parsed: unknown = value === undefined ? [] : JSON.parse(value);
    return [
      ...new Set(
        z
          .array(z.union([z.ipv4(), z.ipv6()]))
          .max(16)
          .parse(parsed),
      ),
    ];
  } catch {
    throw new Error(error);
  }
}

export function parseTrustedProxyIps(value?: string): string[] {
  return [...new Set(['127.0.0.1', '::1', ...parseProxyIps(value, 'TRUSTED_PROXY_IPS_INVALID')])];
}

export function parseSharedProxyIps(value?: string, trusted = parseTrustedProxyIps()): string[] {
  const shared = parseProxyIps(value, 'SHARED_PROXY_IPS_INVALID');
  if (shared.some((ip) => trusted.includes(ip))) throw new Error('SHARED_PROXY_IPS_INVALID');
  return shared;
}

const ModuleDeploymentConfigSchema = z
  .array(
    z.strictObject({
      id: ModuleDeploymentSchema.shape.id,
      account: NativeAccountSchema,
    }),
  )
  .max(5)
  .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'Duplicate module');

export type ModuleDeploymentConfig = z.infer<typeof ModuleDeploymentConfigSchema>;

export function parseModuleDeployments(value: string): ModuleDeploymentConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('MODULE_DEPLOYMENTS_INVALID');
  }
  const result = ModuleDeploymentConfigSchema.safeParse(parsed);
  if (!result.success) throw new Error('MODULE_DEPLOYMENTS_INVALID');
  return result.data;
}

const FrontendOriginSchema = z.string().refine((value) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const loopback =
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.hostname.endsWith('.localhost');
  return (
    url.origin === value &&
    !url.hostname.includes('*') &&
    (url.protocol === 'https:' || (url.protocol === 'http:' && loopback))
  );
});

export function parseFrontendOrigins(origin: string, additional?: string): string[] {
  let parsed: unknown = [];
  try {
    if (additional !== undefined) parsed = JSON.parse(additional);
  } catch {
    throw new Error('FRONTEND_ORIGINS_INVALID');
  }
  const primary = FrontendOriginSchema.safeParse(origin);
  const extra = z.array(FrontendOriginSchema).safeParse(parsed);
  if (!primary.success || !extra.success) throw new Error('FRONTEND_ORIGINS_INVALID');
  return [...new Set([primary.data, ...extra.data])];
}
