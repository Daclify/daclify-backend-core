import { z } from 'zod';
import { ChainIdSchema, DaoRefSchema } from './base.js';
import { MetadataSchema } from './dao.js';
import { PrivateRecordReferenceSchema } from './private-records.js';

export const PrivateRecordRoutes = {
  identity: {
    method: 'GET',
    path: '/v1/daos/:id/private-identity',
    response: z.strictObject({
      dao: DaoRefSchema,
      reference: PrivateRecordReferenceSchema.nullable(),
      metadata: MetadataSchema,
      metadataCommitment: ChainIdSchema,
    }),
    helpTopic: 'privacy',
  },
} as const;
