import { expect, it, vi } from 'vitest';
import { readBoundedResponse } from '../services/api/src/http.js';

it.each(['11', 'invalid'])(
  'cancels a response rejected by its content-length (%s)',
  async (length) => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    await expect(
      readBoundedResponse(new Response(body, { headers: { 'content-length': length } }), 10),
    ).rejects.toMatchObject({ code: 'CONTENT_SIZE', statusCode: 502 });
    expect(cancel).toHaveBeenCalledTimes(1);
  },
);

it('bounds streamed bytes without trusting content-length and cancels oversized bodies', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(11));
    },
    cancel,
  });
  await expect(
    readBoundedResponse(new Response(body, { headers: { 'content-length': '1' } }), 10),
  ).rejects.toMatchObject({ code: 'CONTENT_SIZE', statusCode: 502 });
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('accepts exactly the limit across chunks without altering UTF-8 bytes', async () => {
  const bytes = new TextEncoder().encode('żółw');
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 1));
      controller.enqueue(bytes.slice(1));
      controller.close();
    },
  });
  expect(await readBoundedResponse(new Response(body), bytes.length)).toEqual(bytes);
});
