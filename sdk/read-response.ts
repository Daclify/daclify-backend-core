export async function readAppResponse(
  response: Response,
  maximum = 5 * 1024 * 1024,
): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new Error('APP_SOURCE_UNAVAILABLE');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^[0-9]+$/.test(length) || BigInt(length) > BigInt(maximum))) {
    await response.body.cancel();
    throw new Error('APP_SOURCE_SIZE');
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > maximum) throw new Error('APP_SOURCE_SIZE');
      chunks.push(chunk.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
