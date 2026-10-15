import { Name } from '@wharfkit/antelope';
import { z } from 'zod';
import {
  ChainIdSchema,
  EvmAddressSchema,
  NativeAccountSchema,
  TelosEvmChainSchema,
} from './base.js';
import { SigningPublicKeySchema } from './crypto.js';

const CanonicalAccount = NativeAccountSchema.refine(
  (value) => Name.from(value).toString() === value,
);
export const QuickAccountAnchorSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('key'),
    publicKey: SigningPublicKeySchema.refine((value) => value.startsWith('PUB_K1_')),
  }),
  z.strictObject({
    kind: z.literal('native'),
    account: CanonicalAccount,
    permission: z.literal('active'),
  }),
  z.strictObject({
    kind: z.literal('evm'),
    chainId: TelosEvmChainSchema,
    address: EvmAddressSchema.transform((value) => value.toLowerCase()),
  }),
]);
export type QuickAccountAnchor = z.infer<typeof QuickAccountAnchorSchema>;
export const QuickAccountDomainSchema = z.strictObject({
  chainId: ChainIdSchema,
  runtime: CanonicalAccount,
});
