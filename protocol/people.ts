import { z } from 'zod';
import { CidSchema, DaoRefSchema, IdSchema, NativeAccountSchema, Uint64Schema } from './base.js';

const link = z.union([
  z.literal(''),
  z
    .url()
    .max(300)
    .refine((value) => new URL(value).protocol === 'https:'),
]);
const image = z.union([z.literal(''), CidSchema]);
export const PublicProfileSchema = z.strictObject({
  name: NativeAccountSchema.refine((value) => value.length <= 12 && !value.includes('..')),
  fullName: z.string().max(80).optional(),
  location: z.string().max(80).optional(),
  email: z.string().max(254).optional(),
  telegram: z.string().max(32).optional(),
  introduction: z.string().max(2000).optional(),
  motto: z.string().max(140).optional(),
  facebook: link.optional(),
  instagram: link.optional(),
  youtube: link.optional(),
  linkedin: link.optional(),
  website: link.optional(),
  avatar: image.optional(),
  background: image.optional(),
});
export const PublicPersonSchema = z.strictObject({
  id: Uint64Schema,
  dao: DaoRefSchema,
  memberId: IdSchema,
  accountName: NativeAccountSchema,
  profile: PublicProfileSchema,
});
export const PeopleRoutes = {
  list: {
    method: 'GET',
    path: '/v1/people',
    helpTopic: 'accounts',
    query: z
      .strictObject({
        after: Uint64Schema.optional(),
        daoId: IdSchema.optional(),
        memberId: IdSchema.optional(),
      })
      .refine(
        (value) => !value.memberId || (!!value.daoId && value.after === undefined),
        'A member lookup requires its DAO and cannot include a page cursor.',
      ),
    response: z.strictObject({
      profiles: z.array(PublicPersonSchema).max(50),
      next: Uint64Schema.nullable(),
      skipped: z.int().nonnegative().default(0),
    }),
  },
} as const;
export type PublicPerson = z.infer<typeof PublicPersonSchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
