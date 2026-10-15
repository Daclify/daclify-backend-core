import { Worker } from 'node:worker_threads';
import {
  QuickBallotArchiveInputSchema,
  OrdinaryPollArchivePlanSchema,
} from '@daclify/modules/archive';
import { ApiError } from '../errors.js';

// A full 5,000-vote proof check takes minutes; keep it off the API event loop.
export async function planQuickArchive(value: unknown, signal?: AbortSignal) {
  const input = QuickBallotArchiveInputSchema.parse(value);
  if (Buffer.byteLength(JSON.stringify(input)) > 24 * 1024 * 1024)
    throw new ApiError('QUICK_ARCHIVE_LIMIT', 409);
  if (signal?.aborted) throw new ApiError('QUICK_ARCHIVE_CANCELLED', 503);
  const worker = new Worker(
    `
    const {parentPort,workerData}=require('node:worker_threads');
    import('@daclify/modules/archive').then(({planQuickBallotArchive})=>{
      parentPort.postMessage(planQuickBallotArchive(workerData));
    }).catch(()=>process.exit(1));
  `,
    {
      eval: true,
      workerData: input,
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
    },
  );
  try {
    return await new Promise<ReturnType<typeof OrdinaryPollArchivePlanSchema.parse>>(
      (resolve, reject) => {
        const fail = (code: string) => reject(new ApiError(code, 503));
        const timer = setTimeout(() => fail('QUICK_ARCHIVE_TIMEOUT'), 15 * 60 * 1000);
        timer.unref();
        const cancel = () => fail('QUICK_ARCHIVE_CANCELLED');
        signal?.addEventListener('abort', cancel, { once: true });
        const clear = () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', cancel);
        };
        worker.once('message', (message: unknown) => {
          clear();
          const result = OrdinaryPollArchivePlanSchema.safeParse(message);
          if (result.success) resolve(result.data);
          else fail('QUICK_ARCHIVE_PLAN_INVALID');
        });
        worker.once('error', () => {
          clear();
          fail('QUICK_ARCHIVE_PLAN_INVALID');
        });
        worker.once('exit', () => {
          clear();
          fail('QUICK_ARCHIVE_PLAN_INVALID');
        });
      },
    );
  } finally {
    await worker.terminate();
  }
}
