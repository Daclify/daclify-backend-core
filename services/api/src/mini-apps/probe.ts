import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request } from 'node:https';
import { AppReadinessSchema, type ConnectionCheckSchema } from '../../../../protocol/mini-apps.js';
import { appBindingHash, type AppBinding } from '../../../../protocol/mini-app-database.js';
import type { z } from 'zod';

const blocked = new BlockList();
for (const [address, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] satisfies [string, number][])
  blocked.addSubnet(address, bits, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, bits] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
] satisfies [string, number][])
  blocked.addSubnet(address, bits, 'ipv6');
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4
    ? !blocked.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}
export type Address = { address: string; family: 4 | 6 };
type ProbeResponse = { status: number; bytes: Uint8Array };
export interface ProbeDependencies {
  lookup(hostname: string): Promise<readonly Address[]>;
  request(url: URL, address: Address, signal: AbortSignal): Promise<ProbeResponse>;
}
const limit = 65536;
export async function pinnedHttpsRequest(
  url: URL,
  address: Address,
  signal: AbortSignal,
  post?: { token: string },
): Promise<ProbeResponse> {
  return new Promise((resolve, reject) => {
    const pending = request(
      url,
      {
        method: post ? 'POST' : 'GET',
        agent: false,
        family: address.family,
        signal,
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        headers: {
          accept: 'application/json',
          ...(post
            ? {
                authorization: 'Bearer ' + post.token,
                'content-type': 'application/json',
                'content-length': '2',
              }
            : {}),
        },
      },
      (response) => {
        let size = 0;
        const chunks: Uint8Array[] = [];
        response.on('error', reject);
        const length = response.headers['content-length'];
        if (length && (!/^\d+$/.test(length) || BigInt(length) > BigInt(limit))) {
          response.destroy();
          reject(new Error('APP_ENDPOINT_SIZE'));
          return;
        }
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit) {
            response.destroy();
            reject(new Error('APP_ENDPOINT_SIZE'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, bytes: Buffer.concat(chunks) }),
        );
      },
    );
    pending.on('error', reject);
    pending.end(post ? '{}' : undefined);
  });
}
export const probeDependencies: ProbeDependencies = {
  lookup: async (hostname) =>
    (await lookup(hostname, { all: true, verbatim: true })).map((row) => {
      if (row.family !== 4 && row.family !== 6) throw new Error('APP_ENDPOINT_ADDRESS');
      return { address: row.address, family: row.family };
    }),
  request: pinnedHttpsRequest,
};
export async function probeReadiness(
  url: URL,
  binding: AppBinding,
  deps: ProbeDependencies = probeDependencies,
): Promise<z.infer<typeof ConnectionCheckSchema>> {
  const failed = (code: string) => ({
    stage: 'readiness' as const,
    status: 'failed' as const,
    codes: [code],
  });
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (url.port && url.port !== '443') ||
    !url.pathname.endsWith('/.well-known/daclify-mini-app.json')
  )
    return failed('APP_ENDPOINT_URL');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = async () => {
    const addresses = await deps.lookup(url.hostname);
    if (controller.signal.aborted) throw new Error('APP_ENDPOINT_TIMEOUT');
    if (
      !addresses.length ||
      addresses.length > 16 ||
      addresses.some((row) => !isPublicAddress(row.address) || isIP(row.address) !== row.family)
    )
      throw new Error('APP_ENDPOINT_ADDRESS');
    const address = addresses[0];
    if (!address) throw new Error('APP_ENDPOINT_ADDRESS');
    const result = await deps.request(url, address, controller.signal);
    if (result.bytes.length > limit) throw new Error('APP_ENDPOINT_SIZE');
    if (result.status >= 300 && result.status < 400) throw new Error('APP_ENDPOINT_REDIRECT');
    if (result.status !== 200) throw new Error('APP_ENDPOINT_UNAVAILABLE');
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result.bytes));
    } catch {
      throw new Error('APP_READINESS_INVALID');
    }
    const parsed = AppReadinessSchema.safeParse(body);
    if (!parsed.success) throw new Error('APP_READINESS_INVALID');
    if (appBindingHash(parsed.data.binding) !== appBindingHash(binding))
      throw new Error('APP_READINESS_BINDING');
    return { stage: 'readiness' as const, status: 'passed' as const, codes: [] };
  };
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('APP_ENDPOINT_TIMEOUT'));
        }, 5000);
      }),
    ]);
  } catch (error) {
    if (controller.signal.aborted) return failed('APP_ENDPOINT_TIMEOUT');
    const allowed = [
      'APP_ENDPOINT_ADDRESS',
      'APP_ENDPOINT_SIZE',
      'APP_ENDPOINT_REDIRECT',
      'APP_ENDPOINT_UNAVAILABLE',
      'APP_READINESS_INVALID',
      'APP_READINESS_BINDING',
    ];
    return failed(
      error instanceof Error && allowed.includes(error.message)
        ? error.message
        : 'APP_ENDPOINT_UNAVAILABLE',
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
