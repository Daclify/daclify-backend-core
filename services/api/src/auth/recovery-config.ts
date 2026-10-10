import { createHash } from 'node:crypto';
import { readFile, stat, realpath } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { z } from 'zod';
import { ApiOriginSchema, VERSION } from '../../../../protocol/base.js';
import { ProviderScopeSchema } from '../../../../protocol/storage.js';
import { OpenBaoCustody } from '../../../custody/openbao.js';
import { PinataStorage } from '../content/pinata.js';
import { EncryptedRecoveryStore } from './recovery-storage.js';
import type { RecoveryConfiguration } from './recovery.js';
const EvidenceSchema = z.strictObject({
  file: z
    .string()
    .min(1)
    .max(128)
    .refine((value) => basename(value) === value),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export const RecoveryQualificationSchema = z
  .strictObject({
    version: z.literal(1),
    coreVersion: z.literal(VERSION),
    origin: ApiOriginSchema,
    storeScope: ProviderScopeSchema,
    keyServiceOrigin: ApiOriginSchema,
    issuedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    assisted: z.boolean(),
    sourceHost: z.string().min(1).max(255),
    restoreHost: z.string().min(1).max(255),
    reviewedBy: z.string().min(1).max(128),
    checks: z
      .array(
        EvidenceSchema.extend({
          kind: z.enum(['database-restore', 'key-service-restore', 'offsite-blob']),
        }),
      )
      .length(3),
    clients: z
      .array(
        EvidenceSchema.extend({
          kind: z.enum(['evm', 'native', 'passkey']),
          browser: z.string().min(1).max(128),
          wallet: z.string().min(1).max(128),
        }),
      )
      .max(32),
  })
  .refine(
    (value) =>
      value.sourceHost !== value.restoreHost &&
      new Set(value.checks.map((check) => check.kind)).size === 3,
    'Independent restore evidence required',
  );
const EnvironmentSchema = z.object({
  RECOVERY_ENABLED: z.literal('1'),
  RECOVERY_OPENBAO_ADDRESS: ApiOriginSchema.refine((value) => value.startsWith('https://')),
  RECOVERY_OPENBAO_TOKEN_FILE: z.string().startsWith('/'),
  RECOVERY_QUALIFICATION_FILE: z.string().startsWith('/'),
  FRONTEND_ORIGIN: ApiOriginSchema.refine((value) => value.startsWith('https://')),
  PINATA_JWT: z.string().min(1),
  CONTENT_GATEWAY: ApiOriginSchema,
  CONTENT_GATEWAY_KEY: z.string().optional(),
  PINATA_STORAGE_SCOPE: ProviderScopeSchema,
});
export async function readRecoveryConfiguration(
  env: Record<string, string | undefined>,
): Promise<RecoveryConfiguration | undefined> {
  if (env.RECOVERY_ENABLED === undefined || env.RECOVERY_ENABLED === '0') return undefined;
  try {
    const config = EnvironmentSchema.parse(env),
      directory = await realpath(dirname(config.RECOVERY_QUALIFICATION_FILE));
    const reportPath = await realpath(config.RECOVERY_QUALIFICATION_FILE);
    const reportStat = await stat(reportPath);
    if (
      dirname(reportPath) !== directory ||
      !reportStat.isFile() ||
      (reportStat.mode & 0o022) !== 0 ||
      reportStat.size > 65536
    )
      throw new Error();
    const report = RecoveryQualificationSchema.parse(
        JSON.parse(await readFile(reportPath, 'utf8')),
      ),
      now = Date.now();
    if (
      report.origin !== config.FRONTEND_ORIGIN ||
      report.keyServiceOrigin !== config.RECOVERY_OPENBAO_ADDRESS ||
      report.storeScope !== config.PINATA_STORAGE_SCOPE ||
      Date.parse(report.issuedAt) > now ||
      Date.parse(report.expiresAt) <= now ||
      Date.parse(report.expiresAt) - Date.parse(report.issuedAt) > 90 * 86400000
    )
      throw new Error();
    for (const item of [...report.checks, ...report.clients]) {
      const path = await realpath(resolve(directory, item.file));
      const metadata = await stat(path);
      if (
        dirname(path) !== directory ||
        !metadata.isFile() ||
        (metadata.mode & 0o022) !== 0 ||
        metadata.size > 1024 * 1024
      )
        throw new Error();
      const bytes = await readFile(path);
      if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error();
      const evidence = z
        .object({
          status: z.literal('passed'),
          kind: z.string(),
          origin: ApiOriginSchema,
          coreVersion: z.literal(VERSION),
        })
        .parse(JSON.parse(bytes.toString('utf8')));
      if (evidence.kind !== item.kind || evidence.origin !== report.origin) throw new Error();
    }
    const tokenPath = config.RECOVERY_OPENBAO_TOKEN_FILE;
    async function token(): Promise<string> {
      const metadata = await stat(tokenPath);
      if (!metadata.isFile() || (metadata.mode & 0o077) !== 0 || metadata.size > 8192)
        throw new Error('RECOVERY_TOKEN_UNAVAILABLE');
      const value = (await readFile(tokenPath, 'utf8')).trim();
      if (!value || /[\r\n]/.test(value)) throw new Error('RECOVERY_TOKEN_UNAVAILABLE');
      return value;
    }
    await token();
    const custody = new OpenBaoCustody(config.RECOVERY_OPENBAO_ADDRESS, token);
    const keys = {
      wrap: (name: string, bytes: Uint8Array) => custody.wrapExisting(name, bytes),
      unwrap: (name: string, cipher: string) => custody.unwrap(name, cipher),
    };
    const store = new EncryptedRecoveryStore(
      new PinataStorage(config.PINATA_JWT, config.CONTENT_GATEWAY, config.CONTENT_GATEWAY_KEY),
      keys,
      report.storeScope,
    );
    const qualifiedWallets = report.clients.flatMap((client) =>
      client.kind === 'evm' || client.kind === 'native' ? [client.kind] : [],
    );
    return {
      store,
      keys,
      qualifiedWallets,
      passkeysQualified: report.clients.some((client) => client.kind === 'passkey'),
      assistedQualified: report.assisted,
      expiresAt: Date.parse(report.expiresAt),
    };
  } catch {
    throw new Error('RECOVERY_CONFIGURATION_INVALID');
  }
}
