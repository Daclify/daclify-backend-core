import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { open, mkdir, rename, unlink, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { ApiOriginSchema } from '@daclify/core-protocol';
export const LocalCredentialsSchema = z.strictObject({
  version: z.literal(1),
  api: ApiOriginSchema,
  grantToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  delegateKey: z
    .string()
    .max(128)
    .refine((value) => {
      try {
        return PrivateKey.from(value).toString() === value;
      } catch {
        return false;
      }
    }),
  grantId: z.uuid(),
});
const Envelope = z.strictObject({
  version: z.literal(1),
  salt: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  iv: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  tag: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  ciphertext: z.string().regex(/^[A-Za-z0-9_-]{1,16384}$/),
});
const domain = Buffer.from('daclify.local-mcp-credentials.v1');
async function key(password: string, salt: Buffer) {
  if (password.length < 16 || password.length > 1024) throw Error('MCP_CREDENTIALS');
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 32, (error, derived) => (error ? reject(error) : resolve(derived))),
  );
}
export async function saveCredentials(
  file: string,
  input: unknown,
  password: string,
): Promise<void> {
  if (!isAbsolute(file)) throw Error('MCP_CREDENTIALS');
  const value = LocalCredentialsSchema.parse(input),
    salt = randomBytes(32),
    iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await key(password, salt), iv);
  cipher.setAAD(domain);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const envelope = Envelope.parse({
    version: 1,
    salt: salt.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  });
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const parent = await lstat(dirname(file));
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    (parent.mode & 0o077) !== 0 ||
    parent.uid !== process.getuid?.()
  )
    throw Error('MCP_CREDENTIALS');
  const temporary = file + '.' + randomBytes(16).toString('hex');
  const handle = await open(
    temporary,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(JSON.stringify(envelope) + '\n');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, file);
    const directory = await open(
      dirname(file),
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
export async function loadCredentials(file: string, password: string) {
  try {
    if (!isAbsolute(file)) throw Error('path');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let raw: string;
    try {
      const info = await handle.stat();
      if (
        !info.isFile() ||
        (info.mode & 0o777) !== 0o600 ||
        info.uid !== process.getuid?.() ||
        info.size > 32768
      )
        throw Error('mode');
      raw = await handle.readFile('utf8');
    } finally {
      await handle.close();
    }
    const envelope = Envelope.parse(JSON.parse(raw)),
      decipher = createDecipheriv(
        'aes-256-gcm',
        await key(password, Buffer.from(envelope.salt, 'base64url')),
        Buffer.from(envelope.iv, 'base64url'),
      );
    decipher.setAAD(domain);
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
      decipher.final(),
    ]);
    try {
      return LocalCredentialsSchema.parse(JSON.parse(plaintext.toString('utf8')));
    } finally {
      plaintext.fill(0);
    }
  } catch {
    throw Error('MCP_CREDENTIALS');
  }
}
