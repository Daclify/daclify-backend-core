import { afterEach, expect, it, vi } from 'vitest';
import { startPollingWorker } from '../services/api/src/jobs.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('logs synchronous work failures and retries without losing the polling loop', async () => {
  vi.useFakeTimers();
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const work = vi.fn(() => Promise.resolve('idle'));
  work.mockImplementationOnce(() => {
    throw new Error('private provider detail');
  });
  const worker = startPollingWorker(work, 'WORKER_FAILED');
  await vi.advanceTimersByTimeAsync(5000);
  expect(log).toHaveBeenCalledExactlyOnceWith('WORKER_FAILED');
  expect(work).toHaveBeenCalledTimes(2);
  await worker.stop();
  await vi.advanceTimersByTimeAsync(10000);
  expect(work).toHaveBeenCalledTimes(2);
});

it('waits for in-flight work at shutdown and does not schedule another run', async () => {
  vi.useFakeTimers();
  let finish: ((result: string) => void) | undefined;
  const work = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const worker = startPollingWorker(work, 'WORKER_FAILED');
  let stopped = false;
  const stop = worker.stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  expect(stopped).toBe(false);
  if (!finish) throw new Error('Work did not start');
  finish('processed');
  await stop;
  await vi.advanceTimersByTimeAsync(10000);
  expect(work).toHaveBeenCalledTimes(1);
});
