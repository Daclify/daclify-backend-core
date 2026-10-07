import { ApiError } from './errors.js';
export async function readBoundedResponse(
  response: Response,
  maximum: number,
): Promise<Uint8Array> {
  if (!response.body) throw new ApiError('CONTENT_UNAVAILABLE', 503);
  const length = response.headers.get('content-length');
  if (length !== null && (!/^[0-9]+$/.test(length) || BigInt(length) > BigInt(maximum)))
    throw new ApiError('CONTENT_SIZE', 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > maximum) throw new ApiError('CONTENT_SIZE', 502);
      chunks.push(chunk.value);
    }
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
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
