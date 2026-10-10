#!/usr/bin/env node
import {
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  createPrivateKey,
  publicEncrypt,
  privateDecrypt,
  randomBytes,
  constants,
} from 'node:crypto';
import { open, readFile, stat, unlink } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
const Kind = z.enum(['database', 'openbao', 'config']);
const Header = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal('RSA-OAEP-SHA256+AES-256-GCM'),
  kind: Kind,
  key: z
    .string()
    .min(100)
    .max(2048)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
});
const [operation, kind, source, target, keyFile] = process.argv.slice(2);
let output,
  key,
  created = false;
try {
  if (
    !['encrypt', 'decrypt'].includes(operation) ||
    !source ||
    !target ||
    !keyFile ||
    ![source, target, keyFile].every(isAbsolute) ||
    source === target
  )
    throw new Error();
  const type = Kind.parse(kind),
    metadata = await stat(source);
  if (!metadata.isFile() || metadata.size === 0 || metadata.size > 50 * 1024 ** 3)
    throw new Error();
  const pem = await readFile(keyFile, 'utf8');
  if (operation === 'encrypt') {
    const recipient = createPublicKey(pem);
    if (
      recipient.asymmetricKeyType !== 'rsa' ||
      (recipient.asymmetricKeyDetails?.modulusLength ?? 0) < 3072
    )
      throw new Error();
    key = randomBytes(32);
    const iv = randomBytes(12);
    const header = Buffer.from(
      JSON.stringify(
        Header.parse({
          version: 1,
          algorithm: 'RSA-OAEP-SHA256+AES-256-GCM',
          kind: type,
          key: publicEncrypt(
            { key: recipient, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
            key,
          ).toString('base64'),
          iv: iv.toString('base64'),
        }),
      ) + '\n',
    );
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(header);
    output = await open(target, 'wx', 0o600);
    created = true;
    await output.write(header);
    await pipeline(
      createReadStream(source),
      cipher,
      createWriteStream(target, { fd: output.fd, autoClose: false, start: header.length }),
    );
    const size = (await output.stat()).size,
      tag = cipher.getAuthTag();
    await output.write(tag, 0, tag.length, size);
    await output.sync();
  } else {
    const secret = createPrivateKey(pem);
    if (
      secret.asymmetricKeyType !== 'rsa' ||
      (secret.asymmetricKeyDetails?.modulusLength ?? 0) < 3072
    )
      throw new Error();
    const input = await open(source, 'r');
    let header, parsed, tag;
    try {
      const first = Buffer.alloc(8192),
        result = await input.read(first, 0, first.length, 0),
        index = first.subarray(0, result.bytesRead).indexOf(10);
      if (index < 0 || metadata.size <= index + 17) throw new Error();
      header = first.subarray(0, index + 1);
      parsed = Header.parse(JSON.parse(header.toString('utf8')));
      if (parsed.kind !== type) throw new Error();
      tag = Buffer.alloc(16);
      if ((await input.read(tag, 0, 16, metadata.size - 16)).bytesRead !== 16) throw new Error();
    } finally {
      await input.close();
    }
    key = privateDecrypt(
      { key: secret, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(parsed.key, 'base64'),
    );
    if (key.length !== 32) throw new Error();
    const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64'));
    cipher.setAAD(header);
    cipher.setAuthTag(tag);
    output = await open(target, 'wx', 0o600);
    created = true;
    await pipeline(
      createReadStream(source, { start: header.length, end: metadata.size - 17 }),
      cipher,
      createWriteStream(target, { fd: output.fd, autoClose: false }),
    );
    await output.sync();
  }
  console.log(`Recovery ${type} ${operation} completed.`);
} catch {
  process.exitCode = 1;
  await output?.close().catch(() => {});
  output = undefined;
  if (created && target) await unlink(target).catch(() => {});
  console.error(
    'RECOVERY_BACKUP_FAILED: check the arguments, key, file permissions and authenticated backup.',
  );
} finally {
  key?.fill(0);
  await output?.close().catch(() => {});
}
