import { APIClient } from '@wharfkit/antelope';
import { ApiError } from './errors.js';

export function createRpcClient(url: string): APIClient {
  return new APIClient({
    url,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        return await fetch(input, {
          ...init,
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        throw new ApiError('CHAIN_UNAVAILABLE', 503);
      }
    },
  });
}
