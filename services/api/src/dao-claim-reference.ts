import { createHash } from 'node:crypto';
export const daoClaimReference = (chainId: string, runtime: string, id: string) =>
  createHash('sha256').update(`daclify.dao-claim.v1:${chainId}:${runtime}:${id}`).digest('hex');
