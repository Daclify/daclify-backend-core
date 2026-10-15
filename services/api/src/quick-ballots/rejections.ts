import { APIError } from '@wharfkit/antelope';
import { z } from 'zod';
import { ApiError } from '../errors.js';
const CodeSchema = z.enum([
  'QUICK_REVISION',
  'QUICK_CLOSED',
  'QUICK_AUDIENCE',
  'QUICK_CAPACITY',
  'QUICK_RESPONSE_REMOVED',
  'QUICK_NONCE',
  'QUICK_EPOCH',
  'QUICK_EXPIRES',
  'QUICK_ACCOUNT_INACTIVE',
  'QUICK_APPROVAL',
  'QUICK_SIGNATURE',
  'QUICK_ROOT_REQUIRED',
  'BLS_VOTE_PROOF',
  'BLS_SCALAR_RANGE',
  'BLS_SCALAR_SIZE',
  'BLS_POINT',
  'BLS_POINT_SIZE',
  'BLS_SUBGROUP',
  'BLS_PROOF_NONCE',
  'BLS_PROOF_SIZE',
  'RAM_ORDINARY_EXHAUSTED',
  'RAM_DAO_EXHAUSTED',
  'RAM_POOL_EXHAUSTED',
  'RAM_ALLOCATION_REQUIRED',
]);
export class QuickSubmissionRejection extends ApiError {
  constructor(code: unknown) {
    super(CodeSchema.parse(code), 409);
  }
}
export function quickSubmissionRejection(cause: unknown): QuickSubmissionRejection | null {
  if (!(cause instanceof APIError)) return null;
  const body = z
    .object({
      error: z.object({
        code: z.literal(3050003),
        details: z.array(z.object({ message: z.string().max(1024) })).max(25),
      }),
    })
    .safeParse(cause.response.json);
  if (!body.success) return null;
  for (const detail of body.data.error.details) {
    const token = detail.message.match(/^(?:assertion failure with message: )?([A-Z_]+)$/)?.[1],
      code = CodeSchema.safeParse(token);
    if (code.success) return new QuickSubmissionRejection(code.data);
  }
  return null;
}
