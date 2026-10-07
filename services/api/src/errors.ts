import { APIError } from '@wharfkit/antelope';
import { z } from 'zod';
import { ContractFailureMessages } from '../../../protocol/service-api.js';
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number = 400,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export function contractError(cause: unknown): ApiError {
  const body = z
    .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
    .safeParse(cause instanceof APIError ? cause.response.json : undefined);
  if (body.success)
    for (const detail of body.data.error.details) {
      const match = detail.message.match(/^(?:assertion failure with message: )?([A-Z_]+)$/);
      if (match?.[1] && Object.hasOwn(ContractFailureMessages, match[1]))
        return new ApiError(match[1], 409);
    }
  return new ApiError('CHAIN_ACTION_REJECTED', 409);
}
